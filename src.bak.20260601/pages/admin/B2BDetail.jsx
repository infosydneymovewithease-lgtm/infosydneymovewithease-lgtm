import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { ArrowLeft, Phone, Edit3, Save, X } from 'lucide-react'

const LEVELS = ['A', 'B', 'C']
const STATUSES = ['合作中', '暂停合作', '已终止']
const PAYMENT_MODES = [
  { value: 'b2b_monthly', label: '月结挂账', desc: '订单跳过定金，月底统一对账' },
  { value: 'cash',        label: '散单结算', desc: '按普通客户流程收定金' },
]

export default function B2BDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { b2bCustomers, updateB2BCustomer, createB2BCustomer } = useApp()

  const isNew = id === 'new'
  const existing = isNew ? null : b2bCustomers.find(c => c.id === id)

  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState(existing || {
    companyName: '', contactName: '', phone: '', wechat: '',
    address: '', abn: '', level: 'B', status: '合作中',
    paymentMode: 'b2b_monthly',
    monthlyOrders: 0, specialPricing: '', notes: '',
  })

  if (!isNew && !existing) return (
    <div className="flex items-center justify-center h-64 text-gray-400">企业客户不存在</div>
  )

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleSave() {
    if (!form.companyName || !form.contactName) return
    if (isNew) {
      const created = createB2BCustomer(form)
      navigate(`/admin/b2b/${created.id}`, { replace: true })
    } else {
      updateB2BCustomer(id, form)
      setEditing(false)
    }
  }

  function handleCancel() {
    if (isNew) { navigate(-1); return }
    setForm(existing)
    setEditing(false)
  }

  const c = editing ? form : existing || form
  const lvlColor = c.level === 'A' ? 'bg-red-100 text-red-700' : c.level === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'

  return (
    <div className="p-5 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">
              {isNew ? '新增企业客户' : c.companyName}
            </h1>
            {!isNew && <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${lvlColor}`}>{c.level}级</span>}
            {!isNew && c.status !== '合作中' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">{c.status}</span>
            )}
          </div>
          {!isNew && <p className="text-gray-400 text-xs mt-0.5">{c.id} · 合作自 {c.createdAt}</p>}
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            <Edit3 size={14} /> 编辑
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleCancel}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">
              <X size={14} /> 取消
            </button>
            <button onClick={handleSave} disabled={!form.companyName || !form.contactName}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
              <Save size={14} /> 保存
            </button>
          </div>
        )}
      </div>

      {/* Basic info */}
      <Card title="基本信息">
        <Row label="公司名称" required editing={editing}>
          {editing
            ? <input value={form.companyName} onChange={e => set('companyName', e.target.value)} className={inputCls} placeholder="公司全称" />
            : <span className="font-semibold">{c.companyName}</span>}
        </Row>
        <Row label="联系人" required editing={editing}>
          {editing
            ? <input value={form.contactName} onChange={e => set('contactName', e.target.value)} className={inputCls} placeholder="联系人姓名" />
            : c.contactName}
        </Row>
        <Row label="联系电话" editing={editing}>
          {editing
            ? <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder="04xxxxxxxx" />
            : c.phone ? (
              <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-green-600 font-medium">
                <Phone size={13} />{c.phone}
              </a>
            ) : '—'}
        </Row>
        <Row label="微信" editing={editing}>
          {editing
            ? <input value={form.wechat} onChange={e => set('wechat', e.target.value)} className={inputCls} placeholder="微信号" />
            : c.wechat || '—'}
        </Row>
        <Row label="地址" editing={editing}>
          {editing
            ? <input value={form.address} onChange={e => set('address', e.target.value)} className={inputCls} placeholder="公司地址" />
            : c.address || '—'}
        </Row>
        <Row label="ABN" editing={editing}>
          {editing
            ? <input value={form.abn} onChange={e => set('abn', e.target.value)} className={inputCls} placeholder="12 345 678 901" />
            : c.abn || '—'}
        </Row>
      </Card>

      {/* Business info */}
      <Card title="合作信息">
        <Row label="客户级别" editing={editing}>
          {editing ? (
            <div className="flex gap-2">
              {LEVELS.map(l => (
                <button key={l} type="button" onClick={() => set('level', l)}
                  className={`px-4 py-1.5 rounded-lg border-2 text-sm font-bold transition-colors ${
                    form.level === l ? (l === 'A' ? 'border-red-300 bg-red-50 text-red-700' : l === 'B' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 bg-gray-50 text-gray-600') : 'border-gray-200 text-gray-400'
                  }`}>{l}级</button>
              ))}
            </div>
          ) : <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${lvlColor}`}>{c.level}级</span>}
        </Row>
        <Row label="合作状态" editing={editing}>
          {editing ? (
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          ) : c.status}
        </Row>
        <Row label="结算方式" editing={editing}>
          {editing ? (
            <div className="space-y-1.5">
              {PAYMENT_MODES.map(m => (
                <label key={m.value} className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                  <input
                    type="radio"
                    checked={form.paymentMode === m.value}
                    onChange={() => set('paymentMode', m.value)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{m.label}</div>
                    <div className="text-xs text-gray-400">{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            (() => {
              const mode = PAYMENT_MODES.find(m => m.value === (c.paymentMode || 'b2b_monthly'))
              return (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  mode?.value === 'b2b_monthly' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {mode?.label || '月结挂账'}
                </span>
              )
            })()
          )}
        </Row>
        <Row label="月均订单" editing={editing}>
          {editing
            ? <input type="number" value={form.monthlyOrders} onChange={e => set('monthlyOrders', Number(e.target.value))} className={inputCls} placeholder="0" />
            : `约 ${c.monthlyOrders || 0} 单/月`}
        </Row>
        <Row label="特殊定价" editing={editing}>
          {editing
            ? <input value={form.specialPricing} onChange={e => set('specialPricing', e.target.value)} className={inputCls} placeholder="如：大卡车9折，免回程费" />
            : c.specialPricing ? <span className="text-blue-600">{c.specialPricing}</span> : '按标准价格'}
        </Row>
      </Card>

      {/* Notes */}
      <Card title="备注">
        {editing ? (
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            rows={3} className={`${inputCls} resize-none`} placeholder="合作备注、注意事项..." />
        ) : (
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
            {c.notes || <span className="text-gray-300">暂无备注</span>}
          </p>
        )}
      </Card>

      {/* Delete / status change */}
      {!isNew && !editing && c.status === '合作中' && (
        <button
          onClick={() => { if (window.confirm('确认暂停与该企业的合作？')) updateB2BCustomer(id, { status: '暂停合作' }) }}
          className="w-full py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50">
          暂停合作
        </button>
      )}
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-4 py-3 space-y-2.5">{children}</div>
    </div>
  )
}

function Row({ label, required, editing, children }) {
  return (
    <div className={`flex ${editing ? 'flex-col gap-1' : 'items-center justify-between'} py-0.5`}>
      <span className="text-gray-500 text-sm flex-shrink-0">
        {label}{required && editing && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      <span className="text-gray-800 text-sm font-medium">{children}</span>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-200'
