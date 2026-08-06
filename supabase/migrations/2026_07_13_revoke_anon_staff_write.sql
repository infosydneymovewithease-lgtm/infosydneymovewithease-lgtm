-- ═══════════════════════════════════════════════════════════════
-- 安全审计 2026-07-13 · 第一批 · A1
-- 撤销匿名对「增删改员工」RPC 的执行权
--
-- 背景：add_staff / update_staff 之前 GRANT 给了 anon。
-- 由于前端 bundle 里带着公开 key（任何人可从网页源码扒到），
-- 等于任何陌生人不登录就能调 add_staff 凭空造一个 admin 账号，
-- 或用 update_staff 改任意员工的密码/角色 —— 纯远程提权。
--
-- ⚠️ Postgres 陷阱：函数创建时默认把 EXECUTE 授予 PUBLIC，
-- 而 anon/authenticated 都属于 PUBLIC。只 REVOKE FROM anon
-- 是无效的（权限从 PUBLIC 继承回来），必须连 PUBLIC 一起撤。
--
-- 影响：后台「设置」页的 加师傅 / 改师傅 / 停用师傅 三个按钮会失效，
-- 改为临时走 SQL（见文件末尾模板）。等接入 Supabase Auth 后
-- 改为 GRANT TO authenticated + 函数内校验 admin 角色，再恢复按钮。
--
-- 不动的：login_staff（登录必须匿名可调）
--         list_staff（开机加载派单页依赖，且不返回密码）
--         这两个的收口归第二/三批。
-- ═══════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.add_staff(jsonb)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_staff(text, jsonb)
  FROM PUBLIC, anon, authenticated;

-- ── 验证：跑完下面这句，两个函数的 acl 里应该看不到 anon/=X ──
-- SELECT p.proname, p.proacl
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname IN ('add_staff','update_staff');


-- ═══════════════════════════════════════════════════════════════
-- 附：撤权期间「加/改/停用员工」的 SQL 模板（在 Supabase SQL Editor 跑）
-- ═══════════════════════════════════════════════════════════════
--
-- 【加师傅】
-- INSERT INTO staff (id, username, name, password, role, phone, wechat,
--                    "isDriver", "canDrive", stars, active)
-- VALUES ('xiaoli', 'xiaoli', '小李', '设个强密码', 'worker', '04xxxxxxxx', '',
--         true, '["面包车","小卡车"]'::jsonb, 4, true);
--
-- 【改密码】
-- UPDATE staff SET password = '新强密码' WHERE username = 'xiaoli';
--
-- 【改可开车型 / 星级】
-- UPDATE staff SET "canDrive" = '["面包车","小卡车","大卡车"]'::jsonb, stars = 5
-- WHERE username = 'xiaoli';
--
-- 【停用师傅】（不要删行，删了历史订单会找不到人）
-- UPDATE staff SET active = false WHERE username = 'xiaoli';
--
-- 【恢复】
-- UPDATE staff SET active = true WHERE username = 'xiaoli';
