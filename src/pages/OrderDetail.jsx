import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  ArrowLeft, Phone, MapPin, Package, MessageSquare,
  DollarSign, Calendar, Truck, CheckCircle, PlayCircle
} from 'lucide-react'
import { HEAVY_ITEM_OPTIONS, calcHeavyTotal } from '../data/heavyItems'
function mapUrl(address) {
  const encoded = encodeURIComponent(address)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  return isIOS
    ? `maps://maps.apple.com/?q=${encoded}`
    : `https://maps.google.com/?q=${encoded}`
}

function getCustomerLevel(orders, phone) {
  const count = orders.filter(o => o.customerPhone === phone).length
  if (count >= 9) return { badge: '🌙🌙',      label: '常客',   color: 'bg-purple-100 text-purple-700' }
  if (count === 8) return { badge: '🌙⭐⭐⭐', label: '常客',   color: 'bg-purple-100 text-purple-700' }
  if (count === 7) return { badge: '🌙⭐⭐',   label: '常客',   color: 'bg-purple-100 text-purple-700' }
  if (count === 6) return { badge: '🌙⭐',     label: '常客',   color: 'bg-purple-100 text-purple-700' }
  if (count === 5) return { badge: '🌙',        label: '常客',   color: 'bg-purple-100 text-purple-700' }
  if (count === 4) return { badge: '⭐⭐⭐',   label: '老客户', color: 'bg-yellow-100 text-yellow-700' }
  if (count === 3) return { badge: '⭐⭐',     label: '老客户', color: 'bg-yellow-100 text-yellow-700' }
  if (count === 2) return { badge: '⭐',        label: '回头客', color: 'bg-blue-100 text-blue-700' }
  return { badge: '✦',                           label: '新客户', color: 'bg-gray-100 text-gray-500' }
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { orders, confirmOrder } = useApp()

  const order = orders.find(o => o.id === id)
  if (!order) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">订单不存在</div>
  )

  const canConfirm = order.status === '待确认'
  const canWork    = order.status === '师傅已确认' || order.status === '已派单'
  const customerLevel = getCustomerLevel(orders, order.customerPhone)

  const rm = order.requestedMaterials
  const hasRequestedMaterials = rm && (rm.boxes > 0 || rm.wrapItems > 0 || rm.mattressCovers > 0 || rm.packingItems > 0)


  const checks = order.confirmChecks || {}
  const riskFlags = [
    checks.risk_fridge  && '双开门冰箱',
    checks.risk_tv      && '65" 以上电视',
    checks.risk_marble  && '大理石台面',
    checks.risk_piano   && '钢琴',
    checks.risk_heavy   && '100kg+ 重物',
    checks.risk_parking && '特殊停车',
  ].filter(Boolean)

  return (
    <div className="min-h-screen bg-gray-100 pb-8">

      {/* Header */}
      <div className="px-4 pt-12 pb-5 md:pt-8 shadow-sm"
        style={{ background: 'linear-gradient(135deg, #6b1414 0%, #9b1c1c 50%, #c0392b 100%)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-red-200">
              <ArrowLeft size={22} />
            </button>
            <h1 className="text-white font-bold text-lg flex-1">订单详情</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-red-300 text-xs ml-2">{order.id}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-4">

        {/* Desktop: 2-column layout */}
        <div className="md:grid md:grid-cols-5 md:gap-5">

          {/* Left column (3/5) */}
          <div className="md:col-span-3 space-y-3">

            {/* 时间与车型 */}
            <InfoCard>
              <InfoRow icon={<Calendar size={16} className="text-blue-500" />} label="日期时间">
                {order.date} {order.startTime}
              </InfoRow>
              <InfoRow icon={<Truck size={16} className="text-blue-500" />} label="车型">
                {order.vehicle}
              </InfoRow>
            </InfoCard>

            {/* 客户信息 */}
            <InfoCard title="客户信息">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-gray-900 font-semibold text-base">{order.customerName}</p>
                  <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${customerLevel.color}`}>
                    {customerLevel.badge} {customerLevel.label}
                  </span>
                </div>
                <a
                  href={`tel:${order.customerPhone}`}
                  className="flex items-center gap-2 bg-green-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-600 transition-colors"
                >
                  <Phone size={16} />
                  {order.customerPhone}
                </a>
              </div>
            </InfoCard>

            {/* 地址 */}
            <InfoCard title="搬运地址">
              <div className="space-y-3">
                <AddressRow label="搬出" address={order.fromAddress} color="text-red-500" />
                <div className="border-t border-gray-100" />
                <AddressRow label="搬入" address={order.toAddress} color="text-green-500" />
              </div>
            </InfoCard>

            {/* IKEA 订单专属信息 */}
            {order.serviceType === 'IKEA' && (
              <InfoCard title="🛋️ IKEA 提货安装">
                {order.ikeaService && (
                  <InfoRow icon={<span>✅</span>} label="服务类型">
                    {order.ikeaService}
                  </InfoRow>
                )}
                {order.ikeaOrderNo && (
                  <InfoRow icon={<span>📋</span>} label="IKEA 订单号">
                    <span className="font-mono font-bold text-gray-900">{order.ikeaOrderNo}</span>
                  </InfoRow>
                )}
                {order.needsRubbishDisposal !== undefined && (
                  <InfoRow icon={<span>{order.needsRubbishDisposal ? '🗑️' : '✅'}</span>} label="垃圾处理">
                    <span className={order.needsRubbishDisposal ? 'text-amber-600 font-semibold' : 'text-gray-500'}>
                      {order.needsRubbishDisposal ? '需要处理（收费，客服已确认）' : '不需要'}
                    </span>
                  </InfoRow>
                )}
                {order.ikeaQRCode && (
                  <div className="pt-1">
                    <p className="text-xs text-gray-400 mb-2 font-semibold">取货二维码 / 条形码</p>
                    {typeof order.ikeaQRCode === 'object' && order.ikeaQRCode.data ? (
                      <img src={order.ikeaQRCode.data} alt="IKEA 取货码"
                        className="w-full max-w-xs rounded-xl border border-gray-200" />
                    ) : (
                      <p className="text-xs text-green-600">已上传：{typeof order.ikeaQRCode === 'string' ? order.ikeaQRCode : order.ikeaQRCode?.name}</p>
                    )}
                  </div>
                )}
              </InfoCard>
            )}

            {/* 搬运物品 */}
            <InfoCard title="搬运物品">
              <div className="flex gap-2.5">
                <Package size={16} className="text-purple-500 flex-shrink-0 mt-0.5" />
                <p className="text-gray-800 text-sm leading-relaxed">{order.items}</p>
              </div>
              {order.fragileItems?.length > 0 && (
                <>
                  <div className="border-t border-gray-100 mt-3 pt-3" />
                  <div className="flex gap-2.5">
                    <span className="text-amber-500 text-sm flex-shrink-0">⚠️</span>
                    <p className="text-amber-700 text-sm">易碎物品：{order.fragileItems.join('、')}</p>
                  </div>
                </>
              )}
              {order.notes && (
                <>
                  <div className="border-t border-gray-100 mt-3 pt-3" />
                  <div className="flex gap-2.5">
                    <MessageSquare size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-600 text-sm leading-relaxed">{order.notes}</p>
                  </div>
                </>
              )}
            </InfoCard>

            {/* 客户物资需求 */}
            {hasRequestedMaterials && (
              <InfoCard title="客户需要的物资">
                <div className="space-y-1.5 text-sm">
                  {rm.boxes > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">📦 纸箱</span>
                      <span className="font-medium text-gray-800">{rm.boxes} 个</span>
                    </div>
                  )}
                  {rm.wrapItems > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">🎁 胶带 / 打包膜</span>
                      <span className="font-medium text-gray-800">{rm.wrapItems} 卷</span>
                    </div>
                  )}
                  {rm.mattressCovers > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">🛏 床垫套</span>
                      <span className="font-medium text-gray-800">{rm.mattressCovers} 个</span>
                    </div>
                  )}
                  {rm.packingItems > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">📦 打包物品</span>
                      <span className="font-medium text-gray-800">{rm.packingItems} 件</span>
                    </div>
                  )}
                </div>
              </InfoCard>
            )}

            {/* 附加费用（重物 / 大件）— 客服已确认的，师傅只读显示 */}
            {(() => {
              const hi = order.heavyItems || {}
              const items = HEAVY_ITEM_OPTIONS.filter(opt => Number(hi[opt.id]) > 0)
              const hasOther = hi.other && Number(hi.other.amount) > 0
              const total = calcHeavyTotal(hi)
              if (items.length === 0 && !hasOther) return null
              return (
                <InfoCard title="附加费用（重物 / 大件）">
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mb-2">
                    💪 客服已确认的重物费 — 详细金额可在账单页调整
                  </p>
                  <div className="space-y-1.5 text-sm">
                    {items.map(opt => (
                      <div key={opt.id} className="flex justify-between">
                        <span className="text-gray-700">{opt.name}</span>
                        <span className="font-medium text-gray-800">${hi[opt.id]}</span>
                      </div>
                    ))}
                    {hasOther && (
                      <div className="flex justify-between">
                        <span className="text-gray-700">
                          其他：{hi.other.description || '未命名'}
                        </span>
                        <span className="font-medium text-gray-800">${hi.other.amount}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1.5 mt-1.5 border-t border-gray-100">
                      <span className="text-amber-800 font-medium">附加费用合计</span>
                      <span className="text-amber-800 font-bold">${total}</span>
                    </div>
                  </div>
                </InfoCard>
              )
            })()}

            {/* 风险提醒（客服已标注）*/}
            {riskFlags.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-amber-700 text-xs font-bold mb-2">⚠️ 注意事项（客服已标注）</p>
                <div className="flex flex-wrap gap-1.5">
                  {riskFlags.map(f => (
                    <span key={f} className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-medium">{f}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 客服备注 */}
            {order.csNote && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <p className="text-blue-600 text-xs font-bold mb-1">💬 客服备注</p>
                <p className="text-blue-800 text-sm whitespace-pre-line">{order.csNote}</p>
              </div>
            )}

            {/* 物资清单（如果有）*/}
            {order.materialsCost > 0 && order.materials && (
              <InfoCard title="需携带物资">
                <div className="space-y-1.5 text-sm">
                  {order.materials.boxes > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">📦 纸箱 × {order.materials.boxes}</span>
                      <span className="text-gray-700 font-medium">${order.materials.boxes * 5}</span>
                    </div>
                  )}
                  {order.materials.mattressCovers > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">🛏 床垫套 × {order.materials.mattressCovers}</span>
                      <span className="text-gray-700 font-medium">${order.materials.mattressCovers * 10}</span>
                    </div>
                  )}
                  {order.materials.wrapItems > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">🎁 打包膜 × {order.materials.wrapItems} 件</span>
                      <span className="text-gray-700 font-medium">${order.materials.wrapItems * 5}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-1.5 flex justify-between font-semibold">
                    <span className="text-gray-700">物资合计</span>
                    <span className="text-gray-900">${order.materialsCost}</span>
                  </div>
                </div>
              </InfoCard>
            )}
          </div>

          {/* Right column (2/5) */}
          <div className="md:col-span-2 space-y-3 mt-3 md:mt-0">

            {/* 费用信息 */}
            <InfoCard title="费用信息">
              <InfoRow
                icon={<DollarSign size={16} className="text-green-500" />}
                label="预估报价"
              >
                <span className="text-green-600 font-bold text-lg">${order.quote}</span>
              </InfoRow>
              {order.quoteNote && (
                <p className="text-xs text-gray-400 mt-0.5 pl-7">{order.quoteNote}</p>
              )}
              {order.deposit > 0 && (
                <InfoRow
                  icon={<CheckCircle size={16} className={order.depositPaid ? 'text-green-500' : 'text-gray-400'} />}
                  label="定金"
                >
                  <span className={`font-medium ${order.depositPaid ? 'text-green-600' : 'text-red-500'}`}>
                    ${order.deposit} {order.depositPaid ? '已收' : '未收'}
                  </span>
                </InfoRow>
              )}
            </InfoCard>

            {/* 操作按钮 */}
            {canConfirm && (
              <button
                onClick={() => confirmOrder(id)}
                className="w-full text-white py-4 rounded-xl font-semibold text-base shadow-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}
              >
                <CheckCircle size={20} />
                确认收到订单
              </button>
            )}

            {canWork && (
              <button
                onClick={() => navigate(`/order/${id}/work`)}
                className="w-full text-white py-4 rounded-xl font-semibold text-base shadow-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #8B1A1A, #c0392b)' }}
              >
                <PlayCircle size={20} />
                开始工作
              </button>
            )}

            {order.status === '已完成' && order.finalAmount != null && (
              <InfoCard>
                <InfoRow icon={<DollarSign size={16} className="text-green-500" />} label="实收金额">
                  <span className="text-green-600 font-bold text-lg">${order.finalAmount}</span>
                </InfoRow>
              </InfoCard>
            )}

            {/* 约定时间提醒 */}
            {order.startTime && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <p className="text-blue-600 text-xs font-semibold mb-1">约定到达时间</p>
                <p className="text-blue-800 text-2xl font-bold">{order.startTime}</p>
                <p className="text-blue-500 text-xs mt-1">到达即可开始计时</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const colors = {
    '待确认': 'bg-amber-100 text-amber-700',
    '师傅已确认': 'bg-blue-100 text-blue-700',
    '已派单': 'bg-indigo-100 text-indigo-700',
    '进行中': 'bg-green-100 text-green-700',
    '已完成': 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${colors[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  )
}

function InfoCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      {title && (
        <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">{title}</h3>
      )}
      {children}
    </div>
  )
}

function InfoRow({ icon, label, children }) {
  return (
    <div className="flex items-center gap-3 py-1">
      {icon}
      <span className="text-gray-500 text-sm flex-1">{label}</span>
      <div className="text-gray-800 text-sm font-medium">{children}</div>
    </div>
  )
}

function AddressRow({ label, address, color }) {
  return (
    <div className="flex items-start gap-3">
      <MapPin size={16} className={`flex-shrink-0 mt-0.5 ${color}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold mb-0.5 ${color}`}>{label}</p>
        <p className="text-gray-800 text-sm leading-snug">{address}</p>
      </div>
      <a
        href={mapUrl(address)}
        className="flex-shrink-0 text-blue-600 text-xs font-semibold bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
      >
        地图
      </a>
    </div>
  )
}
