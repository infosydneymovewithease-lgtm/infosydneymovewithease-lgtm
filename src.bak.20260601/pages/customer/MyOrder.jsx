import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, LogOut, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp, CalendarDays, Truck } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import VerifyCodeModal from '../../components/VerifyCodeModal'

const GRAD   = 'linear-gradient(135deg, #8B2635, #C0392B)'
const MID    = '#8B2635'
const BORDER = '#EFEFEF'
const BG     = '#F7F7F7'

const STATUS_STYLE = {
  '待确认':   { bg: '#FEF9C3', color: '#854D0E', icon: Clock },
  '已报价':   { bg: '#DBEAFE', color: '#1D4ED8', icon: Clock },
  '已收定金': { bg: '#DCFCE7', color: '#166534', icon: CheckCircle },
  '已派单':   { bg: '#EDE9FE', color: '#5B21B6', icon: CheckCircle },
  '进行中':   { bg: '#FEF3C7', color: '#92400E', icon: Clock },
  '已完成':   { bg: '#F0FDF4', color: '#166534', icon: CheckCircle },
  '已取消':   { bg: '#F1F5F9', color: '#64748B', icon: AlertCircle },
}

function OrderCard({ order }) {
  const [expanded, setExpanded] = useState(false)
  const statusInfo = STATUS_STYLE[order.status] || { bg: '#F3F4F6', color: '#374151', icon: Clock }
  const StatusIcon = statusInfo.icon

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
      {/* Summary row — always visible */}
      <button
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#FDF2F2' }}>
            <Truck size={16} style={{ color: MID }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 truncate">{order.id}</p>
            <p className="text-sm font-semibold text-gray-800 truncate">
              {order.vehicleName || order.vehicle || order.serviceType}
            </p>
            <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
              <CalendarDays size={11} />
              <span>{order.date || order.moveInDate}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ background: statusInfo.bg, color: statusInfo.color }}>
            <StatusIcon size={11} />
            {order.status}
          </span>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-4 py-4 space-y-3" style={{ borderColor: BORDER }}>

          {/* Customer info */}
          {(order.customerName || order.customerPhone || order.customer_code) && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">客户信息</p>
              {[
                { label: '姓名',     value: order.customerName },
                { label: '手机号',   value: order.customerPhone },
                { label: '档案编号', value: order.customer_code },
              ].filter(r => r.value).map(row => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 w-20">{row.label}</span>
                  <span className={`font-medium ${row.label === '档案编号' ? 'tracking-widest font-black' : 'text-gray-800'}`}
                    style={row.label === '档案编号' ? { color: MID } : {}}>
                    {row.value}
                  </span>
                </div>
              ))}
              <div className="h-px bg-gray-100" />
            </div>
          )}

          {/* Service details */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">预约详情</p>
            {order.serviceType === '寄存' ? [
              { label: '服务',   value: '物品寄存' },
              { label: '车型',   value: order.vehicle },
              { label: '取件日', value: order.moveInDate || order.date },
              { label: '到达',   value: order.startTime },
              { label: '预计取回', value: order.moveOutDate },
              { label: '费用',   value: order.weeklyFee ? `$${order.weeklyFee}/周` : '客服报价' },
            ] : [
              { label: '车型',   value: order.vehicleName || order.vehicle },
              { label: '配置',   value: order.vehicleConfig },
              { label: '日期',   value: order.date },
              { label: '到达',   value: order.startTime },
              { label: '费用',   value: order.quoteNote ? `$${order.quoteNote}` : (order.quote ? `$${order.quote}起` : '客服报价') },
            ].filter(r => r.value).map(row => (
              <div key={row.label} className="flex items-start justify-between text-sm">
                <span className="text-gray-400 w-20 flex-shrink-0">{row.label}</span>
                <span className="font-medium text-gray-800 text-right">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Addresses */}
          {(order.fromAddress || order.toAddress) && (
            <div className="space-y-2">
              <div className="h-px bg-gray-100" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">搬运地址</p>
              {order.fromAddress && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">搬出</p>
                  <p className="text-sm text-gray-800 font-medium">{order.fromAddress}</p>
                </div>
              )}
              {order.toAddress && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">搬入</p>
                  <p className="text-sm text-gray-800 font-medium">{order.toAddress}</p>
                </div>
              )}
            </div>
          )}

          {/* Deposit */}
          <div className="h-px bg-gray-100" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">定金状态</span>
            <span className={`font-semibold ${order.depositPaid ? 'text-green-600' : 'text-orange-500'}`}>
              {order.depositPaid ? '已收定金' : (order.depositStatus || '待付定金')}
            </span>
          </div>

          {/* Status hint */}
          {order.status === '待确认' && (
            <div className="rounded-xl p-3 text-xs text-amber-700 bg-amber-50">
              客服将在 1 小时内致电确认，确认后请及时支付定金锁定档期
            </div>
          )}

          {/* Contact */}
          <a href="tel:0426033899"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white text-sm font-semibold"
            style={{ background: GRAD }}>
            <Phone size={14} /> 联系客服
          </a>
        </div>
      )}
    </div>
  )
}

