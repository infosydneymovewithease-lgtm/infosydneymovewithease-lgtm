import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { VEHICLES, STAIRS_FEE, VAN_PROMO_DISCOUNT } from '../../data/vehicles'
import { HEAVY_ITEM_OPTIONS, calcHeavyTotal } from '../../data/heavyItems'
import { calcRemoteSurcharge, getDistanceTier } from '../../utils/remoteFee'
import { SLOT_CONFIG, fetchSlotsAvailability } from '../../utils/slotAvailability'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, MapPin, Package, AlertTriangle, Info, CheckCircle, ExternalLink, Upload, X } from 'lucide-react'
import AddressAutocomplete from '../../components/AddressAutocomplete'
import { getRemoteDistanceKm } from '../../utils/googleMaps'
import dayjs from 'dayjs'

// Upload an image to Supabase Storage with base64 fallback. Returns { name, url? , data? }.
async function uploadImage(file, bucket = 'deposit-screenshots') {
  const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${dayjs().format('YYYYMMDD')}_${Date.now()}.${ext}`
  const { data: stored, error } = await supabase.storage
    .from(bucket).upload(path, file, { contentType: file.type, upsert: false })
  if (!error) {
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(stored.path)
    return { name: file.name, url: publicUrl }
  }
  console.warn('[upload] storage failed, base64 fallback:', error.message)
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = ev => resolve({ name: file.name, data: ev.target.result })
    reader.readAsDataURL(file)
  })
}

const SERVICE_TYPES = ['搬家', '寄存', 'IKEA 提货', '清洁服务', '二手物品', '其他']
const VEHICLE_KEYS = Object.keys(VEHICLES)
const SOURCES = ['官网', '微信', '小红书', '转介绍', '师傅内部介绍', '商业合作', '电话', '其他']
const FRAGILE_OPTIONS = ['大理石桌', '玻璃餐桌', '鱼缸', '镜子', '艺术品', '高端家具', '钢琴', '大电视(65寸+)', '易损柜体', '其他']
const DISCOUNT_OPTIONS = [
  { label: '无折扣', value: 1 },
  { label: '九五折 (5%)', value: 0.95 },
  { label: '九折 (10%)', value: 0.9 },
]

// Aligned with customer-side MoveBooking
const MATERIAL_PRICES = { boxes: 5, mattressCovers: 10, wrapItems: 3, packingItems: 5 }

// Vehicle name → SLOT_CONFIG group (for slot picker + capacity check)
const VEHICLE_TO_GROUP = {
  '面包车':   'van',
  '卡车单人': 'van',
  '小卡车':   'small',
  '小卡三人': 'small',
  '大卡车':   'large',
  '大卡三人': 'large',
  '双卡车':   'large',
}

// Cleaning service constants — mirrored from CleanBooking.jsx
const CLEAN_TYPES = [
  { key: 'vacate',   label: '交房清洁', desc: '退租/交房' },
  { key: 'move_in',  label: '入住清洁', desc: '新房入住前' },
  { key: 'regular',  label: '日常清洁', desc: '定期家政' },
  { key: 'carpet',   label: '地毯清洁', desc: '蒸汽深度' },
]
const ROOM_TYPES = [
  { key: 'studio', label: 'Studio' },
  { key: '1b',     label: '1B' },
  { key: '2b',     label: '2B' },
  { key: '3b',     label: '3B' },
  { key: '4b+',    label: '4B+' },
]
const CLEAN_EXTRAS = ['炉灶深度清洁', '冰箱内清洁', '洗碗机清洁', '窗户清洁', '墙面污渍处理', '车库清洁']

// IKEA service constants — mirrored from IkeaBooking.jsx
const IKEA_SERVICES = [
  { key: 'pickup',   label: 'IKEA 代购提货', desc: '前往门店代为提取订单' },
  { key: 'assemble', label: '家具安装',       desc: '上门专业安装' },
  { key: 'both',     label: '提货 + 安装',   desc: '一站式服务' },
]
const IKEA_STORES = ['IKEA Rhodes', 'IKEA Tempe', 'IKEA Marsden Park', '其他']
const IKEA_STORE_ADDRESSES = {
  'IKEA Rhodes':        'IKEA Rhodes, 1 Homebush Bay Dr, Rhodes NSW 2138',
  'IKEA Tempe':         'IKEA Tempe, 634 Princes Hwy, Tempe NSW 2044',
  'IKEA Marsden Park':  'IKEA Marsden Park, 1 Hollinsworth Rd, Marsden Park NSW 2765',
}

export default function NewOrder() {
  const navigate = useNavigate()
  const { createOrder, createStorageOrder, getCustomers, user, orders: allOrders } = useApp()
  const customers = getCustomers()

  const [form, setForm] = useState({
    serviceType: '搬家',
    date: new Date().toISOString().slice(0, 10),
    startTime: '',                 // slot label e.g. '08:00–10:00' (or HH:MM for non-搬家)
    vehicle: '小卡车',
    customerName: '',
    customerPhone: '',
    wechat: '',
    source: '微信',
    fromAddress: '',
    toAddress: '',
    distanceKm: '',
    items: '',
    notes: '',
    hasElevator: true,             // true = 有电梯, false = 有楼梯
    floors: 0,                     // floor count when stairs
    heavyFee: '',                  // CS-estimated heavy item fee（自动算自 heavyItems 总和）
    heavyItems: {},                // 结构化重物（{ piano: 240, safeBox: 80, other: { description, amount } }）
    heavyDescription: '',          // text describing the heavy items（保留作备注）
    fragileItems: [],
    fragileDescription: '',
    fragileEstimatedFee: '',
    materials: { boxes: 0, mattressCovers: 0, wrapItems: 0, packingItems: 0 },
    // Cleaning-specific fields
    cleanType: 'vacate',
    roomType: '2b',
    bathroomCount: 1,
    cleanExtras: [],
    cleanAddress: '',
    // IKEA-specific fields
    ikeaService: 'both',
    ikeaStore: 'IKEA Rhodes',
    ikeaStoreCustom: '',
    ikeaOrderNo: '',
    ikeaItems: '',
    needsRubbishDisposal: false,
    ikeaQRFile: null,
    // Storage-specific fields (storage uses top form.date as 取件日期)
    storageBoxes: 0,
    storageFurniture: 0,
    moveOutDate: dayjs().add(5, 'week').format('YYYY-MM-DD'),
    needsPickup: true,
    needsReturn: true,
    deliveryAddress: '',
    quote: '',
    deposit: 30,
    depositStatus: '',   // '' | 'paid' | 'pending' | 'unpaid'
    depositPaid: false,
    discount: 1,
    paymentMethod: 'cash',
    status: '待确认',
  })

  const [existingCustomer, setExistingCustomer] = useState(null)
  const [existingCustomerCode, setExistingCustomerCode] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [successOrder, setSuccessOrder] = useState(null)
  const [slotAvailability, setSlotAvailability] = useState({})
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Phone lookup — find existing customer + their customer_code
  useEffect(() => {
    if (form.customerPhone.length >= 10) {
      const found = customers.find(c => c.phone === form.customerPhone)
      setExistingCustomer(found || null)
      if (found && !form.customerName) {
        setForm(f => ({ ...f, customerName: found.name, wechat: found.wechat || '' }))
      }
      // Look up existing customer_code from any prior order with this phone
      const priorWithCode = allOrders?.find(o =>
        o.customerPhone === form.customerPhone && o.customer_code
      )
      setExistingCustomerCode(priorWithCode?.customer_code || null)
    } else {
      setExistingCustomer(null)
      setExistingCustomerCode(null)
    }
  }, [form.customerPhone])

  // Slot availability — relevant for 搬家, IKEA 提货, and 寄存 (when pickup needed)
  const slotEnabled = form.serviceType === '搬家'
    || form.serviceType === 'IKEA 提货'
    || (form.serviceType === '寄存' && form.needsPickup)
  const slotGroup = slotEnabled ? VEHICLE_TO_GROUP[form.vehicle] : null
  const availableSlots = slotGroup ? SLOT_CONFIG[slotGroup]?.slots || [] : []

  // Storage fee calculation — same logic as customer-side StorageBooking
  const storageWeeks = Math.max(1, Math.ceil(
    dayjs(form.moveOutDate).diff(dayjs(form.date), 'day') / 7
  ))
  const storageBoxRate = storageWeeks <= 5 ? 5 : 3
  const storageFurRate = storageWeeks <= 5 ? 10 : 7
  const storageWeeklyFee = form.storageBoxes * storageBoxRate + form.storageFurniture * storageFurRate
  const storageTotalFee  = storageWeeklyFee * storageWeeks

  const qrInputRef = useRef(null)
  async function handleQRUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const result = await uploadImage(file)
    setForm(f => ({ ...f, ikeaQRFile: result }))
  }

  // For IKEA orders: auto-fill fromAddress from selected IKEA store (drives distance calc)
  useEffect(() => {
    if (form.serviceType === 'IKEA 提货') {
      const storeAddr = IKEA_STORE_ADDRESSES[form.ikeaStore] || form.ikeaStoreCustom
      if (storeAddr && form.fromAddress !== storeAddr) {
        setForm(f => ({ ...f, fromAddress: storeAddr }))
      }
    }
  }, [form.serviceType, form.ikeaStore, form.ikeaStoreCustom])

  useEffect(() => {
    if (!slotGroup || !form.date) {
      setSlotAvailability({})
      return
    }
    setSlotsLoading(true)
    fetchSlotsAvailability(slotGroup, form.date).then(result => {
      setSlotAvailability(result || {})
      setSlotsLoading(false)
    })
  }, [slotGroup, form.date])

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleAddressSelect(field, address) {
    set(field, address)
    const from = field === 'fromAddress' ? address : form.fromAddress
    const to   = field === 'toAddress'   ? address : form.toAddress
    if (from && to) {
      const km = await getRemoteDistanceKm(from, to)
      if (km !== null) set('distanceKm', String(km))
    }
  }

  // Auto-calculate distance when both address fields are filled (handles manual input too)
  useEffect(() => {
    const from = form.fromAddress.trim()
    const to   = form.toAddress.trim()
    if (from.length < 5 || to.length < 5) return
    const timer = setTimeout(async () => {
      const km = await getRemoteDistanceKm(from, to)
      if (km !== null) set('distanceKm', String(km))
    }, 800)
    return () => clearTimeout(timer)
  }, [form.fromAddress, form.toAddress])

  function setMaterial(key, val) {
    setForm(f => ({ ...f, materials: { ...f.materials, [key]: Math.max(0, Number(val) || 0) } }))
  }

  function toggleFragile(item) {
    setForm(f => ({
      ...f,
      fragileItems: f.fragileItems.includes(item)
        ? f.fragileItems.filter(x => x !== item)
        : [...f.fragileItems, item],
    }))
  }

  // Calculations
  const v = VEHICLES[form.vehicle]
  const baseQuote = v ? v.hourlyRate * v.minHours + v.returnFee : 0
  const km = parseFloat(form.distanceKm) || 0
  const remote = v ? calcRemoteSurcharge(km, form.vehicle) : { total: 0, tier: null }
  const materialsCost =
    form.materials.boxes * MATERIAL_PRICES.boxes +
    form.materials.mattressCovers * MATERIAL_PRICES.mattressCovers +
    form.materials.wrapItems * MATERIAL_PRICES.wrapItems +
    form.materials.packingItems * MATERIAL_PRICES.packingItems
  const stairsFee = (!form.hasElevator && Number(form.floors) > 0 && v)
    ? (STAIRS_FEE[v.people] || 0) * Number(form.floors)
    : 0
  // 重物费总额：优先用结构化 heavyItems 自动算，回退到 heavyFee 单一字段
  const heavyFeeNum = calcHeavyTotal(form.heavyItems) || Number(form.heavyFee) || 0
  const vanDiscount = form.vehicle === '面包车' ? VAN_PROMO_DISCOUNT : 0
  const suggestedQuote = baseQuote + remote.total + materialsCost + stairsFee + heavyFeeNum - vanDiscount
  const finalQuote = parseFloat(form.quote) || suggestedQuote
  const discountedQuote = Math.round(finalQuote * form.discount)

  const customerLevel = existingCustomer ? getCustomerLevel(existingCustomer.orderCount) : null

  function handleSubmit(e) {
    e.preventDefault()
    setSubmitted(true)
    if (form.serviceType === '二手物品') return  // placeholder — submission disabled
    if (!form.customerName || !form.customerPhone || !form.date) return
    if (form.serviceType === '搬家' && (!form.fromAddress || !form.toAddress)) return
    if (form.serviceType === 'IKEA 提货' && !form.toAddress) return
    if (slotEnabled && slotGroup && !form.startTime) return  // require slot picked
    if (form.serviceType === '清洁服务' && !form.cleanAddress) return
    if (form.serviceType === '寄存' && form.needsPickup && !form.fromAddress) return
    if (!form.depositStatus) return
    if (form.depositStatus === 'unpaid') return  // blocked

    const autoQuoteNote = v ? [
      `$${v.hourlyRate}×${v.minHours}h + $${v.returnFee}(返程费) = $${baseQuote}`,
      vanDiscount > 0 ? `- 优惠 $${vanDiscount}` : null,
      remote.total > 0 ? `+ 远途 $${remote.total}` : null,
      stairsFee > 0 ? `+ 楼梯 $${stairsFee}` : null,
      heavyFeeNum > 0 ? `+ 重物 $${heavyFeeNum}` : null,
      materialsCost > 0 ? `+ 物资 $${materialsCost}` : null,
      discountedQuote !== suggestedQuote ? `折后 $${discountedQuote}起` : `= $${discountedQuote}起`,
    ].filter(Boolean).join(' ') : ''

    // Reuse existing customer_code if any; otherwise generate fresh archive code
    const customerCode = existingCustomerCode
      || ('C' + Math.floor(100000 + Math.random() * 900000))

    // Build payload — adapt fields based on service type
    const basePayload = {
      ...form,
      depositPaid: form.depositStatus === 'paid',
      status: form.depositStatus === 'paid' ? '已收定金' : '待确认',
      customer_code: customerCode,
    }

    let payload
    if (form.serviceType === '寄存') {
      const requestedMaterials = (form.materials.boxes > 0 || form.materials.wrapItems > 0
        || form.materials.mattressCovers > 0 || form.materials.packingItems > 0)
        ? form.materials : null
      const order = createStorageOrder({
        customerName:      form.customerName,
        customerPhone:     form.customerPhone,
        wechat:            form.wechat,
        source:            form.source,
        vehicle:           form.needsPickup ? form.vehicle : null,
        date:              form.date,
        startTime:         form.needsPickup ? form.startTime : '—',
        fromAddress:       form.needsPickup ? form.fromAddress : '客户自送',
        deliveryAddress:   form.needsReturn ? form.deliveryAddress : '',
        needsPickup:       form.needsPickup,
        needsReturn:       form.needsReturn,
        boxes:             form.storageBoxes,
        furniture:         form.storageFurniture,
        moveInDate:        form.date,
        moveOutDate:       form.moveOutDate,
        weeks:             storageWeeks,
        weeklyFee:         storageWeeklyFee,
        totalFee:          storageTotalFee,
        notes:             form.notes,
        requestedMaterials,
        depositPaid:       form.depositStatus === 'paid',
        depositStatus:     form.depositStatus === 'paid' ? '已上传截图' : '待付定金',
        paymentStatus:     '定金',
        serviceType:       '寄存',
        status:            form.depositStatus === 'paid' ? '已收定金' : '待确认',
        customer_code:     customerCode,
        createdBy:         user?.id || 'unknown',
        createdByName:     user?.name || '未知',
      })
      setSuccessOrder(order)
      setSubmitted(false)
      // Reset form (use existing reset)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (form.serviceType === 'IKEA 提货') {
      const ikeaSvc = IKEA_SERVICES.find(s => s.key === form.ikeaService)
      payload = {
        ...basePayload,
        serviceType:          'IKEA',
        fromAddress:          IKEA_STORE_ADDRESSES[form.ikeaStore] || form.ikeaStoreCustom,
        toAddress:            form.toAddress,
        distanceKm:           km || null,
        remoteSurcharge:      remote.total || null,
        ikeaService:          ikeaSvc?.label,
        ikeaStore:            form.ikeaStore === '其他' ? form.ikeaStoreCustom : form.ikeaStore,
        ikeaOrderNo:          form.ikeaOrderNo,
        ikeaQRCode:           form.ikeaQRFile,
        items:                form.ikeaItems,
        needsRubbishDisposal: form.needsRubbishDisposal,
        quote:                parseFloat(form.quote) || (v ? v.hourlyRate * 2 + remote.total : null),
        quoteNote:            form.quoteNote || `IKEA ${ikeaSvc?.label || ''}`,
      }
    } else if (form.serviceType === '清洁服务') {
      const ct = CLEAN_TYPES.find(c => c.key === form.cleanType)
      const rt = ROOM_TYPES.find(r => r.key === form.roomType)
      payload = {
        ...basePayload,
        toAddress:      form.cleanAddress,
        fromAddress:    form.cleanAddress,
        serviceType:    '清洁',
        cleanType:      form.cleanType,
        cleanTypeLabel: ct?.label,
        roomType:       form.roomType,
        roomTypeLabel:  rt?.label,
        bathroomCount:  form.bathroomCount,
        cleanExtras:    form.cleanExtras,
        quote:          parseFloat(form.quote) || null,
        quoteNote:      form.quoteNote || '清洁服务（人工报价）',
      }
    } else {
      // 搬家 (default) — same as before
      payload = {
        ...basePayload,
        distanceKm: km || null,
        remoteSurcharge: remote.total || null,
        stairsFee,
        heavyFee: heavyFeeNum,
        heavyItems: form.heavyItems || {},
        heavyDescription: form.heavyDescription || null,
        materialsCost,
        quote: discountedQuote,
        quoteNote: form.quoteNote || autoQuoteNote,
        fragileEstimatedFee: parseFloat(form.fragileEstimatedFee) || 0,
      }
    }

    const order = createOrder(payload)

    setSuccessOrder(order)
    setSubmitted(false)
    setForm({
      serviceType: '搬家',
      date: new Date().toISOString().slice(0, 10),
      startTime: '',
      vehicle: '小卡车',
      customerName: '',
      customerPhone: '',
      wechat: '',
      source: '微信',
      fromAddress: '',
      toAddress: '',
      distanceKm: '',
      items: '',
      notes: '',
      hasElevator: true,
      floors: 0,
      heavyFee: '',
      heavyDescription: '',
      fragileItems: [],
      fragileDescription: '',
      fragileEstimatedFee: '',
      materials: { boxes: 0, mattressCovers: 0, wrapItems: 0, packingItems: 0 },
      cleanType: 'vacate',
      roomType: '2b',
      bathroomCount: 1,
      cleanExtras: [],
      cleanAddress: '',
      ikeaService: 'both',
      ikeaStore: 'IKEA Rhodes',
      ikeaStoreCustom: '',
      ikeaOrderNo: '',
      ikeaItems: '',
      needsRubbishDisposal: false,
      ikeaQRFile: null,
      storageBoxes: 0,
      storageFurniture: 0,
      moveOutDate: dayjs().add(5, 'week').format('YYYY-MM-DD'),
      needsPickup: true,
      needsReturn: true,
      deliveryAddress: '',
      quote: '',
      deposit: 30,
      depositStatus: '',
      depositPaid: false,
      discount: 1,
      paymentMethod: 'cash',
      status: '待确认',
    })
    setExistingCustomerCode(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const err = (field) => submitted && !form[field]

  return (
    <div className="max-w-2xl mx-auto p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">新建订单</h1>
      </div>

      {successOrder && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 flex items-start gap-3">
          <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-green-800 font-semibold text-sm">订单创建成功！</p>
            <p className="text-green-600 text-xs mt-0.5">
              {successOrder.customerName} · {successOrder.id} · ${successOrder.quote}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/admin/orders/${successOrder.id}`)}
            className="flex items-center gap-1 text-green-600 text-xs font-semibold hover:underline flex-shrink-0"
          >
            查看 <ExternalLink size={12} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Section 1: 服务类型 */}
        <Section title="服务类型与时间">
          <div className="grid grid-cols-2 gap-3">
            <Field label="服务类型" required>
              <select value={form.serviceType} onChange={e => set('serviceType', e.target.value)} className={selectCls}>
                {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="服务日期" required>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={`${inputCls} ${err('date') ? errorCls : ''}`} />
            </Field>
            {slotEnabled && (
              <Field label="车型" required>
                <select value={form.vehicle} onChange={e => set('vehicle', e.target.value)} className={selectCls}>
                  {VEHICLE_KEYS.map(k => <option key={k} value={k}>{VEHICLES[k].label}</option>)}
                </select>
              </Field>
            )}
            {/* Non-vehicle services use free time input */}
            {!slotEnabled && (
              <Field label="开始时间">
                <input type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} className={inputCls} />
              </Field>
            )}
          </div>

          {/* Slot picker for 搬家 / IKEA — same UI/capacity as customer side */}
          {slotEnabled && slotGroup && availableSlots.length > 0 && (
            <Field label="到达时段" required>
              <p className="text-xs text-gray-400 mb-2">第一单可准时到达；后续时段受上一单工时及路况影响，为预计窗口</p>
              {slotsLoading && <p className="text-xs text-gray-400 mb-2">正在查询可用时段…</p>}
              <div className="grid grid-cols-1 gap-2">
                {availableSlots.map((slot, idx) => {
                  const avail = slotAvailability[slot]
                  const isFull = avail && avail.available <= 0
                  const isLimited = avail && avail.available > 0 && avail.available < (avail.slot_capacity || avail.capacity)
                  const selected = form.startTime === slot
                  const label = idx === 0 ? `${slot.split('–')[0]} 准时到达` : slot
                  return (
                    <button key={slot} type="button"
                      disabled={isFull}
                      onClick={() => !isFull && set('startTime', slot)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors text-left flex items-center justify-between border-2"
                      style={
                        isFull
                          ? { background: '#f3f4f6', color: '#9ca3af', cursor: 'not-allowed', opacity: 0.55, borderColor: '#e5e7eb' }
                          : selected
                          ? { background: '#fef2f2', color: '#991b1b', borderColor: '#dc2626' }
                          : { background: 'white', color: '#374151', borderColor: '#e5e7eb' }
                      }>
                      <span>{label}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isFull && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-200 text-gray-400">已满</span>
                        )}
                        {isLimited && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700">
                            剩余 {avail.available}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              {submitted && !form.startTime && (
                <p className="text-red-500 text-xs mt-1">请选择到达时段</p>
              )}
            </Field>
          )}
        </Section>

        {/* Section 2: 客户信息 */}
        <Section title="客户信息">
          <Field label="手机号" required>
            <input
              type="tel"
              value={form.customerPhone}
              onChange={e => set('customerPhone', e.target.value)}
              placeholder="04xxxxxxxx"
              className={`${inputCls} ${err('customerPhone') ? errorCls : ''}`}
            />
          </Field>

          {existingCustomer && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
              <Info size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700 flex-1">
                <span className="font-semibold">{existingCustomer.name}</span> · 老客户 ·
                共 {existingCustomer.orderCount} 单 {customerLevel}
                {existingCustomerCode && (
                  <span className="ml-2 text-xs bg-blue-100 px-2 py-0.5 rounded font-mono tracking-wider">
                    {existingCustomerCode}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="客户姓名" required>
              <input
                type="text"
                value={form.customerName}
                onChange={e => set('customerName', e.target.value)}
                placeholder="姓名"
                className={`${inputCls} ${err('customerName') ? errorCls : ''}`}
              />
            </Field>
            <Field label="微信号">
              <input type="text" value={form.wechat} onChange={e => set('wechat', e.target.value)} placeholder="选填" className={inputCls} />
            </Field>
          </div>
          <Field label="客户来源">
            <div className="flex flex-wrap gap-2">
              {SOURCES.map(s => (
                <button
                  key={s} type="button"
                  onClick={() => set('source', s)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    form.source === s
                      ? 'border-red-300 bg-red-50 text-red-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* Section 3: 地址 (搬家专属) */}
        {form.serviceType === '搬家' && (
          <Section title="搬运地址">
            <Field label="搬出地址" required icon={<MapPin size={14} className="text-red-400" />}>
              <AddressAutocomplete
                value={form.fromAddress}
                onChange={v => set('fromAddress', v)}
                onSelect={addr => handleAddressSelect('fromAddress', addr)}
                placeholder="完整地址 + 楼层信息"
                className={inputCls}
                pinColor="text-red-400"
                error={err('fromAddress')}
              />
            </Field>
            <Field label="搬入地址" required icon={<MapPin size={14} className="text-green-500" />}>
              <AddressAutocomplete
                value={form.toAddress}
                onChange={v => set('toAddress', v)}
                onSelect={addr => handleAddressSelect('toAddress', addr)}
                placeholder="完整地址 + 楼层信息"
                className={inputCls}
                pinColor="text-green-500"
                error={err('toAddress')}
              />
            </Field>

            {/* Distance + remote fee */}
            <Field label="远途档位距离（公司→较远一端）">
              <input
                type="number"
                value={form.distanceKm}
                onChange={e => set('distanceKm', e.target.value)}
                placeholder="自动填充，可手动覆盖"
                className={inputCls}
              />
            </Field>

            {km > 0 && (
              <RemoteFeeBox km={km} remote={remote} vehicle={form.vehicle} v={v} />
            )}
          </Section>
        )}

        {/* Section: 楼梯 / 电梯 (搬家专属) */}
        {form.serviceType === '搬家' && (
          <Section title="楼梯 / 电梯">
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: true,  label: '有电梯', sub: '$0' },
                { val: false, label: '有楼梯', sub: `$${STAIRS_FEE[v?.people || 1] || 0}/层` },
              ].map(opt => (
                <button key={String(opt.val)} type="button"
                  onClick={() => set('hasElevator', opt.val)}
                  className="p-3 rounded-xl border-2 text-center transition-colors"
                  style={form.hasElevator === opt.val
                    ? { borderColor: '#dc2626', background: '#fef2f2', color: '#991b1b' }
                    : { borderColor: '#e5e7eb', background: 'white', color: '#374151' }
                  }>
                  <p className="font-semibold text-sm">{opt.label}</p>
                  <p className="text-xs mt-0.5 opacity-70">{opt.sub}</p>
                </button>
              ))}
            </div>
            {!form.hasElevator && (
              <Field label="楼层数">
                <div className="flex items-center gap-3">
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, floors: Math.max(0, f.floors - 1) }))}
                    className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold">−</button>
                  <span className="w-12 text-center font-bold text-gray-900">{form.floors} 层</span>
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, floors: Math.min(20, f.floors + 1) }))}
                    className="w-9 h-9 rounded-xl bg-red-100 text-red-700 font-bold">+</button>
                  {stairsFee > 0 && (
                    <span className="text-sm font-bold text-red-600 ml-auto">楼梯费 ${stairsFee}</span>
                  )}
                </div>
              </Field>
            )}
          </Section>
        )}

        {/* Section: 重物大件 (搬家专属) */}
        {form.serviceType === '搬家' && (
          <Section title="重物 / 大件">
            <p className="text-xs text-gray-400 mb-3">
              💡 通过电话/微信跟客户确认有哪些重物，按需在下面填金额（不需要全部勾选）。
              师傅打开账单时会自动看到，现场可加可减。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {HEAVY_ITEM_OPTIONS.map(item => (
                <HeavyItemRow
                  key={item.id}
                  label={item.name}
                  value={form.heavyItems?.[item.id] || ''}
                  onChange={amt => set('heavyItems', { ...form.heavyItems, [item.id]: amt })}
                />
              ))}
              {/* 其他重物（带描述）— 桌面端跨两列 */}
              <div className="bg-gray-50 rounded-xl p-3 sm:col-span-2">
                <p className="text-sm font-medium text-gray-700 mb-2">其他重物（自定义）</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={form.heavyItems?.other?.description || ''}
                    onChange={e => set('heavyItems', {
                      ...form.heavyItems,
                      other: { ...(form.heavyItems?.other || {}), description: e.target.value }
                    })}
                    placeholder="物品名（如：石膏雕塑）"
                    className={inputCls + ' flex-1'}
                  />
                  <div className="flex items-center gap-2 sm:w-40">
                    <span className="text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      value={form.heavyItems?.other?.amount || ''}
                      onChange={e => set('heavyItems', {
                        ...form.heavyItems,
                        other: { ...(form.heavyItems?.other || {}), amount: e.target.value }
                      })}
                      placeholder="0"
                      className={inputCls + ' flex-1'}
                    />
                  </div>
                </div>
              </div>
            </div>
            {heavyFeeNum > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-amber-800">重物附加费合计</span>
                <span className="text-amber-800 font-bold">${heavyFeeNum}</span>
              </div>
            )}
          </Section>
        )}

        {/* Section 4: 物品 + 易碎 (搬家 only) */}
        {form.serviceType === '搬家' && (
        <Section title="物品信息">
          <Field label="搬运物品描述">
            <textarea
              value={form.items}
              onChange={e => set('items', e.target.value)}
              placeholder="列出主要物品，如：双人床、冰箱、沙发..."
              rows={3}
              className={inputCls}
            />
          </Field>

          <Field label="易碎物品（可多选）">
            <div className="flex flex-wrap gap-2">
              {FRAGILE_OPTIONS.map(item => (
                <button
                  key={item} type="button"
                  onClick={() => toggleFragile(item)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    form.fragileItems.includes(item)
                      ? 'border-amber-300 bg-amber-50 text-amber-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </Field>

          {form.fragileItems.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="客户描述">
                <input
                  type="text"
                  value={form.fragileDescription}
                  onChange={e => set('fragileDescription', e.target.value)}
                  placeholder="客户说明"
                  className={inputCls}
                />
              </Field>
              <Field label="预估易碎附加费 $">
                <input
                  type="number"
                  value={form.fragileEstimatedFee}
                  onChange={e => set('fragileEstimatedFee', e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </Field>
            </div>
          )}

          {form.fragileItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                提醒话术：「大件易碎物品可能产生额外收费，师傅现场确认后告知您，请提前做好准备。」
              </p>
            </div>
          )}
        </Section>

        )}

        {/* Section 5: 物资 (搬家 + 寄存) */}
        {(form.serviceType === '搬家' || form.serviceType === '寄存') && (
        <Section title="物资需求">
          <div className="grid grid-cols-3 gap-3">
            <MaterialRow
              label="纸箱" unit="个" price={MATERIAL_PRICES.boxes}
              value={form.materials.boxes}
              onChange={v => setMaterial('boxes', v)}
            />
            <MaterialRow
              label="胶带 / 打包膜" unit="卷" price={MATERIAL_PRICES.wrapItems}
              value={form.materials.wrapItems}
              onChange={v => setMaterial('wrapItems', v)}
            />
            <MaterialRow
              label="床垫套" unit="个" price={MATERIAL_PRICES.mattressCovers}
              value={form.materials.mattressCovers}
              onChange={v => setMaterial('mattressCovers', v)}
            />
            <MaterialRow
              label="打包物品" unit="件" price={MATERIAL_PRICES.packingItems}
              value={form.materials.packingItems}
              onChange={v => setMaterial('packingItems', v)}
            />
          </div>
          {materialsCost > 0 && (
            <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2 flex justify-between text-sm">
              <span className="text-gray-500">物资合计</span>
              <span className="font-semibold text-gray-800">${materialsCost}</span>
            </div>
          )}
          {materialsCost > 0 && (
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Package size={12} />
              师傅出发前将收到携带物资清单
            </p>
          )}
        </Section>
        )}

        {/* ── 寄存专属 ── */}
        {form.serviceType === '寄存' && (
          <Section title="寄存详情">
            {/* 上门取件 toggle */}
            <Field label="是否需要上门取件" required>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => set('needsPickup', true)}
                  className="p-3 rounded-xl border-2 text-center"
                  style={form.needsPickup
                    ? { borderColor: '#dc2626', background: '#fef2f2', color: '#991b1b' }
                    : { borderColor: '#e5e7eb', background: 'white', color: '#374151' }
                  }>
                  <p className="font-semibold text-sm">上门取件</p>
                  <p className="text-xs mt-0.5 opacity-70">需车型 + 时段 + 取件地址</p>
                </button>
                <button type="button" onClick={() => set('needsPickup', false)}
                  className="p-3 rounded-xl border-2 text-center"
                  style={!form.needsPickup
                    ? { borderColor: '#dc2626', background: '#fef2f2', color: '#991b1b' }
                    : { borderColor: '#e5e7eb', background: 'white', color: '#374151' }
                  }>
                  <p className="font-semibold text-sm">客户自送</p>
                  <p className="text-xs mt-0.5 opacity-70">无需车辆/时段</p>
                </button>
              </div>
            </Field>

            {/* 取件地址 (only when pickup) */}
            {form.needsPickup && (
              <Field label="取件地址" required icon={<MapPin size={14} className="text-red-400" />}>
                <AddressAutocomplete
                  value={form.fromAddress}
                  onChange={v => set('fromAddress', v)}
                  onSelect={addr => set('fromAddress', addr)}
                  placeholder="完整地址 + 楼层信息"
                  className={inputCls}
                  pinColor="text-red-400"
                  error={submitted && form.serviceType === '寄存' && form.needsPickup && !form.fromAddress}
                />
              </Field>
            )}

            {/* 送回 toggle */}
            <Field label="是否需要送回">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => set('needsReturn', true)}
                  className="p-2 rounded-xl border-2 text-center text-sm font-medium"
                  style={form.needsReturn
                    ? { borderColor: '#dc2626', background: '#fef2f2', color: '#991b1b' }
                    : { borderColor: '#e5e7eb', background: 'white', color: '#374151' }
                  }>需要送回</button>
                <button type="button" onClick={() => set('needsReturn', false)}
                  className="p-2 rounded-xl border-2 text-center text-sm font-medium"
                  style={!form.needsReturn
                    ? { borderColor: '#dc2626', background: '#fef2f2', color: '#991b1b' }
                    : { borderColor: '#e5e7eb', background: 'white', color: '#374151' }
                  }>客户自取</button>
              </div>
            </Field>

            {form.needsReturn && (
              <Field label="送回地址" icon={<MapPin size={14} className="text-green-500" />}>
                <AddressAutocomplete
                  value={form.deliveryAddress}
                  onChange={v => set('deliveryAddress', v)}
                  onSelect={addr => set('deliveryAddress', addr)}
                  placeholder="未确定可留空，客服稍后跟进"
                  className={inputCls}
                  pinColor="text-green-500"
                />
              </Field>
            )}

            {/* 储存物品数量 */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="纸箱数量">
                <div className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, storageBoxes: Math.max(0, f.storageBoxes - 1) }))}
                    className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold">−</button>
                  <span className="flex-1 text-center font-bold text-gray-900">{form.storageBoxes}</span>
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, storageBoxes: f.storageBoxes + 1 }))}
                    className="w-9 h-9 rounded-xl bg-red-100 text-red-700 font-bold">+</button>
                </div>
              </Field>
              <Field label="家具大件">
                <div className="flex items-center gap-2">
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, storageFurniture: Math.max(0, f.storageFurniture - 1) }))}
                    className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold">−</button>
                  <span className="flex-1 text-center font-bold text-gray-900">{form.storageFurniture}</span>
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, storageFurniture: f.storageFurniture + 1 }))}
                    className="w-9 h-9 rounded-xl bg-red-100 text-red-700 font-bold">+</button>
                </div>
              </Field>
            </div>

            {/* 取回日期 */}
            <Field label="预计取回日期">
              <input type="date" value={form.moveOutDate}
                onChange={e => set('moveOutDate', e.target.value)}
                className={inputCls} min={form.date} />
              <p className="text-xs text-gray-400 mt-1">从取件日（{form.date}）算起，约 {storageWeeks} 周</p>
            </Field>

            {/* Fee preview */}
            {(form.storageBoxes > 0 || form.storageFurniture > 0) && (
              <div className="rounded-xl p-3 text-sm space-y-1"
                style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <p className="text-xs font-semibold text-amber-700 mb-1">存储费参考</p>
                {form.storageBoxes > 0 && (
                  <div className="flex justify-between text-amber-800">
                    <span>纸箱 × {form.storageBoxes}（${storageBoxRate}/箱/周）</span>
                    <span>${form.storageBoxes * storageBoxRate}/周</span>
                  </div>
                )}
                {form.storageFurniture > 0 && (
                  <div className="flex justify-between text-amber-800">
                    <span>家具 × {form.storageFurniture}（${storageFurRate}/件/周）</span>
                    <span>${form.storageFurniture * storageFurRate}/周</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-1 border-t border-amber-300 text-amber-900">
                  <span>总价（{storageWeeks} 周）</span>
                  <span>${storageTotalFee}</span>
                </div>
                <p className="text-xs text-amber-500 mt-1">运输费另计，按取件车型小时数收取</p>
              </div>
            )}
          </Section>
        )}

        {/* ── IKEA 提货专属 ── */}
        {form.serviceType === 'IKEA 提货' && (
          <Section title="IKEA 提货详情">
            <Field label="服务类型" required>
              <div className="grid grid-cols-3 gap-2">
                {IKEA_SERVICES.map(s => (
                  <button key={s.key} type="button"
                    onClick={() => set('ikeaService', s.key)}
                    className="p-3 rounded-xl border-2 text-center transition-colors"
                    style={form.ikeaService === s.key
                      ? { borderColor: '#dc2626', background: '#fef2f2', color: '#991b1b' }
                      : { borderColor: '#e5e7eb', background: 'white', color: '#374151' }
                    }>
                    <p className="font-semibold text-xs">{s.label}</p>
                    <p className="text-[10px] mt-0.5 opacity-70">{s.desc}</p>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="IKEA 门店" required>
              <div className="flex flex-wrap gap-2">
                {IKEA_STORES.map(store => (
                  <button key={store} type="button"
                    onClick={() => set('ikeaStore', store)}
                    className="px-3 py-1.5 rounded-lg text-sm border transition-colors"
                    style={form.ikeaStore === store
                      ? { borderColor: '#dc2626', background: '#fef2f2', color: '#991b1b', fontWeight: 500 }
                      : { borderColor: '#e5e7eb', background: 'white', color: '#4b5563' }
                    }>
                    {store}
                  </button>
                ))}
              </div>
              {form.ikeaStore === '其他' && (
                <input type="text" value={form.ikeaStoreCustom}
                  onChange={e => set('ikeaStoreCustom', e.target.value)}
                  placeholder="请输入门店地址" className={`${inputCls} mt-2`} />
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="IKEA 订单号">
                <input type="text" value={form.ikeaOrderNo}
                  onChange={e => set('ikeaOrderNo', e.target.value)}
                  placeholder="选填" className={inputCls} />
              </Field>
              <Field label="是否处理垃圾">
                <div className="flex items-center gap-2 h-[42px]">
                  <button type="button"
                    onClick={() => set('needsRubbishDisposal', false)}
                    className="flex-1 py-2 rounded-lg text-sm border-2 transition-colors"
                    style={!form.needsRubbishDisposal
                      ? { borderColor: '#dc2626', background: '#fef2f2', color: '#991b1b' }
                      : { borderColor: '#e5e7eb', background: 'white', color: '#6b7280' }
                    }>否</button>
                  <button type="button"
                    onClick={() => set('needsRubbishDisposal', true)}
                    className="flex-1 py-2 rounded-lg text-sm border-2 transition-colors"
                    style={form.needsRubbishDisposal
                      ? { borderColor: '#dc2626', background: '#fef2f2', color: '#991b1b' }
                      : { borderColor: '#e5e7eb', background: 'white', color: '#6b7280' }
                    }>是</button>
                </div>
              </Field>
            </div>

            <Field label="物品清单">
              <textarea value={form.ikeaItems}
                onChange={e => set('ikeaItems', e.target.value)}
                placeholder="MALM 床架、HEMNES 衣柜..."
                rows={2} className={inputCls} />
            </Field>

            <Field label="客户收货地址" required icon={<MapPin size={14} className="text-green-500" />}>
              <AddressAutocomplete
                value={form.toAddress}
                onChange={v => set('toAddress', v)}
                onSelect={addr => handleAddressSelect('toAddress', addr)}
                placeholder="完整地址 + 楼层信息"
                className={inputCls}
                pinColor="text-green-500"
                error={submitted && form.serviceType === 'IKEA 提货' && !form.toAddress}
              />
            </Field>

            {km > 0 && (
              <RemoteFeeBox km={km} remote={remote} vehicle={form.vehicle} v={v} />
            )}

            <Field label="IKEA 订单 QR 截图（选填）">
              <input ref={qrInputRef} type="file" accept="image/*"
                className="hidden" onChange={handleQRUpload} />
              {!form.ikeaQRFile ? (
                <button type="button" onClick={() => qrInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm text-gray-500 hover:border-gray-400">
                  <Upload size={16} /> 上传 QR 截图
                </button>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-500" />
                    <span className="text-sm text-gray-700">{form.ikeaQRFile.name}</span>
                  </div>
                  <button type="button" onClick={() => set('ikeaQRFile', null)}
                    className="p-1 text-gray-400">
                    <X size={16} />
                  </button>
                </div>
              )}
            </Field>
          </Section>
        )}

        {/* ── 清洁服务专属 ── */}
        {form.serviceType === '清洁服务' && (
          <Section title="清洁详情">
            <Field label="清洁类型" required>
              <div className="grid grid-cols-2 gap-2">
                {CLEAN_TYPES.map(c => (
                  <button key={c.key} type="button"
                    onClick={() => set('cleanType', c.key)}
                    className="p-3 rounded-xl border-2 text-left transition-colors"
                    style={form.cleanType === c.key
                      ? { borderColor: '#dc2626', background: '#fef2f2', color: '#991b1b' }
                      : { borderColor: '#e5e7eb', background: 'white', color: '#374151' }
                    }>
                    <p className="font-semibold text-sm">{c.label}</p>
                    <p className="text-xs mt-0.5 opacity-70">{c.desc}</p>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="房型" required>
              <div className="grid grid-cols-5 gap-2">
                {ROOM_TYPES.map(r => (
                  <button key={r.key} type="button"
                    onClick={() => set('roomType', r.key)}
                    className="py-2 rounded-xl border-2 text-center transition-colors"
                    style={form.roomType === r.key
                      ? { borderColor: '#dc2626', background: '#fef2f2', color: '#991b1b' }
                      : { borderColor: '#e5e7eb', background: 'white', color: '#374151' }
                    }>
                    <span className="text-sm font-semibold">{r.label}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="卫生间数量">
              <div className="flex items-center gap-3">
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, bathroomCount: Math.max(1, f.bathroomCount - 1) }))}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold">−</button>
                <span className="w-12 text-center font-bold text-gray-900">{form.bathroomCount}</span>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, bathroomCount: Math.min(10, f.bathroomCount + 1) }))}
                  className="w-9 h-9 rounded-xl bg-red-100 text-red-700 font-bold">+</button>
              </div>
            </Field>

            <Field label="服务地址" required icon={<MapPin size={14} className="text-blue-500" />}>
              <AddressAutocomplete
                value={form.cleanAddress}
                onChange={v => set('cleanAddress', v)}
                onSelect={addr => set('cleanAddress', addr)}
                placeholder="完整地址 + 楼层信息"
                className={inputCls}
                pinColor="text-blue-500"
                error={submitted && form.serviceType === '清洁服务' && !form.cleanAddress}
              />
            </Field>

            <Field label="额外服务（可多选）">
              <div className="flex flex-wrap gap-2">
                {CLEAN_EXTRAS.map(item => (
                  <button key={item} type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      cleanExtras: f.cleanExtras.includes(item)
                        ? f.cleanExtras.filter(x => x !== item)
                        : [...f.cleanExtras, item],
                    }))}
                    className="px-3 py-1.5 rounded-lg text-sm border transition-colors"
                    style={form.cleanExtras.includes(item)
                      ? { borderColor: '#bfdbfe', background: '#eff6ff', color: '#1e40af', fontWeight: 500 }
                      : { borderColor: '#e5e7eb', background: 'white', color: '#4b5563' }
                    }>
                    {item}
                  </button>
                ))}
              </div>
            </Field>
          </Section>
        )}

        {/* ── 二手物品（占位，整页替代） ── */}
        {form.serviceType === '二手物品' && (
          <Section title="二手物品">
            <div className="rounded-xl p-6 text-center" style={{ background: '#F3F4F6', border: '1px dashed #9CA3AF' }}>
              <p className="text-3xl mb-2">🚧</p>
              <p className="font-bold text-gray-800 mb-2">二手物品模块开发中</p>
              <p className="text-xs text-gray-500 mb-4">该业务的字段还在与团队确认，暂未开放后台登记</p>
              <a href="tel:0426033899"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm"
                style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
                📞 暂请联系客服
              </a>
            </div>
          </Section>
        )}

        {/* Section 6: 报价 */}
        {form.serviceType !== '二手物品' && (
        <Section title="报价与定金">
          {/* Auto quote suggestion */}
          {form.serviceType === '搬家' && v && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3 text-sm">
              <p className="text-blue-700 font-semibold mb-1.5">系统建议报价</p>
              <div className="space-y-1 text-blue-600">
                <div className="flex justify-between">
                  <span>基础（{v.minHours}小时工时 + 出车费）</span>
                  <span>${baseQuote}</span>
                </div>
                {remote.total > 0 && (
                  <div className="flex justify-between">
                    <span>远程附加费（{remote.tier?.label}）</span>
                    <span>${remote.total}</span>
                  </div>
                )}
                {stairsFee > 0 && (
                  <div className="flex justify-between">
                    <span>楼梯费（{form.floors} 层 × ${STAIRS_FEE[v.people] || 0}）</span>
                    <span>${stairsFee}</span>
                  </div>
                )}
                {heavyFeeNum > 0 && (
                  <div className="flex justify-between">
                    <span>重物附加费</span>
                    <span>${heavyFeeNum}</span>
                  </div>
                )}
                {materialsCost > 0 && (
                  <div className="flex justify-between">
                    <span>物资费</span>
                    <span>${materialsCost}</span>
                  </div>
                )}
                {vanDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>面包车优惠</span>
                    <span>-${vanDiscount}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-1 border-t border-blue-200 text-blue-800">
                  <span>建议报价</span>
                  <span>${suggestedQuote}</span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="最终报价 $" required>
              <input
                type="number"
                value={form.quote}
                onChange={e => set('quote', e.target.value)}
                placeholder={`建议 $${suggestedQuote}`}
                className={inputCls}
              />
            </Field>
            <Field label="折扣">
              <select value={form.discount} onChange={e => set('discount', parseFloat(e.target.value))} className={selectCls}>
                {DISCOUNT_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>
          </div>

          {form.discount < 1 && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm flex justify-between">
              <span className="text-green-700">折后金额</span>
              <span className="text-green-700 font-bold">${discountedQuote}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="定金金额 $">
              <input
                type="number"
                value={form.deposit}
                onChange={e => set('deposit', parseFloat(e.target.value) || 0)}
                className={inputCls}
              />
            </Field>
            <div />
          </div>

          <Field label="定金状态" required>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'paid',    label: '✅ 已收定金',  desc: '可创建',     cls: 'border-green-300 bg-green-50 text-green-700' },
                { val: 'pending', label: '⏳ 待定',       desc: '需跟进',     cls: 'border-amber-300 bg-amber-50 text-amber-700' },
                { val: 'unpaid',  label: '❌ 未付款',     desc: '不可创建',   cls: 'border-red-200 bg-red-50 text-red-600' },
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => set('depositStatus', opt.val)}
                  className={`py-3 px-2 rounded-xl border-2 text-center transition-colors ${
                    form.depositStatus === opt.val ? opt.cls : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold leading-tight">{opt.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
            {submitted && !form.depositStatus && (
              <p className="text-red-500 text-xs mt-1">请选择定金状态</p>
            )}
            {form.depositStatus === 'unpaid' && (
              <p className="text-red-500 text-xs mt-1">未付款不可创建订单，请先收定金或选择"待定"</p>
            )}
            {form.depositStatus === 'pending' && (
              <p className="text-amber-600 text-xs mt-1">⚠️ 提醒：请在服务前督促客户补交定金</p>
            )}
          </Field>
        </Section>
        )}

        {/* Section 7: 备注 (隐藏给二手) */}
        {form.serviceType !== '二手物品' && (
        <Section title="备注">
          <Field label="备注">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="楼层、电梯情况、特殊要求..."
              rows={3}
              className={inputCls}
            />
          </Field>
          <div className="flex items-center justify-between py-2 px-1">
            <span className="text-sm text-gray-500">登记人</span>
            <span className="text-sm font-semibold text-gray-800">{user?.name || '-'}</span>
          </div>
        </Section>
        )}

        {/* Submit */}
        {submitted && form.serviceType !== '二手物品' && (
          <p className="text-red-500 text-sm text-center">请检查必填项（标 * 的字段）</p>
        )}

        {form.serviceType !== '二手物品' && (
        <div className="flex gap-3 pb-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 py-4 rounded-xl border border-gray-200 text-gray-600 font-semibold"
          >
            取消
          </button>
          <button
            type="submit"
            className="flex-1 py-4 rounded-xl text-white font-semibold shadow-sm"
            style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}
          >
            创建订单
          </button>
        </div>
        )}
      </form>
    </div>
  )
}

// ── Sub-components ──

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-4 py-4 space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, required, icon, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
        {icon}{label}{required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}

// 重物项目行（项目名 + 金额输入）
function HeavyItemRow({ label, value, onChange }) {
  const enabled = Number(value) > 0
  return (
    <div className={`rounded-xl px-3 py-2 flex items-center gap-3 transition-colors ${
      enabled ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
    }`}>
      <span className="text-sm text-gray-700 flex-1 font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-gray-400 text-sm">$</span>
        <input
          type="number"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className="w-24 px-2 py-1.5 border border-gray-200 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
      </div>
    </div>
  )
}

function MaterialRow({ label, unit, price, value, onChange }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xs text-gray-400 mb-2">${price}/{unit}</p>
      <div className="flex items-center justify-center gap-2">
        <button type="button" onClick={() => onChange(value - 1)} className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-300">-</button>
        <span className="w-6 text-center font-semibold text-gray-800 text-sm">{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} className="w-7 h-7 rounded-full bg-red-100 text-red-600 font-bold text-sm hover:bg-red-200">+</button>
      </div>
      {value > 0 && <p className="text-xs text-green-600 font-semibold mt-1">${value * price}</p>}
    </div>
  )
}

function RemoteFeeBox({ km, remote, vehicle, v }) {
  const tier = remote.tier
  if (!tier || tier.type === 'standard') return null

  const isSpecial = tier.type === 'special'
  const needsConfirm = tier.needsConfirm

  return (
    <div className={`rounded-xl border p-3 text-sm ${
      isSpecial || needsConfirm
        ? 'border-red-200 bg-red-50'
        : 'border-blue-200 bg-blue-50'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={14} className={needsConfirm ? 'text-red-500' : 'text-blue-500'} />
        <span className={`font-semibold ${needsConfirm ? 'text-red-700' : 'text-blue-700'}`}>
          {tier.label}
        </span>
      </div>

      {isSpecial ? (
        <p className="text-red-600">超远途订单，请人工报价</p>
      ) : (
        <div className={`space-y-1 ${needsConfirm ? 'text-red-600' : 'text-blue-600'}`}>
          <div className="flex justify-between">
            <span>返程时间费（{tier.returnHours}小时 × ${v?.hourlyRate}）</span>
            <span>${remote.returnFee}</span>
          </div>
          <div className="flex justify-between">
            <span>油费</span>
            <span>{tier.fuelMin === tier.fuelMax ? `$${tier.fuelMin}` : `$${tier.fuelMin}–$${tier.fuelMax}`}</span>
          </div>
          <div className={`flex justify-between font-bold pt-1 border-t ${needsConfirm ? 'border-red-200' : 'border-blue-200'}`}>
            <span>远程附加费</span>
            <span>${remote.total}</span>
          </div>
          {needsConfirm && (
            <p className="text-xs text-red-500 mt-1">⚠️ 超过120km，建议人工确认最终价格</p>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">
        超过30km将产生额外返程时间费和油费，请与客户说明。
      </p>
    </div>
  )
}

function getCustomerLevel(count) {
  if (count <= 1) return ''
  if (count === 2) return '⭐'
  if (count === 3) return '⭐⭐'
  if (count === 4) return '⭐⭐⭐'
  if (count === 5) return '🌙'
  if (count === 6) return '🌙⭐'
  if (count === 7) return '🌙⭐⭐'
  if (count === 8) return '🌙⭐⭐⭐'
  return '🌙🌙'
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-transparent'
const selectCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-200'
const errorCls = 'border-red-300 ring-1 ring-red-200'
