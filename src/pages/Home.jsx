import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getTodayHoliday } from '../data/holidays'
import { MOCK_ANNOUNCEMENTS } from '../data/mockData'
import { AlertTriangle, Bell, ChevronRight, Clock, CheckCircle, Loader, LogOut, History } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
dayjs.locale('zh-cn')

const STATUS_CONFIG = {
  '待确认': { color: 'bg-amber-100 text-amber-700', icon: <Clock size={12} /> },
  '已派单': { color: 'bg-indigo-100 text-indigo-700', icon: <Bell size={12} /> },
  '师傅已确认': { color: 'bg-red-100 text-red-700',    icon: <CheckCircle size={12} /> },
  '进行中': { color: 'bg-green-100 text-green-700', icon: <Loader size={12} /> },
  '已完成': { color: 'bg-gray-100 text-gray-500',   icon: <CheckCircle size={12} /> },
}

const TYPE_BADGE = {
  '搬家':    { label: '🚚 搬家',   cls: 'bg-blue-50 text-blue-600' },
  'IKEA':    { label: '🛒 IKEA',  cls: 'bg-yellow-50 text-yellow-700' },
  '清洁':    { label: '🧹 清洁',   cls: 'bg-teal-50 text-teal-600' },
  '清洁服务': { label: '🧹 清洁',  cls: 'bg-teal-50 text-teal-600' },
  '家具组装': { label: '🔧 组装',  cls: 'bg-orange-50 text-orange-600' },
  '寄存':    { label: '📦 寄存',   cls: 'bg-purple-50 text-purple-600' },
  '其他':    { label: '📋 其他',   cls: 'bg-gray-100 text-gray-500' },
}

export default function Home() {
  const { worker, logout, getMyOrders, getMyStorageOrders, confirmOrder } = useApp()
  const navigate = useNavigate()
  const holiday = getTodayHoliday()
  const myOrders = getMyOrders()
  const myStorageOrders = getMyStorageOrders()
  const today = dayjs()

  // 师傅端只显示最近 7 天的已完成订单，超过 7 天自动归档（管理员后台仍可查全量）
  const recentCutoff = today.subtract(7, 'day').format('YYYY-MM-DD')
  const isRecent = o => (o.date || '') >= recentCutoff

  const active = myOrders.filter(o => !['已完成', '已取消'].includes(o.status))
  const done   = myOrders.filter(o => o.status === '已完成' && isRecent(o))
  const activeStorage = myStorageOrders.filter(o => !['寄存中', '已取出', '已完成', '已取消'].includes(o.status))
  const doneStorage   = myStorageOrders.filter(o => o.status === '寄存中' && isRecent(o))
  const totalPending = active.length + activeStorage.length
  const totalDone    = done.length + doneStorage.length

  return (
    <div className="min-h-screen bg-gray-100 pb-8">

      {/* Header */}
      <div className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #6b1414 0%, #9b1c1c 50%, #c0392b 100%)' }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10 bg-red-400" />
        <div className="absolute top-4 right-16 w-20 h-20 rounded-full opacity-10 bg-red-300" />

        <div className="relative max-w-5xl mx-auto px-5 pt-12 pb-8 md:pt-8 md:pb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white overflow-hidden shadow-lg flex-shrink-0">
                <img src="/logo.jpg" alt="logo" className="w-full h-full object-contain p-0.5" />
              </div>
              <div>
                <p className="text-red-300 text-xs tracking-widest uppercase">Move With Ease</p>
                <p className="text-white text-xs opacity-60 mt-0.5">
                  {today.format('MM月DD日')} · {today.format('dddd')}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-red-200 text-sm px-3 py-1.5 rounded-xl border border-red-700 hover:bg-red-900 transition-colors"
            >
              <LogOut size={14} />
              退出
            </button>
          </div>

          <div className="md:flex md:items-end md:justify-between">
            <div>
              <h1 className="text-white text-2xl md:text-3xl font-bold">
                你好，{worker?.name} 👋
              </h1>
              <p className="text-red-300 text-sm mt-1">
                今日待处理 <span className="text-white font-bold">{totalPending}</span> 单
              </p>
            </div>
            {/* Desktop stats */}
            <div className="hidden md:flex items-center gap-6 mt-4 md:mt-0">
              <Stat label="待处理" value={totalPending} />
              <Stat label="已完成" value={totalDone} />
              <Stat label="总计" value={myOrders.length + myStorageOrders.length} />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 pt-4 space-y-4">

        {/* 假期警告 */}
        {holiday && (
          <div className="rounded-xl p-4 flex items-start gap-3 shadow"
            style={{ background: 'linear-gradient(135deg, #7f1d1d, #991b1b)' }}>
            <AlertTriangle size={22} className="text-red-200 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white text-base">今天是公共假期</p>
              <p className="text-red-200 text-sm mt-0.5">{holiday.name}</p>
              <p className="text-white text-sm mt-1.5 font-semibold">⚠️ 停车罚款双倍！请务必合法停车</p>
            </div>
          </div>
        )}

        {/* 公司通知 */}
        {MOCK_ANNOUNCEMENTS.length > 0 && (
          <div className="bg-white border-l-4 rounded-xl p-4 shadow-sm" style={{ borderColor: '#8B1A1A' }}>
            <div className="flex items-center gap-2 mb-2.5">
              <Bell size={15} style={{ color: '#8B1A1A' }} />
              <span className="font-semibold text-sm" style={{ color: '#8B1A1A' }}>公司通知</span>
            </div>
            {MOCK_ANNOUNCEMENTS.map(a => (
              <p key={a.id} className="text-gray-700 text-sm leading-relaxed">{a.text}</p>
            ))}
          </div>
        )}

        {/* 待处理订单（搬家 + 寄存合并） */}
        <div>
          <SectionHeader label="待处理订单" count={active.length + activeStorage.length} accent />
          {(active.length + activeStorage.length) === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm shadow-sm">
              暂无待处理订单
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeStorage.map(order => (
                <StorageCard key={order.id} order={order} onClick={() => navigate(`/storage/${order.id}`)} />
              ))}
              {active.map(order => (
                <OrderCard key={order.id} order={order}
                  onClick={() => navigate(`/order/${order.id}`)}
                  onConfirm={confirmOrder} />
              ))}
            </div>
          )}
        </div>

        {/* 已完成订单（最近 7 天，搬家 + 寄存合并）*/}
        {(done.length + doneStorage.length) > 0 && (
          <div>
            <SectionHeader label="已完成订单（最近 7 天）" count={done.length + doneStorage.length} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {doneStorage.map(order => (
                <StorageCard key={order.id} order={order} onClick={() => navigate(`/storage/${order.id}`)} />
              ))}
              {done.map(order => (
                <OrderCard key={order.id} order={order}
                  onClick={() => navigate(`/order/${order.id}`)} />
              ))}
            </div>
          </div>
        )}

        {/* 历史订单入口 */}
        <button
          onClick={() => navigate('/worker/history')}
          className="w-full bg-white rounded-xl py-3 px-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow active:opacity-70"
        >
          <span className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
            <History size={16} className="text-gray-500" />
            历史订单（最近 7 天 · 含搜索/筛选）
          </span>
          <ChevronRight size={18} className="text-gray-300" />
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-white text-2xl font-bold">{value}</p>
      <p className="text-red-300 text-xs">{label}</p>
    </div>
  )
}

