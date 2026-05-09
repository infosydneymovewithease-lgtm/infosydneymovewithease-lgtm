import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, MessageCircle, X, Truck, Package, Home, Briefcase, Shield, MapPin, Clock, Camera, Users, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

const BRAND   = '#8B2635'
const BRAND_L = '#C0392B'
const WECHAT  = 'qianxibanjia888'
const PHONE   = '0426033899'

const VEHICLES = [
  {
    name: '面包车',
    price: 60,
    desc: '小件、行李、单身公寓',
    img: '/images/lp/03-truck-ramp.jpg',
  },
  {
    name: '小卡车',
    price: 110,
    desc: '1-2 房公寓搬家',
    img: '/images/lp/05-loading-furniture.jpg',
  },
  {
    name: '大卡车',
    price: 120,
    desc: 'House、大量家具搬迁',
    img: '/images/lp/01-truck-house-night.jpg',
  },
]

const REASONS = [
  { icon: '💰', title: '价格透明',   desc: '无隐藏收费' },
  { icon: '📅', title: '在线预约',   desc: '7 天可预约' },
  { icon: '🛡️', title: '基础保障',   desc: '安心搬运' },
  { icon: '📸', title: '图片报价',   desc: '更准确' },
  { icon: '👥', title: '本地华人',   desc: '团队经验丰富' },
]

const CASES = [
  { src: '/images/lp/01-truck-house-night.jpg', label: '夜间 House 搬家' },
  { src: '/images/lp/04-marble-table.jpg',      label: '大理石圆台搬运' },
  { src: '/images/lp/05-loading-furniture.jpg', label: '家具家电装载' },
  { src: '/images/lp/06-moving-piano.jpg',      label: '钢琴 / 重物搬运' },
  { src: '/images/lp/07-loaded-truck.jpg',      label: '整车安全装载' },
  { src: '/images/lp/02-loading-warehouse.jpg', label: '仓库装卸现场' },
]

