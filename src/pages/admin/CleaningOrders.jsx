import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Search, Sparkles } from 'lucide-react'

const STATUS_TABS = [
  { value: 'all',   label: '全部' },
  { value: '待确认', label: '待确认' },
  { value: '已确认', label: '已确认' },
  { value: '已完成', label: '已完成' },
  { value: '已取消', label: '已取消' },
]

const STATUS_COLOR = {
  '待确认': 'bg-yellow-100 text-yellow-700',
  '已确认': 'bg-blue-100 text-blue-700',
  '师傅已确认': 'bg-blue-100 text-blue-700',
  '已派单': 'bg-purple-100 text-purple-700',
  '进行中': 'bg-orange-100 text-orange-700',
  '已完成': 'bg-green-100 text-green-700',
  '已取消': 'bg-red-50 text-red-400',
}

const CLEAN_TYPE_ICON = {
  vacate:   '🏠',
  move_in:  '✨',
  regular:  '🧹',
  carpet:   '🪣',
}

function getSuburb(address) {
  if (!address) return null
  const match = address.match(/,\s*([A-Za-z\s]+?)\s+(?:NSW|VIC|QLD|SA|WA|ACT|TAS|NT)\b/i)
  if (match) return match[1].trim()
  const parts = address.split(',')
  const last = parts[parts.length - 1]?.trim()
  return last ? last.replace(/\s+\d{4}$/, '').replace(/\s+(NSW|VIC|QLD|SA|WA|ACT|TAS|NT)\b.*/i, '').trim() : null
}

function fmtDate(dateStr, timeStr) {
  if (!dateStr) return null
  const [, m, d] = dateStr.split('-')
  const label = `${parseInt(m, 10)}月${parseInt(d, 10)}日`
  return timeStr ? `${label} ${timeStr}` : label
}

export default function CleaningOrders() {
  const { orders, updateOrderStatus } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')

  const cleanOrders = orders.filter(o => o.serviceType === '清洁')

  const pendingCount   = cleanOrders.filter(o => o.status === '待确认').length
  const confirmedCount = cleanOrders.filter(o => ['已确认', '师傅已确认', '已派单', '进行中'].includes(o.status)).length
  const completedCount = cleanOrders.filter(o => o.status === '已完成').length

  const tabCounts = {}
  cleanOrders.forEach(o => {
    const bucket = ['已确认','师傅已确认','已派单','进行中'].includes(o.status) ? '已确认' : o.status
    tabCounts[bucket] = (tabCounts[bucket] || 0) + 1
  })

  const q = search.toLowerCase()
  const filtered = cleanOrders.filter(o => {
    const matchTab = tab === 'all' || (() => {
      if (tab === '已确认') return ['已确认','师傅已确认','已派单','进行中'].includes(o.status)
      return o.status === tab
    })()
    const matchSearch = !q ||
      o.customerName?.toLowerCase().includes(q) ||
      o.customerPhone?.includes(q) ||
      o.id?.toLowerCase().includes(q) ||
      o.toAddress?.toLowerCase().includes(q) ||
      o.cleanTypeLabel?.includes(q)
    return matchTab && matchSearch
  }).sort((a, b) => {
    const aUnquoted = a.quote == null ? 0 : 1
    const bUnquoted = b.quote == null ? 0 : 1
    if (aUnquoted !== bUnquoted) return aUnquoted - bUnquoted
    return (b.createdAt || '') > (a.createdAt || '') ? 1 : -1
  })

  return (
    <div className="p-5 max-w-4xl mx-auto">

      <div className="flex items-center gap-3 mb-5">
        <Sparkles size={22} className="text-rose-400" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">清洁业务</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            待确认 {pendingCount} 单 · 进行中 {confirmedCount} 单
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatBox value={pendingCount}   label="待确认" color="text-yellow-500" />
        <StatBox value={confirmedCount} label="进行中" color="text-blue-600"   />
        <StatBox value={completedCount} label="已完成" color="text-green-600"  />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_TABS.map(t => {
          const count = t.value === 'all' ? cleanOrders.length : (tabCounts[t.value] || 0)
          return (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.value ? 'text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
              style={tab === t.value ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}>
              {t.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  tab === t.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜索姓名、电话、地址、订单号..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
      </div>

      <p className="text-sm text-gray-500 mb-3">{filtered.length} 条记录</p>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center shadow-sm">
          <Sparkles size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 font-medium">暂无清洁订单</p>
          <p className="text-gray-300 text-sm mt-1">客户从前台提交后显示在这里</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => (
            <CleanCard key={order.id} order={order}
              onClick={() => navigate(`/admin/orders/${order.id}`)}
              onStatusChange={(oid, status) => {
                try { updateOrderStatus(oid, status) }
                catch (err) { alert(err.message || '状态更新失败') }
              }} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatBox({ value, label, color }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-gray-400 text-xs mt-0.5">{label}</p>
    </div>
  )
}

function CleanCard({ order, onClick, onStatusChange }) {
  const icon = CLEAN_TYPE_ICON[order.cleanType] || '✨'

  function quickConfirm(e) {
    e.stopPropagation()
    onStatusChange(order.id, '已确认')
  }

  return (
    <div onClick={onClick}
      className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start gap-3">

        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0 text-2xl">
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          {/* Top row: name + status */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-gray-900">{order.customerName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-500'}`}>
              {order.status}
            </span>
          </div>

          {/* Summary line: room · type · quote */}
          <p className="text-sm font-medium text-gray-700 mb-1">
            {[
              order.roomTypeLabel,
              order.cleanTypeLabel,
            ].filter(Boolean).join(' · ')}
            {' · '}
            {order.quote != null
              ? <span className="text-green-600">${order.quote}</span>
              : <span className="text-orange-400">待报价</span>
            }
          </p>

          {/* Extras */}
          {order.cleanExtras?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              {order.cleanExtras.map(e => (
                <span key={e} className="text-xs px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">{e}</span>
              ))}
            </div>
          )}

          {/* Date + suburb */}
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap mt-0.5">
            {fmtDate(order.date, order.startTime) && (
              <span className="font-medium text-gray-700">
                📅 {fmtDate(order.date, order.startTime)}
              </span>
            )}
            {getSuburb(order.toAddress) && (
              <><span className="text-gray-300">·</span>
              <span className="text-gray-500">📍 {getSuburb(order.toAddress)}</span></>
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <p className="text-xs text-gray-400 mt-1 truncate">{order.notes}</p>
          )}
        </div>

        {/* Right side */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          <p className="text-xs text-gray-300">{order.id}</p>
          <p className="text-xs text-gray-400">{order.customerPhone}</p>
          {order.status === '待确认' && (
            <button onClick={quickConfirm}
              className="text-xs text-white font-semibold px-2.5 py-1.5 rounded-lg"
              style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
              确认
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
