import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, ChevronRight, MessageCircle } from 'lucide-react'

const TRUCK_ICONS = ['🚐', '🚛', '🚚']

const BRAND = '#96394E'
const BRAND_MID = '#B3475C'
const BRAND_MAIN = '#C95E70'
const BORDER = '#EAD5D1'
const BG = '#FFF8F7'
const T1 = '#172033'
const T2 = '#3F4854'
const T3 = '#6B7280'

const WECHAT_ID = 'qianxibanjia888'

export default function CustomerHome() {
  const navigate = useNavigate()
  const [truckIdx, setTruckIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTruckIdx(i => (i + 1) % TRUCK_ICONS.length), 2000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen" style={{ background: BG, WebkitFontSmoothing: 'antialiased' }}>

      {/* ── Top bar ── */}
      <div style={{ background: BRAND }} className="px-4 py-2.5">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0"
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
      <div className="bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-lg mx-auto px-4 py-8">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: BRAND_MID }}>
            悉尼华人搬家首选
          </p>
          <h1 className="text-2xl font-bold leading-tight mb-2" style={{ color: T1 }}>
            悉尼华人搬家服务
          </h1>
          <div className="flex items-center gap-3 mb-5">
            {['本地华人团队', '7天服务', '专业搬运'].map(t => (
              <span key={t} className="flex items-center gap-1 text-xs" style={{ color: T3 }}>
                <span style={{ color: BRAND_MID }}>✓</span> {t}
              </span>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="flex gap-3 mb-3">
            <button onClick={() => navigate('/book/move')}
              className="flex-1 py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_MAIN})` }}>
              🚛 查看车型报价
            </button>
            <a href="tel:0426033899"
              className="flex items-center justify-center gap-1.5 font-medium px-4 py-3.5 rounded-xl text-sm"
              style={{ background: '#EDEDED', color: T2, border: '1px solid #DEDEDE' }}>
              <Phone size={14} /> 电话咨询
            </a>
          </div>

          {/* WeChat prompt bar */}
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl mb-3"
            style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base flex-shrink-0">📸</span>
              <p className="text-xs leading-snug" style={{ color: '#92400E' }}>
                <span className="font-semibold">不确定费用？</span> 发一张照片，我们1分钟帮你确认报价
              </p>
            </div>
            <a href={`weixin://dl/chat?username=${WECHAT_ID}`}
              className="flex-shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap"
              style={{ background: '#F59E0B', color: 'white' }}>
              立即添加微信 →
            </a>
          </div>

          <div className="text-xs text-center space-y-0.5 mb-3" style={{ color: T3 }}>
            <p>在线留言后 1 小时内回复 · 电话营业时间即时接听</p>
          </div>
          <button onClick={() => navigate('/my-order')}
            className="w-full py-2 rounded-xl text-xs font-medium"
            style={{ background: '#F3F4F6', color: '#6B7280' }}>
            已有预约？查看订单状态 →
          </button>
        </div>
      </div>

      {/* ── Trust bar ── */}
      <div className="bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-lg mx-auto px-4 py-4 grid grid-cols-4">
          {[
            { value: '2000+', label: '搬家订单' },
            { value: '悉尼',  label: '本地团队' },
            { value: '运输',  label: '保险保障' },
            { value: '7天',   label: '可预约'   },
          ].map((t, i) => (
            <div key={t.label} className="text-center px-1"
              style={i > 0 ? { borderLeft: `1px solid ${BORDER}` } : {}}>
              <p className="text-sm font-bold" style={{ color: BRAND_MID }}>{t.value}</p>
              <p className="text-xs mt-0.5" style={{ color: T3 }}>{t.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Booking card ── */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="w-full rounded-2xl p-5"
          style={{
            background: `linear-gradient(135deg, ${BRAND_MID}, ${BRAND_MAIN})`,
            boxShadow: '0 2px 12px rgba(184,77,99,0.18)',
          }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-white font-bold text-xl">悉尼搬家预约</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' }}>
                  价格透明
                </span>
              </div>
              <div className="space-y-1.5">
                {[
                  { name: '面包车', desc: '适合小件物品',    price: '$60'  },
                  { name: '小卡车', desc: '适合1–2房搬家',  price: '$110' },
                  { name: '大卡车', desc: '适合3房以上搬家', price: '$120' },
                ].map(item => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="text-white text-xs font-semibold w-12">{item.name}</span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{item.desc}</span>
                    <span className="ml-auto text-white text-sm font-black">{item.price}<span className="text-xs font-normal opacity-70">/h起</span></span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-4xl flex-shrink-0 ml-2 transition-all duration-500">{TRUCK_ICONS[truckIdx]}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => navigate('/book/move')}
              className="rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5"
              style={{ background: '#FFFFFF', color: T1 }}>
              查看车型报价
            </button>
            <button onClick={() => navigate('/book/move')}
              className="rounded-xl py-3 text-sm font-semibold border-2 flex items-center justify-center gap-1.5"
              style={{ borderColor: 'rgba(255,255,255,0.5)', color: 'white' }}>
              在线预约
            </button>
          </div>
        </div>
      </div>

      {/* ── Services ── */}
      <div className="max-w-lg mx-auto px-4 pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: T3 }}>
          其他服务
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { emoji: '🛋️', name: 'IKEA提货安装', desc: '一站式服务 省心省力', path: '/book/ikea' },
            { emoji: '📦', name: '物品寄存',     desc: '灵活按需使用 安全可靠', path: '/book/storage' },
          ].map(s => (
            <button key={s.name} onClick={() => navigate(s.path)}
              className="bg-white rounded-2xl p-4 text-left active:scale-95 transition-transform"
              style={{ border: `1px solid ${BORDER}` }}>
              <span className="text-2xl block mb-2">{s.emoji}</span>
              <p className="font-bold text-sm" style={{ color: T1 }}>{s.name}</p>
              <p className="text-xs mt-0.5 leading-tight" style={{ color: T3 }}>{s.desc}</p>
              <div className="mt-3 flex items-center text-xs font-semibold" style={{ color: BRAND_MID }}>
                了解更多 <ChevronRight size={12} className="ml-0.5" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Extra fees section ── */}
      <div className="max-w-lg mx-auto px-4 pb-6">
        <p className="text-sm font-bold mb-1" style={{ color: T1 }}>可能产生额外费用的情况说明</p>
        <p className="text-xs mb-4" style={{ color: T3 }}>
          以下情况在搬运过程中，可能会产生额外费用（具体以客服评估或现场情况为准）：
        </p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            {
              icon: '📦',
              title: '较重物品（约100kg以上）',
              desc: '如：双开门冰箱、商用洗衣机、大型实木家具等',
            },
            {
              icon: '🏆',
              title: '大型或易碎物品',
              desc: '如：钢琴（立式/三角）、大理石家具、大尺寸玻璃（约1米以上）、整面镜子等',
            },
            {
              icon: '📐',
              title: '超尺寸家具或家电',
              desc: '如：无法正常进电梯/门口，需要拆装或特殊搬运的物品',
            },
            {
              icon: '🪜',
              title: '搬运难度较高的情况',
              desc: '如：多层楼梯、空间狭窄、搬运路径复杂等',
            },
          ].map(item => (
            <div key={item.title} className="bg-white rounded-xl p-3"
              style={{ border: `1px solid ${BORDER}` }}>
              <span className="text-xl">{item.icon}</span>
              <p className="text-xs font-semibold mt-1.5 mb-1 leading-snug" style={{ color: T2 }}>{item.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: T3 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* WeChat QR section */}
        <div className="bg-white rounded-2xl p-4 flex items-center gap-4"
          style={{ border: `1px solid ${BORDER}`, background: '#FFFBEB' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-base">💬</span>
              <p className="text-sm font-bold" style={{ color: T1 }}>不确定是否产生额外费用？</p>
            </div>
            <p className="text-xs leading-relaxed mb-2" style={{ color: T3 }}>
              添加微信发送图片或视频，我们会提前帮您确认，避免现场产生误差；如未提前确认，则以现场实际情况为准。
            </p>
            <p className="text-xs font-semibold" style={{ color: BRAND_MID }}>微信号：{WECHAT_ID}</p>
          </div>
          <div className="flex-shrink-0 text-center">
            <img src="/wechat-qr.jpg" alt="微信二维码" className="w-20 h-20 rounded-xl object-cover" />
            <p className="text-xs mt-1.5 font-semibold" style={{ color: T2 }}>扫码添加微信</p>
            <p className="text-xs font-bold" style={{ color: BRAND_MID }}>1分钟确认</p>
            <p className="text-xs" style={{ color: T3 }}>是否产生额外费用</p>
          </div>
        </div>
      </div>

      {/* ── Why us ── */}
      <div className="max-w-lg mx-auto px-4 pb-8">
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '🏆', title: '专业团队', desc: '经验丰富 服务用心' },
            { icon: '💰', title: '价格透明', desc: '无隐藏收费 先报价再搬运' },
            { icon: '🔒', title: '运输保险', desc: '全程投保 安心无忧' },
            { icon: '📅', title: '7天可预约', desc: '时间灵活 方便安排' },
          ].map(item => (
            <div key={item.title} className="bg-white rounded-xl px-3 py-3 flex items-center gap-3"
              style={{ border: `1px solid ${BORDER}` }}>
              <span className="text-xl flex-shrink-0">{item.icon}</span>
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
