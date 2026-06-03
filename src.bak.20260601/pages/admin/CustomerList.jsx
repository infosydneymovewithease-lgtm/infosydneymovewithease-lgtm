import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Search, Phone, ChevronRight } from 'lucide-react'

function getLevel(count) {
  if (count >= 9) return { badge: '🌙🌙',      label: '常客',   color: 'bg-purple-100 text-purple-700' }
  if (count === 8) return { badge: '🌙⭐⭐⭐', label: '常客',   color: 'bg-purple-100 text-purple-700' }
  if (count === 7) return { badge: '🌙⭐⭐',   label: '常客',   color: 'bg-purple-100 text-purple-700' }
  if (count === 6) return { badge: '🌙⭐',     label: '常客',   color: 'bg-purple-100 text-purple-700' }
  if (count === 5) return { badge: '🌙',        label: '常客',   color: 'bg-purple-100 text-purple-700' }
  if (count === 4) return { badge: '⭐⭐⭐',   label: '老客户', color: 'bg-yellow-100 text-yellow-700' }
  if (count === 3) return { badge: '⭐⭐',     label: '老客户', color: 'bg-yellow-100 text-yellow-700' }
  if (count === 2) return { badge: '⭐',        label: '回头客', color: 'bg-blue-100 text-blue-700' }
  return             { badge: '✦',              label: '新客户', color: 'bg-gray-100 text-gray-500' }
}

const SORT_OPTIONS = [
  { label: '下单次数 ↓', value: 'count-desc' },
  { label: '消费金额 ↓', value: 'spent-desc' },
  { label: '最近下单 ↓', value: 'recent' },
  { label: '首次下单 ↑', value: 'first' },
]

export default function CustomerList() {
  const { getCustomers } = useApp()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('count-desc')

  const customers = getCustomers()

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    return !q ||
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.wechat?.toLowerCase().includes(q)
  }).sort((a, b) => {
    if (sortBy === 'count-desc') return b.orderCount - a.orderCount
    if (sortBy === 'spent-desc') return b.totalSpent - a.totalSpent
    if (sortBy === 'recent')     return (b.lastOrderDate || '').localeCompare(a.lastOrderDate || '')
    return (a.firstOrderDate || '').localeCompare(b.firstOrderDate || '')
  })

  const totalCustomers = customers.length
  const repeatCustomers = customers.filter(c => c.orderCount >= 2).length

  return (
    <div className="p-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">客户主档</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            共 {totalCustomers} 位客户 · {repeatCustomers} 位回头客
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="总客户数" value={totalCustomers} color="blue" />
        <StatCard label="回头客" value={repeatCustomers} color="green" />
        <StatCard
          label="回头率"
          value={totalCustomers ? `${Math.round(repeatCustomers / totalCustomers * 100)}%` : '0%'}
          color="purple"
        />
      </div>

      {/* Search + Sort */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索姓名、手机、微信号..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="border border-gray-200 px-3 py-2.5 rounded-xl text-sm bg-white text-gray-600 focus:outline-none cursor-pointer"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <p className="text-sm text-gray-400 mb-3">{filtered.length} 位客户</p>

      {/* Customer list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <p className="text-gray-300 text-4xl mb-3">👤</p>
          <p className="text-gray-400 font-medium">暂无客户数据</p>
          <p className="text-gray-300 text-sm mt-1">录入订单后自动生成客户档案</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <CustomerCard
              key={c.phone}
              customer={c}
              onClick={() => navigate(`/admin/customers/${encodeURIComponent(c.phone)}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CustomerCard({ customer: c, onClick }) {
  const level = getLevel(c.orderCount)
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-700 font-bold text-base flex-shrink-0">
          {c.name?.[0] || '?'}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-gray-900 font-semibold">{c.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${level.color}`}>
              {level.badge} {level.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
            <span>{c.phone}</span>
            {c.wechat && <span>微信：{c.wechat}</span>}
            {c.source && <span>来源：{c.source}</span>}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-shrink-0 text-right">
          <div className="hidden sm:block">
            <p className="text-gray-800 font-bold text-sm">{c.orderCount} 单</p>
            <p className="text-gray-400 text-xs">历史订单</p>
          </div>
          {c.totalSpent > 0 && (
            <div className="hidden sm:block">
              <p className="text-green-600 font-bold text-sm">${c.totalSpent}</p>
              <p className="text-gray-400 text-xs">累计消费</p>
            </div>
          )}
          <div>
            <p className="text-gray-500 text-xs">{c.lastOrderDate}</p>
            <p className="text-gray-400 text-xs">最近下单</p>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
  }
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm text-center">
      <p className={`text-2xl font-bold ${colors[color]?.split(' ')[1] || 'text-gray-800'}`}>{value}</p>
      <p className="text-gray-400 text-xs mt-0.5">{label}</p>
    </div>
  )
}
