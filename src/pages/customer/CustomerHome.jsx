import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, ChevronRight } from 'lucide-react'

const SERVICES = [
  { id: 'ikea',    name: 'IKEA 提货安装', desc: '代购 · 安装 · 一站式', emoji: '🛋️', path: '/book/ikea'        },
  { id: 'storage', name: '物品寄存',      desc: '按周计费 · 灵活取用',   emoji: '📦', path: '/book/storage'    },
  { id: 'clean',   name: '清洁服务',      desc: '交房验房 · 细致入微',   emoji: '✨', path: '/book/clean'      },
  { id: 'second',  name: '旧家具回收',    desc: '回收寄售 · 搬家同步处理', emoji: '♻️', path: '/book/secondhand' },
]

const TRUST = [
  { value: '2000+', label: '搬家订单'   },
  { value: '悉尼',  label: '本地团队'   },
  { value: '运输',  label: '保险保障'   },
  { value: '7天',   label: '可预约'     },
]

const WHY = [
  { icon: '🏆', title: '专业团队', desc: '多年经验，家具家电规范搬运'   },
  { icon: '📅', title: '7天预约',  desc: '时间灵活，可提前锁定档期'     },
  { icon: '🔒', title: '运输保险', desc: '正规搬运保障，安心无忧'       },
  { icon: '💰', title: '价格透明', desc: '先报价再确认，无隐藏收费'     },
]

const TRUCK_ICONS = ['🚐', '🚛', '🚚']

/* Brand */
const BLUE_DARK   = '#96394E'
const BLUE_MID    = '#B3475C'
const BLUE_MAIN   = '#C95E70'
const BLUE_BORDER = '#EAD5D1'
const BLUE_BG     = '#FFF8F7'

const T1 = '#172033'
const T2 = '#3F4854'
const T3 = '#6B7280'

const ROOT_STYLE = {
  background: BLUE_BG,
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  textRendering: 'optimizeLegibility',
}

