-- 2026-10-13 · 主动开发改成必填 + 可量化
--
-- 老板 10-13：「这个事情相当于告诉了我们客服有这么个事，
--              但是没有要求也没有细节，真不知道好不好，
--              还怀疑会变成没用的东西」
--
-- 他说对了。一个没要求、没标准、没人看的自由文本框，两周后只会有两种结局：
-- 全是空的，或者填「正常工作」。而且它会拖累整张表 ——
-- 客服看到一个永远不用认真填的框，会觉得整个日报都是走形式。
--
-- 老板的决定：要求每天做，而且要能量化。所以拆成三部分：
--   做了什么动作   选项 + 补充说明
--   带来几个好友   数字，接进现有漏斗
--
-- 接进漏斗之后能回答一个真问题：
--   微信新增的人里，多少是平台引流来的、多少是主动找来的？
--   两条路哪条更划算，值不值得多投入？

ALTER TABLE daily_work_log ADD COLUMN IF NOT EXISTS outreach_actions text[];
ALTER TABLE daily_work_log ADD COLUMN IF NOT EXISTS outreach_adds    integer;

COMMENT ON COLUMN daily_work_log.outreach_actions IS '今天做了哪些主动开发动作（发租房群/回访老客/发名片/其他）';
COMMENT ON COLUMN daily_work_log.outreach_adds IS
  '主动开发带来的微信好友数。是 wechat_adds 的一部分，不是另加 ——
   wechat_adds 是今天加的全部好友，这个是其中主动找来的。';
