// 日期工具 — 统一按悉尼时区算「今天」，并提供不踩夏令时的日期加减。
//
// 背景（2026-09-29 排查出来的两个真实 bug）：
//
// ① 「今天」算成昨天 —— 每天都在发生
//    旧写法 new Date().toISOString().slice(0, 10) 取的是 UTC 日期。
//    悉尼是 UTC+10（夏令时 UTC+11），所以每天早上 10 点（夏令时 11 点）之前，
//    它返回的是前一天。后台早上打开默认显示昨天的订单、早上收的款记成前一天。
//    国内客服的浏览器又是 UTC+8，算出来跟悉尼可能是不同的一天。
//    → 写死 Australia/Sydney，不管人在哪开后台，「今天」都是悉尼的今天。
//
// ② 日期加减在夏令时那天卡住 —— 一年一次
//    旧写法 d.setDate(d.getDate() + 1) 用本地时区读写，再用 toISOString() 转回 UTC。
//    澳洲 10 月第一个周日入夏令时（2026 年是 10/4），UTC+10 跳到 UTC+11，
//    来回转换正好丢掉一小时，日期被抹回原地：
//      2026-10-03 --点「后一天」--> 2026-10-03（永远过不去）
//    这就是订单列表 10/3 之后的单看不到的原因。
//    → 加减全程在 UTC 里算，完全不碰时区。

const TZ = 'Australia/Sydney'

/**
 * 悉尼「今天」的 YYYY-MM-DD。
 * 不受浏览器所在时区影响，也不受夏令时影响。
 */
export function sydneyToday() {
  // en-CA 的日期格式就是 YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

/**
 * 日期字符串加减天数，纯日历运算，不经过时区转换。
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {number} days 可正可负
 * @returns {string} 'YYYY-MM-DD'
 */
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/**
 * 取日期字符串的星期几（0=周日）。
 * 用 UTC getter，因为 'YYYY-MM-DD' 被解析成 UTC 零点，
 * 用本地 getDay() 在 UTC 以西的时区会偏一天。
 */
export function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}
