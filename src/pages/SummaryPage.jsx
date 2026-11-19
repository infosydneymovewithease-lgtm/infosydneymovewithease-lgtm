import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle, Home } from 'lucide-react'
import { useMemo } from 'react'
import { formatDuration } from '../utils/pricing'
import { useApp } from '../context/AppContext'
import { VAN_PROMO_DISCOUNT } from '../data/vehicles'
import dayjs from 'dayjs'

const PAYMENT_STATUS_LABEL = {
  paid:    { text: '✅ 已付款',   color: 'text-green-600' },
  partial: { text: '⏳ 部分付款', color: 'text-amber-600' },
  unpaid:  { text: '❌ 未付款',   color: 'text-red-500'   },
}

// ⚠️ 2026-11-20。这一页原来【只】读 navigate 传过来的 state，不碰数据库 ——
//    刷新一次、从历史记录点进来、或者隔天再打开，就是一片「无账单数据」。
//    老板今早手机上就卡在这儿，还以为是后台连不上。
//    师傅要把账单再给客人看一遍，这是个很正常的动作，不该是死路。
//
//    钱的字段交单时全写进 orders 了，照着重拼出来就行。
//
// ⚠️ 唯一的坑：定金不能直接读 order.deposit。
//    QX2611071 存的 deposit 是 30，但 finalAmount 1091.81 并没有减这 30
//    （师傅在表单上把定金填成了 0，而建单时的 30 还留在那一列）。
//    照着读会让收据算不平 —— 客人看着就是一笔对不上的账。
//    所以定金用【倒推】：subtotal + GST − 优惠 − 实收 = 实际抵扣掉的定金。
//    这样无论那一列是什么，收据永远和客人真正付的那个数自洽。
function 从订单重建(order) {
  if (!order) return null
  const n = v => Number(v) || 0
  const r2 = v => Math.round(v * 100) / 100

  const vanDiscount = order.vehicle === '面包车' ? VAN_PROMO_DISCOUNT : 0
  const miscFee = n(order.suppliesFee) + n(order.fuelFee) + n(order.otherFee)
  const subtotal = r2(
    n(order.timeFee) + n(order.returnFee) + n(order.stairFee) + n(order.heavyFee)
    + n(order.overtimeFee) + n(order.highwayFee) + n(order.parkingFee)
    + miscFee - vanDiscount)

  const gst = n(order.gst)
  const discountAmount = n(order.discountAmount)
  const total = n(order.finalAmount)
  const deposit = Math.max(0, r2(subtotal + gst - discountAmount - total))

  const 秒 = order.workStartedAt && order.workEndedAt
    ? Math.max(0, Math.round(
        (new Date(order.workEndedAt) - new Date(order.workStartedAt)) / 1000))
    : 0

  return {
    order,
    billed: n(order.billedHours),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    amountOwed: null,      // 这两个当初只存在于内存里，库里没有对应列
    paymentNote: null,
    elapsed: 秒,
    result: {
      timeFee: n(order.timeFee), returnFee: n(order.returnFee),
      stairsFee: n(order.stairFee), heavyFee: n(order.heavyFee),
      overtimeFee: n(order.overtimeFee), highwayFee: n(order.highwayFee),
      parkingFee: n(order.parkingFee), miscFee: r2(miscFee),
      vanDiscount, subtotal, discountAmount, gst, deposit, total,
    },
  }
}

