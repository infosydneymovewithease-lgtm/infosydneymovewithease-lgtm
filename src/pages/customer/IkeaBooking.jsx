import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, CheckCircle, Upload, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import dayjs from 'dayjs'
import AddressAutocomplete from '../../components/AddressAutocomplete'
import { getRemoteDistanceKm } from '../../utils/googleMaps'
import { calcRemoteSurcharge } from '../../utils/remoteFee'

const SERVICES = [
  { key: 'pickup',   label: 'IKEA 代购提货', desc: '我们前往 IKEA 代为提取您的订单', icon: '🛒' },
  { key: 'assemble', label: '家具安装',       desc: '上门专业安装，包含所有 IKEA 家具', icon: '🔧' },
  { key: 'both',     label: '提货 + 安装',   desc: '一站式服务，提货后直接上门安装',   icon: '✅' },
]

const VEHICLES = [
  { id: 'van',   name: '面包车', rate: 60,  desc: '小件/少量家具首选' },
  { id: 'small', name: '小卡车', rate: 110, desc: '大件/多件家具适用' },
]

const TIME_SLOTS = {
  van:   ['08:00 准时到达', '10:30–12:30', '13:00–15:00', '15:30–17:30', '18:00–20:00'],
  small: ['08:00 准时到达', '11:30–13:30', '15:30–17:30'],
}

const IKEA_STORES = ['IKEA Rhodes', 'IKEA Tempe', '其他']

const IKEA_STORE_ADDRESSES = {
  'IKEA Rhodes': 'IKEA Rhodes, 1 Homebush Bay Dr, Rhodes NSW 2138',
  'IKEA Tempe':  'IKEA Tempe, 634 Princes Hwy, Tempe NSW 2044',
}

const GRAD   = 'linear-gradient(135deg, #C03448, #D03C52)'
const BG     = '#F7F7F7'
const MID    = '#C03448'
const BORDER = '#EFEFEF'
const DARK   = '#7a1e28'

