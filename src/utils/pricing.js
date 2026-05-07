import { VEHICLES, STAIRS_FEE, VAN_PROMO_DISCOUNT } from '../data/vehicles'

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

// 加班费：8点前或20点后，$10/小时/人
export function calcOvertimeFee(startTime, endTime, people) {
  if (!startTime || !endTime) return 0
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
  return Math.round(overtimeHours * 10 * people * 100) / 100
}

export function calcTotal({
  vehicle,
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

  const billed = billedHours(workSeconds, v.minHours)
  const timeFee = v.hourlyRate * billed

  const stairsFee = (!hasElevator && Number(floors) > 0)
    ? (STAIRS_FEE[v.people] || 0) * Number(floors)
    : 0

  const overtimeFee = calcOvertimeFee(startTime, endTime, v.people)
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
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
