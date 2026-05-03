import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { UserPlus, Save, ToggleLeft, ToggleRight } from 'lucide-react'
import { VEHICLES } from '../../data/vehicles'

const ROLE_LABEL = { admin: '管理员', cs: '客服', worker: '师傅' }
const ROLE_COLOR = { admin: 'bg-red-100 text-red-700', cs: 'bg-blue-100 text-blue-700', worker: 'bg-green-100 text-green-700' }

export default function Settings() {
  const { staff, addStaffMember, updateStaffMember, appSettings, updateAppSettings } = useApp()
  const [tab, setTab] = useState('staff')
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [companyForm, setCompanyForm] = useState(appSettings)
  const [companySaved, setCompanySaved] = useState(false)

  const [newStaff, setNewStaff] = useState({
    name: '', username: '', password: '', role: 'worker', isDriver: false,
  })

  function setNS(k, v) { setNewStaff(f => ({ ...f, [k]: v })) }

  function handleAddStaff() {
    if (!newStaff.name || !newStaff.username || !newStaff.password) return
    if (staff.some(s => s.username === newStaff.username)) {
      alert('用户名已存在')
      return
    }
    addStaffMember({
      ...newStaff,
      canDrive: newStaff.isDriver ? ['面包车','小卡车','大卡车'] : [],
    })
    setNewStaff({ name: '', username: '', password: '', role: 'worker', isDriver: false })
    setShowAddStaff(false)
  }

  function handleSaveCompany() {
    updateAppSettings(companyForm)
    setCompanySaved(true)
    setTimeout(() => setCompanySaved(false), 2000)
  }

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-5">系统设置</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm mb-5 w-fit">
        {[['staff','员工账号'],['prices','默认价格'],['company','公司信息']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}
            style={tab === t ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Staff tab ── */}
      {tab === 'staff' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-gray-500">{staff.filter(s => s.active !== false).length} 名在职员工</p>
            <button onClick={() => setShowAddStaff(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
              <UserPlus size={14} /> 添加员工
            </button>
          </div>

          {/* Group by role */}
          {['admin','cs','worker'].map(role => {
            const group = staff.filter(s => s.role === role)
            if (!group.length) return null
            return (
              <div key={role} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{ROLE_LABEL[role]}</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {group.map(s => {
                    const active = s.active !== false
                    return (
                      <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                          active ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {s.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold text-sm ${active ? 'text-gray-900' : 'text-gray-400'}`}>{s.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${ROLE_COLOR[s.role]}`}>{ROLE_LABEL[s.role]}</span>
                            {s.isDriver && <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">司机</span>}
                            {!active && <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">已停用</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">账号：{s.username}</p>
                        </div>
                        <button onClick={() => updateStaffMember(s.id, { active: !active })}
                          className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors">
                          {active ? <ToggleRight size={24} className="text-green-500" /> : <ToggleLeft size={24} />}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Add staff modal */}
          {showAddStaff && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">添加员工</h3>
                  <button onClick={() => setShowAddStaff(false)} className="text-gray-400 text-xl">×</button>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <Field label="姓名">
                    <input value={newStaff.name} onChange={e => setNS('name', e.target.value)} className={inputCls} placeholder="真实姓名" />
                  </Field>
                  <Field label="登录账号">
                    <input value={newStaff.username} onChange={e => setNS('username', e.target.value)} className={inputCls} placeholder="英文/拼音，唯一" />
                  </Field>
                  <Field label="密码">
                    <input value={newStaff.password} onChange={e => setNS('password', e.target.value)} className={inputCls} placeholder="初始密码" />
                  </Field>
                  <Field label="角色">
                    <div className="grid grid-cols-3 gap-2">
                      {['worker','cs','admin'].map(r => (
                        <button key={r} type="button" onClick={() => setNS('role', r)}
                          className={`py-2 rounded-xl border-2 text-xs font-semibold transition-colors ${
                            newStaff.role === r ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'
                          }`}>
                          {ROLE_LABEL[r]}
                        </button>
                      ))}
                    </div>
                  </Field>
                  {newStaff.role === 'worker' && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600">可以开车（司机）</span>
                      <button onClick={() => setNS('isDriver', !newStaff.isDriver)}
                        className="text-gray-300 hover:text-gray-500">
                        {newStaff.isDriver ? <ToggleRight size={24} className="text-green-500" /> : <ToggleLeft size={24} />}
                      </button>
                    </div>
                  )}
                  <button onClick={handleAddStaff}
                    disabled={!newStaff.name || !newStaff.username || !newStaff.password}
                    className="w-full py-3 rounded-xl text-white font-semibold disabled:opacity-40 mt-2"
                    style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
                    确认添加
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Prices tab ── */}
      {tab === 'prices' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">搬家车辆时薪</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {Object.entries(VEHICLES).map(([name, v]) => (
                <div key={name} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{v.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">最低计费 {v.minHours} 小时 · 回程 ${v.returnFee}</p>
                  </div>
                  <p className="text-green-600 font-bold">${v.hourlyRate}/h</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">寄存收费标准</h3>
            </div>
            <div className="divide-y divide-gray-50">
              <div className="px-4 py-2.5 flex items-center justify-between">
                <p className="text-sm text-gray-700">纸箱（≤5周）</p>
                <p className="text-green-600 font-bold">$5/件/周</p>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <p className="text-sm text-gray-700">纸箱（&gt;5周）</p>
                <p className="text-green-600 font-bold">$3/件/周</p>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <p className="text-sm text-gray-700">家具（≤5周）</p>
                <p className="text-green-600 font-bold">$10/件/周</p>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <p className="text-sm text-gray-700">家具（&gt;5周）</p>
                <p className="text-green-600 font-bold">$7/件/周</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">师傅时薪标准</h3>
            </div>
            <div className="divide-y divide-gray-50 text-sm">
              {[
                ['老木', '$33/h（固定）'],
                ['小宇', '$30/h（固定）'],
                ['晨曦 / 老王', '司机：大卡$40 · 小卡$37 · 面包$34 / 工人$33'],
                ['小张', '司机：小卡$37 · 面包$34 / 工人$33'],
              ].map(([name, desc]) => (
                <div key={name} className="px-4 py-2.5 flex items-center justify-between gap-4">
                  <p className="text-gray-700 font-medium flex-shrink-0">{name}</p>
                  <p className="text-gray-500 text-xs text-right">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center px-4">如需修改价格请联系系统管理员</p>
        </div>
      )}

      {/* ── Company tab ── */}
      {tab === 'company' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">公司信息</h3>
            </div>
            <div className="px-4 py-4 space-y-3">
              {[
                ['companyName', '公司名称', '迁喜搬家 / Move With Ease'],
                ['phone',       '联系电话', ''],
                ['email',       '邮箱',     ''],
                ['abn',         'ABN',      '12 345 678 901'],
                ['address',     '地址',     ''],
                ['website',     '网站',     ''],
              ].map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
                  <input value={companyForm[key] || ''} onChange={e => setCompanyForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder} className={inputCls} />
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleSaveCompany}
            className="w-full py-3.5 rounded-xl text-white font-semibold flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
            <Save size={16} />
            {companySaved ? '已保存 ✓' : '保存公司信息'}
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-200'
