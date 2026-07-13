import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { formatDuration, billedHours, computeElapsed } from '../utils/pricing'
import { scheduledTimeLabel } from '../utils/orderTime'
import { VEHICLES, VAN_PROMO_DISCOUNT } from '../data/vehicles'
import { ArrowLeft, Play, Pause, StopCircle, Clock, CheckCircle } from 'lucide-react'

export default function WorkPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { orders, updateOrderTimer, startWork } = useApp()
  const order = orders.find(o => o.id === id)
  const [startNote, setStartNote] = useState('')
  const [starting, setStarting] = useState(false)

  // 计时状态上云：直接读订单行的 work* 字段，靠 realtime 同步给同组师傅
  // 用墙上时钟时间差计算，免疫手机锁屏 JS 暂停 bug
  const rawStatus      = order?.workStatus || 'idle'
  // 客服后台手动完单后，无论 work 字段是什么都按"已结束"显示，避免僵尸计时
  const status         = order?.status === '已完成' ? 'stopped' : rawStatus
  const accumulatedSec = Number(order?.workAccumulatedSec) || 0
  const runStartedAt   = order?.workRunStartedAt || null

  // tick 用于触发 re-render 让显示的秒数更新（实际时间从墙上时钟算）
  const [, setTick] = useState(0)

  const vehicle = order?.vehicle
  const v = VEHICLES[vehicle]

  // 派生：当前真实工时（墙上时钟）
  const elapsed = computeElapsed({ accumulatedSec, runStartedAt })

  // 跑动时：每秒触发 re-render；屏幕从锁定状态恢复时立刻 re-render
  useEffect(() => {
    if (status !== 'running') return
    const tid = setInterval(() => setTick(t => t + 1), 1000)
    const onVisible = () => { if (!document.hidden) setTick(t => t + 1) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(tid)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [status])

  // 并发闸门 7/13：开始计时走原子条件写。一个订单只有一个开始时间，
  // 抢不到（别人已开始）就加入已在跑的计时，不再另起一个开始时间。
  async function handleStart() {
    if (starting) return
    setStarting(true)
    setStartNote('')
    try {
      const res = await startWork(id)
      if (res?.alreadyStarted) {
        setStartNote(res.status === '已完成'
          ? '此单已由其他师傅完成'
          : res.status === '已取消'
          ? '此单已被客服取消'
          : '此单已有师傅开始，已为你同步计时')
      }
    } catch (err) {
      setStartNote(err.message || '开始失败，请重试')
    } finally {
      setStarting(false)
    }
  }
  function handlePause() {
    // 把当前这一段已跑时间折进 accumulatedSec，停止本段
    updateOrderTimer(id, {
      workStatus: 'paused',
      workAccumulatedSec: computeElapsed({ accumulatedSec, runStartedAt }),
      workRunStartedAt: null,
    })
  }
  function handleResume() {
    updateOrderTimer(id, {
      workStatus: 'running',
      workRunStartedAt: new Date().toISOString(),
    })
  }
  function handleStop() {
    // 同样把最后一段折进去，并记录真实收工时间
    updateOrderTimer(id, {
      workStatus: 'stopped',
      workAccumulatedSec: computeElapsed({ accumulatedSec, runStartedAt }),
      workRunStartedAt: null,
      workEndedAt: new Date().toISOString(),
    })
  }
  function handleGoForm() { navigate(`/order/${id}/form`) }

  if (!order || !v) return null

  const billed = billedHours(elapsed, v.minHours)
  const estimatedTimeFee = v.hourlyRate * billed
  const returnFeeDefault = v.returnFee
  const vanDiscount = vehicle === '面包车' ? VAN_PROMO_DISCOUNT : 0

  // 已同步在订单上的附加费（客户下单 / 客服派单时已确认）
  const stairFee        = Number(order?.stairFee)        || 0
  const remoteSurcharge = Number(order?.remoteSurcharge) || 0
  const materialsCost   = Number(order?.materialsCost)   || 0
  const heavyFee        = Number(order?.heavyFee)        || 0
  const estimatedTotal  = estimatedTimeFee + returnFeeDefault
    + stairFee + remoteSurcharge + materialsCost + heavyFee
    - vanDiscount

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
          {scheduledTimeLabel(order).text && (
            <div className="ml-auto text-right">
              <p className="text-red-300 text-xs">
                {scheduledTimeLabel(order).precise ? '客户约定时间' : '约定时段'}
              </p>
              <p className={`font-bold ${scheduledTimeLabel(order).precise ? 'text-amber-300 text-lg' : 'text-white'}`}>
                {scheduledTimeLabel(order).text}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6">

        {/* 后台已完成提示（admin 通过后台手动完单时显示） */}
        {order?.status === '已完成' && (
          <div className="mb-4 bg-green-50 border-2 border-green-300 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle size={24} className="text-green-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-green-800 font-bold">此订单已由客服完成</p>
              <p className="text-green-700 text-sm mt-1">
                账单金额：${Number(order?.finalAmount || 0).toFixed(2)} · 计费 {order?.billedHours || 0} 小时
              </p>
              <p className="text-green-600 text-xs mt-1">您不需要再操作此订单</p>
            </div>
            <button
              onClick={() => navigate('/worker', { replace: true })}
              className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap"
            >
              返回首页
            </button>
          </div>
        )}

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
                  disabled={starting}
                  className="w-full text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow hover:opacity-90 transition-opacity disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #8B1A1A, #c0392b)' }}
                >
                  <Play size={24} />
                  {starting ? '开始中…' : '开始计时'}
                </button>
              )}

              {startNote && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-sm text-center">
                  {startNote}
                </div>
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
                  {remoteSurcharge > 0 && <FeeRow label="远途附加费" value={remoteSurcharge} />}
                  {stairFee > 0 && <FeeRow label="楼梯费" value={stairFee} />}
                  {heavyFee > 0 && <FeeRow label="附加费用（重物）" value={heavyFee} />}
                  {materialsCost > 0 && <FeeRow label="物资费" value={materialsCost} />}
                  {vanDiscount > 0 && <FeeRow label="面包车优惠" value={-vanDiscount} green />}
                  <div className="border-t border-gray-100 pt-2 mt-2">
                    <FeeRow label="估算总额（实际以账单为准）" value={estimatedTotal} bold />
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

function FeeRow({ label, value, muted, bold, green }) {
  const formatted = value < 0
    ? `-$${Math.abs(value).toFixed(2)}`
    : `$${value.toFixed(2)}`
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${muted ? 'text-gray-400' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-gray-900' : green ? 'text-green-600' : muted ? 'text-gray-400' : 'text-gray-800'}`}>
        {formatted}
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
