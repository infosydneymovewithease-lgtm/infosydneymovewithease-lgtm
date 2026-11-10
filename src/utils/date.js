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

/**
 * 一个 ISO 时间戳落在悉尼的哪一天。
 *
 * ⚠️ 为什么需要这个：orders 有两个日期概念，很容易混
 *      date       服务日期（哪天搬家）—— 本来就是 'YYYY-MM-DD' 字符串
 *      createdAt  建单时刻 —— timestamptz，要换算成悉尼日期才能比
 *    实测 368 单：88% 不是当天搬的，中位间隔 2 天。
 *    拿 date 当「今天建了几单」用，会漏掉绝大多数。
 */
export function sydneyDateOf(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-CA', { timeZone: TZ })
}

/**
 * 时间戳显示成「时:分」。
 *
 * ⚠️ 必须指定时区。2026-11-02 小洁报「今天 2 号早上打的卡，显示还是 1 号」——
 *    她看到的是 22:56，而她是悉尼上午 09:56 打的。
 *    原来各页面自己写的版本是：
 *      new Date(iso).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' })
 *    没传 timeZone ＝ 跟【看的人的设备时区】走。她那台设备报 UTC，
 *    悉尼 09:56 = UTC 前一天 22:56 —— 时间错 3 小时，日期还退了一天。
 *
 *    存的数据一直是对的（完整 ISO + 悉尼 work_date），错的只有显示。
 *    但同一条打卡，老板在悉尼看是 09:56、她看是 22:56 —— 这种各看各的
 *    比直接报错更难发现，因为两边都觉得自己看到的是对的。
 *
 * 默认悉尼：活是在悉尼干的，工资、对账、工时全按悉尼算，这是业务事实，
 * 不该因为看的人在哪而改变。
 */
export function hhmmIn(iso, tz = TZ, empty = '—') {
  if (!iso) return empty
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return empty
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
  })
}

/** 北京时间的「时:分」。客服在国内，排班和休息时段都是按北京说的。 */
export function hhmmBeijing(iso, empty = '—') {
  return hhmmIn(iso, 'Asia/Shanghai', empty)
}

/** 某一刻悉尼比 UTC 快多少分钟（夏令时会变，所以要按那一刻算） */
function sydneyOffsetMinutes(ms) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value]))
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return (asUTC - ms) / 60000
}

/**
 * 把「悉尼的某天某点几分」变成真正的时间戳。
 *
 * ⚠️ 不能直接 new Date('2026-11-05T22:30')——那样是按【浏览器所在时区】解析的。
 *    客服在国内，她填 22:30 会被当成北京 22:30，存进去就差 3 小时。
 *    补填下班时间要的是「悉尼墙上的那个时刻」。
 *
 * @param dateStr 'YYYY-MM-DD'（悉尼日期）
 * @param hhmm    'HH:MM'（悉尼时间）
 */
export function sydneyToISO(dateStr, hhmm) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  const [hh, mi] = String(hhmm).split(':').map(Number)
  if (![y, m, d, hh, mi].every(Number.isFinite)) return null
  const naive = Date.UTC(y, m - 1, d, hh, mi)
  // 算两遍：第一遍用「假装是 UTC」的时刻求偏移，第二遍用修正后的时刻再求一次，
  // 这样跨夏令时切换那一天也不会差一小时
  let ms = naive - sydneyOffsetMinutes(naive) * 60000
  ms = naive - sydneyOffsetMinutes(ms) * 60000
  return new Date(ms).toISOString()
}
