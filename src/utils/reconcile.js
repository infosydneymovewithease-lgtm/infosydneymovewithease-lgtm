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
import { VEHICLES, STAIRS_FEE, VAN_PROMO_DISCOUNT } from '../data/vehicles'
import { RETURN_PAY_FROM } from '../config/features'
import { getStorageRates } from '../data/storageRates'

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

  // ── 时间费按错车型算了（2026-11-02）────────────────────────
  //
  // QX2610062：2 人大卡车现场改成小卡三人，时间费 $720 = 6 × $120 原封不动留着 ——
  // $120 是【大卡车(2人)】的价，小卡三人是 $160。老板原话：
  //   「现在不合理就是人是 3 人单，但是按 2 人大车的方式核算」
  //
  // 根子在 EditOrderModal：改车型只存 vehicle，时间费/回程/楼梯单价一分钱都不重算，
  // 而且没有任何提示。
  //
  // ⚠️ 为什么不自动重算：师傅跟客人谈的是 $150/小时，标准价是 $160。
  //    自动重算会把谈好的价冲掉 —— 那比算错更难发现。
  //
  // ⚠️ 为什么只在「正好等于另一个车型的单价」时才报：
  //    谈出来的 $150 不等于任何车型的标准价，不该报。
  //    而 $120 精确命中大卡车 —— 这不是巧合，是按错车型算的铁证。
  //    用「和标准价不一样就报」的话，每一单谈过价的都会天天亮红，
  //    红字一多人就不看红字了，真正跑飞的那单也跟着被忽略。
  if (order.billedHours > 0 && num(order.timeFee) > 0 && order.vehicle) {
    const perHour = num(order.timeFee) / Number(order.billedHours)
    const mine = VEHICLES[order.vehicle]?.hourlyRate
    if (mine && Math.abs(perHour - mine) >= 1) {
      const hit = Object.entries(VEHICLES)
        .find(([name, v]) => name !== order.vehicle && Math.abs(v.hourlyRate - perHour) < 1)
      if (hit) {
        add('high', 'wrongVehicleRate',
          `时间费按 $${perHour.toFixed(0)}/小时 算的 —— 那是「${VEHICLES[hit[0]].label}」的价，`
          + `这单是${order.vehicle}（$${mine}/小时）。多半是改过车型没重算`)
      }
    }
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
 *  工资按人拆开 —— Annie要拿这个和每个师傅核工资，只给总数等于没给。 */

// ═══════════════════════════════════════════════════════════
// 寄存费进对账（2026-11-21）
// ═══════════════════════════════════════════════════════════
// 老板看着 11/20 的对账说：「寄存费用这个在核算啊什么的却是没有一个出口」。
// 那天 4 单全是搬家单 $1468.01，寄存单 QX2611060 的 $312 一分钱没进来。
// 寄存费从来没进过对账、周月汇总、工资页 —— 三个文件 grep storage 全是 0。
//
// ⚠️ 只取【仓储那部分】，绝不能用 finalAmount。
//    QX2611060 的 finalAmount $402 = 寄存费 312 + 运输 120 − 定金 30，
//    而那趟运输【已经由并行的搬家单 QX2611080 记进对账了】
//    （老板现在的做法是让客服同时拍一单寄存、一单搬家）。
//    拿 finalAmount 进来就是把运输算两遍。
//
// ⚠️ 也不能读 totalFee / weeklyFee —— 规则文档第十节：那两列是脏字段，
//    和按价目表算出来的对不上（Chen 那单把家具按纸箱单价算了）。
//    唯一真相是「件数 × 周数 × 价目表」。

/** 单张寄存单的仓储费（不含运输） */
export function storageFeeOf(order) {
  const weeks = Math.max(1, Number(order?.weeks) || 1)
  const { boxRate, furRate } = getStorageRates(weeks)
  const v = ((Number(order?.boxes) || 0) * boxRate
           + (Number(order?.furniture) || 0) * furRate) * weeks
  return Math.round(v * 100) / 100   // r2 是别处函数里的局部变量，这里用不到
}

/**
 * 某一天该计入营收的寄存费。
 * 口径：按【入库日】计 —— 老板定的规矩是钱先收，师傅到现场确认时长当场收齐，
 *       所以东西进仓那天这笔钱就已经到手了。
 * 范围：师傅交过单（workerStatus=done）且没取消。
 */
export function dayStorageFees(storageOrders, date) {
  return (storageOrders || [])
    .filter(o => o.date === date && o.workerStatus === 'done' && o.status !== '已取消')
    .map(o => ({
      id: o.id,
      orderNo: o.orderNo || o.id.slice(-6),
      customerName: o.customerName,
      boxes: Number(o.boxes) || 0,
      furniture: Number(o.furniture) || 0,
      weeks: Math.max(1, Number(o.weeks) || 1),
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      fee: storageFeeOf(o),
    }))
}

export function daySummary(orders, staffRates, b2bCustomers, storageFees = []) {
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
    // ⚠️ 2026-11-16：这里原来自己算一套（工时＋楼梯＋加班），
    //    和工资页的公式不一样 —— 少了重物费，两套都少了回程费。
    //    现在统一走 workerWage()，一个口径。
    const ids = participants(o)
    for (const id of ids) {
      const r = hourlyRateFor(staffRates, id, o)
      const w = workerWage(o, id, staffRates, b2bCustomers)
      const cur = byStaff.get(id) || { id, name: r.name, amount: 0, orders: 0 }
      byStaff.set(id, { ...cur, amount: cur.amount + (w?.total || 0), orders: cur.orders + 1 })
    }
  }
  // 寄存费：进应收/已收，【不进工资】—— 仓储费里没有人工
  let storageDue = 0
  for (const s of storageFees) {
    const amt = Number(s.fee) || 0
    storageDue += amt
    due += amt
    // 「寄存中」就代表师傅现场已经收齐（老板 11-17 定的规矩），所以一律计已收
    paid += amt
    if (s.paymentMethod === 'transfer') transfer += amt
    else cash += amt
  }

  const wageList = [...byStaff.values()].sort((a, b) => b.amount - a.amount)
  return {
    due, paid, unpaid: due - paid, cash, transfer, storageDue,
    wages: wageList.reduce((a, w) => a + w.amount, 0),
    wageList,
  }
}

