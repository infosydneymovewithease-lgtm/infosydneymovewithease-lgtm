import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { ArrowLeft, Search, ClipboardList, CheckCircle } from 'lucide-react'
import dayjs from 'dayjs'

const TYPE_BADGE = {
  '搬家':    { label: '🚚 搬家',   cls: 'bg-blue-50 text-blue-600' },
  'IKEA':    { label: '🛒 IKEA',  cls: 'bg-yellow-50 text-yellow-700' },
  '清洁':    { label: '🧹 清洁',   cls: 'bg-teal-50 text-teal-600' },
  '清洁服务': { label: '🧹 清洁',  cls: 'bg-teal-50 text-teal-600' },
  '家具组装': { label: '🔧 组装',  cls: 'bg-orange-50 text-orange-600' },
  '寄存':    { label: '📦 寄存',   cls: 'bg-purple-50 text-purple-600' },
  '其他':    { label: '📋 其他',   cls: 'bg-gray-100 text-gray-500' },
}

export default function WorkerHistory() {
  const { getMyOrders, getMyStorageOrders } = useApp()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')

  // Combine completed orders + completed storage
  const allCompleted = useMemo(() => {
    const orders = getMyOrders()
      .filter(o => o.status === '已完成')
      .map(o => ({ ...o, _kind: 'order' }))
    const storage = getMyStorageOrders()
      .filter(o => o.status === '寄存中')
      .map(o => ({ ...o, _kind: 'storage', date: o.moveInDate || o.date }))
    return [...orders, ...storage].sort((a, b) =>
      (b.date || '').localeCompare(a.date || '')
    )
  }, [getMyOrders, getMyStorageOrders])

  // Distinct months for filter
  const months = useMemo(() => {
    const set = new Set(allCompleted.map(o => (o.date || '').slice(0, 7)).filter(Boolean))
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [allCompleted])

  const q = search.toLowerCase().trim()
  const filtered = allCompleted.filter(o => {
    if (selectedMonth && !(o.date || '').startsWith(selectedMonth)) return false
    if (!q) return true
    return (
      o.customerName?.toLowerCase().includes(q) ||
      o.id?.toLowerCase().includes(q) ||
      o.fromAddress?.toLowerCase().includes(q) ||
      o.toAddress?.toLowerCase().includes(q) ||
      o.customerPhone?.includes(q)
    )
  })

  // Group by year-month for display
  const grouped = useMemo(() => {
    const g = {}
    filtered.forEach(o => {
      const ym = (o.date || '').slice(0, 7) || '未知日期'
      if (!g[ym]) g[ym] = []
      g[ym].push(o)
    })
    return g
  }, [filtered])

  function formatMonth(ym) {
    if (ym === '未知日期') return ym
    const [y, m] = ym.split('-')
    return `${y}年${parseInt(m)}月`
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-8">
      {/* Header */}
      <div className="px-4 pt-12 pb-5 md:pt-8 shadow-sm"
        style={{ background: 'linear-gradient(135deg, #6b1414 0%, #9b1c1c 50%, #c0392b 100%)' }}>
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-red-200">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-white font-bold text-lg">历史订单</h1>
            <p className="text-red-300 text-xs">
              {allCompleted.length} 单已完成 · 按服务日期倒序
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-4">

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索客户名、手机号、订单号、地址..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200"
          />
        </div>

        {/* Month filter */}
        {months.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm px-4 pt-3 pb-3">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">按月筛选</span>
              {selectedMonth && (
                <button onClick={() => setSelectedMonth('')}
                  className="text-xs text-red-500 hover:text-red-700 font-medium">
                  ✕ 清除
                </button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              <button
                onClick={() => setSelectedMonth('')}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  !selectedMonth ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                style={!selectedMonth ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}>
                全部 <span className="ml-1 opacity-70">{allCompleted.length}</span>
              </button>
              {months.map(m => {
                const cnt = allCompleted.filter(o => (o.date || '').startsWith(m)).length
                const active = selectedMonth === m
                return (
                  <button key={m} onClick={() => setSelectedMonth(m)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      active ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                    style={active ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}>
                    {formatMonth(m)}
                    <span className={`ml-1.5 ${active ? 'opacity-70' : 'text-gray-400'}`}>{cnt}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <ClipboardList size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 font-medium">
              {allCompleted.length === 0 ? '暂无历史订单' : '没有符合条件的订单'}
            </p>
            {allCompleted.length === 0 && (
              <p className="text-gray-300 text-sm mt-1">完成第一单后会出现在这里</p>
            )}
          </div>
        ) : (
          Object.entries(grouped).map(([ym, list]) => (
            <div key={ym}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-sm font-bold text-gray-700">{formatMonth(ym)}</span>
                <span className="text-xs text-gray-400">{list.length} 单</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {list.map(o => (
                  <HistoryCard
                    key={o.id}
                    order={o}
                    onClick={() => navigate(o._kind === 'storage' ? `/storage/${o.id}` : `/order/${o.id}`)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function HistoryCard({ order, onClick }) {
  const isStorage = order._kind === 'storage'
  const typeBadge = isStorage ? TYPE_BADGE['寄存'] : TYPE_BADGE[order.serviceType]

  return (
    <button onClick={onClick}
      className="w-full bg-white rounded-xl p-4 text-left shadow-sm hover:shadow-md transition-shadow active:opacity-70">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        {typeBadge && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${typeBadge.cls}`}>
            {typeBadge.label}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
          <CheckCircle size={12} />&nbsp;{order.status}
        </span>
      </div>
      <p className="text-gray-900 font-bold text-base truncate">{order.customerName}</p>
      {!isStorage && order.fromAddress && (
        <p className="text-gray-400 text-sm mt-0.5 truncate">{order.fromAddress}</p>
      )}
      {isStorage && (
        <p className="text-gray-400 text-sm mt-0.5">
          纸箱 {order.boxes || 0} 件{order.furniture > 0 ? ` · 家具 ${order.furniture} 件` : ''}
        </p>
      )}
      <div className="flex items-center gap-3 mt-2">
        {order.vehicle && !isStorage && (
          <span className="text-sm font-semibold px-2 py-0.5 rounded-md"
            style={{ color: '#8B1A1A', background: '#fef2f2' }}>
            {order.vehicle}
          </span>
        )}
        <span className="text-gray-400 text-xs">
          {order.date} {!isStorage && order.startTime}
        </span>
        {!isStorage && order.finalAmount > 0 && (
          <span className="text-green-600 text-sm font-bold ml-auto">
            ${order.finalAmount}
          </span>
        )}
      </div>
    </button>
  )
}
