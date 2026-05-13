import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Search, PlusCircle, Download, ClipboardList, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { SLOT_CONFIG } from '../../utils/slotAvailability'

// 车型 → 时段配置组（与 NewOrder.jsx 保持一致）
const VEHICLE_TO_GROUP = {
  '面包车':   'van',
  '卡车单人': 'van',
  '小卡车':   'small',
  '小卡三人': 'small',
  '大卡车':   'large',
  '大卡三人': 'large',
  '双卡车':   'large',
}

// 各组展示信息 + 本地容量配置（与 slotAvailability.js FALLBACK 对齐）
const GROUP_META = {
  van:   { label: '面包车组', icon: '🚐', vehicles: ['面包车', '卡车单人'],          slotCap: 1, dailyCap: 5 },
  small: { label: '小卡车组', icon: '🚚', vehicles: ['小卡车', '小卡三人'],          slotCap: 2, dailyCap: 6 },
  large: { label: '大卡车组', icon: '🛻', vehicles: ['大卡车', '大卡三人', '双卡车'], slotCap: 1, dailyCap: 2 },
}

const STATUS_TABS = [
  { label: '全部',         value: 'all',       filter: null },
  { label: '待确认',       value: '待确认',    filter: ['待确认','已报价'] },
  { label: '当日未派单',   value: '当日未派单', filter: null },
  { label: '已派单',       value: '已派单',    filter: null },
  { label: '师傅已确认',   value: '师傅已确认', filter: null },
  { label: '进行中',       value: '进行中',    filter: null },
  { label: '未提交账单',   value: '未提交账单', filter: null },
  { label: '未付款',       value: '客户未付款', filter: null },
  { label: '已完成',       value: '已完成',    filter: null },
]

const STATUS_COLOR = {
  '待确认':        'bg-yellow-100 text-yellow-700',
  '已报价':        'bg-blue-100 text-blue-600',
  '已收定金':      'bg-green-100 text-green-700',
  '已派单':        'bg-indigo-100 text-indigo-700',
  '师傅已确认':        'bg-blue-100 text-blue-700',
  '进行中':        'bg-orange-100 text-orange-700',
  '未提交账单': 'bg-yellow-100 text-yellow-800',
  '客户未付款':    'bg-red-100 text-red-700',
  '已完成':        'bg-gray-100 text-gray-500',
  '已取消':        'bg-gray-100 text-gray-400',
}

const WORKER_NAMES = {
  laomou: '老木', xiaoyu: '小宇', chenxi: '晨曦', laowang: '老王', xiaozhang: '小张'
}

