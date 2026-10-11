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
import { billedHours as calcBilled, overtimeDetail } from './pricing'
import { VEHICLES } from '../data/vehicles'

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

/** 当日汇总。随补录实时变。
 *  工资按人拆开 —— 佳慧要拿这个和每个师傅核工资，只给总数等于没给。 */
export function daySummary(orders, staffRates) {
  let due = 0, paid = 0, cash = 0, transfer = 0
  const byStaff = new Map()
  for (const o of orders) {
    if (o.status !== '已完成') continue
    const amt = Number(o.finalAmount) || 0
    due += amt
    if (o.paymentStatus === 'paid') {
      paid += amt
      if (o.paymentMethod === 'cash') cash += amt
      else if (o.paymentMethod === 'transfer') transfer += amt
    }
    const share = (Number(o.stairFee) || 0) + (Number(o.overtimeFee) || 0)
    const ids = participants(o)
    for (const id of ids) {
      const r = hourlyRateFor(staffRates, id, o)
      const w = r.rate * (Number(o.billedHours) || 0) + share / (ids.length || 1)
      const cur = byStaff.get(id) || { id, name: r.name, amount: 0, orders: 0 }
      byStaff.set(id, { ...cur, amount: cur.amount + w, orders: cur.orders + 1 })
    }
  }
  const wageList = [...byStaff.values()].sort((a, b) => b.amount - a.amount)
  return {
    due, paid, unpaid: due - paid, cash, transfer,
    wages: wageList.reduce((a, w) => a + w.amount, 0),
    wageList,
  }
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


// ════════════════════════════════════════════════════════════
// 自动核算 —— 老板 10-11：
//   「为什么上面都选择到 5.5 小时了就不能自动核算呢，
//     只有附加费用，否则一个一个改太（麻烦）」
// ════════════════════════════════════════════════════════════
// 派生值（自动算，但允许人工覆盖）：
//   实际开始/结束 → 计费工时、加班费
//   计费工时      → 时间费
//   任何费用      → 实收金额
//
// 人工填（现场发生的，系统不可能知道）：
//   楼梯费 · 停车费 · 高速费 · 重物费 · 物资费 · 油费 · 回程费

/** 参与「实收金额」加总的费用项。
 *  ⚠️ 不含 remoteSurcharge 和 materialsCost ——
 *  实测 200 张已完成订单，这两项【从来没被算进 finalAmount】。
 *  把它们加进来会让每一单都凭空多出几十到几百块。 */
export const SUMMED_FEES = [
  'timeFee', 'returnFee', 'stairFee', 'overtimeFee',
  'heavyFee', 'highwayFee', 'parkingFee', 'suppliesFee', 'fuelFee',
]

const num = v => (v === '' || v === null || v === undefined) ? 0 : (Number(v) || 0)
const pick = (order, draft, k) => draft[k] !== undefined && draft[k] !== '' ? draft[k] : order[k]

/**
 * 用户改了 field 之后，哪些派生值要跟着变。
 * @returns 要并进 draft 的字段（不覆盖用户已经手动填过的）
 */
export function deriveDraft(order, draft, field) {
  const v = VEHICLES[order.vehicle]
  if (!v) return {}
  const out = {}
  const touched = k => draft[k] !== undefined && draft[k] !== ''

  // ① 改了时间 → 重算工时和加班费
  if (field === 'workStartedAt' || field === 'workEndedAt') {
    const s = pick(order, draft, 'workStartedAt')
    const e = pick(order, draft, 'workEndedAt')
    if (s && e) {
      const sec = (new Date(e) - new Date(s)) / 1000
      if (sec > 0) {
        out.billedHours = String(calcBilled(sec, v.minHours))
        // 加班费带 6 小时封顶 —— 超了返回 0 并标记，不会再算出天文数字
        out.overtimeFee = String(overtimeDetail(s, e, v.people).fee)
      }
    }
  }

  // ② 工时变了（不管是自动算的还是人工填的）→ 重算时间费
  const hours = num(out.billedHours ?? pick(order, draft, 'billedHours'))
  if ((field === 'billedHours' || out.billedHours !== undefined) && hours > 0) {
    const rate = order.hourlyRate != null && order.hourlyRate !== ''
      ? Number(order.hourlyRate) : v.hourlyRate
    if (!touched('timeFee') || out.billedHours !== undefined) {
      out.timeFee = (Math.round(rate * hours * 100) / 100).toFixed(2)
    }
  }

  // ③ 任何费用变了 → 按【差额】推实收金额
  //    不重新推导总额 —— 实测历史单里定金扣不扣、远途费算不算都不一致，
  //    重算会把这些差异抹平。按差额走，原单怎么处理的就还是怎么处理。
  const merged = { ...draft, ...out }
  const oldSum = SUMMED_FEES.reduce((a, k) => a + num(order[k]), 0)
  const newSum = SUMMED_FEES.reduce((a, k) => a + num(pick(order, merged, k)), 0)
  const delta = newSum - oldSum
  if (Math.abs(delta) >= 0.005 && !touched('finalAmount')) {
    // 转账单带 10% GST，现金单不带 —— 看原单有没有 gst 来判断
    const gstRate = num(order.gst) > 0 ? 1.1 : 1
    out.finalAmount = (Math.round((num(order.finalAmount) + delta * gstRate) * 100) / 100).toFixed(2)
  }
  return out
}

/** 这个字段是自动算出来的吗（界面上标一下，让 Annie 知道哪些是系统填的） */
export const DERIVED_FIELDS = ['billedHours', 'timeFee', 'overtimeFee', 'finalAmount']
