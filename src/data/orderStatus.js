// 订单状态机 — 全系统唯一真相源
// Why: audit 发现 164 处 hardcoded 中文状态字符串，散在 20+ 文件
// 这里集中定义 + 提供合法转换校验，防止"已完成"被改回"待确认"这种非法转换

// ── 搬家订单状态 ─────────────────────────────────────────────
export const ORDER_STATUSES = [
  '待确认',
  '已报价',
  '已收定金',
  '已派单',
  '师傅已确认',
  '进行中',
  '未提交账单',
  '师傅已提交账单',
  '已完成',
  '客户未付款',
  '已取消',
]

// 合法转换图：from -> [allowed next states]
// 终态（'已完成' / '已取消'）不能再变成其他状态
export const ORDER_TRANSITIONS = {
  '待确认':         ['已报价', '已收定金', '已派单', '已取消'],  // 客服可以直接派单跳过报价
  '已报价':         ['已收定金', '已派单', '已取消'],
  '已收定金':       ['已派单', '已取消'],
  '已派单':         ['师傅已确认', '已取消', '进行中'],  // 师傅可能跳过确认直接开工
  '师傅已确认':     ['进行中', '已完成', '已取消'],
  '进行中':         ['师傅已提交账单', '已完成', '客户未付款'],
  '未提交账单':     ['师傅已提交账单', '已完成', '客户未付款'],
  '师傅已提交账单': ['已完成', '客户未付款'],
  '已完成':         ['已取消'],  // 事后退款 / 清理测试单可取消；其他转换仍禁止
  '客户未付款':     ['已完成', '已取消'],  // 收款后可以回到已完成
  '已取消':         [],  // 终态
}

// ── 寄存订单状态 ─────────────────────────────────────────────
export const STORAGE_STATUSES = [
  '待确认',
  '已派单',
  '寄存中',     // 物品已入库，长期持续状态
  '已取出',
  '已完成',
  '已取消',
]

export const STORAGE_TRANSITIONS = {
  '待确认':   ['已派单', '已取消'],
  '已派单':   ['寄存中', '已取消'],
  '寄存中':   ['已取出', '已完成', '已取消'],
  '已取出':   ['已完成'],
  '已完成':   [],
  '已取消':   [],
}

// ── 校验函数 ─────────────────────────────────────────────────
/**
 * 老板可以把【已取消】恢复回来，其他人不行。
 *
 * 老板 2026-10-26：「我觉得我应该有恢复权限，其他人可以是终点」
 * 起因：QX2610033（Frank）被取消了，但谁取消的、为什么，系统里一个字都没记
 *       —— orders 表 89 个字段里【没有任何取消相关的列】。
 *       取消一旦落下就改不回来，而现实里「取消错了」「客人又搬了」都会发生。
 *
 * ⚠️ 为什么不干脆放开给所有人：
 *    终态的意义就是「到这儿就定了」。谁都能改回去，状态机就不是状态机了。
 *    给一个人开口子、并且留痕，比把门拆了强。
 *
 * ⚠️ 不能恢复到【进行中 / 未提交账单 / 师傅已提交账单】——
 *    那几个状态意味着活已经在干或干完了，凭空恢复过去会让工时和工资凭空出现。
 */
export const CANCEL_RESTORE_STATES = [
  '待确认', '已报价', '已收定金', '已派单', '师傅已确认', '已完成',
]

export function isLegalOrderTransition(from, to, opts = {}) {
  // 同状态视为合法（幂等更新）
  if (from === to) return true
  // 没有 from（新订单）也合法
  if (!from) return true
  // 老板恢复已取消 —— 唯一的例外
  if (from === '已取消' && opts.isAdmin && CANCEL_RESTORE_STATES.includes(to)) return true
  return (ORDER_TRANSITIONS[from] || []).includes(to)
}

export function isLegalStorageTransition(from, to) {
  if (from === to) return true
  if (!from) return true
  return (STORAGE_TRANSITIONS[from] || []).includes(to)
}

// ── 状态分类辅助（取代散在各页面的判断）─────────────────────
export const TERMINAL_STATUSES = ['已完成', '已取消']
export const ACTIVE_STATUSES = ['已派单', '师傅已确认', '进行中']
export const PENDING_STATUSES = ['待确认', '已报价', '已收定金']

export function isOrderActive(status) {
  return ACTIVE_STATUSES.includes(status)
}
export function isOrderTerminal(status) {
  return TERMINAL_STATUSES.includes(status)
}
export function isOrderPending(status) {
  return PENDING_STATUSES.includes(status)
}
