import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react'
import dayjs from 'dayjs'

// ── Worker config ──────────────────────────────────────────────
const WORKERS = {
  laomou:    { name: '老木',  isDriver: false, fixedRate: 33 },
  xiaoyu:    { name: '小宇',  isDriver: false, fixedRate: 30 },
  chenxi:    { name: '晨曦',  isDriver: true,  fixedRate: 33 },
  laowang:   { name: '老王',  isDriver: true,  fixedRate: 33 },
  xiaozhang: { name: '小张',  isDriver: true,  fixedRate: 33 },
}

const DRIVER_VEHICLE_RATE = {
  '大卡车': 40, '大卡三人': 40,
  '小卡车': 37, '小卡三人': 37, '卡车单人': 37,
  '面包车': 34,
  '双卡车': 37,
}

function getHourlyRate(workerId, isDriverRole, vehicle) {
  const w = WORKERS[workerId]
  if (!w) return 33
  if (w.isDriver && isDriverRole && vehicle) {
    return DRIVER_VEHICLE_RATE[vehicle] ?? w.fixedRate
  }
  return w.fixedRate
}

function calcWorkerWage(order, workerId) {
  if (!order.billedHours) return null
  const isDriver = order.assignedTo === workerId
  const workers = order.assignedWorkers?.length || 1
  const rate = getHourlyRate(workerId, isDriver, isDriver ? order.vehicle : null)
  const basePay = Math.round(rate * order.billedHours * 100) / 100

  // 楼梯费＋加班费：工人平分，公司不拿
  const stairOvertime = (order.stairFee || 0) + (order.overtimeFee || 0)
  const stairShare = stairOvertime > 0 ? Math.round(stairOvertime / workers * 100) / 100 : 0

  // 重物费＋易碎费：工人＋公司平分（公司算1份）
  const heavyFragile = (order.heavyFee || 0) + (order.fragileEstimatedFee || 0)
  const heavyShare = heavyFragile > 0 ? Math.round(heavyFragile / (workers + 1) * 100) / 100 : 0

  return {
    rate, isDriver, workers,
    basePay,
    stairShare,
    heavyShare,
    stairOvertime,
    heavyFragile,
    total: Math.round((basePay + stairShare + heavyShare) * 100) / 100,
  }
}

// ── Period helpers ─────────────────────────────────────────────
function weekBounds(weeksAgo = 0) {
  const ref = dayjs().subtract(weeksAgo * 7, 'day')
  const dow = ref.day()
  const monday = ref.subtract(dow === 0 ? 6 : dow - 1, 'day').startOf('day')
  return { start: monday, end: monday.add(6, 'day').endOf('day') }
}

const TABS = [
  { key: 'thisWeek',  label: '本周' },
  { key: 'lastWeek',  label: '上周' },
  { key: 'thisMonth', label: '本月' },
  { key: 'all',       label: '全部' },
]

