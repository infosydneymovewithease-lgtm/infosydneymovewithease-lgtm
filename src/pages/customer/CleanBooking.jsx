import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, CheckCircle } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import dayjs from 'dayjs'

const CLEAN_TYPES = [
  { key: 'vacate',   label: '交房清洁', desc: '退租/交房，达到房东验收标准', icon: '🏠', popular: true },
  { key: 'move_in',  label: '入住清洁', desc: '新房入住前深度清洁',           icon: '✨' },
  { key: 'regular',  label: '日常清洁', desc: '定期家政清洁服务',             icon: '🧹' },
  { key: 'carpet',   label: '地毯清洁', desc: '专业蒸汽地毯深度清洗',         icon: '🪣' },
]

const ROOM_TYPES = [
  { key: 'studio', label: 'Studio' },
  { key: '1b',     label: '1 Bedroom' },
  { key: '2b',     label: '2 Bedrooms' },
  { key: '3b',     label: '3 Bedrooms' },
  { key: '4b+',    label: '4+ Bedrooms' },
]

const BLUE_GRAD   = 'linear-gradient(135deg, #C94F6D, #E97873)'
const BLUE_BG     = '#FFF3F0'
const BLUE_MID    = '#C94F6D'
const BLUE_BORDER = '#F3C9C3'
const BLUE_DARK   = '#A03050'

