import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Clock, Truck, Users, ChevronRight, ChevronLeft } from 'lucide-react'
import dayjs from 'dayjs'

const WORKER_NAMES = {
  laomou: '老木', xiaoyu: '小宇', chenxi: '晨曦', laowang: '老王', xiaozhang: '小张',
}
const WORKERS = [
  { id: 'chenxi',    name: '晨曦', role: '司机' },
  { id: 'laowang',   name: '老王', role: '司机' },
  { id: 'xiaozhang', name: '小张', role: '司机' },
  { id: 'laomou',    name: '老木', role: '工人' },
  { id: 'xiaoyu',    name: '小宇', role: '工人' },
]
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export default function DispatchBoard() {
  const { orders, dispatchOrder } = useApp()
  const navigate = useNavigate()
  const today = dayjs().format('YYYY-MM-DD')

  const [viewMode, setViewMode]       = useState('day')   // 'day' | 'week' | 'month'
  const [selectedDate, setSelectedDate] = useState(today)
  const [dispatchTarget, setDispatchTarget] = useState(null)
  const [selectedWorkers, setSelectedWorkers] = useState([])

  // ── Helpers ────────────────────────────────────────────────
  function getDateOrders(date) {
    return orders
      .filter(o => o.date === date && o.status !== '已取消')
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
  }

  function getWorkerOrdersOnDate(workerId, date) {
    return orders.filter(o =>
      o.date === date &&
      (o.assignedTo === workerId || o.assignedWorkers?.includes(workerId))
    )
  }

  function isPending(o) { return !o.assignedTo && o.status !== '已完成' }

  // ── Day mode ───────────────────────────────────────────────
  const dayOrders   = getDateOrders(selectedDate)
  const undispatched = dayOrders.filter(isPending)
  const dispatched   = dayOrders.filter(o => !!o.assignedTo)

  const dateLabel =
    selectedDate === today                                   ? '今天' :
    selectedDate === dayjs().add(1,'day').format('YYYY-MM-DD') ? '明天' :
    selectedDate === dayjs().subtract(1,'day').format('YYYY-MM-DD') ? '昨天' :
    dayjs(selectedDate).format('M月D日')

  // ── Multi-day mode ─────────────────────────────────────────
  const rangeDays = viewMode === 'week' ? 7 : viewMode === 'month' ? 30 : 0
  const multiGroups = Array.from({ length: rangeDays }, (_, i) => {
    const date = dayjs().add(i, 'day').format('YYYY-MM-DD')
    const os   = getDateOrders(date)
    return { date, orders: os, pending: os.filter(isPending).length }
  }).filter(g => g.orders.length > 0)

  const totalPending =
    viewMode === 'day'
      ? undispatched.length
      : multiGroups.reduce((s, g) => s + g.pending, 0)

  // ── Dispatch modal ─────────────────────────────────────────
  function openDispatch(order) {
    setDispatchTarget(order)
    setSelectedWorkers(
      order.assignedWorkers?.length ? order.assignedWorkers :
      order.assignedTo ? [order.assignedTo] : []
    )
  }
  function toggleWorker(id) {
    setSelectedWorkers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }
  function handleConfirmDispatch() {
    if (!selectedWorkers.length) return
    dispatchOrder(dispatchTarget.id, selectedWorkers)
    setDispatchTarget(null)
    setSelectedWorkers([])
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="p-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">派单管理</h1>
          {totalPending > 0
            ? <p className="text-red-500 text-sm mt-0.5 font-medium">⚠ {totalPending} 单待派</p>
            : <p className="text-gray-400 text-sm mt-0.5">全部已派</p>
          }
        </div>
        {/* View mode switcher */}
        <div className="flex bg-white rounded-xl shadow-sm p-1 gap-0.5">
          {[['day','单日'],['week','本周']].map(([m, label]) => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === m ? 'text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'
              }`}
              style={viewMode === m ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Single-day controls ── */}
      {viewMode === 'day' && (
        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => setSelectedDate(dayjs(selectedDate).subtract(1,'day').format('YYYY-MM-DD'))}
            className="p-2 bg-white rounded-xl shadow-sm hover:bg-gray-50 text-gray-500 flex-shrink-0">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 bg-white rounded-xl shadow-sm px-4 py-2.5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800 text-sm">{dateLabel}</p>
              <p className="text-gray-400 text-xs mt-0.5">
                {dayjs(selectedDate).format('YYYY-MM-DD')} {WEEKDAYS[dayjs(selectedDate).day()]}
              </p>
            </div>
            <input type="date" value={selectedDate}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              className="text-xs text-red-600 font-semibold bg-red-50 border-0 rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>
          <button onClick={() => setSelectedDate(dayjs(selectedDate).add(1,'day').format('YYYY-MM-DD'))}
            className="p-2 bg-white rounded-xl shadow-sm hover:bg-gray-50 text-gray-500 flex-shrink-0">
            <ChevronRight size={18} />
          </button>
          {selectedDate !== today && (
            <button onClick={() => setSelectedDate(today)}
              className="flex-shrink-0 px-3 py-2 bg-white rounded-xl shadow-sm text-xs font-semibold text-red-600 hover:bg-red-50">
              今天
            </button>
          )}
        </div>
      )}

      {/* ── Single-day view ── */}
      {viewMode === 'day' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {dayOrders.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                <p className="text-gray-300 text-4xl mb-3">📋</p>
                <p className="text-gray-400 font-medium">当天暂无订单</p>
              </div>
            ) : (
              <div className="space-y-4">
                {undispatched.length > 0 && (
                  <div>
                    <SectionLabel color="red" text={`待派单（${undispatched.length}）`} />
                    <div className="space-y-2">
                      {undispatched.map(o => (
                        <OrderCard key={o.id} order={o}
                          onDispatch={() => openDispatch(o)}
                          onClick={() => navigate(`/admin/orders/${o.id}`)} />
                      ))}
                    </div>
                  </div>
                )}
                {dispatched.length > 0 && (
                  <div>
                    <SectionLabel color="gray" text={`已派单（${dispatched.length}）`} />
                    <div className="space-y-2">
                      {dispatched.map(o => (
                        <OrderCard key={o.id} order={o}
                          onDispatch={() => openDispatch(o)}
                          onClick={() => navigate(`/admin/orders/${o.id}`)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Worker panel */}
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2 px-1">师傅出勤情况</p>
            <div className="space-y-2">
              {WORKERS.map(w => {
                const wOrders = getWorkerOrdersOnDate(w.id, selectedDate)
                return (
                  <div key={w.id} className="bg-white rounded-xl px-3 py-3 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm flex-shrink-0">
                        {w.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-gray-800">{w.name}</span>
                          <span className="text-xs text-gray-400">{w.role}</span>
                        </div>
                        {wOrders.length > 0
                          ? <p className="text-xs text-gray-500 mt-0.5 truncate">{wOrders.map(o => o.startTime || '?').join(' / ')}</p>
                          : <p className="text-xs text-green-500 mt-0.5">空闲</p>
                        }
                      </div>
                      {wOrders.length > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold">
                          {wOrders.length}单
                        </span>
                      )}
                    </div>
                    {wOrders.length > 0 && (
                      <div className="mt-2 space-y-1 pl-10">
                        {wOrders.map(o => (
                          <div key={o.id} className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Clock size={10} />
                            <span>{o.startTime || '—'}</span>
                            <span className="truncate text-gray-600">{o.customerName}</span>
                            {o.assignedTo === w.id && <span className="text-red-400 ml-auto">主带</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Multi-day view (week / month) ── */}
      {viewMode !== 'day' && (
        <div className="space-y-4">
          {multiGroups.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm">
              <p className="text-gray-300 text-4xl mb-3">📋</p>
              <p className="text-gray-400 font-medium">
                {viewMode === 'week' ? '未来7天' : '未来30天'}暂无订单
              </p>
            </div>
          ) : multiGroups.map(({ date, orders: os, pending }) => {
            const isToday = date === today
            const dateD = dayjs(date)
            return (
              <div key={date}>
                {/* Date header */}
                <div className={`flex items-center gap-2 mb-2 px-1`}>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                    isToday ? 'bg-red-800 text-white' :
                    pending > 0 ? 'bg-red-50' : 'bg-gray-100'
                  }`}>
                    <span className={`font-semibold text-sm ${
                      isToday ? 'text-white' : pending > 0 ? 'text-red-700' : 'text-gray-600'
                    }`}>
                      {isToday ? '今天 · ' : ''}{dateD.format('M月D日')} {WEEKDAYS[dateD.day()]}
                    </span>
                    {pending > 0 && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                        isToday ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'
                      }`}>
                        {pending}待派
                      </span>
                    )}
                    {pending === 0 && (
                      <span className="text-xs text-gray-400">全部已派</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-300">{os.length}单</span>
                </div>
                <div className="space-y-2 mb-1">
                  {os.map(o => (
                    <OrderCard key={o.id} order={o}
                      onDispatch={() => openDispatch(o)}
                      onClick={() => navigate(`/admin/orders/${o.id}`)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Dispatch modal ── */}
      {dispatchTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{dispatchTarget.assignedTo ? '改派' : '派单'}</h3>
              <button onClick={() => setDispatchTarget(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-5 py-4">
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 mb-4">
                <p className="text-sm font-semibold text-gray-800">{dispatchTarget.customerName}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>{dispatchTarget.date} {dispatchTarget.startTime}</span>
                  <span>{dispatchTarget.vehicle}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-2">选择顺序即排名，第1位为主带师傅</p>
              <div className="space-y-2 mb-4">
                {WORKERS.map(w => {
                  const sel = selectedWorkers.includes(w.id)
                  const pos = selectedWorkers.indexOf(w.id)
                  const dayLoad = getWorkerOrdersOnDate(w.id, dispatchTarget.date)
                    .filter(o => o.id !== dispatchTarget.id)
                  return (
                    <button key={w.id} onClick={() => toggleWorker(w.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-colors ${
                        sel ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        sel ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {sel ? pos + 1 : ''}
                      </div>
                      <div className="flex-1 text-left">
                        <span className={`font-semibold text-sm ${sel ? 'text-red-700' : 'text-gray-700'}`}>{w.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{w.role}</span>
                        {dayLoad.length > 0 && (
                          <span className="ml-2 text-xs text-amber-500">当天已有{dayLoad.length}单</span>
                        )}
                      </div>
                      {sel && (
                        <span className={`text-xs flex-shrink-0 ${pos === 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {pos === 0 ? '主带' : '随行'}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <button onClick={handleConfirmDispatch} disabled={!selectedWorkers.length}
                className="w-full py-3 rounded-xl text-white font-semibold disabled:opacity-40 text-sm"
                style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
                {selectedWorkers.length > 0
                  ? `确认派单：${selectedWorkers.map(id => WORKER_NAMES[id]).join('、')}`
                  : '请选择师傅'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────
function SectionLabel({ color, text }) {
  const dot = color === 'red' ? 'bg-red-500' : 'bg-gray-300'
  const txt = color === 'red' ? 'text-red-500' : 'text-gray-400'
  return (
    <p className={`text-xs font-semibold ${txt} mb-2 px-1 flex items-center gap-1`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} inline-block`} />
      {text}
    </p>
  )
}

function OrderCard({ order: o, onDispatch, onClick }) {
  const dispatched  = !!o.assignedTo
  const workerNames = (o.assignedWorkers || []).map(id => WORKER_NAMES[id] || id)
  const primaryName = o.assignedTo ? (WORKER_NAMES[o.assignedTo] || o.assignedTo) : null

  return (
    <div onClick={onClick}
      className="bg-white rounded-xl px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{o.customerName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              dispatched ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'
            }`}>
              {dispatched ? '已派单' : '待派单'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
            {o.startTime && <span className="flex items-center gap-0.5"><Clock size={11} />{o.startTime}</span>}
            {o.vehicle   && <span className="flex items-center gap-0.5"><Truck size={11} />{o.vehicle}</span>}
            {dispatched && workerNames.length > 0 && (
              <span className="flex items-center gap-0.5 text-blue-500">
                <Users size={11} />
                {primaryName}{workerNames.length > 1 && ` +${workerNames.length - 1}人`}
              </span>
            )}
          </div>
          {o.fromAddress && <p className="text-xs text-gray-300 mt-1 truncate">{o.fromAddress}</p>}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onDispatch() }}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${
              dispatched ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'text-white shadow-sm'
            }`}
            style={!dispatched ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}>
            {dispatched ? '改派' : '派单'}
          </button>
          <ChevronRight size={14} className="text-gray-300" />
        </div>
      </div>
    </div>
  )
}