// ── Component ──────────────────────────────────────────────────
export default function WageRecords() {
  const { orders } = useApp()
  const [tab, setTab] = useState('thisWeek')
  const [expanded, setExpanded] = useState({})

  function toggle(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Filter to completed orders in period
  const range =
    tab === 'thisWeek'  ? weekBounds(0) :
    tab === 'lastWeek'  ? weekBounds(1) :
    tab === 'thisMonth' ? { start: dayjs().startOf('month'), end: dayjs().endOf('month') } :
    null

  const completed = orders.filter(o => {
    if (o.status !== '已完成') return false
    if (!range) return true
    const d = dayjs(o.completedAt || o.date)
    return !d.isBefore(range.start) && !d.isAfter(range.end)
  })

  // Build per-worker summaries
  const workerRows = Object.entries(WORKERS).map(([id, info]) => {
    const myOrders = completed.filter(o =>
      o.assignedTo === id || o.assignedWorkers?.includes(id)
    )
    const details = myOrders
      .map(o => ({ order: o, wage: calcWorkerWage(o, id) }))
      .filter(x => x.wage !== null)
    const missingData = myOrders.filter(o => !o.billedHours)
    const total = details.reduce((s, x) => s + x.wage.total, 0)
    return { id, ...info, details, missingData, total: Math.round(total * 100) / 100 }
  }).filter(w => w.details.length > 0 || w.missingData.length > 0)

  const grandTotal = workerRows.reduce((s, w) => s + w.total, 0)
  const orderCount = completed.filter(o =>
    o.assignedWorkers?.length || o.assignedTo
  ).length

  const rangeLabel = range
    ? `${range.start.format('MM/DD')} – ${range.end.format('MM/DD')}`
    : '全部时间'

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">工资结算</h1>
        <p className="text-gray-400 text-sm mt-0.5">{rangeLabel}</p>
      </div>

      {/* Period tabs */}
      <div className="flex gap-1.5 mb-4">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
            style={tab === t.key ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-gray-400 text-xs mb-1">发放合计</p>
          <p className="text-2xl font-bold text-green-600">${grandTotal.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-gray-400 text-xs mb-1">已完成订单</p>
          <p className="text-2xl font-bold text-gray-800">{orderCount} 单</p>
        </div>
      </div>

      {/* Worker list */}
      {workerRows.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <p className="text-gray-300 text-4xl mb-3">💰</p>
          <p className="text-gray-400 font-medium">该时段暂无已完成订单</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workerRows.map(w => (
            <div key={w.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Worker header row */}
              <button
                onClick={() => toggle(w.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm flex-shrink-0">
                  {w.name[0]}
                </div>
                <div className="flex-1 text-left">
                  <span className="font-semibold text-gray-900">{w.name}</span>
                  <span className="text-gray-400 text-xs ml-2">{w.details.length} 单</span>
                  {w.missingData.length > 0 && (
                    <span className="ml-2 text-xs text-amber-500 flex-inline items-center gap-0.5">
                      ⚠ {w.missingData.length}单缺数据
                    </span>
                  )}
                </div>
                <span className="text-green-600 font-bold text-lg">${w.total.toFixed(2)}</span>
                {expanded[w.id]
                  ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                  : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                }
              </button>

              {/* Expanded order breakdown */}
              {expanded[w.id] && (
                <div className="border-t border-gray-100">
                  {w.details.map(({ order: o, wage }) => (
                    <div key={o.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
                      {/* Order header */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <span className="text-xs text-gray-400">{o.date}</span>
                          <span className="mx-1.5 text-gray-200">·</span>
                          <span className="text-sm font-medium text-gray-800">{o.customerName}</span>
                          {wage.isDriver && o.vehicle && (
                            <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                              {o.vehicle}
                            </span>
                          )}
                        </div>
                        <span className="text-green-600 font-semibold">${wage.total.toFixed(2)}</span>
                      </div>
                      {/* Fee breakdown */}
                      <div className="text-xs text-gray-400 space-y-0.5 pl-0.5">
                        <div className="flex justify-between">
                          <span>{o.billedHours}h × ${wage.rate}/h</span>
                          <span className="text-gray-600">${wage.basePay.toFixed(2)}</span>
                        </div>
                        {wage.stairShare > 0 && (
                          <div className="flex justify-between">
                            <span>楼梯/加班 ${wage.stairOvertime} ÷ {wage.workers}人</span>
                            <span className="text-blue-500">+${wage.stairShare.toFixed(2)}</span>
                          </div>
                        )}
                        {wage.heavyShare > 0 && (
                          <div className="flex justify-between">
                            <span>重物/易碎 ${wage.heavyFragile} ÷ {wage.workers + 1}份</span>
                            <span className="text-blue-500">+${wage.heavyShare.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Orders missing billedHours */}
                  {w.missingData.map(o => (
                    <div key={o.id}
                      className="px-4 py-3 border-b border-gray-50 last:border-0 flex items-center gap-2">
                      <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
                      <span className="text-xs text-gray-400">{o.date} · {o.customerName}</span>
                      <span className="ml-auto text-xs text-amber-500">缺计费工时</span>
                    </div>
                  ))}

                  {/* Worker subtotal */}
                  <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
                    <span className="text-sm text-gray-500 font-medium">{w.name} 合计</span>
                    <span className="text-green-600 font-bold">${w.total.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rate reference */}
      <div className="mt-5 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">时薪参考</h3>
        </div>
        <div className="px-4 py-3 space-y-1.5 text-xs text-gray-500">
          <div className="flex justify-between"><span>老木</span><span className="font-medium text-gray-700">$33/h（固定）</span></div>
          <div className="flex justify-between"><span>小宇</span><span className="font-medium text-gray-700">$30/h（固定）</span></div>
          <div className="flex justify-between"><span>晨曦 / 老王</span><span className="font-medium text-gray-700">司机：大卡$40 小卡$37 面包$34 / 工人$33</span></div>
          <div className="flex justify-between"><span>小张</span><span className="font-medium text-gray-700">司机：小卡$37 面包$34 / 工人$33</span></div>
          <div className="mt-2 pt-2 border-t border-gray-100 text-gray-400 space-y-0.5">
            <p>楼梯/加班：全员平分，公司不拿</p>
            <p>重物/易碎：全员＋公司平分（公司算1份）</p>
          </div>
        </div>
      </div>
    </div>
  )
}
