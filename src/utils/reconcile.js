// 每日对账 —— 异常检测与影响计算（2026-10-12 第 4 步）
//
// 设计原则：【只报真正会出事的，不报狼来了】
//
// 停车费 / 高速费 / 油费 / 物资费为空【不提示】——
// 366 单里分别只用过 1 / 5 / 5 / 27 次，本来就是低频项。
// 我 10-10 犯过这个错：看到 9 月 65 单停车费全是 0，就说「钱可能在漏」。
// 老板纠正：只有客户要求停在不能停的位置才收。全历史查下来 366 单里用过 1 次。
// 把低频项当异常报，结果就是 Annie 每天看一屏红字，然后再也不看了。

import { hourlyRateFor } from './wageRates'

/** 这些字段为空不算异常 —— 低频，不是漏记 */
export const LOW_FREQUENCY_FEES = ['parkingFee', 'highwayFee', 'fuelFee', 'suppliesFee']

const SEV = { high: 2, mid: 1 }

/** 各车型的计费工时中位数。用中位数不用平均数 —— 平均数会被跑飞的单带偏。 */
export function vehicleMedians(orders) {
  const by = {}
  for (const o of orders || []) {
    if (o.status !== '已完成' || !o.billedHours || !o.vehicle) continue
    ;(by[o.vehicle] ||= []).push(Number(o.billedHours))
  }
  const out = {}
  for (const [v, arr] of Object.entries(by)) {
    arr.sort((a, b) => a - b)
    out[v] = arr[Math.floor(arr.length / 2)]
  }
  return out
}

/**
 * 一张单的异常清单。
 * @param opts.hoursFactor 工时超过车型中位数几倍算异常（默认 4）
 * @param opts.unpaidHours 完成多少小时还没收款算异常（默认 48）
 */
export function detectIssues(order, { medians = {}, staffRates = [], hoursFactor = 4, unpaidHours = 48 } = {}) {
  const out = []
  const add = (sev, code, text) => out.push({ sev, code, text })

  if (!order.workStartedAt) add('high', 'noStart', '缺实际开始时间')
  if (!order.workEndedAt)   add('high', 'noEnd',   '缺实际结束时间')

  const med = medians[order.vehicle]
  if (med && order.billedHours && Number(order.billedHours) > med * hoursFactor) {
    add('high', 'longHours',
      `计费 ${order.billedHours} 小时，远超${order.vehicle}常规（中位 ${med} 小时）`)
  }

  if (order.status === '已完成' && !order.paymentMethod) add('high', 'noPayMethod', '没标收款方式')

  if (order.status === '已完成' && order.paymentStatus !== 'paid' && order.completedAt) {
    const h = (Date.now() - new Date(order.completedAt).getTime()) / 3600000
    if (h > unpaidHours) add('mid', 'unpaid', `完成 ${Math.floor(h / 24)} 天还没收款`)
  }

  // 费率未录入 —— 不是报错，是提醒「这个人的工资现在按默认 $33 算」
  for (const id of participants(order)) {
    const r = hourlyRateFor(staffRates, id, order)
    if (r.source === 'default') add('mid', 'noRate', `${r.name} 的费率没录入，工资暂按 $${r.rate}/小时算`)
  }

  return out.sort((a, b) => SEV[b.sev] - SEV[a.sev])
}

export function participants(order) {
  return [...new Set([...(order?.assignedWorkers || []), ...(order?.assignedTo ? [order.assignedTo] : [])])]
}

/**
 * 补录会牵连到谁 —— 不只是收入变了，工资也跟着变。
 * 楼梯费和加班费由工人全额平分、公司不拿，所以这两项动一下工资就跟着动。
 */
export function impactOf(order, changes, staffRates) {
  const after = { ...order, ...changes }
  const wage = o => {
    const share = ((Number(o.stairFee) || 0) + (Number(o.overtimeFee) || 0))
    const ids = participants(o)
    if (!ids.length) return []
    return ids.map(id => {
      const r = hourlyRateFor(staffRates, id, o)
      return { id, name: r.name, amount: r.rate * (Number(o.billedHours) || 0) + share / ids.length }
    })
  }
  const a = wage(order), b = wage(after)
  return {
    amount: { from: Number(order.finalAmount) || 0, to: Number(after.finalAmount) || 0 },
    hours:  { from: Number(order.billedHours) || 0, to: Number(after.billedHours) || 0 },
    wages: b.map(x => {
      const prev = a.find(y => y.id === x.id)
      return { ...x, delta: x.amount - (prev?.amount || 0) }
    }).filter(x => Math.abs(x.delta) >= 0.01),
  }
}

/** 当日汇总。随补录实时变。 */
export function daySummary(orders, staffRates) {
  let due = 0, paid = 0, wages = 0
  for (const o of orders) {
    if (o.status !== '已完成') continue
    const amt = Number(o.finalAmount) || 0
    due += amt
    if (o.paymentStatus === 'paid') paid += amt
    const share = (Number(o.stairFee) || 0) + (Number(o.overtimeFee) || 0)
    const ids = participants(o)
    for (const id of ids) {
      const r = hourlyRateFor(staffRates, id, o)
      wages += r.rate * (Number(o.billedHours) || 0) + share / (ids.length || 1)
    }
  }
  return { due, paid, unpaid: due - paid, wages }
}

/** 对账页要显示的字段（左右对照用）。顺序就是界面顺序。 */
export const RECONCILE_FIELDS = [
  { key: 'workStartedAt', label: '实际开始', type: 'time'  },
  { key: 'workEndedAt',   label: '实际结束', type: 'time'  },
  { key: 'billedHours',   label: '计费工时', type: 'hours' },
  { key: 'timeFee',       label: '时间费',   type: 'money' },
  { key: 'returnFee',     label: '回程费',   type: 'money' },
  { key: 'stairFee',      label: '楼梯费',   type: 'money' },
  { key: 'overtimeFee',   label: '加班费',   type: 'money' },
  { key: 'heavyFee',      label: '重物费',   type: 'money' },
  { key: 'parkingFee',    label: '停车费',   type: 'money' },
  { key: 'highwayFee',    label: '高速费',   type: 'money' },
  { key: 'finalAmount',   label: '实收金额', type: 'money' },
]
