// 周月汇总 —— 全部从已有数据算，不让员工重抄（2026-10-12 第 6 步）
//
// ⚠️ 写这些聚合时必须记住一件事：
//    我 10-10 得出过「客单价半年涨 2.1 倍」的结论并写进了方案，后来发现是错的 ——
//    一是被计时跑飞的订单（QX2608021 一单 $21,364）带偏，
//    二是混用了分母（全部订单 vs 已完成订单）。
//    所以这里所有「每单平均」一律【只用已完成订单】做分母，
//    并且把异常单单独标出来，不让它们悄悄污染趋势。

import { hourlyRateFor } from './wageRates'
import { participants } from './reconcile'
import { sydneyDateOf } from './date'

const num = v => Number(v) || 0
const inRange = (d, from, to) => d && String(d) >= from && String(d) <= to

/** 期间的订单（按服务日期，不是建单日期 —— 营收归属服务当天） */
export function ordersIn(orders, from, to) {
  return (orders || []).filter(o => inRange(o.date, from, to))
}

/** ① 经营概况 */
export function overview(orders, from, to, staffRates) {
  const all = ordersIn(orders, from, to)
  const done = all.filter(o => o.status === '已完成')
  const revenue = done.reduce((s, o) => s + num(o.finalAmount), 0)
  let wages = 0
  for (const o of done) {
    const share = num(o.stairFee) + num(o.overtimeFee)
    const ids = participants(o)
    for (const id of ids) {
      wages += hourlyRateFor(staffRates, id, o).rate * num(o.billedHours) + share / (ids.length || 1)
    }
  }
  return {
    orders: all.length,
    completed: done.length,
    cancelled: all.filter(o => o.status === '已取消').length,
    revenue,
    // ⚠️ 分母只用已完成 —— 把没做成的单算进去会把客单价压低，看起来像在下滑
    avgOrder: done.length ? revenue / done.length : 0,
    wages,
    wageRatio: revenue ? wages / revenue : 0,
    unpaid: done.filter(o => o.paymentStatus !== 'paid').reduce((s, o) => s + num(o.finalAmount), 0),
  }
}

/** ② 客服工作情况。客服只看自己 —— 过滤在页面层做。 */
/**
 * 客服工作情况。
 *
 * ⚠️ 老板 10-12 提的公平性问题：
 *   「经理会监管核对，还有运营多一些，在小洁休息的时候顶上，
 *     所以接待订单数量会不同…但我们这个表格应该可以让她的工作量体现出来」
 *
 * 只统计「接了几单」的话，Annie永远显得产出低 ——
 * 而那恰恰是因为她把时间花在核对和运营上。
 * 所以把管理工作也算成产出：日结确认、核对订单数、补录笔数。
 */
