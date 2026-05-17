import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, CheckCircle, Upload, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import dayjs from 'dayjs'
import { getStorageRates, FREE_SUPPLIES_LABEL } from '../../data/storageRates'

const VEHICLES = [
  { id: 'van',   name: '面包车', rate: 60,  desc: '小件/纸箱为主' },
  { id: 'small', name: '小卡车', rate: 110, desc: '大件家具适用'   },
]

const TIME_SLOTS = {
  van:   ['08:00 准时到达', '10:30–12:30', '13:00–15:00', '15:30–17:30', '18:00–20:00'],
  small: ['08:00 准时到达', '11:30–13:30', '15:30–17:30'],
}

function calcFee(boxes, furniture, weeks) {
  const { boxRate, furRate, shortTerm, freeSupplies } = getStorageRates(weeks)
  const weekly  = boxes * boxRate + furniture * furRate
  return { weekly, total: weekly * weeks, boxRate, furRate, short: shortTerm, freeSupplies }
}

const GRAD   = 'linear-gradient(135deg, #C03448, #D03C52)'
const BG     = '#F7F7F7'
const MID    = '#C03448'
const BORDER = '#EFEFEF'
const DARK   = '#7a1e28'

export default function StorageBooking() {
  const navigate = useNavigate()
  const { createStorageOrder } = useApp()
  const depositInputRef = useRef(null)

  const [vehicleId,    setVehicleId]    = useState('van')
  const [depositFile,  setDepositFile]  = useState(null)
  const [boxes,        setBoxes]        = useState(5)
  const [furniture,    setFurniture]    = useState(0)
  const [needsPickup,  setNeedsPickup]  = useState(true)
  const [needsReturn,  setNeedsReturn]  = useState(true)
  const [moveIn,       setMoveIn]       = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'))
  const [moveOut,      setMoveOut]      = useState(dayjs().add(5, 'week').format('YYYY-MM-DD'))
  const [submitted,    setSubmitted]    = useState(false)
  const [orderId,      setOrderId]      = useState(null)
  const [errors,       setErrors]       = useState({})
  const [boxesNeeded,  setBoxesNeeded]  = useState(0)
  const [wrapNeeded,   setWrapNeeded]   = useState(0)

  const [form, setForm] = useState({
    name: '', phone: '', wechat: '',
    fromAddress: '',
    timeSlot: TIME_SLOTS.van[0],
    deliveryAddress: '',
    notes: '',
  })

  const vehicle = VEHICLES.find(v => v.id === vehicleId)
  const slots   = TIME_SLOTS[vehicleId]
  const weeks   = Math.max(1, Math.ceil(dayjs(moveOut).diff(dayjs(moveIn), 'day') / 7))
  const fee     = calcFee(boxes, furniture, weeks)

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: false }))
  }

  function selectVehicle(id) {
    setVehicleId(id)
    setForm(f => ({ ...f, timeSlot: TIME_SLOTS[id][0] }))
  }

  function handleDepositUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setDepositFile({ name: file.name, data: ev.target.result })
      setErrors(err => ({ ...err, depositFile: false }))
    }
    reader.readAsDataURL(file)
  }

  function validate() {
    const e = {}
    if (!form.name.trim())  e.name  = true
    if (!form.phone.trim()) e.phone = true
    if (needsPickup && !form.fromAddress.trim()) e.fromAddress = true
    if (boxes === 0 && furniture === 0) e.items = true
    if (!depositFile) e.depositFile = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const order = createStorageOrder({
      customerName:     form.name,
      customerPhone:    form.phone,
      wechat:           form.wechat,
      vehicle:          vehicle.name,
      date:             moveIn,
      startTime:        needsPickup ? form.timeSlot : '—',
      fromAddress:      needsPickup ? form.fromAddress : '客户自送',
      needsPickup,
      needsReturn,
      deliveryAddress:  form.deliveryAddress,
      boxes,
      furniture,
      moveInDate:       moveIn,
      moveOutDate:      moveOut,
      weeks,
      weeklyFee:        fee.weekly,
      totalFee:         fee.total,
      notes:             form.notes,
      depositScreenshot: depositFile || null,
      depositStatus:     '已上传截图',
      paymentStatus:     '定金',
      source:            '官网自助预约',
      status:            '待确认',
      serviceType:       '寄存',
      requestedMaterials: (boxesNeeded > 0 || wrapNeeded > 0) ? { boxes: boxesNeeded, wrapItems: wrapNeeded } : null,
    })
    setOrderId(order.id)
    setSubmitted(true)
  }

  /* ── Success ── */
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: BG }}>
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-sm text-center"
          style={{ border: `1px solid ${BORDER}` }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: BG }}>
            <CheckCircle size={40} style={{ color: MID }} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">申请已提交</h2>
          <p className="text-gray-500 text-sm mb-1">订单号：<strong className="text-gray-800">{orderId}</strong></p>
          <p className="text-gray-400 text-sm mb-4">客服将在 1 小时内联系您确认详情</p>

          <div className="rounded-2xl p-4 text-left space-y-1.5 mb-4 text-sm bg-white"
            style={{ borderLeft: '3px solid #F59E0B', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div className="flex justify-between">
              <span className="text-gray-500">纸箱</span>
              <span className="font-medium">{boxes} 箱</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">家具大件</span>
              <span className="font-medium">{furniture} 件</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">存期</span>
              <span className="font-medium">约 {weeks} 周</span>
            </div>
            <div className="flex justify-between border-t pt-1.5 font-bold">
              <span>存储费参考</span>
              <span style={{ color: MID }}>${fee.weekly}/周</span>
            </div>
            <p className="text-xs text-gray-400">运输费另计，客服确认后报价</p>
          </div>

          <div className="rounded-2xl p-4 text-left mb-4 bg-white"
            style={{ borderLeft: '3px solid #F59E0B', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <p className="font-bold text-sm mb-2.5" style={{ color: MID }}>📋 温馨提示</p>
            <div className="space-y-1.5 text-sm text-gray-600">
              {['请提前整理好需要寄存的物品', '易碎品请提前说明', '公寓请提前预约电梯', '请提前预留停车位'].map(tip => (
                <div key={tip} className="flex items-start gap-2">
                  <span className="text-green-500 flex-shrink-0 mt-0.5 font-bold text-xs">✓</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>

          <a href="tel:0426033899"
            className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-2xl mb-3 block text-center"
            style={{ background: GRAD }}>
            <Phone size={16} /> 联系客服
          </a>
          <button
            onClick={() => navigate(`/my-order?id=${orderId}&phone=${encodeURIComponent(form.phone)}`)}
            className="w-full py-3 rounded-2xl font-semibold text-sm mb-2"
            style={{ background: BG, color: MID, border: `1.5px solid ${BORDER}` }}>
            查看我的预约详情
          </button>
          <button onClick={() => navigate('/')}
            className="w-full py-3 rounded-2xl text-gray-400 text-sm">
            返回首页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: BG }}>

      {/* Header */}
      <div className="bg-white sticky top-0 z-10" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <span className="font-bold text-gray-900 flex-1">物品寄存预约</span>
          <a href="tel:0426033899" className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color: MID }}>
            <Phone size={15} /> 咨询
          </a>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Hero */}
        <div className="rounded-3xl p-5 text-white"
          style={{ background: `linear-gradient(135deg, ${DARK}, ${MID})` }}>
          <p className="text-2xl mb-1">📦</p>
          <h2 className="text-xl font-bold mb-1">安全寄存服务</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
            按周计费 · 灵活存取 · 保险保障
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <p className="font-bold">$5/箱/周</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>≤5周（短期）</p>
            </div>
            <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <p className="font-bold">$10/件/周</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>家具/大件</p>
            </div>
          </div>
          <div className="mt-2 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.18)' }}>
            🎁 <strong>长期优惠</strong>：寄存 &gt;5 周降至 纸箱 $4 / 家具 $8，且<strong>免费送 {FREE_SUPPLIES_LABEL}</strong>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4"
          style={{ border: `1px solid ${BORDER}` }}>
          <h3 className="font-bold text-gray-800">存储物品</h3>
          {errors.items && (
            <p className="text-red-500 text-xs">请至少填写纸箱或家具数量</p>
          )}
          {[
            { label: '纸箱数量',  sub: '标准搬家纸箱大小',      val: boxes,     setter: setBoxes     },
            { label: '家具大件数', sub: '沙发、床架、冰箱等大件', val: furniture, setter: setFurniture },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800 text-sm">{item.label}</p>
                <p className="text-xs text-gray-400">{item.sub}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => item.setter(v => Math.max(0, v - 1))}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold flex items-center justify-center">
                  −
                </button>
                <span className="w-8 text-center font-bold text-gray-900 text-lg">{item.val}</span>
                <button onClick={() => item.setter(v => v + 1)}
                  className="w-9 h-9 rounded-xl text-white font-bold flex items-center justify-center"
                  style={{ background: MID }}>
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 存储时间 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3"
          style={{ border: `1px solid ${BORDER}` }}>
          <h3 className="font-bold text-gray-800">存放时间</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">预计取回日期</label>
            <input type="date" value={moveOut} onChange={e => setMoveOut(e.target.value)}
              min={moveIn}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200" />
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: BG }}>
            <p className="font-bold" style={{ color: MID }}>
              约 {weeks} 周 · {fee.short ? '短期价' : '长期优惠价'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(160,48,80,0.5)' }}>
              {fee.short ? '≤5周按短期计费' : '>5周按长期优惠计费'}
            </p>
          </div>

          {/* Fee preview */}
          {(boxes > 0 || furniture > 0) && (
            <div className="rounded-xl p-3 space-y-1.5 text-sm"
              style={{ background: BG, border: `1px solid ${BORDER}` }}>
              {boxes > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>{boxes}箱 × ${fee.boxRate}/周 × {weeks}周</span>
                  <span>${boxes * fee.boxRate * weeks}</span>
                </div>
              )}
              {furniture > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>{furniture}件 × ${fee.furRate}/周 × {weeks}周</span>
                  <span>${furniture * fee.furRate * weeks}</span>
                </div>
              )}
              <div className="border-t pt-1.5 flex justify-between font-bold">
                <span>存储费参考</span>
                <span className="text-green-600">${fee.total}</span>
              </div>
              {fee.freeSupplies && (
                <p className="text-xs text-green-600 font-semibold pt-0.5">
                  🎁 含免费物资（{FREE_SUPPLIES_LABEL}）
                </p>
              )}
              <p className="text-xs text-gray-400">存储费另计运输费，取回搬运享 <span className="text-green-600 font-semibold">$10 优惠</span></p>
            </div>
          )}
        </div>

        {/* 搬入安排 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4"
          style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800">搬入安排</h3>
            <button onClick={() => setNeedsPickup(v => !v)}
              className="flex items-center gap-2 text-sm"
              style={{ color: needsPickup ? MID : '#9ca3af' }}>
              <div className="w-10 h-6 rounded-full relative transition-colors"
                style={{ background: needsPickup ? MID : '#d1d5db' }}>
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                  style={{ left: needsPickup ? '1.25rem' : '0.125rem' }} />
              </div>
              需要上门取件
            </button>
          </div>

          {needsPickup ? (
            <>
              {/* Pickup date */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  上门取件日期（即入库日期）
                </label>
                <input type="date" value={moveIn} onChange={e => setMoveIn(e.target.value)}
                  min={dayjs().add(1, 'day').format('YYYY-MM-DD')}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200" />
              </div>

              {/* Vehicle */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block font-medium">选择车型</label>
                <div className="grid grid-cols-2 gap-2">
                  {VEHICLES.map(v => (
                    <button key={v.id} onClick={() => selectVehicle(v.id)}
                      className="p-3.5 rounded-2xl border-2 text-left transition-all"
                      style={vehicleId === v.id
                        ? { borderColor: MID, background: BG }
                        : { borderColor: '#e5e7eb', background: 'white' }}>
                      <p className="font-bold text-sm"
                        style={{ color: vehicleId === v.id ? MID : '#374151' }}>
                        {v.name}
                      </p>
                      <p className="text-xl font-black mt-0.5"
                        style={{ color: vehicleId === v.id ? MID : '#111827' }}>
                        ${v.rate}
                        <span className="text-xs font-normal text-gray-400">/h</span>
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: vehicleId === v.id ? MID : '#6b7280' }}>
                        + ${v.rate} 出车费
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{v.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time slots */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">到达时段 *</p>
                <p className="text-xs text-gray-400 mb-2">
                  首单可准时到达；后续时段受路况及上单影响，为预计窗口
                </p>
                <div className="space-y-2">
                  {slots.map((slot, idx) => {
                    const isFixed = idx === 0
                    const active  = form.timeSlot === slot
                    return (
                      <button key={slot} onClick={() => set('timeSlot', slot)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-left flex items-center justify-between"
                        style={active
                          ? { background: GRAD, color: 'white' }
                          : { background: '#f3f4f6', color: '#374151' }}>
                        <span>{slot}</span>
                        {isFixed && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={active
                              ? { background: 'rgba(255,255,255,0.25)', color: 'white' }
                              : { background: '#dcfce7', color: '#16a34a' }}>
                            准时
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Pickup address */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">取件地址 *</label>
                <input value={form.fromAddress} onChange={e => set('fromAddress', e.target.value)}
                  placeholder="Unit/No. Street, Suburb NSW"
                  className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200 ${errors.fromAddress ? 'border-red-400' : 'border-gray-200'}`} />
                {errors.fromAddress && <p className="text-red-500 text-xs mt-1">请填写取件地址</p>}
              </div>
            </>
          ) : (
            <div className="rounded-xl p-3 text-sm text-gray-500" style={{ background: '#f9fafb' }}>
              客户自行送货至指定仓库，客服确认后提供地址
            </div>
          )}
        </div>

        {/* 搬出安排 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3"
          style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800">搬出安排</h3>
            <button onClick={() => setNeedsReturn(v => !v)}
              className="flex items-center gap-2 text-sm"
              style={{ color: needsReturn ? MID : '#9ca3af' }}>
              <div className="w-10 h-6 rounded-full relative transition-colors"
                style={{ background: needsReturn ? MID : '#d1d5db' }}>
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                  style={{ left: needsReturn ? '1.25rem' : '0.125rem' }} />
              </div>
              需要帮助取回
            </button>
          </div>

          {needsReturn ? (
            <div className="space-y-3">
              <div className="rounded-xl p-3 text-xs" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <p className="font-bold text-green-700 mb-0.5">🎉 寄存客户专属优惠</p>
                <p className="text-green-600">取回搬运费立减 <strong>$10</strong>，联系客服预约取回时出示订单号即可享受</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  送达地址（可选，不确定可留空）
                </label>
                <input value={form.deliveryAddress} onChange={e => set('deliveryAddress', e.target.value)}
                  placeholder="取回时的目标地址，暂不确定可不填"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200" />
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-3 text-sm text-gray-500" style={{ background: '#f9fafb' }}>
              客户自行到仓库取货，取货前请提前联系客服预约
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3"
          style={{ border: `1px solid ${BORDER}` }}>
          <h3 className="font-bold text-gray-800">联系方式</h3>
          {[
            { label: '姓名 *',       key: 'name',   placeholder: '您的姓名',     type: 'text' },
            { label: '手机 *',       key: 'phone',  placeholder: '04xx xxx xxx', type: 'tel'  },
            { label: '微信（可选）',  key: 'wechat', placeholder: '微信号',       type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs text-gray-500 mb-1.5">{f.label}</label>
              <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200 ${errors[f.key] ? 'border-red-400' : 'border-gray-200'}`} />
              {errors[f.key] && <p className="text-red-500 text-xs mt-1">此项为必填</p>}
            </div>
          ))}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">备注（可选）</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              placeholder="特殊物品说明，如：贵重品、易碎品、需恒温存储等"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200 resize-none" />
          </div>
        </div>

        {/* Materials */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3"
          style={{ border: `1px solid ${BORDER}` }}>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">打包物资（可选）</h3>
            <p className="text-xs text-gray-400 mt-0.5">上门取件当天提供，客服确认后安排</p>
          </div>
          {[
            { label: '纸箱', sub: '搬家专用纸箱 $5/个', val: boxesNeeded, set: setBoxesNeeded },
            { label: '胶带 / 打包膜', sub: '封箱胶带或缠绕膜 $3/卷', val: wrapNeeded, set: setWrapNeeded },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">{item.label}</p>
                <p className="text-xs text-gray-400">{item.sub}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => item.set(v => Math.max(0, v - 1))}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold flex items-center justify-center">−</button>
                <span className="w-8 text-center font-bold text-gray-900 text-lg">{item.val}</span>
                <button onClick={() => item.set(v => v + 1)}
                  className="w-9 h-9 rounded-xl text-white font-bold flex items-center justify-center"
                  style={{ background: MID }}>+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Deposit */}
        <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BORDER}` }}>
          <h3 className="font-bold text-gray-800 mb-1 text-sm">
            定金说明 <span className="text-red-500">*</span>
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            请先转账定金，上传截图后方可提交预约。截图确认后档期锁定。
          </p>
          <div className="rounded-xl p-3 mb-3 text-xs"
            style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
            <p className="font-semibold text-orange-800 mb-2">转账收款账户</p>
            <div className="space-y-1 text-orange-700">
              <div className="flex justify-between"><span className="text-orange-500">银行</span><span className="font-medium">Commonwealth Bank (CBA)</span></div>
              <div className="flex justify-between"><span className="text-orange-500">户名</span><span className="font-medium">Move With Ease</span></div>
              <div className="flex justify-between"><span className="text-orange-500">BSB</span><span className="font-medium">062-000</span></div>
              <div className="flex justify-between"><span className="text-orange-500">账号</span><span className="font-medium">1234 5678</span></div>
              <div className="flex justify-between"><span className="text-orange-500">PayID</span><span className="font-medium">0426 033 899</span></div>
            </div>
            <p className="text-orange-500 mt-2">转账备注请填写您的姓名</p>
          </div>
          <p className="text-xs text-gray-500 mb-2 font-medium">
            转账后请上传截图 <span className="text-red-500">（必填）</span>
          </p>
          {!depositFile ? (
            <>
              <button onClick={() => depositInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm transition-colors"
                style={errors.depositFile
                  ? { borderColor: '#f87171', color: '#ef4444', background: '#fff5f5' }
                  : { borderColor: '#d1d5db', color: '#9ca3af' }}>
                <Upload size={16} /> 上传定金截图
              </button>
              {errors.depositFile && (
                <p className="text-red-500 text-xs mt-1">请上传定金转账截图后再提交</p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: BG }}>
              <div>
                <p className="text-sm font-medium text-green-600">截图已上传</p>
                <p className="text-xs text-gray-400">{depositFile.name}</p>
              </div>
              <button onClick={() => setDepositFile(null)} className="p-1 text-gray-400">
                <X size={16} />
              </button>
            </div>
          )}
          <input ref={depositInputRef} type="file" accept="image/*"
            className="hidden" onChange={handleDepositUpload} />
        </div>

        <button onClick={handleSubmit}
          className="w-full py-4 rounded-2xl text-white font-bold text-sm shadow-sm"
          style={{ background: GRAD }}>
          提交寄存预约
        </button>
        <div className="h-4" />
      </div>
    </div>
  )
}
