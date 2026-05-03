import { useNavigate } from 'react-router-dom'
import { ChevronRight, ArrowLeft } from 'lucide-react'

const BLUE_DARK   = '#96394E'
const BLUE_MID    = '#B3475C'
const BLUE_BG     = '#FFF8F7'
const BLUE_BORDER = '#EAD5D1'
const T1 = '#172033'
const T3 = '#6B7280'

export default function SecondhandHome() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen" style={{ background: BLUE_BG }}>

      {/* Top bar */}
      <div style={{ background: BLUE_DARK }} className="px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-white/70 hover:text-white p-1">
            <ArrowLeft size={20} />
          </button>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">二手家具</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>回收 · 寄售 · 选购</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Hero */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">♻️</div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: T1 }}>
            二手家具平台
          </h1>
          <p className="text-sm" style={{ color: T3 }}>
            华人搬家团队直营 · 同城回收 · 精品寄售
          </p>
        </div>

        {/* Two action cards */}
        <div className="space-y-4">

          {/* Sell / recycle */}
          <button onClick={() => navigate('/book/secondhand/sell')}
            className="w-full rounded-2xl p-6 text-left active:scale-98 transition-transform"
            style={{
              background: `linear-gradient(135deg, ${BLUE_DARK}, #C95E70)`,
              boxShadow: '0 4px 16px rgba(150,57,78,0.25)',
            }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl mb-3">🛋️</div>
                <p className="text-white font-bold text-lg leading-tight">我要出售 / 回收旧家具</p>
                <p className="text-sm mt-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  免费评估 · 上门收取 · 搬家时同步处理
                </p>
                <div className="mt-3 flex items-center text-white text-sm font-semibold">
                  免费提交咨询 <ChevronRight size={16} className="ml-1" />
                </div>
              </div>
            </div>
          </button>

          {/* Browse / buy */}
          <button onClick={() => navigate('/book/secondhand/browse')}
            className="w-full bg-white rounded-2xl p-6 text-left active:scale-98 transition-transform"
            style={{ border: `2px solid ${BLUE_BORDER}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl mb-3">🛒</div>
                <p className="font-bold text-lg leading-tight" style={{ color: T1 }}>我要买二手家具</p>
                <p className="text-sm mt-1.5" style={{ color: T3 }}>
                  精选在售好物 · 品质保障 · 可上门安装
                </p>
                <div className="mt-3 flex items-center text-sm font-semibold" style={{ color: BLUE_MID }}>
                  浏览在售商品 <ChevronRight size={16} className="ml-1" />
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Info strip */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: '📸', label: '拍照提交', sub: '1分钟搞定' },
            { icon: '⚡', label: '快速评估', sub: '1小时回复' },
            { icon: '🚚', label: '搬家同步', sub: '省时省力' },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-xl p-3 text-center"
              style={{ border: `1px solid ${BLUE_BORDER}` }}>
              <div className="text-xl mb-1">{item.icon}</div>
              <p className="text-xs font-semibold" style={{ color: T1 }}>{item.label}</p>
              <p className="text-xs mt-0.5" style={{ color: T3 }}>{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
