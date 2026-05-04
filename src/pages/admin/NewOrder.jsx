import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { VEHICLES } from '../../data/vehicles'
import { calcRemoteSurcharge, getDistanceTier } from '../../utils/remoteFee'
import { ArrowLeft, MapPin, Package, AlertTriangle, Info, CheckCircle, ExternalLink } from 'lucide-react'
import AddressAutocomplete from '../../components/AddressAutocomplete'
import { getDistanceKm } from '../../utils/googleMaps'

const SERVICE_TYPES = ['搬家', '寄存', '家具组装', '清洁服务', '其他']
const VEHICLE_KEYS = Object.keys(VEHICLES)
const SOURCES = ['微信', '小红书', '转介绍', '师傅内部介绍', '商业合作', '电话', '其他']
const FRAGILE_OPTIONS = ['大理石桌', '玻璃餐桌', '鱼缸', '镜子', '艺术品', '高端家具', '钢琴', '大电视(65寸+)', '易损柜体', '其他']
const DISCOUNT_OPTIONS = [
  { label: '无折扣', value: 1 },
  { label: '九五折 (5%)', value: 0.95 },
  { label: '九折 (10%)', value: 0.9 },
]

const MATERIAL_PRICES = { boxes: 5, mattressCovers: 10, wrapItems: 5 }

