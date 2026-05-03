import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { ArrowLeft, Phone, Camera, Video, CheckCircle } from 'lucide-react'
import dayjs from 'dayjs'
import { useState, useRef, useEffect } from 'react'
import { saveVideo, getVideo, deleteVideo } from '../utils/mediaDB'

const STEPS = [
  { key: 'confirmed', label: '确认收单',     desc: '确认已收到本次寄存任务' },
  { key: 'arrived',   label: '到达取货地址', desc: '已到达客户地址，开始计时' },
  { key: 'loaded',    label: '装车出发',     desc: '物品已装车，前往仓库' },
  { key: 'stored',    label: '到达仓库入库', desc: '物品已搬入仓库，准备拍摄凭证' },
]
const STEP_ORDER = STEPS.map(s => s.key)

export default function WorkerStorageDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { storageOrders, updateStorageOrder } = useApp()

  const order = storageOrders.find(o => o.id === id)

  const [photos, setPhotos] = useState(() => order?.photos || [])
  const [videoUrl, setVideoUrl] = useState(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [movingFee, setMovingFee] = useState(() => order?.movingFee ?? '')
  const [lightbox, setLightbox] = useState(null)

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

  function handleSubmit() {
    updateStorageOrder(id, {
      status: '寄存中',
      workerStatus: 'done',
      movingFee: Number(movingFee) || 0,
      completedAt: new Date().toISOString(),
    })
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
            <Row label="预计取件">{order.moveOutDate}</Row>
            <Row label="纸箱">{order.boxes} 件</Row>
            {order.furniture > 0 && <Row label="家具">{order.furniture} 件</Row>}
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
            <div className="space-y-1">
              <Row label="搬运费">${order.movingFee || 0}</Row>
              <Row label="寄存费">${storageFee}</Row>
              <div className="border-t border-green-200 pt-1 flex justify-between">
                <span className="text-green-700 font-semibold">合计</span>
                <span className="text-green-700 font-bold">${(order.movingFee || 0) + storageFee}</span>
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
            {currentStepIdx >= 3 && (
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
                  <h3 className="font-semibold text-gray-800">费用结算（一次性收费）</h3>
                  <Row label="寄存费">${storageFee}</Row>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">搬运费</span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 text-sm">$</span>
                      <input
                        type="number"
                        value={movingFee}
                        onChange={e => setMovingFee(e.target.value)}
                        placeholder="0"
                        className="w-28 px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-200"
                      />
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                    <span className="font-semibold text-gray-700">合计</span>
                    <span className="text-green-600 font-bold text-xl">
                      ${storageFee + (Number(movingFee) || 0)}
                    </span>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`w-full py-4 rounded-xl font-bold text-base transition-all ${
                      canSubmit ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    style={canSubmit ? { background: 'linear-gradient(135deg, #166534, #16a34a)' } : {}}>
                    {canSubmit
                      ? '✅ 提交完成'
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
