// 订单"约定时间"显示 & 校验 —— 师傅/客服看的是"该几点到场开工"
// 优先级：客服设定的实际约定时间 > 系统时段标签
// 注意：这跟 workStartedAt（师傅实际按开始计时那一刻）无关，那个是算工时用的。

// 返回 { text, precise }：precise=true 表示是客服精确约定的时间（应高亮），
// false 表示只是系统时段标签（如 08:00–10:00）。
export function scheduledTimeLabel(order) {
  const s = order?.actualStartTime
  if (s) {
    const e = order?.actualEndTime
    return { text: e ? `${s}–${e}` : s, precise: true }
  }
  return { text: order?.startTime || '', precise: false }
}

// 软提醒用：实际约定时间是否落在所选时段之外（时段标签如 "08:00–10:00"，用 – 分隔）
export function isTimeOutsideSlot(actualStart, slotLabel) {
  if (!actualStart || !slotLabel) return false
  const parts = String(slotLabel).split('–')
  if (parts.length < 2) return false
  const toMin = t => {
    const [h, m] = String(t).trim().split(':').map(Number)
    return Number.isFinite(h) ? h * 60 + (m || 0) : NaN
  }
  const s = toMin(actualStart), lo = toMin(parts[0]), hi = toMin(parts[1])
  if ([s, lo, hi].some(n => !Number.isFinite(n))) return false
  return s < lo || s > hi
}
