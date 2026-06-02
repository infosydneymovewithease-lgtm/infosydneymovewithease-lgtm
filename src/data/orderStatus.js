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
export function isLegalOrderTransition(from, to) {
  // 同状态视为合法（幂等更新）
  if (from === to) return true
  // 没有 from（新订单）也合法
  if (!from) return true
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
