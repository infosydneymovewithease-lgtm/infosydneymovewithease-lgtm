import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { calcTotal, billedHours, formatDuration } from '../utils/pricing'
import { VEHICLES, STAIRS_FEE } from '../data/vehicles'
import { HEAVY_ITEM_OPTIONS, calcHeavyTotal } from '../data/heavyItems'
import { ArrowLeft, Upload, X } from 'lucide-react'

export default function FormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { orders, timerState, completeOrder, setTimerState } = useApp()
  const order = orders.find(o => o.id === id)
  const v = VEHICLES[order?.vehicle]

  const elapsed = timerState?.elapsed || 0
  const startTime = timerState?.startTime
  const endTime = timerState?.endTime

  // 回程费
  const [returnFee, setReturnFee] = useState(String(v?.returnFee ?? ''))

  // 楼梯费 — 同步自客户/客服订单的 stairFee（反算楼层数）
  const orderStairFee = Number(order?.stairFee) || 0
  const stairsPerFloor = STAIRS_FEE[v?.people || 1] || 10
  const inferredFloors = orderStairFee > 0 ? Math.round(orderStairFee / stairsPerFloor) : 0
  const stairsPrefilled = inferredFloors > 0
  const [hasElevator, setHasElevator] = useState(!stairsPrefilled)
  const [floors, setFloors] = useState(stairsPrefilled ? String(inferredFloors) : '')

  // 重物费 — 跟客服派单同结构（13 项 + 1 其他），从 order.heavyItems 自动同步
  const [heavyItems, setHeavyItemsState] = useState(() => order?.heavyItems || {})
  const heavyItemsPrefilled = !!(order?.heavyItems && Object.keys(order.heavyItems).length > 0)
  function setHeavyItem(id, amount) {
    setHeavyItemsState(prev => ({ ...prev, [id]: amount }))
  }
  function setOtherHeavyField(field, value) {
    setHeavyItemsState(prev => ({
      ...prev,
      other: { ...(prev.other || {}), [field]: value }
    }))
  }

  // 其他附加费
  const [highway, setHighway] = useState(false)
  const [highwayAmount, setHighwayAmount] = useState('30')
  const [parkingViolation, setParkingViolation] = useState(false)

  // 物资 — 跟客户下单/客服派单同结构（4 个标准物资数量 + 其他金额）
  // 师傅打开账单时数量预填客户预订值，可在现场加减
  const rm = order?.requestedMaterials
  const [materialCounts, setMaterialCounts] = useState({
    boxes:           rm?.boxes           || 0,
    wrapItems:       rm?.wrapItems       || 0,
    mattressCovers:  rm?.mattressCovers  || 0,
    packingItems:    rm?.packingItems    || 0,
  })
  const [otherSupplies, setOtherSupplies] = useState('')

  // 物资合计（自动计算）
  const suppliesTotal =
    materialCounts.boxes          * 5  +
    materialCounts.wrapItems      * 3  +
    materialCounts.mattressCovers * 10 +
    materialCounts.packingItems   * 5  +
    (Number(otherSupplies) || 0)
  const supplies = String(suppliesTotal)

  // 油费
  const [fuel, setFuel] = useState('')

  // 支付/折扣/定金/状态
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [discount, setDiscount] = useState(0)
  const [deposit, setDeposit] = useState(order?.depositPaid ? order?.deposit || 0 : 0)
  const [paymentStatus, setPaymentStatus] = useState('paid') // 'paid' | 'partial' | 'unpaid'
  const [amountOwed, setAmountOwed] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [workerNote, setWorkerNote] = useState(order?.workerNote || '')
  const [transferScreenshot, setTransferScreenshot] = useState(null)
  const fileInputRef = useRef(null)

  if (!order || !v) return null

  const billed = billedHours(elapsed, v.minHours)

  // 重物费汇总（自动从 13 项 + 其他算出来）
  const heavyFee = calcHeavyTotal(heavyItems)

  const result = calcTotal({
    vehicle: order.vehicle,
    workSeconds: elapsed,
    returnFee,
    startTime,
    endTime,
    hasElevator,
    floors,
    heavyFee,
    highway,
    highwayAmount,
    parkingViolation,
    fragile: '',
    supplies,
    fuel,
    discount,
    paymentMethod,
    deposit,
  })

  function handleSubmit() {
    if (paymentMethod === 'transfer' && !transferScreenshot) return
    completeOrder(id, {
      finalAmount: result?.total,
      billedHours: billed,
      paymentMethod,
      paymentStatus,
      completedAt: new Date().toISOString(),
      stairsFee: result?.stairsFee || 0,
      overtimeFee: result?.overtimeFee || 0,
      heavyFee: result?.heavyFee || 0,
      // 保留师傅最终确认的结构化重物数据（覆盖客服派单时的预填）
      heavyItems: heavyItems,
      fragileFee: 0,
      // Full breakdown fields (saved to dedicated columns in orders)
      timeFee:        result?.timeFee || 0,
      returnFee:      Number(returnFee) || 0,
      highwayFee:     result?.highwayFee || 0,
      parkingFee:     result?.parkingFee || 0,
      suppliesFee:    Number(supplies) || 0,
      // 保留师傅最终确认的物资数量（覆盖客户预订值），让后台能看到现场实际给了多少
      requestedMaterials: {
        boxes:           materialCounts.boxes,
        wrapItems:       materialCounts.wrapItems,
        mattressCovers:  materialCounts.mattressCovers,
        packingItems:    materialCounts.packingItems,
        otherAmount:     Number(otherSupplies) || 0,
      },
      fuelFee:        Number(fuel) || 0,
      discountAmount: result?.discountAmount || 0,
      gst:            result?.gst || 0,
      hourlyRate:     v.hourlyRate,
      workerNote:     workerNote.trim() || null,
    })
    setTimerState(null)
    navigate(`/order/${id}/summary`, {
      state: { result, order, billed, paymentMethod, paymentStatus, amountOwed, paymentNote, elapsed }
    })
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-96">
      {/* Header */}
      <div className="px-4 pt-12 pb-5 md:pt-8 shadow-sm"
        style={{ background: 'linear-gradient(135deg, #6b1414 0%, #9b1c1c 50%, #c0392b 100%)' }}>
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-red-200">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-white font-bold text-lg">填写账单</h1>
            <p className="text-red-300 text-xs">{order.customerName} · {order.vehicle}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-3">

        {/* 工时摘要（只读） */}
        <Section title="工时摘要">
          <Row label="实际工作时长">{formatDuration(elapsed)}</Row>
          <Row label="计费时长">
            <span className="font-bold text-blue-600">{billed} 小时</span>
            {billed <= v.minHours && (
              <span className="text-amber-500 text-xs ml-1">(起步 {v.minHours}h)</span>
            )}
          </Row>
          <Row label="时薪">${v.hourlyRate}/小时</Row>
          <Row label="工时费">
            <span className="font-semibold text-gray-900">${result?.timeFee?.toFixed(2)}</span>
          </Row>
        </Section>

        {/* 回程费 */}
        <Section title="回程费">
          <p className="text-gray-400 text-xs mb-3">30公里以内默认收1小时回程费，超出可修改</p>
          <MoneyInput value={returnFee} onChange={setReturnFee} quickAdds={[10, 50, 100]} />
        </Section>

        {/* 楼梯费 */}
        <Section title="楼梯费">
          {stairsPrefilled && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              <p className="text-xs text-amber-800 font-medium">
                🪜 客户下单时填了「无电梯 {inferredFloors} 层」（已自动选好，可现场调整）
              </p>
            </div>
          )}
          <Toggle label="有电梯" value={hasElevator} onChange={v => { setHasElevator(v); if (v) setFloors('') }} />
          {!hasElevator && (
            <div className="mt-3 space-y-2">
              <p className="text-gray-500 text-sm">无电梯楼层数</p>
              <MoneyInput
                value={floors}
                onChange={setFloors}
                placeholder="层数"
                quickAdds={[1, 2, 3]}
                integer
              />
              {Number(floors) > 0 && (
                <div className="bg-blue-50 rounded-lg px-3 py-2">
                  <p className="text-blue-700 text-sm">
                    {Number(floors)} 层 × ${STAIRS_FEE[v.people]}/层 =
                    <strong> ${result?.stairsFee}</strong>
                  </p>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* 重物费 */}
        <Section title="附加费用">
          {heavyItemsPrefilled && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              <p className="text-xs text-amber-800 font-medium">
                💪 客服已确认重物（已自动填入金额，可现场加减）
              </p>
            </div>
          )}
          {/* 14 项单列 + 其他重物 */}
          <div className="space-y-2">
            {HEAVY_ITEM_OPTIONS.map(item => (
              <WorkerHeavyItemRow
                key={item.id}
                label={item.name}
                value={heavyItems[item.id] || ''}
                onChange={amt => setHeavyItem(item.id, amt)}
              />
            ))}
            {/* 其他重物（带描述）*/}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-sm font-medium text-gray-700 mb-2">其他重物（自定义）</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={heavyItems.other?.description || ''}
                  onChange={e => setOtherHeavyField('description', e.target.value)}
                  placeholder="物品名称（如：保险柜）"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <div className="flex items-center gap-2 sm:w-40">
                  <span className="text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    value={heavyItems.other?.amount || ''}
                    onChange={e => setOtherHeavyField('amount', e.target.value)}
                    placeholder="0"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {heavyFee > 0 && (
            <div className="mt-3 bg-blue-50 rounded-lg px-3 py-2 flex items-center justify-between">
              <p className="text-blue-700 text-sm font-medium">重物费合计</p>
              <span className="text-blue-700 font-bold">${heavyFee}</span>
            </div>
          )}
        </Section>

        {/* 其他费用 */}
        <Section title="其他费用">
          {/* 高速费 */}
          <Toggle label="走高速" value={highway} onChange={setHighway} />
          {highway && (
            <div className="mt-2">
              <p className="text-gray-400 text-xs mb-1.5">默认 $30，可修改</p>
              <MoneyInput value={highwayAmount} onChange={setHighwayAmount} quickAdds={[10, 30]} />
            </div>
          )}

          {/* 违章停车 */}
          <div className="mt-3">
            <Toggle label="违章停车（押金 $300）" value={parkingViolation} onChange={setParkingViolation} />
            {parkingViolation && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-red-600 text-sm">预收违章押金 <strong>$300</strong>，2个月无罚单退回</p>
              </div>
            )}
          </div>

          {/* 物资费用 — 跟客户下单同款 4 个数量 + 其他 */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600 text-sm">物资费用</p>
              {rm && (rm.boxes || rm.wrapItems || rm.mattressCovers || rm.packingItems) > 0 && (
                <span className="text-xs text-amber-600 font-medium">📦 客户预订已填入，可现场调整</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <SupplyRow
                label="纸箱"   unit="个" price={5}
                value={materialCounts.boxes}
                onChange={n => setMaterialCounts(p => ({ ...p, boxes: Math.max(0, n) }))}
              />
              <SupplyRow
                label="打包膜" unit="卷" price={3}
                value={materialCounts.wrapItems}
                onChange={n => setMaterialCounts(p => ({ ...p, wrapItems: Math.max(0, n) }))}
              />
              <SupplyRow
                label="床垫套" unit="个" price={10}
                value={materialCounts.mattressCovers}
                onChange={n => setMaterialCounts(p => ({ ...p, mattressCovers: Math.max(0, n) }))}
              />
              <SupplyRow
                label="打包物品" unit="件" price={5}
                value={materialCounts.packingItems}
                onChange={n => setMaterialCounts(p => ({ ...p, packingItems: Math.max(0, n) }))}
              />
            </div>
            <div className="mb-2">
              <p className="text-gray-500 text-xs mb-1">其他物资（自定义金额）</p>
              <MoneyInput value={otherSupplies} onChange={setOtherSupplies} quickAdds={[5, 10, 20]} />
            </div>
            {suppliesTotal > 0 && (
              <div className="bg-blue-50 rounded-lg px-3 py-1.5 flex items-center justify-between">
                <span className="text-xs text-blue-700 font-medium">物资合计</span>
                <span className="text-blue-700 font-bold">${suppliesTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="mt-3">
            <p className="text-gray-600 text-sm mb-1.5">油费</p>
            <MoneyInput value={fuel} onChange={setFuel} quickAdds={[10, 20, 50]} />
          </div>
        </Section>

        {/* 加班费（自动，只读） */}
        {result?.overtimeFee > 0 && (
          <Section title="加班费（自动计算）">
            <div className="bg-amber-50 rounded-lg px-3 py-2">
              <p className="text-amber-700 text-sm">
                8点前 / 20点后加班 → <strong>${result.overtimeFee.toFixed(2)}</strong>
                <span className="text-amber-500 text-xs ml-1">($10/小时/人，{v.people}人)</span>
              </p>
            </div>
          </Section>
        )}

        {/* 支付方式 */}
        <Section title="支付方式">
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: 'cash',     label: '💵 现金' },
              { val: 'transfer', label: '🏦 银行转账' },
            ].map(m => (
              <button key={m.val} onClick={() => setPaymentMethod(m.val)}
                className={`py-3 rounded-xl font-semibold text-sm border-2 transition-colors ${
                  paymentMethod === m.val
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {paymentMethod === 'transfer' && (
            <p className="text-amber-600 text-xs mt-2">转账加收 10% GST</p>
          )}
          {paymentMethod === 'transfer' && (
            <div className="mt-3">
              <p className="text-gray-700 text-sm font-medium mb-2">
                上传转账截图 <span className="text-red-500">*</span>
              </p>
              {transferScreenshot ? (
                <div className="relative">
                  <img src={transferScreenshot} alt="转账截图" className="w-full rounded-xl border border-gray-200 max-h-48 object-contain bg-gray-50" />
                  <button
                    onClick={() => setTransferScreenshot(null)}
                    className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                >
                  <Upload size={24} />
                  <span className="text-sm">点击上传截图</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = ev => setTransferScreenshot(ev.target.result)
                  reader.readAsDataURL(file)
                }}
              />
            </div>
          )}
        </Section>

        {/* 折扣 */}
        <Section title="折扣">
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: 0,   label: '无折扣' },
              { val: 9.5, label: '九五折' },
              { val: 9,   label: '九折' },
            ].map(opt => (
              <button key={opt.val} onClick={() => setDiscount(opt.val)}
                className={`py-3 rounded-xl font-semibold text-sm border-2 transition-colors ${
                  discount === opt.val
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Section>

        {/* 定金 */}
        <Section title="定金（必填）">
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: 0,                  label: '无定金' },
              { val: order?.deposit || 30, label: `$${order?.deposit || 30} 已收` },
            ].map(d => (
              <button key={d.val} onClick={() => setDeposit(d.val)}
                className={`py-3 rounded-xl font-semibold text-sm border-2 transition-colors ${
                  deposit === d.val
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </Section>

        {/* 付款状态 */}
        <Section title="付款状态">
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: 'paid',    label: '✅ 已付款' },
              { val: 'partial', label: '⏳ 部分付款' },
              { val: 'unpaid',  label: '❌ 未付款' },
            ].map(s => (
              <button key={s.val} onClick={() => setPaymentStatus(s.val)}
                className={`py-3 rounded-xl font-semibold text-xs border-2 transition-colors ${
                  paymentStatus === s.val
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {(paymentStatus === 'partial' || paymentStatus === 'unpaid') && (
            <div className="mt-3 space-y-2">
              {paymentStatus === 'partial' && (
                <div>
                  <p className="text-gray-600 text-sm mb-1.5">欠款金额 ($)</p>
                  <MoneyInput value={amountOwed} onChange={setAmountOwed} quickAdds={[50, 100, 200]} />
                </div>
              )}
              <input
                type="text"
                value={paymentNote}
                onChange={e => setPaymentNote(e.target.value)}
                placeholder="追款备注（欠款人、说明等）"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          )}
        </Section>

        {/* 师傅备注（特殊情况说明） */}
        <Section title="备注（可选）">
          <textarea
            value={workerNote}
            onChange={e => setWorkerNote(e.target.value)}
            placeholder="特殊情况说明，例如：客户临时加点、楼下不能停车、家具拆装超时等"
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        </Section>

      </div>

      {/* 固定底部：总价 + 提交 */}
      {result && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white border-t border-gray-200 px-4 pt-3 pb-6 shadow-lg">
          <div className="space-y-1 mb-3">
            {result.vanDiscount > 0 && <FeeRow label="面包车优惠" value={-result.vanDiscount} green />}
            <FeeRow label="小计" value={result.subtotal} />
            {result.discountAmount > 0 && <FeeRow label="折扣" value={-result.discountAmount} green />}
            {result.gst > 0 && <FeeRow label="GST (10%)" value={result.gst} />}
            {result.parkingFee > 0 && <FeeRow label="违章押金" value={result.parkingFee} />}
            {result.deposit > 0 && <FeeRow label="已收定金" value={-result.deposit} muted />}
            <div className="flex justify-between items-center font-bold text-lg pt-1 border-t border-gray-100">
              <span className="text-gray-900">应收总额</span>
              <span className="text-green-600">${result.total.toFixed(2)}</span>
            </div>
          </div>
          {paymentMethod === 'transfer' && !transferScreenshot && (
            <p className="text-red-500 text-xs text-center mb-2">请先上传转账截图</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={paymentMethod === 'transfer' && !transferScreenshot}
            className="w-full text-white py-4 rounded-xl font-bold text-base active:opacity-90 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #8B1A1A, #c0392b)' }}
          >
            确认提交
          </button>
        </div>
      )}
    </div>
  )
}

// ── 子组件 ──────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      {title && (
        <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="text-gray-800 text-sm">{children}</span>
    </div>
  )
}

function FeeRow({ label, value, green, muted }) {
  const formatted = value < 0
    ? `-$${Math.abs(value).toFixed(2)}`
    : `$${value.toFixed(2)}`
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={green ? 'text-green-600' : muted ? 'text-gray-400' : 'text-gray-700'}>
        {formatted}
      </span>
    </div>
  )
}

function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-700 text-sm">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors ${value ? 'bg-blue-500' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

// 金额输入框：可直接输入 + 快捷按钮
function MoneyInput({ value, onChange, placeholder = '0', quickAdds = [10, 50, 100], integer = false }) {
  function add(n) {
    const current = integer ? parseInt(value) || 0 : parseFloat(value) || 0
    onChange(String(current + n))
  }
  function handleChange(e) {
    const raw = e.target.value
    if (integer) {
      onChange(raw.replace(/[^0-9]/g, ''))
    } else {
      onChange(raw.replace(/[^0-9.]/g, ''))
    }
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex-1">
        {!integer && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
        )}
        <input
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={`w-full ${integer ? 'px-3' : 'pl-7 pr-3'} py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-right`}
        />
      </div>
      {quickAdds.map(n => (
        <button
          key={n}
          onClick={() => add(n)}
          className="px-2.5 py-2.5 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 active:bg-gray-200 whitespace-nowrap"
        >
          +{n}
        </button>
      ))}
    </div>
  )
}

// 重物项目行（项目名 + 金额输入，跟客服派单同款）
function WorkerHeavyItemRow({ label, value, onChange }) {
  const enabled = Number(value) > 0
  return (
    <div className={`rounded-xl px-3 py-2 flex items-center gap-3 transition-colors ${
      enabled ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
    }`}>
      <span className="text-sm text-gray-700 flex-1 font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-gray-400 text-sm">$</span>
        <input
          type="number"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className="w-20 px-2 py-1.5 border border-gray-200 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
      </div>
    </div>
  )
}

// 物资数量行（跟客户/客服派单同款）
function SupplyRow({ label, unit, price, value, onChange }) {
  return (
    <div className="bg-gray-50 rounded-xl p-2.5 text-center">
      <p className="text-xs text-gray-700 font-medium mb-0.5">{label}</p>
      <p className="text-xs text-gray-400 mb-1.5">${price}/{unit}</p>
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-300 active:bg-gray-400"
        >
          −
        </button>
        <span className="w-8 text-center font-semibold text-gray-800 text-sm">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 rounded-full bg-red-100 text-red-600 font-bold text-sm hover:bg-red-200 active:bg-red-300"
        >
          ＋
        </button>
      </div>
      {value > 0 && (
        <p className="text-xs text-green-600 font-semibold mt-1">${value * price}</p>
      )}
    </div>
  )
}
