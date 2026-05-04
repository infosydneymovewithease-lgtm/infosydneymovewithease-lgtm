import { useNavigate } from 'react-router-dom'
import { Phone, ChevronRight } from 'lucide-react'

const BRAND   = '#8B2635'
const BRAND_L = '#C0392B'
const BORDER  = '#EAD5D1'
const BG      = '#FAFAFA'
const T1      = '#111827'
const T2      = '#374151'
const T3      = '#6B7280'
const WECHAT  = 'qianxibanjia888'

const VEHICLES = [
  { name: '面包车', desc: '适合小件物品',    price: '$60',  img: '/images/van.jpg'         },
  { name: '小卡车', desc: '适合1–2房搬家',  price: '$110', img: '/images/small-truck.jpg'  },
  { name: '大卡车', desc: '适合3房以上搬家', price: '$120', img: '/images/large-truck.jpg'  },
]

const TRUST = [
  { icon: '👥', value: '2000+', label: '搬家订单'  },
  { icon: '🛡️', value: '本地',   label: '华人团队'  },
  { icon: '🚚', value: '运输',   label: '保险保障'  },
  { icon: '📅', value: '7天',    label: '可预约'    },
]

const FEES = [
  { icon: '📦', title: '较重物品（约100kg以上）',  desc: '双开门冰箱、商用洗衣机、大型实木家具等' },
  { icon: '🎹', title: '大型或易碎物品',           desc: '钢琴、大理石家具、大尺寸玻璃、整面镜子等' },
  { icon: '📐', title: '超尺寸家具或家电',         desc: '无法正常进电梯/门口，需拆装或特殊搬运' },
  { icon: '🪜', title: '搬运难度较高',             desc: '多层楼梯、空间狭窄、搬运路径复杂等' },
]