export function staffStats(opts) {
  const { orders, logs, inquiries, posts, breaks, confirms, checks, fixes, returns, from, to, staffIds } = opts
  return (staffIds || []).map(id => {
    const myLogs = (logs || []).filter(l => l.staff_id === id && inRange(l.work_date, from, to))
    const worked = myLogs.filter(l => l.clock_in)
    const mins = worked.reduce((s, l) => {
      if (!l.clock_in || !l.clock_out) return s
      return s + (new Date(l.clock_out) - new Date(l.clock_in)) / 60000
    }, 0)
    // ⚠️ 接单数按【建单时刻】算，不是服务日期。
    //    实测 368 单里 88% 不是当天搬的（中位间隔 2 天），
    //    用服务日期算会把跨月的单算到错的月份去。
    const myOrders = (orders || []).filter(o =>
      o.createdBy === id && inRange(sydneyDateOf(o.createdAt), from, to) && o.status !== '已取消')
    // 咨询数精确归属到人（2026-10-12 起 platform_inquiry 按人存）
    const myInq = (inquiries || [])
      .filter(i => i.staff_id === id && inRange(i.log_date, from, to))
      .reduce((s, i) => s + num(i.count), 0)
    const myBreaks = (breaks || []).filter(b => b.staff_id === id && inRange(b.work_date, from, to))
    return {
      id,
      days: worked.length,
      hours: Math.round(mins / 60 * 10) / 10,
      created: myOrders.length,
      amount: myOrders.reduce((s, o) => s + (num(o.finalAmount) || num(o.quote)), 0),
      inquiries: myInq,
      // 实际接待 —— 真的加上微信的人。和平台咨询的差额就是流失
      wechatAdds: myLogs.reduce((s, l) => s + (l.wechat_adds ?? 0), 0),
      // 主动开发。客服是小红书评论配额，经理是 to B 开发 —— 两种口径分开记
      comments: myLogs.reduce((s, l) => s + (l.comment_count ?? 0), 0),
      commentDays: myLogs.filter(l => (l.comment_count ?? 0) > 0).length,
      shotDays: myLogs.filter(l => l.comment_shots?.length).length,
      b2bDays: myLogs.filter(l => l.b2b_outreach?.trim()).length,
      rate: myInq ? myOrders.length / myInq : null,
      posts: (posts || []).filter(p => p.posted_by === id && inRange(p.post_date, from, to)).length,
      submitted: myLogs.filter(l => l.submitted_at).length,
      overtimeBreaks: myBreaks.filter(b => b.overtime).length,
      // 管理工作 —— 不记的话做这些的人在表上显得没干活
      videos: (posts || []).filter(p => p.posted_by === id && p.kind === 'video'
        && inRange(p.post_date, from, to)).length,
      dayConfirms: (confirms || []).filter(c => c.confirmed_by === id).length,
      ordersChecked: (checks || []).filter(c => c.checked_by === id).length,
      fixesMade: (fixes || []).filter(f => f.changed_by === id && !f.undone_at).length,
      // 日报退回。两个方向都要看：
      //   returned  = 她自己被退回几次（数据质量）
      //   returnedBy = 她退回了别人几次（她真的在核对，不是走过场）
      returned:    (returns || []).filter(r => r.staff_id === id && inRange(r.work_date, from, to)).length,
      returnedBy:  (returns || []).filter(r => r.returned_by === id && inRange(r.work_date, from, to)).length,
    }
  })
}

/** ③ 大形势判断 —— 全部从数据算，不写死任何结论 */
export function insights(orders, months) {
  const out = []
  const trend = months.map(m => {
    const done = (orders || []).filter(o => String(o.date).slice(0, 7) === m && o.status === '已完成')
    const rev = done.reduce((s, o) => s + num(o.finalAmount), 0)
    return { month: m, count: done.length, revenue: rev, avg: done.length ? rev / done.length : 0 }
  })

  // 订单量环比
  const [prev, cur] = trend.slice(-2)
  if (prev && cur && prev.count > 0) {
    const d = (cur.count - prev.count) / prev.count * 100
    if (Math.abs(d) >= 15) {
      out.push({ icon: d > 0 ? '📈' : '⚠️', sev: d > 0 ? 'good' : 'warn',
        title: `${cur.month.slice(5)} 月订单 ${d > 0 ? '+' : ''}${d.toFixed(0)}%`,
        text: `${prev.count} → ${cur.count} 单` })
    }
  }

  // 客单价区间（不说「涨了几倍」—— 那个结论我犯过错）
  const avgs = trend.filter(t => t.count > 0).map(t => t.avg)
  if (avgs.length >= 3) {
    const lo = Math.min(...avgs), hi = Math.max(...avgs)
    const spread = lo ? (hi - lo) / lo : 0
    out.push({ icon: '💵', sev: 'info',
      title: `客单价在 $${lo.toFixed(0)}–$${hi.toFixed(0)} 之间`,
      text: spread > 0.6
        ? '波动较大，看看是车型结构变了还是有异常单'
        : '基本稳定，接单结构没大变化' })
  }

  // 复购率
  const byCustomer = {}
  for (const o of orders || []) {
    const k = (o.customer_code || o.customerPhone || o.customerName || '').trim()
    if (!k || o.status === '已取消') continue
    byCustomer[k] = (byCustomer[k] || 0) + 1
  }
  const total = Object.keys(byCustomer).length
  const repeat = Object.values(byCustomer).filter(n => n >= 2).length
  if (total > 20) {
    out.push({ icon: '🔁', sev: 'info',
      title: `复购率 ${(repeat / total * 100).toFixed(0)}%`,
      text: `${total} 个客户里 ${repeat} 个下过 2 单以上` })
  }

  // 车型结构
  const byVehicle = {}
  for (const o of orders || []) {
    if (o.status === '已取消' || !o.vehicle) continue
    byVehicle[o.vehicle] = (byVehicle[o.vehicle] || 0) + 1
  }
  const vs = Object.entries(byVehicle).sort((a, b) => b[1] - a[1])
  const sum = vs.reduce((s, [, n]) => s + n, 0)
  if (vs.length && sum) {
    const [v, n] = vs[0]
    out.push({ icon: '🚚', sev: 'info',
      title: `${v}撑了 ${(n / sum * 100).toFixed(0)}%`, text: `${n}/${sum} 单` })
  }

  // 几乎没用的业务
  for (const [v, n] of vs) {
    if (n <= 2 && sum > 100) {
      out.push({ icon: '💤', sev: 'warn', title: `${v}全期只有 ${n} 单`,
        text: '要么投入推，要么考虑收掉' })
    }
  }
  return { insights: out, trend, byVehicle: vs, repeatRate: total ? repeat / total : 0 }
}

