// 每日对账工作台 —— 2026-10-12 第 4 步
//
// Annie 的真实工作流（老板 10-11 描述）：
//   师傅干完活 → 在微信里报给 Annie → Annie 打开这一页逐单对
//   → 对不上当场补 → 全部对完确认当日收入
//
// 关键：这一页必须能直接改，不能只读。
// 否则她要为每单跳进订单详情页改一遍 —— 一半订单有问题，一天得跳几十次。

import { useState, useEffect, useMemo, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { sydneyToday, addDays } from '../../utils/date'
import {
  vehicleMedians, detectIssues, impactOf, daySummary, participants, RECONCILE_FIELDS,
  deriveDraft, DERIVED_FIELDS, unitPriceOf, feeToQty, breakdown, STANDARD_DEPOSIT,
} from '../../utils/reconcile'
import {
  ChevronLeft, ChevronRight, Check, AlertTriangle, Undo2, Lock, Unlock, History,
} from 'lucide-react'

const money = n => `$${(Number(n) || 0).toFixed(2)}`
const hhmm = iso => iso
  ? new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  : null
// 老板 10-11：时间一律只到分钟，秒没必要。
// 注意 toLocaleString 不传字段时【默认带秒】，所以每处都要显式列出来。
const stamp = iso => new Date(iso).toLocaleString('zh-CN', {
  hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
})

// ⚠️ datetime-local 给的是【浏览器本地墙上时间】，没有时区信息。
// Annie 在国内，直接把 '2026-10-11T10:30' 送进 timestamptz 列会被当成 UTC —— 差 8 小时。
// 存库前一律转成带时区的 ISO；比对时也两边都转，否则 'T10:30' 和 ISO 串永远不相等，
// 会把「没改」判成「改了」，白写一条补录日志。
const toISO = v => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// ── 时间只填时分 ────────────────────────────────────────────
// 老板 10-21：「有没有更好的，这个有点费劲」
// 原来用 datetime-local，要一格一格敲年/月/日/时/分 —— 五段。
// 可日期根本不用她填：对账对的就是这一单那一天。所以只留时分两段，
// 日期由系统补上，她敲 4 个数字就完事。
const hhmmOf = v => {
  if (!v) return ''
  if (/^\d{2}:\d{2}$/.test(v)) return v
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ⚠️ 叫 nextDay 不叫 addDays —— 这个文件已经从 utils/date 引了一个 addDays。
//    重名在构建期就会炸（这次就是），但同类的错有些要跑到运行时才暴露。
const nextDay = ymd => {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + 1)
  return t.toISOString().slice(0, 10)
}

/**
 * 时分 → 完整的本地时间串（datetime-local 格式），日期取这一单的日期。
 * ⚠️ 收工时间早于开工时间 = 跨了零点（长途单会这样），日期自动进一天。
 *    不处理的话会算出负工时，然后时间费变成负数。
 */
function composeDT(order, key, hhmm, draft) {
  if (!hhmm) return ''
  const base = String(order?.date || '').slice(0, 10)
  if (!base) return hhmm
  let day = base
  if (key === 'workEndedAt') {
    const start = hhmmOf(draft?.workStartedAt || order?.workStartedAt)
    if (start && hhmm < start) day = nextDay(base)
  }
  return `${day}T${hhmm}`
}

export default function Reconcile() {
  const { orders, staffRates, staff, reconcileOrder, undoReconcile, closeDay, reopenDay,
          getReconcile, markReconciled, unmarkReconciled, markAllReconciled, b2bCustomers } = useApp()
  // 从「团队今日」的「去对账」跳过来时带着 ?date= ——
  // 老板定的流程是第二天早上核前一天，落地页必须直接是那一天，
  // 不能让她跳过来还要自己翻日期。
  const [params] = useSearchParams()
  const [date, setDate] = useState(() => params.get('date') || sydneyToday())
  const [close, setClose] = useState(null)
  const [logs, setLogs] = useState([])
  const [checked, setChecked] = useState([])
  const [openId, setOpenId] = useState(null)
  // 哪些单有没保存的补录。老板 10-11 实测：表单算出 $670，
  // 汇总和确认按钮还是 $300 —— 因为草稿还在浏览器里没进库。
  // 这种时候绝不能让人点「确认当日收入」。
  const [dirty, setDirty] = useState({})
  const [showLogs, setShowLogs] = useState(false)
  // 当日备注 —— 老板 10-20：「我希望这个最好也能有一个备注」
  // 单条有备注（师傅微信确认…），整天没有。可整天才是真正要解释的那一层：
  // 「老王那单缺开始结束，电话问到的」「金姐这单客人少给 20，下次补」——
  // 这些话不写下来，三周后翻到这一天只剩一个数字，谁也想不起来为什么。
  // 数据库早就有 daily_close.note，close_day 也收 p_note，缺的只是这个框。
  const [dayNote, setDayNote] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // 撤销确认后重新填时，把上次写的带回来，不用重打一遍
  useEffect(() => { setDayNote(close?.note || '') }, [close?.note])

  const medians = useMemo(() => vehicleMedians(orders), [orders])
  const dayOrders = useMemo(
    () => orders.filter(o => o.date === date).sort((a, b) => (a.orderNo || '').localeCompare(b.orderNo || '')),
    [orders, date])
  const done = dayOrders.filter(o => o.status === '已完成')
  const sum = useMemo(() => daySummary(dayOrders, staffRates), [dayOrders, staffRates])

  const issuesBy = useMemo(() => Object.fromEntries(
    done.map(o => [o.id, detectIssues(o, { medians, staffRates })])), [done, medians, staffRates])

  // ⚠️ 进度按【人工勾选】算，不按「系统查不出异常」算。
  // 这一页的存在理由是Annie和师傅在微信核对完再回写系统 ——
  // 系统能查的只有字段齐不齐、数字离不离谱，
  // 它不可能知道她有没有问过晨曦这单几点收的工。
  const checkedIds = useMemo(() => new Set(checked.map(c => c.order_id)), [checked])
  const clean = done.filter(o => checkedIds.has(o.id)).length

  async function refresh(d = date) {
    const r = await getReconcile(d)
    setClose(r.close); setLogs(r.logs); setChecked(r.checked || [])
  }

  // 换日期就重拉日结状态和补录记录。
  // alive 守卫：快速连点日期箭头时，先发出的请求可能后返回，
  // 没有这个守卫会用旧日期的数据覆盖新日期的。
  useEffect(() => {
    let alive = true
    ;(async () => {
      const r = await getReconcile(date)
      if (alive) { setClose(r.close); setLogs(r.logs); setChecked(r.checked || []) }
    })()
    return () => { alive = false }
    // getReconcile 每次渲染都是新函数，放进依赖会无限循环 —— 只跟日期走
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  async function run(fn) {
    setBusy(true); setErr('')
    try { await fn(); await refresh() }
    catch (e) { setErr(e.message || '操作失败') }
    finally { setBusy(false) }
  }

  const confirmed = close?.status === 'confirmed'
  const unsaved = Object.values(dirty).filter(n => n > 0).length

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">每日对账</h1>
          <p className="text-sm text-gray-400 mt-0.5">和师傅在微信里核对完，在这里逐单补录</p>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-xl shadow-sm p-1">
          <button onClick={() => setDate(addDays(date, -1))} className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg">
            <ChevronLeft size={18} />
          </button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-2 py-1 text-sm font-semibold outline-none" />
          <button onClick={() => setDate(addDays(date, 1))} className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 浮在屏幕上，不随页面滚走 ——
          老板 10-13 在页面中间填数字保存失败，报错在最顶部，他根本看不见，
          只看到「数字不联动」。错误提示必须出现在视线里。 */}
      {err && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[90%]
                        bg-red-600 text-white rounded-xl px-4 py-3 shadow-lg flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span className="text-sm flex-1 leading-relaxed">{err}</span>
          <button onClick={() => setErr('')} className="shrink-0 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* 进度 + 汇总 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">
            {done.length === 0 ? '这天没有已完成的订单' : `已核对 ${clean} / ${done.length} 单`}
          </span>
          {confirmed
            ? <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-lg">
                <Lock size={12} /> 已确认
              </span>
            : <span className="text-xs text-gray-400">未确认</span>}
        </div>
        {done.length > 0 && clean < done.length && !confirmed && (
          <button disabled={busy} onClick={() => run(() => markAllReconciled(date))}
            className="text-xs text-gray-500 hover:text-green-700 border border-gray-200 rounded-lg px-2.5 py-1 mb-2 disabled:opacity-40">
            ✓ 全部标记已核对（{done.length - clean} 单）
          </button>
        )}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${done.length ? (clean / done.length) * 100 : 0}%`,
                     background: 'linear-gradient(90deg,#6b1414,#c0392b)' }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <Stat label="应收" value={money(sum.due)} />
          <Stat label="已收" value={money(sum.paid)} good
            sub={sum.paid > 0 ? `现金 ${money(sum.cash)} · 转账 ${money(sum.transfer)}` : null} />
          <Stat label="未收" value={money(sum.unpaid)} warn={sum.unpaid > 0} />
          <Stat label="工资支出" value={money(sum.wages)}
            sub={sum.wageList.length ? sum.wageList.map(w => `${w.name} ${money(w.amount)}`).join(' · ') : null} />
        </div>
      </div>

      {/* 订单 —— 折叠行就能对完大部分单，不用展开 */}
      {dayOrders.length > 0 && (
        <div className="flex items-center gap-3 px-4 pb-1.5 text-xs text-gray-300">
          <span className="w-5 shrink-0" />
          <span className="w-24 shrink-0">订单号</span>
          <span className="w-40 shrink-0">客户 · 车型</span>
          <span className="w-24 shrink-0">师傅</span>
          <span className="w-28 shrink-0">开始–结束</span>
          <span className="w-14 shrink-0 text-right">工时</span>
          <span className="w-12 shrink-0 text-center">收款</span>
          <span className="flex-1 text-right">金额</span>
          <span className="w-20 shrink-0 text-right">状态</span>
        </div>
      )}
      <div className="space-y-2">
        {dayOrders.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">这一天没有订单</p>
        )}
        {dayOrders.map(o => (
          <OrderRow key={`${o.id}:${openId === o.id}`} order={o}
            issues={issuesBy[o.id] || []}
            staffRates={staffRates} staff={staff} medians={medians}
            checkedBy={checked.find(c => c.order_id === o.id)} b2b={b2bCustomers}
            open={openId === o.id} onToggle={() => setOpenId(openId === o.id ? null : o.id)}
            disabled={busy}
            onSave={(changes, reason) => run(() => reconcileOrder(o.id, date, changes, reason))}
            onCheck={v => run(() => v ? markReconciled(o.id, date) : unmarkReconciled(o.id))}
            onDirty={n => setDirty(d => (d[o.id] || 0) === n ? d : { ...d, [o.id]: n })} />
        ))}
      </div>

      {/* 确认 */}
      {done.length > 0 && (
        <div className="mt-5 bg-white rounded-2xl p-4 shadow-sm">
          {confirmed ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <p className="font-semibold text-green-700 flex items-center gap-1.5">
                  <Check size={15} /> 当日收入已确认 {money(sum.due)}
                </p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {staff.find(s => s.id === close.confirmed_by)?.name || close.confirmed_by} ·
                  {' '}{stamp(close.confirmed_at)}
                </p>
                {close.note && (
                  <p className="text-gray-600 text-xs mt-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5 leading-relaxed">
                    {close.note}
                  </p>
                )}
              </div>
              <button disabled={busy} onClick={() => run(() => reopenDay(date))}
                className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50 disabled:opacity-40">
                <Unlock size={14} /> 撤销确认
              </button>
            </div>
          ) : (
            <>
              <input value={dayNote} onChange={e => setDayNote(e.target.value)}
                placeholder="这一天的备注（可不填）—— 例：老王那单缺开始结束，电话问到的；金姐少给 20 下次补"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-2.5
                           outline-none focus:border-red-400" />
              <button disabled={busy || clean < done.length || unsaved > 0} onClick={() => run(() => closeDay(date, dayNote))}
                className="w-full text-white font-bold py-3 rounded-xl disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
                {unsaved > 0
                  ? `还有 ${unsaved} 单的补录没保存`
                  : clean < done.length
                    ? `还有 ${done.length - clean} 单没核对`
                    : `确认当日收入 ${money(sum.due)}`}
              </button>
              <p className={`text-xs mt-2 text-center ${unsaved > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                {unsaved > 0
                  ? '黄底的数字还只是草稿，先点那一单里的「保存」写进系统，这里的金额才会跟着变'
                  : '逐单和师傅核对完再勾左边的框，全部勾完才能确认当日收入'}
              </p>
            </>
          )}
        </div>
      )}

      {/* 补录历史 */}
      {logs.length > 0 && (
        <div className="mt-5">
          <button onClick={() => setShowLogs(v => !v)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <History size={14} /> 当天补录记录 {logs.length} 条 {showLogs ? '▲' : '▼'}
          </button>
          {showLogs && (
            <div className="bg-white rounded-2xl p-4 shadow-sm mt-2 space-y-2">
              {logs.map(l => (
                <div key={l.id} className={`flex items-center gap-3 text-sm py-1.5 ${l.undone_at ? 'opacity-40' : ''}`}>
                  <span className="font-mono text-xs text-gray-400 w-32 shrink-0">
                    {stamp(l.changed_at)}
                  </span>
                  <span className="font-semibold text-xs w-24 shrink-0">{l.order_no || l.order_id}</span>
                  <span className="text-gray-600 flex-1 min-w-0 truncate">
                    {labelOf(l.field)}：<span className="text-gray-400">{l.old_value ?? '空'}</span> → <strong>{l.new_value}</strong>
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {staff.find(s => s.id === l.changed_by)?.name || l.changed_by}
                  </span>
                  {l.undone_at
                    ? <span className="text-xs text-gray-400 shrink-0">已撤销</span>
                    : <button disabled={busy} onClick={() => run(() => undoReconcile(l.id))}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 shrink-0 disabled:opacity-40">
                        <Undo2 size={12} /> 撤销
                      </button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function labelOf(k) {
  return RECONCILE_FIELDS.find(f => f.key === k)?.label || k
}

function Line({ label, value, bold, dim }) {
  return (
    <div className={`flex justify-between ${dim ? 'text-gray-400' : bold ? 'text-gray-900 font-bold' : 'text-gray-600'}`}>
      <span className="font-sans">{label}</span><span>{value}</span>
    </div>
  )
}

function Stat({ label, value, good, warn, sub }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`font-mono font-bold text-base mt-0.5 ${
        warn ? 'text-red-600' : good ? 'text-green-600' : 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5 leading-snug">{sub}</p>}
    </div>
  )
}

// key 里带了 open 状态 —— 开合时组件重新挂载，草稿自然清空。
// 比用 effect 清 state 干净：没有「渲染完再 setState」那一拍级联渲染。
function OrderRow({ order, issues, staffRates, staff, medians, checkedBy, b2b, open, onToggle, onSave, onCheck, onDirty, disabled }) {
  const [draft, setDraft] = useState({})
  // auto 记录哪些值是系统算出来的（而不是人手敲的）——
  // 界面上标「自动」，并且后续重算时可以放心覆盖它们
  const [auto, setAuto] = useState({})
  // qty 字段在界面上显示的是数量（几小时/几层），draft 里存的是金额，两边分开放
  const [qty, setQty] = useState({})
  const [reason, setReason] = useState('师傅微信确认')

  // 老板 10-11：「都选到 5.5 小时了为什么不能自动核算」
  // 改一个值，把它派生出来的几项一起填上，人工填过的不动。
  // qty 字段（回程/楼梯）界面上填的是数量，存进 draft 的必须是金额
  function toFee(key, raw) {
    const f = RECONCILE_FIELDS.find(x => x.key === key)
    if (f?.type !== 'qty' || raw === '') return raw
    return String(Math.round((Number(raw) || 0) * unitPriceOf(order, key, b2b) * 100) / 100)
  }

  function edit(key, raw) {
    const value = toFee(key, raw)
    setQty(q => ({ ...q, [key]: raw }))
    setAuto(a => {
      const next = { ...draft, [key]: value }
      const derived = deriveDraft(order, next, key, a, b2b)
      const n = { ...a, [key]: false }
      for (const k of Object.keys(derived)) n[k] = true
      setDraft({ ...next, ...derived })
      return n
    })
  }

  const incomplete = order.status !== '已完成'
  const high = issues.filter(i => i.sev === 'high').length
  const changes = Object.fromEntries(
    Object.entries(draft)
      .map(([k, v]) => {
        const isTime = RECONCILE_FIELDS.find(f => f.key === k)?.type === 'time'
        return [k, isTime ? toISO(v) : (v === '' ? null : v)]
      })
      .filter(([k, v]) => {
        const isTime = RECONCILE_FIELDS.find(f => f.key === k)?.type === 'time'
        const cur = isTime ? toISO(order[k]) : (order[k] ?? null)
        if (v === null && (cur === null || cur === undefined || cur === '')) return false
        if (isTime) return v !== cur
        // ⚠️ 数值一律按数值比，不能按字符串。
        // 自动算的值我格式化成了 '550.00'，数据库返回的是 550 ——
        // 字符串比较会判成「改了」，于是存完还显示「未保存 3 项」，
        // 而且每存一次就往 reconcile_log 里塞一条 'gst: 0 → 0.00' 的废记录。
        const a = Number(v), b = Number(cur)
        if (Number.isFinite(a) && Number.isFinite(b)) return Math.abs(a - b) >= 0.005
        return String(v ?? '') !== String(cur ?? '')
      }))
  const nChanges = Object.keys(changes).length
  const impactRaw = nChanges ? impactOf(order, changes, staffRates) : null
  // 有改动但金额工时都没动（比如只改了收款方式）→ 不显示空的影响框
  const impact = impactRaw && (impactRaw.wages.length
    || impactRaw.hours.from !== impactRaw.hours.to
    || impactRaw.amount.from !== impactRaw.amount.to) ? impactRaw : null
  useEffect(() => { onDirty?.(nChanges) }, [nChanges, onDirty])

  // 补录出来的工时也要查一遍 —— 填错结束时间会算出 28 小时，
  // 加班费有封顶挡着，工时和时间费没有。保存前必须让人看见。
  const med = medians?.[order.vehicle]
  const hoursOdd = med && Number(order.billedHours) > med * 4
  const draftHours = Number(changes.billedHours ?? order.billedHours) || 0
  const hoursWarn = med && draftHours > med * 4
    ? `补录后计费 ${draftHours} 小时，是${order.vehicle}常规（中位 ${med} 小时）的 ${(draftHours / med).toFixed(0)} 倍 —— 确认结束时间填对了吗？`
    : null

  return (
    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden ${incomplete ? 'opacity-50' : ''} ${nChanges > 0 ? 'ring-2 ring-amber-300' : checkedBy ? 'ring-1 ring-green-200' : ''}`}>
      <div className="flex items-center gap-3 px-4 py-3">
      {!incomplete && (
        <button onClick={() => onCheck(!checkedBy)} disabled={disabled}
          title={checkedBy ? '取消「已核对」' : '标记为「我和师傅对过了」'}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors disabled:opacity-40 ${
            checkedBy ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
          {checkedBy && <Check size={13} className="text-white" strokeWidth={3} />}
        </button>
      )}
      <button onClick={incomplete ? undefined : onToggle}
        className="flex-1 flex items-center gap-3 text-left disabled:cursor-default min-w-0"
        disabled={incomplete}>
        <span className="font-mono text-sm font-semibold text-gray-700 w-24 shrink-0">
          {order.orderNo || order.id.slice(-6)}
        </span>

        {/* 不展开就能对 —— 老板 10-11：「要减少劳动力简单高效」。
            Annie手里拿着师傅微信报的时间，这一行要能直接比，
            逼她每单点开 = 这一页还不如订单详情页。 */}
        <span className="text-sm text-gray-600 w-40 shrink-0 truncate">
          {order.customerName}
          <span className="text-gray-400 ml-1.5">{order.vehicle}</span>
        </span>
        <span className="text-xs text-gray-400 w-24 shrink-0 truncate">
          {participants(order).map(id => staff.find(s => s.id === id)?.name || id).join('/')}
        </span>

        <span className={`font-mono text-xs w-28 shrink-0 ${
          !order.workStartedAt || !order.workEndedAt ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
          {order.workStartedAt && order.workEndedAt
            ? `${hhmm(order.workStartedAt)}–${hhmm(order.workEndedAt)}`
            : !order.workStartedAt && !order.workEndedAt ? '缺开始+结束'
            : !order.workEndedAt ? `${hhmm(order.workStartedAt)}–缺结束` : `缺开始–${hhmm(order.workEndedAt)}`}
        </span>
        <span className={`font-mono text-xs w-14 shrink-0 text-right ${
          hoursOdd ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
          {order.billedHours != null ? `${order.billedHours}h` : '—'}
        </span>
        <span className="text-xs text-gray-400 w-12 shrink-0 text-center">
          {order.paymentMethod === 'cash' ? '现金' : order.paymentMethod === 'transfer' ? '转账'
            : <span className="text-red-500 font-semibold">未标</span>}
        </span>

        <span className="font-mono text-sm text-gray-700 flex-1 text-right">{money(order.finalAmount)}</span>
      </button>

      {incomplete
        ? <span className="text-xs text-gray-400 w-20 text-right shrink-0">{order.status}</span>
        : nChanges > 0
          ? <span className="text-xs text-amber-600 w-20 text-right shrink-0 font-semibold">未保存</span>
        : checkedBy
          ? <span className="text-xs text-green-600 w-20 text-right shrink-0 font-semibold">已核对</span>
          : issues.length === 0
            ? <span className="text-xs text-gray-400 w-20 text-right shrink-0">待核对</span>
            : <span className={`flex items-center gap-1 text-xs w-20 justify-end shrink-0 ${high ? 'text-red-600' : 'text-amber-600'}`}>
                <AlertTriangle size={13} /> {issues.length} 项
              </span>}
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {issues.length > 0 && (
            <div className="my-3 space-y-1">
              {issues.map((i, n) => (
                <p key={n} className={`text-xs ${i.sev === 'high' ? 'text-red-600' : 'text-amber-600'}`}>
                  {i.sev === 'high' ? '🔴' : '🟠'} {i.text}
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1.5 items-center text-sm mt-3">
            <span />
            <span className="text-xs text-gray-400">系统现有</span>
            <span className="text-xs text-gray-400">
              核对后补录
              <span className="ml-2 text-amber-600">黄底 = 系统自动算的，可以改</span>
            </span>
            {RECONCILE_FIELDS.map(f => {
              const cur = order[f.key]
              const shown = f.type === 'time' ? hhmm(cur) : cur
              const empty = cur === null || cur === undefined || cur === ''
              return (
                <Fragment key={f.key}>
                  <span className="text-gray-600 whitespace-nowrap">
                    {f.label}
                    {DERIVED_FIELDS.includes(f.key) && (
                      <span className="text-gray-300 text-xs ml-1" title="改上面的值会自动算这一项">ƒ</span>
                    )}
                  </span>
                  <span className={`font-mono text-sm ${empty ? 'text-red-400' : 'text-gray-500'}`}>
                    {empty ? '— 未记录'
                      : f.type === 'qty' ? `${money(cur)}（${feeToQty(order, f.key, cur, b2b)} ${f.unit}）`
                      : f.type === 'money' ? money(cur) : String(shown)}
                  </span>
                  <div className="flex items-center gap-1.5">
                  <input
                    type={f.type === 'time' ? 'time' : 'number'}
                    // ⚠️ time 的 step 单位是【秒】，不是和 number 一样的「最小增量」。
                    //    写 0.01 的话浏览器会按 10 毫秒精度渲染，多出「秒」和「毫秒」两列 ——
                    //    记收工时间精确到毫秒是荒唐的。
                    step={f.type === 'time' ? 60 : f.type === 'qty' ? f.step : f.type === 'hours' ? '0.5' : '0.01'}
                    value={f.type === 'qty' ? (qty[f.key] ?? '')
                      : f.type === 'time' ? hhmmOf(draft[f.key] ?? '')
                      : (draft[f.key] ?? '')}
                    placeholder={f.type === 'qty' ? `几${f.unit}` : '不改就留空'}
                    onChange={e => edit(f.key, f.type === 'time'
                      ? composeDT(order, f.key, e.target.value, draft)
                      : e.target.value)}
                    className={`border rounded-lg px-2 py-1 text-sm font-mono w-full outline-none focus:border-red-400 ${
                      auto[f.key] ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}
                  />
                  {f.key === 'deposit' && (() => {
                    // 老板 10-11：「有=30，无=0，其他=手动填写」
                    // 不按 isB2BOrder 猜 —— 那个字段本来就有漏标的，猜错就算错钱
                    const cur = Number(draft.deposit ?? order.deposit ?? 0)
                    return (
                      <span className="flex items-center gap-1 shrink-0">
                        {[['30', '有 $30'], ['0', '无']].map(([v, l]) => (
                          <button key={v} onClick={() => edit('deposit', v)}
                            className={`text-xs rounded px-2 py-0.5 border whitespace-nowrap transition-colors ${
                              cur === Number(v)
                                ? 'border-red-400 bg-red-50 text-red-700 font-semibold'
                                : 'border-gray-200 text-gray-400 hover:text-gray-600'}`}>
                            {l}
                          </button>
                        ))}
                        <span className={`text-xs whitespace-nowrap ${
                          cur !== 0 && cur !== STANDARD_DEPOSIT ? 'text-red-700 font-semibold' : 'text-gray-300'}`}>
                          {cur !== 0 && cur !== STANDARD_DEPOSIT ? '其他' : '其他←左边框填'}
                        </span>
                      </span>
                    )
                  })()}
                  {f.type === 'qty' && (
                    <span className="text-xs text-gray-400 whitespace-nowrap w-28 shrink-0">
                      {qty[f.key]
                        ? `× $${unitPriceOf(order, f.key, b2b)} = ${money(draft[f.key])}`
                        : `$${unitPriceOf(order, f.key, b2b)}/${f.unit}`}
                    </span>
                  )}
                  </div>
                </Fragment>
              )
            })}
          </div>

          {/* 收款方式 —— 老板 10-11：「缺现金还是转账，转账有 GST 的」 */}
          <div className="flex items-center gap-3 mt-3 text-sm">
            <span className="text-gray-600 whitespace-nowrap">收款方式</span>
            <div className="flex gap-1.5">
              {[['cash', '现金'], ['transfer', '转账 +10% GST']].map(([val, label]) => {
                const on = (draft.paymentMethod ?? order.paymentMethod) === val
                return (
                  <button key={val} onClick={() => edit('paymentMethod', val)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      on ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}>
                    {label}
                  </button>
                )
              })}
            </div>
            {!order.paymentMethod && <span className="text-xs text-red-500">原来没标</span>}
          </div>

          {/* 账单怎么算出来的 —— Annie 手里拿着现金或流水，得看懂这个数的来路 */}
          {(() => {
            const b = breakdown(order, draft)
            return (
              <div className="mt-3 bg-gray-50 rounded-xl px-3 py-2.5 text-sm font-mono">
                <Line label="费用合计" value={money(b.fees)} />
                {b.van > 0 && <Line label="面包车优惠" value={`−${money(b.van)}`} />}
                <Line label={b.method === 'transfer' ? 'GST 10%' : 'GST（现金不收）'} value={money(b.gst)}
                  dim={b.gst === 0} />
                <Line label="定金" value={b.deposit ? `−${money(b.deposit)}` : money(0)} dim={!b.deposit} />
                <Line label="优惠" value={b.discount ? `−${money(b.discount)}` : money(0)} dim={!b.discount} />
                <div className="border-t border-gray-200 mt-1.5 pt-1.5">
                  <Line label="实收金额" value={money(b.total)} bold />
                </div>
              </div>
            )
          })()}

          {impact && (
            <div className="mt-3 bg-amber-50 rounded-xl px-3 py-2.5 text-sm">
              <p className="font-semibold text-amber-900 mb-1">这笔改动的影响</p>
              {impact.hours.from !== impact.hours.to && (
                <p className="text-amber-800">工时 {impact.hours.from} → {impact.hours.to} 小时</p>
              )}
              {impact.amount.from !== impact.amount.to && (
                <p className="text-amber-800">
                  金额 {money(impact.amount.from)} → {money(impact.amount.to)}
                  <strong className="ml-1">
                    ({impact.amount.to > impact.amount.from ? '+' : ''}{money(impact.amount.to - impact.amount.from)})
                  </strong>
                </p>
              )}
              {hoursWarn && (
                <p className="text-red-700 font-semibold mt-1.5 pt-1.5 border-t border-amber-200">
                  ⚠️ {hoursWarn}
                </p>
              )}
              {impact.wages.map(w => (
                <p key={w.id} className="text-amber-800">
                  {w.name} 工资 {w.delta > 0 ? '+' : ''}{money(w.delta)}
                </p>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="补录原因（会留痕）"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-red-400 outline-none" />
            <button
              disabled={!nChanges || disabled}
              onClick={() => onSave(changes, reason)}
              className={`rounded-lg text-white font-bold disabled:opacity-30 shrink-0 transition-all ${
                nChanges ? 'px-6 py-2.5 text-sm shadow-md' : 'px-4 py-2 text-sm'}`}
              style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
              {nChanges ? `保存这 ${nChanges} 项改动` : '保存'}
            </button>
          </div>
          {nChanges > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
              ⚠️ 上面黄底的数字还只是草稿，<strong>没点保存就不算数</strong> ——
              页面顶上的汇总和底下的「确认当日收入」都还是旧金额。
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            只能改时间和费用。状态、订单号、客户信息、派单信息改不了 —— 数据库层挡着。
          </p>
        </div>
      )}
    </div>
  )
}
