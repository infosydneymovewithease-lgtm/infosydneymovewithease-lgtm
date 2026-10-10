// 「上一单没结束」的识别与补填 —— 2026-10-11 第 2.5 步下半部分
//
// 老板原话：「不可以开始下一单，需要上一单结束，师傅点上一单结束的时候
//            让他们填写原因和实际工作时间」
//
// 为什么要两个触发点而不是一个：
//   数据说话 —— 那 10 单跑飞的里，只有 3 单是「挂着的时候又开了新单」，
//   晨曦那几单挂了 1-3 天但期间没开新单，闸门根本没机会触发。
//   所以【补填表单】不能只挂在闸门上，任何一次「迟到的结束」都要弹。
//
//   闸门   = 逼他现在就处理，别拖
//   补填   = 真正把数据修对
//
// 为什么时间写在订单上而不是人身上：
//   QX2608021 是老王+老周+小宇三个人的单。三个人各填一个「实际时间」会打架。
//   谁先补填谁说了算，另外两人看到「老王已补填」直接过。

import { WORK_HOURS_SUSPECT } from './pricing'

/** 补填原因。固定选项，半年后能看出到底是人的问题还是 App 的问题 —— */
/** 如果「没信号」占一半，那要修的是离线缓存，不是提醒。 */
export const END_FIX_REASONS = [
  { key: 'forgot',  label: '忘记点结束' },
  { key: 'battery', label: '手机没电/关机' },
  { key: 'signal',  label: '当时没信号' },
  { key: 'other',   label: '其他' },
]

export function reasonLabel(key) {
  return END_FIX_REASONS.find(r => r.key === key)?.label || key || ''
}

/**
 * 我名下还挂着没结束的单。
 * 已完成/已取消的不算 —— 客服后台手动完单时 work* 字段可能还停在 running，
 * WorkPage 已经按「已完成就当 stopped」显示，这里要保持一致，否则会拿僵尸单挡人。
 */
export function findStaleWork(orders, userId, excludeOrderId) {
  return (orders || [])
    .filter(o => {
      if (!o || o.id === excludeOrderId) return false
      if (o.status === '已完成' || o.status === '已取消') return false
      if (o.workEndedAt) return false
      if (o.workStatus !== 'running' && o.workStatus !== 'paused') return false
      if (!o.workStartedAt) return false
      return o.assignedTo === userId ||
        (Array.isArray(o.assignedWorkers) && o.assignedWorkers.includes(userId))
    })
    .sort((a, b) => String(a.workStartedAt).localeCompare(String(b.workStartedAt)))
}

/** 从开工到现在挂了多少小时 */
export function hoursSinceStart(order, now = Date.now()) {
  if (!order?.workStartedAt) return 0
  return (now - new Date(order.workStartedAt).getTime()) / 3600000
}

/** 这次「结束」算不算迟到 —— 迟到就要走补填，不能静默写一个错的收工时间 */
export function isLateStop(elapsedSec) {
  return (Number(elapsedSec) || 0) / 3600 > WORK_HOURS_SUSPECT
}

/**
 * 补填的默认收工时间：开工 + 车型最低工时。
 * 不默认「现在」—— 默认现在就等于什么都没修。
 */
export function defaultFixEnd(order, minHours) {
  const start = new Date(order.workStartedAt)
  return new Date(start.getTime() + (minHours || 1) * 3600000)
}

/** datetime-local 输入框要的格式（本地时区，师傅在悉尼） */
export function toLocalInput(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 校验补填的时间：必须晚于开工，且不能是未来 */
export function validateFixEnd(order, endLocalStr) {
  if (!endLocalStr) return '请选择实际收工时间'
  const end = new Date(endLocalStr)
  if (Number.isNaN(end.getTime())) return '时间格式不对'
  const start = new Date(order.workStartedAt)
  if (end <= start) return '收工时间要晚于开工时间'
  if (end.getTime() > Date.now() + 60000) return '收工时间不能填未来'
  return null
}
