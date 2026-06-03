// 订单字段判断 util — 统一散落在各页面的业务判断
// Why: audit 发现"定金是否已收"在多处有 4 种不同写法
//      (depositPaid / depositStatus / paymentStatus / depositScreenshot)
//      容易出现客服端显示"已收"但师傅端显示"未收"的不一致

// ── 定金 ─────────────────────────────────────────────────────

/**
 * 订单的定金是否已收 — 唯一判断函数
 *
 * 优先级：
 *   1. depositPaid === true/false 是显式标记，最权威
 *   2. depositStatus === '已上传截图' 或 paymentStatus === '定金'/'已付' 视为已收（历史订单兼容）
 *   3. depositScreenshot 有内容也视为已收（客户上传过定金截图）
 */
export function isDepositPaid(order) {
  if (!order) return false
  if (order.depositPaid === true) return true
  if (order.depositPaid === false) return false  // 显式 false 信任
  // 历史兼容：老订单可能用 depositStatus / paymentStatus / depositScreenshot
  return (
    order.depositStatus === '已上传截图'
    || order.depositStatus === '已付定金'
    || order.paymentStatus === '定金'
    || order.paymentStatus === '已付'
    || !!order.depositScreenshot
  )
}

/**
 * 订单的已收定金金额 — 返回数字（0 表示无）
 * 兼容字符串和数字两种存法
 */
export function getDepositAmount(order) {
  return Number(order?.deposit) || 0
}

/**
 * 定金显示文案 — 给 UI 用
 * 返回："$30 已收" / "$0 未收" / "$30 待付"
 */
export function getDepositLabel(order) {
  const amount = getDepositAmount(order)
  const paid = isDepositPaid(order)
  if (paid) return `$${amount || 30} 已收`
  if (amount > 0) return `$${amount} 待付`
  return '未收'
}