export default function SummaryPage() {
  const { state } = useLocation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { orders } = useApp()

  // 刚交完单走 state（最快，不等数据库）；其余情况从库里重建
  const data = useMemo(
    () => (state?.result ? state : 从订单重建(orders.find(o => o.id === id))),
    [state, orders, id])

  if (!data) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-gray-400 px-8 text-center">
      <p className="text-sm">找不到这一单的账单</p>
      <p className="text-xs mt-2 text-gray-300">订单号可能不对，或者这单还没交</p>
      <button onClick={() => navigate('/worker')}
        className="mt-5 px-5 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm">回首页</button>
    </div>
  )

  const { result, order, billed, paymentMethod, paymentStatus, amountOwed, paymentNote, elapsed } = data
  const now = dayjs().format('YYYY/MM/DD HH:mm')
  const statusInfo = PAYMENT_STATUS_LABEL[paymentStatus] || PAYMENT_STATUS_LABEL.paid

  return (
    <div className="min-h-screen bg-gray-100 pb-8">
      {/* 成功顶部 */}
      <div className="px-4 pt-12 pb-8 md:pt-10 text-center"
        style={{ background: 'linear-gradient(135deg, #6b1414 0%, #9b1c1c 50%, #c0392b 100%)' }}>
        <CheckCircle size={52} className="text-white mx-auto mb-3" />
        <h1 className="text-white text-xl font-bold">提交成功</h1>
        <p className="text-green-100 text-sm mt-1">请将账单明细展示给客户确认</p>
      </div>

      <div className="px-4 -mt-4 space-y-3 max-w-2xl mx-auto">
        {/* 收据卡片 */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">

          {/* 收据头部 */}
          <div className="bg-gray-50 px-5 py-4 border-b border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-gray-900 font-bold text-base">Move With Ease</h2>
                <p className="text-gray-500 text-xs mt-0.5">Sydney Moving Services</p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-xs">{order.id}</p>
                <p className="text-gray-400 text-xs mt-0.5">{now}</p>
              </div>
            </div>
          </div>

          {/* 客户信息 */}
          <div className="px-5 py-4 border-b border-dashed border-gray-200">
            <p className="text-gray-900 font-semibold">{order.customerName}</p>
            <p className="text-gray-500 text-sm mt-0.5">{order.fromAddress}</p>
            <p className="text-gray-400 text-sm mt-0.5">→ {order.toAddress}</p>
          </div>

          {/* 费用明细 */}
          <div className="px-5 py-4 space-y-2.5">
            {/* billed 可能是 0（老单没填工时）—— 除零会印出 $Infinity 给客人看 */}
            <ReceiptRow
              label={billed > 0
                ? `工时费 (${billed}小时 × $${Math.round(result.timeFee / billed)})`
                : '工时费'}
              value={result.timeFee} />
            {result.returnFee > 0 && <ReceiptRow label="回程费" value={result.returnFee} />}
            {result.stairsFee > 0 && <ReceiptRow label="楼梯费" value={result.stairsFee} />}
            {result.heavyFee > 0 && <ReceiptRow label="重物费" value={result.heavyFee} />}
            {result.overtimeFee > 0 && <ReceiptRow label="加班费" value={result.overtimeFee} />}
            {result.highwayFee > 0 && <ReceiptRow label="高速费" value={result.highwayFee} />}
            {result.parkingFee > 0 && <ReceiptRow label="违章停车押金" value={result.parkingFee} />}
            {result.miscFee > 0 && <ReceiptRow label="其他费用" value={result.miscFee} />}
            {result.vanDiscount > 0 && (
              <ReceiptRow label="面包车优惠" value={-result.vanDiscount} color="text-green-600" />
            )}
          </div>

          {/* 合计区域 */}
          <div className="px-5 py-4 border-t border-dashed border-gray-200 space-y-2">
            <ReceiptRow label="小计" value={result.subtotal} />
            {result.discountAmount > 0 && (
              <ReceiptRow label="优惠" value={-result.discountAmount} color="text-green-600" />
            )}
            {result.gst > 0 && (
              <ReceiptRow label="GST (10%)" value={result.gst} />
            )}
            {result.deposit > 0 && (
              <ReceiptRow label="已收定金" value={-result.deposit} color="text-gray-400" />
            )}
          </div>

          {/* 总额 */}
          <div className="px-5 py-5 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-gray-800 font-bold text-lg">应收金额</span>
              <span className="text-green-600 font-bold text-3xl">${result.total.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-gray-400 text-xs">
                {paymentMethod === 'cash' ? '💵 现金' : '🏦 银行转账（含GST）'}
              </span>
              <span className={`text-sm font-semibold ${statusInfo.color}`}>
                {statusInfo.text}
              </span>
            </div>
            {paymentStatus === 'partial' && amountOwed && (
              <p className="text-amber-600 text-xs mt-1">欠款：${amountOwed}</p>
            )}
            {paymentNote && (
              <p className="text-gray-400 text-xs mt-1">备注：{paymentNote}</p>
            )}
          </div>
        </div>

        {/* 工时信息 */}
        <div className="bg-white rounded-xl px-5 py-4 shadow-sm">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-gray-400 text-xs mb-1">实际工时</p>
              <p className="text-gray-800 font-semibold text-sm">{formatDuration(elapsed)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">计费时长</p>
              <p className="text-blue-600 font-semibold text-sm">{billed} 小时</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">车型</p>
              <p className="text-gray-800 font-semibold text-sm">{order.vehicle}</p>
            </div>
          </div>
        </div>

        {/* 返回首页 */}
        <button
          onClick={() => navigate('/worker', { replace: true })}
          className="w-full text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 active:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}
        >
          <Home size={20} />
          返回首页
        </button>
      </div>
    </div>
  )
}

function ReceiptRow({ label, value, color }) {
  const formatted = value < 0
    ? `-$${Math.abs(value).toFixed(2)}`
    : `$${value.toFixed(2)}`
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600 text-sm">{label}</span>
      <span className={`text-sm font-medium ${color || 'text-gray-800'}`}>{formatted}</span>
    </div>
  )
}