/** 对账页要显示的字段。顺序就是界面顺序。
 *
 *  type='qty' 的两项是老板 10-11 指出来的 —— 它们本来就不该让人算钱：
 *    回程费  1 小时回程 = 1 小时费用（VEHICLES 里 returnFee 和 hourlyRate 本来就相等）
 *    楼梯费  每层每人 $10，2 人 $20/层、3 人 $30/层（STAIRS_FEE 本来就这么定的）
 *  填数量，钱自动出来。填「1」到底是一层还是一刀，不该让人猜。 */
export const RECONCILE_FIELDS = [
  { key: 'workStartedAt', label: '实际开始', type: 'time'  },
  { key: 'workEndedAt',   label: '实际结束', type: 'time'  },
  { key: 'billedHours',   label: '计费工时', type: 'hours' },
  { key: 'timeFee',       label: '时间费',   type: 'money' },
  { key: 'returnFee',     label: '回程',     type: 'qty', unit: '小时', step: 0.5 },
  { key: 'stairFee',      label: '楼梯',     type: 'qty', unit: '层',   step: 1   },
  { key: 'overtimeFee',   label: '加班费',   type: 'money' },
  { key: 'heavyFee',      label: '重物费',   type: 'money' },
  { key: 'parkingFee',    label: '停车费',   type: 'money' },
  { key: 'highwayFee',    label: '高速费',   type: 'money' },
  { key: 'deposit',       label: '定金',     type: 'money' },
  // 老板 10-21：师傅端的「九折/九五折」改成固定金额优惠（$10/$20），
  // 超过 $20 要先打电话给客服说明缘由，由客服或经理在这里填。
  // 历史上师傅按比例给出去最大一笔是 $120 —— 比例在大单上没有上限。
  // ⚠️ 其他费用必须配备注 —— 一笔没有说明的「其他费用」，三周后翻回来
  //    和凭空多出一个数字没有区别。备注的输入框在界面上紧跟这一行。
  { key: 'otherFee',      label: '其他费用', type: 'money' },
  { key: 'discountAmount', label: '优惠',    type: 'money' },
  { key: 'finalAmount',   label: '实收金额', type: 'money' },
]

/**
 * 数量字段的单价。
 *
 * ⚠️ 回程单价不能直接用时薪 —— 企业协议价里这两个会不一样：
 *      staging / ko / Pod Pack 的面包车   时薪 $60（或标准）· 回程 $50
 *    所以优先读企业价格表的 returnFee，再退回车型标准 returnFee。
 *    （标准车型里 returnFee === hourlyRate，所以散客单两种算法结果一样。）
 *
 * @param b2bCustomers AppContext 里的企业客户列表；不传就退回标准价
 */
