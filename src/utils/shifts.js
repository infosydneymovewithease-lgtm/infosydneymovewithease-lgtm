// 班次 / 时区换算 —— 2026-10-11 第 3 步
//
// 背景：客服在国内，公司在悉尼。
//   夏令时（澳洲 10 月第一个周日起）差 3 小时
//   冬令时（4 月第一个周日起）        差 2 小时
//
// ⚠️ 时差绝对不能写死。
//    9/29 那个「订单页日期翻不动 + 今天算成昨天」的 bug（commit 1465ba0）
//    就是写死时间算出来的。这里一律问时区库要真实偏移。

const BIZ_TZ   = 'Australia/Sydney'
const STAFF_TZ = 'Asia/Shanghai'

/**
 * 某个时区在某一刻相对 UTC 的偏移（分钟）。
 * 用 Intl.formatToParts 还原该时区的墙上时间，再和真实时刻相减 ——
 * 这是唯一不依赖「现在是几月」这种硬编码规则的算法。
 */
export function tzOffsetMinutes(tz, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]))
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  return Math.round((asUTC - date.getTime()) / 60000)
}

/** 悉尼比北京快几小时（夏 3 / 冬 2）。返回小数以防以后遇到半小时时区。 */
export function tzGapHours(date = new Date()) {
  return (tzOffsetMinutes(BIZ_TZ, date) - tzOffsetMinutes(STAFF_TZ, date)) / 60
}

/**
 * 当前该用哪套班次。
 * 判据是【悉尼此刻的真实 UTC 偏移】，不是月份 ——
 * 换季日期年年不同，查偏移永远对。
 */
export function currentSeason(date = new Date()) {
  return tzOffsetMinutes(BIZ_TZ, date) >= 660 ? 'summer' : 'winter'
}

/** 'HH:MM' → 当天第几分钟 */
export function toMinutes(hhmm) {
  if (!hhmm) return 0
  const [h, m] = String(hhmm).slice(0, 5).split(':').map(Number)
  return h * 60 + (m || 0)
}

/** 分钟数 → 'HH:MM'，跨天自动回绕 */
export function toHHMM(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** 悉尼墙上时间 → 北京墙上时间（shift_config 存悉尼，界面给国内客服看） */
export function sydneyToBeijing(hhmm, date = new Date()) {
  return toHHMM(toMinutes(hhmm) - tzGapHours(date) * 60)
}

/** 北京墙上时间 → 悉尼墙上时间（break_window 存北京，汇总给老板看时用） */
export function beijingToSydney(hhmm, date = new Date()) {
  return toHHMM(toMinutes(hhmm) + tzGapHours(date) * 60)
}

/** 某人某天上不上班。weekday 用 0=周日…6=周六，和 Postgres extract(dow) 一致 */
export function isWorkingOn(staffSchedules, staffId, dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const row = (staffSchedules || []).find(s => s.staff_id === staffId && s.weekday === dow)
  return row ? row.is_working : true   // 没配过的人默认上班，不要凭空把人排休
}

/** 某天在岗的人。用来判断「单人日」—— 单人日下午那段休息不开放 */
export function workingStaffOn(staffSchedules, dateStr) {
  const ids = [...new Set((staffSchedules || []).map(s => s.staff_id))]
  return ids.filter(id => isWorkingOn(staffSchedules, id, dateStr))
}

/** 某天实际可用的休息窗口（单人日自动砍掉 single_day=false 的那段） */
export function windowsFor(breakWindows, staffSchedules, dateStr, date = new Date()) {
  const season = currentSeason(date)
  const alone = workingStaffOn(staffSchedules, dateStr).length <= 1
  return (breakWindows || [])
    .filter(w => w.season === season)
    .filter(w => !alone || w.single_day)
    .sort((a, b) => a.slot_index - b.slot_index)
}

/** 每日必须登记的运营账号（planned 的灰显不必填，改成 active 就自动变必填） */
export function requiredAccounts(channelAccounts) {
  return (channelAccounts || []).filter(a => a.status === 'active')
}

export { BIZ_TZ, STAFF_TZ }
