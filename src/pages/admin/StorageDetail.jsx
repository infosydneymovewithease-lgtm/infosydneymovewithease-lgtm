import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { ArrowLeft, Phone, AlertTriangle, CheckCircle, Edit3, Camera, Video, X, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import { useState, useRef, useEffect } from 'react'
import { saveVideo, getVideo, deleteVideo } from '../../utils/mediaDB'

function getStorageStatus(order) {
  if (order.status === '待确认') return { label: '待确认', color: 'bg-yellow-100 text-yellow-700' }
  if (order.status === '已确认') return { label: '已确认', color: 'bg-blue-100 text-blue-700' }
  if (order.status === '已派单') return { label: '已派单', color: 'bg-purple-100 text-purple-700' }
  if (order.actualMoveOutDate) return { label: '已完成', color: 'bg-gray-100 text-gray-500' }
  const daysLeft = dayjs(order.moveOutDate).diff(dayjs(), 'day')
  if (daysLeft < 0)  return { label: '已逾期', color: 'bg-red-100 text-red-600', daysLeft }
  if (daysLeft <= 7) return { label: `${daysLeft}天后到期`, color: 'bg-amber-100 text-amber-700', daysLeft }
  return { label: '寄存中', color: 'bg-green-100 text-green-700', daysLeft }
}

export default function StorageDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { storageOrders, updateStorageOrder, deleteOrder, staff, user } = useApp()

  const order = storageOrders.find(o => o.id === id)
  const [editPayment, setEditPayment] = useState(false)
  const [editExtend, setEditExtend] = useState(false)
  const [newMoveOut, setNewMoveOut] = useState('')
  const [showDispatch, setShowDispatch] = useState(false)
  const [selectedWorkers, setSelectedWorkers] = useState([])
  const [showEdit, setShowEdit] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [showEditBill, setShowEditBill] = useState(false)

  const [checks, setChecks] = useState(() => order?.confirmChecks || {})
  const [csNote, setCsNote] = useState(() => order?.csNote || '')
  const [photos, setPhotos] = useState(order.photos || [])
  const [videoUrl, setVideoUrl] = useState(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const photoInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const videoUrlRef = useRef(null)

  useEffect(() => {
    if (!order.hasVideo) return
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

  // Sync photos when worker uploads via their tab
  useEffect(() => {
    setPhotos(order?.photos || [])
  }, [order?.photos])

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
    if (file.size > 500 * 1024 * 1024) {
      alert('视频文件过大，请上传500MB以内的视频')
      e.target.value = ''
      return
    }
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

  if (!order) return (
    <div className="flex items-center justify-center h-64 text-gray-400">记录不存在</div>
  )

  const status = getStorageStatus(order)
  const days = dayjs(order.moveOutDate).diff(dayjs(order.moveInDate), 'day')
  const weeks = Math.max(1, Math.ceil(days / 7))
  const shortTerm = weeks <= 5
  const boxRate = shortTerm ? 5 : 3
  const furRate = shortTerm ? 10 : 7
  const weeklyFee = order.boxes * boxRate + order.furniture * furRate
  const totalFee = weeklyFee * weeks
  const isDone = !!order.actualMoveOutDate
  const isPending = order.status === '待确认'
  const isStoring = order.status === '寄存中' || (!['待确认','已确认','已派单'].includes(order.status) && !isDone)
  const canConfirm = !!(
    (checks.called || checks.wechat || checks.replied) &&
    checks.dateOk && checks.moveOutOk
  )
  const availableWorkers = staff.filter(s => s.role === 'worker' && s.active !== false)

  function toggleCheck(key) {
    const next = { ...checks, [key]: !checks[key] }
    setChecks(next)
    updateStorageOrder(id, { confirmChecks: next })
  }

  function saveCsNote(note) {
    setCsNote(note)
    updateStorageOrder(id, { csNote: note })
  }

  function handleConfirmOrder() {
    updateStorageOrder(id, {
      status: '已确认',
      confirmedAt: new Date().toISOString(),
      confirmChecks: checks,
      csNote,
    })
  }

  function handleDispatch() {
    if (!selectedWorkers.length) return
    updateStorageOrder(id, {
      assignedTo: selectedWorkers[0],
      assignedWorkers: selectedWorkers,
      status: '已派单',
      dispatchedAt: new Date().toISOString(),
    })
    setShowDispatch(false)
    setSelectedWorkers([])
  }

  function handleExtend() {
    if (!newMoveOut) return
    updateStorageOrder(id, { moveOutDate: newMoveOut })
    setEditExtend(false)
  }

  return (
    <div className="p-5 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{order.customerName}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${status.color}`}>{status.label}</span>
          </div>
          <p className="text-gray-400 text-xs mt-0.5">{order.id}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowEdit(true)}
            className="px-2.5 py-1.5 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg flex items-center gap-1 font-medium"
            title="编辑订单"
          >
            <Edit3 size={12} /> 编辑
          </button>
          {order.status !== '已取消' && (
            <button
              onClick={() => setShowCancel(true)}
              className="px-2.5 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center gap-1 font-medium"
              title="取消订单"
            >
              <X size={12} /> 取消
            </button>
          )}
        </div>
      </div>

      {/* 账单已修改横幅 */}
      {order.editedAt && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <Edit3 size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="text-amber-800">
              <span className="font-semibold">此账单已被修改</span>
              <span className="text-amber-700">
                {' · '}{new Date(order.editedAt).toLocaleString('zh-CN', { hour12: false })}
                {order.editedBy ? ` · ${order.editedBy}` : ''}
              </span>
            </p>
            {order.editReason && (
              <p className="text-amber-700 text-xs mt-0.5">原因：{order.editReason}</p>
            )}
          </div>
        </div>
      )}

      {/* Alerts */}
      {!isDone && status.daysLeft < 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          <span className="text-red-700 text-sm">已逾期 <strong>{Math.abs(status.daysLeft)}</strong> 天，请联系客户安排取件或续期</span>
        </div>
      )}
      {!isDone && status.daysLeft >= 0 && status.daysLeft <= 7 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <span className="text-amber-700 text-sm">还有 <strong>{status.daysLeft}</strong> 天到期，请提前联系客户</span>
        </div>
      )}

      {/* Customer */}
      <Card title="客户信息">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-900 font-semibold">{order.customerName}</p>
            {order.wechat && <p className="text-gray-400 text-sm mt-0.5">微信：{order.wechat}</p>}
          </div>
          <a href={`tel:${order.customerPhone}`}
            className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-xl text-sm font-semibold">
            <Phone size={14} /> {order.customerPhone}
          </a>
        </div>
      </Card>

      {/* Storage info */}
      <Card title="寄存详情">
        <Row label="入库日期">{order.moveInDate}</Row>
        <Row label="预计取件">{order.moveOutDate}</Row>
        {order.actualMoveOutDate && <Row label="实际取件"><span className="text-green-600 font-semibold">{order.actualMoveOutDate}</span></Row>}
        <Row label="寄存期">{weeks} 周{shortTerm ? '（短期）' : '（长期）'}</Row>
        {order.location && <Row label="仓位">{order.location}</Row>}
        <div className="border-t border-gray-100 pt-2 mt-1">
          <Row label="纸箱">{order.boxes} 件 × ${boxRate}/周</Row>
          {order.furniture > 0 && <Row label="家具">{order.furniture} 件 × ${furRate}/周</Row>}
          {order.items && <Row label="物品描述"><span className="text-gray-600 text-sm">{order.items}</span></Row>}
        </div>
      </Card>

      {/* Requested materials */}
      {order.requestedMaterials && (order.requestedMaterials.boxes > 0 || order.requestedMaterials.wrapItems > 0) && (
        <Card title="客户物资需求">
          {order.requestedMaterials.boxes > 0 && (
            <Row label="纸箱">{order.requestedMaterials.boxes} 个</Row>
          )}
          {order.requestedMaterials.wrapItems > 0 && (
            <Row label="胶带 / 打包膜">{order.requestedMaterials.wrapItems} 卷</Row>
          )}
        </Card>
      )}

      {/* Fees — 分「运输部分」和「寄存部分」两块 */}
      <Card title="费用">
        {/* 运输部分（师傅交单后显示） */}
        {order.billedHours != null && (
          <>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">运输部分</p>
            <Row label={`工时费 (${order.billedHours}h × $${order.hourlyRate || 0})`}>
              ${Number(order.timeFee || 0).toFixed(2)}
            </Row>
            {Number(order.returnFee)   > 0 && <Row label="返程费">${Number(order.returnFee).toFixed(2)}</Row>}
            {Number(order.stairFee)    > 0 && <Row label="楼梯费">${Number(order.stairFee).toFixed(2)}</Row>}
            {Number(order.overtimeFee) > 0 && <Row label="超时费">${Number(order.overtimeFee).toFixed(2)}</Row>}
            {Number(order.heavyFee)    > 0 && <Row label="重物费">${Number(order.heavyFee).toFixed(2)}</Row>}
            {Number(order.highwayFee)  > 0 && <Row label="高速费">${Number(order.highwayFee).toFixed(2)}</Row>}
            {Number(order.parkingFee)  > 0 && <Row label="停车违规费">${Number(order.parkingFee).toFixed(2)}</Row>}
            {Number(order.suppliesFee) > 0 && <Row label="物资费">${Number(order.suppliesFee).toFixed(2)}</Row>}
            {Number(order.fuelFee)     > 0 && <Row label="油费">${Number(order.fuelFee).toFixed(2)}</Row>}
            {Number(order.discountAmount) > 0 && (
              <Row label="折扣"><span className="text-orange-600">-${Number(order.discountAmount).toFixed(2)}</span></Row>
            )}
            <Row label="运输小计">
              <span className="font-semibold">${Number(order.movingFee || 0).toFixed(2)}</span>
            </Row>
            <div className="border-t border-gray-100 my-2"></div>
          </>
        )}

        {/* 寄存部分 */}
        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">寄存部分</p>
        <Row label="周费">${weeklyFee}/周</Row>
        <Row label="寄存期">× {weeks} 周</Row>
        <Row label="寄存费"><span className="font-semibold">${totalFee}</span></Row>

        {/* GST + 合计 */}
        {Number(order.gst) > 0 && (
          <>
            <div className="border-t border-gray-100 my-2"></div>
            <Row label="GST (转账 +10%)">${Number(order.gst).toFixed(2)}</Row>
          </>
        )}
        <div className="border-t border-gray-100 pt-2 mt-1 flex justify-between items-center">
          <span className="text-gray-700 font-semibold">
            {order.finalAmount != null ? '客户应付' : '合计'}
          </span>
          <span className="text-green-600 font-bold text-xl">
            ${Number(order.finalAmount ?? totalFee).toFixed(2)}
          </span>
        </div>

        {/* 编辑账单按钮（已派单后才显示，方便客服改师傅忘记的工时/费用） */}
        {order.status !== '已取消' && order.assignedTo && (
          <button
            onClick={() => setShowEditBill(true)}
            className="mt-2 w-full text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg py-2 font-medium flex items-center justify-center gap-1.5"
          >
            <Edit3 size={12} />
            编辑账单（工时/费用）
          </button>
        )}

        {order.deposit > 0 && <Row label="已付定金"><span className="text-green-600">${order.deposit}</span></Row>}
        <div className="flex items-center justify-between py-1">
          <span className="text-gray-500 text-sm">付款状态</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${
              order.paymentStatus === '已付' ? 'text-green-600' :
              (order.paymentStatus === '定金' || (!order.paymentStatus && order.depositStatus === '已上传截图')) ? 'text-amber-600' : 'text-red-500'
            }`}>
              {order.paymentStatus === '已付' ? '✅ 已付清' :
               (order.paymentStatus === '定金' || (!order.paymentStatus && order.depositStatus === '已上传截图')) ? '⏳ 仅付定金' : '❌ 未付款'}
            </span>
            <button onClick={() => setEditPayment(true)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
              <Edit3 size={11} /> 修改
            </button>
          </div>
        </div>
        {order.notes && (
          <div className="mt-1 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">{order.notes}</div>
        )}
      </Card>

      {/* 定金凭证 */}
      {(order.depositStatus || order.depositScreenshot) && (
        <Card title="定金凭证">
          {order.depositStatus && (
            <div className="flex items-center justify-between py-0.5">
              <span className="text-gray-500 text-sm">截图状态</span>
              <span className={`text-sm font-semibold ${
                order.depositStatus === '已上传截图' ? 'text-green-600' : 'text-orange-500'
              }`}>
                {order.depositStatus === '已上传截图' ? '✅ 已上传' : order.depositStatus}
              </span>
            </div>
          )}
          {order.depositScreenshot && (
            <div className="pt-1">
              {typeof order.depositScreenshot === 'object' && (order.depositScreenshot.url || order.depositScreenshot.data) ? (
                <img
                  src={order.depositScreenshot.url || order.depositScreenshot.data}
                  alt="定金截图"
                  className="w-full max-w-xs rounded-xl border border-gray-200"
                />
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-green-600">
                  <CheckCircle size={11} />
                  截图已上传：{typeof order.depositScreenshot === 'string' ? order.depositScreenshot : order.depositScreenshot?.name}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* 入库凭证 */}
      <Card title="入库凭证">
        <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={handleAddPhoto} />
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
          onChange={handleAddVideo} />

        {/* Photos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">照片（{photos.length}/3）</span>
            {photos.length < 3 && (
              <button onClick={() => photoInputRef.current?.click()}
                className="text-xs text-red-600 font-semibold flex items-center gap-1 hover:text-red-800">
                <Camera size={12} /> 添加照片
              </button>
            )}
          </div>
          {photos.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {photos.map((src, i) => (
                <div key={i} className="relative flex-shrink-0">
                  <img src={src} alt={`照片${i + 1}`}
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
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-300 hover:border-red-200 hover:text-red-300 transition-colors flex-shrink-0">
                  <Camera size={20} />
                  <span className="text-xs">添加</span>
                </button>
              )}
            </div>
          ) : (
            <button onClick={() => photoInputRef.current?.click()}
              className="w-full py-5 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-gray-400 hover:border-red-200 hover:text-red-400 transition-colors">
              <Camera size={18} />
              <span className="text-sm">上传入库照片</span>
            </button>
          )}
        </div>

        {/* Video */}
        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">视频（最多1个）</span>
            {videoUrl && (
              <button onClick={handleRemoveVideo}
                className="text-xs text-red-500 hover:text-red-700">
                删除视频
              </button>
            )}
          </div>
          {videoLoading ? (
            <div className="w-full py-6 flex items-center justify-center text-gray-400 text-sm">
              加载中...
            </div>
          ) : videoUrl ? (
            <video src={videoUrl} controls
              className="w-full rounded-xl max-h-56 bg-black" />
          ) : (
            <button onClick={() => videoInputRef.current?.click()}
              className="w-full py-5 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-gray-400 hover:border-red-200 hover:text-red-400 transition-colors">
              <Video size={18} />
              <span className="text-sm">上传入库视频</span>
            </button>
          )}
        </div>
      </Card>

      {/* CS Confirmation — only for pending orders */}
      {isPending && <>
        <Card title="联系确认 *必填">
          <p className="text-xs text-gray-400 mb-2">至少完成一种联系方式</p>
          {[
            { key: 'called',  label: '已拨打电话' },
            { key: 'wechat',  label: '已加微信' },
            { key: 'replied', label: '已回复客户' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 py-1.5 cursor-pointer">
              <div onClick={() => toggleCheck(key)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  checks[key] ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}>
                {checks[key] && <span className="text-white text-xs font-bold">✓</span>}
              </div>
              <span className="text-gray-700 text-sm">{label}</span>
            </label>
          ))}
        </Card>

        <Card title="信息核实 *必填">
          {[
            { key: 'dateOk',    label: '入库日期已确认' },
            { key: 'moveOutOk', label: '预计取件日期已确认' },
            { key: 'itemsOk',   label: '物品描述已确认' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 py-1.5 cursor-pointer">
              <div onClick={() => toggleCheck(key)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  checks[key] ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}>
                {checks[key] && <span className="text-white text-xs font-bold">✓</span>}
              </div>
              <span className="text-gray-700 text-sm">{label}</span>
            </label>
          ))}
        </Card>

        <Card title="客服内部备注">
          <textarea
            value={csNote}
            onChange={e => setCsNote(e.target.value)}
            onBlur={e => saveCsNote(e.target.value)}
            rows={3}
            placeholder="内部备注，不对客户显示..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
          />
        </Card>

        <button
          onClick={handleConfirmOrder}
          disabled={!canConfirm}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
            canConfirm
              ? 'text-white shadow-sm'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          style={canConfirm ? { background: 'linear-gradient(135deg, #166534, #16a34a)' } : {}}>
          {canConfirm ? '✅ 确认订单' : '请先完成联系确认和信息核实'}
        </button>
      </>}

      {/* Dispatch — show whenever order isn't done and has no worker yet */}
      {!order.assignedTo && !isDone && (
        <button
          onClick={() => setShowDispatch(true)}
          className="w-full py-3.5 rounded-xl text-white font-semibold text-sm shadow-sm"
          style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
          👷 派单给师傅
        </button>
      )}

      {order.assignedTo && !isDone && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-purple-700 text-sm font-semibold mb-0.5">已派单</p>
            <p className="text-purple-600 text-xs">
              {(order.assignedWorkers || [order.assignedTo]).map(wid =>
                staff.find(s => s.id === wid)?.name || wid
              ).join('、')}
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedWorkers(order.assignedWorkers || (order.assignedTo ? [order.assignedTo] : []))
              setShowDispatch(true)
            }}
            className="text-xs text-purple-700 bg-white border border-purple-200 px-2.5 py-1.5 rounded-lg hover:bg-purple-50 flex-shrink-0 font-medium">
            🔄 改派
          </button>
        </div>
      )}

      {/* Extend — only while items are in storage */}
      {isStoring && (
        <button onClick={() => setEditExtend(true)}
          className="w-full py-3.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50">
          📅 延长期限
        </button>
      )}

      {isDone && (
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3">
          <CheckCircle size={18} className="text-green-500" />
          <span className="text-gray-600 text-sm">已于 <strong>{order.actualMoveOutDate}</strong> 完成</span>
        </div>
      )}

      {/* Extend modal */}
      {editExtend && (
        <Modal title="延长寄存期限" onClose={() => setEditExtend(false)}>
          <p className="text-gray-500 text-sm mb-3">当前到期日：<strong>{order.moveOutDate}</strong></p>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">新到期日期</label>
          <input type="date" value={newMoveOut} onChange={e => setNewMoveOut(e.target.value)} min={order.moveOutDate}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-200" />
          <button onClick={handleExtend} disabled={!newMoveOut}
            className="w-full py-3 rounded-xl text-white font-semibold disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
            确认延期
          </button>
        </Modal>
      )}

      {/* Payment modal */}
      {editPayment && (
        <Modal title="修改付款状态" onClose={() => setEditPayment(false)}>
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: '已付',  label: '✅ 已付清' },
              { val: '定金',  label: '⏳ 仅付定金' },
              { val: '未付',  label: '❌ 未付款' },
            ].map(opt => (
              <button key={opt.val}
                onClick={() => { updateStorageOrder(id, { paymentStatus: opt.val }); setEditPayment(false) }}
                className={`py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                  order.paymentStatus === opt.val ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Photo lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}

      {/* Dispatch modal */}
      {showDispatch && (
        <Modal title="派单给师傅" onClose={() => { setShowDispatch(false); setSelectedWorkers([]) }}>
          <p className="text-gray-500 text-sm mb-3">选择负责本次取货的师傅（可多选）</p>
          <div className="space-y-2 mb-4">
            {availableWorkers.map(w => {
              const selected = selectedWorkers.includes(w.id)
              return (
                <button key={w.id}
                  onClick={() => setSelectedWorkers(prev =>
                    selected ? prev.filter(id => id !== w.id) : [...prev, w.id]
                  )}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-colors ${
                    selected ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <span className="font-semibold text-gray-800">{w.name}</span>
                  {selected && <span className="text-red-500 text-sm font-bold">✓</span>}
                </button>
              )
            })}
          </div>
          <button onClick={handleDispatch} disabled={!selectedWorkers.length}
            className="w-full py-3 rounded-xl text-white font-semibold disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
            确认派单
          </button>
        </Modal>
      )}

      {/* Edit */}
      {showEdit && (
        <EditStorageModal
          order={order}
          onClose={() => setShowEdit(false)}
          onSave={(updates) => {
            updateStorageOrder(id, updates)
            setShowEdit(false)
          }}
        />
      )}

      {/* Edit Bill — 编辑运输部分账单 */}
      {showEditBill && (
        <EditStorageBillModal
          order={order}
          storageFee={totalFee}
          onClose={() => setShowEditBill(false)}
          onSave={(updates, reason) => {
            updateStorageOrder(id, {
              ...updates,
              editedAt: new Date().toISOString(),
              editedBy: user?.name || user?.role || '客服',
              editReason: reason,
            })
            setShowEditBill(false)
          }}
        />
      )}

      {/* Cancel */}
      {showCancel && (
        <CancelStorageModal
          order={order}
          onClose={() => setShowCancel(false)}
          onConfirm={(reason, hardDelete) => {
            if (hardDelete) {
              deleteOrder(id)
              navigate('/admin/orders')
            } else {
              updateStorageOrder(id, { status: '已取消', csNote: reason ? `[取消] ${reason}` : order.csNote })
              setShowCancel(false)
            }
          }}
        />
      )}
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {title && <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</h3>
      </div>}
      <div className="px-4 py-3 space-y-2">{children}</div>
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

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

const EDIT_STORAGE_FIELDS = [
  { key: 'customerName',  label: '客户姓名', type: 'text' },
  { key: 'customerPhone', label: '电话',     type: 'text' },
  { key: 'wechat',        label: '微信',     type: 'text' },
  { key: 'moveInDate',    label: '入库日期', type: 'date' },
  { key: 'moveOutDate',   label: '预计取件', type: 'date' },
  { key: 'boxes',         label: '纸箱数',   type: 'number' },
  { key: 'furniture',     label: '家具数',   type: 'number' },
  { key: 'location',      label: '仓位编号', type: 'text' },
  { key: 'notes',         label: '备注',     type: 'textarea' },
]

function EditStorageModal({ order, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(EDIT_STORAGE_FIELDS.map(f => [f.key, order[f.key] ?? '']))
  )

  function handleSave() {
    const updates = {}
    for (const f of EDIT_STORAGE_FIELDS) {
      const v = form[f.key]
      updates[f.key] = f.type === 'number' ? (Number(v) || 0) : v
    }
    onSave(updates)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-bold text-gray-900">编辑寄存订单</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">
          {EDIT_STORAGE_FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              ) : (
                <input
                  type={f.type}
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200">
            取消
          </button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600">
            保存修改
          </button>
        </div>
      </div>
    </div>
  )
}

function CancelStorageModal({ order, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [hardDelete, setHardDelete] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">取消寄存订单</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-600">
            确认取消「<span className="font-semibold text-gray-900">{order.customerName}</span>」的寄存订单？
          </p>

          <div>
            <label className="block text-xs text-gray-500 mb-1">取消原因（可选）</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="例如：误建、客户取消、重复单…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hardDelete}
              onChange={e => setHardDelete(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-gray-700">
              <span className="font-semibold text-red-600">彻底删除</span>（不可恢复）
              <span className="block text-gray-400 mt-0.5">默认仅标记为「已取消」，可在取消历史里找回。误建测试单建议勾选此项。</span>
            </span>
          </label>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200">
            返回
          </button>
          <button
            onClick={() => onConfirm(reason.trim(), hardDelete)}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold ${
              hardDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {hardDelete ? '彻底删除' : '确认取消'}
          </button>
        </div>
      </div>
    </div>
  )
}

const BILL_REASON_PRESETS = ['师傅忘点开始', '师傅忘点结束', '价格算错', '其他']

const BILL_EDIT_FIELDS = [
  { key: 'billedHours',    label: '工时（小时）', step: 0.5 },
  { key: 'returnFee',      label: '返程费' },
  { key: 'stairFee',       label: '楼梯费' },
  { key: 'overtimeFee',    label: '超时费' },
  { key: 'heavyFee',       label: '重物费' },
  { key: 'highwayFee',     label: '高速费' },
  { key: 'parkingFee',     label: '停车违规费' },
  { key: 'suppliesFee',    label: '物资费' },
  { key: 'fuelFee',        label: '油费' },
  { key: 'discountAmount', label: '折扣（减）' },
]

function EditStorageBillModal({ order, storageFee, onClose, onSave }) {
  const initial = Object.fromEntries(
    BILL_EDIT_FIELDS.map(f => [f.key, String(order[f.key] ?? 0)])
  )
  const [form, setForm] = useState(initial)
  const [reason, setReason] = useState('')
  const [reasonPreset, setReasonPreset] = useState('')

  const num = k => Number(form[k]) || 0
  const hourlyRate = Number(order.hourlyRate) || 0
  const timeFee = Math.round(num('billedHours') * hourlyRate * 100) / 100
  const transportSubtotal = Math.round((timeFee
    + num('returnFee') + num('stairFee') + num('overtimeFee') + num('heavyFee')
    + num('highwayFee') + num('parkingFee') + num('suppliesFee') + num('fuelFee')
    - num('discountAmount')) * 100) / 100
  const subtotalAll = transportSubtotal + (Number(storageFee) || 0)
  const gst = order.paymentMethod === 'transfer'
    ? Math.round(subtotalAll * 0.1 * 100) / 100
    : 0
  const depositSub = order.depositPaid ? (Number(order.deposit) || 0) : 0
  const finalAmount = Math.round((subtotalAll + gst - depositSub) * 100) / 100

  const finalReason = reasonPreset === '其他' ? reason.trim() : reasonPreset
  const canSave = !!finalReason

  function handleSave() {
    if (!canSave) return
    onSave({
      billedHours:    num('billedHours'),
      timeFee,
      returnFee:      num('returnFee'),
      stairFee:       num('stairFee'),
      overtimeFee:    num('overtimeFee'),
      heavyFee:       num('heavyFee'),
      highwayFee:     num('highwayFee'),
      parkingFee:     num('parkingFee'),
      suppliesFee:    num('suppliesFee'),
      fuelFee:        num('fuelFee'),
      discountAmount: num('discountAmount'),
      gst,
      movingFee:      transportSubtotal,
      finalAmount,
    }, finalReason)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-bold text-gray-900">编辑账单（运输部分）</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          <p className="text-xs text-gray-500 mb-3">
            只能改运输部分。寄存费按订单建立时锁定，不变。师傅工资按工时自动跟着调。
          </p>

          <div className="space-y-2">
            {BILL_EDIT_FIELDS.map(f => (
              <div key={f.key} className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-28 flex-shrink-0">{f.label}</label>
                <div className="flex-1 flex items-center gap-1">
                  {f.key !== 'billedHours' && <span className="text-gray-400 text-sm">$</span>}
                  <input
                    type="number"
                    step={f.step || 1}
                    value={form[f.key]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                  {f.key === 'billedHours' && <span className="text-gray-400 text-xs">小时</span>}
                </div>
              </div>
            ))}
          </div>

          {/* 重算预览 */}
          <div className="mt-4 rounded-xl bg-gray-50 p-3 border border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-2">重算预览</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>工时费 ({num('billedHours')} × ${hourlyRate})</span>
                <span>${timeFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span className="font-medium">运输小计</span>
                <span className="font-medium">${transportSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>寄存费</span>
                <span>${Number(storageFee).toFixed(2)}</span>
              </div>
              {gst > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>GST (转账 +10%)</span>
                  <span>${gst.toFixed(2)}</span>
                </div>
              )}
              {depositSub > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>减定金</span>
                  <span>-${depositSub.toFixed(2)}</span>
                </div>
              )}
              <div className="h-px bg-gray-300 my-1.5" />
              <div className="flex justify-between font-bold text-sm">
                <span className="text-gray-700">新客户应付</span>
                <span className="text-green-600">${finalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>原客户应付</span>
                <span>${Number(order.finalAmount || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 修改原因 */}
          <div className="mt-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              修改原因 <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {BILL_REASON_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => { setReasonPreset(p); if (p !== '其他') setReason('') }}
                  className={`text-sm py-2 rounded-lg border transition-colors ${
                    reasonPreset === p
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {reasonPreset === '其他' && (
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="请说明具体原因…"
                rows={2}
                className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            保存修改
          </button>
        </div>
      </div>
    </div>
  )
}