export function unitPriceOf(order, key, b2bCustomers) {
  const v = VEHICLES[order?.vehicle]
  if (!v) return 0

  const agreed = (b2bCustomers || [])
    .find(c => c.id === order?.b2bCompanyId)?.pricing?.[order?.vehicle]

  if (key === 'returnFee') {
    if (agreed?.returnFee != null) return Number(agreed.returnFee)
    return v.returnFee
  }
  if (key === 'stairFee') return STAIRS_FEE[v.people] || 10
  return 0
}

/**
 * 一个师傅在一单上该拿多少。【唯一口径】
 *
 * 2026-11-16 新建。原来有两套公式，同一单给两个数：
 *   工资页 WageRecords.calcWorkerWage  工时＋楼梯＋加班＋重物
 *   对账页 daySummary                  工时＋楼梯＋加班        ← 漏了重物
 * 而且【两套都漏了回程费】。
 *
 * ⚠️ 回程这个洞是老板 11-16 对老王的手写工资单时发现的：
 *    他那一周每单都比系统多 1 小时，太均匀了不像算错 —— 就是回程。
 *    客户每单都付了回程费（小卡 $110 / 大卡 $120），公司全额留下，
 *    师傅拿 $0。5/09 以来 374 单都是这样。
 *
 * 回程怎么折算：
 *   returnFee 存的是【金额】，但它在对账页本来就是按「小时数 × 单价」填进去的
 *   （RECONCILE_FIELDS 里 type:'qty', unit:'小时'）。所以反着除回去就是小时数。
 *   $110 ÷ $110 = 1 小时。企业协议价（面包车 时薪$60 / 回程$50）走 unitPriceOf。
 *
 * ⚠️ 长途不自动给（老板 11-16 定）：
 *    超过 1 小时的回程（$550、$990 那种，约 20 单）只自动算 1 小时，
 *    剩下的标出来【由他逐单定】—— 开 5 小时回来和跑一趟近程不是一回事，
 *    规则我替他定不了。
 */
export function workerWage(order, workerId, staffRates, b2bCustomers) {
  const hours = Number(order?.billedHours) || 0
  if (!hours) return null

  const r = hourlyRateFor(staffRates, workerId, order)
  const rate = r.rate
  const workers = order.assignedWorkers?.length || 1
  const r2 = n => Math.round(n * 100) / 100

  const basePay = r2(rate * hours)

  // 回程：金额 ÷ 单价 = 小时数
  // ⚠️ 只从 RETURN_PAY_FROM 起算。之前的单维持原样 ——
  //    否则历史工资被追溯改写，和当时实际发的钱对不上。
  const inScope = String(order.date || '') >= RETURN_PAY_FROM
  const unit = inScope ? unitPriceOf(order, 'returnFee', b2bCustomers) : 0
  const returnAmt = inScope ? (Number(order.returnFee) || 0) : 0
  const returnHours = unit > 0 ? returnAmt / unit : 0
  const longHaul = returnHours > 1.001          // 留一点浮点余量
  const paidHours = longHaul ? 1 : returnHours
  const returnPay = r2(rate * paidHours)

  // 楼梯费＋加班费：工人平分，公司不拿
  const stairOvertime = (Number(order.stairFee) || 0) + (Number(order.overtimeFee) || 0)
  const stairShare = stairOvertime > 0 ? r2(stairOvertime / workers) : 0

  // 重物费＋易碎费：工人＋公司平分（公司算 1 份）
  const heavyFragile = (Number(order.heavyFee) || 0) + (Number(order.fragileEstimatedFee) || 0)
  const heavyShare = heavyFragile > 0 ? r2(heavyFragile / (workers + 1)) : 0

  return {
    rate, isDriver: r.isDriverRole, workers,
    rateSource: r.source,          // 'db' | 'legacy' | 'default' —— 非 db 时页面标黄
    basePay,
    returnPay,
    returnHours: r2(returnHours),
    longHaul,
    pendingHours: longHaul ? r2(returnHours - 1) : 0,   // 待他定的那部分
    stairShare,
    heavyShare,
    stairOvertime,
    heavyFragile,
    total: r2(basePay + returnPay + stairShare + heavyShare),
  }
}

/** 这一单该用的时薪。协议价快照优先 —— 和 pricing.js calcTotal 同源。 */
export function rateOf(order, b2bCustomers) {
  const v = VEHICLES[order?.vehicle]
  if (order?.hourlyRate != null && order.hourlyRate !== '') return Number(order.hourlyRate)
  const agreed = (b2bCustomers || [])
    .find(c => c.id === order?.b2bCompanyId)?.pricing?.[order?.vehicle]
  if (agreed?.hourlyRate != null) return Number(agreed.hourlyRate)
  return v?.hourlyRate || 0
}