export default function NewOrder() {
  const navigate = useNavigate()
  const { createOrder, getCustomers, user } = useApp()
  const customers = getCustomers()

  const [form, setForm] = useState({
    serviceType: '搬家',
    date: new Date().toISOString().slice(0, 10),
    startTime: '09:00',
    vehicle: '小卡车',
    customerName: '',
    customerPhone: '',
    wechat: '',
    source: '微信',
    fromAddress: '',
    toAddress: '',
    distanceKm: '',
    items: '',
    notes: '',
    fragileItems: [],
    fragileDescription: '',
    fragileEstimatedFee: '',
    materials: { boxes: 0, mattressCovers: 0, wrapItems: 0 },
    quote: '',
    deposit: 30,
    depositStatus: '',   // '' | 'paid' | 'pending' | 'unpaid'
    depositPaid: false,
    discount: 1,
    paymentMethod: 'cash',
    status: '待确认',
  })

  const [existingCustomer, setExistingCustomer] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [successOrder, setSuccessOrder] = useState(null)

  // Phone lookup
  useEffect(() => {
    if (form.customerPhone.length >= 10) {
      const found = customers.find(c => c.phone === form.customerPhone)
      setExistingCustomer(found || null)
      if (found && !form.customerName) {
        setForm(f => ({ ...f, customerName: found.name, wechat: found.wechat || '' }))
      }
    } else {
      setExistingCustomer(null)
    }
  }, [form.customerPhone])

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleAddressSelect(field, address) {
    set(field, address)
    const from = field === 'fromAddress' ? address : form.fromAddress
    const to   = field === 'toAddress'   ? address : form.toAddress
    if (from && to) {
      const km = await getDistanceKm(from, to)
      if (km !== null) set('distanceKm', String(km))
    }
  }

  // Auto-calculate distance when both address fields are filled (handles manual input too)
  useEffect(() => {
    const from = form.fromAddress.trim()
    const to   = form.toAddress.trim()
    if (from.length < 5 || to.length < 5) return
    const timer = setTimeout(async () => {
      const km = await getDistanceKm(from, to)
      if (km !== null) set('distanceKm', String(km))
    }, 800)
    return () => clearTimeout(timer)
  }, [form.fromAddress, form.toAddress])

  function setMaterial(key, val) {
    setForm(f => ({ ...f, materials: { ...f.materials, [key]: Math.max(0, Number(val) || 0) } }))
  }

  function toggleFragile(item) {
    setForm(f => ({
      ...f,
      fragileItems: f.fragileItems.includes(item)
        ? f.fragileItems.filter(x => x !== item)
        : [...f.fragileItems, item],
    }))
  }

  // Calculations
  const v = VEHICLES[form.vehicle]
  const baseQuote = v ? v.hourlyRate * v.minHours + v.returnFee : 0
  const km = parseFloat(form.distanceKm) || 0
  const remote = v ? calcRemoteSurcharge(km, form.vehicle) : { total: 0, tier: null }
  const materialsCost =
    form.materials.boxes * MATERIAL_PRICES.boxes +
    form.materials.mattressCovers * MATERIAL_PRICES.mattressCovers +
    form.materials.wrapItems * MATERIAL_PRICES.wrapItems
  const suggestedQuote = baseQuote + remote.total + materialsCost
  const finalQuote = parseFloat(form.quote) || suggestedQuote
  const discountedQuote = Math.round(finalQuote * form.discount)

  const customerLevel = existingCustomer ? getCustomerLevel(existingCustomer.orderCount) : null

  function handleSubmit(e) {
    e.preventDefault()
    setSubmitted(true)
    if (!form.customerName || !form.customerPhone || !form.date) return
    if (form.serviceType === '搬家' && (!form.fromAddress || !form.toAddress)) return
    if (!form.depositStatus) return
    if (form.depositStatus === 'unpaid') return  // blocked

    const autoQuoteNote = v ? [
      `$${v.hourlyRate}×${v.minHours}h + $${v.returnFee}(返程费) = $${baseQuote}`,
      remote.total > 0 ? `+ 远途 $${remote.total}` : null,
      materialsCost > 0 ? `+ 物资 $${materialsCost}` : null,
      discountedQuote !== baseQuote + remote.total + materialsCost ? `折后 $${discountedQuote}起` : `= $${discountedQuote}起`,
    ].filter(Boolean).join(' ') : ''

    const order = createOrder({
      ...form,
      distanceKm: km || null,
      remoteSurcharge: remote.total || null,
      materialsCost,
      quote: discountedQuote,
      quoteNote: form.quoteNote || autoQuoteNote,
      fragileEstimatedFee: parseFloat(form.fragileEstimatedFee) || 0,
      depositPaid: form.depositStatus === 'paid',
      status: form.depositStatus === 'paid' ? '已收定金' : '待确认',
    })

    setSuccessOrder(order)
    setSubmitted(false)
    setForm({
      serviceType: '搬家',
      date: new Date().toISOString().slice(0, 10),
      startTime: '09:00',
      vehicle: '小卡车',
      customerName: '',
      customerPhone: '',
      wechat: '',
      source: '微信',
      fromAddress: '',
      toAddress: '',
      distanceKm: '',
      items: '',
      notes: '',
      fragileItems: [],
      fragileDescription: '',
      fragileEstimatedFee: '',
      materials: { boxes: 0, mattressCovers: 0, wrapItems: 0 },
      quote: '',
      deposit: 30,
      depositStatus: '',
      depositPaid: false,
      discount: 1,
      paymentMethod: 'cash',
      status: '待确认',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const err = (field) => submitted && !form[field]

  return (
    <div className="max-w-2xl mx-auto p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">新建订单</h1>
      </div>

      {successOrder && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 flex items-start gap-3">
          <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-green-800 font-semibold text-sm">订单创建成功！</p>
            <p className="text-green-600 text-xs mt-0.5">
              {successOrder.customerName} · {successOrder.id} · ${successOrder.quote}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/admin/orders/${successOrder.id}`)}
            className="flex items-center gap-1 text-green-600 text-xs font-semibold hover:underline flex-shrink-0"
          >
            查看 <ExternalLink size={12} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Section 1: 服务类型 */}
        <Section title="服务类型与时间">
          <div className="grid grid-cols-2 gap-3">
            <Field label="服务类型" required>
              <select value={form.serviceType} onChange={e => set('serviceType', e.target.value)} className={selectCls}>
                {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="服务日期" required>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={`${inputCls} ${err('date') ? errorCls : ''}`} />
            </Field>
            <Field label="开始时间">
              <input type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} className={inputCls} />
            </Field>
            {form.serviceType === '搬家' && (
              <Field label="车型" required>
                <select value={form.vehicle} onChange={e => set('vehicle', e.target.value)} className={selectCls}>
                  {VEHICLE_KEYS.map(k => <option key={k} value={k}>{VEHICLES[k].label}</option>)}
                </select>
              </Field>
            )}
          </div>
        </Section>

        {/* Section 2: 客户信息 */}
        <Section title="客户信息">
          <Field label="手机号" required>
            <input
              type="tel"
              value={form.customerPhone}
              onChange={e => set('customerPhone', e.target.value)}
              placeholder="04xxxxxxxx"
              className={`${inputCls} ${err('customerPhone') ? errorCls : ''}`}
            />
          </Field>

          {existingCustomer && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
              <Info size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700">
                <span className="font-semibold">{existingCustomer.name}</span> · 老客户 ·
                共 {existingCustomer.orderCount} 单 {customerLevel}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="客户姓名" required>
              <input
                type="text"
                value={form.customerName}
                onChange={e => set('customerName', e.target.value)}
                placeholder="姓名"
                className={`${inputCls} ${err('customerName') ? errorCls : ''}`}
              />
            </Field>
            <Field label="微信号">
              <input type="text" value={form.wechat} onChange={e => set('wechat', e.target.value)} placeholder="选填" className={inputCls} />
            </Field>
          </div>
          <Field label="客户来源">
            <div className="flex flex-wrap gap-2">
              {SOURCES.map(s => (
                <button
                  key={s} type="button"
                  onClick={() => set('source', s)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    form.source === s
                      ? 'border-red-300 bg-red-50 text-red-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* Section 3: 地址 (搬家专属) */}
        {form.serviceType === '搬家' && (
          <Section title="搬运地址">
            <Field label="搬出地址" required icon={<MapPin size={14} className="text-red-400" />}>
              <AddressAutocomplete
                value={form.fromAddress}
                onChange={v => set('fromAddress', v)}
                onSelect={addr => handleAddressSelect('fromAddress', addr)}
                placeholder="完整地址 + 楼层信息"
                className={inputCls}
                pinColor="text-red-400"
                error={err('fromAddress')}
              />
            </Field>
            <Field label="搬入地址" required icon={<MapPin size={14} className="text-green-500" />}>
              <AddressAutocomplete
                value={form.toAddress}
                onChange={v => set('toAddress', v)}
                onSelect={addr => handleAddressSelect('toAddress', addr)}
                placeholder="完整地址 + 楼层信息"
                className={inputCls}
                pinColor="text-green-500"
                error={err('toAddress')}
              />
            </Field>

            {/* Distance + remote fee */}
            <Field label="预计公里数（两点之间）">
              <input
                type="number"
                value={form.distanceKm}
                onChange={e => set('distanceKm', e.target.value)}
                placeholder="例如 25"
                className={inputCls}
              />
            </Field>

            {km > 0 && (
              <RemoteFeeBox km={km} remote={remote} vehicle={form.vehicle} v={v} />
            )}
          </Section>
        )}

        {/* Section 4: 物品 + 易碎 */}
        <Section title="物品信息">
          <Field label="搬运物品描述">
            <textarea
              value={form.items}
              onChange={e => set('items', e.target.value)}
              placeholder="列出主要物品，如：双人床、冰箱、沙发..."
              rows={3}
              className={inputCls}
            />
          </Field>

          <Field label="易碎物品（可多选）">
            <div className="flex flex-wrap gap-2">
              {FRAGILE_OPTIONS.map(item => (
                <button
                  key={item} type="button"
                  onClick={() => toggleFragile(item)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    form.fragileItems.includes(item)
                      ? 'border-amber-300 bg-amber-50 text-amber-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </Field>

          {form.fragileItems.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="客户描述">
                <input
                  type="text"
                  value={form.fragileDescription}
                  onChange={e => set('fragileDescription', e.target.value)}
                  placeholder="客户说明"
                  className={inputCls}
                />
              </Field>
              <Field label="预估易碎附加费 $">
                <input
                  type="number"
                  value={form.fragileEstimatedFee}
                  onChange={e => set('fragileEstimatedFee', e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </Field>
            </div>
          )}

          {form.fragileItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                提醒话术：「大件易碎物品可能产生额外收费，师傅现场确认后告知您，请提前做好准备。」
              </p>
            </div>
          )}
        </Section>

        {/* Section 5: 物资 */}
        <Section title="物资需求">
          <div className="grid grid-cols-3 gap-3">
            <MaterialRow
              label="纸箱" unit="个" price={MATERIAL_PRICES.boxes}
              value={form.materials.boxes}
              onChange={v => setMaterial('boxes', v)}
            />
            <MaterialRow
              label="床垫套" unit="个" price={MATERIAL_PRICES.mattressCovers}
              value={form.materials.mattressCovers}
              onChange={v => setMaterial('mattressCovers', v)}
            />
            <MaterialRow
              label="打包膜" unit="件家具" price={MATERIAL_PRICES.wrapItems}
              value={form.materials.wrapItems}
              onChange={v => setMaterial('wrapItems', v)}
            />
          </div>
          {materialsCost > 0 && (
            <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2 flex justify-between text-sm">
              <span className="text-gray-500">物资合计</span>
              <span className="font-semibold text-gray-800">${materialsCost}</span>
            </div>
          )}
          {materialsCost > 0 && (
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Package size={12} />
              师傅出发前将收到携带物资清单
            </p>
          )}
        </Section>

        {/* Section 6: 报价 */}
        <Section title="报价与定金">
          {/* Auto quote suggestion */}
          {form.serviceType === '搬家' && v && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3 text-sm">
              <p className="text-blue-700 font-semibold mb-1.5">系统建议报价</p>
              <div className="space-y-1 text-blue-600">
                <div className="flex justify-between">
                  <span>基础（{v.minHours}小时工时 + 出车费）</span>
                  <span>${baseQuote}</span>
                </div>
                {remote.total > 0 && (
                  <div className="flex justify-between">
                    <span>远程附加费（{remote.tier?.label}）</span>
                    <span>${remote.total}</span>
                  </div>
                )}
                {materialsCost > 0 && (
                  <div className="flex justify-between">
                    <span>物资费</span>
                    <span>${materialsCost}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-1 border-t border-blue-200 text-blue-800">
                  <span>建议报价</span>
                  <span>${suggestedQuote}</span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="最终报价 $" required>
              <input
                type="number"
                value={form.quote}
                onChange={e => set('quote', e.target.value)}
                placeholder={`建议 $${suggestedQuote}`}
                className={inputCls}
              />
            </Field>
            <Field label="折扣">
              <select value={form.discount} onChange={e => set('discount', parseFloat(e.target.value))} className={selectCls}>
                {DISCOUNT_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>
          </div>

          {form.discount < 1 && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm flex justify-between">
              <span className="text-green-700">折后金额</span>
              <span className="text-green-700 font-bold">${discountedQuote}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="定金金额 $">
              <input
                type="number"
                value={form.deposit}
                onChange={e => set('deposit', parseFloat(e.target.value) || 0)}
                className={inputCls}
              />
            </Field>
            <div />
          </div>

          <Field label="定金状态" required>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'paid',    label: '✅ 已收定金',  desc: '可创建',     cls: 'border-green-300 bg-green-50 text-green-700' },
                { val: 'pending', label: '⏳ 待定',       desc: '需跟进',     cls: 'border-amber-300 bg-amber-50 text-amber-700' },
                { val: 'unpaid',  label: '❌ 未付款',     desc: '不可创建',   cls: 'border-red-200 bg-red-50 text-red-600' },
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => set('depositStatus', opt.val)}
                  className={`py-3 px-2 rounded-xl border-2 text-center transition-colors ${
                    form.depositStatus === opt.val ? opt.cls : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold leading-tight">{opt.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
            {submitted && !form.depositStatus && (
              <p className="text-red-500 text-xs mt-1">请选择定金状态</p>
            )}
            {form.depositStatus === 'unpaid' && (
              <p className="text-red-500 text-xs mt-1">未付款不可创建订单，请先收定金或选择"待定"</p>
            )}
            {form.depositStatus === 'pending' && (
              <p className="text-amber-600 text-xs mt-1">⚠️ 提醒：请在服务前督促客户补交定金</p>
            )}
          </Field>
        </Section>

        {/* Section 7: 备注 */}
        <Section title="备注">
          <Field label="备注">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="楼层、电梯情况、特殊要求..."
              rows={3}
              className={inputCls}
            />
          </Field>
          <div className="flex items-center justify-between py-2 px-1">
            <span className="text-sm text-gray-500">登记人</span>
            <span className="text-sm font-semibold text-gray-800">{user?.name || '-'}</span>
          </div>
        </Section>

        {/* Submit */}
        {submitted && (
          <p className="text-red-500 text-sm text-center">请检查必填项（标 * 的字段）</p>
        )}

        <div className="flex gap-3 pb-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 py-4 rounded-xl border border-gray-200 text-gray-600 font-semibold"
          >
            取消
          </button>
          <button
            type="submit"
            className="flex-1 py-4 rounded-xl text-white font-semibold shadow-sm"
            style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}
          >
            创建订单
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Sub-components ──

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-4 py-4 space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, required, icon, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
        {icon}{label}{required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}

function MaterialRow({ label, unit, price, value, onChange }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xs text-gray-400 mb-2">${price}/{unit}</p>
      <div className="flex items-center justify-center gap-2">
        <button type="button" onClick={() => onChange(value - 1)} className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-300">-</button>
        <span className="w-6 text-center font-semibold text-gray-800 text-sm">{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} className="w-7 h-7 rounded-full bg-red-100 text-red-600 font-bold text-sm hover:bg-red-200">+</button>
      </div>
      {value > 0 && <p className="text-xs text-green-600 font-semibold mt-1">${value * price}</p>}
    </div>
  )
}

function RemoteFeeBox({ km, remote, vehicle, v }) {
  const tier = remote.tier
  if (!tier || tier.type === 'standard') return null

  const isSpecial = tier.type === 'special'
  const needsConfirm = tier.needsConfirm

  return (
    <div className={`rounded-xl border p-3 text-sm ${
      isSpecial || needsConfirm
        ? 'border-red-200 bg-red-50'
        : 'border-blue-200 bg-blue-50'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={14} className={needsConfirm ? 'text-red-500' : 'text-blue-500'} />
        <span className={`font-semibold ${needsConfirm ? 'text-red-700' : 'text-blue-700'}`}>
          {tier.label}
        </span>
      </div>

      {isSpecial ? (
        <p className="text-red-600">超远途订单，请人工报价</p>
      ) : (
        <div className={`space-y-1 ${needsConfirm ? 'text-red-600' : 'text-blue-600'}`}>
          <div className="flex justify-between">
            <span>返程时间费（{tier.returnHours}小时 × ${v?.hourlyRate}）</span>
            <span>${remote.returnFee}</span>
          </div>
          <div className="flex justify-between">
            <span>油费</span>
            <span>{tier.fuelMin === tier.fuelMax ? `$${tier.fuelMin}` : `$${tier.fuelMin}–$${tier.fuelMax}`}</span>
          </div>
          <div className={`flex justify-between font-bold pt-1 border-t ${needsConfirm ? 'border-red-200' : 'border-blue-200'}`}>
            <span>远程附加费</span>
            <span>${remote.total}</span>
          </div>
          {needsConfirm && (
            <p className="text-xs text-red-500 mt-1">⚠️ 超过120km，建议人工确认最终价格</p>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">
        超过30km将产生额外返程时间费和油费，请与客户说明。
      </p>
    </div>
  )
}

function getCustomerLevel(count) {
  if (count <= 1) return ''
  if (count === 2) return '⭐'
  if (count === 3) return '⭐⭐'
  if (count === 4) return '⭐⭐⭐'
  if (count === 5) return '🌙'
  if (count === 6) return '🌙⭐'
  if (count === 7) return '🌙⭐⭐'
  if (count === 8) return '🌙⭐⭐⭐'
  return '🌙🌙'
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-transparent'
const selectCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-200'
const errorCls = 'border-red-300 ring-1 ring-red-200'
