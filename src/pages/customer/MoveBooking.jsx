import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Phone, CheckCircle, ChevronRight, Upload, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import VerifyCodeModal from '../../components/VerifyCodeModal'
import dayjs from 'dayjs'
import AddressAutocomplete from '../../components/AddressAutocomplete'
import { getRemoteDistanceKm } from '../../utils/googleMaps'
import { calcRemoteSurcharge } from '../../utils/remoteFee'
import { SLOT_CONFIG, fetchSlotsAvailability } from '../../utils/slotAvailability'
import { VAN_PROMO_DISCOUNT } from '../../data/vehicles'

const GRAD   = 'linear-gradient(135deg, #A52535, #C0392B)'
const BG     = '#F7F7F7'
const MID    = '#A52535'
const BORDER = '#EFEFEF'

const TIME_SLOTS = {
  van:   SLOT_CONFIG.van.slots,
  small: SLOT_CONFIG.small.slots,
  large: SLOT_CONFIG.large.slots,
}

const VEHICLES = [
  {
    id: 'van', name: '面包车', nameEn: 'Toyota Hiace',
    tagline: '小件搬运首选，灵活便捷',
    volume: '6.2', weight: '900公斤', dims: '5.3 × 1.9 × 2.1 m', cargoDims: '2.55 × 1.54 × 1.32 m',
    img: '/images/van-full.jpg',
    scenarios: ['单身公寓搬出', '合租房间搬运', '学生搬家', '少量家具', '行李搬运', '小件配送'],
    advantages: ['价格最低', '灵活好停车', '地库友好', '市区高效'],
    loadRef: '约可装 35 标准纸箱左右 / 1 个床垫 + 少量纸箱 / 少量小型家具等',
    note: '物品较多（2 房以上）建议选小卡车',
    configs: [
      { key: '面包车', label: '司机 1 人', people: 1, rate: 60, minHours: 1, returnFee: 60 },
    ],
  },
  {
    id: 'small', name: '小卡车', nameEn: 'Isuzu 4.5T',
    tagline: '1–2 房搬家最受欢迎，性价比最高',
    volume: '20', weight: '4.5T', dims: '6.2 × 2.3 × 3.1 m', cargoDims: '4.4 × 2.25 × 2.2 m',
    img: '/images/small-truck.jpg',
    tag: '最受欢迎',
    scenarios: ['1–2 房公寓整体搬家', '家具家电较多', '中型搬迁', '跨区搬家'],
    advantages: ['空间充足', '专业搬运团队', '高效完成', '可应对复杂楼层'],
    loadRef: '约可装 1–2 房间全部家具及物品',
    note: null,
    configs: [
      { key: '小卡车',   label: '2 人团队', people: 2, rate: 110, minHours: 2, returnFee: 110 },
      { key: '小卡三人', label: '3 人团队', people: 3, rate: 160, minHours: 2, returnFee: 160 },
    ],
  },
  {
    id: 'large', name: '大卡车', nameEn: 'Hino 8T',
    tagline: '3 房以上 / House，一次搬完',
    volume: '30', weight: '8T', dims: '7.5 × 2.4 × 3.3 m', cargoDims: '6.0 × 2.2 × 2.35 m',
    img: '/images/large-truck.jpg',
    scenarios: ['3 房以上 / House', '整屋搬迁', '大型家具家电', '别墅搬家'],
    advantages: ['超大容积', '专业大件搬运', '一次装完', '效率最高'],
    loadRef: '约可装 3–5 房间全部物品',
    note: null,
    configs: [
      { key: '大卡车',   label: '2 人团队', people: 2, rate: 120, minHours: 2, returnFee: 120 },
      { key: '大卡三人', label: '3 人团队', people: 3, rate: 165, minHours: 2, returnFee: 165 },
    ],
  },
]

const STAIRS_OPTIONS = [
  { value: 'none',     label: '无楼梯/电梯', desc: '平层或直接车位搬入' },
  { value: 'elevator', label: '有电梯',       desc: '楼层间可用电梯'   },
  { value: 'stairs',   label: '有楼梯',       desc: '需爬楼梯搬运'     },
  { value: 'both',     label: '楼梯+电梯',    desc: '两者都有'         },
]

