import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, ChevronRight } from 'lucide-react'

const BRAND   = '#8B2635'
const BRAND_L = '#C0392B'
const T1      = '#111827'
const T2      = '#374151'
const T3      = '#6B7280'
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
    <div style={{ background: '#F7F7F7', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', color: T1 }}>

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
            }}
          />
          {/* 渐变遮罩 */}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.05) 100%)' }} />

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
            <div className="flex gap-2.5 items-center">
              <button onClick={() => navigate('/book/move')}
                className="px-4 py-2.5 rounded-xl text-white font-bold text-sm"
                style={{
                  background: `linear-gradient(135deg, ${BRAND}, ${BRAND_L})`,
                  boxShadow: '0 4px 14px rgba(139,38,53,0.5)',
                }}>
                查看车型报价 ›
              </button>
              <a href="tel:0426033899"
                className="px-4 py-2.5 rounded-xl font-semibold text-sm text-white flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}>
                <Phone size={13} /> 电话咨询
              </a>
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
      <div className="max-w-lg mx-auto px-4 pt-3 pb-1">
        <div className="bg-white rounded-2xl grid grid-cols-4 py-4 px-2"
          style={{ border: '1px solid #EFEFEF' }}>
          {[
            { icon: '👥', value: '2000+', label: '搬家订单' },
            { icon: '🛡️', value: '本地',  label: '华人团队' },
            { icon: '🚚', value: '运输',  label: '保险保障' },
            { icon: '📅', value: '7天',   label: '可预约'   },
          ].map((t, i) => (
            <div key={t.label} className="text-center"
              style={i > 0 ? { borderLeft: '1px solid #EFEFEF' } : {}}>
              <p className="text-base leading-none mb-1">{t.icon}</p>
              <p className="text-sm font-extrabold" style={{ color: BRAND }}>{t.value}</p>
              <p className="text-xs mt-0.5" style={{ color: T3 }}>{t.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── WeChat notice ── */}
      <div className="max-w-lg mx-auto px-4 pt-3">
        <div className="bg-white rounded-2xl flex items-center gap-3 px-4 py-3"
          style={{ border: '1px solid #EFEFEF', borderLeft: '3px solid #F59E0B' }}>
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
      <div className="max-w-lg mx-auto px-4 pt-6 pb-3">
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(150deg, #6b1420 0%, #8B2635 45%, #C0392B 100%)',
            boxShadow: '0 8px 32px rgba(139,38,53,0.2)',
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
              { name: '面包车', price: '$60'  },
              { name: '小卡车', price: '$110' },
              { name: '大卡车', price: '$120' },
            ].map((v, i) => (
              <div key={v.name} className="flex items-center px-5 py-4"
                style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.08)' } : {}}>
                <p className="flex-1 text-white font-semibold">{v.name}</p>
                <p>
                  <span className="text-white font-extrabold text-xl">{v.price}</span>
                  <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.45)' }}>/h起</span>
                </p>
              </div>
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
      <div className="max-w-lg mx-auto px-4 pt-6 pb-3">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: T3 }}>其他服务</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { emoji: '🛋️', name: 'IKEA 提货安装', desc: '一站式服务，省心省力', path: '/book/ikea' },
            { emoji: '📦', name: '物品寄存',       desc: '灵活按需，安全可靠',   path: '/book/storage' },
          ].map(s => (
            <button key={s.name} onClick={() => navigate(s.path)}
              className="bg-white rounded-2xl p-5 text-left"
              style={{ border: '1px solid #EFEFEF' }}>
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
      <div className="max-w-lg mx-auto px-4 pt-6 pb-3">
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ border: '1px solid #EFEFEF', borderLeft: '3px solid #F59E0B' }}>
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
                  className="w-[72px] h-[72px] rounded-xl object-cover"
                  style={{ border: '1px solid #EFEFEF' }} />
                <p className="text-xs font-bold mt-1.5" style={{ color: T2 }}>扫码微信</p>
                <p className="text-xs" style={{ color: T3 }}>1分钟确认</p>
              </div>
            </div>

            <div className="mt-4 pt-3" style={{ borderTop: '1px solid #F0F0F0' }}>
              <p className="text-xs" style={{ color: T3 }}>
                微信号：<span className="font-semibold" style={{ color: BRAND }}>{WECHAT}</span>
                &nbsp;·&nbsp;发图片或视频，提前确认费用
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Why us ── */}
      <div className="max-w-lg mx-auto px-4 pt-6 pb-10">
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #EFEFEF' }}>
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
  )
}
