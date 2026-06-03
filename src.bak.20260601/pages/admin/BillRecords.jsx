import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Download, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
dayjs.locale('zh-cn')

const PERIOD_TABS = [
  { label: '今天',  value: 'today' },
  { label: '本周',  value: 'week' },
  { label: '本月',  value: 'month' },
  { label: '全部',  value: 'all' },
]

const METHOD_TABS = [
  { label: '全部方式', value: 'all' },
  { label: '💵 现金',  value: 'cash' },
  { label: '🏦 转账',  value: 'transfer' },
]

export default function BillRecords() {
  const { orders } = useApp()
  const navigate = useNavigate()
  const [period, setPeriod] = useState('month')
  const [method, setMethod] = useState('all')

  const today = dayjs().format('YYYY-MM-DD')
  const weekStart = dayjs().startOf('week').format('YYYY-MM-DD')
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD')

  // Only orders that have been billed (have finalAmount or are completed/unpaid)
  const billedOrders = orders.filter(o =>
    ['已完成', '客户未付款'].includes(o.status) && o.quote
  )

  const filtered = billedOrders.filter(o => {
    const d = o.date || ''
    const matchPeriod =
      period === 'all'   ? true :
      period === 'today' ? d === today :
      period === 'week'  ? d >= weekStart :
      d >= monthStart

    const matchMethod = method === 'all' || o.paymentMethod === method
    return matchPeriod && matchMethod
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.startTime || '').localeCompare(a.startTime || ''))

  // Stats
  const totalCollected = filtered
    .filter(o => o.status === '已完成')
    .reduce((s, o) => s + (o.finalAmount || o.quote || 0), 0)

  const cashTotal = filtered
    .filter(o => o.status === '已完成' && o.paymentMethod === 'cash')
    .reduce((s, o) => s + (o.finalAmount || o.quote || 0), 0)

  const transferTotal = filtered
    .filter(o => o.status === '已完成' && o.paymentMethod === 'transfer')
    .reduce((s, o) => s + (o.finalAmount || o.quote || 0), 0)

  const unpaidTotal = filtered
    .filter(o => o.status === '客户未付款')
    .reduce((s, o) => s + (o.quote || 0), 0)

  // Group by date
  const grouped = {}
  filtered.forEach(o => {
    const d = o.date || '未知日期'
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(o)
  })
  const groupedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  function exportCSV() {
    const headers = ['日期','时间','客户','电话','车型','报价','实收','付款方式','状态','师傅']
    const WORKER_NAMES = { laomou: '老木', xiaoyu: '小宇', chenxi: '晨曦', laowang: '老王', xiaozhang: '小张' }
    const rows = filtered.map(o => [
      o.date, o.startTime || '',
      o.customerName, o.customerPhone, o.vehicle,
      o.quote || '', o.finalAmount || '',
      o.paymentMethod === 'cash' ? '现金' : o.paymentMethod === 'transfer' ? '转账' : '',
      o.status,
      o.assignedTo ? (WORKER_NAMES[o.assignedTo] || o.assignedTo) : '',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `收款记录_${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">收款记录</h1>
          <p className="text-gray-400 text-sm mt-0.5">已完成订单的收款汇总</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 text-gray-600 border border-gray-200 px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50"
        >
          <Download size={15} />
          导出
        </button>
      </div>

      {/* Period tabs */}
      <div className="flex gap-1.5 mb-4">
        {PERIOD_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setPeriod(t.value)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              period === t.value
                ? 'text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
            style={period === t.value ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="实收合计" value={`$${totalCollected.toFixed(0)}`} color="green" big />
        <StatCard label="💵 现金" value={`$${cashTotal.toFixed(0)}`} color="blue" />
        <StatCard label="🏦 转账" value={`$${transferTotal.toFixed(0)}`} color="indigo" />
        <StatCard label="⚠️ 未付款" value={`$${unpaidTotal.toFixed(0)}`} color={unpaidTotal > 0 ? 'red' : 'gray'} />
      </div>

      {/* Method filter */}
      <div className="flex gap-2 mb-4">
        {METHOD_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setMethod(t.value)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              method === t.value
                ? 'border-gray-400 bg-gray-800 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-400 self-center">{filtered.length} 笔</span>
      </div>

      {/* Records grouped by date */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <p className="text-gray-300 text-4xl mb-3">💰</p>
          <p className="text-gray-400 font-medium">暂无收款记录</p>
          <p className="text-gray-300 text-sm mt-1">完成订单后自动出现在这里</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedDates.map(date => {
            const dayOrders = grouped[date]
            const dayTotal = dayOrders
              .filter(o => o.status === '已完成')
              .reduce((s, o) => s + (o.finalAmount || o.quote || 0), 0)

            return (
              <div key={date} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Date header */}
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-gray-700">
                      {dayjs(date).format('MM月DD日')}
                    </span>
                    <span className="text-gray-400 text-xs ml-2">
                      {dayjs(date).format('dddd')}
                    </span>
                  </div>
                  {dayTotal > 0 && (
                    <span className="text-green-600 font-bold text-sm">${dayTotal.toFixed(0)}</span>
                  )}
                </div>

                {/* Orders */}
                <div className="divide-y divide-gray-50">
                  {dayOrders.map(o => (
                    <BillRow key={o.id} order={o} onClick={() => navigate(`/admin/orders/${o.id}`)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BillRow({ order: o, onClick }) {
  const WORKER_NAMES = { laomou: '老木', xiaoyu: '小宇', chenxi: '晨曦', laowang: '老王', xiaozhang: '小张' }
  const workerName = o.assignedTo ? (WORKER_NAMES[o.assignedTo] || o.assignedTo) : '未派单'
  const isPaid = o.status === '已完成'
  const amount = o.finalAmount || o.quote || 0

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 text-left transition-colors"
    >
      {/* Method icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${
        !isPaid ? 'bg-red-50' :
        o.paymentMethod === 'cash' ? 'bg-green-50' : 'bg-blue-50'
      }`}>
        {!isPaid ? '⚠️' : o.paymentMethod === 'cash' ? '💵' : '🏦'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-900 font-medium text-sm">{o.customerName}</span>
          {!isPaid && (
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">未付款</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
          <span>{o.startTime || '--'}</span>
          <span>·</span>
          <span>{o.vehicle}</span>
          <span>·</span>
          <span>{workerName}</span>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p className={`font-bold text-sm ${isPaid ? 'text-green-600' : 'text-red-500'}`}>
          ${amount.toFixed(0)}
        </p>
        {o.finalAmount && o.finalAmount !== o.quote && (
          <p className="text-gray-400 text-xs">报价 ${o.quote}</p>
        )}
        {o.deposit > 0 && o.depositPaid && (
          <p className="text-gray-400 text-xs">含定金 ${o.deposit}</p>
        )}
      </div>

      <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
    </button>
  )
}

function StatCard({ label, value, color, big }) {
  const colors = {
    green:  'text-green-600',
    blue:   'text-blue-600',
    indigo: 'text-indigo-600',
    red:    'text-red-500',
    gray:   'text-gray-400',
  }
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm text-center">
      <p className={`font-bold ${big ? 'text-2xl' : 'text-xl'} ${colors[color] || 'text-gray-800'}`}>
        {value}
      </p>
      <p className="text-gray-400 text-xs mt-0.5">{label}</p>
    </div>
  )
}
