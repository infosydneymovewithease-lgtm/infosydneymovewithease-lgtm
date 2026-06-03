import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { ArrowLeft } from 'lucide-react'
import dayjs from 'dayjs'
import { getStorageRates, FREE_SUPPLIES_LABEL } from '../../data/storageRates'

function calcStorageFee(boxes, furniture, moveInDate, moveOutDate) {
  const days = dayjs(moveOutDate).diff(dayjs(moveInDate), 'day')
  const weeks = Math.max(1, Math.ceil(days / 7))
  const { boxRate, furRate, shortTerm, freeSupplies } = getStorageRates(weeks)
  const weeklyFee = boxes * boxRate + furniture * furRate
  return { weeks, boxRate, furRate, weeklyFee, total: weeklyFee * weeks, shortTerm, freeSupplies }
}

export default function NewStorage() {
  const navigate = useNavigate()
  const { createStorageOrder, user } = useApp()
  const [submitted, setSubmitted] = useState(false)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    wechat: '',
    moveInDate: dayjs().format('YYYY-MM-DD'),
    moveOutDate: dayjs().add(5, 'week').format('YYYY-MM-DD'),
    boxes: 0,
    furniture: 0,
    items: '',
    location: '',
    paymentStatus: '',
    deposit: 0,
    notes: '',
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const { weeks, boxRate, furRate, weeklyFee, total: totalFee, shortTerm, freeSupplies } = calcStorageFee(
    form.boxes, form.furniture, form.moveInDate, form.moveOutDate
  )

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitted(true)
    if (!form.customerName || !form.customerPhone || !form.moveInDate || !form.moveOutDate) return
    if (!form.paymentStatus) return
    if (form.boxes === 0 && form.furniture === 0) return

    try {
      await createStorageOrder({
        ...form,
        createdBy: user?.id,
        createdByName: user?.name,
        weeklyFee,
        totalFee,
        weeks,
        boxRate,
        furRate,
      })
    } catch (err) {
      alert(err.message || '创建寄存订单失败，请重试')
      setSubmitted(false)
      return
    }
    setSuccess(true)
    setSubmitted(false)
    setForm({
      customerName: '', customerPhone: '', wechat: '',
      moveInDate: dayjs().format('YYYY-MM-DD'),
      moveOutDate: dayjs().add(5, 'week').format('YYYY-MM-DD'),
      boxes: 0, furniture: 0,
      items: '', location: '', paymentStatus: '', deposit: 0, notes: '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const err = k => submitted && !form[k]

  return (
    <div className="max-w-2xl mx-auto p-5">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">新建寄存</h1>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 mb-4 flex items-center gap-3">
          <span className="text-green-500 text-xl">✅</span>
          <div>
            <p className="text-green-800 font-semibold text-sm">寄存登记成功！</p>
            <p className="text-green-600 text-xs mt-0.5">表单已清空，可继续登记下一条</p>
          </div>
          <button onClick={() => navigate('/admin/storage')} className="ml-auto text-green-600 text-xs font-semibold hover:underline">查看列表</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* 客户信息 */}
        <Section title="客户信息">
          <div className="grid grid-cols-2 gap-3">
            <Field label="客户姓名" required>
              <input value={form.customerName} onChange={e => set('customerName', e.target.value)}
                placeholder="姓名" className={`${inputCls} ${err('customerName') ? errorCls : ''}`} />
            </Field>
            <Field label="手机号" required>
              <input value={form.customerPhone} onChange={e => set('customerPhone', e.target.value)}
                placeholder="04xxxxxxxx" className={`${inputCls} ${err('customerPhone') ? errorCls : ''}`} />
            </Field>
            <Field label="微信号">
              <input value={form.wechat} onChange={e => set('wechat', e.target.value)}
                placeholder="选填" className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* 寄存期限 */}
        <Section title="寄存期限">
          <div className="grid grid-cols-2 gap-3">
            <Field label="入库日期" required>
              <input type="date" value={form.moveInDate} onChange={e => set('moveInDate', e.target.value)}
                className={`${inputCls} ${err('moveInDate') ? errorCls : ''}`} />
            </Field>
            <Field label="预计取件日期" required>
              <input type="date" value={form.moveOutDate} onChange={e => set('moveOutDate', e.target.value)}
                className={`${inputCls} ${err('moveOutDate') ? errorCls : ''}`} />
            </Field>
          </div>
          {weeks > 0 && (
            <div className="bg-blue-50 rounded-xl px-3 py-2 text-sm text-blue-700">
              寄存期：约 <strong>{weeks}</strong> 周
              <span className="ml-2 text-blue-500 text-xs">
                {shortTerm ? '（≤5周，短期价格）' : '（>5周，长期价格）'}
              </span>
            </div>
          )}
        </Section>

        {/* 物品信息 */}
        <Section title="寄存物品">
          <div className="grid grid-cols-2 gap-3">
            <CounterField label="纸箱（件）" value={form.boxes} onChange={v => set('boxes', v)} />
            <CounterField label="家具（件）" value={form.furniture} onChange={v => set('furniture', v)} />
          </div>
          {submitted && form.boxes === 0 && form.furniture === 0 && (
            <p className="text-red-500 text-xs">请填写至少一项物品数量</p>
          )}
          <Field label="物品描述">
            <textarea value={form.items} onChange={e => set('items', e.target.value)}
              placeholder="如：行李箱3个、单人床架1套、书箱5个..." rows={2} className={inputCls} />
          </Field>
          <Field label="仓位编号（可选）">
            <input value={form.location} onChange={e => set('location', e.target.value)}
              placeholder="如：A区-03" className={inputCls} />
          </Field>
        </Section>

        {/* 计费（按周，阶梯价格） */}
        <Section title="费用估算">
          <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-500 space-y-0.5">
            <div className="flex justify-between"><span>≤ 5周（短期）</span><span>纸箱 $5/件/周　家具 $10/件/周</span></div>
            <div className="flex justify-between"><span>&gt; 5周（长期）</span><span>纸箱 $4/件/周　家具 $8/件/周　+ 免费物资</span></div>
          </div>
          {freeSupplies && (form.boxes > 0 || form.furniture > 0) && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm text-green-700">
              ✅ 此订单 &gt;5 周，含免费物资（{FREE_SUPPLIES_LABEL}）
            </div>
          )}

          {(form.boxes > 0 || form.furniture > 0) && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5 text-sm">
              {form.boxes > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>纸箱 {form.boxes}件 × ${boxRate}/周</span>
                  <span>${form.boxes * boxRate}/周</span>
                </div>
              )}
              {form.furniture > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>家具 {form.furniture}件 × ${furRate}/周</span>
                  <span>${form.furniture * furRate}/周</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-1.5 flex justify-between font-semibold text-gray-800">
                <span>每周小计</span>
                <span>${weeklyFee}/周</span>
              </div>
              <div className="flex justify-between font-bold text-green-700 text-base">
                <span>共 {weeks} 周，合计</span>
                <span>${totalFee}</span>
              </div>
            </div>
          )}

          <Field label="定金 $">
            <input type="number" value={form.deposit || ''} onChange={e => set('deposit', Number(e.target.value))}
              placeholder="0" className={inputCls} />
          </Field>

          <Field label="付款状态" required>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: '已付',   label: '✅ 已付清',  cls: 'border-green-300 bg-green-50 text-green-700' },
                { val: '定金',   label: '⏳ 仅付定金', cls: 'border-amber-300 bg-amber-50 text-amber-700' },
                { val: '未付',   label: '❌ 未付款',   cls: 'border-red-200 bg-red-50 text-red-600' },
              ].map(opt => (
                <button key={opt.val} type="button" onClick={() => set('paymentStatus', opt.val)}
                  className={`py-2.5 px-2 rounded-xl border-2 text-sm font-semibold transition-colors ${
                    form.paymentStatus === opt.val ? opt.cls : 'border-gray-200 text-gray-500'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {submitted && !form.paymentStatus && <p className="text-red-500 text-xs mt-1">请选择付款状态</p>}
          </Field>
        </Section>

        {/* 备注 */}
        <Section title="备注">
          <Field label="备注">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="特殊说明、注意事项..." rows={2} className={inputCls} />
          </Field>
          <div className="flex items-center justify-between py-1 px-1">
            <span className="text-sm text-gray-500">登记人</span>
            <span className="text-sm font-semibold text-gray-800">{user?.name || '-'}</span>
          </div>
        </Section>

        {submitted && <p className="text-red-500 text-sm text-center">请检查必填项</p>}

        <div className="flex gap-3 pb-8">
          <button type="button" onClick={() => navigate(-1)}
            className="flex-1 py-4 rounded-xl border border-gray-200 text-gray-600 font-semibold">
            取消
          </button>
          <button type="submit"
            className="flex-1 py-4 rounded-xl text-white font-semibold shadow-sm"
            style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
            登记入库
          </button>
        </div>
      </form>
    </div>
  )
}

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

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function CounterField({ label, value, onChange }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-500 mb-2 leading-tight">{label}</p>
      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 font-bold hover:bg-gray-300">−</button>
        <span className="w-8 text-center font-bold text-gray-800 text-lg">{value}</span>
        <button type="button" onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-full bg-red-100 text-red-600 font-bold hover:bg-red-200">+</button>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-transparent'
const errorCls = 'border-red-300 ring-1 ring-red-200'