export default function CustomerHome() {
  const navigate = useNavigate()

  return (
    <div style={{ background: BG, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── Topbar ── */}
      <div style={{ background: BRAND }}>
        <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
              <img src="/logo.jpg" alt="logo" className="w-full h-full object-contain p-0.5" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">迁喜搬家</p>
              <p className="text-xs text-white/60">Move With Ease · Sydney</p>
            </div>
          </div>
          <a href="tel:0426033899"
            className="flex items-center gap-1.5 text-white text-xs px-3 py-1.5 rounded-full bg-white/15 border border-white/25">
            <Phone size={11} /> 0426 033 899
          </a>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-lg mx-auto">
          {/* Split: text left, truck right */}
          <div className="flex items-stretch min-h-[220px] overflow-hidden">
            {/* Left */}
            <div className="flex-1 px-5 py-7 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 mb-3">
                {['本地华人团队','7天服务','专业搬运'].map(t => (
                  <span key={t} className="flex items-center gap-0.5 text-xs" style={{ color: T3 }}>
                    <span style={{ color: BRAND_L }}>✓</span>{t}
                  </span>
                )).reduce((acc, el, i) => i === 0 ? [el] : [...acc,
                  <span key={`d${i}`} className="text-gray-200 text-xs">·</span>, el
                ], [])}
              </div>
              <h1 className="font-extrabold leading-tight mb-4" style={{ color: T1, fontSize: '1.5rem', lineHeight: 1.2 }}>
                悉尼华人<br />搬家服务
              </h1>
              <div className="flex flex-col gap-2">
                <button onClick={() => navigate('/book/move')}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-white font-bold text-sm"
                  style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_L})` }}>
                  🚛 查看车型报价 &nbsp;›
                </button>
                <a href="tel:0426033899"
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border"
                  style={{ color: T2, borderColor: BORDER, background: '#F9FAFB' }}>
                  <Phone size={13} /> 电话咨询
                </a>
              </div>
            </div>
            {/* Right: truck photo */}
            <div className="w-[42%] flex-shrink-0 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #f0f4f8 0%, #e8edf2 100%)' }}>
              <img
                src="/images/large-truck.jpg"
                alt="搬家卡车"
                className="absolute inset-0 w-full h-full object-cover object-center"
                style={{ mixBlendMode: 'multiply' }}
              />
              {/* overlay gradient */}
              <div className="absolute inset-y-0 left-0 w-6"
                style={{ background: 'linear-gradient(to right, white, transparent)' }} />
            </div>
          </div>

          {/* WeChat bar */}
          <div className="mx-4 mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <span className="text-base flex-shrink-0">📸</span>
            <p className="text-xs flex-1 leading-snug" style={{ color: '#92400E' }}>
              <span className="font-semibold">不确定费用？</span> 发一张照片，1分钟帮你确认报价
            </p>
            <a href={`https://weixin.qq.com/r/${WECHAT}`}
              className="flex-shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-lg text-white whitespace-nowrap"
              style={{ background: '#D97706' }}>
              立即添加微信 ›
            </a>
          </div>

          {/* Order status link */}
          <button onClick={() => navigate('/my-order')}
            className="w-full mb-4 py-2 text-xs font-medium text-center"
            style={{ color: T3 }}>
            已有预约？查看订单状态 →
          </button>
        </div>
      </div>

      {/* ── Trust bar ── */}
      <div className="bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-lg mx-auto grid grid-cols-4 px-2 py-3">
          {TRUST.map((t, i) => (
            <div key={t.label} className="text-center py-1"
              style={i > 0 ? { borderLeft: `1px solid ${BORDER}` } : {}}>
              <p className="text-xs mb-0.5">{t.icon}</p>
              <p className="text-sm font-extrabold" style={{ color: BRAND }}>{t.value}</p>
              <p className="text-xs" style={{ color: T3 }}>{t.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Booking card ── */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: `linear-gradient(145deg, #7a1a28 0%, ${BRAND} 40%, ${BRAND_L} 100%)`,
            boxShadow: '0 8px 32px rgba(139,38,53,0.30)',
          }}>
          {/* Header */}
          <div className="px-5 pt-5 pb-3 flex items-center gap-3">
            <div>
              <h2 className="text-white font-extrabold text-xl leading-tight">悉尼搬家预约</h2>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>按实际工时计费 · 返程费另计</p>
            </div>
            <span className="ml-auto flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.9)' }}>
              价格透明
            </span>
          </div>

          {/* Vehicle rows */}
          <div className="mx-4 mb-4 rounded-xl overflow-hidden divide-y"
            style={{ background: 'rgba(0,0,0,0.18)', divideColor: 'rgba(255,255,255,0.08)' }}>
            {VEHICLES.map(v => (
              <div key={v.name} className="flex items-center gap-3 px-3 py-3">
                <div className="w-14 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
                  <img src={v.img} alt={v.name}
                    className="w-full h-full object-cover"
                    style={{ mixBlendMode: 'luminosity', opacity: 0.9 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">{v.name}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{v.desc}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-white font-extrabold text-lg">{v.price}</span>
                  <span className="text-xs ml-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>/h起</span>
                </div>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-3 px-4 pb-5">
            <button onClick={() => navigate('/book/move')}
              className="py-3.5 rounded-xl font-bold text-sm"
              style={{ background: 'white', color: BRAND }}>
              查看车型报价
            </button>
            <button onClick={() => navigate('/book/move')}
              className="py-3.5 rounded-xl font-bold text-sm border-2"
              style={{ borderColor: 'rgba(255,255,255,0.45)', color: 'white' }}>
              在线预约 ›
            </button>
          </div>
        </div>
      </div>

      {/* ── Services ── */}
      <div className="max-w-lg mx-auto px-4 pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: T3 }}>其他服务</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { emoji: '🛋️', name: 'IKEA提货安装', desc: '一站式服务 省心省力', path: '/book/ikea' },
            { emoji: '📦', name: '物品寄存',     desc: '灵活按需使用 安全可靠', path: '/book/storage' },
          ].map(s => (
            <button key={s.name} onClick={() => navigate(s.path)}
              className="bg-white rounded-2xl p-4 text-left active:scale-95 transition-transform"
              style={{ border: `1px solid ${BORDER}` }}>
              <span className="text-3xl block mb-2">{s.emoji}</span>
              <p className="font-bold text-sm" style={{ color: T1 }}>{s.name}</p>
              <p className="text-xs mt-1 leading-snug" style={{ color: T3 }}>{s.desc}</p>
              <div className="mt-3 flex items-center text-xs font-semibold" style={{ color: BRAND_L }}>
                了解更多 <ChevronRight size={12} className="ml-0.5" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Extra fees ── */}
      <div className="max-w-lg mx-auto px-4 pb-6">
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid #FDE68A` }}>
          {/* Header */}
          <div className="px-5 pt-5 pb-3" style={{ background: '#FFFBEB' }}>
            <h3 className="font-bold text-base" style={{ color: T1 }}>可能产生额外费用的情况说明</h3>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: T3 }}>
              以下情况在搬运过程中，可能会产生额外费用（具体以客服评估或现场情况为准）：
            </p>
          </div>
          {/* 4-grid */}
          <div className="grid grid-cols-2 divide-x divide-y" style={{ background: '#FFFDF0', borderColor: '#FDE68A', divideColor: '#FDE68A' }}>
            {FEES.map(f => (
              <div key={f.title} className="px-4 py-4" style={{ borderColor: '#FDE68A', borderWidth: '1px' }}>
                <span className="text-xl">{f.icon}</span>
                <p className="text-xs font-bold mt-1.5 mb-1 leading-snug" style={{ color: T2 }}>{f.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: T3 }}>{f.desc}</p>
              </div>
            ))}
          </div>
          {/* WeChat QR row */}
          <div className="flex items-center gap-4 px-5 py-4" style={{ background: '#FFF8E7', borderTop: '1px solid #FDE68A' }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-base">💬</span>
                <p className="text-sm font-bold" style={{ color: T1 }}>不确定是否产生额外费用？</p>
              </div>
              <p className="text-xs leading-relaxed mb-2" style={{ color: T3 }}>
                添加微信发送图片或视频，我们提前帮您确认，避免现场产生误差。
              </p>
              <p className="text-xs font-semibold" style={{ color: BRAND }}>微信号：{WECHAT}</p>
            </div>
            <div className="flex-shrink-0 text-center">
              <img src="/wechat-qr.jpg" alt="微信二维码"
                className="w-20 h-20 rounded-xl object-cover border"
                style={{ borderColor: '#FDE68A' }} />
              <p className="text-xs font-bold mt-1.5" style={{ color: T2 }}>扫码添加微信</p>
              <p className="text-xs font-extrabold" style={{ color: BRAND_L }}>1分钟确认</p>
              <p className="text-xs" style={{ color: T3 }}>是否产生额外费用</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Why us ── */}
      <div className="max-w-lg mx-auto px-4 pb-10">
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '🏆', title: '专业团队', desc: '经验丰富 服务用心' },
            { icon: '💰', title: '价格透明', desc: '无隐藏收费 先报价再搬运' },
            { icon: '🔒', title: '运输保险', desc: '全程投保 安心无忧' },
            { icon: '📅', title: '7天可预约', desc: '时间灵活 方便安排' },
          ].map(item => (
            <div key={item.title} className="bg-white rounded-xl px-3 py-3.5 flex items-center gap-3"
              style={{ border: `1px solid ${BORDER}` }}>
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div>
                <p className="font-bold text-xs" style={{ color: T2 }}>{item.title}</p>
                <p className="text-xs mt-0.5" style={{ color: T3 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
