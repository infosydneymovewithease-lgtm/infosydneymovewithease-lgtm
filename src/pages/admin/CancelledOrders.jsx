import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Search, ClipboardList, Trash2 } from 'lucide-react'

const WORKER_NAMES = {
  laomou: '老木', xiaoyu: '小宇', chenxi: '晨曦', laowang: '老王', xiaozhang: '小张'
}

export default function CancelledOrders() {
  const { orders, storageOrders, deleteOrder } = useApp()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [confirmingId, setConfirmingId] = useState(null)

  const combinedOrders = [...orders, ...(storageOrders || [])]
  const cancelled = combinedOrders.filter(o => o.status === '已取消')

  const months = [...new Set(
    cancelled.map(o => (o.date || '').slice(0, 7)).filter(Boolean)
  )].sort((a, b) => b.localeCompare(a))

  function formatMonth(ym) {
    const [y, m] = ym.split('-')
    return `${y}年${parseInt(m)}月`
  }

  const q = search.toLowerCase()
  const finalOrders = cancelled
    .filter(o => !selectedMonth || (o.date || '').startsWith(selectedMonth))
    .filter(o => !q ||
      o.customerName?.toLowerCase().includes(q) ||
      o.customerPhone?.includes(q) ||
      o.id?.toLowerCase().includes(q) ||
      o.fromAddress?.toLowerCase().includes(q) ||
      o.toAddress?.toLowerCase().includes(q)
    )
    .sort((a, b) => ((b.date || '') > (a.date || '') ? 1 : -1))

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">取消历史订单</h1>
        <span className="text-sm text-gray-400">{cancelled.length} 条已取消</span>
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
            onClick={() => setSelectedMonth('')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              !selectedMonth ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            style={!selectedMonth ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}>
            全部时间
            <span className={`ml-1.5 ${!selectedMonth ? 'opacity-70' : 'text-gray-400'}`}>
              {cancelled.length}
            </span>
          </button>
          {months.map(m => {
            const cnt = cancelled.filter(o => (o.date || '').startsWith(m)).length
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

      <p className="text-sm text-gray-500 mb-3">
        {selectedMonth && <span className="text-red-600 font-semibold mr-1.5">{formatMonth(selectedMonth)}</span>}
        {finalOrders.length} 条订单
      </p>

      {finalOrders.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <ClipboardList size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 font-medium">暂无已取消订单</p>
        </div>
      ) : (
        <div className="space-y-2">
          {finalOrders.map(order => {
            const isStorage = order.serviceType === '寄存' || (order.id || '').startsWith('STG-')
            const workerName = order.assignedTo ? (WORKER_NAMES[order.assignedTo] || order.assignedTo) : null
            const isConfirming = confirmingId === order.id
            return (
              <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div
                  onClick={() => navigate(isStorage ? `/admin/storage/${order.id}` : `/admin/orders/${order.id}`)}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer opacity-70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-700 font-semibold">{order.customerName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-400">已取消</span>
                        {isStorage && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 font-medium">📦 寄存</span>}
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-sm text-gray-400">
                        <span>{order.date} {order.startTime}</span>
                        {order.vehicle && <><span className="text-gray-200">·</span><span>{order.vehicle}</span></>}
                        {workerName && <><span className="text-gray-200">·</span><span>{workerName}</span></>}
                      </div>
                      <div className="mt-1 text-xs text-gray-400 truncate">
                        {isStorage
                          ? `入库 ${order.moveInDate || order.date}`
                          : `${order.fromAddress?.split(',')[0]} → ${order.toAddress?.split(',')[0]}`
                        }
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {order.quote && <p className="text-gray-400 font-bold">${order.quote}</p>}
                      <p className="text-xs text-gray-300 mt-1">{order.id}</p>
                    </div>
                  </div>
                </div>

                {/* Delete row */}
                {!isConfirming ? (
                  <div className="px-4 pb-3 flex justify-end">
                    <button
                      onClick={() => setConfirmingId(order.id)}
                      className="flex items-center gap-1 text-xs text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} /> 删除
                    </button>
                  </div>
                ) : (
                  <div className="px-4 pb-3 flex items-center justify-end gap-3 border-t border-red-50 pt-2.5 bg-red-50">
                    <span className="text-xs text-red-500 font-medium flex-1">彻底删除后无法恢复</span>
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg bg-white border border-gray-200"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => { deleteOrder(order.id); setConfirmingId(null) }}
                      className="text-xs text-white px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 font-semibold"
                    >
                      确认删除
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
