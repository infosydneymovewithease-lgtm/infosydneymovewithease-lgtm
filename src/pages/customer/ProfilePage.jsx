import { useNavigate } from 'react-router-dom'
import { Phone, ChevronRight, Shield, Clock, Star, MessageCircle } from 'lucide-react'

const MID    = '#C95E70'
const DARK   = '#96394E'
const BG     = '#FFF8F7'
const BORDER = '#EAD5D1'
const GRAD   = 'linear-gradient(135deg, #96394E, #C95E70)'
const T2     = '#3F4854'
const T3     = '#6B7280'

const GUARANTEES = [
  { icon: Shield,         title: '价格透明',   desc: '先报价再确认，无任何隐藏费用'     },
  { icon: Star,           title: '华人团队',   desc: '中英双语，沟通无障碍'             },
  { icon: Clock,          title: '7天可预约',  desc: '灵活排期，可提前锁定档期'         },
  { icon: MessageCircle,  title: '1小时回复',  desc: '在线留言后客服1小时内跟进'        },
]

const PRICING = [
  { name: '面包车',     config: '司机1人',  rate: '$60',  min: '1小时' },
  { name: '小卡车 2人', config: '2人团队',  rate: '$110', min: '2小时' },
  { name: '小卡车 3人', config: '3人团队',  rate: '$160', min: '2小时' },
  { name: '大卡车 2人', config: '2人团队',  rate: '$120', min: '2小时' },
  { name: '大卡车 3人', config: '3人团队',  rate: '$165', min: '2小时' },
]

const SERVICES = [
  { emoji: '🚚', name: '搬家服务',   path: '/book/move'    },
  { emoji: '🛋️', name: 'IKEA提货',  path: '/book/ikea'    },
  { emoji: '📦', name: '物品寄存',   path: '/book/storage' },
  { emoji: '✨', name: '清洁服务',   path: '/book/clean'   },
]

export default function ProfilePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen" style={{ background: BG }}>

      {/* Brand header */}
      <div style={{ background: GRAD }} className="px-4 pt-10 pb-8">
        <div className="max-w-lg mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-3 shadow-lg"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            <img src="/logo.jpg" alt="logo" className="w-full h-full object-contain p-1.5" />
          </div>
          <p className="text-white font-bold text-xl tracking-wide mb-1">迁喜搬家</p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>Move With Ease · Sydney</p>
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
            华人团队 · 中英双语 · 已服务 2000+ 单
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

        {/* Contact */}
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ border: `1px solid ${BORDER}` }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: T3 }}>联系我们</p>
          </div>
          <a href="tel:0450461917"
            className="flex items-center justify-between px-4 py-4 active:bg-gray-50"
            style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: BG }}>
                <Phone size={17} style={{ color: MID }} />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-800">电话咨询</p>
                <p className="text-xs text-gray-400">0450 461 917</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </a>
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: BG }}>
                <span className="text-lg">💬</span>
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-800">微信咨询</p>
                <p className="text-xs text-gray-400">搜索微信号联系客服</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </div>
        </div>

        {/* Guarantees */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: T3 }}>
            服务承诺
          </p>
          <div className="bg-white rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${BORDER}` }}>
            {GUARANTEES.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="flex items-center gap-3 px-4 py-4"
                style={i > 0 ? { borderTop: `1px solid ${BORDER}` } : {}}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: BG }}>
                  <Icon size={17} style={{ color: MID }} />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: T2 }}>{title}</p>
                  <p className="text-xs mt-0.5" style={{ color: T3 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: T3 }}>
            收费参考
          </p>
          <div className="bg-white rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${BORDER}` }}>
            <div className="grid grid-cols-3 px-4 py-2.5 text-xs font-semibold"
              style={{ background: BG, color: T3, borderBottom: `1px solid ${BORDER}` }}>
              <span>车型</span>
              <span className="text-center">时薪</span>
              <span className="text-right">最少计费</span>
            </div>
            {PRICING.map((row, i) => (
              <div key={row.name} className="grid grid-cols-3 items-center px-4 py-3"
                style={i > 0 ? { borderTop: `1px solid ${BORDER}` } : {}}>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{row.name}</p>
                  <p className="text-xs text-gray-400">{row.config}</p>
                </div>
                <p className="text-center font-black text-base" style={{ color: MID }}>{row.rate}</p>
                <p className="text-right text-xs text-gray-500">{row.min}</p>
              </div>
            ))}
            <div className="px-4 py-3" style={{ borderTop: `1px solid ${BORDER}`, background: BG }}>
              <p className="text-xs text-gray-400">
                · 计费含返程费（约1小时车费）· 最终报价以客服确认为准
              </p>
            </div>
          </div>
        </div>

        {/* Services */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: T3 }}>
            我们的服务
          </p>
          <div className="grid grid-cols-4 gap-2">
            {SERVICES.map(s => (
              <button key={s.name} onClick={() => navigate(s.path)}
                className="bg-white rounded-2xl py-4 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                style={{ border: `1px solid ${BORDER}` }}>
                <span className="text-2xl">{s.emoji}</span>
                <p className="text-xs font-medium text-center leading-tight" style={{ color: T2 }}>
                  {s.name}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* About */}
        <div className="bg-white rounded-2xl p-4" style={{ border: `1px solid ${BORDER}` }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: T3 }}>
            关于迁喜
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            迁喜搬家（Move With Ease）是悉尼本地华人搬运团队，专注为澳洲华人社区提供专业、放心的搬家服务。
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mt-2">
            我们中英双语沟通，熟悉悉尼各区情况，承接公寓搬家、House 搬迁、IKEA 代购安装、物品寄存及清洁等全方位服务，已累计服务超过 2000 个家庭。
          </p>
          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
            <p className="text-xs text-gray-400 text-center">迁喜搬家 · ABN: — · Sydney NSW</p>
          </div>
        </div>

        {/* Bottom CTA */}
        <button onClick={() => navigate('/book/move')}
          className="w-full py-4 rounded-2xl text-white font-bold text-sm"
          style={{ background: GRAD }}>
          立即免费预约搬家
        </button>

      </div>
    </div>
  )
}
