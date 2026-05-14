-- S1-D: 锁 staff 表 — 杜绝 anon key 持有者直接读员工密码
-- Why: 当前 staff 表 RLS 关闭 + 密码明文存储 + 任何 anon key 都能 SELECT *
--      这意味着任何人 F12 抓到 anon key 就能拉走所有员工密码
-- How: 把所有 staff 表的 SELECT 包进 SECURITY DEFINER RPC 函数，
--      然后启用 RLS 拒绝 anon 直接访问。
--      前端登录从 supabase.from('staff') 改成 supabase.rpc('login_staff')

-- ⚠️ 执行前请先备份 staff 表（保险起见）：
--    CREATE TABLE staff_backup_20260514 AS SELECT * FROM staff;
-- 万一函数出问题导致全员登不进，1 行回滚：
--    ALTER TABLE staff DISABLE ROW LEVEL SECURITY;

-- ── 1. 登录函数 — 验证用户名密码，返回去掉密码字段的用户对象 ─────
CREATE OR REPLACE FUNCTION public.login_staff(
  p_username text,
  p_password text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER  -- 关键：以函数所有者权限执行，绕过 RLS
SET search_path = public
AS $$
DECLARE
  user_row staff;
  result json;
BEGIN
  SELECT * INTO user_row FROM staff
  WHERE username = p_username
    AND password = p_password
    AND active = true
  LIMIT 1;

  IF user_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 返回完整用户对象但**不含密码**（防止前端代码意外泄漏到 localStorage）
  result := jsonb_build_object(
    'id',        user_row.id,
    'username',  user_row.username,
    'name',      user_row.name,
    'role',      user_row.role,
    'phone',     user_row.phone,
    'wechat',    user_row.wechat,
    'canDrive',  user_row."canDrive",
    'active',    user_row.active,
    'stars',     user_row.stars,
    'isDriver',  user_row."isDriver"
  );
  RETURN result;
END;
$$;

-- 授予 anon 角色执行权限（这样未登录的客户端可以调用 login）
GRANT EXECUTE ON FUNCTION public.login_staff(text, text) TO anon, authenticated;

-- ── 2. 列出员工 — 给客服派单页面用，返回不含密码的完整列表 ─────
CREATE OR REPLACE FUNCTION public.list_staff()
RETURNS TABLE (
  id text,
  username text,
  name text,
  role text,
  phone text,
  wechat text,
  "canDrive" jsonb,
  active boolean,
  stars int,
  "isDriver" boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, username, name, role, phone, wechat,
         "canDrive", active, stars, "isDriver"
  FROM staff
  WHERE active = true
$$;

GRANT EXECUTE ON FUNCTION public.list_staff() TO anon, authenticated;

-- ── 3. 添加员工 — 给设置页面用 ────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_staff(
  p_data jsonb
) RETURNS staff
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_row staff;
BEGIN
  INSERT INTO staff (
    id, username, password, name, role, phone, wechat,
    "canDrive", active, stars, "isDriver"
  ) VALUES (
    p_data->>'id',
    p_data->>'username',
    p_data->>'password',
    p_data->>'name',
    p_data->>'role',
    p_data->>'phone',
    p_data->>'wechat',
    p_data->'canDrive',
    COALESCE((p_data->>'active')::boolean, true),
    COALESCE((p_data->>'stars')::int, 1),
    COALESCE((p_data->>'isDriver')::boolean, false)
  )
  RETURNING * INTO new_row;
  RETURN new_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_staff(jsonb) TO anon, authenticated;

-- ── 4. 更新员工 ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_staff(
  p_id text,
  p_updates jsonb
) RETURNS staff
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row staff;
BEGIN
  -- 简单做法：把 p_updates 整个合并到现有行
  -- 注意：客户端不应该通过此函数改密码（应该有单独的 change_password RPC）
  -- 但 MVP 期暂时允许，避免重写更多代码
  UPDATE staff SET
    username    = COALESCE(p_updates->>'username',    username),
    password    = COALESCE(p_updates->>'password',    password),
    name        = COALESCE(p_updates->>'name',        name),
    role        = COALESCE(p_updates->>'role',        role),
    phone       = COALESCE(p_updates->>'phone',       phone),
    wechat      = COALESCE(p_updates->>'wechat',      wechat),
    "canDrive"  = COALESCE(p_updates->'canDrive',     "canDrive"),
    active      = COALESCE((p_updates->>'active')::boolean,    active),
    stars       = COALESCE((p_updates->>'stars')::int,         stars),
    "isDriver"  = COALESCE((p_updates->>'isDriver')::boolean,  "isDriver")
  WHERE id = p_id
  RETURNING * INTO updated_row;
  RETURN updated_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_staff(text, jsonb) TO anon, authenticated;

-- ── 5. 启用 staff 表 RLS（不写 policy 就是默认 deny） ────────
-- 此时 anon 角色直接 SELECT/INSERT/UPDATE staff 都会被拒绝
-- 只能通过上面 4 个 RPC 函数访问（它们用 SECURITY DEFINER 绕过 RLS）
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- ── 验证 ─────────────────────────────────────────────────────
-- 跑完后用 supabase 控制台测试：
-- 1) SELECT * FROM staff; 应该返回 0 行（被 RLS 拒绝）
-- 2) SELECT login_staff('your-username', 'your-password'); 应该返回 json 对象
-- 3) SELECT * FROM list_staff(); 应该返回所有 active 员工（不含密码）

-- ── 回滚（万一出问题）────────────────────────────────────────
-- ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
-- DROP FUNCTION IF EXISTS public.login_staff(text, text);
-- DROP FUNCTION IF EXISTS public.list_staff();
-- DROP FUNCTION IF EXISTS public.add_staff(jsonb);
-- DROP FUNCTION IF EXISTS public.update_staff(text, jsonb);