export default function CustomerHome() {
  const navigate = useNavigate()
  const [truckIdx, setTruckIdx] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTruckIdx(i => (i + 1) % TRUCK_ICONS.length), 2000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen" style={ROOT_STYLE}>

      {/* ── Top bar ── */}
      <div style={{ background: BLUE_DARK }} className="px-4 py-2.5">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              <img src="/logo.jpg" alt="logo" className="w-full h-full object-contain p-0.5" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">迁喜搬家</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Move With Ease · Sydney</p>
            </div>
          </div>
          <a href="tel:0426033899"
            className="flex items-center gap-1.5 text-white text-xs px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}>
            <Phone size={11} /> 0426 033 899
          </a>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="bg-white" style={{ borderBottom: `1px solid ${BLUE_BORDER}` }}>
        <div className="max-w-lg mx-auto px-4 py-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: BLUE_MID }}>
            悉尼华人搬家首选
          </p>
          <h1 className="text-2xl font-bold leading-tight mb-3" style={{ color: T1 }}>
            搬家 · 寄存 · 清洁<br />
            <span className="font-normal text-lg" style={{ color: T3 }}>华人团队全程服务</span>
          </h1>
          <p className="text-sm font-medium mb-6" style={{ color: T3 }}>
            华人团队 · 中英双语 · 7天服务
          </p>
          <div className="flex gap-3 mb-3">
            <button onClick={() => navigate('/book/move')}
              className="flex-1 py-3.5 rounded-xl text-white font-semibold text-sm"
              style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE_MAIN})` }}>
              免费获取报价
            </button>
            <a href="tel:0426033899"
              className="flex items-center justify-center gap-1.5 font-medium px-4 py-3.5 rounded-xl text-sm"
              style={{ background: '#EDEDED', color: T2, border: '1px solid #DEDEDE' }}>
              <Phone size={14} /> 电话咨询
            </a>
          </div>
          <div className="text-xs text-center space-y-0.5" style={{ color: T3 }}>
            <p>在线留言后 1 小时内回复</p>
            <p>电话咨询营业时间即时接听</p>
          </div>
          <button onClick={() => navigate('/my-order')}
            className="w-full mt-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: '#F3F4F6', color: '#6B7280' }}>
            已有预约？查看订单状态 →
          </button>
        </div>
      </div>

      {/* ── Trust bar ── */}
      <div className="bg-white" style={{ borderBottom: `1px solid ${BLUE_BORDER}` }}>
        <div className="max-w-lg mx-auto px-4 py-4 grid grid-cols-4">
          {TRUST.map((t, i) => (
            <div key={t.label} className="text-center px-1"
              style={i > 0 ? { borderLeft: `1px solid ${BLUE_BORDER}` } : {}}>
              <p className="text-sm font-bold" style={{ color: BLUE_MID }}>{t.value}</p>
              <p className="text-xs mt-0.5" style={{ color: T3 }}>{t.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Services ── */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: T3 }}>
          我们的服务
        </p>

        {/* Moving — featured card */}
        <div className="w-full rounded-2xl p-5 mb-4"
          style={{
            background: `linear-gradient(135deg, ${BLUE_MID}, ${BLUE_MAIN})`,
            boxShadow: '0 2px 12px rgba(184,77,99,0.18)',
          }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs px-2 py-0.5 rounded-md font-semibold"
                  style={{ background: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.9)' }}>
                  已服务 2000+ 单
                </span>
              </div>
              <p className="text-white font-bold text-xl leading-tight">悉尼搬家预约</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
                面包车 / 小卡车 / 大卡车
              </p>
              {/* Price tiers */}
              <div className="mt-3 space-y-1">
                {[
                  { name: '面包车', price: '$60' },
                  { name: '小卡车', price: '$110' },
                  { name: '大卡车', price: '$120' },
                ].map(item => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <span className="text-white text-xs font-semibold w-14">{item.name}</span>
                    <span className="text-white text-xs font-black">{item.price}</span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>/h 起</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              <p className="text-4xl transition-all duration-500">{TRUCK_ICONS[truckIdx]}</p>
            </div>
          </div>

          {/* CTAs */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => navigate('/book/move')}
              className="rounded-xl py-3 text-sm font-semibold"
              style={{ background: '#FFFFFF', color: T1 }}>
              查看车型报价
            </button>
            <button onClick={() => navigate('/book/move')}
              className="rounded-xl py-3 text-sm font-semibold border-2"
              style={{ borderColor: 'rgba(255,255,255,0.5)', color: 'white' }}>
              免费自助预约
            </button>
          </div>
        </div>

        {/* Other services */}
        <div className="grid grid-cols-2 gap-3">
          {SERVICES.map(s => (
            <button key={s.id} onClick={() => navigate(s.path)}
              className="bg-white rounded-2xl p-4 text-left active:scale-95 transition-transform"
              style={{ border: `1px solid ${BLUE_BORDER}` }}>
              <span className="text-2xl block mb-2.5">{s.emoji}</span>
              <p className="font-bold text-sm" style={{ color: T1 }}>{s.name}</p>
              <p className="text-xs mt-0.5 leading-tight" style={{ color: T3 }}>{s.desc}</p>
              <div className="mt-3 flex items-center text-xs font-semibold" style={{ color: BLUE_MID }}>
                免费咨询 <ChevronRight size={12} className="ml-0.5" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Why us ── */}
      <div className="max-w-lg mx-auto px-4 pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: T3 }}>
          为什么选择我们
        </p>
        <div className="bg-white rounded-2xl" style={{ border: `1px solid ${BLUE_BORDER}` }}>
          {WHY.map((item, i) => (
            <div key={item.title}
              className="flex items-center gap-3.5 px-4 py-4"
              style={i > 0 ? { borderTop: `1px solid ${BLUE_BORDER}` } : {}}>
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <div>
                <p className="font-bold text-sm" style={{ color: T2 }}>{item.title}</p>
                <p className="text-xs mt-0.5" style={{ color: T3 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
