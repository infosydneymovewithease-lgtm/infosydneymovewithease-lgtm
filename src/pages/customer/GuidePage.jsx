import { useState } from 'react'
import { Phone, ChevronDown } from 'lucide-react'

const MID    = '#8B2635'
const BG     = '#F7F7F7'
const BORDER = '#EFEFEF'
const GRAD   = 'linear-gradient(135deg, #8B2635, #C0392B)'
const T3     = '#6B7280'

const TIPS = [
  { emoji: '🚛', title: '如何选车',   desc: '少量/单间选面包车，1-2房选小卡，3房以上或 House 选大卡' },
  { emoji: '📦', title: '搬前打包',   desc: '提前分类装箱，重物放小箱，易碎品单独用气泡膜包裹'       },
  { emoji: '🏢', title: '公寓注意',   desc: '提前预约货梯、申请临时停车位、告知客服门禁密码'         },
  { emoji: '💡', title: '省钱技巧',   desc: '避开月初月末旺季，选 08:00 首班时段，无需等上一单'      },
]

const FAQS = [
  {
    q: '如何选择合适的车型？',
    a: '• 面包车（$60/h）：单间/合租/物品较少（约30箱以内）\n• 小卡车（$110/h起）：1-2房公寓，最受欢迎的选择\n• 大卡车（$120/h起）：3房以上或整栋 House\n\n不确定时拍几张物品照片联系客服，我们帮您推荐合适车型。',
  },
  {
    q: '搬家费用怎么计算？',
    a: '按实际工时计费，从师傅到达您家开始，到所有物品搬运完毕结束。返程费用一次性收费，会依据距离远近上调或下调费用，具体请以客服报价为准。\n\n面包车：$60/h（最少1小时）\n小卡2人：$110/h（最少2小时）\n小卡3人：$160/h（最少2小时）\n大卡2人：$120/h（最少2小时）\n大卡3人：$165/h（最少2小时）\n\n最终以客服确认报价为准。',
  },
  {
    q: '需要提前多久预约？',
    a: '建议提前3-7天预约。月初月末（1-5号、25号以后）是搬家旺季，档期紧张，建议提前2周以上预约，以确保心仪时段。',
  },
  {
    q: '定金是多少？可以退吗？',
    a: '定金由客服确认订单后告知（通常 $50-$200）。\n\n• 提前48小时以上取消：全额退还\n• 提前24-48小时取消：退还50%\n• 24小时内取消：不退定金\n\n如因我方原因无法如期到达，全额退还定金。',
  },
  {
    q: '你们提供打包服务吗？',
    a: '我们提供专业搬运服务，不含打包。建议您提前将物品整理打包好。\n\n我们会携带毯子保护大件家具防止磕碰。如需拆装床架、书柜等家具，请在预约备注中提前注明，以便安排合适团队。',
  },
  {
    q: '搬运中物品损坏怎么办？',
    a: '我们持有运输保险。若搬运过程中不慎造成物品损坏，请当场拍照记录，并联系客服说明情况，我们会协商合理的赔偿方案。',
  },
  {
    q: '公寓搬家需要注意什么？',
    a: '• 提前联系物业预约货梯（通常需提前1-3天）\n• 申请楼下临时停车位（建议提前放锥形桶）\n• 告知我们门禁密码，或确保当天有人开门\n• 了解公寓噪音限制时段，避免影响邻居',
  },
  {
    q: '搬家当天要准备什么？',
    a: '① 提前完成打包，箱子外标注内容物\n② 楼下预留停车位\n③ 公寓用户提前预约货梯\n④ 保持电话畅通，等待师傅出发通知\n⑤ 准备好支付方式（银行转账 / 现金）',
  },
]

export default function GuidePage() {
  const [openIdx, setOpenIdx] = useState(null)

  return (
    <div className="min-h-screen" style={{ background: BG }}>

      {/* Header */}
      <div className="bg-white sticky top-0 z-10" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-gray-900 text-base">搬家攻略</span>
          <a href="tel:0426033899" className="flex items-center gap-1 text-sm font-medium"
            style={{ color: MID }}>
            <Phone size={14} /> 咨询客服
          </a>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-6">

        {/* Tips grid */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: T3 }}>
            实用贴士
          </p>
          <div className="grid grid-cols-2 gap-3">
            {TIPS.map(t => (
              <div key={t.title} className="bg-white rounded-2xl p-4"
                style={{ border: `1px solid ${BORDER}` }}>
                <span className="text-2xl block mb-2">{t.emoji}</span>
                <p className="font-bold text-sm text-gray-800">{t.title}</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: T3 }}>
            常见问题
          </p>
          <div className="bg-white rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${BORDER}` }}>
            {FAQS.map((item, i) => (
              <div key={i} style={i > 0 ? { borderTop: `1px solid ${BORDER}` } : {}}>
                <button
                  className="w-full px-4 py-4 flex items-center justify-between text-left"
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                  <span className="font-medium text-sm text-gray-800 pr-3 flex-1 leading-snug">
                    {item.q}
                  </span>
                  <ChevronDown size={16} className="flex-shrink-0 transition-transform duration-200"
                    style={{ color: MID, transform: openIdx === i ? 'rotate(180deg)' : 'none' }} />
                </button>
                {openIdx === i && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                      {item.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <div className="bg-white rounded-2xl p-4 text-center"
          style={{ border: `1px solid ${BORDER}` }}>
          <p className="text-sm font-semibold text-gray-800 mb-1">还有疑问？直接联系客服</p>
          <p className="text-xs text-gray-400 mb-4">7天服务，营业时间即时接听</p>
          <a href="tel:0426033899"
            className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-2xl mb-2"
            style={{ background: GRAD }}>
            <Phone size={16} /> 电话 0426 033 899
          </a>
          <a href="sms:0449600666"
            className="w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-2xl text-sm"
            style={{ background: BG, color: MID, border: `1px solid ${BORDER}` }}>
            📱 短信 0449 600 666
          </a>
        </div>

      </div>
    </div>
  )
}
