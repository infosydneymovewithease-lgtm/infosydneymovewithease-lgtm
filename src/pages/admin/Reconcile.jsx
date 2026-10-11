// 每日对账工作台 —— 2026-10-12 第 4 步
//
// Annie 的真实工作流（老板 10-11 描述）：
//   师傅干完活 → 在微信里报给 Annie → Annie 打开这一页逐单对
//   → 对不上当场补 → 全部对完确认当日收入
//
// 关键：这一页必须能直接改，不能只读。
// 否则她要为每单跳进订单详情页改一遍 —— 一半订单有问题，一天得跳几十次。

import { useState, useEffect, useMemo, Fragment } from 'react'
import { useApp } from '../../context/AppContext'
import { sydneyToday, addDays } from '../../utils/date'
import {
  vehicleMedians, detectIssues, impactOf, daySummary, participants, RECONCILE_FIELDS,
} from '../../utils/reconcile'
import {
  ChevronLeft, ChevronRight, Check, AlertTriangle, Undo2, Lock, Unlock, History,
} from 'lucide-react'

const money = n => `$${(Number(n) || 0).toFixed(2)}`
const hhmm = iso => iso
  ? new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  : null

// ⚠️ datetime-local 给的是【浏览器本地墙上时间】，没有时区信息。
// Annie 在国内，直接把 '2026-10-11T10:30' 送进 timestamptz 列会被当成 UTC —— 差 8 小时。
// 存库前一律转成带时区的 ISO；比对时也两边都转，否则 'T10:30' 和 ISO 串永远不相等，
// 会把「没改」判成「改了」，白写一条补录日志。
const toISO = v => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export default function Reconcile() {
  const { orders, staffRates, staff, reconcileOrder, undoReconcile, closeDay, reopenDay, getReconcile } = useApp()
  const [date, setDate] = useState(() => sydneyToday())
  const [close, setClose] = useState(null)
  const [logs, setLogs] = useState([])
  const [openId, setOpenId] = useState(null)
  const [showLogs, setShowLogs] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const medians = useMemo(() => vehicleMedians(orders), [orders])
  const dayOrders = useMemo(
    () => orders.filter(o => o.date === date).sort((a, b) => (a.orderNo || '').localeCompare(b.orderNo || '')),
    [orders, date])
  const done = dayOrders.filter(o => o.status === '已完成')
  const sum = useMemo(() => daySummary(dayOrders, staffRates), [dayOrders, staffRates])

  const issuesBy = useMemo(() => Object.fromEntries(
    done.map(o => [o.id, detectIssues(o, { medians, staffRates })])), [done, medians, staffRates])
  const clean = done.filter(o => !issuesBy[o.id]?.length).length

  async function refresh(d = date) {
    const r = await getReconcile(d)
    setClose(r.close); setLogs(r.logs)
  }

  // 换日期就重拉日结状态和补录记录。
  // alive 守卫：快速连点日期箭头时，先发出的请求可能后返回，
  // 没有这个守卫会用旧日期的数据覆盖新日期的。
  useEffect(() => {
    let alive = true
    ;(async () => {
      const r = await getReconcile(date)
      if (alive) { setClose(r.close); setLogs(r.logs) }
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

      {err && <p className="text-red-600 text-sm font-medium mb-3">{err}</p>}

      {/* 进度 + 汇总 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">
            {done.length === 0 ? '这天没有已完成的订单' : `${clean} / ${done.length} 单没有待处理问题`}
          </span>
          {confirmed
            ? <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-lg">
                <Lock size={12} /> 已确认
              </span>
            : <span className="text-xs text-gray-400">未确认</span>}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${done.length ? (clean / done.length) * 100 : 0}%`,
                     background: 'linear-gradient(90deg,#6b1414,#c0392b)' }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <Stat label="应收" value={money(sum.due)} />
          <Stat label="已收" value={money(sum.paid)} good />
          <Stat label="未收" value={money(sum.unpaid)} warn={sum.unpaid > 0} />
          <Stat label="工资支出" value={money(sum.wages)} />
        </div>
      </div>

      {/* 订单 */}
      <div className="space-y-2">
        {dayOrders.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">这一天没有订单</p>
        )}
        {dayOrders.map(o => (
          <OrderRow key={`${o.id}:${openId === o.id}`} order={o}
            issues={issuesBy[o.id] || []}
            staffRates={staffRates} staff={staff}
            open={openId === o.id} onToggle={() => setOpenId(openId === o.id ? null : o.id)}
            disabled={busy}
            onSave={(changes, reason) => run(() => reconcileOrder(o.id, date, changes, reason))} />
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
                  {' '}{new Date(close.confirmed_at).toLocaleString('zh-CN', { hour12: false })}
                </p>
              </div>
              <button disabled={busy} onClick={() => run(() => reopenDay(date))}
                className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50 disabled:opacity-40">
                <Unlock size={14} /> 撤销确认
              </button>
            </div>
          ) : (
            <>
              <button disabled={busy} onClick={() => run(() => closeDay(date))}
                className="w-full text-white font-bold py-3 rounded-xl disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
                确认当日收入 {money(sum.due)}
              </button>
              {clean < done.length && (
                <p className="text-xs text-amber-600 mt-2 text-center">
                  还有 {done.length - clean} 单有待处理问题 —— 确认之前最好先处理完
                </p>
              )}
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
                    {new Date(l.changed_at).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
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

function Stat({ label, value, good, warn }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`font-mono font-bold text-base mt-0.5 ${
        warn ? 'text-red-600' : good ? 'text-green-600' : 'text-gray-800'}`}>{value}</p>
    </div>
  )
}

// key 里带了 open 状态 —— 开合时组件重新挂载，草稿自然清空。
// 比用 effect 清 state 干净：没有「渲染完再 setState」那一拍级联渲染。
function OrderRow({ order, issues, staffRates, staff, open, onToggle, onSave, disabled }) {
  const [draft, setDraft] = useState({})
  const [reason, setReason] = useState('师傅微信确认')

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
        return isTime ? v !== cur : String(v ?? '') !== String(cur ?? '')
      }))
  const nChanges = Object.keys(changes).length
  const impact = nChanges ? impactOf(order, changes, staffRates) : null

  return (
    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden ${incomplete ? 'opacity-50' : ''}`}>
      <button onClick={incomplete ? undefined : onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 disabled:cursor-default"
        disabled={incomplete}>
        <span className="font-mono text-sm font-semibold text-gray-700 w-24 shrink-0">
          {order.orderNo || order.id.slice(-6)}
        </span>
        <span className="text-sm text-gray-600 flex-1 min-w-0 truncate">
          {order.customerName} · {order.vehicle}
          <span className="text-gray-400 ml-2">
            {participants(order).map(id => staff.find(s => s.id === id)?.name || id).join('/')}
          </span>
        </span>
        <span className="font-mono text-sm text-gray-700 shrink-0">{money(order.finalAmount)}</span>
        {incomplete
          ? <span className="text-xs text-gray-400 w-20 text-right shrink-0">{order.status}</span>
          : issues.length === 0
            ? <span className="flex items-center gap-1 text-xs text-green-600 w-20 justify-end shrink-0"><Check size={14} /> 无问题</span>
            : <span className={`flex items-center gap-1 text-xs w-20 justify-end shrink-0 ${high ? 'text-red-600' : 'text-amber-600'}`}>
                <AlertTriangle size={13} /> {issues.length} 项
              </span>}
      </button>

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
            <span className="text-xs text-gray-400">核对后补录</span>
            {RECONCILE_FIELDS.map(f => {
              const cur = order[f.key]
              const shown = f.type === 'time' ? hhmm(cur) : cur
              const empty = cur === null || cur === undefined || cur === ''
              return (
                <Fragment key={f.key}>
                  <span className="text-gray-600 whitespace-nowrap">{f.label}</span>
                  <span className={`font-mono text-sm ${empty ? 'text-red-400' : 'text-gray-500'}`}>
                    {empty ? '— 未记录' : f.type === 'money' ? money(cur) : String(shown)}
                  </span>
                  <input
                    type={f.type === 'time' ? 'datetime-local' : 'number'}
                    step={f.type === 'hours' ? '0.5' : '0.01'}
                    value={draft[f.key] ?? ''}
                    placeholder="不改就留空"
                    onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-sm font-mono w-full focus:border-red-400 outline-none"
                  />
                </Fragment>
              )
            })}
          </div>

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
              className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-30 shrink-0"
              style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>
              保存 {nChanges ? `(${nChanges} 项)` : ''}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            只能改时间和费用。状态、订单号、客户信息、派单信息改不了 —— 数据库层挡着。
          </p>
        </div>
      )}
    </div>
  )
}