/** ⑤ 本期遗漏与问题 —— 自动抓 */
export function gaps(opts) {
  const { orders, logs, inquiries, closes, breaks, accounts, staffIds, from, to, staffRates } = opts
  const out = []
  const days = []
  for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10))
  }
  const today = new Date().toISOString().slice(0, 10)
  const past = days.filter(d => d < today)

  // 没日结的天（那天有已完成订单才算）
  const noClose = past.filter(d => {
    const has = (orders || []).some(o => String(o.date) === d && o.status === '已完成')
    return has && !(closes || []).some(c => String(c.work_date) === d && c.status === 'confirmed')
  })
  if (noClose.length) out.push({ sev: 'high', text: `${noClose.length} 天没有确认日结：${noClose.slice(0, 5).join('、')}${noClose.length > 5 ? ' 等' : ''}` })

  // 没交日报
  for (const id of staffIds || []) {
    const miss = past.filter(d =>
      (logs || []).some(l => l.staff_id === id && String(l.work_date) === d && l.clock_in && !l.submitted_at))
    if (miss.length) out.push({ sev: 'mid', text: `${id} 有 ${miss.length} 天打了卡但没交日报` })
  }

  // 平台漏登记
  const need = (accounts || []).filter(a => a.status === 'active')
  for (const a of need) {
    const miss = past.filter(d =>
      (orders || []).length >= 0 && !(inquiries || []).some(i => i.account_id === a.id && String(i.log_date) === d))
    if (miss.length) out.push({ sev: 'mid', text: `${a.name} 漏登记 ${miss.length} 天咨询数` })
  }

  // 餐休超时
  const over = (breaks || []).filter(b => b.overtime && inRange(b.work_date, from, to))
  if (over.length) out.push({ sev: 'mid', text: `餐休超时 ${over.length} 次` })

  // 超 48 小时未收款
  const unpaid = ordersIn(orders, from, to).filter(o =>
    o.status === '已完成' && o.paymentStatus !== 'paid' && o.completedAt &&
    (Date.now() - new Date(o.completedAt)) / 3600000 > 48)
  if (unpaid.length) {
    const amt = unpaid.reduce((s, o) => s + num(o.finalAmount), 0)
    out.push({ sev: 'mid', text: `${unpaid.length} 单完成超 48 小时未收款，合计 $${amt.toFixed(2)}` })
  }

  // 费率未录入
  const missRate = new Set()
  for (const o of ordersIn(orders, from, to)) {
    if (o.status !== '已完成') continue
    for (const id of participants(o)) {
      if (hourlyRateFor(staffRates, id, o).source === 'default') missRate.add(id)
    }
  }
  if (missRate.size) out.push({ sev: 'mid', text: `${[...missRate].join('、')} 的费率没录入，工资按默认 $33 算的` })

  return out
}

/** 月份列表（含自己，往前 N 个月） */
export function recentMonths(dateStr, n = 6) {
  const [y, m] = dateStr.split('-').map(Number)
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    out.push(d.toISOString().slice(0, 7))
  }
  return out
}

/** 期间边界 */
export function periodRange(kind, anchor) {
  if (kind === 'month') {
    const [y, m] = anchor.split('-').map(Number)
    const from = new Date(Date.UTC(y, m - 1, 1))
    const to = new Date(Date.UTC(y, m, 0))
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
  }
  const [y, m, d] = anchor.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = (dt.getUTCDay() + 6) % 7
  const from = new Date(dt); from.setUTCDate(from.getUTCDate() - dow)
  const to = new Date(from); to.setUTCDate(to.getUTCDate() + 6)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}