export default function CleanBooking() {
  const navigate = useNavigate()
  const { createOrder } = useApp()
  const [cleanType,    setCleanType]    = useState('vacate')
  const [roomType,     setRoomType]     = useState('2b')
  const [bathroomCount, setBathroomCount] = useState(1)
  const [extras, setExtras]             = useState([])
  const [form, setForm] = useState({
    name: '', phone: '', wechat: '', address: '',
    date: dayjs().add(2, 'day').format('YYYY-MM-DD'),
    time: '09:00', notes: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [orderId, setOrderId]     = useState(null)

  const extraOptions = ['炉灶深度清洁', '冰箱内清洁', '洗碗机清洁', '窗户清洁', '墙面污渍处理', '车库清洁']

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function toggleExtra(e) { setExtras(ex => ex.includes(e) ? ex.filter(x => x !== e) : [...ex, e]) }

  function handleSubmit() {
    if (!form.name || !form.phone || !form.address) return
    const ct = CLEAN_TYPES.find(c => c.key === cleanType)
    const rt = ROOM_TYPES.find(r => r.key === roomType)
    const order = createOrder({
      customerName: form.name, customerPhone: form.phone, wechat: form.wechat,
      toAddress: form.address, fromAddress: form.address,
      date: form.date, startTime: form.time,
      serviceType: '清洁',
      cleanType: cleanType,
      cleanTypeLabel: ct?.label,
      roomType: roomType,
      roomTypeLabel: rt?.label,
      bathroomCount: bathroomCount,
      cleanExtras: extras,
      notes: form.notes,
      source: '官网自助预约', status: '待确认',
    })
    setOrderId(order.id)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: BLUE_BG }}>
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-sm text-center" style={{ border: `1px solid ${BLUE_BORDER}` }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#FFF3F0' }}>
            <CheckCircle size={40} style={{ color: BLUE_MID }} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">预约成功！</h2>
          <p className="text-gray-500 text-sm mb-6">订单号 {orderId}，我们将1小时内联系您报价确认</p>
          <a href="tel:0450461917"
            className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-2xl mb-3 block text-center"
            style={{ background: BLUE_GRAD }}>
            <Phone size={16} /> 联系客服
          </a>
          <button onClick={() => navigate('/')} className="w-full py-3 rounded-2xl text-gray-500 text-sm bg-gray-100">返回首页</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: BLUE_BG }}>
      <div className="bg-white sticky top-0 z-10" style={{ borderBottom: `1px solid ${BLUE_BORDER}` }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-500"><ArrowLeft size={20} /></button>
          <span className="font-bold text-gray-900 flex-1">清洁服务预约</span>
          <a href="tel:0450461917" className="flex items-center gap-1.5 text-sm font-medium" style={{ color: BLUE_MID }}>
            <Phone size={15} /> 咨询
          </a>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Hero */}
        <div className="rounded-3xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE_MID})` }}>
          <p className="text-2xl mb-1">✨</p>
          <h2 className="text-xl font-bold mb-1">专业清洁服务</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>交房验房 · 深度清洁 · 100% 满意保障</p>
        </div>

        {/* Clean type */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2" style={{ border: `1px solid ${BLUE_BORDER}` }}>
          <h3 className="font-bold text-gray-800 mb-3">清洁类型</h3>
          {CLEAN_TYPES.map(c => (
            <button key={c.key} onClick={() => setCleanType(c.key)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all"
              style={cleanType === c.key
                ? { borderColor: '#F3C9C3', background: BLUE_BG }
                : { borderColor: '#e5e7eb' }}>
              <span className="text-2xl flex-shrink-0">{c.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm" style={{ color: cleanType === c.key ? BLUE_MID : '#1f2937' }}>{c.label}</p>
                  {c.popular && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: '#FFF3F0', color: BLUE_MID }}>常见</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{c.desc}</p>
              </div>
              <div className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                style={cleanType === c.key
                  ? { borderColor: BLUE_MID, background: BLUE_MID }
                  : { borderColor: '#d1d5db' }}>
                {cleanType === c.key && <span className="text-white text-xs">✓</span>}
              </div>
            </button>
          ))}
        </div>

        {/* Room type */}
        <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BLUE_BORDER}` }}>
          <h3 className="font-bold text-gray-800 mb-3">房型</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {ROOM_TYPES.map(r => (
              <button key={r.key} onClick={() => setRoomType(r.key)}
                className="px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all"
                style={roomType === r.key
                  ? { borderColor: '#F3C9C3', background: BLUE_BG, color: BLUE_MID }
                  : { borderColor: '#e5e7eb', color: '#4b5563' }}>
                {r.label}
              </button>
            ))}
          </div>
          {['2b', '3b'].includes(roomType) && (
            <>
              <h3 className="font-bold text-gray-800 mb-3 text-sm">浴室数量</h3>
              <div className="flex gap-2">
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setBathroomCount(n)}
                    className="px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all"
                    style={bathroomCount === n
                      ? { borderColor: '#F3C9C3', background: BLUE_BG, color: BLUE_MID }
                      : { borderColor: '#e5e7eb', color: '#4b5563' }}>
                    {n === 3 ? '3+' : n} {n === 1 ? 'Bathroom' : 'Bathrooms'}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Extras */}
        <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BLUE_BORDER}` }}>
          <h3 className="font-bold text-gray-800 mb-3">附加项目（可选）</h3>
          <div className="flex flex-wrap gap-2">
            {extraOptions.map(e => (
              <button key={e} onClick={() => toggleExtra(e)}
                className="px-3 py-2 rounded-xl border-2 text-xs font-medium transition-all"
                style={extras.includes(e)
                  ? { borderColor: '#F3C9C3', background: BLUE_BG, color: BLUE_MID }
                  : { borderColor: '#e5e7eb', color: '#4b5563' }}>
                {extras.includes(e) ? '✓ ' : ''}{e}
              </button>
            ))}
          </div>
        </div>

        {/* Date & address */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3" style={{ border: `1px solid ${BLUE_BORDER}` }}>
          <h3 className="font-bold text-gray-800">时间与地址</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">服务日期</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              min={dayjs().add(1, 'day').format('YYYY-MM-DD')}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">开始时间</label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {['08:00','09:00','10:00','11:00','12:00','13:00'].map(t => (
                <button key={t} type="button" onClick={() => set('time', t)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                    form.time === t ? 'text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                  style={form.time === t ? { background: BLUE_GRAD } : {}}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">清洁地址 *</label>
            <input value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="Unit/No. Street, Suburb NSW"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200" />
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3" style={{ border: `1px solid ${BLUE_BORDER}` }}>
          <h3 className="font-bold text-gray-800">联系方式</h3>
          {[
            { label: '姓名 *',      key: 'name',   placeholder: '您的姓名',     type: 'text' },
            { label: '手机 *',      key: 'phone',  placeholder: '04xx xxx xxx', type: 'tel'  },
            { label: '微信（可选）', key: 'wechat', placeholder: '微信号',       type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs text-gray-500 mb-1.5">{f.label}</label>
              <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200" />
            </div>
          ))}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">备注</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              placeholder="如：需要带地毯清洗机、有宠物毛发、门禁号码..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200 resize-none" />
          </div>
        </div>

        <button onClick={handleSubmit} disabled={!form.name || !form.phone || !form.address}
          className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-md disabled:opacity-50"
          style={{ background: BLUE_GRAD }}>
          提交预约申请 ✓
        </button>
        <div className="h-4" />
      </div>
    </div>
  )
}
