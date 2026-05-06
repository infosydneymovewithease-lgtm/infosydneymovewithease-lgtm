import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, ChevronRight } from 'lucide-react'

const BRAND   = '#8B2635'
const BRAND_L = '#C0392B'
const T1      = '#1A1A1A'
const T2      = '#555555'
const T3      = '#999999'
const WECHAT  = 'qianxibanjia888'

const SLIDES = [
  '/images/van.jpg',
  '/images/small-truck.jpg',
  '/images/large-truck.jpg',
]

export default function CustomerHome() {
  const navigate = useNavigate()
  const [slide, setSlide] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setSlide(i => (i + 1) % SLIDES.length)
        setFading(false)
      }, 400)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
    {/* ============== MOBILE H5 (≤ md) ============== */}
    <div className="md:hidden" style={{ background: '#F7F7F7', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', color: T1 }}>

      {/* ── Topbar ── */}
      <div style={{ background: BRAND }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
              <img src="/logo.jpg" alt="logo" className="w-full h-full object-contain p-0.5" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">迁喜搬家</p>
              <p className="text-xs text-white/55">Move With Ease · Sydney</p>
            </div>
          </div>
          <a href="tel:0426033899"
            className="flex items-center gap-1.5 text-white text-xs px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}>
            <Phone size={11} /> 0426 033 899
          </a>
        </div>
      </div>

      {/* ── Hero Banner (轮播) ── */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '3/2' }}>
          {/* 轮播图片：淡入淡出 */}
          <img
            key={slide}
            src={SLIDES[slide]}
            alt="迁喜搬家"
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              objectPosition: 'center center',
              opacity: fading ? 0 : 1,
              transition: 'opacity 0.4s ease',
              filter: 'brightness(1.04) contrast(1.04)',
            }}
          />
          {/* 渐变遮罩：不用纯黑 */}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.22) 45%, rgba(0,0,0,0.08) 100%)' }} />

          {/* 文字 + 按钮 */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
            <div className="flex flex-wrap gap-2 mb-3">
              {['本地华人团队', '7天服务', '运输保险'].map(t => (
                <span key={t} className="text-xs px-2.5 py-1 rounded-full text-white/80"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}>
                  {t}
                </span>
              ))}
            </div>
            <h1 className="text-white font-extrabold leading-tight mb-4"
              style={{ fontSize: '1.75rem', lineHeight: 1.15, textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
              悉尼华人<br />搬家服务
            </h1>
            <div className="flex flex-col gap-2">
              <button onClick={() => navigate('/book/move')}
                className="px-5 py-2.5 rounded-xl text-white font-bold text-sm self-start"
                style={{
                  background: `linear-gradient(135deg, ${BRAND}, ${BRAND_L})`,
                  boxShadow: '0 4px 14px rgba(139,38,53,0.5)',
                }}>
                查看车型报价 ›
              </button>
              <div className="flex gap-2">
                <a href="tel:0426033899"
                  className="px-3.5 py-2 rounded-xl font-semibold text-xs text-white flex items-center gap-1"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}>
                  <Phone size={11} /> 电话咨询
                </a>
                <a href={`https://weixin.qq.com/r/${WECHAT}`}
                  className="px-3.5 py-2 rounded-xl font-semibold text-xs text-white flex items-center gap-1"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}>
                  💬 微信：{WECHAT}
                </a>
              </div>
            </div>
          </div>

          {/* 圆点指示器 */}
          <div className="absolute top-4 right-4 flex gap-1.5">
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => setSlide(i)}
                style={{
                  width: i === slide ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === slide ? 'white' : 'rgba(255,255,255,0.45)',
                  border: 'none',
                  padding: 0,
                  transition: 'width 0.3s ease, background 0.3s ease',
                  cursor: 'pointer',
                }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Trust strip ── */}
      <div className="max-w-lg mx-auto px-4 pt-4 pb-1">
        <div className="bg-white rounded-2xl grid grid-cols-4 py-5 px-2"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          {[
            { icon: '👥', value: '2000+', label: '搬家订单' },
            { icon: '🛡️', value: '本地',  label: '华人团队' },
            { icon: '🚚', value: '运输',  label: '保险保障' },
            { icon: '📅', value: '7天',   label: '可预约'   },
          ].map((t, i) => (
            <div key={t.label} className="text-center"
              style={i > 0 ? { borderLeft: '1px solid #F0F0F0' } : {}}>
              <p className="text-base leading-none mb-1">{t.icon}</p>
              <p className="text-sm font-extrabold" style={{ color: BRAND }}>{t.value}</p>
              <p className="text-xs mt-0.5" style={{ color: T3 }}>{t.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── WeChat notice ── */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="bg-white rounded-2xl flex items-center gap-3 px-4 py-3.5"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderLeft: '3px solid #F59E0B' }}>
          <span className="text-lg flex-shrink-0">📸</span>
          <p className="flex-1 text-xs leading-snug" style={{ color: T2 }}>
            <span className="font-semibold">不确定费用？</span>&nbsp;发一张照片，1分钟帮你确认报价
          </p>
          <a href={`https://weixin.qq.com/r/${WECHAT}`}
            className="flex-shrink-0 text-xs font-bold px-3 py-2 rounded-lg text-white whitespace-nowrap"
            style={{ background: BRAND }}>
            添加微信 ›
          </a>
        </div>
      </div>

      {/* ── Vehicle Pricing ── */}
      <div className="max-w-lg mx-auto px-4 pt-5 pb-3">
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(150deg, #6b1420 0%, #8B2635 45%, #C0392B 100%)',
            boxShadow: '0 8px 24px rgba(139,38,53,0.22)',
          }}>
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-white font-extrabold text-xl tracking-tight">悉尼搬家报价</h2>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              按实际工时计费 · 返程费另计 · 价格透明
            </p>
          </div>
          <div className="mx-5 mb-5 rounded-xl overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.18)' }}>
            {[
              { name: '面包车', price: '$60',  id: 'van'   },
              { name: '小卡车', price: '$110', id: 'small' },
              { name: '大卡车', price: '$120', id: 'large' },
            ].map((v, i) => (
              <button key={v.name}
                onClick={() => navigate('/book/move', { state: { vehicleId: v.id } })}
                className="w-full flex items-center px-5 py-4 active:bg-white/10 transition-colors"
                style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.08)' } : {}}>
                <p className="flex-1 text-left text-white font-semibold">{v.name}</p>
                <p className="mr-2">
                  <span className="text-white font-extrabold text-xl">{v.price}</span>
                  <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.45)' }}>/h起</span>
                </p>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem' }}>›</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 px-5 pb-6">
            <button onClick={() => navigate('/book/move')}
              className="py-3.5 rounded-xl font-bold text-sm"
              style={{ background: 'white', color: BRAND }}>
              查看报价详情
            </button>
            <button onClick={() => navigate('/book/move')}
              className="py-3.5 rounded-xl font-bold text-sm"
              style={{ border: '1.5px solid rgba(255,255,255,0.38)', color: 'white' }}>
              立即预约 ›
            </button>
          </div>
        </div>
      </div>

      {/* ── Other services ── */}
      <div className="max-w-lg mx-auto px-4 pt-6 pb-2">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: T3 }}>其他服务</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { emoji: '🛋️', name: 'IKEA 提货安装', desc: '一站式服务，省心省力', path: '/book/ikea' },
            { emoji: '📦', name: '物品寄存',       desc: '灵活按需，安全可靠',   path: '/book/storage' },
          ].map(s => (
            <button key={s.name} onClick={() => navigate(s.path)}
              className="bg-white rounded-2xl p-5 text-left"
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <span className="text-3xl block mb-3">{s.emoji}</span>
              <p className="font-bold text-sm" style={{ color: T1 }}>{s.name}</p>
              <p className="text-xs mt-1 leading-snug" style={{ color: T3 }}>{s.desc}</p>
              <div className="mt-3 flex items-center gap-0.5 text-xs font-semibold" style={{ color: BRAND_L }}>
                了解更多 <ChevronRight size={12} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Extra fees ── */}
      <div className="max-w-lg mx-auto px-4 pt-5 pb-2">
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderLeft: '3px solid #F59E0B' }}>
          <div className="px-5 pt-5 pb-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">⚠️</span>
              <h3 className="font-bold text-sm" style={{ color: T1 }}>以下情况可能产生额外费用</h3>
            </div>
            <p className="text-xs mb-4 ml-6" style={{ color: T3 }}>具体以客服评估为准</p>

            <div className="flex items-start gap-4">
              <ul className="flex-1 space-y-3">
                {[
                  { icon: '📦', text: '较重物品（双开门冰箱、大型实木家具等）' },
                  { icon: '🎹', text: '大型或易碎物品（钢琴、玻璃、大理石）' },
                  { icon: '📐', text: '超尺寸物品（无法进电梯或需拆装）' },
                  { icon: '🪜', text: '搬运难度较高（楼梯多、路径复杂）' },
                ].map(item => (
                  <li key={item.icon} className="flex items-start gap-2">
                    <span className="text-sm flex-shrink-0 mt-0.5">{item.icon}</span>
                    <span className="text-xs leading-relaxed" style={{ color: T2 }}>{item.text}</span>
                  </li>
                ))}
              </ul>
              <div className="flex-shrink-0 text-center" style={{ width: 72 }}>
                <img src="/wechat-qr.jpg" alt="微信二维码"
                  className="w-[72px] h-[72px] rounded-xl object-cover" />
                <p className="text-xs font-bold mt-1.5" style={{ color: T2 }}>扫码微信</p>
                <p className="text-xs" style={{ color: T3 }}>1分钟确认</p>
              </div>
            </div>

            <div className="mt-4 pt-3" style={{ borderTop: '1px solid #F5F5F5' }}>
              <p className="text-xs" style={{ color: T3 }}>
                微信号：<span className="font-semibold" style={{ color: BRAND }}>{WECHAT}</span>
                &nbsp;·&nbsp;发图片或视频，提前确认费用
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Why us ── */}
      <div className="max-w-lg mx-auto px-4 pt-5 pb-10">
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          {[
            { icon: '🏆', title: '专业团队', desc: '经验丰富，服务用心' },
            { icon: '💰', title: '价格透明', desc: '先报价再搬运，无隐藏收费' },
            { icon: '🔒', title: '运输保险', desc: '全程投保，安心无忧' },
            { icon: '📅', title: '7天可预约', desc: '时间灵活，方便安排' },
          ].map((item, i) => (
            <div key={item.title} className="flex items-center gap-4 px-5 py-4"
              style={i > 0 ? { borderTop: '1px solid #F5F5F5' } : {}}>
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div>
                <p className="font-bold text-sm" style={{ color: T1 }}>{item.title}</p>
                <p className="text-xs mt-0.5" style={{ color: T3 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Order lookup ── */}
      <div className="max-w-lg mx-auto px-4 pb-10 text-center">
        <button onClick={() => navigate('/my-order')}
          className="text-xs font-medium"
          style={{ color: T3 }}>
          已有预约？查看订单状态 →
        </button>
      </div>

    </div>

    {/* ============== DESKTOP (≥ md) ============== */}
    <div className="hidden md:block" style={{ background: '#FFF', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', color: T1 }}>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ height: 560 }}>
        <img
          key={slide}
          src={SLIDES[slide]}
          alt="迁喜搬家"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: fading ? 0 : 1,
            transition: 'opacity 0.5s ease',
            filter: 'brightness(0.85)',
          }}
        />
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(110deg, rgba(20,8,12,0.82) 0%, rgba(20,8,12,0.5) 50%, rgba(20,8,12,0.15) 100%)' }} />

        <div className="relative max-w-7xl mx-auto px-8 h-full flex items-center">
          <div className="max-w-2xl">
            <div className="flex flex-wrap gap-2 mb-5">
              {['本地华人团队', '2000+ 订单经验', '运输保险保障', '7 天可预约'].map(t => (
                <span key={t} className="text-xs px-3 py-1.5 rounded-full text-white"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' }}>
                  {t}
                </span>
              ))}
            </div>
            <h1 className="text-white font-extrabold mb-4"
              style={{ fontSize: '4rem', lineHeight: 1.05, letterSpacing: '-0.02em', textShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
              悉尼华人<br/>搬家服务
            </h1>
            <p className="text-white/85 text-lg mb-8 leading-relaxed max-w-xl">
              专业本地华人团队，透明报价、运输保险、7 天预约。<br/>
              一站式服务：搬家 · IKEA 提货 · 物品寄存 · 保洁
            </p>
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/book/move')}
                className="px-8 py-4 rounded-xl text-white font-bold text-base"
                style={{
                  background: `linear-gradient(135deg, ${BRAND}, ${BRAND_L})`,
                  boxShadow: '0 8px 24px rgba(139,38,53,0.5)',
                }}>
                立即预约 ›
              </button>
              <a href="tel:0426033899"
                className="px-6 py-4 rounded-xl font-semibold text-base text-white flex items-center gap-2"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)' }}>
                <Phone size={16} /> 0426 033 899
              </a>
            </div>
          </div>
        </div>

        {/* Slide dots */}
        <div className="absolute bottom-8 right-8 flex gap-2">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => setSlide(i)}
              style={{
                width: i === slide ? 32 : 8,
                height: 8,
                borderRadius: 4,
                background: i === slide ? 'white' : 'rgba(255,255,255,0.5)',
                border: 'none',
                padding: 0,
                transition: 'all 0.3s ease',
                cursor: 'pointer',
              }} />
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="max-w-7xl mx-auto px-8 -mt-12 relative z-10">
        <div className="bg-white rounded-2xl grid grid-cols-4 py-8"
          style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.08)', border: '1px solid #F0F0F0' }}>
          {[
            { icon: '👥', value: '2000+', label: '搬家订单' },
            { icon: '🛡️', value: '本地',  label: '华人团队' },
            { icon: '🚚', value: '运输',  label: '保险保障' },
            { icon: '📅', value: '7天',   label: '可预约'   },
          ].map((t, i) => (
            <div key={t.label} className="text-center px-4"
              style={i > 0 ? { borderLeft: '1px solid #F0F0F0' } : {}}>
              <p className="text-3xl mb-2">{t.icon}</p>
              <p className="text-2xl font-extrabold mb-1" style={{ color: BRAND }}>{t.value}</p>
              <p className="text-sm" style={{ color: T3 }}>{t.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Vehicle pricing */}
      <section className="max-w-7xl mx-auto px-8 pt-20">
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: BRAND }}>悉尼搬家报价</p>
          <h2 className="text-4xl font-extrabold mb-3" style={{ color: T1 }}>透明定价 · 按工时计费</h2>
          <p className="text-base" style={{ color: T2 }}>价格透明，先报价再搬运 · 返程费另计</p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {[
            { name: '面包车', price: '$60',  unit: '/小时起', id: 'van',   img: '/images/van.jpg',
              desc: '适合小户型，单身公寓搬家', features: ['1-2 人团队', '500kg 载重', '小型家具'] },
            { name: '小卡车', price: '$110', unit: '/小时起', id: 'small', img: '/images/small-truck.jpg',
              desc: '一房一厅或两房搬家首选', features: ['2-3 人团队', '1.5T 载重', '中型家具'] },
            { name: '大卡车', price: '$120', unit: '/小时起', id: 'large', img: '/images/large-truck.jpg',
              desc: '三房以上大型搬家', features: ['3-4 人团队', '3T+ 载重', '大型家具'] },
          ].map(v => (
            <button key={v.id} onClick={() => navigate('/book/move', { state: { vehicleId: v.id } })}
              className="bg-white rounded-2xl overflow-hidden text-left transition-all hover:scale-[1.02]"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0' }}>
              <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                <img src={v.img} alt={v.name} className="w-full h-full object-cover" />
              </div>
              <div className="p-6">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="font-extrabold text-xl" style={{ color: T1 }}>{v.name}</h3>
                  <p>
                    <span className="font-extrabold text-2xl" style={{ color: BRAND }}>{v.price}</span>
                    <span className="text-xs ml-1" style={{ color: T3 }}>{v.unit}</span>
                  </p>
                </div>
                <p className="text-sm mb-4" style={{ color: T2 }}>{v.desc}</p>
                <ul className="space-y-1.5 mb-5">
                  {v.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs" style={{ color: T2 }}>
                      <span style={{ color: BRAND }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between text-sm font-semibold pt-4"
                  style={{ borderTop: '1px solid #F0F0F0', color: BRAND }}>
                  立即预约 <ChevronRight size={16} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Other services */}
      <section className="max-w-7xl mx-auto px-8 pt-20">
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: BRAND }}>其他服务</p>
          <h2 className="text-4xl font-extrabold" style={{ color: T1 }}>一站式生活服务</h2>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {[
            { emoji: '🛋️', name: 'IKEA 提货安装',  desc: '提货 + 运输 + 组装一站式，省心省力',           path: '/book/ikea' },
            { emoji: '📦', name: '物品寄存',        desc: '灵活按周计费，安全仓储，随时取回',            path: '/book/storage' },
            { emoji: '🛒', name: '二手物品',        desc: '本地华人二手交易，发布闲置，淘到好物',         path: '/book/secondhand' },
          ].map(s => (
            <button key={s.name} onClick={() => navigate(s.path)}
              className="bg-white rounded-2xl p-8 text-left transition-all hover:scale-[1.02]"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0' }}>
              <span className="text-5xl block mb-4">{s.emoji}</span>
              <p className="font-bold text-lg mb-2" style={{ color: T1 }}>{s.name}</p>
              <p className="text-sm leading-relaxed mb-4" style={{ color: T2 }}>{s.desc}</p>
              <div className="flex items-center gap-1 text-sm font-semibold" style={{ color: BRAND }}>
                了解更多 <ChevronRight size={14} />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Why us */}
      <section className="max-w-7xl mx-auto px-8 pt-20">
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: BRAND }}>为什么选我们</p>
          <h2 className="text-4xl font-extrabold" style={{ color: T1 }}>专业 · 透明 · 安心</h2>
        </div>

        <div className="grid grid-cols-4 gap-6">
          {[
            { icon: '🏆', title: '专业团队', desc: '本地华人团队，经验丰富，沟通无障碍' },
            { icon: '💰', title: '价格透明', desc: '先报价再搬运，按实际工时计费，无隐藏收费' },
            { icon: '🔒', title: '运输保险', desc: '全程投保，物品安全有保障' },
            { icon: '📅', title: '7 天可约', desc: '8:00–21:00 灵活预约，急单加急也可以' },
          ].map(item => (
            <div key={item.title} className="bg-white rounded-2xl p-6"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0' }}>
              <span className="text-4xl block mb-3">{item.icon}</span>
              <p className="font-bold text-base mb-2" style={{ color: T1 }}>{item.title}</p>
              <p className="text-sm leading-relaxed" style={{ color: T2 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="max-w-7xl mx-auto px-8 pt-20 pb-10">
        <div className="rounded-3xl p-12 flex items-center justify-between"
          style={{
            background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_L} 100%)`,
            boxShadow: '0 12px 40px rgba(139,38,53,0.3)',
          }}>
          <div>
            <h3 className="text-white font-extrabold text-3xl mb-3">不确定费用？</h3>
            <p className="text-white/85 text-base">电话或微信联系我们，免费为您报价</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="tel:0426033899"
              className="px-8 py-4 rounded-xl bg-white font-bold text-base flex items-center gap-2"
              style={{ color: BRAND }}>
              <Phone size={16} /> 电话咨询
            </a>
            <a href={`weixin://contacts/profile/${WECHAT}`}
              className="px-8 py-4 rounded-xl font-bold text-base text-white flex items-center gap-2"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)' }}>
              💬 微信咨询
            </a>
          </div>
        </div>
      </section>

    </div>
    </>
  )
}
