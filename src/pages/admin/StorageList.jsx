import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { PlusCircle, Phone, ChevronRight, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import dayjs from 'dayjs'
import { useState } from 'react'
import { getStorageRates } from '../../data/storageRates'
import { storageStatus, STORAGE_TABS, FIRST_NOTICE_DAYS, SECOND_NOTICE_DAYS } from '../../utils/storage'

// ⚠️ 2026-11-16：本地那份 getStorageStatus 和 STATUS_TABS 搬到 utils/storage.js 了。
//    原来它只看出库日，入库日还没到的 5 单全被标成「寄存中」——
//    小洁在群里圈红的就是这几条：「这些还没开始寄存呢…我在这里看不出来」。
//    详情页还有一份一样的，一起合并了。

export default function StorageList() {
  const { storageOrders, updateStorageOrder } = useApp()
  const navigate = useNavigate()
  // ⚠️ 2026-11-16：认 URL 上的 ?tab= ——
  //    工作台那条「X 单寄存 7 天内到期」要能一键跳到对应页签，
  //    否则客服点完还得自己再找一次。
  const [params] = useSearchParams()
  const [tab, setTab] = useState(
    STORAGE_TABS.some(t => t.value === params.get('tab')) ? params.get('tab') : 'all'
  )
  const [search, setSearch] = useState('')

  const today = dayjs()

  const enriched = storageOrders.map(o => ({ ...o, _status: storageStatus(o, today) }))

  const filtered = enriched.filter(o => {
    const matchTab = tab === 'all' ? o._status.key !== 'cancelled' : o._status.key === tab
    const q = search.toLowerCase()
    const matchSearch = !q || o.customerName?.toLowerCase().includes(q) || o.customerPhone?.includes(q) || o.id?.toLowerCase().includes(q)
    return matchTab && matchSearch
  }).sort((a, b) => {
    // 待入库的按入库日排（最近要来的在前），其余按出库日排
    const ap = a._status.key === 'pending', bp = b._status.key === 'pending'
    if (ap !== bp) return ap ? -1 : 1
    if (ap) return (a.moveInDate || '').localeCompare(b.moveInDate || '')
    if (a.actualMoveOutDate && !b.actualMoveOutDate) return 1
    if (!a.actualMoveOutDate && b.actualMoveOutDate) return -1
    return (a.moveOutDate || '').localeCompare(b.moveOutDate || '')
  })

  // 7 天内到期的 —— 第二封通知的对象
  const urgentCount = enriched.filter(o => o._status.urgent).length

  const counts = STORAGE_TABS.reduce((acc, t) => ({
    ...acc,
    [t.value]: t.value === 'all'
      ? enriched.filter(o => o._status.key !== 'cancelled').length
      : enriched.filter(o => o._status.key === t.value).length,
  }), {})

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

      {/* Stats
          ⚠️ 2026-11-16 改：
          · 补上「待入库」—— 原来横幅四格里没有它，5 单待入库在横幅上完全看不见
          · 「已逾期」改叫「待出库」，和页签同名。同一件事两个名字，交接时要出事
          · 拿掉「已取件」—— 那是办完的事，不需要天天盯；要看点页签就有
          · 四格都能点，点了直接切到对应页签 */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="待入库"   value={counts.pending}  color={counts.pending > 0 ? 'indigo' : 'gray'} onClick={() => setTab('pending')} />
        <StatCard label="寄存中"   value={counts.active}   color="blue"  onClick={() => setTab('active')} />
        <StatCard label="即将到期" value={counts.expiring} color={counts.expiring > 0 ? 'amber' : 'gray'} onClick={() => setTab('expiring')} />
        <StatCard label="待出库"   value={counts.overdue}  color={counts.overdue > 0 ? 'red' : 'gray'}    onClick={() => setTab('overdue')} />
      </div>

      {/* Overdue / expiring alerts */}
      {counts.overdue > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 mb-4">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          <span className="text-red-700 text-sm">有 <strong>{counts.overdue}</strong> 个寄存待出库（已逾期），请联系客户安排取件或续费</span>
        </div>
      )}
      {urgentCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3 mb-4">
          <Clock size={16} className="text-orange-500 flex-shrink-0" />
          <span className="text-orange-700 text-sm">
            有 <strong>{urgentCount}</strong> 个寄存 <strong>{SECOND_NOTICE_DAYS}</strong> 天内到期 ——
            第二封通知该发了，记得把逾期规则讲清楚
          </span>
        </div>
      )}
      {counts.expiring - urgentCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 mb-4">
          <Clock size={16} className="text-amber-500 flex-shrink-0" />
          <span className="text-amber-700 text-sm">
            有 <strong>{counts.expiring - urgentCount}</strong> 个寄存 <strong>{FIRST_NOTICE_DAYS}</strong> 天内到期 —— 联系客户问续费还是取货
          </span>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {STORAGE_TABS.map(t => (
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
            <StorageCard
              key={o.id}
              order={o}
              onClick={() => navigate(`/admin/storage/${o.id}`)}
              onCancel={() => {
                if (!window.confirm(`确认取消「${o.customerName}」的寄存订单？\n\n（若是测试单需彻底删除，请点进详情勾选"彻底删除"）`)) return
                try { updateStorageOrder(o.id, { status: '已取消' }) }
                catch (err) { alert(err.message || '取消失败') }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StorageCard({ order: o, onClick, onCancel }) {
  const s = o._status
  const weeks = Math.max(1, Math.ceil(dayjs(o.moveOutDate).diff(dayjs(o.moveInDate), 'day') / 7))
  const { boxRate, furRate } = getStorageRates(weeks)
  const weeklyFee = o.boxes * boxRate + o.furniture * furRate
  const totalFee = weeklyFee * weeks
  const canCancel = o.status !== '已取消' && !o.actualMoveOutDate

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
            {o._status.key === 'pending'
              ? <span className="text-indigo-600 font-medium">{o.moveInDate} 入库</span>
              : <span>{o.moveInDate} 入库</span>}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-green-600 font-bold text-sm">${totalFee}/期</p>
          <p className="text-gray-400 text-xs">${weeklyFee}/周</p>
          {/* 小洁 11-16：「客户入库时，支付的寄存费用，是到几号出库」——
              moveOutDate 本来就是付费覆盖到的那天，只是原来写「到期」看不出是钱付到这儿 */}
          <p className="text-gray-500 text-xs mt-0.5">已付到 {o.moveOutDate}</p>
          <p className="text-gray-400 text-xs">共 {weeks} 周</p>
          {canCancel && onCancel && (
            <button
              onClick={e => { e.stopPropagation(); onCancel() }}
              className="mt-1 text-xs text-gray-400 hover:text-red-500 px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
            >
              取消订单
            </button>
          )}
        </div>
        <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
      </div>
    </div>
  )
}

function StatCard({ label, value, color, onClick }) {
  const colors = {
    blue: 'text-blue-600', amber: 'text-amber-600', red: 'text-red-500',
    indigo: 'text-indigo-600', gray: 'text-gray-400',
  }
  return (
    <div onClick={onClick}
      className={`bg-white rounded-xl p-3 shadow-sm text-center${onClick ? ' cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
      <p className={`text-2xl font-bold ${colors[color] || 'text-gray-800'}`}>{value}</p>
      <p className="text-gray-400 text-xs mt-0.5">{label}</p>
    </div>
  )
}
