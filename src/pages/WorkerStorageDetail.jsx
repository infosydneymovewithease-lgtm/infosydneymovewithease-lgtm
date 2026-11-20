import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { ArrowLeft, Phone, Camera, Video, CheckCircle } from 'lucide-react'
import dayjs from 'dayjs'
import { useState, useRef, useEffect } from 'react'
import { saveVideo, getVideo, deleteVideo } from '../utils/mediaDB'
import { VEHICLES, VAN_PROMO_DISCOUNT } from '../data/vehicles'
import { roundToHalfHour } from '../utils/pricing'
import { isDepositPaid } from '../utils/orderHelpers'
import { getStorageRates, FREE_SUPPLIES_LABEL, SUPPLIES_NOTICE } from '../data/storageRates'
import { printStorageLabels } from '../utils/printJobs'
import { uploadImage } from '../utils/upload'
import { humanError } from '../utils/netError'

const STEPS = [
  { key: 'confirmed', label: '确认收单',     desc: '确认已收到本次寄存任务' },
  { key: 'arrived',   label: '到达取货地址', desc: '已到达客户地址，开始计时' },
  { key: 'stored',    label: '到达仓库入库', desc: '物品已搬入仓库，准备拍摄凭证' },
]
const STEP_ORDER = STEPS.map(s => s.key)

// ⚠️ 2026-11-21 老板：「照片我觉得 2-3 张都可以」。
//    原来硬卡 3 张，现场光线不好、东西少的时候凑第三张纯属浪费时间。
//    下限降到 2，上限仍是 3（想多传一张照样可以）。
//    数字原来散在 6 个地方，抽成常量，免得下次又改漏一处。
const 照片下限 = 2
const 照片上限 = 3