export default function OrderList() {
  const { orders, exportOrdersCSV, updateOrderStatus, storageOrders } = useApp()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const serviceFilter = searchParams.get('service') // e.g. 'IKEA'
  // activeTab is derived from URL — never stale across renders or navigations
  const activeTab = searchParams.get('tab') || 'all'
  const [search, setSearch]             = useState('')
  const [sortBy, setSortBy]             = useState('date-desc')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedDate, setSelectedDate]   = useState(new Date().toISOString().slice(0, 10))

  function switchTab(tabValue) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (tabValue === 'all') {
        next.delete('tab')
      } else {
        next.set('tab', tabValue)
      }
      return next
    })
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  // Merge regular orders + storage orders for combined view
  const combinedOrders = [...orders, ...(storageOrders || [])]

  // All distinct months that have orders, newest first
  const months = [...new Set(
    combinedOrders.map(o => (o.date || '').slice(0, 7)).filter(Boolean)
  )].sort((a, b) => b.localeCompare(a))

  function formatMonth(ym) {
    const [y, m] = ym.split('-')
    return `${y}年${parseInt(m)}月`
  }

  // Apply service type pre-filter (e.g. IKEA)
  const serviceFiltered = serviceFilter
    ? combinedOrders.filter(o => o.serviceType === serviceFilter)
    : combinedOrders

  // Apply month pre-filter before status/search
  const monthFiltered = selectedMonth
    ? serviceFiltered.filter(o => (o.date || '').startsWith(selectedMonth))
    : serviceFiltered

  // 日期筛选优先级高于月份；selectedDate=null 表示"查看全部日期"
  const dateScoped = selectedDate
    ? serviceFiltered.filter(o => o.date === selectedDate)
    : monthFiltered

  // 当日各车型组时段占用统计（用于时段可视化卡片）
  function getSlotStats(group) {
    const config = SLOT_CONFIG[group]
    const meta = GROUP_META[group]
    if (!config || !meta || !selectedDate) return null
    const dayOrders = serviceFiltered.filter(o =>
      o.date === selectedDate &&
      meta.vehicles.includes(o.vehicle) &&
      o.status !== '已取消'
    )
    const dailyBooked = dayOrders.length
    const dailyFull = dailyBooked >= meta.dailyCap
    return {
      slots: config.slots.map(slot => {
        const booked = dayOrders.filter(o => o.startTime === slot).length
        return {
          slot,
          booked,
          capacity: meta.slotCap,
          full: booked >= meta.slotCap || dailyFull,
        }
      }),
      dailyBooked,
      dailyCap: meta.dailyCap,
      dailyFull,
    }
  }

  // 日期切换辅助
  function shiftDate(days) {
    const d = new Date(selectedDate || new Date().toISOString().slice(0, 10))
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().slice(0, 10))
    setSelectedMonth('')
  }
  function formatDateLabel(s) {
    if (!s) return ''
    const d = new Date(s)
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)
    const wd = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
    let prefix = ''
    if (s === today) prefix = '今天 · '
    else if (s === tomorrowStr) prefix = '明天 · '
    return `${prefix}${d.getMonth() + 1}月${d.getDate()}日 ${wd}`
  }

  const activeTabDef = STATUS_TABS.find(t => t.value === activeTab)
  const q = search.toLowerCase()

  const filtered = dateScoped.filter(o => {
    let matchTab
    if (activeTab === 'all') {
      matchTab = true
    } else if (activeTab === '当日未派单') {
      matchTab = o.date === todayStr && !o.assignedTo && !['已完成','已取消'].includes(o.status)
    } else if (activeTabDef?.filter) {
      matchTab = activeTabDef.filter.includes(o.status)
    } else {
      matchTab = o.status === activeTab
    }

    const matchSearch = !q ||
      o.customerName?.toLowerCase().includes(q) ||
      o.customerPhone?.includes(q) ||
      o.id?.toLowerCase().includes(q) ||
      o.fromAddress?.toLowerCase().includes(q) ||
      o.toAddress?.toLowerCase().includes(q)
    return matchTab && matchSearch
  }).sort((a, b) => {
    if (sortBy === 'date-desc') return (b.date || '') > (a.date || '') ? 1 : -1
    if (sortBy === 'date-asc')  return (a.date || '') > (b.date || '') ? 1 : -1
    return new Date(b.createdAt) - new Date(a.createdAt)
  })

  // Cancelled orders live on a separate page — never appear here.
  const finalOrders = filtered.filter(o => o.status !== '已取消')

  // 当日全部订单数（不受 status tab 过滤）— 用于"明明有却看不到"的提示横幅
  const totalOnDate = selectedDate
    ? serviceFiltered.filter(o => o.date === selectedDate && o.status !== '已取消').length
    : 0
  const hiddenByTab = selectedDate && activeTab !== 'all' && totalOnDate > finalOrders.length
    ? totalOnDate - finalOrders.length
    : 0

  const tabCounts = {}
  dateScoped.forEach(o => {
    tabCounts[o.status] = (tabCounts[o.status] || 0) + 1
  })
  const pendingCount = (tabCounts['待确认'] || 0) + (tabCounts['已报价'] || 0)
  const todayUnassigned = dateScoped.filter(o =>
    o.date === todayStr && !o.assignedTo && !['已完成','已取消'].includes(o.status)
  ).length

  return (
    <div className="p-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">
          {serviceFilter === 'IKEA' ? '🛋️ 提货安装订单' : '全部订单'}
        </h1>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="flex items-center gap-1.5 text-gray-600 border border-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold bg-white hover:bg-gray-50 cursor-pointer focus:outline-none"
          >
            <option value="date-desc">服务日期 ↓ 最新</option>
            <option value="date-asc">服务日期 ↑ 最早</option>
            <option value="created-desc">录单时间 ↓ 最新</option>
          </select>
          <button
            onClick={exportOrdersCSV}
            className="flex items-center gap-1.5 text-gray-600 border border-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50"
          >
            <Download size={15} />
            导出
          </button>
          <button
            onClick={() => navigate('/admin/orders/new')}
            className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm"
            style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}
          >
            <PlusCircle size={16} />
            新建订单
          </button>
        </div>
      </div>

      {/* Date filter + slot availability visualization */}
      <div className="bg-white rounded-xl shadow-sm px-4 pt-3 pb-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">按日查看</span>
          </div>
          <button
            onClick={() => { setSelectedDate(''); setSelectedMonth('') }}
            className={`text-xs font-medium ${selectedDate ? 'text-red-500 hover:text-red-700' : 'text-gray-300'}`}
            disabled={!selectedDate}
          >
            ✕ 查看全部日期
          </button>
        </div>

        {/* Date picker row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button
            onClick={() => shiftDate(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            title="前一天"
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={selectedDate || ''}
            onChange={e => { setSelectedDate(e.target.value); setSelectedMonth('') }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-200"
          />
          <button
            onClick={() => shiftDate(1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            title="后一天"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => { setSelectedDate(todayStr); setSelectedMonth('') }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              selectedDate === todayStr ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            style={selectedDate === todayStr ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}
          >
            今天
          </button>
          {selectedDate && (
            <span className="text-sm text-gray-500 ml-1">{formatDateLabel(selectedDate)}</span>
          )}
        </div>

        {/* Slot availability cards (only when a date is selected) */}
        {selectedDate && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.keys(GROUP_META).map(groupKey => {
              const stats = getSlotStats(groupKey)
              const meta = GROUP_META[groupKey]
              if (!stats) return null
              return (
                <div key={groupKey} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">
                      {meta.icon} {meta.label}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      stats.dailyFull
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {stats.dailyBooked}/{stats.dailyCap} 单
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {stats.slots.map(s => (
                      <div
                        key={s.slot}
                        className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg border ${
                          s.full
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : 'bg-green-50 border-green-200 text-green-700'
                        }`}
                      >
                        <span className="font-medium">{s.slot}</span>
                        <span className="font-semibold">
                          {s.full ? '已满' : '空余'} · {s.booked}/{s.capacity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Month filter */}
      <div className="bg-white rounded-xl shadow-sm px-4 pt-3 pb-3 mb-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">按月查看</span>
          {selectedMonth && (
            <button onClick={() => setSelectedMonth('')}
              className="text-xs text-red-500 hover:text-red-700 font-medium">
              ✕ 清除筛选
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <button
            onClick={() => { setSelectedMonth(''); setSelectedDate('') }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              !selectedMonth && !selectedDate ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            style={!selectedMonth && !selectedDate ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}>
            全部时间
            <span className={`ml-1.5 ${!selectedMonth && !selectedDate ? 'opacity-70' : 'text-gray-400'}`}>
              {combinedOrders.length}
            </span>
          </button>
          {months.map(m => {
            const cnt = combinedOrders.filter(o => (o.date || '').startsWith(m)).length
            const active = selectedMonth === m
            return (
              <button key={m} onClick={() => { setSelectedMonth(m); setSelectedDate('') }}
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

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="搜索客户名、手机号、订单号..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-200"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {STATUS_TABS.map(tab => {
          let count = 0
          if (tab.value === 'all') count = (serviceFilter ? serviceFiltered : combinedOrders).filter(o => o.status !== '已取消').length
          else if (tab.value === '待确认') count = pendingCount
          else if (tab.value === '当日未派单') count = todayUnassigned
          else count = tabCounts[tab.value] || 0
          return (
            <button
              key={tab.value}
              onClick={() => switchTab(tab.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? 'text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
              style={activeTab === tab.value ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500 mb-3">
        {selectedDate && <span className="text-red-600 font-semibold mr-1.5">{formatDateLabel(selectedDate)}</span>}
        {selectedMonth && !selectedDate && <span className="text-red-600 font-semibold mr-1.5">{formatMonth(selectedMonth)}</span>}
        {finalOrders.length} 条订单
      </p>

      {/* 提示：当日有订单但当前 tab 看不到 */}
      {hiddenByTab > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">该日共 {totalOnDate} 条订单</span>，当前「{activeTabDef?.label || activeTab}」tab 只显示 {finalOrders.length} 条，还有 {hiddenByTab} 条在其他状态。
          </p>
          <button
            onClick={() => switchTab('all')}
            className="flex-shrink-0 text-xs font-semibold text-white px-3 py-1.5 rounded-lg whitespace-nowrap"
            style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}
          >
            查看当日全部
          </button>
        </div>
      )}

      {/* Order cards */}
      {finalOrders.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <ClipboardList size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 font-medium">暂无订单</p>
          <p className="text-gray-300 text-sm mt-1">该分类下没有符合条件的订单</p>
        </div>
      ) : (
        <div className="space-y-2">
          {finalOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onClick={() => {
                const isStorage = order.serviceType === '寄存' || (order.id || '').startsWith('STG-')
                const dest = isStorage ? `/admin/storage/${order.id}` : `/admin/orders/${order.id}`
                navigate(dest, { state: { allowDispatch: activeTab !== 'all' } })
              }}
              onCancel={
                (order.serviceType === '寄存' || (order.id || '').startsWith('STG-'))
                  ? null
                  : () => {
                      if (window.confirm(`确认取消「${order.customerName}」的订单？`)) {
                        updateOrderStatus(order.id, '已取消')
                      }
                    }
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function OrderCard({ order, onClick, onCancel }) {
  const workerName = order.assignedTo ? (WORKER_NAMES[order.assignedTo] || order.assignedTo) : null
  // 已完成订单也允许取消（事后退款 / 清理测试单），仅排除已取消单本身
  const canCancel = order.status !== '已取消'
  const isStorage = order.serviceType === '寄存' || (order.id || '').startsWith('STG-')
  const isIkea    = order.serviceType === 'IKEA'

  return (
    <div
      onClick={onClick}
      className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-900 font-semibold">{order.customerName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-500'}`}>
              {order.status}
            </span>
            {isStorage && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 font-medium">📦 寄存</span>
            )}
            {isIkea && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 font-medium">🛋️ 提货</span>
            )}
            {!order.assignedTo && !isStorage && !['已完成','已取消'].includes(order.status) && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">未派单</span>
            )}
            {order.deposit > 0 && !(
              order.depositPaid
              || order.depositStatus === '已上传截图'
              || !!order.depositScreenshot
              || order.paymentStatus === '定金'
              || order.paymentStatus === '已付'
            ) && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">定金未收</span>
            )}
            {order.source && order.source !== '官网自助预约' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium">📍 {order.source}</span>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-3 text-sm text-gray-500">
            <span>{order.date} {order.startTime}</span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-600 font-medium">{order.vehicle}</span>
            {workerName && (
              <>
                <span className="text-gray-300">·</span>
                <span>{workerName}</span>
              </>
            )}
          </div>

          <div className="mt-1 text-xs text-gray-400 truncate">
            {isStorage
              ? `入库 ${order.moveInDate || order.date} · 预计取回 ${order.moveOutDate || '—'}`
              : `${order.fromAddress?.split(',')[0]} → ${order.toAddress?.split(',')[0]}`
            }
          </div>
        </div>

        {/* Right: price + order id */}
        <div className="flex-shrink-0 text-right">
          {isStorage ? (
            <>
              <p className="text-green-600 font-bold text-lg">
                ${order.weeklyFee}<span className="text-xs font-normal text-gray-400">/周</span>
              </p>
              <p className="text-xs text-gray-400">{order.weeks}周 共${order.totalFee}</p>
            </>
          ) : (
            <>
              <p className="text-green-600 font-bold text-lg">${order.quote}</p>
              {order.deposit > 0 && (
                <p className="text-xs text-gray-400">定金 ${order.deposit}</p>
              )}
            </>
          )}
          <p className="text-xs text-gray-300 mt-1">{order.id}</p>
        </div>
      </div>

      <div className="flex items-end justify-between mt-2 gap-2">
        {order.notes ? (
          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-1.5 truncate flex-1">
            📝 {order.notes}
          </p>
        ) : <span />}

        {!isStorage && (
          canCancel ? (
            onCancel && (
              <button
                onClick={e => { e.stopPropagation(); onCancel() }}
                className="flex-shrink-0 text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
              >
                取消订单
              </button>
            )
          ) : order.status === '已取消' ? (
            <span className="flex-shrink-0 text-xs text-gray-300 px-2 py-1">已取消 ✓</span>
          ) : null
        )}
      </div>
    </div>
  )
}
