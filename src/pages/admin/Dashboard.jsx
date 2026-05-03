import { useApp } from '../../context/AppContext'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
dayjs.locale('zh-cn')
import {
  AlertTriangle, CheckCircle, Clock, DollarSign,
  Truck, UserX, FileX, CreditCard, PlusCircle, ArrowRight
} from 'lucide-react'

const STATUS_COLOR = {
  '待确认':        'bg-yellow-100 text-yellow-700',
  '已报价':        'bg-blue-100 text-blue-600',
  '已收定金':      'bg-green-100 text-green-700',
  '已派单':        'bg-indigo-100 text-indigo-700',
  '师傅已确认':        'bg-blue-100 text-blue-700',
  '进行中':        'bg-orange-100 text-orange-700',
  '未提交账单': 'bg-yellow-100 text-yellow-800',
  '师傅已提交账单':'bg-purple-100 text-purple-700',
  '客户未付款':    'bg-red-100 text-red-700',
  '已完成':        'bg-gray-100 text-gray-500',
  '已取消':        'bg-gray-100 text-gray-400',
}

export default function Dashboard() {
  const { orders, user } = useApp()
  const navigate = useNavigate()
  const today = dayjs().format('YYYY-MM-DD')

  const todayOrders = orders
    .filter(o => o.date === today)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))

  const sevenDaysAgo = dayjs().subtract(7, 'day').format('YYYY-MM-DD')
  const recentOrders = orders
    .filter(o => o.date && o.date >= sevenDaysAgo && o.date < today)
    .sort((a, b) => b.date.localeCompare(a.date) || (a.startTime || '').localeCompare(b.startTime || ''))

  const unassigned = orders.filter(o => !o.assignedTo && !['已完成','已取消'].includes(o.status))
  const pendingBill = orders.filter(o => o.status === '未提交账单')
  const unpaid = orders.filter(o => o.status === '客户未付款')
  const noDeposit = orders.filter(o => o.deposit > 0 && !o.depositPaid && !['已完成','已取消'].includes(o.status))

  const todayRevenue = orders
    .filter(o => o.date === today && o.finalAmount)
    .reduce((sum, o) => sum + (o.finalAmount || 0), 0)

  const alerts = [
    unassigned.length > 0 && {
      level: 'red',
      icon: Truck,
      text: `${unassigned.length} 单未派单`,
      action: () => navigate('/admin/orders'),
    },
    pendingBill.length > 0 && {
      level: 'red',
      icon: FileX,
      text: `${pendingBill.length} 位师傅未提交账单`,
      action: () => navigate('/admin/orders'),
    },
    unpaid.length > 0 && {
      level: 'red',
      icon: CreditCard,
      text: `${unpaid.length} 单客户未付款`,
      action: () => navigate('/admin/orders'),
    },
    noDeposit.length > 0 && {
      level: 'yellow',
      icon: DollarSign,
      text: `${noDeposit.length} 单定金未收`,
      action: () => navigate('/admin/orders'),
    },
  ].filter(Boolean)

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5">

      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            你好，{user?.name} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {dayjs().format('YYYY年MM月DD日')} · 今天共 {todayOrders.length} 单
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/orders/new')}
          className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm active:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}
        >
          <PlusCircle size={16} />
          新建订单
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="今日订单" value={todayOrders.length} icon={ClipboardList} color="blue" />
        <StatCard label="今日收入" value={`$${todayRevenue}`} icon={DollarSign} color="green" />
        <StatCard label="待派单" value={unassigned.length} icon={Truck} color={unassigned.length > 0 ? 'red' : 'gray'} />
        <StatCard label="未付款" value={unpaid.length} icon={CreditCard} color={unpaid.length > 0 ? 'red' : 'gray'} />
      </div>

      {/* Alert center */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <h2 className="font-semibold text-gray-800 text-sm">需要处理</h2>
            <span className="ml-auto bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {alerts.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {alerts.map((a, i) => (
              <button
                key={i}
                onClick={a.action}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  a.level === 'red' ? 'bg-red-100' : 'bg-yellow-100'
                }`}>
                  <a.icon size={16} className={a.level === 'red' ? 'text-red-500' : 'text-yellow-600'} />
                </div>
                <span className="text-gray-700 text-sm flex-1">{a.text}</span>
                <ArrowRight size={14} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <CheckCircle size={18} className="text-green-500" />
          <span className="text-green-700 text-sm font-medium">暂无待处理事项，今天进展顺利！</span>
        </div>
      )}

      {/* Today's orders — all of them */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Clock size={16} className="text-blue-500" />
          <h2 className="font-semibold text-gray-800 text-sm">今日订单</h2>
          <span className="text-xs bg-blue-100 text-blue-600 font-bold px-2 py-0.5 rounded-full ml-1">
            {todayOrders.length}
          </span>
          <button
            onClick={() => navigate('/admin/orders/new')}
            className="ml-auto text-red-600 text-xs font-medium hover:underline flex items-center gap-1"
          >
            + 新建
          </button>
        </div>
        {todayOrders.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">今日暂无订单</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {todayOrders.map(order => (
              <OrderRow key={order.id} order={order} onClick={() => navigate(`/admin/orders/${order.id}`)} />
            ))}
          </div>
        )}
      </div>

      {/* Recent 7 days — grouped by date */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <h2 className="font-semibold text-gray-800 text-sm">最近7天</h2>
          <span className="text-xs bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full ml-1">
            {recentOrders.length}
          </span>
          <button
            onClick={() => navigate('/admin/orders')}
            className="ml-auto text-red-600 text-xs font-medium hover:underline flex items-center gap-1"
          >
            全部订单 <ArrowRight size={12} />
          </button>
        </div>
        {recentOrders.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">近7天无历史订单</div>
        ) : (
          <div>
            {groupByDate(recentOrders).map(({ date, items }) => (
              <div key={date}>
                <div className="px-4 py-1.5 bg-gray-50 border-y border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {dayjs(date).format('MM月DD日')} · {dayjs(date).format('dddd')}
                  </p>
                </div>
                <div className="divide-y divide-gray-50">
                  {items.map(order => (
                    <OrderRow key={order.id} order={order} onClick={() => navigate(`/admin/orders/${order.id}`)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function groupByDate(orders) {
  const map = {}
  orders.forEach(o => {
    if (!map[o.date]) map[o.date] = []
    map[o.date].push(o)
  })
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }))
}

function StatCard({ label, value, icon: Icon, color }) {
  const colors = {
    blue:  { bg: 'bg-blue-50',  icon: 'text-blue-500',  val: 'text-blue-700'  },
    green: { bg: 'bg-green-50', icon: 'text-green-500', val: 'text-green-700' },
    red:   { bg: 'bg-red-50',   icon: 'text-red-500',   val: 'text-red-700'   },
    gray:  { bg: 'bg-gray-50',  icon: 'text-gray-400',  val: 'text-gray-600'  },
  }
  const c = colors[color] || colors.gray
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
        <Icon size={18} className={c.icon} />
      </div>
      <p className={`text-2xl font-bold ${c.val}`}>{value}</p>
      <p className="text-gray-500 text-xs mt-0.5">{label}</p>
    </div>
  )
}

function ClipboardList({ size, className }) {
  return (
    <svg width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )
}

function OrderRow({ order, onClick }) {
  const workerName = order.assignedTo
    ? { laomou: '老木', xiaoyu: '小宇', chenxi: '晨曦', laowang: '老王', xiaozhang: '小张' }[order.assignedTo] || order.assignedTo
    : null

  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors">
      <div className="flex-shrink-0 text-center w-12">
        <p className="text-gray-800 font-semibold text-sm">{order.startTime || '--'}</p>
        <p className="text-gray-400 text-xs">{order.vehicle}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-gray-900 font-medium text-sm truncate">{order.customerName}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-500'}`}>
            {order.status}
          </span>
        </div>
        <p className="text-gray-500 text-xs truncate mt-0.5">
          {order.fromAddress?.split(',')[0]} → {order.toAddress?.split(',')[0]}
        </p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-green-600 font-semibold text-sm">${order.quote}</p>
        <p className="text-gray-400 text-xs">{workerName || '未派单'}</p>
      </div>
    </button>
  )
}