export default function IkeaBooking() {
  const navigate = useNavigate()
  const { createOrder } = useApp()
  const qrInputRef      = useRef(null)
  const depositInputRef = useRef(null)

  const [selected,      setSelected]      = useState('both')
  const [vehicleId,     setVehicleId]     = useState('van')
  const [qrFile,        setQrFile]        = useState(null)
  const [depositFile,   setDepositFile]   = useState(null)
  const [needsRubbish,  setNeedsRubbish]  = useState(false)
  const [submitted,     setSubmitted]     = useState(false)
  const [orderId,       setOrderId]       = useState(null)
  const [errors,        setErrors]        = useState({})

  const [form, setForm] = useState({
    name: '', phone: '', wechat: '',
    fromAddress: 'IKEA Rhodes',
    toAddress: '',
    distanceKm: null,
    date:     dayjs().add(2, 'day').format('YYYY-MM-DD'),
    timeSlot: TIME_SLOTS.van[0],
    orderNo: '',
    items: '',
    notes: '',
  })

  const vehicle = VEHICLES.find(v => v.id === vehicleId)
  const slots   = TIME_SLOTS[vehicleId]

  const remoteEstimate = (form.distanceKm !== null && vehicle)
    ? calcRemoteSurcharge(form.distanceKm, vehicle.name).total : 0
  const baseEstimate = vehicle ? vehicle.rate * 2 : 0
  const totalEstimate = baseEstimate + remoteEstimate

  async function handleAddressSelect(address) {
    set('toAddress', address)
    const from = IKEA_STORE_ADDRESSES[form.fromAddress] || form.fromAddress
    if (from && address) {
      const km = await getRemoteDistanceKm(from, address)
      if (km !== null) setForm(f => ({ ...f, distanceKm: km }))
    }
  }

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: false }))
  }

  function selectVehicle(id) {
    setVehicleId(id)
    setForm(f => ({ ...f, timeSlot: TIME_SLOTS[id][0] }))
  }

  function handleQRUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setQrFile({ name: file.name, data: ev.target.result })
    reader.readAsDataURL(file)
  }

  function handleDepositUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setDepositFile({ name: file.name, data: ev.target.result })
      setErrors(prev => ({ ...prev, depositFile: false }))
    }
    reader.readAsDataURL(file)
  }

  function validate() {
    const e = {}
    if (!form.name.trim())      e.name        = true
    if (!form.phone.trim())     e.phone       = true
    if (!form.toAddress.trim()) e.toAddress   = true
    if (!form.date)             e.date        = true
    if (!form.timeSlot)         e.timeSlot    = true
    if (!depositFile)           e.depositFile = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const svc = SERVICES.find(s => s.key === selected)
    const quoteParts = [`$${vehicle.rate}×1h + $${vehicle.rate}出车费 = $${baseEstimate}`]
    if (remoteEstimate > 0) quoteParts.push(`+ 远途 $${remoteEstimate}`)
    if (needsRubbish) quoteParts.push('+ 垃圾处理（待定）')
    quoteParts.push(`= $${totalEstimate}起`)

    const order = createOrder({
      customerName:  form.name,
      customerPhone: form.phone,
      wechat:        form.wechat,
      fromAddress:   form.fromAddress,
      toAddress:     form.toAddress,
      distanceKm:    form.distanceKm,
      date:          form.date,
      startTime:     form.timeSlot,
      vehicle:       vehicle.name,
      vehicleName:   vehicle.name,
      serviceType:   'IKEA',
      ikeaService:   svc?.label,
      ikeaOrderNo:   form.orderNo,
      ikeaQRCode:       qrFile || null,
      items:            form.items,
      notes:            form.notes,
      source:           '官网自助预约',
      status:           '待确认',
      quote:            totalEstimate,
      quoteNote:        quoteParts.join(' '),
      depositScreenshot:    depositFile || null,
      depositStatus:        depositFile ? '已上传截图' : '待付定金',
      needsRubbishDisposal: needsRubbish,
    })
    setOrderId(order.id)
    setSubmitted(true)
  }

  /* ── Success ── */
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
          <p className="text-gray-400 text-sm mb-4">客服将在 1 小时内与您确认</p>

          <div className="rounded-2xl p-4 text-left mb-4 bg-white"
            style={{ borderLeft: '3px solid #F59E0B', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <p className="font-bold text-sm mb-2.5" style={{ color: MID }}>📋 温馨提示</p>
            <div className="space-y-1.5 text-sm text-gray-600">
              {['请确认 IKEA 订单已可取货', '请提供完整订单截图 / 二维码', '请提前预留停车位', '公寓请提前预约电梯'].map(tip => (
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
            <Phone size={16} /> 联系客服
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

  return (
    <div className="min-h-screen" style={{ background: BG }}>

      {/* Header */}
      <div className="bg-white sticky top-0 z-10" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <span className="font-bold text-gray-900 flex-1">IKEA 提货安装</span>
          <a href="tel:0426033899" className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color: MID }}>
            <Phone size={15} /> 咨询
          </a>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Hero */}
        <div className="rounded-3xl p-5 text-white"
          style={{ background: `linear-gradient(135deg, ${DARK}, ${MID})` }}>
          <p className="text-2xl mb-1">🛋️</p>
          <h2 className="text-xl font-bold mb-1">IKEA 提货安装服务</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
            专业团队代购提货 · 上门精准安装
          </p>
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
            服务门店：IKEA Rhodes · IKEA Tempe
          </p>
        </div>

        {/* Service type */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2"
          style={{ border: `1px solid ${BORDER}` }}>
          <h3 className="font-bold text-gray-800 mb-3">选择服务类型</h3>
          {SERVICES.map(s => (
            <button key={s.key} onClick={() => setSelected(s.key)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all"
              style={selected === s.key
                ? { borderColor: BORDER, background: BG }
                : { borderColor: '#e5e7eb' }}>
              <span className="text-2xl flex-shrink-0">{s.icon}</span>
              <div className="flex-1">
                <p className="font-semibold text-sm"
                  style={{ color: selected === s.key ? MID : '#1f2937' }}>{s.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
              </div>
              <div className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                style={selected === s.key
                  ? { borderColor: MID, background: MID }
                  : { borderColor: '#d1d5db' }}>
                {selected === s.key && <span className="text-white text-xs">✓</span>}
              </div>
            </button>
          ))}
        </div>

        {/* IKEA order info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3"
          style={{ border: `1px solid ${BORDER}` }}>
          <h3 className="font-bold text-gray-800">IKEA 订单信息</h3>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Order 号码（订单号）</label>
            <input value={form.orderNo} onChange={e => set('orderNo', e.target.value)}
              placeholder="如：100-xxxxxxx"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200" />
          </div>

          {/* QR / barcode upload */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              取货二维码 / 条形码截图（可选）
            </label>
            {!qrFile ? (
              <button onClick={() => qrInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm text-gray-400"
                style={{ borderColor: '#d1d5db' }}>
                <Upload size={15} /> 上传截图
              </button>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: BG }}>
                <div>
                  <p className="text-sm font-medium text-green-600">截图已上传</p>
                  <p className="text-xs text-gray-400">{qrFile.name}</p>
                </div>
                <button onClick={() => setQrFile(null)} className="p-1 text-gray-400">
                  <X size={16} />
                </button>
              </div>
            )}
            <input ref={qrInputRef} type="file" accept="image/*"
              className="hidden" onChange={handleQRUpload} />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">物品清单（可选）</label>
            <textarea value={form.items} onChange={e => set('items', e.target.value)} rows={3}
              placeholder="如：BILLY书柜×2、PAX衣柜×1、KALLAX储物格..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200 resize-none" />
          </div>
        </div>

        {/* Vehicle + Time + Address */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4"
          style={{ border: `1px solid ${BORDER}` }}>
          <h3 className="font-bold text-gray-800">时间与地址</h3>

          {/* Vehicle */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block font-medium">选择车型</label>
            <div className="grid grid-cols-2 gap-2">
              {VEHICLES.map(v => (
                <button key={v.id} onClick={() => selectVehicle(v.id)}
                  className="p-3.5 rounded-2xl border-2 text-left transition-all"
                  style={vehicleId === v.id
                    ? { borderColor: MID, background: BG }
                    : { borderColor: '#e5e7eb', background: 'white' }}>
                  <p className="font-bold text-sm"
                    style={{ color: vehicleId === v.id ? MID : '#374151' }}>
                    {v.name}
                  </p>
                  <p className="text-xl font-black mt-0.5"
                    style={{ color: vehicleId === v.id ? MID : '#111827' }}>
                    ${v.rate}
                    <span className="text-xs font-normal text-gray-400">/h</span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: vehicleId === v.id ? MID : '#6b7280' }}>
                    + ${v.rate} 出车费
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{v.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">服务日期</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              min={dayjs().add(1, 'day').format('YYYY-MM-DD')}
              className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200 ${errors.date ? 'border-red-400' : 'border-gray-200'}`} />
          </div>

          {/* Time slots */}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">到达时段 *</p>
            <p className="text-xs text-gray-400 mb-2">
              首单可准时到达；后续时段受路况及上单影响，为预计窗口
            </p>
            <div className="space-y-2">
              {slots.map((slot, idx) => {
                const isFixed = idx === 0
                const active  = form.timeSlot === slot
                return (
                  <button key={slot} onClick={() => set('timeSlot', slot)}
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-left flex items-center justify-between"
                    style={active
                      ? { background: GRAD, color: 'white' }
                      : { background: '#f3f4f6', color: '#374151' }}>
                    <span>{slot}</span>
                    {isFixed && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={active
                          ? { background: 'rgba(255,255,255,0.25)', color: 'white' }
                          : { background: '#dcfce7', color: '#16a34a' }}>
                        准时
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {errors.timeSlot && <p className="text-red-500 text-xs mt-1">请选择到达时段</p>}
          </div>

          {/* From address */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">取货地址（IKEA 门店）</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {IKEA_STORES.map(store => (
                <button key={store} onClick={() => set('fromAddress', store)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
                  style={form.fromAddress === store
                    ? { borderColor: MID, background: BG, color: MID }
                    : { borderColor: '#e5e7eb', background: 'white', color: '#6b7280' }}>
                  {store}
                </button>
              ))}
            </div>
            <input value={form.fromAddress} onChange={e => set('fromAddress', e.target.value)}
              placeholder="IKEA Rhodes"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200" />
          </div>

          {/* To address */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">送达地址 *</label>
            <AddressAutocomplete
              value={form.toAddress}
              onChange={v => set('toAddress', v)}
              onSelect={handleAddressSelect}
              placeholder="Unit/No. Street, Suburb NSW"
              error={errors.toAddress}
            />
            {errors.toAddress && <p className="text-red-500 text-xs mt-1">请填写送达地址</p>}
            {remoteEstimate > 0 && (
              <p className="text-xs mt-1.5 font-medium" style={{ color: MID }}>
                📍 远途附加费 +${remoteEstimate}
              </p>
            )}
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3"
          style={{ border: `1px solid ${BORDER}` }}>
          <h3 className="font-bold text-gray-800">联系方式</h3>
          {[
            { label: '姓名 *',       key: 'name',   placeholder: '您的姓名',     type: 'text' },
            { label: '手机 *',       key: 'phone',  placeholder: '04xx xxx xxx', type: 'tel'  },
            { label: '微信（可选）',  key: 'wechat', placeholder: '微信号',       type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs text-gray-500 mb-1.5">{f.label}</label>
              <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200 ${errors[f.key] ? 'border-red-400' : 'border-gray-200'}`} />
              {errors[f.key] && <p className="text-red-500 text-xs mt-1">此项为必填</p>}
            </div>
          ))}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">备注（可选）</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              placeholder="安装注意事项、停车说明、门禁密码等"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200 resize-none" />
          </div>
        </div>

        {/* Rubbish disposal */}
        <div className="bg-white rounded-2xl p-4 shadow-sm"
          style={{ border: `1px solid ${BORDER}` }}>
          <h3 className="font-bold text-gray-800 mb-1">垃圾处理（可选）</h3>
          <p className="text-xs text-gray-400 mb-3">IKEA 包装纸板、泡沫等，我们可帮助处理</p>
          <div className="grid grid-cols-2 gap-2">
            {[{ val: true, label: '🗑️ 需要处理' }, { val: false, label: '不需要' }].map(opt => (
              <button key={String(opt.val)} onClick={() => setNeedsRubbish(opt.val)}
                className="py-3 rounded-xl text-sm font-semibold border-2 transition-all"
                style={needsRubbish === opt.val
                  ? { borderColor: MID, background: BG, color: MID }
                  : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                {opt.label}
              </button>
            ))}
          </div>
          {needsRubbish && (
            <p className="text-xs mt-2" style={{ color: MID }}>
              ⚠️ 垃圾处理另外收费，具体金额由客服与您确认
            </p>
          )}
        </div>

        {/* Deposit */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3"
          style={{ border: `1px solid ${errors.depositFile ? '#f87171' : BORDER}` }}>
          <h3 className="font-bold text-gray-800">定金支付</h3>
          <div className="rounded-xl p-3 text-xs"
            style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
            <p className="font-semibold text-orange-800 mb-1">转账收款账户</p>
            <div className="text-orange-700 space-y-0.5">
              <p>银行：Commonwealth Bank (CBA)</p>
              <p>户名：Move With Ease</p>
              <p>BSB：062-000 &nbsp;|&nbsp; 账号：1234 5678</p>
              <p>PayID：0426 033 899</p>
            </div>
            <p className="text-orange-500 mt-1.5">转账备注请填写姓名及订单号</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              上传转账截图 <span className="text-red-500">*（必填）</span>
            </label>
            {!depositFile ? (
              <button
                onClick={() => depositInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm"
                style={errors.depositFile
                  ? { borderColor: '#f87171', color: '#ef4444', background: '#fff5f5' }
                  : { borderColor: '#d1d5db', color: '#9ca3af' }}>
                <Upload size={15} />
                {errors.depositFile ? '请上传定金转账截图' : '上传截图'}
              </button>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div>
                  <p className="text-sm font-medium text-green-600">截图已上传 ✓</p>
                  <p className="text-xs text-gray-400">{depositFile.name}</p>
                </div>
                <button onClick={() => setDepositFile(null)} className="p-1 text-gray-400">
                  <X size={16} />
                </button>
              </div>
            )}
            <input ref={depositInputRef} type="file" accept="image/*"
              className="hidden" onChange={handleDepositUpload} />
          </div>
        </div>

        <button onClick={handleSubmit}
          className="w-full py-4 rounded-2xl text-white font-bold text-sm shadow-sm"
          style={{ background: GRAD }}>
          提交预约申请
        </button>
        <div className="h-4" />
      </div>
    </div>
  )
}