export default function WorkerStorageDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { storageOrders, updateStorageOrder, updateStorageOrderAwait, completeStorageOrder, user } = useApp()

  const order = storageOrders.find(o => o.id === id)

  const [photos, setPhotos] = useState(() => order?.photos || [])
  // ⚠️ 周数输入框要存一份「正在打字」的草稿。
  //    老板 11-10：「最前这个 1 不能删除，会影响改成正确时间」。
  //    原来是 onChange 直接 Math.max(1, …||1) —— 一删到空就立刻变回 1，
  //    那个 1 永远删不掉，想输 9 只能变成 19。
  //    打字时原样显示（允许空），离开输入框才校正。
  const [weeksDraft, setWeeksDraft] = useState(null)   // null = 用库里的值
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoErr, setPhotoErr] = useState('')
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
  // ⚠️ 2026-11-21 老板：「后面的搬运费用核算我很不满意，尤其是没有返程费用这一块」。
  //    原来写的是 order?.returnFee ?? v.returnFee ?? 0。
  //    `??` 只在 null/undefined 时才往后找 —— 而 storage_orders."returnFee"
  //    的数据库默认值就是 **0**，不是 null。所以永远停在 0，
  //    车型自带的返程费（面包车 $60 / 小卡 $110）一次都没生效过。
  //    师傅打开看见 0，不会多想，就这么漏收了。
  //    实际漏收：QX2611076 和 QX2611012 两单返程费都是 $0。
  //
  //    判断改成「这单交过没有」：
  //      交过单 → 显示当时存的，哪怕是 0（师傅当时就是这么填的，不能替他改）
  //      没交过 → 0 视为「还没填」，用车型默认值兜底
  const [returnFee, setReturnFee] = useState(() => {
    const 存的 = Number(order?.returnFee) || 0
    if (order?.workerStatus === 'done') return String(存的)
    return String(存的 > 0 ? 存的 : (v.returnFee || 0))
  })
  const [stairFee,       setStairFee]       = useState(() => String(order?.stairFee ?? 0))
  const [overtimeFee,    setOvertimeFee]    = useState(() => String(order?.overtimeFee ?? 0))
  const [heavyFee,       setHeavyFee]       = useState(() => String(order?.heavyFee ?? 0))
  const [highwayFee,     setHighwayFee]     = useState(() => String(order?.highwayFee ?? 0))
  const [parkingFee,     setParkingFee]     = useState(() => String(order?.parkingFee ?? 0))
  const [suppliesFee,    setSuppliesFee]    = useState(() => String(order?.suppliesFee ?? 0))
  const [fuelFee,        setFuelFee]        = useState(() => String(order?.fuelFee ?? 0))
  const [discountAmount, setDiscountAmount] = useState(() => String(order?.discountAmount ?? 0))
  const [paymentMethod,  setPaymentMethod]  = useState(() => order?.paymentMethod ?? 'cash')

  // 定金默认值：order 里存了就用；没存但 isDepositPaid 判断已收的，按业务标准 $30 预填；都没有就 0
  const defaultDeposit = (() => {
    if (Number(order?.deposit) > 0) return String(order.deposit)
    return isDepositPaid(order) ? '30' : '0'
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
  // 按日期自动算出来的周数 —— 只是【默认值】
  const autoWeeks = Math.max(1, Math.ceil(days / 7))
  // ⚠️ 2026-11-10 老板：「寄存的时间被钉死，实际上这次客人付款 9 周的钱，
  //    不能改动就不正确」。QX2611012：入库 11-09 / 预计取件 2027-02-01
  //    = 12 周 = $624，但客人只付了 9 周。
  //    日期是「预计」，付了几周才是事实 —— 事实必须能覆盖预计。
  //    存进 order.weeks（这一列白名单里本来就有，一直没人写）。
  const weeks = Number(order.weeks) > 0 ? Number(order.weeks) : autoWeeks
  const weeksOverridden = Number(order.weeks) > 0 && Number(order.weeks) !== autoWeeks
  const { boxRate, furRate, shortTerm, freeSupplies } = getStorageRates(weeks)
  const storageFee = (order.boxes * boxRate + order.furniture * furRate) * weeks

  const workerStatus = order.workerStatus || null
  const currentStepIdx = workerStatus ? STEP_ORDER.indexOf(workerStatus) : -1
  const isDone = order.status === '寄存中'
  const canSubmit = photos.length >= 照片下限 && (videoUrl || order.hasVideo)

  // 打印状态：null / 'sending' / 提示文字
  const [printMsg, setPrintMsg] = useState(null)

  // ⚠️ 老板 11-18 定的触发时机：师傅点【到达仓库入库】那一刻自动打标签。
  //    为什么是这一刻 ——
  //      · 件数已经定了（客户现场加件时师傅已经改过数字）
  //      · 人就在仓库，打印机在旁边
  //      · 下一步正好要拍「订单号」那张照片，需要贴纸
  //    老板那天就是卡在这儿：没贴纸 → 拍不了 → 整单交不上去。
  async function 打标签(silent) {
    setPrintMsg('sending')
    // ⚠️ 同客服端：没有 try/catch 的话，抛异常就永远卡在「发送中」
    let r
    try { r = await printStorageLabels(id, user) }
    catch (e) { r = { ok: false, msg: `出错了：${e?.name || ''} ${e?.message || String(e)}`.trim() } }
    setPrintMsg(r?.ok ? `✅ ${r.msg}，去打印机拿` : `⚠️ ${r?.msg || '没有返回结果'}`)
    // ⚠️ 自动触发时失败【也要显示】。默默失败师傅不知道，走到拍照那步才发现没纸，
    //    那时候他可能已经离开打印机了。
    setTimeout(() => setPrintMsg(null), 8000)
  }

  // ⚠️ 2026-11-21 老板：「点击确认订单，但订单不会像搬运订单那样
  //    从未确认进入到进行中」。
  //
  //    原因：这里只写 workerStatus，【从来不碰 status】。
  //    而师傅端首页是按 status 分桶的（Home.jsx）：
  //      未确认 = 待确认 / 已派单     进行中 = 已确认     已完成 = 寄存中
  //    「已确认」全项目只有【客服后台】那个按钮会设，师傅点一百次也不动。
  //    结果寄存单从「未确认」直接跳到「已完成」，中间那一格永远是空的。
  //
  //    ⚠️ 只在「待确认 / 已派单」时才推进。别的状态一律不碰 ——
  //    已经「寄存中」的单如果被退回这一步，不能把它打回「已确认」。
  function advanceStep(stepKey) {
    const updates = { workerStatus: stepKey }
    if (stepKey === 'arrived') updates.arrivedAt = new Date().toISOString()
    if (stepKey === 'confirmed' && ['待确认', '已派单'].includes(order?.status)) {
      updates.status = '已确认'
      updates.confirmedAt = new Date().toISOString()
    }
    updateStorageOrder(id, updates)
    if (stepKey === 'stored') 打标签(true)
  }

  // ⚠️ 2026-11-10 改成产出【文件】而不是 base64 字符串。
  //    原来压缩完直接 toDataURL，整串 base64 塞进 storage_orders 行里 ——
  //    一张 200~400KB，三张就上兆，超过 Supabase realtime 的单条上限，
  //    推回来的记录被砍成壳，界面上刚拍的照片 1~2 秒后自己消失。
  async function compressToFile(file) {
    const dataUrl = await new Promise(resolve => {
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
        img.onerror = () => resolve(null)
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
    if (!dataUrl) return file          // 压不了就传原图，总比传不上去强
    const bin = atob(dataUrl.split(',')[1])
    const buf = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
    return new File([buf], `storage_${Date.now()}.jpg`, { type: 'image/jpeg' })
  }

  async function handleAddPhoto(e) {
    const files = Array.from(e.target.files).slice(0, 照片上限 - photos.length)
    e.target.value = ''
    if (!files.length) return
    setPhotoBusy(true); setPhotoErr('')
    try {
      const urls = []
      for (const f of files) {
        const small = await compressToFile(f)
        const r = await uploadImage(small, 'deposit-screenshots')
        // uploadImage 传不上去会退回 base64（r.data）—— 那种情况宁可报错也别存进行里，
        // 存进去就是 1~2 秒后自己消失，师傅以为拍了其实没有
        if (!r?.url) throw new Error('图片没传上去，换个网络再试一次')
        urls.push(r.url)
      }
      const next = [...photos, ...urls]
      setPhotos(next)
      // ⚠️ 等结果。凭证照片「存不进去就等于没拍」，不能用发了不管的写法
      await updateStorageOrderAwait(id, { photos: next })
    } catch (err) {
      setPhotos(order?.photos || [])      // 失败就退回真实状态，不留假照片
      setPhotoErr(humanError(err, '照片'))
    } finally {
      setPhotoBusy(false)
    }
  }

  async function handleRemovePhoto(idx) {
    const next = photos.filter((_, i) => i !== idx)
    setPhotos(next)
    try { await updateStorageOrderAwait(id, { photos: next }) }
    catch (err) { setPhotos(order?.photos || []); setPhotoErr(humanError(err, '照片')) }
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
  // ⚠️ 2026-11-21：协议价。原来写死 v.hourlyRate，企业客户的协议时薪在寄存单上【完全无效】。
  //    搬家单（FormPage）用的是 order.hourlyRate != null ? … : 车型价，这里对齐。
  const hourlyRate = order?.hourlyRate != null ? Number(order.hourlyRate) : v.hourlyRate
  const timeFee = Math.round(billedNum * hourlyRate * 100) / 100
  // ⚠️ 2026-11-21：面包车优惠。搬家单走 pricing.js 会减这 $10（老板说的「出车费 $50」
  //    就是 $60 − $10），寄存单从头到尾没引用过 VAN_PROMO_DISCOUNT，等于多收客人 $10。
  //    只在真收了返程费时才减 —— 返程费是 0 就没有优惠可言。
  const vanDiscount = (order?.vehicle === '面包车' && num(returnFee) > 0) ? VAN_PROMO_DISCOUNT : 0
  const transportSubtotal = Math.round((timeFee
    + num(returnFee) + num(stairFee) + num(overtimeFee) + num(heavyFee)
    + num(highwayFee) + num(parkingFee) + num(suppliesFee) + num(fuelFee)
    - vanDiscount - num(discountAmount)) * 100) / 100
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
              <p className="text-red-300 text-xs mt-0.5 font-mono">{order.orderNo || order.id}</p>
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

            {/* ⚠️ 2026-11-21 老板：「在最上面有了物品数量和时间就应该有个核算价格的，
                 因为装完车后我会和客人把全部费用结算清楚，包括寄存费用，
                 这时候上面有自动核算出的寄存费用会帮到我一点」。
                 以前这个数只在最底下的「费用结算」里，而那一块要点了【到达仓库】才出现 ——
                 等它出现，人已经在仓库，客人早走了。
                 这里只负责【显示】，件数在上面改、周数在下面改，这儿跟着变。 */}
            <div className="border-t border-gray-100 pt-2 mt-1">
              <div className="rounded-lg bg-violet-50 border border-violet-200 px-3 py-2.5">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs font-semibold text-violet-700">📦 寄存费（自动算）</span>
                  <span className="text-xl font-bold text-violet-700">${storageFee.toFixed(2)}</span>
                </div>
                <div className="text-xs text-violet-600/80 leading-relaxed">
                  {(order.boxes || 0) > 0 && <div>纸箱 {order.boxes} 件 × ${boxRate}/周</div>}
                  {(order.furniture || 0) > 0 && <div>家具 {order.furniture} 件 × ${furRate}/周</div>}
                  <div>
                    {weeks} 周 · {shortTerm ? '短期价' : '长期价'}
                    {weeksOverridden && <span className="text-amber-600 ml-1">（按实付周数，非日期推算）</span>}
                  </div>
                </div>
                <p className="text-[11px] text-violet-500/70 mt-1.5">周数在下面「费用结算」里改</p>
              </div>
            </div>

            {order.items && <Row label="物品描述">{order.items}</Row>}
            {order.location && <Row label="仓位">{order.location}</Row>}
            {order.notes && <p className="text-xs text-gray-400 pt-1">{order.notes}</p>}

            {freeSupplies && (
              <div className="mt-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
                🎁 长期客户 {FREE_SUPPLIES_LABEL} 免费 —— {SUPPLIES_NOTICE}
              </div>
            )}
          </div>
        </div>

        {/* 客户物资需求 — 师傅要带去给客户 */}
        {order.requestedMaterials && (Number(order.requestedMaterials.boxes) > 0 || Number(order.requestedMaterials.wrapItems) > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-blue-700 font-semibold text-sm mb-2">📦 客户物资需求（请带过去）</p>
            <div className="space-y-1 text-sm">
              {Number(order.requestedMaterials.boxes) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700">纸箱</span>
                  <span className="text-blue-700 font-semibold">{order.requestedMaterials.boxes} 个</span>
                </div>
              )}
              {Number(order.requestedMaterials.wrapItems) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700">胶带 / 打包膜</span>
                  <span className="text-blue-700 font-semibold">{order.requestedMaterials.wrapItems} 卷</span>
                </div>
              )}
              {Number(order.requestedMaterials.mattressCovers) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700">床垫套</span>
                  <span className="text-blue-700 font-semibold">{order.requestedMaterials.mattressCovers} 个</span>
                </div>
              )}
              {Number(order.requestedMaterials.packingItems) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700">打包用品</span>
                  <span className="text-blue-700 font-semibold">{order.requestedMaterials.packingItems} 个</span>
                </div>
              )}
            </div>
          </div>
        )}

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

            {/* 入库凭证 —— 照片和视频是【到了仓库】才拍的，保持在 stored 这一步 */}
            {currentStepIdx >= 2 && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        {/* ⚠️ 打印条：自动打完也留一个补打按钮 ——
             客户现场加件、纸卡了、师傅没看见，都得能再来一次 */}
        <div className="bg-white rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 text-sm">🏷️ 寄存标签</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {(order.boxes || 0) + (order.furniture || 0)} 张 · 贴箱子上才能拍「订单号」那张照片
              </p>
            </div>
            <button onClick={() => 打标签(false)} disabled={printMsg === 'sending'}
              className="flex-shrink-0 px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
              {printMsg === 'sending' ? '发送中…' : '补打一次'}
            </button>
          </div>
          {printMsg && printMsg !== 'sending' && (
            <p className={`text-xs mt-2 ${printMsg.startsWith('✅') ? 'text-green-600' : 'text-amber-700'}`}>
              {printMsg}
            </p>
          )}
        </div>

                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">入库凭证</h3>
                    <p className="text-xs text-gray-400 mt-0.5">需要3张照片（位置、订单号、物品数量）+ 1个视频</p>
                  </div>
                  <div className="px-4 py-3 space-y-4">
                    {/* Photos */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500 font-medium">
                          照片 {photos.length}/{照片上限}
                          <span className="text-gray-400 ml-1">（至少 {照片下限} 张）</span>
                        </p>
                        {photos.length < 照片上限 && (
                          <button onClick={() => photoInputRef.current?.click()}
                            className="text-xs text-red-600 font-semibold flex items-center gap-1">
                            <Camera size={12} /> 拍照 / 选图
                          </button>
                        )}
                      </div>
                      {/* ⚠️ 没有 capture —— 带 capture 的话 iOS 只给相机，
                          选不了相册。老板 11-10：「也应该可以从手机照片里
                          上传视频和图片」。去掉之后相机和相册都能选。 */}
                      <input ref={photoInputRef} type="file" accept="image/*" multiple
                        className="hidden" onChange={handleAddPhoto} />
                      {photoBusy && (
                        <p className="text-xs text-gray-500 py-2">照片上传中…别关页面</p>
                      )}
                      {photoErr && (
                        <div className="mb-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs leading-relaxed">
                          ⚠️ {photoErr}
                          <br />这张<b>没有</b>存上，请重拍或重选 —— 别以为拍了就完事了
                        </div>
                      )}
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
                          {photos.length < 照片上限 && (
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
                      <input ref={videoInputRef} type="file" accept="video/*"
                        className="hidden" onChange={handleAddVideo} />
                      {videoLoading ? (
                        <div className="py-6 text-center text-gray-400 text-sm">加载中...</div>
                      ) : videoUrl ? (
                        <video src={videoUrl} controls className="w-full rounded-xl max-h-56 bg-black" />
                      ) : (
                        <button onClick={() => videoInputRef.current?.click()}
                          className="w-full py-5 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-gray-400">
                          <Video size={18} />
                          <span className="text-sm">录制 / 选择入库视频</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
            )}

            {/* ⚠️ 2026-11-21 老板：「装完车后我会和客人把全部费用结算清楚，包括寄存费用」。
                 原来这一整块和照片一起锁在 currentStepIdx >= 2（到达仓库）后面 ——
                 可他结算的时候人还在客户家，是第 1 步（到达取货地址）。
                 等费用区出现，他已经在仓库，客人早走了，只能心算。
                 现在提前到第 1 步就显示：能算、能改、能和客人对数；
                 【提交】仍然要等拍完入库照片和视频，那个闸门没动。 */}
            {currentStepIdx >= 1 && (
                <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                  <h3 className="font-semibold text-gray-800">费用结算</h3>
                  {currentStepIdx < 2 && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      现在就能和客人对数、收钱。<b>提交要等到了仓库拍完照片和视频。</b>
                    </p>
                  )}

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

                  {/* 寄存部分 —— 周数可改（老板 11-10：客人付几周就算几周）*/}
                  <div className="space-y-1.5 pb-3 border-b border-gray-100">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">寄存部分</p>
                    <p className="text-xs text-gray-400">
                      {order.boxes} 箱 × ${boxRate}/周
                      {order.furniture > 0 && ` + ${order.furniture} 家具 × $${furRate}/周`}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 shrink-0">客人付了几周</span>
                      <input type="text" inputMode="numeric" pattern="[0-9]*"
                        value={weeksDraft ?? String(weeks)}
                        onFocus={() => setWeeksDraft(String(weeks))}
                        onChange={e => setWeeksDraft(e.target.value.replace(/[^0-9]/g, ''))}
                        onBlur={() => {
                          const n = Math.round(Number(weeksDraft))
                          // 空着或填 0 就当没改，退回原值 —— 不替人猜
                          if (weeksDraft !== '' && Number.isFinite(n) && n >= 1 && n !== weeks) {
                            updateStorageOrder(id, { weeks: n })
                          }
                          setWeeksDraft(null)
                        }}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono text-right
                                   outline-none focus:border-red-400" />
                      <span className="text-xs text-gray-400">周</span>
                      {weeksOverridden && (
                        <span className="text-xs text-amber-600">按日期是 {autoWeeks} 周</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      默认按「入库 → 预计取件」算（{autoWeeks} 周）。
                      <b>客人实际付了几周就填几周</b> —— 预计取件日期只是预计，付款才是事实
                    </p>
                    <div className="flex justify-between text-sm pt-1">
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
                    {/* 面包车优惠单独列一行 —— 混在「运输小计」里，
                        客人问「怎么算的」就说不清，和搬家单的收据也对不上 */}
                    {vanDiscount > 0 && (
                      <div className="flex justify-between text-green-700">
                        <span>面包车优惠</span><span>-${vanDiscount.toFixed(2)}</span>
                      </div>
                    )}
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
                        : `还需 ${照片下限 - photos.length > 0 ? `${照片下限 - photos.length} 张照片` : ''}${(!videoUrl && !order.hasVideo) ? (photos.length < 照片下限 ? ' + 视频' : '视频') : ''}`}
                  </button>
                </div>
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
