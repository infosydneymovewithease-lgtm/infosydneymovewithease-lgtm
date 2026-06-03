import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { ArrowLeft, Phone, MessageCircle, Calendar, DollarSign, ChevronRight, Download } from 'lucide-react'
import dayjs from 'dayjs'

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

const STATUS_COLOR = {
  '待确认':       'bg-yellow-100 text-yellow-700',
  '已报价':       'bg-blue-100 text-blue-600',
  '已收定金':     'bg-green-100 text-green-700',
  '已派单':       'bg-indigo-100 text-indigo-700',
  '师傅已确认':   'bg-blue-100 text-blue-700',
  '进行中':       'bg-orange-100 text-orange-700',
  '未提交账单':   'bg-yellow-100 text-yellow-800',
  '客户未付款':   'bg-red-100 text-red-700',
  '已完成':       'bg-gray-100 text-gray-500',
  '已取消':       'bg-gray-100 text-gray-400',
}

export default function CustomerDetail() {
  const { phone } = useParams()
  const navigate = useNavigate()
  const { orders } = useApp()

  const decodedPhone = decodeURIComponent(phone)
  const customerOrders = orders
    .filter(o => o.customerPhone === decodedPhone)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  if (customerOrders.length === 0) return (
    <div className="flex items-center justify-center h-64 text-gray-400">客户不存在</div>
  )

  const first = customerOrders[customerOrders.length - 1]
  const customer = {
    name: first.customerName,
    phone: decodedPhone,
    wechat: first.wechat || '',
    source: first.source || '',
  }

  const orderCount = customerOrders.length
  const totalSpent = customerOrders.reduce((s, o) => s + (o.finalAmount || 0), 0)
  const totalQuoted = customerOrders.reduce((s, o) => s + (o.quote || 0), 0)
  const level = getLevel(orderCount)

  function exportBill() {
    const headers = ['日期', '订单号', '车型', '出发地', '目的地', '报价($)', '实收($)', '付款方式', '状态']
    const rows = customerOrders.map(o => [
      o.date || '',
      o.id || '',
      o.vehicle || '',
      (o.fromAddress || '').replace(/,/g, '，'),
      (o.toAddress || '').replace(/,/g, '，'),
      o.quote || '',
      o.finalAmount || '',
      o.paymentMethod === 'cash' ? '现金' : o.paymentMethod === 'transfer' ? '转账' : '',
      o.status || '',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${customer.name}_消费明细_${dayjs().format('YYYY-MM-DD')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const completedOrders = customerOrders.filter(o => o.status === '已完成')
  const unpaidOrders = customerOrders.filter(o => o.status === '客户未付款')

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex-1">客户档案</h1>
        <button onClick={exportBill}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium">
          <Download size={14} />
          导出明细
        </button>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
            {customer.name?.[0] || '?'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-gray-900 font-bold text-lg">{customer.name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${level.color}`}>
                {level.badge} {level.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 mt-1.5">
              <a href={`tel:${customer.phone}`}
                className="flex items-center gap-1.5 text-green-600 text-sm font-medium hover:underline"
                onClick={e => e.stopPropagation()}>
                <Phone size={13} />
                {customer.phone}
              </a>
              {customer.wechat && (
                <span className="flex items-center gap-1.5 text-gray-500 text-sm">
                  <MessageCircle size={13} />
                  {customer.wechat}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 border-t border-gray-100 divide-x divide-gray-100">
          <StatCell label="下单次数" value={`${orderCount} 单`} />
          <StatCell label="累计实收" value={totalSpent > 0 ? `$${totalSpent}` : '—'} green={totalSpent > 0} />
          <StatCell label="报价总额" value={`$${totalQuoted}`} />
          <StatCell label="客户来源" value={customer.source || '—'} />
        </div>
      </div>

      {/* Alerts */}
      {unpaidOrders.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          ⚠️ 该客户有 <strong>{unpaidOrders.length}</strong> 笔未付款订单，请跟进
        </div>
      )}

      {/* Order history */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">历史订单</h3>
          <span className="text-xs text-gray-400">{orderCount} 条记录</span>
        </div>

        <div className="divide-y divide-gray-50">
          {customerOrders.map(order => (
            <button
              key={order.id}
              onClick={() => navigate(`/admin/orders/${order.id}`)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 text-left transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-800 font-medium text-sm">{order.date}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-500'}`}>
                    {order.status}
                  </span>
                  <span className="text-gray-400 text-xs">{order.vehicle}</span>
                </div>
                <p className="text-gray-500 text-xs mt-0.5 truncate">
                  {order.fromAddress?.split(',')[0]}
                  {order.toAddress ? ` → ${order.toAddress.split(',')[0]}` : ''}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-green-600 font-semibold text-sm">${order.quote}</p>
                {order.finalAmount && order.finalAmount !== order.quote && (
                  <p className="text-gray-400 text-xs">实收 ${order.finalAmount}</p>
                )}
              </div>
              <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Notes summary */}
      {completedOrders.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm px-4 py-4">
          <h3 className="font-semibold text-gray-700 text-sm mb-3">备注摘要</h3>
          <div className="space-y-2">
            {completedOrders.filter(o => o.notes).slice(0, 3).map(o => (
              <div key={o.id} className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-gray-400 mr-2">{o.date}</span>
                {o.notes}
              </div>
            ))}
            {completedOrders.filter(o => o.notes).length === 0 && (
              <p className="text-gray-300 text-xs">暂无备注记录</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCell({ label, value, green }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className={`font-bold text-sm ${green ? 'text-green-600' : 'text-gray-800'}`}>{value}</p>
      <p className="text-gray-400 text-xs mt-0.5">{label}</p>
    </div>
  )
}
