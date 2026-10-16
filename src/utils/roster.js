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

/**
 * 月历需要的格子（含前面补空）。
 *
 * ⚠️ 这里的 (getUTCDay()+6)%7 是【渲染】需要 —— 月历第一列要是周一。
 *    它不是规则。全系统的星期【规则】一律用线上的 weekdayOf()（0=周日），
 *    见 utils/date.js:49 和 staff_schedule / roster_rule / content_rule。
 */
export function monthCells(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const lead = (first.getUTCDay() + 6) % 7   // 渲染偏移，非规则
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const out = []
  for (let i = 0; i < lead; i++) out.push(null)
  for (let d = 1; d <= days; d++) {
    out.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return out
}

// ── 需求信号 ──────────────────────────────────────────────
// 老板 10-16：把节日学期日历融进排班表。
//
// 为什么要融：排班表原来只显示【供给】（谁在岗），不显示【需求】（那天忙不忙）。
// 而排班的全部目的就是把人放在需求最大的时候 ——
// 没有需求信号，排班就是凭感觉分配。
//
// ⚠️ 搬家高峰不在开学当天，在【开学前 2 周】和【考完后 2 周】。

const DAY = 86400000
const iso = t => new Date(t).toISOString().slice(0, 10)
const ms  = d => Date.parse(d + 'T00:00:00Z')

/** 把 holiday 行展开成「需求窗口」 */
export function demandWindows(holidays) {
  const out = []
  for (const h of holidays || []) {
    if (h.country !== 'UNI') continue
    if (h.kind === 'exam') {
      out.push({ from: h.end_date, to: iso(ms(h.end_date) + 14 * DAY),
                 kind: 'out', label: `${h.org} 考完 → 搬出高峰`, src: h })
    } else if (h.kind === 'term_start') {
      out.push({ from: iso(ms(h.start_date) - 14 * DAY), to: h.start_date,
                 kind: 'in', label: `${h.org} 开学 → 搬入高峰`, src: h })
    }
  }
  return out
}

/** 某一天的标记：学期高峰 / 中国假 / 澳洲假 */
export function daySignals(holidays, windows, d) {
  const out = []
  for (const w of windows || []) {
    if (w.from <= d && d <= w.to) { out.push({ icon: '🎓', kind: w.kind, text: w.label }); break }
  }
  for (const h of holidays || []) {
    if (!(h.start_date <= d && d <= h.end_date)) continue
    if (h.country === 'CN') out.push({ icon: '🇨🇳', kind: 'cn', text: h.name })
    else if (h.country === 'AU') out.push({ icon: '🎄', kind: 'au', text: h.name })
  }
  return out
}

/**
 * 整月的一句话提示 —— 放在月历【上面】。
 * 放月历下面就晚了，排班的人已经排完了。
 */
export function monthAlert(holidays, ym) {
  const wins = demandWindows(holidays)
  const hit = wins.filter(w => w.to.startsWith(ym) || w.from.startsWith(ym)
                            || (w.from < ym && w.to > ym))
  if (!hit.length) return null
  const outs = hit.filter(w => w.kind === 'out').sort((a, b) => a.from.localeCompare(b.from))
  const ins  = hit.filter(w => w.kind === 'in').sort((a, b) => a.from.localeCompare(b.from))
  const parts = []
  if (outs.length) {
    const a = outs[0], b = outs[outs.length - 1]
    parts.push(`${a.from.slice(5)} 起进入搬出高峰（${a.src.org} 考完${
      outs.length > 1 ? ` → ${b.src.org} ${b.from.slice(5)}` : ''}），到 ${b.to.slice(5)}`)
  }
  if (ins.length) {
    const a = ins[0], b = ins[ins.length - 1]
    parts.push(`${a.from.slice(5)}–${b.to.slice(5)} 是开学搬入高峰（${
      [...new Set(ins.map(w => w.src.org))].join('·')}）`)
  }
  return parts.length ? parts.join('；') + ' —— 这期间别排补休' : null
}
