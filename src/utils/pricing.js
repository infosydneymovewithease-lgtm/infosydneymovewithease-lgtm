import { FEATURES } from '../config/features'

import { VEHICLES, STAIRS_FEE, VAN_PROMO_DISCOUNT } from '../data/vehicles'

// 由 timer 状态算实际工时（墙上时钟为准，免疫手机锁屏 JS 暂停）
// timerState 形状：{ status, startTime, endTime, accumulatedSec, runStartedAt }
//   - accumulatedSec: 已累积的秒数（暂停之前的所有时间）
//   - runStartedAt:   当前正在跑的这一段从什么时候开始（暂停时为 null）
export function computeElapsed(timerState) {
  if (!timerState) return 0
  // 兼容旧字段（已记 elapsed 的老 timerState）
  if (timerState.accumulatedSec == null && timerState.runStartedAt == null) {
    return Number(timerState.elapsed) || 0
  }
  const acc = Number(timerState.accumulatedSec) || 0
  if (timerState.runStartedAt) {
    const runningSec = (Date.now() - new Date(timerState.runStartedAt).getTime()) / 1000
    return acc + Math.max(0, runningSec)
  }
  return acc
}

// 超10分钟算半小时（满10分钟进位）
export function roundToHalfHour(totalSeconds) {
  const totalMinutes = totalSeconds / 60
  const blocks = Math.floor(totalMinutes / 30)
  const remainder = totalMinutes % 30
  return (blocks + (remainder >= 10 ? 1 : 0)) * 0.5
}

export function billedHours(totalSeconds, minHours) {
  return Math.max(roundToHalfHour(totalSeconds), minHours)
}

// ══════════════════════════════════════════════════════════════
// 计时跑飞防护（2026-10-11）
// ══════════════════════════════════════════════════════════════
// 根因：师傅忘记点「结束」→ timerState.runStartedAt 一直挂着，
// computeElapsed 按墙上时钟无限累加，workEndedAt 也一路往后跑。
//
// 一个 bug 同时撑大两个数 ——
//   ① 计费工时   elapsed 按天算（见过 68.5 小时的面包车单）
//   ② 加班费     8点前/20点后的时长按天累积
//
// 历史战果：10 单加班费虚高 $28,579.33，最严重一单 $20,514.59
// （反推 28.5 天加班）。楼梯/加班费由工人全额平分，所以营收和工资一起虚高。
//
// 对策不是「算得更准」—— 时间本来就是错的，算不准。
// 对策是【超过生理上限就不出数，交给人工】。
export const OVERTIME_HOURS_CAP  = 6    // 加班只发生在 8 点前 / 20 点后，一天最多 6 小时
export const WORK_HOURS_SUSPECT  = 14   // 连续工作超 14 小时 —— 基本可以断定没点结束

/**
 * 加班费明细。
 * @returns {{fee:number, hours:number, capped:boolean}}
 *   capped=true 表示超出上限，fee 强制为 0，等人工确认 —— 绝不自动写一个天文数字进账单。
 */
export function overtimeDetail(startTime, endTime, people) {
  if (!startTime || !endTime) return { fee: 0, hours: 0, capped: false }
  const start = new Date(startTime)
  const end = new Date(endTime)

  const am8 = new Date(start); am8.setHours(8, 0, 0, 0)
  const pm8 = new Date(start); pm8.setHours(20, 0, 0, 0)

  let overtimeMs = 0
  if (start < am8) {
    overtimeMs += Math.min(end, am8) - start
  }
  if (end > pm8) {
    overtimeMs += end - Math.max(start, pm8)
  }

  const overtimeHours = overtimeMs / 3600000

  // ⚠️ 封顶会改变金额，所以挂在开关上。
  //    关掉时算法和线上完全一致（不封顶），只是不再有防护。
  //    开关在 src/config/features.js —— overtimeCap
  if (FEATURES.overtimeCap && overtimeHours > OVERTIME_HOURS_CAP) {
    return { fee: 0, hours: overtimeHours, capped: true }
  }
  return {
    fee: Math.round(overtimeHours * 10 * people * 100) / 100,
    hours: overtimeHours,
    capped: false,
  }
}

