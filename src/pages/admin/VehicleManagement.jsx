import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, ToggleLeft, ToggleRight, Edit3, Check, X } from 'lucide-react'

const TYPE_LABELS = { van: '面包车', small_truck: '小卡车', big_truck: '大卡车' }
const TYPE_OPTIONS = [
  { value: 'van',         label: '面包车 (Van)' },
  { value: 'small_truck', label: '小卡车 (Small Truck)' },
  { value: 'big_truck',   label: '大卡车 (Big Truck)' },
]
const EMPTY_FORM = { vehicle_name: '', vehicle_type: 'van', max_orders_per_day: 3, notes: '' }

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading]   = useState(true)
  const [loadErr, setLoadErr]   = useState(null)
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState({}) // { [id]: stringValue }
  const [saving, setSaving]     = useState({}) // { [id]: bool }
  const [form, setForm]         = useState(EMPTY_FORM)
  const [adding, setAdding]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('vehicle_type')
      .order('created_at')
    if (error) setLoadErr(error.message)
    else { setVehicles(data || []); setLoadErr(null) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleEnabled(v) {
    setSaving(s => ({ ...s, [v.id]: true }))
    await supabase.from('vehicles').update({ enabled: !v.enabled }).eq('id', v.id)
    await load()
    setSaving(s => ({ ...s, [v.id]: false }))
  }

  async function saveMax(v, raw) {
    const num = parseInt(raw, 10)
    if (isNaN(num) || num < 1) return
    setSaving(s => ({ ...s, [v.id]: true }))
    await supabase.from('vehicles').update({ max_orders_per_day: num }).eq('id', v.id)
    setEditing(e => { const n = { ...e }; delete n[v.id]; return n })
    await load()
    setSaving(s => ({ ...s, [v.id]: false }))
  }

  function cancelEdit(id) {
    setEditing(e => { const n = { ...e }; delete n[id]; return n })
  }

  async function handleDelete(id) {
    if (!window.confirm('确定删除该车辆？此操作不可撤销。')) return
    await supabase.from('vehicles').delete().eq('id', id)
    await load()
  }

  async function handleAdd(e) {
    e.preventDefault()
    setAdding(true)
    await supabase.from('vehicles').insert({
      vehicle_name:       form.vehicle_name.trim(),
      vehicle_type:       form.vehicle_type,
      max_orders_per_day: parseInt(form.max_orders_per_day, 10) || 3,
      notes:              form.notes.trim() || null,
      enabled:            true,
    })
    setForm(EMPTY_FORM)
    setShowAdd(false)
    setAdding(false)
    await load()
  }

  // Summary stats per type
  const byType = { van: [], small_truck: [], big_truck: [] }
  vehicles.forEach(v => { if (byType[v.vehicle_type]) byType[v.vehicle_type].push(v) })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">运力管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">管理车辆启停与每日接单上限，实时影响客户预约可选时段</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ background: '#96394E' }}
        >
          <Plus size={16} /> 添加车辆
        </button>
      </div>

      {/* Capacity summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {Object.entries(byType).map(([type, list]) => {
          const enabled = list.filter(v => v.enabled)
          const daily   = enabled.reduce((s, v) => s + v.max_orders_per_day, 0)
          return (
            <div key={type} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">{TYPE_LABELS[type]}</p>
              <p className="text-2xl font-bold text-gray-800">
                {enabled.length}
                <span className="text-sm font-normal text-gray-400"> / {list.length} 辆启用</span>
              </p>
              <p className="text-xs text-gray-500 mt-1.5">
                每日总上限 <span className="font-semibold text-gray-700">{daily}</span> 单
              </p>
              <p className="text-xs text-gray-400 mt-0.5">时段容量 {enabled.length} 单 / 时段</p>
            </div>
          )
        })}
      </div>

      {/* Vehicle table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">加载中…</div>
      ) : loadErr ? (
        <div className="text-center py-16 text-red-500 text-sm">{loadErr}</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">车辆名称</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">类型</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">每日上限</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">状态</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">删除</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-14 text-gray-400">暂无车辆，请点击右上角添加</td>
                </tr>
              ) : vehicles.map(v => (
                <tr key={v.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{v.vehicle_name}</td>
                  <td className="px-4 py-3 text-gray-500">{TYPE_LABELS[v.vehicle_type] ?? v.vehicle_type}</td>

                  {/* Inline edit for max_orders_per_day */}
                  <td className="px-4 py-3 text-center">
                    {editing[v.id] !== undefined ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number" min="1" max="99"
                          value={editing[v.id]}
                          onChange={e => setEditing(ed => ({ ...ed, [v.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  saveMax(v, editing[v.id])
                            if (e.key === 'Escape') cancelEdit(v.id)
                          }}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm focus:outline-none focus:border-red-400"
                          autoFocus
                        />
                        <button onClick={() => saveMax(v, editing[v.id])} className="text-green-600 hover:text-green-700">
                          <Check size={15} />
                        </button>
                        <button onClick={() => cancelEdit(v.id)} className="text-gray-400 hover:text-gray-600">
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditing(ed => ({ ...ed, [v.id]: String(v.max_orders_per_day) }))}
                        className="inline-flex items-center gap-1 text-gray-700 hover:text-red-700 transition-colors"
                      >
                        {v.max_orders_per_day}
                        <Edit3 size={12} className="text-gray-400" />
                      </button>
                    )}
                  </td>

                  {/* Enable / disable toggle */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleEnabled(v)}
                      disabled={saving[v.id]}
                      className="inline-flex items-center gap-1 text-sm font-medium transition-colors"
                      style={{ color: v.enabled ? '#16a34a' : '#9ca3af', opacity: saving[v.id] ? 0.5 : 1 }}
                    >
                      {v.enabled
                        ? <ToggleRight size={22} />
                        : <ToggleLeft  size={22} />}
                      {v.enabled ? '启用' : '停用'}
                    </button>
                  </td>

                  {/* Delete */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(v.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dual-layer capacity explanation */}
      <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 leading-relaxed">
        <strong>双层容量控制说明：</strong>
        每个时段最多可接 <em>启用车辆数</em> 个订单（层2·时段容量）；
        同时每天总接单数不超过所有启用车辆 max_orders_per_day 之和（层1·每日容量）。
        取消、已完成、已拒绝的订单不占用容量。
      </div>

      {/* Add vehicle modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-bold text-gray-800 mb-4">添加车辆</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">车辆名称 *</label>
                <input
                  required
                  value={form.vehicle_name}
                  onChange={e => setForm(f => ({ ...f, vehicle_name: e.target.value }))}
                  placeholder="例：面包车2"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">车型 *</label>
                <select
                  value={form.vehicle_type}
                  onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                >
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">每日最多接单数 *</label>
                <input
                  type="number" min="1" max="99" required
                  value={form.max_orders_per_day}
                  onChange={e => setForm(f => ({ ...f, max_orders_per_day: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">备注（选填）</label>
                <input
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="例：节假日停用"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}
                  className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 py-2 rounded-lg text-white text-sm font-medium transition-opacity"
                  style={{ background: '#96394E', opacity: adding ? 0.7 : 1 }}
                >
                  {adding ? '保存中…' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
