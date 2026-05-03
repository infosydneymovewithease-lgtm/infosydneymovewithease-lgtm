import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Phone, Search, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { useApp } from '../../context/AppContext'

const GRAD   = 'linear-gradient(135deg, #C94F6D, #E97873)'
const BG     = '#FFF3F0'
const MID    = '#C94F6D'
const BORDER = '#F3C9C3'

const STATUS_STYLE = {
  '待确认':   { bg: '#FEF9C3', color: '#854D0E', icon: Clock },
  '已报价':   { bg: '#DBEAFE', color: '#1D4ED8', icon: Clock },
  '已收定金': { bg: '#DCFCE7', color: '#166534', icon: CheckCircle },
  '已派单':   { bg: '#EDE9FE', color: '#5B21B6', icon: CheckCircle },
  '进行中':   { bg: '#FEF3C7', color: '#92400E', icon: Clock },
  '已完成':   { bg: '#F0FDF4', color: '#166534', icon: CheckCircle },
  '已取消':   { bg: '#F1F5F9', color: '#64748B', icon: AlertCircle },
}

export default function MyOrder() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { orders, storageOrders } = useApp()

  const [orderId, setOrderId] = useState(searchParams.get('id') || '')
  const [phone,   setPhone]   = useState(searchParams.get('phone') || '')
  const [order,   setOrder]   = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [searched, setSearched] = useState(false)

  // Auto-lookup if URL has params
  useEffect(() => {
    if (searchParams.get('id') && searchParams.get('phone')) {
      doSearch(searchParams.get('id'), decodeURIComponent(searchParams.get('phone')))
    }
  }, [orders])

  function doSearch(id, ph) {
    const trimId = (id || orderId).trim().toUpperCase()
    const trimPh = (ph || phone).trim().replace(/\s/g, '')
    const found =
      orders.find(o =>
        o.id === trimId &&
        (o.customerPhone || '').replace(/\s/g, '') === trimPh
      ) ||
      (storageOrders || []).find(o =>
        o.id === trimId &&
        (o.customerPhone || '').replace(/\s/g, '') === trimPh
      )
    setSearched(true)
    if (found) { setOrder(found); setNotFound(false) }
    else        { setOrder(null); setNotFound(true)  }
  }

  function handleSearch(e) {
    e.preventDefault()
    doSearch()
  }

  const statusInfo = order ? (STATUS_STYLE[order.status] || { bg: '#F3F4F6', color: '#374151', icon: Clock }) : null
  const StatusIcon = statusInfo?.icon || Clock

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      {/* Header */}
      <div className="bg-white sticky top-0 z-10" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <span className="font-bold text-gray-900 flex-1">查看我的预约</span>
          <a href="tel:0450461917" className="flex items-center gap-1 text-sm font-medium"
            style={{ color: MID }}>
            <Phone size={14} /> 联系客服
          </a>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Lookup form */}
        <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
          <h2 className="font-bold text-gray-800 mb-1 text-sm">查询预约订单</h2>
          <p className="text-xs text-gray-400 mb-3">输入下单时的订单号和手机号</p>
          <form onSubmit={handleSearch} className="space-y-2.5">
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">订单号</label>
              <input
                value={orderId}
                onChange={e => setOrderId(e.target.value)}
                placeholder="ORD-20260501-123"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">预留手机号</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="04xx xxx xxx"
                type="tel"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </div>
            <button type="submit"
              className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
              style={{ background: GRAD }}>
              <Search size={15} /> 查询订单
            </button>
          </form>
        </div>

        {/* Not found */}
        {searched && notFound && (
          <div className="bg-white rounded-2xl p-5 text-center shadow-sm"
            style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-3xl mb-3">🔍</p>
            <p className="font-bold text-gray-800 mb-1">未找到订单</p>
            <p className="text-xs text-gray-400 mb-4">
              请确认订单号与手机号是否正确，或联系客服查询
            </p>
            <a href="tel:0450461917"
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl text-white"
              style={{ background: GRAD }}>
              <Phone size={14} /> 电话联系客服
            </a>
          </div>
        )}

        {/* Order details */}
        {order && (
          <div className="space-y-3">
            {/* Status card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-400">订单号</p>
                  <p className="font-bold text-gray-800">{order.id}</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold"
                  style={{ background: statusInfo?.bg, color: statusInfo?.color }}>
                  <StatusIcon size={13} />
                  {order.status}
                </div>
              </div>

              {order.status === '待确认' && (
                <div className="rounded-xl p-3 text-xs text-amber-700 bg-amber-50 mt-1">
                  客服将在 1 小时内致电确认。确认后请及时支付定金锁定档期。
                </div>
              )}
              {order.status === '已收定金' && (
                <div className="rounded-xl p-3 text-xs text-green-700 bg-green-50 mt-1">
                  定金已收，档期已锁定。搬家当天请保持电话畅通。
                </div>
              )}
              {order.depositStatus === '待付定金' && order.status !== '已取消' && order.status !== '已完成' && (
                <div className="rounded-xl p-3 text-xs text-orange-700 bg-orange-50 mt-1">
                  ⚠️ 定金未收，档期未锁定。请联系客服确认后尽快支付定金。
                </div>
              )}
            </div>

            {/* Service details */}
            {order.serviceType === '寄存' ? (
              <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3"
                style={{ border: `1px solid ${BORDER}` }}>
                <h3 className="font-bold text-gray-800 text-sm">寄存详情</h3>
                {[
                  { label: '服务类型', value: '物品寄存' },
                  { label: '取件车型', value: order.vehicle },
                  { label: '上门取件', value: order.moveInDate || order.date },
                  { label: '到达时段', value: order.startTime },
                  { label: '预计取回', value: order.moveOutDate },
                  { label: '存放约', value: order.weeks ? `${order.weeks} 周` : null },
                  { label: '存储物品', value: [order.boxes && `纸箱 ${order.boxes} 箱`, order.furniture && `家具 ${order.furniture} 件`].filter(Boolean).join(' / ') || null },
                  { label: '存储费参考', value: order.weeklyFee ? `$${order.weeklyFee}/周（运输费另计）` : '客服确认后报价' },
                ].filter(r => r.value).map(row => (
                  <div key={row.label} className="flex items-start justify-between text-sm">
                    <span className="text-gray-400 flex-shrink-0 w-20">{row.label}</span>
                    <span className="font-medium text-gray-800 text-right">{row.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3"
                style={{ border: `1px solid ${BORDER}` }}>
                <h3 className="font-bold text-gray-800 text-sm">预约详情</h3>
                {[
                  { label: '服务类型', value: order.vehicleName || order.vehicle },
                  { label: '团队配置', value: order.vehicleConfig },
                  { label: '搬家日期', value: order.date },
                  { label: '到达时段', value: order.startTime },
                  { label: '收费参考', value: order.quoteNote ? `$${order.quoteNote}` : (order.quote ? `$${order.quote}起` : '客服确认后报价') },
                ].filter(r => r.value).map(row => (
                  <div key={row.label} className="flex items-start justify-between text-sm">
                    <span className="text-gray-400 flex-shrink-0 w-20">{row.label}</span>
                    <span className="font-medium text-gray-800 text-right">{row.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Addresses */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3"
              style={{ border: `1px solid ${BORDER}` }}>
              <h3 className="font-bold text-gray-800 text-sm">搬运地址</h3>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">搬出地址</p>
                <p className="text-sm text-gray-800 font-medium">{order.fromAddress}</p>
              </div>
              <div className="h-px bg-gray-100" />
              <div>
                <p className="text-xs text-gray-400 mb-0.5">搬入地址</p>
                <p className="text-sm text-gray-800 font-medium">{order.toAddress}</p>
              </div>
            </div>

            {/* Items */}
            {order.items && (
              <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
                <h3 className="font-bold text-gray-800 mb-2 text-sm">搬运物品</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{order.items}</p>
              </div>
            )}

            {/* Requested materials */}
            {order.requestedMaterials && (order.requestedMaterials.boxes > 0 || order.requestedMaterials.wrapItems > 0) && (
              <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
                <h3 className="font-bold text-gray-800 mb-2 text-sm">📦 物资需求</h3>
                <div className="space-y-1.5">
                  {order.requestedMaterials.boxes > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">纸箱</span>
                      <span className="font-medium text-gray-800">{order.requestedMaterials.boxes} 个</span>
                    </div>
                  )}
                  {order.requestedMaterials.wrapItems > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">胶带 / 打包膜</span>
                      <span className="font-medium text-gray-800">{order.requestedMaterials.wrapItems} 卷</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rubbish disposal (IKEA) */}
            {order.serviceType === 'IKEA' && order.needsRubbishDisposal !== undefined && (
              <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
                <h3 className="font-bold text-gray-800 mb-2 text-sm">🗑️ 垃圾处理</h3>
                <p className="text-sm text-gray-600">
                  {order.needsRubbishDisposal ? '需要处理包装垃圾' : '不需要垃圾处理'}
                </p>
              </div>
            )}

            {/* Tips */}
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
              <h3 className="font-bold text-gray-800 mb-2.5 text-sm">📋 温馨提示</h3>
              <div className="space-y-1.5 text-sm text-gray-600">
                {(order.serviceType === 'IKEA'
                  ? ['请确认 IKEA 订单已可取货', '请提供完整订单截图 / 二维码', '请提前预留停车位', '公寓请提前预约电梯']
                  : order.serviceType === '寄存'
                  ? ['请提前整理好需要寄存的物品', '易碎品请提前说明', '公寓请提前预约电梯', '请提前预留停车位']
                  : ['请提前预留停车位', '公寓请提前预约电梯', '提前打包易碎 / 贵重物品', '楼梯、重物、长距离搬运请提前告知']
                ).map(tip => (
                  <div key={tip} className="flex items-start gap-2">
                    <span className="text-green-500 flex-shrink-0 mt-0.5 font-bold text-xs">✓</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Deposit */}
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
              <h3 className="font-bold text-gray-800 mb-3 text-sm">定金状态</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">当前状态</span>
                <span className={`text-sm font-semibold ${order.depositStatus === '已上传截图' || order.depositPaid ? 'text-green-600' : 'text-orange-500'}`}>
                  {order.depositPaid ? '已收定金' : (order.depositStatus || '待付定金')}
                </span>
              </div>
              {!order.depositPaid && order.status !== '已取消' && (
                <div className="mt-3 rounded-xl p-3 text-xs"
                  style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                  <p className="font-semibold text-orange-800 mb-1">转账收款账户</p>
                  <div className="text-orange-700 space-y-0.5">
                    <p>银行：Commonwealth Bank (CBA)</p>
                    <p>户名：Move With Ease</p>
                    <p>BSB：062-000 &nbsp;|&nbsp; 账号：1234 5678</p>
                    <p>PayID：0450 461 917</p>
                  </div>
                  <p className="text-orange-500 mt-1.5">转账备注请填写姓名及订单号</p>
                </div>
              )}
            </div>

            {/* Contact */}
            <div className="rounded-2xl p-4" style={{ background: BG, border: `1px solid ${BORDER}` }}>
              <p className="text-xs text-gray-500 text-center mb-3">如需修改或取消预约，请联系客服</p>
              <a href="tel:0450461917"
                className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-2xl block text-center"
                style={{ background: GRAD }}>
                <Phone size={16} /> 0450 461 917
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