export default function MoveBooking() {
  const navigate = useNavigate()
  const location = useLocation()
  const { createOrderWithSlotCheck } = useApp()
  const fileInputRef = useRef(null)

  // ── Source tracking from URL (?source=xiaohongshu_landing 等) ──
  const sourceLabel = (() => {
    const sp = new URLSearchParams(location.search)
    const raw = sp.get('source')
    const map = {
      xiaohongshu_landing: '小红书落地页',
      xiaohongshu:         '小红书',
      wechat:              '微信',
      gbp:                 'Google Business',
      facebook:            'Facebook',
      instagram:           'Instagram',
      truck_qr:            '货车 QR 码',
    }
    return map[raw] || (raw ? `自定义: ${raw}` : '官网自助预约')
  })()

  const initId = location.state?.vehicleId ?? null
  const [step, setStep]           = useState(initId ? 1 : 0)
  const [vehicleId, setVehicleId] = useState(initId)
  const [configIdx, setConfigIdx] = useState(0)
  const [depositFile, setDepositFile] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [orderId, setOrderId]     = useState(null)
  const [errors, setErrors]       = useState({})
  const [boxesNeeded,     setBoxesNeeded]     = useState(0)
  const [wrapNeeded,      setWrapNeeded]      = useState(0)
  const [mattressCovers,  setMattressCovers]  = useState(0)
  const [packingItems,    setPackingItems]    = useState(0)
  const [extrasOpen, setExtrasOpen]           = useState(false)
  const [alipayOpen, setAlipayOpen]           = useState(false)
  const [showWechat, setShowWechat]           = useState(false)
  const [slotAvailability, setSlotAvailability] = useState({})
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [submitting, setSubmitting]           = useState(false)
  const [submitError, setSubmitError]         = useState(null)
  const [showVerify, setShowVerify]           = useState(false)
  const [customerCode, setCustomerCode]       = useState(null)

  const [form, setForm] = useState({
    name: '', phone: '', wechat: '',
    fromAddress: '', toAddress: '', distanceKm: null,
    items: '',
    stairs: 'none', stairsFloors: 1,
    date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    timeSlot: '',
    notes: '',
  })

  const vehicle = VEHICLES.find(v => v.id === vehicleId)
  const config  = vehicle?.configs[configIdx]
  const slots   = vehicleId ? TIME_SLOTS[vehicleId] : []

  const baseEstimate    = config ? config.rate * config.minHours + config.returnFee : 0
  const remoteEstimate  = (form.distanceKm !== null && config)
    ? calcRemoteSurcharge(form.distanceKm, config.key).total : 0
  const materialsEstimate = boxesNeeded * 5 + wrapNeeded * 3 + mattressCovers * 10 + packingItems * 5
  const stairsFee     = form.stairs === 'stairs' ? form.stairsFloors * 10 * (config?.people ?? 1) : 0
  const vanDiscount   = vehicleId === 'van' ? VAN_PROMO_DISCOUNT : 0
  const totalEstimate = baseEstimate + remoteEstimate + materialsEstimate + stairsFee - vanDiscount

  const extrasTags = [
    form.stairs === 'elevator' ? '有电梯' : form.stairs === 'stairs' ? `楼梯 ${form.stairsFloors} 层` : null,
    boxesNeeded > 0 ? `纸箱 ×${boxesNeeded}` : null,
    wrapNeeded  > 0 ? `打包膜 ×${wrapNeeded}` : null,
  ].filter(Boolean)
  const extrasSummary = extrasTags.length > 0 ? extrasTags.join(' · ') : '楼梯 · 重物大件 · 打包物资'

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: false }))
  }

  async function handleAddressSelect(field, address) {
    set(field, address)
    const from = field === 'fromAddress' ? address : form.fromAddress
    const to   = field === 'toAddress'   ? address : form.toAddress
    if (from && to) {
      const km = await getRemoteDistanceKm(from, to)
      if (km !== null) setForm(f => ({ ...f, distanceKm: km }))
    }
  }

  // Load availability whenever vehicle or date changes (only matters from step 2 onward)
  useEffect(() => {
    if (!vehicleId || !form.date) return
    let cancelled = false
    setAvailabilityLoading(true)
    fetchSlotsAvailability(vehicleId, form.date).then(result => {
      if (!cancelled) {
        setSlotAvailability(result)
        setAvailabilityLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [vehicleId, form.date])

  function selectVehicle(id) {
    setVehicleId(id)
    setConfigIdx(0)
    setSlotAvailability({})
    setForm(f => ({ ...f, timeSlot: '' }))
    setStep(1)
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${dayjs().format('YYYYMMDD')}_${Date.now()}.${ext}`
    const { data: stored, error } = await supabase.storage
      .from('deposit-screenshots')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage
        .from('deposit-screenshots').getPublicUrl(stored.path)
      setDepositFile({ name: file.name, url: publicUrl })
      setErrors(err => ({ ...err, depositFile: false }))
      return
    }
    // Fallback: base64 (e.g. bucket not yet created)
    console.warn('[upload] storage failed, using base64:', error.message)
    const reader = new FileReader()
    reader.onload = ev => {
      setDepositFile({ name: file.name, data: ev.target.result })
      setErrors(err => ({ ...err, depositFile: false }))
    }
    reader.readAsDataURL(file)
  }

  function validate() {
    const e = {}
    if (!form.fromAddress.trim()) e.fromAddress = true
    if (!form.toAddress.trim())   e.toAddress   = true
    if (!form.name.trim())        e.name        = true
    if (!form.phone.trim())       e.phone       = true
    if (!form.date)               e.date        = true
    if (!form.timeSlot)           e.timeSlot    = true
    if (!depositFile)             e.depositFile = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const hasSubmittedRef = useRef(false)

  // Step 1: validate form → show verify modal
  function handleSubmit() {
    if (!validate()) {
      setTimeout(() => {
        const el = document.querySelector('.border-red-400')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 30)
      return
    }
    setShowVerify(true)
  }

  // Step 2: called by VerifyCodeModal after code confirmed → create order
  async function handleVerifySuccess() {
    setShowVerify(false)
    if (hasSubmittedRef.current) return
    hasSubmittedRef.current = true
    setSubmitting(true)
    setSubmitError(null)

    const stairsLabel = STAIRS_OPTIONS.find(s => s.value === form.stairs)?.label ?? ''

    try {
      const order = await createOrderWithSlotCheck({
        customerName:   form.name,
        customerPhone:  form.phone,
        wechat:         form.wechat,
        fromAddress:    form.fromAddress,
        toAddress:      form.toAddress,
        date:           form.date,
        startTime:      form.timeSlot,
        vehicle:        config.key,
        items:          form.items,
        notes:          [stairsLabel ? `楼梯：${stairsLabel}` : null, form.notes].filter(Boolean).join('；'),
        depositScreenshot: depositFile || null,
        depositStatus:  depositFile ? '已上传截图' : '待付定金',
        distanceKm:     form.distanceKm,
        remoteSurcharge: remoteEstimate,
        stairFee:       stairsFee,
        serviceType:    '搬家',
        source:         sourceLabel,
        status:         '待确认',
        quote:          totalEstimate,
        quoteNote: [
          `$${config.rate}×${config.minHours}h + $${config.returnFee}(返程费) = $${baseEstimate}`,
          vanDiscount       > 0 ? `- 优惠 $${vanDiscount}`            : null,
          remoteEstimate    > 0 ? `+ 远途 $${remoteEstimate}`         : null,
          stairsFee         > 0 ? `+ 楼梯 $${stairsFee}`             : null,
          materialsEstimate > 0 ? `+ 物资 $${materialsEstimate}`      : null,
          `= $${totalEstimate}起`,
        ].filter(Boolean).join(' '),
        requestedMaterials: (boxesNeeded > 0 || wrapNeeded > 0 || mattressCovers > 0 || packingItems > 0)
          ? { boxes: boxesNeeded, wrapItems: wrapNeeded, mattressCovers, packingItems }
          : null,
      })
      setOrderId(order.id)
      setCustomerCode(order.customer_code || null)
      localStorage.setItem('mwe_phone', form.phone.trim())
      localStorage.setItem('mwe_name', form.name.trim())
      setSubmitted(true)
    } catch (err) {
      hasSubmittedRef.current = false
      setSubmitError(err.message || '提交失败，请重试')
      fetchSlotsAvailability(vehicleId, form.date).then(setSlotAvailability)
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Success screen ── */
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: BG }}>
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-sm text-center"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: BG }}>
            <CheckCircle size={40} style={{ color: MID }} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">预约成功</h2>
          <p className="text-gray-500 text-sm mb-1">
            订单号：<strong className="text-gray-800">{orderId}</strong>
          </p>
          {customerCode && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl mb-2"
              style={{ background: '#FDF2F2', border: `1.5px solid #EDCCD0` }}>
              <span className="text-xs text-gray-500">档案编号</span>
              <span className="font-black text-lg tracking-widest" style={{ color: MID }}>{customerCode}</span>
            </div>
          )}
          <p className="text-gray-400 text-sm mb-6">已为您建立订单档案，客服会尽快联系您确认</p>

          <div className="rounded-2xl p-4 text-left space-y-2 mb-4 text-sm" style={{ background: BG }}>
            <div className="flex justify-between">
              <span className="text-gray-500">车型</span>
              <span className="font-medium">{vehicle?.name}（{config?.label}）</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">日期</span>
              <span className="font-medium">{form.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">到达时段</span>
              <span className="font-medium">{form.timeSlot}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-gray-500 flex-shrink-0">收费参考</span>
              <span className="font-medium text-right text-xs leading-relaxed">
                ${config?.rate}×{config?.minHours}h + ${config?.rate}(返程费)<br/>
                <span className="text-gray-800 font-bold">= ${config ? config.rate * config.minHours + config.rate : 0} 起</span>
              </span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-gray-500 flex-shrink-0">定金状态</span>
              <span className={`font-medium text-right ${depositFile ? 'text-green-600' : 'text-orange-500'}`}>
                {depositFile ? '截图已上传' : '等待客服确认后支付'}
              </span>
            </div>
          </div>

          <div className="rounded-xl p-3 mb-4 text-xs text-left text-orange-700"
            style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
            定金截图已收到，客服将在 1 小时内致电确认并锁定档期。
          </div>

          <div className="rounded-2xl p-4 text-left mb-4 bg-white"
            style={{ borderLeft: '3px solid #F59E0B', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <p className="font-bold text-sm mb-2.5" style={{ color: MID }}>📋 温馨提示</p>
            <div className="space-y-1.5 text-sm text-gray-600">
              {['请提前预留停车位', '公寓请提前预约电梯', '提前打包易碎 / 贵重物品', '楼梯、重物、长距离搬运请提前告知'].map(tip => (
                <div key={tip} className="flex items-start gap-2">
                  <span className="text-green-500 flex-shrink-0 mt-0.5 font-bold text-xs">✓</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>

          <a href="tel:0426033899"
            className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-2xl mb-3 block text-center"
            style={{ background: GRAD }}>
            <Phone size={16} /> 电话确认
          </a>
          <button
            onClick={() => navigate(`/my-order?id=${orderId}&phone=${encodeURIComponent(form.phone)}`)}
            className="w-full py-3 rounded-2xl font-semibold text-sm mb-2"
            style={{ background: BG, color: MID, border: `1.5px solid ${BORDER}` }}>
            查看我的预约详情
          </button>
          <button onClick={() => navigate('/')}
            className="w-full py-3 rounded-2xl text-gray-400 text-sm">
            返回首页
          </button>
        </div>
      </div>
    )
  }

  /* ── Header ── */
  const header = (
    <div className="bg-white sticky top-0 z-10" style={{ borderBottom: `1px solid ${BORDER}` }}>
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
        <button
          onClick={() => (step === 0 || (step === 1 && initId !== null)) ? navigate('/') : setStep(s => s - 1)}
          className="p-2 -ml-2 text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <span className="font-bold text-gray-900 flex-1">搬家预约</span>
        <a href="tel:0426033899" className="flex items-center gap-1 text-sm font-medium"
          style={{ color: MID }}>
          <Phone size={14} /> 电话咨询
        </a>
      </div>
      <div className="max-w-lg mx-auto px-4 pb-3 flex items-center gap-2">
        {['选车型', '车型详情', '填写预约'].map((label, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className="flex items-center gap-1.5 text-xs"
              style={{ color: i <= step ? MID : '#d1d5db' }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={
                  i < step
                    ? { background: MID, color: 'white' }
                    : i === step
                    ? { background: BG, color: MID, outline: `2px solid ${BORDER}` }
                    : { background: '#f3f4f6', color: '#9ca3af' }
                }>
                {i < step ? '✓' : i + 1}
              </div>
              <span className="font-medium">{label}</span>
            </div>
            {i < 2 && (
              <div className="flex-1 h-0.5 mx-2 rounded"
                style={{ background: i < step ? MID : '#e5e7eb' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      {header}

      <div className="max-w-lg mx-auto px-4 py-4">

        {/* ── STEP 0: Vehicle selection ── */}
        {step === 0 && (
          <div className="space-y-4">

            {/* 引导卡 */}
            <div className="bg-white rounded-2xl px-5 py-4"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderLeft: `4px solid ${MID}` }}>
              <p className="font-extrabold text-gray-900 text-base mb-1">选择搬运车型</p>
              <p className="text-xs text-gray-400 leading-relaxed">根据物品量选择合适车辆，点击查看详情及报价</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                {[
                  { icon: '📦', tip: '箱子为主 → 面包车' },
                  { icon: '🛋️', tip: '1–2 房 → 小卡车' },
                  { icon: '🏠', tip: '3 房以上 → 大卡车' },
                ].map(t => (
                  <div key={t.tip} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span>{t.icon}</span><span>{t.tip}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid #F0F0F0' }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">不确定选车？不用纠结 👍</p>
                    <p className="text-xs text-gray-400 mt-0.5">添加客服微信，免费帮您确认车型 + 预估价格</p>
                  </div>
                  <button
                    onClick={() => setShowWechat(v => !v)}
                    className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg text-white"
                    style={{ background: MID }}>
                    💬 添加微信
                  </button>
                </div>
                {showWechat && (
                  <div className="mt-3 rounded-xl p-4 flex items-center gap-4"
                    style={{ background: '#F7F7F7' }}>
                    <img src="/wechat-qr.jpg" alt="微信二维码"
                      className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400 mb-1">扫码或搜索微信号添加客服</p>
                      <p className="font-bold text-sm text-gray-900">qianxibanjia888</p>
                      <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">发送物品照片，免费确认车型及预估费用</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Vehicle cards */}
            {VEHICLES.map(v => (
              <div key={v.id} className="bg-white rounded-2xl overflow-hidden"
                style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                {/* Image */}
                <div className="relative overflow-hidden" style={{ height: 190 }}>
                  <img src={v.img} alt={v.name}
                    className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0"
                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.38) 0%, transparent 55%)' }} />
                  {v.tag && (
                    <div className="absolute top-3 left-3 text-white text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: MID }}>
                      ⭐ {v.tag}
                    </div>
                  )}
                  {/* Price badge */}
                  <div className="absolute bottom-3 right-3 rounded-xl px-3 py-2 text-right"
                    style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}>
                    <p className="font-black text-lg leading-none" style={{ color: MID }}>
                      ${v.configs[0].rate}
                      <span className="text-xs font-normal text-gray-400">/h起</span>
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">最少 {v.configs[0].minHours}h</p>
                  </div>
                  {/* Name overlay */}
                  <div className="absolute bottom-3 left-4">
                    <p className="text-white font-extrabold text-lg leading-tight">{v.name}</p>
                    <p className="text-white/70 text-xs">{v.nameEn}</p>
                  </div>
                </div>

                {/* Body */}
                <div className="px-4 pt-3 pb-4">
                  <p className="text-xs text-gray-500 mb-3">{v.tagline}</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {v.scenarios.slice(0, 3).map(s => (
                      <span key={s} className="text-xs px-2.5 py-1 rounded-full"
                        style={{ background: '#F5F5F5', color: '#555' }}>{s}</span>
                    ))}
                  </div>
                  <button onClick={() => selectVehicle(v.id)}
                    className="w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-1.5"
                    style={{ background: GRAD }}>
                    查看详情并预约 <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── STEP 1: Vehicle detail ── */}
        {step === 1 && vehicle && (
          <div className="space-y-4 pb-28">

            {/* Hero */}
            <div className="rounded-2xl overflow-hidden relative" style={{ height: 220 }}>
              <img src={vehicle.img} alt={vehicle.name}
                className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)' }} />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <p className="text-white font-extrabold text-2xl leading-tight">{vehicle.name}</p>
                <p className="text-white/65 text-xs mt-1">{vehicle.nameEn} · {vehicle.dims} · {vehicle.volume}m³</p>
              </div>
              <button onClick={() => setStep(0)}
                className="absolute top-3 right-3 text-white text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background: 'rgba(0,0,0,0.3)' }}>
                更换车型
              </button>
            </div>

            {/* 适合搬运场景 */}
            <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: MID }} />
                <h3 className="font-bold text-gray-800 text-sm">适合搬运场景</h3>
              </div>
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-3 mb-3">
                {vehicle.scenarios.map(s => (
                  <div key={s} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-white"
                      style={{ background: MID, fontSize: 9 }}>✓</span>
                    {s}
                  </div>
                ))}
              </div>
              {vehicle.note && (
                <div className="rounded-xl px-3.5 py-2.5 flex items-start gap-2"
                  style={{ background: '#FFFBF0', borderLeft: '3px solid #F59E0B' }}>
                  <span className="text-sm flex-shrink-0">⚠️</span>
                  <p className="text-xs text-amber-800 leading-snug font-medium">{vehicle.note}</p>
                </div>
              )}
            </div>

            {/* 收费方式 */}
            <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: MID }} />
                <h3 className="font-bold text-gray-800 text-sm">收费方式</h3>
              </div>
              {vehicle.configs.length > 1 ? (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {vehicle.configs.map((c, i) => (
                    <button key={c.key} onClick={() => setConfigIdx(i)}
                      className="p-4 rounded-xl border-2 text-left transition-all"
                      style={configIdx === i
                        ? { borderColor: MID, background: '#FDF2F2' }
                        : { borderColor: '#EFEFEF', background: 'white' }}>
                      <p className="text-xs text-gray-400 mb-1">👥 {c.label}</p>
                      <p className="font-black leading-none" style={{ fontSize: '1.6rem', color: configIdx === i ? MID : '#111' }}>
                        ${c.rate}<span className="text-xs font-normal text-gray-400"> / h</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-2">最少 {c.minHours} 小时</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl p-4 mb-4 flex items-center justify-between"
                  style={{ background: '#FDF2F2', border: `1px solid #EDCCD0` }}>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">👥 {vehicle.configs[0].label}</p>
                    <p className="text-xs text-gray-400">最少 {vehicle.configs[0].minHours}h</p>
                  </div>
                  <p className="font-black" style={{ fontSize: '2rem', color: MID, lineHeight: 1 }}>
                    ${vehicle.configs[0].rate}<span className="text-xs font-normal text-gray-400">/h</span>
                  </p>
                </div>
              )}
              {(() => {
                const rawFee = vehicle.configs[configIdx]?.returnFee
                const fee = vehicle.id === 'van' && rawFee ? rawFee - VAN_PROMO_DISCOUNT : rawFee
                return fee ? (
                  <div className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3"
                    style={{ borderLeft: '3px solid #F59E0B', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div>
                      <p className="text-xs font-bold text-gray-700">↩ 回程费</p>
                      <p className="text-xs text-gray-400 mt-0.5">根据距离调整，以客服报价为准</p>
                    </div>
                    <p className="font-black text-lg flex-shrink-0" style={{ color: MID }}>
                      ${fee}<span className="text-xs font-normal text-gray-400">起</span>
                    </p>
                  </div>
                ) : null
              })()}
              <div className="text-xs text-gray-400 space-y-1">
                <p>· 师傅到达并联系客户确认后开始计时，搬到新地址并全部卸完为止</p>
                <p>· 最终报价以客服确认为准</p>
              </div>
            </div>

            {/* 费用计算方式 */}
            <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: MID }} />
                <h3 className="font-bold text-gray-800 text-sm">费用计算方式</h3>
              </div>
              <div className="flex items-center gap-1 mb-4">
                {[
                  { label: '时间费用' },
                  { sym: '+' },
                  { label: '回程费' },
                  { sym: '+' },
                  { label: '楼梯费' },
                  { sym: '+' },
                  { label: '其他费用' },
                  { sym: '=' },
                  { label: '总费用', highlight: true },
                ].map((item, i) => (
                  'sym' in item ? (
                    <span key={i} className="text-gray-400 font-bold text-xs flex-shrink-0">{item.sym}</span>
                  ) : (
                    <div key={i} className="flex-1 py-2 rounded-lg text-center min-w-0"
                      style={{ background: item.highlight ? MID : '#F5F5F5' }}>
                      <span style={{ fontSize: 9.5, fontWeight: 600, color: item.highlight ? 'white' : '#666', display: 'block', lineHeight: 1.4 }}>
                        {item.label}
                      </span>
                    </div>
                  )
                ))}
              </div>
              <div className="space-y-2 pt-3" style={{ borderTop: '1px solid #F5F5F5' }}>
                {['按实际时间计费', '搬前可确认大致费用'].map(t => (
                  <div key={t} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="font-bold flex-shrink-0" style={{ color: MID }}>✓</span>
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* 装载能力 */}
            <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: MID }} />
                <h3 className="font-bold text-gray-800 text-sm">装载能力（约可装）</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">{vehicle.loadRef}</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: `${vehicle.volume}m³`, label: '容积' },
                  { val: vehicle.weight || '—', label: '载重' },
                  { val: vehicle.dims.split('×')[0].trim() + 'm', label: '车长' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl p-3 text-center" style={{ background: '#F7F7F7' }}>
                    <p className="font-black text-base leading-tight" style={{ color: MID }}>{item.val}</p>
                    <p className="text-gray-400 text-xs mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
              {vehicle.cargoDims && (
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500 px-1">
                  <span>车厢内尺寸（长×宽×高）</span>
                  <span className="font-mono text-gray-700">{vehicle.cargoDims}</span>
                </div>
              )}
            </div>

            {/* 可能产生的额外费用 */}
            <div className="bg-white rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderLeft: '3px solid #F59E0B' }}>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: '#F59E0B' }} />
                  <h3 className="font-bold text-gray-800 text-sm">可能产生的额外费用</h3>
                </div>
                <div className="space-y-3.5 mb-4">
                  {[
                    { icon: '🪜', name: '楼梯费',        fee: '$10 / 人 / 层', note: '无电梯或需要爬楼时收取' },
                    { icon: '📍', name: '超远距离',      fee: '按距离计算',    note: '超出常规服务范围按实况收取' },
                    { icon: '🅿️', name: '停车费 / Toll', fee: '客户承担',      note: '停车费、过路费由客户承担' },
                    { icon: '⚖️', name: '重物费',        fee: '现场评估',      note: '钢琴、大理石等重物另行收费' },
                  ].map(item => (
                    <div key={item.name} className="flex items-start gap-3">
                      <span className="text-base flex-shrink-0 mt-0.5">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-gray-700">{item.name}</span>
                          <span className="text-sm font-bold flex-shrink-0" style={{ color: MID }}>{item.fee}</span>
                        </div>
                        <p className="text-xs text-gray-400">{item.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-3 text-xs text-gray-500"
                  style={{ borderTop: '1px solid #F5F5F5' }}>
                  <span style={{ color: MID }}>✓</span>
                  所有费用可提前确认，透明无隐藏收费
                </div>
              </div>
            </div>


{/* 信任条 */}
            <div className="bg-white rounded-2xl grid grid-cols-4 py-4 px-2"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              {[
                { icon: '👍', value: '1000+', label: '客户好评' },
                { icon: '⭐', value: '4.9',   label: '服务评分' },
                { icon: '📅', value: '7天',   label: '可预约'   },
                { icon: '🛡️', value: '运输',  label: '保险保障' },
              ].map((t, i) => (
                <div key={t.label} className="text-center"
                  style={i > 0 ? { borderLeft: '1px solid #F0F0F0' } : {}}>
                  <p className="text-base leading-none mb-1">{t.icon}</p>
                  <p className="text-sm font-extrabold" style={{ color: MID }}>{t.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#999' }}>{t.label}</p>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* ── Fixed bottom CTA (step 1 only) ── */}
        {step === 1 && vehicle && (
          <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-6 pt-3"
            style={{ background: 'linear-gradient(to top, #F7F7F7 75%, transparent)' }}>
            <div className="max-w-lg mx-auto flex gap-3">
              <button onClick={() => setStep(2)}
                className="flex-1 py-4 rounded-2xl text-white font-bold text-base"
                style={{ background: GRAD, boxShadow: '0 4px 20px rgba(139,38,53,0.35)' }}>
                立即预约 · {vehicle.name} →
              </button>
              <a href="tel:0426033899"
                className="flex-shrink-0 py-4 px-5 rounded-2xl font-bold text-sm flex items-center gap-1.5"
                style={{ background: 'white', border: `1.5px solid ${MID}`, color: MID, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                📞 咨询
              </a>
            </div>
          </div>
        )}

        {/* ── STEP 2: Order form ── */}
        {step === 2 && vehicle && (
          <>
          <div className="space-y-4 pb-36">
            {/* Summary */}
            <div className="rounded-2xl px-4 py-3" style={{ background: BG, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm" style={{ color: MID }}>
                    {vehicle.name} · {config?.label}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    ${config?.rate}/h · {config?.minHours}h起 · 30公里内${vehicle.id === 'van' ? (config?.returnFee ?? 0) - VAN_PROMO_DISCOUNT : config?.returnFee}返程费 · 客服确认后为准
                  </p>
                </div>
                <button onClick={() => setStep(1)} className="text-xs text-gray-400 underline">
                  修改
                </button>
              </div>
            </div>

            {/* 1. Date + Time */}
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <h3 className="font-bold text-gray-800 mb-3 text-sm">搬家日期与到达时段</h3>
              <input type="date" value={form.date}
                onChange={e => set('date', e.target.value)}
                min={dayjs().add(1, 'day').format('YYYY-MM-DD')}
                className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200 mb-3 ${errors.date ? 'border-red-400' : 'border-gray-200'}`} />
              {errors.date && <p className="text-red-500 text-xs -mt-2 mb-2">请选择搬家日期</p>}

              <p className="text-xs font-medium text-gray-700 mb-1">选择到达时段 *</p>
              <p className="text-xs text-gray-400 mb-2">
                第一单可准时到达；后续时段受上一单工时及路况影响，为预计窗口
              </p>
              {availabilityLoading && (
                <p className="text-xs text-gray-400 mb-2 text-center">正在查询可用时段…</p>
              )}
              <div className="space-y-2">
                {slots.map((slot, idx) => {
                  const avail    = slotAvailability[slot]
                  const isFull   = avail && avail.available <= 0
                  const isLimited = avail && avail.available > 0 && avail.available < avail.capacity
                  const selected = form.timeSlot === slot
                  const slotLabel = idx === 0
                    ? `${slot.split('–')[0]} 准时到达`
                    : slot
                  return (
                    <button key={slot}
                      disabled={isFull}
                      onClick={() => !isFull && set('timeSlot', slot)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors text-left flex items-center justify-between"
                      style={
                        isFull
                          ? { background: '#f3f4f6', color: '#9ca3af', cursor: 'not-allowed', opacity: 0.55 }
                          : selected
                          ? { background: GRAD, color: 'white' }
                          : { background: '#f3f4f6', color: '#374151' }
                      }>
                      <span>{slotLabel}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isFull && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-200 text-gray-400">
                            已满
                          </span>
                        )}
                        {isLimited && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={selected
                              ? { background: 'rgba(255,255,255,0.25)', color: 'white' }
                              : { background: '#FEF3C7', color: '#D97706' }
                            }>
                            剩余1个
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              {errors.timeSlot && <p className="text-red-500 text-xs mt-1">请选择到达时段</p>}
            </div>

            {/* 2. Contact */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3"
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <h3 className="font-bold text-gray-800 text-sm">联系方式</h3>
              {[
                { k: 'name',   label: '姓名 *',        ph: '您的姓名',     type: 'text' },
                { k: 'phone',  label: '澳洲手机 *',    ph: '04xx xxx xxx', type: 'tel'  },
                { k: 'wechat', label: '您的微信号（可选）', ph: '客服将优先通过微信与您确认详情', type: 'text' },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-xs text-gray-500 mb-1.5 block font-medium">{f.label}</label>
                  <input type={f.type} value={form[f.k]}
                    onChange={e => set(f.k, e.target.value)}
                    placeholder={f.ph}
                    className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200 ${errors[f.k] ? 'border-red-400' : 'border-gray-200'}`} />
                  {errors[f.k] && <p className="text-red-500 text-xs mt-1">此项为必填</p>}
                </div>
              ))}
            </div>

            {/* 3. Addresses */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3"
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <h3 className="font-bold text-gray-800 text-sm">搬运地址</h3>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block font-medium">搬出地址 *</label>
                <AddressAutocomplete
                  value={form.fromAddress}
                  onChange={v => set('fromAddress', v)}
                  onSelect={addr => handleAddressSelect('fromAddress', addr)}
                  placeholder="Unit/No. Street, Suburb NSW"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  error={errors.fromAddress}
                />
                {errors.fromAddress && <p className="text-red-500 text-xs mt-1">请填写搬出地址</p>}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block font-medium">搬入地址 *</label>
                <AddressAutocomplete
                  value={form.toAddress}
                  onChange={v => set('toAddress', v)}
                  onSelect={addr => handleAddressSelect('toAddress', addr)}
                  placeholder="Unit/No. Street, Suburb NSW"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  error={errors.toAddress}
                />
                {errors.toAddress && <p className="text-red-500 text-xs mt-1">请填写搬入地址</p>}
              </div>
              {form.distanceKm !== null && config && (
                <DistanceSurchargeCard km={form.distanceKm} vehicleKey={config.key} />
              )}
            </div>

            {/* 4+5+6. Extras collapsible: Stairs + Heavy Items + Materials */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <button type="button" onClick={() => setExtrasOpen(o => !o)}
                className="w-full px-4 py-4 flex items-center justify-between text-left">
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-gray-900 text-base">附加费用（可选）</p>
                  <p className="text-base font-extrabold mt-1.5" style={{ color: MID }}>
                    {extrasOpen ? '楼梯 · 重物大件 · 打包物资' : extrasSummary}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {(form.stairs !== 'none' || boxesNeeded > 0 || wrapNeeded > 0) && (
                    <span className="w-2 h-2 rounded-full" style={{ background: MID }} />
                  )}
                  <ChevronRight size={18} className={`text-gray-400 transition-transform duration-200 ${extrasOpen ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {extrasOpen && (
                <div className="border-t space-y-5 px-4 py-4" style={{ borderColor: BORDER }}>

                  {/* Stairs / Elevator */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">楼梯 / 电梯情况</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'elevator', label: '有电梯',  sub: '乘梯搬运', fee: '$0' },
                        { value: 'stairs',   label: '有楼梯',  sub: '爬楼搬运', fee: '$10/人/层' },
                      ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => set('stairs', opt.value)}
                          className="p-3 rounded-xl border-2 text-center transition-all"
                          style={form.stairs === opt.value
                            ? { borderColor: MID, background: BG }
                            : { borderColor: '#e5e7eb', background: 'white' }
                          }>
                          <p className="font-semibold text-xs" style={{ color: form.stairs === opt.value ? MID : '#374151' }}>
                            {opt.label}
                          </p>
                          <p className="text-xs mt-0.5 font-bold"
                            style={{ color: form.stairs === opt.value ? MID : '#9ca3af' }}>
                            {opt.fee}
                          </p>
                        </button>
                      ))}
                    </div>

                    {form.stairs === 'stairs' && (
                      <div className="mt-3 rounded-xl px-4 py-3 flex items-center justify-between"
                        style={{ background: BG, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <div>
                          <p className="text-sm font-medium text-gray-700">楼层数</p>
                          <p className="text-xs text-gray-400">每人/每层 $10</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button type="button"
                            onClick={() => setForm(f => ({ ...f, stairsFloors: Math.max(1, f.stairsFloors - 1) }))}
                            className="w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold flex items-center justify-center">−</button>
                          <span className="w-12 text-center font-bold text-gray-900">{form.stairsFloors} 层</span>
                          <button type="button"
                            onClick={() => setForm(f => ({ ...f, stairsFloors: Math.min(10, f.stairsFloors + 1) }))}
                            className="w-9 h-9 rounded-xl text-white font-bold flex items-center justify-center"
                            style={{ background: MID }}>+</button>
                        </div>
                        <p className="text-base font-black" style={{ color: MID }}>
                          ${form.stairsFloors * 10 * (config?.people ?? 1)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Special items notice */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">产生附加费的物品说明（可选）</p>
                    <div className="rounded-xl p-4" style={{ background: '#FFFBF0', border: '1px solid #FDE68A' }}>

                      {/* Section 1: what triggers extra fees */}
                      <p className="text-sm font-bold text-amber-800 mb-2.5 leading-relaxed">
                        以下情况可能产生附加费用，具体以客服确认或现场评估为准：
                      </p>
                      <div className="space-y-2 mb-4">
                        {[
                          '单件约 100kg 以上重物：钢琴、双门冰箱等',
                          '大型易碎物品：大理石、大型玻璃制品',
                          '超尺寸家具 / 家电：大实木柜子、65 寸以上电视等',
                          '特殊搬运环境（远距离上坡、掉重等）',
                        ].map(item => (
                          <p key={item} className="text-sm text-amber-700">· {item}</p>
                        ))}
                      </div>

                      {/* Section 2: clear call-to-action sentence */}
                      <div className="rounded-lg px-3.5 py-3 mb-4 flex items-start gap-2"
                        style={{ background: 'white', borderLeft: `4px solid ${MID}`, boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                        <span className="text-base flex-shrink-0 leading-tight">💡</span>
                        <p className="text-base font-bold leading-relaxed" style={{ color: MID }}>
                          如不确定是否会产生额外费用，可添加客服微信发送照片确认，或预约现场评估。
                        </p>
                      </div>

                      {/* Section 3: prominent QR + WeChat ID */}
                      <div className="rounded-xl bg-white p-4 flex items-center gap-4"
                        style={{ border: '1px solid #FDE68A' }}>
                        <img src="/wechat-qr.jpg" alt="微信二维码"
                          className="w-32 h-32 rounded-lg object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 mb-1">扫码或搜索微信号</p>
                          <p className="font-extrabold text-xl text-gray-900 mb-1 tracking-wide break-all">
                            qianxibanjia888
                          </p>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            发送照片<br />1 分钟确认报价
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Materials */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">打包物资</p>
                    <p className="text-xs text-gray-400 mb-3">搬家当天提供，客服确认后安排</p>
                    {[
                      { label: '纸箱',       sub: '$5/个', val: boxesNeeded,    set: setBoxesNeeded    },
                      { label: '胶带 / 打包膜', sub: '$3/卷', val: wrapNeeded,  set: setWrapNeeded     },
                      { label: '床垫套',     sub: '$10/个', val: mattressCovers, set: setMattressCovers },
                      { label: '打包物品',   sub: '$5/件', val: packingItems,   set: setPackingItems   },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between mb-3 last:mb-0">
                        <div>
                          <p className="text-sm font-medium text-gray-700">{item.label}</p>
                          <p className="text-xs text-gray-400">{item.sub}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => item.set(v => Math.max(0, v - 1))}
                            className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold flex items-center justify-center">−</button>
                          <span className="w-8 text-center font-bold text-gray-900 text-lg">{item.val}</span>
                          <button type="button" onClick={() => item.set(v => v + 1)}
                            className="w-9 h-9 rounded-xl text-white font-bold flex items-center justify-center"
                            style={{ background: MID }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 7. Items description */}
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <h3 className="font-bold text-gray-800 mb-1 text-sm">搬运物品说明和备注</h3>
              <p className="text-xs text-gray-400 mb-2">
                如：床 1 张、沙发 1 套、冰箱 1 台、纸箱约 10 箱等
              </p>
              <textarea value={form.items}
                onChange={e => set('items', e.target.value)}
                rows={3}
                placeholder="请尽量描述清楚，方便客服确认车型是否匹配"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200 resize-none" />
            </div>

            {/* 8. Deposit */}
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <h3 className="font-bold text-gray-800 mb-1 text-sm">定金说明 <span className="text-red-500">*</span></h3>
              <p className="text-xs text-gray-500 mb-3">
                请先转账定金，上传截图后方可提交预约。截图确认后档期锁定。
              </p>

              {/* Fixed deposit amount banner */}
              <div className="rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between"
                style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <div>
                  <p className="text-xs font-semibold text-orange-700">定金（每单）</p>
                  <p className="text-xs text-orange-400 mt-0.5">提交后档期锁定</p>
                </div>
                <p className="font-extrabold text-lg text-orange-700">$30 <span className="text-xs font-semibold">AUD</span></p>
              </div>

              <div className="rounded-xl p-3 mb-3 text-xs"
                style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <p className="font-semibold text-orange-800 mb-2">银行转账（澳洲账户 · $30 AUD）</p>
                <div className="space-y-1 text-orange-700">
                  <div className="flex justify-between">
                    <span className="text-orange-500">银行</span>
                    <span className="font-medium">Commonwealth Bank (CBA)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-500">户名</span>
                    <span className="font-medium">movewithease</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-500">BSB</span>
                    <span className="font-medium">062-161</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-500">账号</span>
                    <span className="font-medium">10950608</span>
                  </div>
                </div>
                <p className="text-orange-500 mt-2">转账后请在下方上传付款成功截图，为您锁定档期</p>
              </div>

              {/* Alipay collapsible */}
              <div className="rounded-xl mb-3 overflow-hidden"
                style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                <button type="button" onClick={() => setAlipayOpen(o => !o)}
                  className="w-full px-3 py-2.5 flex items-center justify-between text-left">
                  <div>
                    <p className="font-semibold text-xs" style={{ color: '#1E40AF' }}>或使用支付宝（¥150 RMB）</p>
                    <p className="text-xs mt-0.5" style={{ color: '#3B82F6' }}>不方便银行转账？点开扫码支付</p>
                  </div>
                  <ChevronRight size={16}
                    className={`flex-shrink-0 transition-transform duration-200 ${alipayOpen ? 'rotate-90' : ''}`}
                    style={{ color: '#3B82F6' }} />
                </button>

                {alipayOpen && (
                  <div className="px-3 pb-3 pt-1 text-xs">
                    <div className="flex items-start gap-3">
                      <img src="/alipay-qr.jpg" alt="支付宝二维码"
                        className="w-28 rounded-lg flex-shrink-0"
                        style={{ border: '1px solid #BFDBFE' }} />
                      <div className="flex-1 space-y-1" style={{ color: '#1E3A8A' }}>
                        <div className="flex justify-between">
                          <span style={{ color: '#3B82F6' }}>收款人</span>
                          <span className="font-medium">晨曦</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: '#3B82F6' }}>金额</span>
                          <span className="font-medium">¥150 RMB</span>
                        </div>
                        <p className="mt-2" style={{ color: '#3B82F6' }}>打开支付宝扫一扫，转账后请在下方上传付款成功截图，为您锁定档期</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-2 font-medium">
                转账后请上传截图 <span className="text-red-500">（必填）</span>
              </p>
              {!depositFile ? (
                <>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm transition-colors"
                    style={errors.depositFile
                      ? { borderColor: '#f87171', color: '#ef4444', background: '#fff5f5' }
                      : { borderColor: '#d1d5db', color: '#9ca3af' }
                    }>
                    <Upload size={16} /> 上传定金截图
                  </button>
                  {errors.depositFile && (
                    <p className="text-red-500 text-xs mt-1">请上传定金转账截图后再提交</p>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: BG }}>
                  <div>
                    <p className="text-sm font-medium text-green-600">截图已上传</p>
                    <p className="text-xs text-gray-400">{depositFile.name}</p>
                  </div>
                  <button onClick={() => { setDepositFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="p-1 text-gray-400">
                    <X size={16} />
                  </button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*"
                className="hidden" onChange={handleFileUpload} />
            </div>

            {/* spacer for sticky bar */}
            <div className="h-4" />
          </div>

          {/* ── Sticky price + submit bar ── */}
          <div className="fixed bottom-0 left-0 right-0 z-30"
            style={{ background: 'white', borderTop: `1px solid ${BORDER}`, boxShadow: '0 -4px 24px rgba(0,0,0,0.08)' }}>
            <div className="max-w-lg mx-auto px-4 pt-3 pb-5">
              <div className="flex items-end justify-between mb-2.5">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">预计费用</p>
                  <p className="text-2xl font-black text-gray-900">
                    ${totalEstimate}
                    <span className="text-xs font-normal text-gray-400 ml-1">起</span>
                  </p>
                </div>
                <div className="text-right text-xs text-gray-400 leading-relaxed">
                  {config && (
                    <p className="text-gray-500">${config.rate}×{config.minHours}h + ${config.returnFee}返程费</p>
                  )}
                  <p>= 基础 ${baseEstimate}</p>
                  {vanDiscount > 0 && <p style={{ color: MID }}>- 优惠 ${vanDiscount}</p>}
                  {stairsFee > 0 && <p style={{ color: MID }}>+ 楼梯 ${stairsFee}</p>}
                  {remoteEstimate > 0 && <p style={{ color: MID }}>+ 远途 ${remoteEstimate}</p>}
                  {materialsEstimate > 0 && <p style={{ color: MID }}>+ 物资 ${materialsEstimate}</p>}
                </div>
              </div>
              {submitError && (
                <p className="text-center text-xs mb-2" style={{ color: MID }}>{submitError}</p>
              )}
              <button onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm"
                style={{ background: GRAD, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? '提交中…' : '提交预约申请'}
              </button>
              <p className="text-center text-xs text-gray-400 mt-2">
                提交后将验证手机号并自动建立订单档案，方便随时查询进度
              </p>
            </div>
          </div>
          </>
        )}
      </div>
      {showVerify && (
        <VerifyCodeModal
          phone={form.phone}
          onVerified={handleVerifySuccess}
          onClose={() => setShowVerify(false)}
        />
      )}
    </div>
  )
}

function DistanceSurchargeCard({ km, vehicleKey }) {
  const remote     = calcRemoteSurcharge(km, vehicleKey)
  const tier       = remote.tier
  const hasSurcharge = remote.total > 0
  const isSpecial  = tier?.type === 'special'
  const needsConfirm = tier?.needsConfirm

  const borderColor = hasSurcharge || isSpecial ? '#FED7AA' : '#BFDBFE'
  const headerBg    = hasSurcharge || isSpecial ? '#FFF7ED' : '#EFF6FF'
  const headerColor = hasSurcharge || isSpecial ? '#92400E' : '#1E40AF'

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${borderColor}` }}>

      {/* Surcharge tier badge */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: headerBg }}>
        <span className="text-sm font-semibold" style={{ color: headerColor }}>
          📍 服务范围
        </span>
        {!hasSurcharge && !isSpecial && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">无附加费</span>
        )}
        {(hasSurcharge || isSpecial) && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">
            远途附加 +${remote.total}
          </span>
        )}
      </div>

      {/* Standard range */}
      {!hasSurcharge && !isSpecial && (
        <div className="px-4 py-2.5 bg-blue-50">
          <p className="text-xs text-blue-500">悉尼市区及周边服务范围，无额外距离费用</p>
        </div>
      )}

      {/* Surcharge breakdown */}
      {hasSurcharge && (
        <div className="px-4 pt-3 pb-4 bg-white" style={{ borderLeft: '3px solid #F59E0B' }}>
          <p className="text-xs font-semibold text-amber-800 mb-2.5">额外费用说明</p>
          <div className="space-y-2 mb-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-amber-700">• 长距离搬运费</span>
              <span className="text-sm font-semibold text-amber-900">${remote.returnFee}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-amber-700">• 远区服务调度费</span>
              <span className="text-sm font-semibold text-amber-900">${remote.fuelFee}</span>
            </div>
          </div>
          <div className="flex justify-between items-center pt-2.5 border-t border-amber-200">
            <span className="text-sm font-bold text-amber-900">预计附加费共</span>
            <span className="text-base font-bold text-amber-900">${remote.total}</span>
          </div>
          <p className="text-xs text-amber-500 mt-2">
            {needsConfirm
              ? '⚠️ 超长途路线，最终报价以客服确认为准'
              : '以上为预估金额，将计入最终报价，客服确认后生效'}
          </p>
        </div>
      )}

      {/* Special long-haul */}
      {isSpecial && (
        <div className="px-4 py-3 bg-red-50">
          <p className="text-sm font-semibold text-red-700 mb-0.5">特殊长途路线</p>
          <p className="text-xs text-red-500">距离超过320km，请联系客服获取专属报价</p>
        </div>
      )}
    </div>
  )
}
