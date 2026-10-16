// 排班 —— 纯逻辑，2026-10-16
//
// 老板 10-16：「我和经理可以对这个表格休息人员进行调整」
//
// 和内容排期同一个模式：按规则自动生成 + 允许手动覆盖。
// 手工排 11 周 × 2 人 = 154 格，那个工作量本身就会让人放弃；
// 但全自动又改不了现实（临时有事、她们自己换班）。

export const SHIFT = {
  A:       { label: 'A 早班', short: 'A', onDuty: true,  cls: 'text-red-700' },
  B:       { label: 'B 晚班', short: 'B', onDuty: true,  cls: 'text-purple-700' },
  off:     { label: '例休',   short: '休', onDuty: false, cls: 'text-gray-300' },
  leave:   { label: '补休',   short: '补休', onDuty: false, cls: 'text-green-600' },
  holiday: { label: '假期',   short: '假', onDuty: false, cls: 'text-amber-600' },
}

export const SHIFT_KEYS = ['A', 'B', 'off', 'leave', 'holiday']

/** 把排班行整理成 { '2026-11-03': { xiaoxi: {...}, annie: {...} } } */
export function byDate(rows) {
  const m = new Map()
  for (const r of rows || []) {
    if (!m.has(r.work_date)) m.set(r.work_date, {})
    m.get(r.work_date)[r.staff_id] = r
  }
  return m
}

/** 某天在岗几个人 */
export function onDutyCount(dayMap) {
  return Object.values(dayMap || {}).filter(r => SHIFT[r.shift]?.onDuty).length
}

/**
 * 改之前先算后果 —— 这是整个页面最该有的东西。
 * 排班是直接影响两个人生活、也直接影响客人能不能找到人的东西，
 * 改之前必须知道会变成什么样，而不是改完才发现那天没人了。
 */
export function previewChange(dayMap, staffId, nextShift) {
  const after = { ...(dayMap || {}) }
  after[staffId] = { ...(after[staffId] || {}), shift: nextShift }
  const before = onDutyCount(dayMap)
  const now = onDutyCount(after)

  let warn = null
  if (now === 0) warn = '改完这天【没有人在岗】'
  else if (before === 2 && now === 1) warn = '改完这天只剩 1 人，晚上 20:00 后没人'

  // 两人同时 A 或同时 B：覆盖没变宽，等于浪费一个人
  const shifts = Object.values(after).filter(r => SHIFT[r.shift]?.onDuty).map(r => r.shift)
  if (shifts.length === 2 && shifts[0] === shifts[1]) {
    warn = `两人都排了 ${shifts[0]} 班 —— 覆盖没有变宽，等于浪费一个人`
  }
  return { before, after: now, warn }
}

/** 一段时间的统计，给页面顶部那排数字 */
export function rosterStats(rows, staffIds) {
  const days = byDate(rows)
  let zero = 0, single = 0, double = 0
  for (const [, m] of days) {
    const n = onDutyCount(m)
    if (n === 0) zero++; else if (n === 1) single++; else double++
  }
  const per = {}
  for (const id of staffIds || []) {
    per[id] = { A: 0, B: 0, off: 0, leave: 0, holiday: 0 }
    for (const r of rows || []) if (r.staff_id === id && per[id][r.shift] != null) per[id][r.shift]++
  }
  return { zero, single, double, per, edited: (rows || []).filter(r => r.auto === false).length }
}

/** 月历需要的格子（含前面补空） */
export function monthCells(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const lead = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const out = []
  for (let i = 0; i < lead; i++) out.push(null)
  for (let d = 1; d <= days; d++) {
    out.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return out
}