function SectionHeader({ label, count, accent }) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <div className={`w-1 h-4 rounded-full ${accent ? '' : 'bg-gray-300'}`}
        style={accent ? { background: '#8B1A1A' } : {}} />
      <h2 className={`font-bold text-sm ${accent ? 'text-gray-700' : 'text-gray-400'}`}>{label}</h2>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${accent ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
        {count}
      </span>
    </div>
  )
}

const STORAGE_STATUS_COLOR = {
  '待确认': 'bg-yellow-100 text-yellow-700',
  '已确认': 'bg-blue-100 text-blue-700',
  '已派单': 'bg-purple-100 text-purple-700',
  '寄存中': 'bg-gray-100 text-gray-500',
}

function StorageCard({ order, onClick }) {
  const color = STORAGE_STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-500'
  return (
    <button onClick={onClick}
      className="w-full bg-white rounded-xl p-4 text-left shadow-sm hover:shadow-md transition-shadow active:opacity-70">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
              📦 {order.status}
            </span>
            <span className="text-gray-300 text-xs hidden sm:inline">{order.id}</span>
          </div>
          <p className="text-gray-900 font-bold text-base truncate">{order.customerName}</p>
          <p className="text-gray-400 text-sm mt-0.5">入库：{order.moveInDate}</p>
          <p className="text-gray-400 text-xs mt-1">
            纸箱 {order.boxes}件{order.furniture > 0 ? `  家具 ${order.furniture}件` : ''}
          </p>
        </div>
        <ChevronRight size={20} className="text-gray-300 flex-shrink-0 mt-1" />
      </div>
    </button>
  )
}

function OrderCard({ order, onClick, onConfirm }) {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['待确认']
  const typeBadge = TYPE_BADGE[order.serviceType]
  const needsConfirm = order.status === '已派单' && onConfirm

  return (
    <div className="w-full bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex">
      {/* Main tap area → navigate */}
      <button onClick={onClick} className="flex-1 min-w-0 p-4 text-left active:opacity-70">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {typeBadge && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${typeBadge.cls}`}>
              {typeBadge.label}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
            {cfg.icon}&nbsp;{order.status}
          </span>
        </div>
        <p className="text-gray-900 font-bold text-base truncate">{order.customerName}</p>
        <p className="text-gray-400 text-sm mt-0.5 truncate">{order.fromAddress}</p>
        <div className="flex items-center gap-3 mt-2">
          {order.vehicle && (
            <span className="text-sm font-semibold px-2 py-0.5 rounded-md"
              style={{ color: '#8B1A1A', background: '#fef2f2' }}>
              {order.vehicle}
            </span>
          )}
          <span className="text-gray-400 text-xs">{order.date} {order.startTime}</span>
        </div>
      </button>

      {/* Right action */}
      {needsConfirm ? (
        <button
          onClick={async () => {
            try { await onConfirm(order.id) }
            catch (err) { alert(err.message || '确认失败，请重试') }
          }}
          className="flex-shrink-0 w-16 flex flex-col items-center justify-center gap-1 text-white text-xs font-bold"
          style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
          <CheckCircle size={18} />
          <span>确认</span>
          <span>收单</span>
        </button>
      ) : (
        <button onClick={onClick} className="flex-shrink-0 flex items-center pr-3 text-gray-300 active:opacity-70">
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  )
}
