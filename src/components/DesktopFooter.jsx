import { useNavigate } from 'react-router-dom'
import { Phone, MapPin, Clock } from 'lucide-react'

const BRAND  = '#8B2635'
const WECHAT = 'qianxibanjia888'

export default function DesktopFooter() {
  const navigate = useNavigate()

  return (
    <footer className="hidden md:block mt-16" style={{ background: '#1A1A1A', color: '#ccc' }}>
      <div className="max-w-7xl mx-auto px-8 py-12 grid grid-cols-4 gap-10">

        {/* Brand */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg overflow-hidden">
              <img src="/logo.jpg" alt="logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-extrabold text-white text-lg leading-tight">迁喜搬家</p>
              <p className="text-xs" style={{ color: '#888' }}>Move With Ease · Sydney</p>
            </div>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: '#888' }}>
            悉尼本地华人搬家团队，2000+ 订单经验。透明报价，运输保险，7 天可预约。
          </p>
        </div>

        {/* Services */}
        <div>
          <h4 className="text-white font-bold text-sm mb-4">服务项目</h4>
          <ul className="space-y-2.5 text-xs">
            {[
              { label: '搬家服务',     path: '/book/move' },
              { label: 'IKEA 提货安装', path: '/book/ikea' },
              { label: '物品寄存',     path: '/book/storage' },
              { label: '保洁服务',     path: '/book/clean' },
              { label: '二手交易',     path: '/book/secondhand' },
            ].map(s => (
              <li key={s.path}>
                <button onClick={() => navigate(s.path)}
                  className="hover:text-white transition-colors text-left"
                  style={{ color: '#aaa' }}>
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-white font-bold text-sm mb-4">快速入口</h4>
          <ul className="space-y-2.5 text-xs">
            {[
              { label: '搬家攻略', path: '/guide' },
              { label: '我的订单', path: '/my-order' },
              { label: '个人中心', path: '/profile' },
            ].map(l => (
              <li key={l.path}>
                <button onClick={() => navigate(l.path)}
                  className="hover:text-white transition-colors text-left"
                  style={{ color: '#aaa' }}>
                  {l.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-white font-bold text-sm mb-4">联系我们</h4>
          <ul className="space-y-3 text-xs">
            <li className="flex items-start gap-2">
              <Phone size={13} className="flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
              <a href="tel:0426033899" className="hover:text-white" style={{ color: '#aaa' }}>
                电话：0426 033 899
              </a>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5" style={{ color: BRAND, fontSize: 12 }}>💬</span>
              <a href="sms:0449600666" className="hover:text-white" style={{ color: '#aaa' }}>
                短信：0449 600 666
              </a>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5" style={{ color: BRAND, fontSize: 12 }}>💬</span>
              <span style={{ color: '#aaa' }}>微信：{WECHAT}</span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin size={13} className="flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
              <span style={{ color: '#aaa' }}>Sydney, NSW Australia</span>
            </li>
            <li className="flex items-start gap-2">
              <Clock size={13} className="flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
              <span style={{ color: '#aaa' }}>7 天服务 · 8:00 – 21:00</span>
            </li>
          </ul>
          <div className="mt-4">
            <img src="/wechat-qr.jpg" alt="微信二维码"
              className="w-20 h-20 rounded-lg" />
            <p className="text-[10px] mt-1" style={{ color: '#888' }}>扫码加微信</p>
          </div>
        </div>
      </div>

      <div className="border-t" style={{ borderColor: '#2a2a2a' }}>
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between text-xs"
          style={{ color: '#666' }}>
          <p>© {new Date().getFullYear()} 迁喜搬家 Move With Ease. All rights reserved.</p>
          <p>悉尼华人搬家服务 · 专业放心</p>
        </div>
      </div>
    </footer>
  )
}
