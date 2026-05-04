import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, CheckCircle, ChevronRight, Upload, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import dayjs from 'dayjs'
import AddressAutocomplete from '../../components/AddressAutocomplete'
import { getDistanceKm } from '../../utils/googleMaps'
import { calcRemoteSurcharge } from '../../utils/remoteFee'

const GRAD   = 'linear-gradient(135deg, #C94F6D, #E97873)'
const BG     = '#FFF3F0'
const MID    = '#C94F6D'
const BORDER = '#F3C9C3'

// First slot is always exact 08:00; subsequent slots are arrival windows
const TIME_SLOTS = {
  van:   ['08:00 准时到达', '10:30–12:30', '13:00–15:00', '15:30–17:30', '18:00–20:00'],
  small: ['08:00 准时到达', '11:30–13:30', '15:30–17:30'],
  large: ['08:00 准时到达', '15:00–17:00'],
}

const VEHICLES = [
  {
    id: 'van', name: '面包车', nameEn: 'Toyota Hiace',
    tagline: '小件搬运首选，灵活便捷',
    volume: '6.2', weight: null, dims: '2.55 × 1.54 × 1.32 m',
    img: '/images/van.jpg',
    imgScale: 1.05,
    imgBg: 'linear-gradient(160deg, #b8a2d4 0%, #cdb8e2 45%, #e8d8f4 100%)',
    scenarios: ['单身公寓搬出', '合租房间搬运', '学生搬家', '少量家具', '行李搬运', '小件配送'],
    advantages: ['价格最低', '灵活好停车', '地库友好', '市区高效'],
    loadRef: '约可装 30 箱纸箱 / 1 个床垫 / 少量小型家具',
    note: '物品较多（2 房以上）建议选小卡车',
    configs: [
      { key: '面包车', label: '司机 1 人', people: 1, rate: 60, minHours: 1 },
    ],
  },
  {
    id: 'small', name: '小卡车', nameEn: 'Isuzu 4.5T',
    tagline: '1–2 房搬家最受欢迎，性价比最高',
    volume: '20', weight: '4.5', dims: '4.4 × 2.25 × 2.2 m',
    img: '/images/small-truck.jpg',
    imgScale: 0.95,
    imgBg: 'linear-gradient(160deg, #7080b8 0%, #90a0cc 45%, #bcc8e8 100%)',
    tag: '最受欢迎',
    scenarios: ['1–2 房公寓整体搬家', '家具家电较多', '中型搬迁', '跨区搬家'],
    advantages: ['空间充足', '专业搬运团队', '高效完成', '可应对复杂楼层'],
    loadRef: '约可装 1–2 房间全部家具及物品',
    note: null,
    configs: [
      { key: '小卡车',   label: '2 人团队', people: 2, rate: 110, minHours: 2 },
      { key: '小卡三人', label: '3 人团队', people: 3, rate: 160, minHours: 2 },
    ],
  },
  {
    id: 'large', name: '大卡车', nameEn: 'Hino 8T',
    tagline: '3 房以上 / House，一次搬完',
    volume: '30', weight: '8', dims: '6.0 × 2.2 × 2.35 m',
    img: '/images/large-truck.jpg',
    imgScale: 0.88,
    imgBg: 'linear-gradient(160deg, #c87090 0%, #d898a8 45%, #f0c8d0 100%)',
    scenarios: ['3 房以上 / House', '整屋搬迁', '大型家具家电', '别墅搬家'],
    advantages: ['超大容积', '专业大件搬运', '一次装完', '效率最高'],
    loadRef: '约可装 3–5 房间全部物品',
    note: null,
    configs: [
      { key: '大卡车',   label: '2 人团队', people: 2, rate: 120, minHours: 2 },
      { key: '大卡三人', label: '3 人团队', people: 3, rate: 165, minHours: 2 },
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
  const { createOrder } = useApp()
  const fileInputRef = useRef(null)

  const [step, setStep]           = useState(0)
  const [vehicleId, setVehicleId] = useState(null)
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

  const baseEstimate    = config ? config.rate * config.minHours + config.rate : 0
  const remoteEstimate  = (form.distanceKm !== null && config)
    ? calcRemoteSurcharge(form.distanceKm, config.key).total : 0
  const materialsEstimate = boxesNeeded * 5 + wrapNeeded * 3 + mattressCovers * 10 + packingItems * 5
  const stairsFee     = form.stairs === 'stairs' ? form.stairsFloors * 10 * (config?.people ?? 1) : 0
  const totalEstimate = baseEstimate + remoteEstimate + materialsEstimate + stairsFee

  const extrasTags = [
    form.stairs === 'elevator' ? '有电梯' : form.stairs === 'stairs' ? `楼梯 ${form.stairsFloors} 层` : null,
    boxesNeeded > 0 ? `纸箱 ×${boxesNeeded}` : null,
    wrapNeeded  > 0 ? `打包膜 ×${wrapNeeded}` : null,
  ].filter(Boolean)
  const extrasSummary = extrasTags.length > 0 ? extrasTags.join(' · ') : '楼梯 · 特殊物品 · 打包物资'

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: false }))
  }

  async function handleAddressSelect(field, address) {
    set(field, address)
    const from = field === 'fromAddress' ? address : form.fromAddress
    const to   = field === 'toAddress'   ? address : form.toAddress
    if (from && to) {
      const km = await getDistanceKm(from, to)
      if (km !== null) setForm(f => ({ ...f, distanceKm: km }))
    }
  }

  function selectVehicle(id) {
    setVehicleId(id)
    setConfigIdx(0)
    setForm(f => ({ ...f, timeSlot: TIME_SLOTS[id][0] }))
    setStep(1)
  }

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
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

  function handleSubmit() {
    if (hasSubmittedRef.current || !validate()) return
    hasSubmittedRef.current = true
    const stairsLabel = STAIRS_OPTIONS.find(s => s.value === form.stairs)?.label ?? ''
    const order = createOrder({
      customerName: form.name,
      customerPhone: form.phone,
      wechat: form.wechat,
      fromAddress: form.fromAddress,
      toAddress: form.toAddress,
      date: form.date,
      startTime: form.timeSlot,
      vehicle: config.key,
      vehicleName: vehicle.name,
      vehicleConfig: config.label,
      items: form.items,
      stairs: stairsLabel,
      depositScreenshot: depositFile || null,
      depositStatus: depositFile ? '已上传截图' : '待付定金',
      notes: form.notes,
      distanceKm: form.distanceKm,
      stairsFloors: form.stairs === 'stairs' ? form.stairsFloors : 0,
      stairsFee,
      serviceType: '搬家',
      source: '官网自助预约',
      status: '待确认',
      quote: totalEstimate,
      quoteNote: [
        `$${config.rate}×${config.minHours}h + $${config.rate}(出行费) = $${baseEstimate}`,
        remoteEstimate > 0 ? `+ 远途 $${remoteEstimate}` : null,
        stairsFee      > 0 ? `+ 楼梯 $${stairsFee}`     : null,
        materialsEstimate > 0 ? `+ 物资 $${materialsEstimate}` : null,
        `= $${totalEstimate}起`,
      ].filter(Boolean).join(' '),
      requestedMaterials: (boxesNeeded > 0 || wrapNeeded > 0 || mattressCovers > 0 || packingItems > 0)
        ? { boxes: boxesNeeded, wrapItems: wrapNeeded, mattressCovers, packingItems }
        : null,
    })
    setOrderId(order.id)
    setSubmitted(true)
  }

  /* ── Success screen ── */
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: BG }}>
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-sm text-center"
          style={{ border: `1px solid ${BORDER}` }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: BG }}>
            <CheckCircle size={40} style={{ color: MID }} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">申请已提交</h2>
          <p className="text-gray-500 text-sm mb-1">
            订单号：<strong className="text-gray-800">{orderId}</strong>
          </p>
          <p className="text-gray-400 text-sm mb-6">已提交预约申请，客服确认后生效</p>

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
                ${config?.rate}×{config?.minHours}h + ${config?.rate}(出行费)<br/>
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

          <div className="rounded-2xl p-4 text-left mb-4" style={{ background: BG }}>
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
          onClick={() => step === 0 ? navigate(-1) : setStep(s => s - 1)}
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
            <div className="mb-1">
              <h2 className="text-lg font-bold text-gray-900">选择搬运车型</h2>
              <p className="text-gray-400 text-sm">根据物品量选合适的车辆</p>
            </div>
            {VEHICLES.map(v => (
              <div key={v.id} className="bg-white rounded-3xl shadow-sm overflow-hidden"
                style={{ border: `1px solid ${BORDER}` }}>
                <div className="relative overflow-hidden" style={{ height: '200px', background: v.imgBg }}>
                  <img src={v.img} alt={v.name}
                    style={{
                      position: 'absolute', bottom: 0, left: '50%',
                      transform: `translateX(-50%) scale(${v.imgScale})`,
                      transformOrigin: 'center bottom',
                      width: '100%', height: '100%',
                      objectFit: 'contain', objectPosition: 'center bottom',
                    }}
                  />
                  {v.tag && (
                    <div className="absolute top-3 left-3 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm"
                      style={{ background: MID }}>
                      ⭐ {v.tag}
                    </div>
                  )}
                  <div className="absolute bottom-3 right-3 rounded-2xl px-3 py-2 text-right shadow-md"
                    style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)' }}>
                    <p className="font-black text-gray-900 text-lg leading-none">
                      ${v.configs[0].rate}
                      <span className="text-xs text-gray-400 font-normal">/h起</span>
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">最少 {v.configs[0].minHours}h</p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-3">
                  <h3 className="text-lg font-bold text-gray-900">{v.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5 mb-3">{v.nameEn} · {v.tagline}</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {v.scenarios.slice(0, 3).map(s => (
                      <span key={s} className="bg-gray-100 text-gray-500 text-xs px-2.5 py-1 rounded-full">{s}</span>
                    ))}
                  </div>
                  <button onClick={() => selectVehicle(v.id)}
                    className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-1.5"
                    style={{ background: GRAD }}>
                    了解详情并预约 <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── STEP 1: Vehicle detail ── */}
        {step === 1 && vehicle && (
          <div className="space-y-4">
            {/* Photo banner */}
            <div className="rounded-3xl overflow-hidden relative" style={{ height: '200px', background: vehicle.imgBg }}>
              <img src={vehicle.img} alt={vehicle.name}
                style={{
                  position: 'absolute', bottom: 0, left: '50%',
                  transform: `translateX(-50%) scale(${vehicle.imgScale})`,
                  transformOrigin: 'center bottom',
                  width: '100%', height: '100%',
                  objectFit: 'contain', objectPosition: 'center bottom',
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-4"
                style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.45))' }}>
                <h2 className="text-white font-bold text-xl">{vehicle.name}</h2>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {vehicle.nameEn} · {vehicle.dims} · {vehicle.volume}m³
                </p>
              </div>
              <button onClick={() => setStep(0)}
                className="absolute top-3 right-3 text-white text-xs px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(0,0,0,0.3)' }}>
                更换车型
              </button>
            </div>

            {/* Scenarios */}
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
              <h3 className="font-bold text-gray-800 mb-3 text-sm">适合搬运场景</h3>
              <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                {vehicle.scenarios.map(s => (
                  <div key={s} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: MID }} />
                    {s}
                  </div>
                ))}
              </div>
              {vehicle.note && (
                <div className="mt-3 rounded-xl p-2.5 text-xs text-orange-700 bg-orange-50">
                  ⚠️ {vehicle.note}
                </div>
              )}
            </div>

            {/* Pricing / team config */}
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
              <h3 className="font-bold text-gray-800 mb-3 text-sm">收费方式</h3>
              {vehicle.configs.length > 1 ? (
                <>
                  <p className="text-xs text-gray-400 mb-2">选择团队配置</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {vehicle.configs.map((c, i) => (
                      <button key={c.key} onClick={() => setConfigIdx(i)}
                        className="p-3.5 rounded-2xl border-2 text-left transition-all"
                        style={configIdx === i
                          ? { borderColor: MID, background: BG }
                          : { borderColor: '#e5e7eb', background: 'white' }
                        }>
                        <p className="font-bold text-sm"
                          style={{ color: configIdx === i ? MID : '#374151' }}>
                          {c.label}
                        </p>
                        <p className="text-xl font-black mt-0.5"
                          style={{ color: configIdx === i ? MID : '#111827' }}>
                          ${c.rate}
                          <span className="text-xs font-normal text-gray-400">/h</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">最少 {c.minHours}h</p>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-xl p-3 mb-3" style={{ background: BG }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm" style={{ color: MID }}>
                        {vehicle.configs[0].label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        最少 {vehicle.configs[0].minHours}h
                      </p>
                    </div>
                    <p className="text-2xl font-black" style={{ color: MID }}>
                      ${vehicle.configs[0].rate}
                      <span className="text-xs font-normal text-gray-400">/h</span>
                    </p>
                  </div>
                </div>
              )}
              <div className="text-xs text-gray-400 space-y-1">
                <p>· 计费从到达客户家与客服见面时开始，到物品搬运完毕检查车辆结束</p>
                <p>· 返程费用一次性收费，会依据距离远近上调或下调费用，具体请以客服报价为准</p>
                <p>· 最终报价以客服确认为准</p>
              </div>
            </div>

            {/* Load reference */}
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
              <h3 className="font-bold text-gray-800 mb-2 text-sm">装载参考</h3>
              <p className="text-sm text-gray-600 mb-3">{vehicle.loadRef}</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl p-2.5 text-center" style={{ background: BG }}>
                  <p className="text-lg font-black" style={{ color: MID }}>
                    {vehicle.volume}<span className="text-xs">m³</span>
                  </p>
                  <p className="text-gray-400 text-xs">容积</p>
                </div>
                <div className="rounded-xl p-2.5 text-center" style={{ background: BG }}>
                  <p className="text-sm font-bold" style={{ color: MID }}>
                    {vehicle.weight ? `${vehicle.weight}T` : '—'}
                  </p>
                  <p className="text-gray-400 text-xs">载重</p>
                </div>
                <div className="rounded-xl p-2.5 text-center" style={{ background: BG }}>
                  <p className="text-xs font-semibold leading-tight" style={{ color: MID }}>
                    {vehicle.dims}
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">货厢</p>
                </div>
              </div>
            </div>

            {/* Advantages */}
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
              <h3 className="font-bold text-gray-800 mb-3 text-sm">车型优势</h3>
              <div className="grid grid-cols-2 gap-2">
                {vehicle.advantages.map(a => (
                  <div key={a} className="flex items-center gap-2 py-1.5 px-2.5 rounded-xl text-sm"
                    style={{ background: BG }}>
                    <span className="text-green-500 font-bold">✓</span>
                    <span className="text-gray-700">{a}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => setStep(2)}
              className="w-full py-4 rounded-2xl text-white font-bold text-sm shadow-sm"
              style={{ background: GRAD }}>
              立即预约此车型 →
            </button>
          </div>
        )}

        {/* ── STEP 2: Order form ── */}
        {step === 2 && vehicle && (
          <>
          <div className="space-y-4 pb-36">
            {/* Summary */}
            <div className="rounded-2xl px-4 py-3" style={{ background: BG, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm" style={{ color: MID }}>
                    {vehicle.name} · {config?.label}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    ${config?.rate}/h · 最少 {config?.minHours}h · 含出行费 · 客服确认后为准
                  </p>
                </div>
                <button onClick={() => setStep(1)} className="text-xs text-gray-400 underline">
                  修改
                </button>
              </div>
            </div>

            {/* 1. Date + Time */}
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
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
              <div className="space-y-2">
                {slots.map((slot, idx) => {
                  const isFixed = idx === 0
                  const selected = form.timeSlot === slot
                  return (
                    <button key={slot} onClick={() => set('timeSlot', slot)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors text-left flex items-center justify-between"
                      style={selected
                        ? { background: GRAD, color: 'white' }
                        : { background: '#f3f4f6', color: '#374151' }
                      }>
                      <span>{slot}</span>
                      {isFixed && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={selected
                            ? { background: 'rgba(255,255,255,0.25)', color: 'white' }
                            : { background: '#dcfce7', color: '#16a34a' }
                          }>
                          准时
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {errors.timeSlot && <p className="text-red-500 text-xs mt-1">请选择到达时段</p>}
            </div>

            {/* 2. Contact */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3"
              style={{ border: `1px solid ${BORDER}` }}>
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
              style={{ border: `1px solid ${BORDER}` }}>
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
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
              <button type="button" onClick={() => setExtrasOpen(o => !o)}
                className="w-full px-4 py-4 flex items-center justify-between text-left">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm">附加需求（可选）</p>
                  <p className="text-xs text-gray-400 mt-0.5">
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
                        style={{ background: BG, border: `1px solid ${BORDER}` }}>
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
                    <p className="text-xs font-semibold text-gray-600 mb-2">特殊物品说明（可选）</p>
                    <div className="rounded-xl p-3.5" style={{ background: '#FFFBF0', border: '1px solid #FDE68A' }}>
                      <p className="text-xs text-amber-800 mb-2 leading-relaxed">
                        以下情况可能产生附加费用，具体以客服确认或现场评估为准：
                      </p>
                      <div className="space-y-1.5 mb-2.5">
                        {[
                          '单件约 100kg 以上重物',
                          '大型易碎物品',
                          '超尺寸家具 / 家电',
                          '特殊搬运环境（远距离上坡、掉重等）',
                        ].map(item => (
                          <p key={item} className="text-xs text-amber-700">· {item}</p>
                        ))}
                      </div>
                      <p className="text-xs text-amber-500">建议提交后加微信联系客服，发图片确认或现场评估。</p>
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
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
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
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
              <h3 className="font-bold text-gray-800 mb-1 text-sm">定金说明 <span className="text-red-500">*</span></h3>
              <p className="text-xs text-gray-500 mb-3">
                请先转账定金，上传截图后方可提交预约。截图确认后档期锁定。
              </p>
              <div className="rounded-xl p-3 mb-3 text-xs"
                style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <p className="font-semibold text-orange-800 mb-2">转账收款账户</p>
                <div className="space-y-1 text-orange-700">
                  <div className="flex justify-between">
                    <span className="text-orange-500">银行</span>
                    <span className="font-medium">Commonwealth Bank (CBA)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-500">户名</span>
                    <span className="font-medium">Move With Ease</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-500">BSB</span>
                    <span className="font-medium">062-000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-500">账号</span>
                    <span className="font-medium">1234 5678</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-500">PayID</span>
                    <span className="font-medium">0426 033 899</span>
                  </div>
                </div>
                <p className="text-orange-500 mt-2">转账备注请填写您的姓名及订单号</p>
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
                  <button onClick={() => setDepositFile(null)} className="p-1 text-gray-400">
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
                    <p className="text-gray-500">${config.rate}×{config.minHours}h + ${config.rate}出行</p>
                  )}
                  <p>= 基础 ${baseEstimate}</p>
                  {stairsFee > 0 && <p style={{ color: MID }}>+ 楼梯 ${stairsFee}</p>}
                  {remoteEstimate > 0 && <p style={{ color: MID }}>+ 远途 ${remoteEstimate}</p>}
                  {materialsEstimate > 0 && <p style={{ color: MID }}>+ 物资 ${materialsEstimate}</p>}
                </div>
              </div>
              <button onClick={handleSubmit}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm"
                style={{ background: GRAD }}>
                提交预约申请
              </button>
              <p className="text-center text-xs text-gray-400 mt-2">
                客服确认后支付定金锁定档期，方为正式预约
              </p>
            </div>
          </div>
          </>
        )}
      </div>
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

      {/* Distance row */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: headerBg }}>
        <span className="text-sm font-semibold" style={{ color: headerColor }}>
          📍 两地距离约 {km} km
        </span>
        {!hasSurcharge && !isSpecial && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">无附加费</span>
        )}
        {(hasSurcharge || isSpecial) && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">
            {tier?.label}
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
        <div className="px-4 pt-3 pb-4 bg-amber-50">
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
