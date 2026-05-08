import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { VEHICLES, VAN_PROMO_DISCOUNT } from '../../data/vehicles'
import { HEAVY_ITEM_OPTIONS, calcHeavyTotal } from '../../data/heavyItems'
import {
  ArrowLeft, Phone, MapPin, Package, MessageSquare,
  DollarSign, Calendar, Truck, CheckCircle, User,
  AlertTriangle, Edit3
} from 'lucide-react'

const STATUS_FLOW = [
  '待确认', '已报价', '已收定金', '已派单', '师傅已确认',
  '进行中', '未提交账单', '师傅已提交账单', '已完成', '客户未付款', '已取消',
]

// ── Cleaning pricing model ──
const CLEAN_BASE = { studio: 140, '1b': 160, '2b': 190, '3b': 270 }
const CLEAN_BASE_MULTI_BATH = { '2b': 240, '3b': 300 }
const CLEAN_EXTRAS = {
  '炉灶深度清洁': { min: 50,  flex: false },
  '冰箱内清洁':   { min: 30,  flex: false },
  '洗碗机清洁':   { min: 20,  flex: false },
  '窗户清洁':     { min: 50,  flex: true  },
  '墙面污渍处理': { min: 50,  flex: true  },
  '车库清洁':     { min: 120, flex: true  },
}

function calcCleanPrice(order) {
  if (!order.roomType || order.roomType === '4b+' || order.cleanType === 'carpet') return null
  const multiBath = (order.bathroomCount || 1) >= 2
  const base = multiBath
    ? (CLEAN_BASE_MULTI_BATH[order.roomType] ?? CLEAN_BASE[order.roomType])
    : CLEAN_BASE[order.roomType]
  if (!base) return null
  let extrasMin = 0
  let hasFlexible = false
  ;(order.cleanExtras || []).forEach(e => {
    const p = CLEAN_EXTRAS[e]
    if (p) { extrasMin += p.min; if (p.flex) hasFlexible = true }
  })
  return { base, extrasMin, total: base + extrasMin, hasFlexible }
}

const STATUS_COLOR = {
  '待确认':         'bg-yellow-100 text-yellow-700',
  '已报价':         'bg-blue-100 text-blue-600',
  '已收定金':       'bg-green-100 text-green-700',
  '已派单':         'bg-indigo-100 text-indigo-700',
  '师傅已确认':         'bg-blue-100 text-blue-700',
  '进行中':         'bg-orange-100 text-orange-700',
  '未提交账单':  'bg-yellow-100 text-yellow-800',
  '师傅已提交账单': 'bg-purple-100 text-purple-700',
  '客户未付款':     'bg-red-100 text-red-700',
  '已完成':         'bg-gray-100 text-gray-500',
  '已取消':         'bg-gray-100 text-gray-400',
}

const WORKER_NAMES = {
  laomou: '老木', xiaoyu: '小宇', chenxi: '晨曦', laowang: '老王', xiaozhang: '小张'
}
const STAFF_NAMES = {
  ...WORKER_NAMES,
  phill: 'Phill', annie: 'Annie', xiaoxi: '小溪', xiaomei: '小美',
}

function getCustomerLevel(orders, phone) {
  const count = orders.filter(o => o.customerPhone === phone).length
  if (count <= 1) return { label: '新客户', badge: '' }
  if (count === 2) return { label: '回头客', badge: '⭐' }
  if (count === 3) return { label: '老客户', badge: '⭐⭐' }
  if (count === 4) return { label: '老客户', badge: '⭐⭐⭐' }
  if (count === 5) return { label: '常客', badge: '🌙' }
  if (count === 6) return { label: '常客', badge: '🌙⭐' }
  if (count === 7) return { label: '常客', badge: '🌙⭐⭐' }
  if (count === 8) return { label: '常客', badge: '🌙⭐⭐⭐' }
  return { label: '常客', badge: '🌙🌙' }
}