export default function MyOrder() {
  const navigate = useNavigate()
  const { orders, storageOrders } = useApp()

  const [savedPhone, setSavedPhone] = useState(() => localStorage.getItem('mwe_phone') || '')
  const savedName = localStorage.getItem('mwe_name') || ''

  const [inputPhone, setInputPhone]   = useState('')
  const [showVerify, setShowVerify]   = useState(false)

  function handleLogout() {
    localStorage.removeItem('mwe_phone')
    localStorage.removeItem('mwe_name')
    setSavedPhone('')
    setInputPhone('')
  }

  function handleSendCode(e) {
    e.preventDefault()
    if (!inputPhone.trim()) return
    setShowVerify(true)
  }

  function handleVerified() {
    const ph = inputPhone.trim()
    localStorage.setItem('mwe_phone', ph)
    setSavedPhone(ph)
    setShowVerify(false)
  }

  const myOrders = savedPhone
    ? [
        ...(orders || []).filter(o =>
          (o.customerPhone || '').replace(/\s/g, '') === savedPhone.replace(/\s/g, '')
        ),
        ...(storageOrders || []).filter(o =>
          (o.customerPhone || '').replace(/\s/g, '') === savedPhone.replace(/\s/g, '')
        ),
      ].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    : []

  return (
    <div className="min-h-screen pb-24" style={{ background: BG }}>
      {/* Header */}
      <div className="bg-white sticky top-0 z-10" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <span className="font-bold text-gray-900 flex-1">我的预约</span>
          {savedPhone && (
            <button onClick={handleLogout}
              className="flex items-center gap-1 text-xs text-gray-400 px-2 py-1 rounded-lg"
              style={{ border: '1px solid #E5E7EB' }}>
              <LogOut size={12} />
              换号
            </button>
          )}
          <a href="tel:0426033899" className="flex items-center gap-1 text-sm font-medium" style={{ color: MID }}>
            <Phone size={14} /> 客服
          </a>
        </div>
        {/* Logged-in indicator */}
        {savedPhone && (
          <div className="max-w-lg mx-auto px-4 pb-2 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-xs text-gray-500">
              {savedName && `${savedName} · `}
              {savedPhone.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3')}
            </span>
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-3">

        {/* ── Not logged in: phone input ── */}
        {!savedPhone && (
          <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
            <h2 className="font-bold text-gray-800 mb-1">查看我的预约</h2>
            <p className="text-xs text-gray-400 mb-4">输入下单时的手机号，验证后查看所有订单</p>
            <form onSubmit={handleSendCode} className="space-y-3">
              <input
                value={inputPhone}
                onChange={e => setInputPhone(e.target.value)}
                placeholder="04xx xxx xxx"
                type="tel"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
              <button type="submit"
                className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                style={{ background: GRAD }}>
                发送验证码
              </button>
            </form>
          </div>
        )}

        {/* ── Logged in: order list ── */}
        {savedPhone && myOrders.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-3xl mb-3">📋</p>
            <p className="font-bold text-gray-800 mb-1">暂无预约记录</p>
            <p className="text-xs text-gray-400 mb-5">该手机号下还没有订单</p>
            <button onClick={() => navigate('/book/move')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl text-white"
              style={{ background: GRAD }}>
              立即预约
            </button>
          </div>
        )}

        {savedPhone && myOrders.length > 0 && (
          <>
            <p className="text-xs text-gray-400 px-1">共 {myOrders.length} 条记录，点击展开详情</p>
            {myOrders.map(o => <OrderCard key={o.id} order={o} />)}
          </>
        )}
      </div>

      {/* Verify modal */}
      {showVerify && (
        <VerifyCodeModal
          phone={inputPhone}
          onVerified={handleVerified}
          onClose={() => setShowVerify(false)}
        />
      )}
    </div>
  )
}
