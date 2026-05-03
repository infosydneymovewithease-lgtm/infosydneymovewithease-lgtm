import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, CheckCircle, Upload, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'

const GRAD   = 'linear-gradient(135deg, #C94F6D, #E97873)'
const BG     = '#FFF3F0'
const MID    = '#C94F6D'
const BORDER = '#F3C9C3'
const DARK   = '#A03050'

const ITEM_TYPES = [
  '沙发', '床架 / 床头板', '衣柜', '餐桌 / 餐椅', '书柜 / 展示柜',
  '电视柜', '梳妆台', '冰箱', '洗衣机', '电视', '电脑桌 / 办公桌', '其他家具',
]

const CONDITIONS = [
  { value: '全新',       desc: '未使用或仅展示' },
  { value: '九成新',     desc: '极少使用，几乎无痕' },
  { value: '八成新',     desc: '正常使用，轻微磨损' },
  { value: '七成新',     desc: '明显使用痕迹' },
  { value: '六成新以下', desc: '较多磨损或瑕疵' },
]

const ACCESS_TYPES = [
  { value: '平层 / 地面', label: '平层 / 地面' },
  { value: '有电梯',      label: '有电梯' },
  { value: '仅楼梯',      label: '仅楼梯' },
]

export default function SecondhandSubmit() {
  const navigate = useNavigate()
  const { createSecondhandLead } = useApp()
  const photoInputRef = useRef(null)

  const [photos,      setPhotos]      = useState([])
  const [isUrgent,    setIsUrgent]    = useState(false)
  const [submitted,   setSubmitted]   = useState(false)
  const [leadId,      setLeadId]      = useState(null)
  const [errors,      setErrors]      = useState({})

  const [form, setForm] = useState({
    customerName:  '',
    customerPhone: '',
    itemType:      '',
    brand:         '',
    condition:     '',
    purchaseYear:  '',
    originalPrice: '',
    expectedPrice: '',
    address:       '',
    accessType:    '有电梯',
    notes:         '',
  })

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: false }))
  }

  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files).slice(0, 4 - photos.length)
    if (!files.length) return
    const compressed = await Promise.all(files.map(compressImage))
    setPhotos(prev => [...prev, ...compressed])
    setErrors(err => ({ ...err, photos: false }))
    e.target.value = ''
  }

  function compressImage(file) {
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = e => {
        const img = new Image()
        img.onload = () => {
          const maxDim = 1200
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
          const canvas = document.createElement('canvas')
          canvas.width  = Math.round(img.width  * scale)
          canvas.height = Math.round(img.height * scale)
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.75))
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  function validate() {
    const e = {}
    if (!form.customerName.trim())  e.customerName  = true
    if (!form.customerPhone.trim()) e.customerPhone = true
    if (!form.itemType)             e.itemType      = true
    if (!form.condition)            e.condition     = true
    if (!form.address.trim())       e.address       = true
    if (photos.length === 0)        e.photos        = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const lead = createSecondhandLead({
      customerName:  form.customerName,
      customerPhone: form.customerPhone,
      itemType:      form.itemType,
      brand:         form.brand,
      condition:     form.condition,
      purchaseYear:  form.purchaseYear,
      originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
      expectedPrice: form.expectedPrice ? Number(form.expectedPrice) : null,
      isUrgent,
      address:       form.address,
      accessType:    form.accessType,
      notes:         form.notes,
      photos,
    })
    setLeadId(lead.id)
    setSubmitted(true)
  }

  /* ── Success ── */
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: BG }}>
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-sm text-center"
          style={{ border: `1px solid ${BORDER}` }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: BG }}>
            <CheckCircle size={40} style={{ color: MID }} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">提交成功</h2>
          <p className="text-gray-500 text-sm mb-1">编号：<strong className="text-gray-800">{leadId}</strong></p>
          <p className="text-gray-400 text-sm mb-5">我们会在 24 小时内评估并联系您</p>

          <div className="rounded-2xl p-4 text-left space-y-1.5 text-sm mb-5" style={{ background: BG }}>
            <p className="font-semibold mb-2" style={{ color: MID }}>📋 接下来的流程</p>
            {[
              '客服团队审核您的物品照片与信息',
              '24 小时内电话联系，告知评估结果',
              '确认后安排上门取件或寄售上架',
            ].map(s => (
              <div key={s} className="flex items-start gap-2 text-gray-600">
                <span className="text-green-500 font-bold text-xs flex-shrink-0 mt-0.5">✓</span>
                <span>{s}</span>
              </div>
            ))}
          </div>

          <a href="tel:0450461917"
            className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-2xl mb-3 block text-center"
            style={{ background: GRAD }}>
            <Phone size={16} /> 联系客服
          </a>
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
          <span className="font-bold text-gray-900 flex-1">旧家具回收 / 二手寄售</span>
          <a href="tel:0450461917" className="flex items-center gap-1.5 text-sm font-medium" style={{ color: MID }}>
            <Phone size={15} /> 咨询
          </a>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Hero */}
        <div className="rounded-3xl p-5 text-white"
          style={{ background: `linear-gradient(135deg, ${DARK}, ${MID})` }}>
          <p className="text-2xl mb-1">♻️</p>
          <h2 className="text-xl font-bold mb-1">旧家具回收 / 寄售</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
            搬家同步处理旧物 · 省心省力
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { t: '🏷️ 直接回收', s: '当场出价买断' },
              { t: '📋 委托寄售', s: '帮您挂牌出售' },
            ].map(c => (
              <div key={c.t} className="rounded-xl p-2.5 text-sm" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <p className="font-semibold">{c.t}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{c.s}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Photos */}
        <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${errors.photos ? '#f87171' : BORDER}` }}>
          <h3 className="font-bold text-gray-800 mb-1">物品照片 <span className="text-red-500">*</span></h3>
          <p className="text-xs text-gray-400 mb-3">请上传正面、侧面及瑕疵处照片（最多 4 张），清晰照片有助于快速评估</p>

          <div className="flex gap-2 flex-wrap">
            {photos.map((src, i) => (
              <div key={i} className="relative flex-shrink-0">
                <img src={src} alt="" className="w-20 h-20 rounded-xl object-cover" />
                <button onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow">
                  ×
                </button>
              </div>
            ))}
            {photos.length < 4 && (
              <button onClick={() => photoInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-sm transition-colors"
                style={errors.photos
                  ? { borderColor: '#f87171', color: '#ef4444', background: '#fff5f5' }
                  : { borderColor: '#d1d5db', color: '#9ca3af' }}>
                <Upload size={16} />
                <span className="text-xs">上传</span>
              </button>
            )}
          </div>
          {errors.photos && <p className="text-red-500 text-xs mt-2">请至少上传 1 张照片</p>}
          <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
        </div>

        {/* Item info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4" style={{ border: `1px solid ${BORDER}` }}>
          <h3 className="font-bold text-gray-800">物品信息</h3>

          {/* Type */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">物品类型 <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-1.5">
              {ITEM_TYPES.map(t => (
                <button key={t} onClick={() => { set('itemType', t) }}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
                  style={form.itemType === t
                    ? { borderColor: MID, background: BG, color: MID }
                    : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                  {t}
                </button>
              ))}
            </div>
            {errors.itemType && <p className="text-red-500 text-xs mt-1">请选择物品类型</p>}
          </div>

          {/* Brand + Year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">品牌（可选）</label>
              <input value={form.brand} onChange={e => set('brand', e.target.value)}
                placeholder="如：IKEA、宜家"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">购买年份（可选）</label>
              <input value={form.purchaseYear} onChange={e => set('purchaseYear', e.target.value)}
                placeholder="如：2021"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200" />
            </div>
          </div>

          {/* Condition */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">成色 <span className="text-red-500">*</span></label>
            <div className="space-y-2">
              {CONDITIONS.map(c => (
                <button key={c.value} onClick={() => set('condition', c.value)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-left transition-all"
                  style={form.condition === c.value
                    ? { borderColor: MID, background: BG }
                    : { borderColor: '#e5e7eb' }}>
                  <span className="font-semibold text-sm" style={{ color: form.condition === c.value ? MID : '#374151' }}>
                    {c.value}
                  </span>
                  <span className="text-xs text-gray-400">{c.desc}</span>
                </button>
              ))}
            </div>
            {errors.condition && <p className="text-red-500 text-xs mt-1">请选择成色</p>}
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3" style={{ border: `1px solid ${BORDER}` }}>
          <h3 className="font-bold text-gray-800">价格参考</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">原价（可选）</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={form.originalPrice} onChange={e => set('originalPrice', e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">期望价格（可选）</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={form.expectedPrice} onChange={e => set('expectedPrice', e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200" />
              </div>
            </div>
          </div>

          {/* Urgent */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-gray-800">是否急售</p>
              <p className="text-xs text-gray-400 mt-0.5">急售物品优先处理</p>
            </div>
            <button onClick={() => setIsUrgent(v => !v)}
              className="flex items-center gap-2 text-sm" style={{ color: isUrgent ? MID : '#9ca3af' }}>
              <div className="w-10 h-6 rounded-full relative transition-colors"
                style={{ background: isUrgent ? MID : '#d1d5db' }}>
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                  style={{ left: isUrgent ? '1.25rem' : '0.125rem' }} />
              </div>
            </button>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3" style={{ border: `1px solid ${BORDER}` }}>
          <h3 className="font-bold text-gray-800">取件地址</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">地址 <span className="text-red-500">*</span></label>
            <input value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="Unit/No. Street, Suburb NSW"
              className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200 ${errors.address ? 'border-red-400' : 'border-gray-200'}`} />
            {errors.address && <p className="text-red-500 text-xs mt-1">请填写地址</p>}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-2">楼层情况</label>
            <div className="grid grid-cols-3 gap-2">
              {ACCESS_TYPES.map(a => (
                <button key={a.value} onClick={() => set('accessType', a.value)}
                  className="py-2.5 rounded-xl text-sm font-medium border-2 transition-all"
                  style={form.accessType === a.value
                    ? { borderColor: MID, background: BG, color: MID }
                    : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3" style={{ border: `1px solid ${BORDER}` }}>
          <h3 className="font-bold text-gray-800">联系方式</h3>
          {[
            { label: '姓名 *', key: 'customerName',  ph: '您的姓名',     type: 'text' },
            { label: '手机 *', key: 'customerPhone', ph: '04xx xxx xxx', type: 'tel'  },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs text-gray-500 mb-1.5">{f.label}</label>
              <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                placeholder={f.ph}
                className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200 ${errors[f.key] ? 'border-red-400' : 'border-gray-200'}`} />
              {errors[f.key] && <p className="text-red-500 text-xs mt-1">此项为必填</p>}
            </div>
          ))}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">备注（可选）</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              placeholder="尺寸、颜色、特殊说明等"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200 resize-none" />
          </div>
        </div>

        <button onClick={handleSubmit}
          className="w-full py-4 rounded-2xl text-white font-bold text-sm shadow-sm"
          style={{ background: GRAD }}>
          提交评估申请
        </button>
        <div className="h-4" />
      </div>
    </div>
  )
}
