// 寄存结算 —— 唯一口径
//
// 2026-11-17。规则是老板和我当天下午聊定的，
// 完整版见桌面「迁喜系统升级-设计方案-v2-20261010/寄存计费规则-20261117.md」。
//
// 在这之前系统只算「入库日 → 出库日」这一段：
//   逾期一分钱不涨，提前取也不退。规则只写在注释里，代码不认识。
//
// ⚠️ 核心约定：【周】只是报价时对客户的说法，系统里一律按天记。
//    日价 = 周价 ÷ 7。这样提前取、超时取、逾期，一条公式走完，没有例外。

import { STORAGE_RATES, getStorageRates } from '../data/storageRates'

const DAY = 86400000
const d2 = n => Math.round(n * 100) / 100
const toDate = s => (s instanceof Date ? s : new Date(String(s) + 'T00:00:00'))
const days = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY)
// ⚠️ 不能用 toISOString() —— 它转 UTC，悉尼 +10/+11 小时会把日期退回前一天。
//    本地测试时「逾期 30 天」算出来只有 29 天的钱，就是这个。
//    这和之前计时、日报踩的时区坑是同一个形态。
const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (s, n) => {
  const t = toDate(s); t.setDate(t.getDate() + n)
  return fmt(t)
}

/** 宽限期：逾期头 30 天按原档价，不涨 */
export const GRACE_DAYS = 30

/** 某个档位下，这一单每天多少钱 */
function dailyRate(order, shortTerm) {
  const r = shortTerm ? STORAGE_RATES.short : STORAGE_RATES.long
  const weekly = (Number(order.boxes) || 0) * r.boxRate
              + (Number(order.furniture) || 0) * r.furRate
  return weekly / 7
}

/**
 * 结算一张寄存单。
 *
 * @param order        storage_orders 一行
 * @param settleDate   结算日 'YYYY-MM-DD'。⚠️ 可以改 ——
 *                     客户说周末付，就填周末那天，金额和新到期日跟着变
 * @param renewWeeks   这次要续几周（0 = 不续，只结算）
 *
 * @returns 明细。只算、只显示，【不写回数据库】——
 *          实际收多少还是老板谈，系统给的是「按规矩该是多少」。
 */
export function settleStorage(order, settleDate, renewWeeks = 0) {
  const inDate  = order?.moveInDate
  const dueDate = order?.moveOutDate
  if (!inDate || !dueDate) return null

  // 东西什么时候离开仓库：已取件就用实际日期，还在库里就算到结算日
  const endDate = order.actualMoveOutDate || settleDate

  // 续费后的最终到期日 —— 结算日既是欠款段的终点，也是续费段的起点
  const newDueDate = renewWeeks > 0 ? addDays(settleDate, renewWeeks * 7) : null

  // ⚠️ 档位按【最终】总时长定，两头都重算：
  //    订 4 周续到 7 周 → 整单长期价；订 6 周第 4 周取走 → 整单掉回短期价
  const finalEnd  = newDueDate || endDate
  const totalDays = Math.max(1, days(inDate, finalEnd))
  const { shortTerm } = getStorageRates(Math.max(1, Math.ceil(totalDays / 7)))
  const rate      = dailyRate(order, shortTerm)
  const shortRate = dailyRate(order, true)   // 逾期第 2 个月起用这个

  // ── 分段 ────────────────────────────────────────────
  // 段A：入库 → min(结算/取件, 到期+30天)   按档位日价（含宽限期，价格一样所以合并）
  // 段B：到期+30天 → 结算/取件              按短期档日价（逾期罚价，一直滚）
  const graceEnd = addDays(dueDate, GRACE_DAYS)
  const aEnd = days(endDate, graceEnd) > 0 ? endDate : graceEnd
  const segA = Math.max(0, days(inDate, aEnd))
  const segB = Math.max(0, days(graceEnd, endDate))

  const 正常与宽限 = d2(segA * rate)
  const 逾期加价   = d2(segB * shortRate)

  // 续费段
  const renewDays = newDueDate ? days(settleDate, newDueDate) : 0
  const 续费 = d2(renewDays * rate)

  // ⚠️ 2026-11-17 晚，老板定：【跨档不补物资差价】。
  //    「物资费用就不要补了，怎样算成本够的」
  //    客户订 6 周拿了免费纸箱、第 4 周就取走 —— 钱按短期重算，
  //    但物资不往回追。几十块的事，换客户少一次争执。
  //
  //    这一条省掉的不只是一段代码：本来要补的三个窟窿
  //    （后台建单加物资栏、加床垫套字段、师傅交单确认实际发放数量）
  //    现在都不再是阻塞项。胶带 $3 / 床垫套 $10 照常按使用收，
  //    那是单独卖的东西，和档位无关。

  // ── 已付：原报价（预订周数 × 当时档位周价）─────────
  const 预订天数 = Math.max(1, days(inDate, dueDate))
  const 预订周数 = Math.max(1, Math.ceil(预订天数 / 7))
  const r0 = getStorageRates(预订周数)
  const 已付 = d2(预订周数 * ((Number(order.boxes) || 0) * r0.boxRate
                           + (Number(order.furniture) || 0) * r0.furRate))

  // 掉档：订的是长期、实际只住到短期 —— 整单按短期价重算（页面要提示）
  const 原档 = getStorageRates(Math.max(1, Math.ceil(days(inDate, dueDate) / 7)))
  const 掉档 = !原档.shortTerm && shortTerm

  const 应收 = d2(正常与宽限 + 逾期加价 + 续费)
  const 差额 = d2(应收 - 已付)   // 正数 = 客户补，负数 = 退给客户

  return {
    档位: shortTerm ? '短期' : '长期',
    掉档,
    日价: d2(rate), 短期日价: d2(shortRate),
    逾期天数: Math.max(0, days(dueDate, endDate)),
    段: [
      segA > 0 && { 标签: segB > 0 ? '正常 + 宽限期' : '寄存', 从: inDate, 到: aEnd, 天: segA, 日价: d2(rate), 金额: 正常与宽限 },
      segB > 0 && { 标签: '逾期加价', 从: graceEnd, 到: endDate, 天: segB, 日价: d2(shortRate), 金额: 逾期加价 },
      renewDays > 0 && { 标签: `续 ${renewWeeks} 周`, 从: settleDate, 到: newDueDate, 天: renewDays, 日价: d2(rate), 金额: 续费 },
    ].filter(Boolean),
    已付, 应收, 差额,
    要补: 差额 > 0 ? 差额 : 0,
    要退: 差额 < 0 ? d2(-差额) : 0,
    新到期日: newDueDate,
    // 催客户用：晚一天多多少钱
    每天多收: d2(segB > 0 || days(dueDate, endDate) >= GRACE_DAYS ? shortRate : rate),
  }
}
