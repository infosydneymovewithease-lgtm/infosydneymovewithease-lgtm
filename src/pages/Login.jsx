import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { AlertCircle } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [logging, setLogging] = useState(false)
  const { login } = useApp()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLogging(true)
    const result = await login(username.trim(), password)
    setLogging(false)
    if (result) {
      navigate(result.role === 'worker' ? '/worker' : '/admin', { replace: true })
    } else {
      setError('账号或密码错误，请重试')
    }
  }

  return (
    <div className="min-h-screen w-full" style={{ background: 'linear-gradient(160deg, #6b1414 0%, #9b1c1c 55%, #c0392b 100%)' }}>

      {/* Mobile layout */}
      <div className="flex flex-col min-h-screen md:hidden">
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
          <div className="w-28 h-28 rounded-3xl bg-white shadow-2xl overflow-hidden mb-6 flex items-center justify-center"
            style={{ boxShadow: '0 8px 32px rgba(139,26,26,0.4)' }}>
            <img src="/logo.jpg" alt="迁喜搬家" className="w-full h-full object-contain p-2" />
          </div>
          <h1 className="text-white text-3xl font-bold tracking-wide">迁喜搬家</h1>
          <p className="text-red-300 text-sm mt-1 tracking-widest uppercase">Move With Ease</p>
          <div className="w-12 h-0.5 bg-red-500 mt-3 rounded-full" />
          <p className="text-red-300 text-xs mt-3">Sydney Moving Services</p>
        </div>

        <div className="bg-white rounded-t-3xl px-6 pt-8 pb-10 shadow-2xl">
          <h2 className="text-gray-900 text-xl font-bold mb-6">登录账号</h2>
          <LoginForm username={username} password={password} error={error} logging={logging}
            setUsername={setUsername} setPassword={setPassword} onSubmit={handleSubmit} />
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:grid md:grid-cols-2 min-h-screen w-full">

        {/* Left: Branding */}
        <div className="flex flex-col items-center justify-center px-16 py-12">
          <div className="w-36 h-36 rounded-3xl bg-white shadow-2xl overflow-hidden mb-8"
            style={{ boxShadow: '0 12px 48px rgba(0,0,0,0.3)' }}>
            <img src="/logo.jpg" alt="迁喜搬家" className="w-full h-full object-contain p-3" />
          </div>

          <h1 className="text-white text-5xl font-bold tracking-wide mb-3">迁喜搬家</h1>
          <p className="text-red-300 text-lg tracking-widest uppercase mb-6">Move With Ease</p>
          <div className="w-16 h-0.5 bg-red-400 rounded-full mb-6" />

          <div className="space-y-3 text-center">
            <p className="text-red-200 text-sm">Sydney's trusted moving service</p>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="text-center">
                <p className="text-white text-2xl font-bold">500+</p>
                <p className="text-red-300 text-xs mt-0.5">完成订单</p>
              </div>
              <div className="w-px h-8 bg-red-600" />
              <div className="text-center">
                <p className="text-white text-2xl font-bold">5★</p>
                <p className="text-red-300 text-xs mt-0.5">客户好评</p>
              </div>
              <div className="w-px h-8 bg-red-600" />
              <div className="text-center">
                <p className="text-white text-2xl font-bold">24/7</p>
                <p className="text-red-300 text-xs mt-0.5">在线支持</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Login form */}
        <div className="flex items-center justify-center px-12 py-12 bg-white bg-opacity-5 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10">
            <div className="mb-8">
              <h2 className="text-gray-900 text-2xl font-bold">欢迎回来</h2>
              <p className="text-gray-400 text-sm mt-1">请登录您的工作账号</p>
            </div>
            <LoginForm username={username} password={password} error={error}
              setUsername={setUsername} setPassword={setPassword} onSubmit={handleSubmit} />
          </div>
        </div>
      </div>
    </div>
  )
}

function LoginForm({ username, password, error, logging, setUsername, setPassword, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">账号</label>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="请输入账号"
          className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-800 text-base focus:outline-none focus:ring-2 focus:border-transparent bg-gray-50"
          style={{ '--tw-ring-color': '#8B1A1A' }}
          autoComplete="username"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">密码</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="请输入密码"
          className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-gray-800 text-base focus:outline-none bg-gray-50"
          autoComplete="current-password"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-100">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={logging}
        className="w-full text-white py-4 rounded-xl font-bold text-base mt-2 active:opacity-90 disabled:opacity-70"
        style={{ background: 'linear-gradient(135deg, #8B1A1A, #c0392b)' }}
      >
        {logging ? '登录中...' : '登 录'}
      </button>

      <p className="text-gray-400 text-xs text-center mt-4">忘记密码请联系管理员</p>
    </form>
  )
}
