import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle, Home } from 'lucide-react'
import { formatDuration } from '../utils/pricing'
import dayjs from 'dayjs'

const PAYMENT_STATUS_LABEL = {
  paid:    { text: '✅ 已付款',   color: 'text-green-600' },
  partial: { text: '⏳ 部分付款', color: 'text-amber-600' },
  unpaid:  { text: '❌ 未付款',   color: 'text-red-500'   },
}

export default function SummaryPage() {
  const { state } = useLocation()
  const navigate = useNavigate()

  if (!state?.result) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      无账单数据
    </div>
  )

  const { result, order, billed, paymentMethod, paymentStatus, amountOwed, paymentNote, elapsed } = state
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
            <ReceiptRow label={`工时费 (${billed}小时 × $${Math.round(result.timeFee / billed)})`} value={result.timeFee} />
            {result.returnFee > 0 && <ReceiptRow label="回程费" value={result.returnFee} />}
            {result.stairsFee > 0 && <ReceiptRow label="楼梯费" value={result.stairsFee} />}
            {result.heavyFee > 0 && <ReceiptRow label="重物费" value={result.heavyFee} />}
            {result.overtimeFee > 0 && <ReceiptRow label="加班费" value={result.overtimeFee} />}
            {result.highwayFee > 0 && <ReceiptRow label="高速费" value={result.highwayFee} />}
            {result.parkingFee > 0 && <ReceiptRow label="违章停车押金" value={result.parkingFee} />}
            {result.miscFee > 0 && <ReceiptRow label="其他费用" value={result.miscFee} />}
          </div>

          {/* 合计区域 */}
          <div className="px-5 py-4 border-t border-dashed border-gray-200 space-y-2">
            <ReceiptRow label="小计" value={result.subtotal} />
            {result.discountAmount > 0 && (
              <ReceiptRow label="折扣优惠" value={-result.discountAmount} color="text-green-600" />
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