export default function MoveLandingPage() {
  const navigate = useNavigate()
  const [showWechat, setShowWechat] = useState(false)
  const [showCase, setShowCase] = useState(null)

  // SEO meta
  useEffect(() => {
    document.title = '迁喜搬家｜悉尼本地华人搬家服务 · 在线预约'
  }, [])

  function goBooking() {
    navigate('/book/move?source=xiaohongshu_landing')
  }

  return (
    <div className="min-h-screen bg-white pb-24" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden" style={{ minHeight: '480px' }}>
        {/* Background image with dark overlay */}
        <div className="absolute inset-0">
          <img src="/images/lp/01-truck-house-night.jpg"
            alt="迁喜搬家货车"
            className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.75) 100%)' }} />
        </div>

        {/* Content */}
        <div className="relative px-5 pt-12 pb-8 text-white">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-6">
            <img src="/logo.jpg" alt="logo" className="w-10 h-10 rounded-lg" />
            <div>
              <div className="font-extrabold text-base leading-tight">迁喜搬家</div>
              <div className="text-[10px] leading-tight opacity-80">Move With Ease · Sydney</div>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-extrabold leading-tight mb-2">
            悉尼本地<br />华人搬家服务
          </h1>
          <p className="text-base opacity-90 mb-4 leading-relaxed">
            House 搬家｜公寓搬家｜留学生搬家｜小件搬运
          </p>

          {/* Trust badges */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
              <div className="text-lg font-bold leading-none">2000+</div>
              <div className="text-[10px] opacity-80 mt-0.5">服务订单</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
              <div className="text-lg font-bold leading-none">4.9/5</div>
              <div className="text-[10px] opacity-80 mt-0.5">客户评分</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
              <div className="text-lg font-bold leading-none">7 天</div>
              <div className="text-[10px] opacity-80 mt-0.5">可预约</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
              <div className="text-lg font-bold leading-none">Sydney</div>
              <div className="text-[10px] opacity-80 mt-0.5">本地团队</div>
            </div>
          </div>

          {/* Hero CTA */}
          <button onClick={goBooking}
            className="w-full py-3.5 rounded-xl text-white font-bold text-base shadow-lg active:scale-95 transition-transform"
            style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_L})` }}>
            🚚 立即在线预约
          </button>
          <p className="text-xs opacity-75 text-center mt-2">点击进入预约页 · 5 分钟下单</p>
        </div>
      </section>

      {/* ── Vehicle Cards ── */}
      <section className="px-5 py-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">我们的车型</h2>
        <p className="text-xs text-gray-500 mb-4">透明定价 · 按工时计费</p>

        <div className="space-y-3">
          {VEHICLES.map(v => (
            <div key={v.name} onClick={goBooking}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-3 active:bg-gray-50 cursor-pointer transition-colors"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <img src={v.img} alt={v.name}
                className="w-24 h-20 object-cover rounded-xl flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-bold text-gray-900">{v.name}</span>
                  <span className="text-base font-bold" style={{ color: BRAND }}>${v.price}</span>
                  <span className="text-xs text-gray-400">起/小时</span>
                </div>
                <p className="text-xs text-gray-600">{v.desc}</p>
                <p className="text-[10px] mt-1" style={{ color: BRAND }}>立即预约 →</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-400 text-center mt-4">
          🛣️ 30km 内含基础返程 · 远途另算<br />
          ⏰ 起步 1 小时，按实际工时计费
        </p>
      </section>

      {/* ── Why Choose Us ── */}
      <section className="px-5 py-6 bg-gray-50">
        <h2 className="text-lg font-bold text-gray-900 mb-4 text-center">为什么选择迁喜</h2>
        <div className="grid grid-cols-5 gap-1">
          {REASONS.map(r => (
            <div key={r.title} className="flex flex-col items-center text-center px-1">
              <div className="text-2xl mb-2">{r.icon}</div>
              <div className="text-[11px] font-semibold text-gray-800 leading-tight">{r.title}</div>
              <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{r.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Real Cases ── */}
      <section className="px-5 py-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">真实案例</h2>
        <p className="text-xs text-gray-500 mb-4">每一单都是我们的口碑</p>

        <div className="grid grid-cols-2 gap-2">
          {CASES.map((c, idx) => (
            <button key={idx} onClick={() => setShowCase(c.src)}
              className="relative rounded-xl overflow-hidden bg-gray-100 active:opacity-80 transition-opacity"
              style={{ aspectRatio: '4/3' }}>
              <img src={c.src} alt={c.label}
                className="w-full h-full object-cover"
                loading="lazy" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                <p className="text-white text-[10px] font-medium">{c.label}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Trust Strip ── */}
      <section className="mx-5 my-6 rounded-2xl p-5 text-white text-center"
        style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_L})` }}>
        <p className="text-sm opacity-90 mb-1">华人专业搬家团队</p>
        <p className="text-xl font-extrabold mb-3">认真搬好每一次家</p>
        <button onClick={goBooking}
          className="bg-white px-6 py-2.5 rounded-full text-sm font-bold shadow-md"
          style={{ color: BRAND }}>
          立即预约 →
        </button>
      </section>

      {/* ── Bottom Sticky Bar ── */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -2px 12px rgba(0,0,0,0.08)' }}>
        <div className="grid grid-cols-3 gap-2 p-3">
          <button onClick={goBooking}
            className="py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-1 active:scale-95 transition-transform"
            style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_L})` }}>
            🚚 立即预约
          </button>
          <button onClick={() => setShowWechat(true)}
            className="py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 border-2"
            style={{ color: '#10B981', borderColor: '#10B981', background: '#F0FDF4' }}>
            <MessageCircle size={14} /> 微信咨询
          </button>
          <a href={`tel:${PHONE}`}
            className="py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 border-2"
            style={{ color: '#2563EB', borderColor: '#2563EB', background: '#EFF6FF' }}>
            <Phone size={14} /> 电话咨询
          </a>
        </div>
      </div>

      {/* ── WeChat Modal ── */}
      {showWechat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowWechat(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-[88%] relative shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowWechat(false)}
              className="absolute top-3 right-3 text-gray-400">
              <X size={20} />
            </button>
            <h3 className="font-bold text-lg text-center mb-1" style={{ color: BRAND }}>
              💬 微信咨询客服
            </h3>
            <p className="text-xs text-center text-gray-500 mb-4">长按二维码识别添加 · 或保存到相册扫码</p>
            <img src="/wechat-qr.jpg" alt="微信二维码"
              className="w-52 h-52 mx-auto rounded-lg border border-gray-200" />
            <div className="mt-4 bg-gray-50 rounded-lg px-3 py-2.5 text-center">
              <p className="text-[10px] text-gray-500">微信号</p>
              <p className="font-semibold text-sm text-gray-800 select-all">{WECHAT}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Case Lightbox ── */}
      {showCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4"
          onClick={() => setShowCase(null)}>
          <button onClick={() => setShowCase(null)}
            className="absolute top-4 right-4 text-white/90 bg-white/10 rounded-full p-2">
            <X size={20} />
          </button>
          <img src={showCase} alt="案例" className="max-w-full max-h-[85vh] rounded-lg" />
        </div>
      )}
    </div>
  )
}
