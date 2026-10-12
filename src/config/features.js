// 功能开关 —— 2026-10-12
//
// 为什么要这个：第 4 步「每日对账」是整个升级里唯一会修改现有订单数据的功能。
// 出问题时需要一个比 revert + 重新部署更快的止血手段 ——
// 把下面的 true 改成 false，页面和菜单立刻消失，其他功能完全不受影响。
// 已经写进数据库的补录不会丢，reconcile_log 还在，撤销随时能做。

export const FEATURES = {
  reconcile: true,   // 每日对账（/admin/reconcile）
  worklog:   true,   // 客服工作台（/admin/worklog · /admin/team-today）
  summary:   true,   // 周月汇总（/admin/summary）
}