export default function AdminOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { orders, workers, dispatchOrder, updateOrderStatus, updateOrder } = useApp()

  const order = orders.find(o => o.id === id)
  const [showDispatch, setShowDispatch] = useState(false)
  const [showStatusChange, setShowStatusChange] = useState(false)
  const [selectedWorkers, setSelectedWorkers] = useState(order?.assignedWorkers || [])
  const [editDeposit,  setEditDeposit]  = useState(false)
  const [depositPaid,  setDepositPaid]  = useState(order?.depositPaid || false)
  const [showEditQuote, setShowEditQuote] = useState(false)
  const [quoteInput,   setQuoteInput]   = useState(String(order?.quote || ''))
  const [quoteNoteInput, setQuoteNoteInput] = useState(order?.quoteNote || '')
  const [checks,  setChecks]  = useState(() => order?.confirmChecks || {})
  const [csNote,  setCsNote]  = useState(() => order?.csNote || '')
  const [heavyItems, setHeavyItemsState] = useState(() => order?.heavyItems || {})

  // 重新计算订单总报价 + 拆分明细文案
  function rebuildQuote(newHeavyItems) {
    if (!order) return null
    const v = VEHICLES[order.vehicle]
    if (!v) return null
    const newHeavyFee = calcHeavyTotal(newHeavyItems)
    const baseFee = v.hourlyRate * v.minHours
    const returnFee = v.returnFee
    const remote = Number(order.remoteSurcharge) || 0
    const stairs = Number(order.stairFee) || 0
    const materials = Number(order.materialsCost) || 0
    const vanDiscount = order.vehicle === '面包车' ? VAN_PROMO_DISCOUNT : 0
    const newQuote = Math.max(0,
      baseFee + returnFee + remote + stairs + materials + newHeavyFee - vanDiscount
    )
    const note = [
      `$${v.hourlyRate}×${v.minHours}h + $${returnFee}(返程费) = $${baseFee + returnFee}`,
      vanDiscount > 0 ? `- 优惠 $${vanDiscount}` : null,
      remote   > 0 ? `+ 远途 $${remote}`     : null,
      stairs   > 0 ? `+ 楼梯 $${stairs}`     : null,
      newHeavyFee > 0 ? `+ 重物 $${newHeavyFee}` : null,
      materials > 0 ? `+ 物资 $${materials}` : null,
      `= $${newQuote}起`,
    ].filter(Boolean).join(' ')
    return { quote: newQuote, quoteNote: note, heavyFee: newHeavyFee }
  }

  // 编辑重物项目金额（自动同步保存：heavyItems + heavyFee + quote + quoteNote）
  function updateHeavyItem(itemId, amount) {
    const next = { ...heavyItems, [itemId]: amount }
    setHeavyItemsState(next)
    const recalc = rebuildQuote(next)
    updateOrder(id, { heavyItems: next, ...recalc })
  }
  function updateOtherHeavy(field, value) {
    const next = {
      ...heavyItems,
      other: { ...(heavyItems.other || {}), [field]: value }
    }
    setHeavyItemsState(next)
    const recalc = rebuildQuote(next)
    updateOrder(id, { heavyItems: next, ...recalc })
  }
  const heavyTotal = calcHeavyTotal(heavyItems)

  // 自动修复：旧订单（fix 之前加的重物）quoteNote 没含「重物」字样 + heavyFee>0 → 自动重算一次
  useEffect(() => {
    if (!order) return
    const heavyTotalSaved = calcHeavyTotal(order.heavyItems || {})
    const noteHasHeavy = (order.quoteNote || '').includes('重物')
    if (heavyTotalSaved > 0 && !noteHasHeavy) {
      const recalc = rebuildQuote(order.heavyItems || {})
      if (recalc) updateOrder(id, recalc)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id])

  if (!order) return (
    <div className="flex items-center justify-center h-64 text-gray-400">订单不存在</div>
  )

  const isClean = order.serviceType === '清洁'
  const cleanPrice = isClean ? calcCleanPrice(order) : null

  const v = VEHICLES[order.vehicle]
  const assignedTeam = order.assignedWorkers?.length ? order.assignedWorkers : (order.assignedTo ? [order.assignedTo] : [])
  const custLevel = getCustomerLevel(orders, order.customerPhone)
  const canDispatch = !['已完成','已取消'].includes(order.status)
  const materialsCost = order.materialsCost || 0
  // Customer self-orders (from public booking page) MUST pass verification before dispatch.
  // CS-created orders are exempt — CS already verified info while filling the form.
  const isCustomerSelfOrder = order.source === '官网自助预约' || order.createdBy === 'customer'
  const dispatchBlocked = order.status === '待确认' && isCustomerSelfOrder && !(
    (checks.called || checks.wechat || checks.replied) &&
    checks.timeOk && checks.addressOk
  )

  function toggleWorkerSelect(wid) {
    setSelectedWorkers(prev =>
      prev.includes(wid) ? prev.filter(x => x !== wid) : [...prev, wid]
    )
  }

  function handleDispatch() {
    if (!selectedWorkers.length) return
    dispatchOrder(id, selectedWorkers)
    setShowDispatch(false)
  }

  function handleStatusChange(status) {
    updateOrderStatus(id, status)
    setShowStatusChange(false)
  }

  function handleDepositToggle() {
    const newVal = !depositPaid
    setDepositPaid(newVal)
    updateOrder(id, { depositPaid: newVal })
    setEditDeposit(false)
  }

  function handleSaveQuote() {
    const val = parseFloat(quoteInput)
    if (!isNaN(val) && val >= 0) {
      updateOrder(id, { quote: val, quoteNote: quoteNoteInput.trim() })
    }
    setShowEditQuote(false)
  }

  const isPending = order.status === '待确认'
  // Show confirmation checklist for pending customer orders OR unconfirmed CS-created orders
  const showConfirmFlow = isPending || (
    !order.assignedTo && ['已报价', '已收定金'].includes(order.status)
  )

  function toggleCheck(key) {
    const updated = { ...checks, [key]: !checks[key] }
    setChecks(updated)
    updateOrder(id, { confirmChecks: updated })
  }

  function saveCsNote(val) {
    setCsNote(val)
    updateOrder(id, { csNote: val })
  }

  // Gate: need at least one contact action + time + address confirmed
  const canConfirmOrder = !!(
    (checks.called || checks.wechat || checks.replied) &&
    checks.timeOk && checks.addressOk
  )

  function handleConfirmOrder() {
    if (!canConfirmOrder) return
    updateOrderStatus(id, '已报价')
  }

  return (
    <div className="max-w-2xl mx-auto p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{order.customerName}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-500'}`}>
              {order.status}
            </span>
          </div>
          <p className="text-gray-400 text-xs mt-0.5">{order.id}</p>
        </div>
      </div>

      {/* Alerts */}
      {!order.assignedTo && canDispatch && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          <span className="text-red-700 text-sm flex-1">
            {dispatchBlocked ? '请先完成核实（联系客户 + 时间确认 + 地址确认），才能派单' : '此订单尚未派单'}
          </span>
          <button
            onClick={() => !dispatchBlocked && setShowDispatch(true)}
            disabled={dispatchBlocked}
            title={dispatchBlocked ? '请先完成核实再派单' : ''}
            className="text-sm text-white px-3 py-1.5 rounded-lg font-semibold transition-opacity"
            style={{
              background: '#c0392b',
              opacity: dispatchBlocked ? 0.4 : 1,
              cursor: dispatchBlocked ? 'not-allowed' : 'pointer',
            }}
          >
            立即派单
          </button>
        </div>
      )}

      {order.status === '未提交账单' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-yellow-500 flex-shrink-0" />
          <span className="text-yellow-700 text-sm">师傅尚未提交账单，请跟进</span>
        </div>
      )}

      {/* Basic info */}
      <Card title="订单信息">
        <Row icon={<Calendar size={15} className="text-blue-500" />} label="服务时间">
          {order.date} {order.startTime}
        </Row>
        {isClean ? (
          <>
            {order.cleanTypeLabel && (
              <Row icon={<Package size={15} className="text-rose-400" />} label="清洁类型">
                {order.cleanTypeLabel}
              </Row>
            )}
            {order.roomTypeLabel && (
              <Row icon={<Package size={15} className="text-rose-400" />} label="房型">
                {order.roomTypeLabel}
                {order.bathroomCount && order.bathroomCount > 1
                  ? ` · ${order.bathroomCount} Bathrooms` : ''}
              </Row>
            )}
          </>
        ) : (
          <Row icon={<Truck size={15} className="text-blue-500" />} label="车型">
            {order.vehicle} {v ? `· ${v.hourlyRate}/hr` : ''}
          </Row>
        )}
        {order.serviceType && !isClean && (
          <Row icon={<Package size={15} className="text-purple-500" />} label="服务类型">
            {order.serviceType}
          </Row>
        )}
        {order.source && (
          <Row icon={<User size={15} className="text-gray-400" />} label="客户来源">
            {order.source}
          </Row>
        )}
        <Row icon={<User size={15} className="text-purple-400" />} label="登记人">
          {order.createdByName || (order.createdBy ? (STAFF_NAMES[order.createdBy] || order.createdBy) : '—')}
        </Row>
      </Card>

      {/* IKEA order info */}
      {order.serviceType === 'IKEA' && (
        <Card title="IKEA 订单信息">
          {order.ikeaService && (
            <Row icon={<Package size={15} className="text-blue-500" />} label="服务类型">
              {order.ikeaService}
            </Row>
          )}
          {order.ikeaOrderNo && (
            <Row icon={<Package size={15} className="text-blue-500" />} label="Order 号码">
              {order.ikeaOrderNo}
            </Row>
          )}
          {order.needsRubbishDisposal !== undefined && (
            <Row icon={<Package size={15} className="text-green-500" />} label="垃圾处理">
              {order.needsRubbishDisposal ? '✅ 需要处理' : '不需要'}
            </Row>
          )}
          {order.ikeaQRCode && (
            <div className="pt-1">
              <p className="text-xs text-gray-400 mb-1.5">取货二维码 / 条形码截图</p>
              {typeof order.ikeaQRCode === 'object' && order.ikeaQRCode.data ? (
                <img
                  src={order.ikeaQRCode.data}
                  alt="IKEA 取货码"
                  className="w-full max-w-xs rounded-xl border border-gray-200"
                />
              ) : (
                <p className="text-xs text-green-600">截图已上传：{typeof order.ikeaQRCode === 'string' ? order.ikeaQRCode : order.ikeaQRCode?.name}</p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Customer */}
      <Card title="客户信息">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-gray-900 font-semibold">{order.customerName}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {custLevel.badge} {custLevel.label}
              </span>
              {order.wechat && (
                <span className="text-xs text-gray-400">微信：{order.wechat}</span>
              )}
            </div>
          </div>
          <a
            href={`tel:${order.customerPhone}`}
            className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-xl text-sm font-semibold active:bg-green-600"
          >
            <Phone size={14} />
            {order.customerPhone}
          </a>
        </div>
      </Card>

      {/* Addresses */}
      {(order.fromAddress || order.toAddress) && (
        <Card title={isClean ? '清洁地址' : '搬运地址'}>
          {!isClean && order.fromAddress && (
            <AddressRow label="搬出" address={order.fromAddress} color="text-red-500" />
          )}
          {!isClean && order.fromAddress && order.toAddress && <div className="border-t border-gray-100 my-2" />}
          {order.toAddress && (
            <AddressRow label={isClean ? '地址' : '搬入'} address={order.toAddress} color="text-green-600" />
          )}
          {!isClean && order.distanceKm && (
            <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
              <Truck size={12} />
              预计 {order.distanceKm} km
              {order.remoteSurcharge > 0 && ` · 远程附加费 $${order.remoteSurcharge}`}
            </div>
          )}
        </Card>
      )}

      {/* Items (move orders only) */}
      {!isClean && (
        <Card title="物品信息">
          {order.items && (
            <div className="flex gap-2.5">
              <Package size={15} className="text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-gray-700 text-sm leading-relaxed">{order.items}</p>
            </div>
          )}
          {order.fragileItems?.length > 0 && (
            <div className="mt-2 flex gap-2.5">
              <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-700 text-sm font-medium">易碎物品：{order.fragileItems.join('、')}</p>
                {order.fragileDescription && <p className="text-gray-500 text-xs mt-0.5">{order.fragileDescription}</p>}
                {order.fragileEstimatedFee > 0 && <p className="text-amber-600 text-xs mt-0.5">预估附加费 ${order.fragileEstimatedFee}</p>}
              </div>
            </div>
          )}
          {order.notes && (
            <>
              <div className="border-t border-gray-100 mt-2 pt-2" />
              <div className="flex gap-2.5">
                <MessageSquare size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <p className="text-gray-500 text-sm">{order.notes}</p>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Cleaning needs (cleaning orders only) */}
      {isClean && (
        <Card title="清洁需求 / 备注">
          {order.cleanExtras?.length > 0 && (
            <div className="flex gap-2.5 mb-1">
              <Package size={15} className="text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400 mb-1">附加项目</p>
                <div className="flex flex-wrap gap-1.5">
                  {order.cleanExtras.map(e => (
                    <span key={e} className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium">{e}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {order.notes ? (
            <div className="flex gap-2.5 mt-1">
              <MessageSquare size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <p className="text-gray-500 text-sm">{order.notes}</p>
            </div>
          ) : !order.cleanExtras?.length && (
            <p className="text-gray-300 text-sm italic">无特殊备注</p>
          )}
        </Card>
      )}

      {/* Materials */}
      {materialsCost > 0 && order.materials && (
        <Card title="物资清单">
          <div className="space-y-1.5">
            {order.materials.boxes > 0 && (
              <MaterialRow label="纸箱" qty={order.materials.boxes} price={5} />
            )}
            {order.materials.mattressCovers > 0 && (
              <MaterialRow label="床垫套" qty={order.materials.mattressCovers} price={10} />
            )}
            {order.materials.wrapItems > 0 && (
              <MaterialRow label="打包膜（件）" qty={order.materials.wrapItems} price={5} />
            )}
            <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-semibold text-gray-800">
              <span>物资合计</span>
              <span>${materialsCost}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Requested materials */}
      {order.requestedMaterials && (
        order.requestedMaterials.boxes > 0 ||
        order.requestedMaterials.wrapItems > 0 ||
        order.requestedMaterials.mattressCovers > 0 ||
        order.requestedMaterials.packingItems > 0
      ) && (
        <Card title="客户物资需求">
          {order.requestedMaterials.boxes > 0 && (
            <Row icon={<Package size={15} className="text-amber-400" />} label="纸箱">
              {order.requestedMaterials.boxes} 个
            </Row>
          )}
          {order.requestedMaterials.wrapItems > 0 && (
            <Row icon={<Package size={15} className="text-amber-400" />} label="胶带 / 打包膜">
              {order.requestedMaterials.wrapItems} 卷
            </Row>
          )}
          {order.requestedMaterials.mattressCovers > 0 && (
            <Row icon={<Package size={15} className="text-amber-400" />} label="床垫套">
              {order.requestedMaterials.mattressCovers} 个
            </Row>
          )}
          {order.requestedMaterials.packingItems > 0 && (
            <Row icon={<Package size={15} className="text-amber-400" />} label="打包物品">
              {order.requestedMaterials.packingItems} 件
            </Row>
          )}
        </Card>
      )}

      {/* Finance */}
      <Card title="费用与定金">

        {/* Cleaning: suggested price breakdown */}
        {isClean && (
          <div className="mb-2 pb-2 border-b border-gray-100">
            {/* Service type header */}
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-sm font-semibold text-gray-800">
                {order.cleanTypeLabel || '清洁服务'}
              </span>
              {order.roomTypeLabel && (
                <span className="text-xs text-gray-400">
                  · {order.roomTypeLabel}
                  {order.bathroomCount >= 2 ? ` · ${order.bathroomCount} Bathrooms` : ''}
                </span>
              )}
            </div>

            <p className="text-xs text-gray-400 mb-1.5">建议报价（参考）</p>
            {cleanPrice ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">基础清洁价</span>
                  <span className="text-gray-700 font-medium">${cleanPrice.base}</span>
                </div>
                {(order.cleanExtras || []).map(e => {
                  const p = CLEAN_EXTRAS[e]
                  return p ? (
                    <div key={e} className="flex justify-between">
                      <span className="text-gray-500">{e}</span>
                      <span className="text-gray-600">+${p.min}{p.flex ? '起' : ''}</span>
                    </div>
                  ) : null
                })}
                <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                  <span className="text-gray-600 text-sm font-semibold">建议最低报价</span>
                  <span className="text-rose-600 font-bold">
                    ${cleanPrice.total}{cleanPrice.hasFlexible ? ' 起' : ''}
                  </span>
                </div>
                <button
                  onClick={() => updateOrder(id, { quote: cleanPrice.total })}
                  className="w-full mt-1 py-2 rounded-xl text-white text-xs font-semibold"
                  style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                >
                  一键填入最终报价 ${cleanPrice.total}{cleanPrice.hasFlexible ? ' 起' : ''}
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">
                {order.roomType === '4b+' ? '4+ 房型需手动报价' : order.cleanType === 'carpet' ? '地毯清洁需手动报价（按房间数）' : '请手动报价'}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 py-0.5">
          <DollarSign size={15} className="text-green-500" />
          <span className="text-gray-500 text-sm flex-1">{isClean ? '最终报价' : '报价'}</span>
          <div className="flex items-center gap-2">
            <div className="text-right">
              {order.quote != null
                ? <span className="text-green-600 font-bold text-lg">${order.quote}</span>
                : <span className={`font-bold text-lg ${isClean ? 'text-orange-400' : 'text-gray-400'}`}>
                    {isClean ? '待报价' : '—'}
                  </span>
              }
              {order.quoteNote && (
                <p className="text-xs text-gray-400 mt-0.5">{order.quoteNote}</p>
              )}
            </div>
            <button
              onClick={() => { setQuoteInput(String(order.quote || '')); setQuoteNoteInput(order.quoteNote || ''); setShowEditQuote(true) }}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
            >
              <Edit3 size={14} />
            </button>
          </div>
        </div>
        {order.deposit > 0 && (
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle size={15} className={order.depositPaid ? 'text-green-500' : 'text-gray-300'} />
              <span className="text-gray-500">定金 ${order.deposit}</span>
            </div>
            <button
              onClick={() => setEditDeposit(true)}
              className={`text-sm font-semibold px-3 py-1 rounded-lg flex items-center gap-1 ${
                order.depositPaid
                  ? 'text-green-600 bg-green-50'
                  : 'text-red-600 bg-red-50'
              }`}
            >
              <Edit3 size={12} />
              {order.depositPaid ? '已收' : '未收'}
            </button>
          </div>
        )}
        {/* Customer self-booking deposit status */}
        {!order.deposit && order.depositStatus && (
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle size={15} className={
                order.depositStatus === '已上传截图' ? 'text-green-500' : 'text-gray-300'
              } />
              <span className="text-gray-500">定金状态</span>
            </div>
            <span className={`text-sm font-semibold px-3 py-1 rounded-lg ${
              order.depositStatus === '已上传截图'
                ? 'text-green-600 bg-green-50'
                : 'text-orange-600 bg-orange-50'
            }`}>
              {order.depositStatus}
            </span>
          </div>
        )}
        {order.depositScreenshot && (
          <div className="mt-2">
            <p className="text-xs text-gray-400 mb-1.5 px-1">定金转账截图</p>
            {typeof order.depositScreenshot === 'object' && (order.depositScreenshot.url || order.depositScreenshot.data) ? (
              <img
                src={order.depositScreenshot.url || order.depositScreenshot.data}
                alt="定金截图"
                className="w-full max-w-xs rounded-xl border border-gray-200"
              />
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-green-600 px-1">
                <CheckCircle size={11} />
                截图已上传：{typeof order.depositScreenshot === 'string' ? order.depositScreenshot : order.depositScreenshot?.name}
              </div>
            )}
          </div>
        )}
        {order.finalAmount && (
          <Row icon={<DollarSign size={15} className="text-green-600" />} label="实收金额">
            <span className="text-green-600 font-bold text-lg">${order.finalAmount}</span>
          </Row>
        )}
        {/* Bill breakdown — only for orders submitted after FormPage upgrade */}
        {order.finalAmount && (order.timeFee != null || order.hourlyRate != null) && (
          <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm" style={{ border: '1px solid #E5E7EB' }}>
            <p className="font-semibold text-gray-700 mb-2 text-xs">收费明细</p>
            <div className="space-y-1.5">
              {order.timeFee > 0 && (
                <BreakdownRow
                  label={`工时费 (${order.billedHours || 0} 小时 × $${order.hourlyRate || 0}/小时)`}
                  value={order.timeFee} />
              )}
              {order.returnFee > 0 && <BreakdownRow label="返程费"     value={order.returnFee} />}
              {order.stairsFee > 0 && <BreakdownRow label="楼梯费"     value={order.stairsFee} />}
              {order.overtimeFee > 0 && <BreakdownRow label="超时费"   value={order.overtimeFee} />}
              {order.heavyFee > 0 && <BreakdownRow label="重物费"      value={order.heavyFee} />}
              {order.fragileFee > 0 && <BreakdownRow label="易碎物品费" value={order.fragileFee} />}
              {order.highwayFee > 0 && <BreakdownRow label="高速费"    value={order.highwayFee} />}
              {order.parkingFee > 0 && <BreakdownRow label="停车违规费" value={order.parkingFee} />}
              {order.suppliesFee > 0 && <BreakdownRow label="物资费"   value={order.suppliesFee} />}
              {order.fuelFee > 0 && <BreakdownRow label="油费"        value={order.fuelFee} />}
              {order.discountAmount > 0 && <BreakdownRow label="折扣"  value={-order.discountAmount} negative />}
              {order.gst > 0 && <BreakdownRow label="GST (转账 +10%)" value={order.gst} />}
              {order.deposit > 0 && order.depositPaid && (
                <BreakdownRow label="减定金" value={-order.deposit} negative />
              )}
              <div className="h-px bg-gray-200 my-1.5" />
              <div className="flex justify-between text-sm font-bold pt-0.5">
                <span className="text-gray-700">实收</span>
                <span className="text-green-600">${order.finalAmount}</span>
              </div>
            </div>
          </div>
        )}
        {order.paymentStatus === 'unpaid' && (
          <p className="text-red-500 text-xs mt-1">⚠️ 客户未付款，请跟进</p>
        )}
      </Card>

      {/* ── Confirmation modules — shown for 待确认 and unconfirmed CS orders ── */}
      {showConfirmFlow && (
        <>
          {/* 1. 联系确认 */}
          <Card title="联系确认">
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'called',  label: '已拨打电话', icon: '📞' },
                { key: 'wechat',  label: '已加微信',   icon: '💬' },
                { key: 'replied', label: '已回复客户', icon: '✅' },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => toggleCheck(item.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    checks[item.key]
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </Card>

          {/* 2. 信息核实 */}
          <Card title="信息核实">
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'timeOk',    label: '时间确认', required: true  },
                { key: 'addressOk', label: '地址确认', required: true  },
                { key: 'itemsOk',   label: '物品确认', required: false },
                { key: 'parkingOk', label: '停车确认', required: false },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => toggleCheck(item.key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    checks[item.key]
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 text-xs ${
                    checks[item.key] ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                  }`}>
                    {checks[item.key] ? '✓' : ''}
                  </span>
                  {item.label}
                  {item.required && <span className="text-red-400 text-xs ml-auto">必填</span>}
                </button>
              ))}
            </div>
            {(!checks.timeOk || !checks.addressOk) && (
              <p className="text-xs text-orange-500 mt-2">时间与地址确认为必须项，完成后才可确认订单</p>
            )}
          </Card>

          {/* 3. 附加费用（重物 / 大件）*/}
          <Card title="附加费用（重物 / 大件）">
            <p className="text-xs text-gray-400 mb-3">
              💡 通过电话/微信跟客户确认有哪些重物，按需填金额（不需要全部勾选）。师傅打开账单时自动同步。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {HEAVY_ITEM_OPTIONS.map(item => {
                const value = heavyItems[item.id] || ''
                const enabled = Number(value) > 0
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl px-3 py-2 flex items-center gap-3 transition-colors ${
                      enabled ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
                    }`}
                  >
                    <span className="text-sm text-gray-700 flex-1 font-medium">{item.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        value={value}
                        onChange={e => updateHeavyItem(item.id, e.target.value)}
                        placeholder="0"
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200"
                      />
                    </div>
                  </div>
                )
              })}
              {/* 其他重物（带描述）— 桌面端跨两列 */}
              <div className="bg-gray-50 rounded-xl p-3 sm:col-span-2">
                <p className="text-sm font-medium text-gray-700 mb-2">其他重物（自定义）</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={heavyItems.other?.description || ''}
                    onChange={e => updateOtherHeavy('description', e.target.value)}
                    placeholder="物品名称（如：保险柜）"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <div className="flex items-center gap-2 sm:w-40">
                    <span className="text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      value={heavyItems.other?.amount || ''}
                      onChange={e => updateOtherHeavy('amount', e.target.value)}
                      placeholder="0"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>
              </div>
            </div>
            {heavyTotal > 0 && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-medium text-amber-800">附加费用合计</span>
                <span className="text-amber-800 font-bold">${heavyTotal}</span>
              </div>
            )}
          </Card>

          {/* 4. 客服备注 + 快捷模板 */}
          <Card title="客服内部备注">
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {[
                '已电话确认档期',
                '地址核实停车正常',
                '有大件已告知师傅',
                '已加微信等定金',
                '需要打包物资',
                '停车情况特殊需注意',
              ].map(t => (
                <button
                  key={t}
                  onClick={() => saveCsNote(csNote ? csNote + '\n' + t : t)}
                  className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  + {t}
                </button>
              ))}
            </div>
            <textarea
              value={csNote}
              onChange={e => setCsNote(e.target.value)}
              onBlur={() => saveCsNote(csNote)}
              placeholder="客服内部备注（客户不可见）..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
            />
          </Card>

          {/* 确认订单按钮 — only for 待确认 orders */}
          {isPending && (
            <div>
              <button
                onClick={handleConfirmOrder}
                disabled={!canConfirmOrder}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${
                  canConfirmOrder
                    ? 'text-white shadow-sm active:scale-95'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                style={canConfirmOrder ? { background: 'linear-gradient(135deg, #059669, #10b981)' } : {}}
              >
                确认订单
              </button>
              {!canConfirmOrder && (
                <p className="text-center text-xs text-gray-400 mt-1.5">
                  还需完成：
                  {!(checks.called || checks.wechat || checks.replied) && <span className="text-orange-500"> 联系客户</span>}
                  {!checks.timeOk && <span className="text-orange-500"> · 时间确认</span>}
                  {!checks.addressOk && <span className="text-orange-500"> · 地址确认</span>}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Dispatch */}
      <Card title="派单信息">
        {assignedTeam.length > 0 ? (
          <div>
            <div className="space-y-2 mb-3">
              {assignedTeam.map((wid, i) => (
                <div key={wid} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm">
                    {(WORKER_NAMES[wid] || wid)[0]}
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold text-sm">{WORKER_NAMES[wid] || wid}</p>
                    <p className="text-gray-400 text-xs">{i === 0 ? '主带（司机）' : '随行'}</p>
                  </div>
                </div>
              ))}
            </div>
            {order.dispatchedAt && (
              <p className="text-gray-400 text-xs mb-2">
                派单于 {new Date(order.dispatchedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {canDispatch && (
              <button onClick={() => { setSelectedWorkers(assignedTeam); setShowDispatch(true) }}
                className="text-sm text-gray-500 hover:text-gray-700 underline">
                修改派单
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-gray-400 text-sm mb-3">尚未分配师傅</p>
            {canDispatch && (
              <>
                <button
                  onClick={() => !dispatchBlocked && (setSelectedWorkers([]), setShowDispatch(true))}
                  disabled={dispatchBlocked}
                  title={dispatchBlocked ? '请先完成核实再派单' : ''}
                  className="text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-opacity"
                  style={{
                    background: 'linear-gradient(135deg, #6b1414, #c0392b)',
                    opacity: dispatchBlocked ? 0.4 : 1,
                    cursor: dispatchBlocked ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Truck size={16} className="inline mr-2" />
                  派单给师傅
                </button>
                {dispatchBlocked && (
                  <p className="text-xs text-orange-600 mt-2">需完成「联系客户 + 时间确认 + 地址确认」才能派单</p>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      {/* Status change */}
      <button
        onClick={() => setShowStatusChange(true)}
        className="w-full bg-white border border-gray-200 text-gray-600 py-3 rounded-xl font-medium text-sm hover:bg-gray-50 shadow-sm"
      >
        修改订单状态（当前：{order.status}）
      </button>

      {/* Dispatch modal */}
      {showDispatch && (
        <Modal title="选择出工师傅（可多选）" onClose={() => setShowDispatch(false)}>
          <p className="text-gray-400 text-xs mb-3">第一个选中的为主带司机，后续为随行工人</p>
          <div className="space-y-2 mb-4">
            {workers.map(w => {
              const selected = selectedWorkers.includes(w.id)
              const idx = selectedWorkers.indexOf(w.id)
              return (
                <button
                  key={w.id}
                  onClick={() => toggleWorkerSelect(w.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    selected ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-sm">
                    {selected ? (idx + 1) : w.name[0]}
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-gray-900 font-medium text-sm">{w.name}</p>
                    <p className="text-gray-400 text-xs">
                      {w.isDriver ? `司机 · ${w.canDrive.slice(0, 2).join('/')}` : '工人'} · {'⭐'.repeat(w.stars)}
                    </p>
                  </div>
                  {selected && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${idx === 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                      {idx === 0 ? '主带' : '随行'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {selectedWorkers.length > 0 && (
            <p className="text-sm text-gray-500 mb-3">
              已选 {selectedWorkers.length} 人：{selectedWorkers.map(id => WORKER_NAMES[id] || id).join(' + ')}
            </p>
          )}
          <button
            onClick={handleDispatch}
            disabled={!selectedWorkers.length}
            className="w-full text-white py-3 rounded-xl font-semibold disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}
          >
            确认派单
          </button>
        </Modal>
      )}

      {/* Status modal */}
      {showStatusChange && (
        <Modal title="修改订单状态" onClose={() => setShowStatusChange(false)}>
          <div className="space-y-2">
            {STATUS_FLOW.map(s => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                  order.status === s
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="text-gray-800 text-sm">{s}</span>
                {order.status === s && <CheckCircle size={16} className="text-red-500" />}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Quote edit modal */}
      {showEditQuote && (
        <Modal title="修改报价" onClose={() => setShowEditQuote(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">报价金额 ($)</label>
              <input
                type="number"
                value={quoteInput}
                onChange={e => setQuoteInput(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">备注（可选，如"含安装费"）</label>
              <input
                type="text"
                value={quoteNoteInput}
                onChange={e => setQuoteNoteInput(e.target.value)}
                placeholder="报价说明"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>
            <button
              onClick={handleSaveQuote}
              className="w-full text-white py-3 rounded-xl font-semibold"
              style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}
            >
              保存报价
            </button>
          </div>
        </Modal>
      )}

      {/* Deposit confirm */}
      {editDeposit && (
        <Modal title="定金状态" onClose={() => setEditDeposit(false)}>
          <p className="text-gray-600 text-sm mb-4">将定金标记为：</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setDepositPaid(true); updateOrder(id, { depositPaid: true }); setEditDeposit(false) }}
              className="py-3 rounded-xl bg-green-500 text-white font-semibold"
            >
              ✅ 已收
            </button>
            <button
              onClick={() => { setDepositPaid(false); updateOrder(id, { depositPaid: false }); setEditDeposit(false) }}
              className="py-3 rounded-xl bg-red-100 text-red-600 font-semibold"
            >
              ❌ 未收
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Sub-components ──

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {title && (
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</h3>
        </div>
      )}
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  )
}

function Row({ icon, label, children }) {
  return (
    <div className="flex items-center gap-3 py-0.5">
      {icon}
      <span className="text-gray-500 text-sm flex-1">{label}</span>
      <div className="text-gray-800 text-sm font-medium">{children}</div>
    </div>
  )
}

function BreakdownRow({ label, value, negative }) {
  const num = Number(value) || 0
  const formatted = (num < 0 ? '-' : '') + '$' + Math.abs(num).toFixed(2).replace(/\.?0+$/, '')
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={negative ? 'text-orange-600' : 'text-gray-700'}>{formatted}</span>
    </div>
  )
}

function AddressRow({ label, address, color }) {
  const encoded = encodeURIComponent(address)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const mapUrl = isIOS ? `maps://maps.apple.com/?q=${encoded}` : `https://maps.google.com/?q=${encoded}`
  return (
    <div className="flex items-start gap-3">
      <MapPin size={15} className={`flex-shrink-0 mt-0.5 ${color}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold mb-0.5 ${color}`}>{label}</p>
        <p className="text-gray-800 text-sm leading-snug">{address}</p>
      </div>
      <a href={mapUrl} className="flex-shrink-0 text-blue-600 text-xs font-semibold bg-blue-50 px-2.5 py-1.5 rounded-lg">
        地图
      </a>
    </div>
  )
}

function MaterialRow({ label, qty, price }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-600">{label} × {qty}</span>
      <span className="text-gray-700 font-medium">${qty * price}</span>
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