/** 金额 → 数量（把已存的费用倒推成「几小时 / 几层」显示在输入框里） */
export function feeToQty(order, key, fee, b2bCustomers) {
  const unit = unitPriceOf(order, key, b2bCustomers)
  if (!unit) return ''
  const q = (Number(fee) || 0) / unit
  return Number.isFinite(q) ? String(Math.round(q * 100) / 100) : ''
}


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
  // 老板 10-29：「我希望再加一条其他费用，加备注」
  // 现场总有不属于固定类目的开销（过路、垃圾处理、临时买材料、客人加的活）。
  // 没有这一项的话只能硬塞进某个类目，塞进去就再也看不出那是什么钱了。
  'otherFee',
]

const num = v => (v === '' || v === null || v === undefined) ? 0 : (Number(v) || 0)

/** 定金三选一。老板 10-11：「有 = 30，无 = 0，其他 = 手动填写」
 *  —— 比按 isB2BOrder 自动推断好：那个字段本来就有漏标的
 *  （ko 6 单、金姐 2 单、澳邮 1 单都是企业客户但没打标记）。
 *  靠猜会把金额算错，让人点一下反而更快更准。
 *  长途那种收 $500 以上的走「其他」手填。 */
export const STANDARD_DEPOSIT = 30
const pick = (order, draft, k) => draft[k] !== undefined && draft[k] !== '' ? draft[k] : order[k]

/**
 * 用户改了 field 之后，哪些派生值要跟着变。
 * @returns 要并进 draft 的字段（不覆盖用户已经手动填过的）
 */
export function deriveDraft(order, draft, field, auto = {}, b2bCustomers) {
  const v = VEHICLES[order.vehicle]
  if (!v) return {}
  const out = {}
  // ⚠️ 「人工改过」必须排除系统自己填的那些。
  //    第一版只看 draft 里有没有值 —— 系统自动填进去的也算「改过」，
  //    于是实收金额自动填过一次之后就再也不更新了（老板 10-11 实测发现）。
  const touched = k => draft[k] !== undefined && draft[k] !== '' && !auto[k]

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
    const rate = rateOf(order, b2bCustomers)
    if (!touched('timeFee') || out.billedHours !== undefined) {
      out.timeFee = (Math.round(rate * hours * 100) / 100).toFixed(2)
    }
  }

  // ③ 费用 / 收款方式 / 定金任一变了 → 重算 GST 和实收金额
  //
  //    老板 10-11 指出漏了收款方式和定金。实测 286 张已完成订单：
  //      GST   11 张转账单全部 = 费用 × 10%，零例外 → 规则确定，可以放心算
  //      定金  203 单扣了 / 32 单没扣 / 28 单为 0  → 标准做法是扣，
  //            那 32 单没扣的是错的，正好是对账该揪出来的
  //    所以这里用完整公式，不再按差额凑：
  //      实收 = 费用合计 + GST − 定金 − 优惠（2026-10-21 加的优惠）
  const merged = { ...draft, ...out }
  const b = breakdown(order, merged)
  if (!touched('gst'))         out.gst = b.gst.toFixed(2)
  if (!touched('finalAmount')) out.finalAmount = b.total.toFixed(2)
  return out
}

/**
 * 账单分解。界面上把这几步摊开给 Annie 看 ——
 * 她手里拿着现金或银行流水，得知道这个数是怎么来的。
 */
export function breakdown(order, draft = {}) {
  const v = VEHICLES[order?.vehicle]
  const get = k => num(pick(order, draft, k))
  const fees = SUMMED_FEES.reduce((a, k) => a + get(k), 0)
  const van = order?.vehicle === '面包车' ? VAN_PROMO_DISCOUNT : 0
  const sub = fees - van
  const method = pick(order, draft, 'paymentMethod')
  const gst = method === 'transfer' ? Math.round(sub * 0.1 * 100) / 100 : 0
  const deposit = get('deposit')
  // ⚠️ 老板 10-21 定的口径：「总金额 + GST − 定金 − 优惠」
  //    优惠【不参与 GST】—— 税基是优惠前的金额。
  //    （先减优惠再算税会少交一点 GST，但老板要的是客人更好理解的算法。）
  const discount = get('discountAmount')
  const other = get('otherFee')
  const otherNote = pick(order, draft, 'otherFeeNote') || ''
  return {
    fees, van, sub, gst, deposit, discount, other, otherNote, method,
    total: Math.round((sub + gst - deposit - discount) * 100) / 100,
    people: v?.people || 1,
  }
}

/** 这个字段是自动算出来的吗（界面上标一下，让 Annie 知道哪些是系统填的） */
export const DERIVED_FIELDS = ['billedHours', 'timeFee', 'overtimeFee', 'gst', 'finalAmount']
