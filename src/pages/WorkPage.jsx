import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { calcTotal, formatDuration, billedHours } from '../utils/pricing'
import { VEHICLES } from '../data/vehicles'
import { ArrowLeft, Play, Pause, StopCircle, Clock } from 'lucide-react'

export default function WorkPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { orders, timerState, setTimerState } = useApp()
  const order = orders.find(o => o.id === id)
  const intervalRef = useRef(null)

  const [status, setStatus]     = useState(timerState?.status || 'idle')
  const [elapsed, setElapsed]   = useState(timerState?.elapsed || 0)
  const [startTime, setStartTime] = useState(timerState?.startTime || null)
  const [endTime, setEndTime]   = useState(timerState?.endTime || null)

  const vehicle = order?.vehicle
  const v = VEHICLES[vehicle]

  useEffect(() => {
    if (status === 'running') {
      intervalRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [status])

  useEffect(() => {
    setTimerState({ status, elapsed, startTime, endTime })
  }, [status, elapsed, startTime, endTime])

  function handleStart()  { setStartTime(new Date().toISOString()); setStatus('running') }
  function handlePause()  { setStatus('paused') }
  function handleResume() { setStatus('running') }
  function handleStop()   { setStatus('stopped'); setEndTime(new Date().toISOString()) }
  function handleGoForm() { navigate(`/order/${id}/form`) }

  if (!order || !v) return null

  const billed = billedHours(elapsed, v.minHours)
  const estimatedTimeFee = v.hourlyRate * billed
  const returnFeeDefault = v.returnFee

  const timerColor =
    status === 'running' ? 'text-green-600' :
    status === 'paused'  ? 'text-amber-500' :
    status === 'stopped' ? 'text-gray-800'  : 'text-gray-300'

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Header */}
      <div className="px-4 pt-12 pb-5 md:pt-8 shadow-sm"
        style={{ background: 'linear-gradient(135deg, #6b1414 0%, #9b1c1c 50%, #c0392b 100%)' }}>
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-red-200">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-white font-bold text-lg">工作计时</h1>
            <p className="text-red-300 text-xs">{order.customerName} · {order.vehicle}</p>
          </div>
          {order.startTime && (
            <div className="ml-auto text-right">
              <p className="text-red-300 text-xs">约定时间</p>
              <p className="text-white font-bold">{order.startTime}</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6">

        {/* Desktop: side by side / Mobile: stacked */}
        <div className="md:grid md:grid-cols-2 md:gap-5">

          {/* Left: Timer */}
          <div className="space-y-4">

            {/* Timer Display */}
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock size={16} className={status === 'running' ? 'text-green-500' : 'text-gray-400'} />
                <span className="text-sm text-gray-500">
                  {status === 'idle'    && '等待开始'}
                  {status === 'running' && '计时中'}
                  {status === 'paused'  && '已暂停'}
                  {status === 'stopped' && '工作结束'}
                </span>
              </div>

              <div className={`text-6xl md:text-7xl font-mono font-bold tracking-wider mb-1 ${timerColor}`}>
                {formatDuration(elapsed)}
              </div>

              {elapsed > 0 && (
                <p className="text-gray-400 text-sm">
                  计费时长：{billed}小时
                  {billed < v.minHours && (
                    <span className="text-amber-500 ml-1">(起步{v.minHours}小时)</span>
                  )}
                </p>
              )}
            </div>

            {/* Control Buttons */}
            <div className="space-y-3">
              {status === 'idle' && (
                <button
                  onClick={handleStart}
                  className="w-full text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #8B1A1A, #c0392b)' }}
                >
                  <Play size={24} />
                  开始计时
                </button>
              )}

              {status === 'running' && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handlePause}
                    className="bg-amber-500 text-white py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors">
                    <Pause size={20} />暂停
                  </button>
                  <button onClick={handleStop}
                    className="bg-red-600 text-white py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 hover:bg-red-700 transition-colors">
                    <StopCircle size={20} />结束
                  </button>
                </div>
              )}

              {status === 'paused' && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleResume}
                    className="bg-green-600 text-white py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 hover:bg-green-700 transition-colors">
                    <Play size={20} />继续
                  </button>
                  <button onClick={handleStop}
                    className="bg-red-600 text-white py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 hover:bg-red-700 transition-colors">
                    <StopCircle size={20} />结束
                  </button>
                </div>
              )}

              {status === 'stopped' && (
                <button
                  onClick={handleGoForm}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow hover:bg-blue-700 transition-colors"
                >
                  填写费用，生成账单
                </button>
              )}
            </div>
          </div>

          {/* Right: Fee Preview */}
          {elapsed > 0 && (
            <div className="mt-4 md:mt-0">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">实时费用预估</h3>
                <div className="space-y-2">
                  <FeeRow label={`工时费 ($${v.hourlyRate}/h × ${billed}h)`} value={estimatedTimeFee} />
                  <FeeRow label="回程费（默认）" value={returnFeeDefault} muted />
                  <div className="border-t border-gray-100 pt-2 mt-2">
                    <FeeRow label="小计（不含附加费）" value={estimatedTimeFee + returnFeeDefault} bold />
                  </div>
                </div>

                {/* Vehicle info */}
                <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
                  <InfoLine label="车型" value={vehicle} />
                  <InfoLine label="最低计费" value={`${v.minHours} 小时`} />
                  <InfoLine label="人数" value={`${v.people} 人`} />
                </div>

                <p className="text-gray-400 text-xs mt-3">实际费用以提交表单后为准</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FeeRow({ label, value, muted, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${muted ? 'text-gray-400' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-gray-900' : muted ? 'text-gray-400' : 'text-gray-800'}`}>
        ${value.toFixed(2)}
      </span>
    </div>
  )
}

function InfoLine({ label, value }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-600 font-medium">{value}</span>
    </div>
  )
}
