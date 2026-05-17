import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { PlusCircle, Phone, ChevronRight, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import dayjs from 'dayjs'
import { useState } from 'react'
import { getStorageRates } from '../../data/storageRates'

function getStorageStatus(order) {
  if (order.actualMoveOutDate) return { label: '已取件', color: 'bg-gray-100 text-gray-500', icon: CheckCircle }
  const today = dayjs()
  const moveOut = dayjs(order.moveOutDate)
  const daysLeft = moveOut.diff(today, 'day')
  if (daysLeft < 0)  return { label: '已逾期', color: 'bg-red-100 text-red-600', icon: AlertTriangle, daysLeft }
  if (daysLeft <= 7) return { label: `${daysLeft}天后到期`, color: 'bg-amber-100 text-amber-700', icon: Clock, daysLeft }
  return { label: '寄存中', color: 'bg-blue-100 text-blue-700', icon: Clock, daysLeft }
}

const STATUS_TABS = [
  { label: '全部',    value: 'all' },
  { label: '寄存中',  value: 'active' },
  { label: '即将到期', value: 'expiring' },
  { label: '已逾期',  value: 'overdue' },
  { label: '已取件',  value: 'done' },
]

export default function StorageList() {
  const { storageOrders } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')

  const today = dayjs()

  const enriched = storageOrders.map(o => ({ ...o, _status: getStorageStatus(o) }))

  const filtered = enriched.filter(o => {
    const matchTab =
      tab === 'all'      ? true :
      tab === 'done'     ? !!o.actualMoveOutDate :
      tab === 'overdue'  ? (!o.actualMoveOutDate && dayjs(o.moveOutDate).diff(today, 'day') < 0) :
      tab === 'expiring' ? (!o.actualMoveOutDate && dayjs(o.moveOutDate).diff(today, 'day') >= 0 && dayjs(o.moveOutDate).diff(today, 'day') <= 7) :
      (!o.actualMoveOutDate && dayjs(o.moveOutDate).diff(today, 'day') > 7)

    const q = search.toLowerCase()
    const matchSearch = !q || o.customerName?.toLowerCase().includes(q) || o.customerPhone?.includes(q) || o.id?.toLowerCase().includes(q)
    return matchTab && matchSearch
  }).sort((a, b) => {
    if (a.actualMoveOutDate && !b.actualMoveOutDate) return 1
    if (!a.actualMoveOutDate && b.actualMoveOutDate) return -1
    return (a.moveOutDate || '').localeCompare(b.moveOutDate || '')
  })

  const counts = {
    all: enriched.length,
    active:   enriched.filter(o => !o.actualMoveOutDate && dayjs(o.moveOutDate).diff(today, 'day') > 7).length,
    expiring: enriched.filter(o => !o.actualMoveOutDate && dayjs(o.moveOutDate).diff(today, 'day') >= 0 && dayjs(o.moveOutDate).diff(today, 'day') <= 7).length,
    overdue:  enriched.filter(o => !o.actualMoveOutDate && dayjs(o.moveOutDate).diff(today, 'day') < 0).length,
    done:     enriched.filter(o => !!o.actualMoveOutDate).length,
  }

  const weeklyRevenue = enriched
    .filter(o => !o.actualMoveOutDate)
    .reduce((s, o) => {
      const w = Math.max(1, Math.ceil(dayjs(o.moveOutDate).diff(dayjs(o.moveInDate), 'day') / 7))
      const { boxRate, furRate } = getStorageRates(w)
      return s + (o.boxes * boxRate + o.furniture * furRate)
    }, 0)

  return (
    <div className="p-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">寄存管理</h1>
          <p className="text-gray-400 text-sm mt-0.5">每周收入约 ${weeklyRevenue}/周</p>
        </div>
        <button
          onClick={() => navigate('/admin/storage/new')}
          className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm"
          style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}
        >
          <PlusCircle size={16} />
          新建寄存
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="寄存中" value={counts.active + counts.expiring} color="blue" />
        <StatCard label="即将到期" value={counts.expiring} color={counts.expiring > 0 ? 'amber' : 'gray'} />
        <StatCard label="已逾期" value={counts.overdue} color={counts.overdue > 0 ? 'red' : 'gray'} />
        <StatCard label="已取件" value={counts.done} color="gray" />
      </div>

      {/* Overdue / expiring alerts */}
      {counts.overdue > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 mb-4">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          <span className="text-red-700 text-sm">有 <strong>{counts.overdue}</strong> 个寄存已逾期，请联系客户安排取件</span>
        </div>
      )}
      {counts.expiring > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 mb-4">
          <Clock size={16} className="text-amber-500 flex-shrink-0" />
          <span className="text-amber-700 text-sm">有 <strong>{counts.expiring}</strong> 个寄存将在7天内到期</span>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {STATUS_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.value ? 'text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
            style={tab === t.value ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}
          >
            {t.label}
            {counts[t.value] > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                tab === t.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>{counts[t.value]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <input
          type="text"
          placeholder="搜索客户名、手机号..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-4 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <p className="text-gray-300 text-4xl mb-3">📦</p>
          <p className="text-gray-400 font-medium">暂无寄存记录</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => (
            <StorageCard key={o.id} order={o} onClick={() => navigate(`/admin/storage/${o.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function StorageCard({ order: o, onClick }) {
  const s = o._status
  const weeks = Math.max(1, Math.ceil(dayjs(o.moveOutDate).diff(dayjs(o.moveInDate), 'day') / 7))
  const { boxRate, furRate } = getStorageRates(weeks)
  const weeklyFee = o.boxes * boxRate + o.furniture * furRate
  const totalFee = weeklyFee * weeks

  return (
    <div onClick={onClick} className="bg-white rounded-xl px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">
          📦
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-900 font-semibold">{o.customerName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
            {o.paymentStatus === '未付' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">费用未付</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
            <span>{o.customerPhone}</span>
            <span>·</span>
            <span>📦 {o.boxes}箱</span>
            {o.furniture > 0 && <><span>·</span><span>🪑 {o.furniture}件家具</span></>}
            <span>·</span>
            <span>{o.moveInDate} 入库</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-green-600 font-bold text-sm">${totalFee}/期</p>
          <p className="text-gray-400 text-xs">${weeklyFee}/周</p>
          <p className="text-gray-400 text-xs mt-0.5">到期 {o.moveOutDate}</p>
        </div>
        <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colors = { blue: 'text-blue-600', amber: 'text-amber-600', red: 'text-red-500', gray: 'text-gray-400' }
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm text-center">
      <p className={`text-2xl font-bold ${colors[color] || 'text-gray-800'}`}>{value}</p>
      <p className="text-gray-400 text-xs mt-0.5">{label}</p>
    </div>
  )
}
