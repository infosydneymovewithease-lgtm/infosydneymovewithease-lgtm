import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { ArrowLeft, Phone, Camera, Video, CheckCircle } from 'lucide-react'
import dayjs from 'dayjs'
import { useState, useRef, useEffect } from 'react'
import { saveVideo, getVideo, deleteVideo } from '../utils/mediaDB'
import { VEHICLES } from '../data/vehicles'
import { roundToHalfHour } from '../utils/pricing'

const STEPS = [
  { key: 'confirmed', label: '确认收单',     desc: '确认已收到本次寄存任务' },
  { key: 'arrived',   label: '到达取货地址', desc: '已到达客户地址，开始计时' },
  { key: 'stored',    label: '到达仓库入库', desc: '物品已搬入仓库，准备拍摄凭证' },
]
const STEP_ORDER = STEPS.map(s => s.key)

export default function WorkerStorageDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { storageOrders, updateStorageOrder, completeStorageOrder } = useApp()

  const order = storageOrders.find(o => o.id === id)

  const [photos, setPhotos] = useState(() => order?.photos || [])
  const [videoUrl, setVideoUrl] = useState(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // 车型配置（用于计算工时费、起步价）
  const v = VEHICLES[order?.vehicle] || { hourlyRate: 0, minHours: 0, returnFee: 0 }

  // 自动从「到达取货」时间推算工时（可手动调整）
  const autoBilledHours = (() => {
    if (!order?.arrivedAt) return 0
    const elapsedSec = Math.max(0, (Date.now() - new Date(order.arrivedAt).getTime()) / 1000)
    return Math.max(roundToHalfHour(elapsedSec), v.minHours || 0)
  })()

  // 账单字段（默认从订单回填，没回填用计算值）
  const [billed,         setBilled]         = useState(() => String(order?.billedHours ?? autoBilledHours ?? 0))
  const [returnFee,      setReturnFee]      = useState(() => String(order?.returnFee ?? v.returnFee ?? 0))
  const [stairFee,       setStairFee]       = useState(() => String(order?.stairFee ?? 0))
  const [overtimeFee,    setOvertimeFee]    = useState(() => String(order?.overtimeFee ?? 0))
  const [heavyFee,       setHeavyFee]       = useState(() => String(order?.heavyFee ?? 0))
  const [highwayFee,     setHighwayFee]     = useState(() => String(order?.highwayFee ?? 0))
  const [parkingFee,     setParkingFee]     = useState(() => String(order?.parkingFee ?? 0))
  const [suppliesFee,    setSuppliesFee]    = useState(() => String(order?.suppliesFee ?? 0))
  const [fuelFee,        setFuelFee]        = useState(() => String(order?.fuelFee ?? 0))
  const [discountAmount, setDiscountAmount] = useState(() => String(order?.discountAmount ?? 0))
  const [paymentMethod,  setPaymentMethod]  = useState(() => order?.paymentMethod ?? 'cash')

  // 定金默认值：order 里存了就用；没存但客户上传过定金截图，按业务标准 $30 预填；都没有就 0
  const defaultDeposit = (() => {
    if (Number(order?.deposit) > 0) return String(order.deposit)
    const looksPaid = order?.depositPaid
      || order?.depositStatus === '已上传截图'
      || order?.paymentStatus === '定金'
      || order?.paymentStatus === '已付'
    return looksPaid ? '30' : '0'
  })()
  const [depositAmount, setDepositAmount] = useState(defaultDeposit)

  const photoInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const videoUrlRef = useRef(null)

  useEffect(() => {
    if (!order?.hasVideo) return
    setVideoLoading(true)
    getVideo(id).then(blob => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        videoUrlRef.current = url
        setVideoUrl(url)
      }
      setVideoLoading(false)
    }).catch(() => setVideoLoading(false))
  }, [])

  useEffect(() => {
    return () => { if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current) }
  }, [])

  useEffect(() => {
    setPhotos(order?.photos || [])
  }, [order?.photos])

  if (!order) return (
    <div className="flex items-center justify-center h-64 text-gray-400">订单不存在</div>
  )

  const days = dayjs(order.moveOutDate).diff(dayjs(order.moveInDate), 'day')
  const weeks = Math.max(1, Math.ceil(days / 7))
  const shortTerm = weeks <= 5
  const boxRate = shortTerm ? 5 : 3
  const furRate = shortTerm ? 10 : 7
  const storageFee = (order.boxes * boxRate + order.furniture * furRate) * weeks

  const workerStatus = order.workerStatus || null
  const currentStepIdx = workerStatus ? STEP_ORDER.indexOf(workerStatus) : -1
  const isDone = order.status === '寄存中'
  const canSubmit = photos.length >= 3 && (videoUrl || order.hasVideo)

  function advanceStep(stepKey) {
    const updates = { workerStatus: stepKey }
    if (stepKey === 'arrived') updates.arrivedAt = new Date().toISOString()
    updateStorageOrder(id, updates)
  }

  async function compressImage(file) {
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = e => {
        const img = new Image()
        img.onload = () => {
          const maxDim = 1200
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(img.width * scale)
          canvas.height = Math.round(img.height * scale)
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.75))
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  async function handleAddPhoto(e) {
    const files = Array.from(e.target.files).slice(0, 3 - photos.length)
    if (!files.length) return
    const compressed = await Promise.all(files.map(compressImage))
    const next = [...photos, ...compressed]
    setPhotos(next)
    updateStorageOrder(id, { photos: next })
    e.target.value = ''
  }

  function handleRemovePhoto(idx) {
    const next = photos.filter((_, i) => i !== idx)
    setPhotos(next)
    updateStorageOrder(id, { photos: next })
  }

  async function handleAddVideo(e) {
    const file = e.target.files[0]
    if (!file) return
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
    const url = URL.createObjectURL(file)
    videoUrlRef.current = url
    setVideoUrl(url)
    await saveVideo(id, file)
    updateStorageOrder(id, { hasVideo: true })
    e.target.value = ''
  }

  async function handleRemoveVideo() {
    if (videoUrlRef.current) { URL.revokeObjectURL(videoUrlRef.current); videoUrlRef.current = null }
    setVideoUrl(null)
    await deleteVideo(id)
    updateStorageOrder(id, { hasVideo: false })
  }

  // 实时账单计算
  const num = s => Number(s) || 0
  const billedNum = num(billed)
  const hourlyRate = v.hourlyRate
  const timeFee = Math.round(billedNum * hourlyRate * 100) / 100
  const transportSubtotal = Math.round((timeFee
    + num(returnFee) + num(stairFee) + num(overtimeFee) + num(heavyFee)
    + num(highwayFee) + num(parkingFee) + num(suppliesFee) + num(fuelFee)
    - num(discountAmount)) * 100) / 100
  const subtotalAll = transportSubtotal + storageFee
  const gstAmount = paymentMethod === 'transfer'
    ? Math.round(subtotalAll * 0.1 * 100) / 100
    : 0
  // 师傅手填的定金金额（可改成 0 表示没收定金）
  const depositSub = Math.max(0, num(depositAmount))
  const finalAmount = Math.round((subtotalAll + gstAmount - depositSub) * 100) / 100

  async function handleSubmit() {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await completeStorageOrder(id, {
        billedHours:    billedNum,
        timeFee,
        hourlyRate,
        returnFee:      num(returnFee),
        stairFee:       num(stairFee),
        overtimeFee:    num(overtimeFee),
        heavyFee:       num(heavyFee),
        highwayFee:     num(highwayFee),
        parkingFee:     num(parkingFee),
        suppliesFee:    num(suppliesFee),
        fuelFee:        num(fuelFee),
        discountAmount: num(discountAmount),
        gst:            gstAmount,
        paymentMethod,
        deposit:        depositSub,
        finalAmount,
        // 旧字段保留向后兼容，存运输小计
        movingFee:      transportSubtotal,
      })
    } catch (err) {
      setSubmitError(err.message || '提交失败，请重试')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-8">
      {/* Header */}
      <div className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #6b1414 0%, #9b1c1c 50%, #c0392b 100%)' }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10 bg-red-400" />
        <div className="relative max-w-2xl mx-auto px-5 pt-12 pb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/worker')} className="p-2 text-white/70 hover:text-white">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <p className="text-red-300 text-xs tracking-wide">📦 寄存服务</p>
              <h1 className="text-white text-xl font-bold">{order.customerName}</h1>
              <p className="text-red-300 text-xs mt-0.5">{order.id}</p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              isDone ? 'bg-green-100 text-green-700' : 'bg-white/20 text-white'
            }`}>
              {isDone ? '✅ 已入库' : order.status}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Order info */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900">{order.customerName}</p>
              {order.wechat && <p className="text-gray-400 text-xs mt-0.5">微信：{order.wechat}</p>}
            </div>
            <a href={`tel:${order.customerPhone}`}
              className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-xl text-sm font-semibold">
              <Phone size={14} /> {order.customerPhone}
            </a>
          </div>
          <div className="border-t border-gray-100 pt-2 space-y-1">
            <Row label="入库日期">{order.moveInDate}</Row>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-gray-500 text-sm">预计取件</span>
              <input
                type="date"
                value={order.moveOutDate || ''}
                onChange={e => updateStorageOrder(id, { moveOutDate: e.target.value })}
                className="text-sm font-medium text-gray-800 text-right bg-transparent border-b border-gray-200 focus:border-red-300 focus:outline-none"
              />
            </div>

            {/* 物资 — 现场可加，寄存费自动跟着 boxes/furniture 重算 */}
            <div className="border-t border-gray-100 pt-2 mt-1">
              <p className="text-xs text-gray-400 mb-1.5 font-semibold uppercase tracking-wide">物资</p>
              <CountInput
                label="纸箱"
                value={order.boxes || 0}
                onChange={n => updateStorageOrder(id, { boxes: n })}
              />
              <CountInput
                label="家具"
                value={order.furniture || 0}
                onChange={n => updateStorageOrder(id, { furniture: n })}
              />
              <p className="text-xs text-gray-400 mt-1">客户现场加件时直接改数字，寄存费会自动重算</p>
            </div>

            {order.items && <Row label="物品描述">{order.items}</Row>}
            {order.location && <Row label="仓位">{order.location}</Row>}
            {order.notes && <p className="text-xs text-gray-400 pt-1">{order.notes}</p>}
          </div>
        </div>

        {isDone ? (
          /* Completed view */
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} className="text-green-500" />
              <p className="text-green-700 font-bold">入库完成</p>
            </div>
            <div className="space-y-1 text-sm">
              {order.billedHours != null && <Row label="工时">{order.billedHours} 小时</Row>}
              {order.timeFee != null && <Row label="工时费">${Number(order.timeFee).toFixed(2)}</Row>}
              <Row label="运输小计">${Number(order.movingFee || 0).toFixed(2)}</Row>
              <Row label="寄存费">${storageFee}</Row>
              {Number(order.gst) > 0 && <Row label="GST">${Number(order.gst).toFixed(2)}</Row>}
              <div className="border-t border-green-200 pt-1 flex justify-between">
                <span className="text-green-700 font-semibold">客户应付</span>
                <span className="text-green-700 font-bold">${Number(order.finalAmount ?? (Number(order.movingFee || 0) + storageFee)).toFixed(2)}</span>
              </div>
            </div>
            {photos.length > 0 && (
              <div className="flex gap-2 flex-wrap pt-1">
                {photos.map((src, i) => (
                  <img key={i} src={src} alt={`照片${i+1}`}
                    className="w-20 h-20 rounded-xl object-cover cursor-pointer"
                    onClick={() => setLightbox(src)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Step-by-step workflow */}
            {STEPS.map((step, idx) => {
              const done = currentStepIdx >= idx
              const isActive = idx === 0 ? currentStepIdx === -1 : currentStepIdx === idx - 1
              return (
                <div key={step.key}
                  className={`bg-white rounded-xl shadow-sm p-4 border-2 transition-colors ${
                    done ? 'border-green-300' : isActive ? 'border-red-300' : 'border-transparent'
                  }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        done ? 'bg-green-500 text-white' : isActive ? 'text-white' : 'bg-gray-100 text-gray-400'
                      }`} style={isActive && !done ? { background: '#c0392b' } : {}}>
                        {done ? '✓' : idx + 1}
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${
                          done ? 'text-green-700' : isActive ? 'text-gray-900' : 'text-gray-400'
                        }`}>{step.label}</p>
                        <p className="text-xs text-gray-400">{step.desc}</p>
                        {step.key === 'arrived' && done && order.arrivedAt && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {dayjs(order.arrivedAt).format('HH:mm')} 到达
                          </p>
                        )}
                      </div>
                    </div>
                    {isActive && !done && (
                      <button onClick={() => advanceStep(step.key)}
                        className="px-4 py-2 rounded-xl text-white text-sm font-semibold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
                        确认
                      </button>
                    )}
                    {done && <CheckCircle size={18} className="text-green-500 flex-shrink-0" />}
                  </div>
                </div>
              )
            })}

            {/* Upload section — unlocks after step 4 (stored) */}
            {currentStepIdx >= 2 && (
              <>
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">入库凭证</h3>
                    <p className="text-xs text-gray-400 mt-0.5">需要3张照片（位置、订单号、物品数量）+ 1个视频</p>
                  </div>
                  <div className="px-4 py-3 space-y-4">
                    {/* Photos */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500 font-medium">照片 {photos.length}/3</p>
                        {photos.length < 3 && (
                          <button onClick={() => photoInputRef.current?.click()}
                            className="text-xs text-red-600 font-semibold flex items-center gap-1">
                            <Camera size={12} /> 拍照
                          </button>
                        )}
                      </div>
                      <input ref={photoInputRef} type="file" accept="image/*" multiple capture="environment"
                        className="hidden" onChange={handleAddPhoto} />
                      {photos.length > 0 ? (
                        <div className="flex gap-2 flex-wrap">
                          {photos.map((src, i) => (
                            <div key={i} className="relative flex-shrink-0">
                              <img src={src} alt={`照片${i+1}`}
                                className="w-24 h-24 rounded-xl object-cover cursor-pointer active:opacity-80"
                                onClick={() => setLightbox(src)} />
                              <button onClick={() => handleRemovePhoto(i)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow-sm">
                                ×
                              </button>
                            </div>
                          ))}
                          {photos.length < 3 && (
                            <button onClick={() => photoInputRef.current?.click()}
                              className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-300 flex-shrink-0">
                              <Camera size={20} />
                              <span className="text-xs">添加</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button onClick={() => photoInputRef.current?.click()}
                          className="w-full py-5 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-gray-400">
                          <Camera size={18} />
                          <span className="text-sm">拍摄3张入库照片</span>
                        </button>
                      )}
                    </div>

                    {/* Video */}
                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500 font-medium">视频（最多10分钟）</p>
                        {videoUrl && (
                          <button onClick={handleRemoveVideo} className="text-xs text-red-500">删除</button>
                        )}
                      </div>
                      <input ref={videoInputRef} type="file" accept="video/*" capture="environment"
                        className="hidden" onChange={handleAddVideo} />
                      {videoLoading ? (
                        <div className="py-6 text-center text-gray-400 text-sm">加载中...</div>
                      ) : videoUrl ? (
                        <video src={videoUrl} controls className="w-full rounded-xl max-h-56 bg-black" />
                      ) : (
                        <button onClick={() => videoInputRef.current?.click()}
                          className="w-full py-5 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-gray-400">
                          <Video size={18} />
                          <span className="text-sm">录制入库视频</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fee + submit */}
                <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                  <h3 className="font-semibold text-gray-800">费用结算</h3>

                  {/* 运输部分 */}
                  <div className="space-y-2 pb-3 border-b border-gray-100">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">运输部分</p>
                    <Row label="到达时间">
                      {order.arrivedAt ? dayjs(order.arrivedAt).format('HH:mm') : '—'}
                    </Row>
                    <FeeInput label="工时（小时）" value={billed} onChange={setBilled} step="0.5" unit="h" />
                    <Row label="时薪">${hourlyRate}/小时</Row>
                    <Row label="工时费">${timeFee.toFixed(2)}</Row>

                    <FeeInput label="返程费"     value={returnFee}      onChange={setReturnFee} />
                    <FeeInput label="楼梯费"     value={stairFee}       onChange={setStairFee} />
                    <FeeInput label="超时费"     value={overtimeFee}    onChange={setOvertimeFee} />
                    <FeeInput label="重物费"     value={heavyFee}       onChange={setHeavyFee} />
                    <FeeInput label="高速费"     value={highwayFee}     onChange={setHighwayFee} />
                    <FeeInput label="停车违规费" value={parkingFee}     onChange={setParkingFee} />
                    <FeeInput label="物资费"     value={suppliesFee}    onChange={setSuppliesFee} />
                    <FeeInput label="油费"       value={fuelFee}        onChange={setFuelFee} />
                    <FeeInput label="折扣（减）" value={discountAmount} onChange={setDiscountAmount} />

                    <div className="flex justify-between text-sm pt-1.5 border-t border-gray-100">
                      <span className="text-gray-600 font-medium">运输小计</span>
                      <span className="text-gray-900 font-semibold">${transportSubtotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* 寄存部分 */}
                  <div className="space-y-1 pb-3 border-b border-gray-100">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">寄存部分（只读）</p>
                    <p className="text-xs text-gray-400">
                      {order.boxes} 箱 × ${boxRate}/周
                      {order.furniture > 0 && ` + ${order.furniture} 家具 × $${furRate}/周`}
                      {' '}× {weeks} 周
                    </p>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">寄存费</span>
                      <span className="text-gray-900 font-semibold">${storageFee}</span>
                    </div>
                  </div>

                  {/* 已收定金 — 师傅手填，没收就填 0 */}
                  <div className="pt-2 border-t border-gray-100">
                    <FeeInput label="已收定金" value={depositAmount} onChange={setDepositAmount} />
                    <p className="text-xs text-gray-400 mt-1">客户已付定金的填实际金额，没付填 0</p>
                  </div>

                  {/* 支付方式 */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">支付方式</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPaymentMethod('cash')}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                          paymentMethod === 'cash'
                            ? 'bg-green-500 text-white border-green-500'
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}>
                        💵 现金
                      </button>
                      <button
                        onClick={() => setPaymentMethod('transfer')}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                          paymentMethod === 'transfer'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}>
                        🏦 转账 +10% GST
                      </button>
                    </div>
                  </div>

                  {/* 汇总 */}
                  <div className="bg-amber-50 rounded-xl p-3 space-y-1 text-sm border border-amber-100">
                    <Row label="运输小计">${transportSubtotal.toFixed(2)}</Row>
                    <Row label="寄存费">${storageFee}</Row>
                    {gstAmount > 0 && <Row label="GST (转账)">${gstAmount.toFixed(2)}</Row>}
                    {depositSub > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>减定金</span><span>-${depositSub.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-amber-200 pt-1.5 flex justify-between font-bold">
                      <span className="text-gray-800">📥 客户应付</span>
                      <span className="text-green-600 text-lg">${finalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {submitError && (
                    <p className="text-red-500 text-xs text-center">{submitError}</p>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit || submitting}
                    className={`w-full py-4 rounded-xl font-bold text-base transition-all ${
                      (canSubmit && !submitting) ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    style={(canSubmit && !submitting) ? { background: 'linear-gradient(135deg, #166534, #16a34a)' } : {}}>
                    {submitting
                      ? '提交中…'
                      : canSubmit
                        ? '✅ 提交账单'
                        : `还需上传 ${3 - photos.length > 0 ? `${3 - photos.length}张照片` : ''}${(!videoUrl && !order.hasVideo) ? (photos.length < 3 ? ' + 视频' : '视频') : ''}`}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="text-gray-800 text-sm font-medium">{children}</span>
    </div>
  )
}

function CountInput({ label, value, onChange }) {
  const num = Number(value) || 0
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-gray-500 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, num - 1))}
          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm flex items-center justify-center"
        >−</button>
        <input
          type="number"
          min="0"
          value={num}
          onChange={e => onChange(Number(e.target.value) || 0)}
          className="w-14 px-2 py-1 border border-gray-200 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-200"
        />
        <button
          onClick={() => onChange(num + 1)}
          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm flex items-center justify-center"
        >+</button>
        <span className="text-gray-400 text-xs ml-1">件</span>
      </div>
    </div>
  )
}

function FeeInput({ label, value, onChange, step, unit }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 text-sm">{label}</span>
      <div className="flex items-center gap-1">
        {!unit && <span className="text-gray-400 text-sm">$</span>}
        <input
          type="number"
          step={step || 1}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-200"
        />
        {unit && <span className="text-gray-400 text-xs">{unit}</span>}
      </div>
    </div>
  )
}
