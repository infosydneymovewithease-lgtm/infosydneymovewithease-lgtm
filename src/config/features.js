// 功能开关 —— 2026-10-12 建，2026-10-16 上线前分批
//
// 为什么要这个：这批升级里有会修改现有订单数据的功能（每日对账）。
// 出问题时需要一个比 revert + 重新部署更快的止血手段 ——
// 把下面的 true 改成 false，页面和菜单立刻消失，其他功能完全不受影响。
// 已经写进数据库的数据不会丢，reconcile_log 还在，撤销随时能做。
//
// ═══ 上线分批策略（2026-10-16）═══
// 一次开五个板块，出问题分不清是哪个。所以第一周只开两个：
//
//   第 1 周  worklog + roster
//            —— 客服每天必用（日报/打卡）+ 老板和经理要用（排班）
//            —— 这两个【不碰订单数据】，风险最低
//
//   第 2 周  content（内容排期）
//            —— 等 Annie 真的往格子里填了内容再开，否则客服打开是空的
//
//   第 3 周  reconcile（每日对账）
//            —— ⚠️ 唯一会改订单金额的功能，放最后，观察两周再开
//
//   第 4 周  summary（周月汇总）
//            —— 没有数据的汇总是空表，等前面攒够一个月再开

export const FEATURES = {
  worklog:   true,    // ✅ 第 1 周 · 客服工作台（/admin/worklog · /admin/team-today）
  roster:    true,    // ✅ 第 1 周 · 排班表（/admin/roster）
  content:   false,   // ⬜ 第 2 周 · 内容排期（/admin/content · /admin/content-today）
  reconcile: false,   // ⬜ 第 3 周 · 每日对账（/admin/reconcile）⚠️ 会改订单金额
  summary:   false,   // ⬜ 第 4 周 · 周月汇总（/admin/summary）
}