// 加班费：8点前或20点后，$10/小时/人。超上限返回 0（见 overtimeDetail）
export function calcOvertimeFee(startTime, endTime, people) {
  return overtimeDetail(startTime, endTime, people).fee
}

export function calcTotal({
  vehicle,
  hourlyRate,      // 可选：合作客户协议时薪（快照）；留空用标准车型时薪
  workSeconds,
  returnFee,
  startTime,
  endTime,
  hasElevator,
  floors,
  heavyFee,        // 预算好的重物费总额
  highway,
  highwayAmount,   // 手动输入高速费，默认$30
  parkingViolation,
  fragile,
  supplies,
  fuel,
  discount,        // 0=无折扣, 9=九折, 9.5=九五折
  paymentMethod,   // 'cash' | 'transfer'
  deposit,
}) {
  const v = VEHICLES[vehicle]
  if (!v) return null

  // 合作价快照优先，否则用标准车型时薪
  const rate = (hourlyRate != null && hourlyRate !== '' && !Number.isNaN(Number(hourlyRate)))
    ? Number(hourlyRate) : v.hourlyRate

  const billed = billedHours(workSeconds, v.minHours)
  const timeFee = rate * billed

  const stairsFee = (!hasElevator && Number(floors) > 0)
    ? (STAIRS_FEE[v.people] || 0) * Number(floors)
    : 0

  const ot = overtimeDetail(startTime, endTime, v.people)
  const overtimeFee = ot.fee
  const highwayFee = highway ? (Number(highwayAmount) || 30) : 0
  const parkingFee = parkingViolation ? 300 : 0

  const miscFee = (Number(fragile) || 0)
    + (Number(supplies) || 0)
    + (Number(fuel) || 0)

  const vanDiscount = vehicle === '面包车' ? VAN_PROMO_DISCOUNT : 0

  const subtotal = timeFee
    + (Number(returnFee) || 0)
    + stairsFee
    + (Number(heavyFee) || 0)
    + overtimeFee
    + highwayFee
    + parkingFee
    + miscFee
    - vanDiscount

  const discountRate = discount === 9 ? 0.9 : discount === 9.5 ? 0.95 : 1
  const afterDiscount = subtotal * discountRate
  const discountAmount = subtotal - afterDiscount

  const gst = paymentMethod === 'transfer'
    ? Math.round(afterDiscount * 0.1 * 100) / 100
    : 0

  const total = afterDiscount + gst - (Number(deposit) || 0)

  return {
    billed,
    timeFee:       Math.round(timeFee * 100) / 100,
    returnFee:     Number(returnFee) || 0,
    stairsFee,
    heavyFee:      Number(heavyFee) || 0,
    overtimeFee,
    // 计时跑飞标记 —— 页面据此提示人工核对，不影响其他字段
    overtimeCapped:   ot.capped,
    overtimeRawHours: Math.round(ot.hours * 10) / 10,
    workHours:        Math.round(((Number(workSeconds) || 0) / 3600) * 10) / 10,
    timerSuspect:     FEATURES.overtimeCap &&
                      (ot.capped || ((Number(workSeconds) || 0) / 3600) > WORK_HOURS_SUSPECT),
    highwayFee,
    parkingFee,
    miscFee:       Math.round(miscFee * 100) / 100,
    vanDiscount,
    subtotal:      Math.round(subtotal * 100) / 100,
    discountAmount:Math.round(discountAmount * 100) / 100,
    afterDiscount: Math.round(afterDiscount * 100) / 100,
    gst,
    deposit:       Number(deposit) || 0,
    total:         Math.round(total * 100) / 100,
  }
}

export function formatDuration(seconds) {
  // 永远取整 — elapsed 现在是浮点（墙上时钟差），不取整会显示成 14.345999...
  const totalSec = Math.max(0, Math.floor(Number(seconds) || 0))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
