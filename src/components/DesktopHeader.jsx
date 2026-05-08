import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Phone, X, Copy, Check } from 'lucide-react'

const BRAND   = '#8B2635'
const BRAND_L = '#C0392B'
const WECHAT  = 'qianxibanjia888'

const NAV = [
  { path: '/',         label: '首页' },
  { path: '/book/move', label: '搬家服务' },
  { path: '/book/ikea', label: 'IKEA 提货' },
  { path: '/book/storage', label: '物品寄存' },
  { path: '/guide',    label: '攻略' },
  { path: '/my-order', label: '我的订单' },
]

export default function DesktopHeader() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [showWechat, setShowWechat] = useState(false)
  const [copied, setCopied] = useState(false)

  function copyWechat() {
    navigator.clipboard.writeText(WECHAT)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <header className="hidden md:block sticky top-0 z-50 bg-white"
      style={{ borderBottom: '1px solid #EFEFEF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between gap-8">

        {/* Logo */}
        <button onClick={() => navigate('/')} className="flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-lg overflow-hidden">
            <img src="/logo.jpg" alt="迁喜搬家" className="w-full h-full object-cover" />
          </div>
          <div className="text-left">
            <p className="font-extrabold text-base leading-tight" style={{ color: BRAND }}>迁喜搬家</p>
            <p className="text-[10px] leading-tight" style={{ color: '#999' }}>Move With Ease · Sydney</p>
          </div>
        </button>

        {/* Nav */}
        <nav className="flex items-center gap-1 flex-1 justify-center">
          {NAV.map(item => {
            const active = pathname === item.path ||
              (item.path !== '/' && pathname.startsWith(item.path))
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  color: active ? BRAND : '#333',
                  background: active ? '#FDF2F2' : 'transparent',
                  fontWeight: active ? 700 : 500,
                }}>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setShowWechat(true)}
            className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-rose-50 transition-colors"
            style={{ color: BRAND, border: `1px solid ${BRAND}` }}>
            💬 微信咨询
          </button>
          <a href="tel:0426033899"
            className="px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5"
            style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_L})` }}>
            <Phone size={12} /> 0426 033 899
          </a>
        </div>
      </div>

      {/* WeChat QR modal */}
      {showWechat && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          onClick={() => setShowWechat(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-[90%] relative shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowWechat(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
            <h3 className="font-bold text-lg text-center mb-1" style={{ color: BRAND }}>
              💬 微信咨询
            </h3>
            <p className="text-xs text-center text-gray-500 mb-4">扫码添加客服 · 或复制微信号搜索</p>
            <img src="/wechat-qr.jpg" alt="微信二维码"
              className="w-48 h-48 mx-auto rounded-lg border border-gray-200" />
            <div className="mt-4 flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
              <div>
                <p className="text-[10px] text-gray-500">微信号</p>
                <p className="font-semibold text-sm text-gray-800">{WECHAT}</p>
              </div>
              <button onClick={copyWechat}
                className="px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors"
                style={{
                  background: copied ? '#10B981' : BRAND,
                  color: 'white',
                }}>
                {copied ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> 复制</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
