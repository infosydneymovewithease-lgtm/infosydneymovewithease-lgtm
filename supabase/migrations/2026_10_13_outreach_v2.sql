-- 2026-10-13 · 主动开发按角色拆开 + 日配额 + 截图
--
-- 老板 10-13 把要求说具体了：
--   客服  「小红书主动搜索找搬家的人关键词，在下面留下我们的评论，截图，
--          每天至少 3 个，关键词包搬家、长途啊什么的」
--   经理  「业余工作应该就是和开发相关，包括通过各种形式联系 to B 企业合作」
--
-- 所以这不是一个字段，是两种工作：
--   客服的是【日配额 + 可核验】—— 3 条评论，有截图，Annie 能点开看
--   经理的是【长线推进】—— 联系了哪家企业、什么形式、到哪一步了，
--                           按天算数量没意义
--
-- ⚠️ 为什么客服那个要配额：老板原话「至少这样的话可以保证有效一些」。
--    「做了主动开发」无法衡量，「发了 3 条评论 + 截图」可以。

-- 客服：小红书评论引流
ALTER TABLE daily_work_log ADD COLUMN IF NOT EXISTS comment_count    integer;
ALTER TABLE daily_work_log ADD COLUMN IF NOT EXISTS comment_keywords text;
ALTER TABLE daily_work_log ADD COLUMN IF NOT EXISTS comment_shots    jsonb;

COMMENT ON COLUMN daily_work_log.comment_count    IS '今天在小红书留了几条评论。目标每天 ≥3（存配置，可改）';
COMMENT ON COLUMN daily_work_log.comment_keywords IS '搜的关键词，如「搬家、长途、留学生搬家」';
COMMENT ON COLUMN daily_work_log.comment_shots    IS '截图 [{name,url}]。Annie 能点开核验 —— 数字能编，截图不好编';

-- 经理：to B 企业开发
ALTER TABLE daily_work_log ADD COLUMN IF NOT EXISTS b2b_outreach text;
COMMENT ON COLUMN daily_work_log.b2b_outreach IS
  '企业开发进展：联系了哪家、什么形式、到哪一步。长线工作，不设日配额';

-- 配额存配置，不写死在代码 —— 老板以后要改成 5 条不该来找我改代码
INSERT INTO policy_text (key, content) VALUES
  ('comment_quota', '3'),
  ('comment_hint',  E'在小红书搜「搬家」「长途」「留学生搬家」这类关键词，\n找到正在问搬家的帖子，在下面留我们的评论。\n每天至少 3 条，截图留证。')
ON CONFLICT (key) DO NOTHING;
