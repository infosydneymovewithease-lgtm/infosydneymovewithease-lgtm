import { useState, useRef, useEffect } from 'react'
import { X, ShieldCheck } from 'lucide-react'

const MOCK_CODE = '123456'
const MID  = '#A52535'
const GRAD = 'linear-gradient(135deg, #A52535, #C0392B)'

export default function VerifyCodeModal({ phone, onVerified, onClose }) {
  const [digits,    setDigits]    = useState(Array(6).fill(''))
  const [error,     setError]     = useState('')
  const [verifying, setVerifying] = useState(false)
  const inputRefs = useRef([])

  useEffect(() => { inputRefs.current[0]?.focus() }, [])

  function handleChange(i, val) {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = digit
    setDigits(next)
    setError('')
    if (digit && i < 5) inputRefs.current[i + 1]?.focus()
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    const next = Array(6).fill('')
    text.split('').forEach((c, idx) => { next[idx] = c })
    setDigits(next)
    setError('')
    inputRefs.current[Math.min(text.length, 5)]?.focus()
  }

  async function handleConfirm() {
    const code = digits.join('')
    if (code.length < 6) { setError('请输入完整的 6 位验证码'); return }
    setVerifying(true)
    await new Promise(r => setTimeout(r, 500))
    if (code !== MOCK_CODE) {
      setError('验证码错误，请重试')
      setVerifying(false)
      return
    }
    onVerified()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} style={{ color: MID }} />
            <h2 className="font-bold text-gray-900 text-base">验证手机号</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 pb-6">
          <p className="text-sm text-gray-500 mb-0.5">验证码已发送至</p>
          <p className="font-semibold text-gray-800 mb-4 text-sm">{phone}</p>

          {/* V1 mock hint */}
          <div className="rounded-xl px-3 py-2 mb-5 text-xs text-amber-700"
            style={{ background: '#FFFBF0', border: '1px solid #FDE68A' }}>
            当前为测试版本，验证码固定为 <strong>123456</strong>
          </div>

          {/* 6-digit boxes */}
          <div className="flex gap-2 justify-center mb-3">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => inputRefs.current[i] = el}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={handlePaste}
                className="w-11 h-12 text-center text-xl font-bold border-2 rounded-xl focus:outline-none transition-all"
                style={{
                  borderColor: error ? '#f87171' : d ? MID : '#e5e7eb',
                  color: '#111',
                  background: d ? '#FDF2F2' : '#F9FAFB',
                }}
              />
            ))}
          </div>

          {error && (
            <p className="text-center text-xs text-red-500 mb-3">{error}</p>
          )}

          <button
            onClick={handleConfirm}
            disabled={verifying}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-sm mb-3 transition-opacity"
            style={{ background: GRAD, opacity: verifying ? 0.7 : 1 }}
          >
            {verifying ? '验证中…' : '确认验证'}
          </button>

          <p className="text-center text-xs text-gray-400 leading-relaxed">
            验证成功后将自动提交预约<br />并为您建立订单档案
          </p>
        </div>
      </div>
    </div>
  )
}
