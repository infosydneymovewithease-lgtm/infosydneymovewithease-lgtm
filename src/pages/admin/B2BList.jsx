import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { PlusCircle, ChevronRight, Phone, Building2 } from 'lucide-react'

const LEVEL_STYLE = {
  A: { bg: 'bg-red-100 text-red-700',    label: 'A级' },
  B: { bg: 'bg-blue-100 text-blue-700',  label: 'B级' },
  C: { bg: 'bg-gray-100 text-gray-500',  label: 'C级' },
}

export default function B2BList() {
  const { b2bCustomers } = useApp()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')

  const filtered = b2bCustomers.filter(c => {
    const matchLevel = levelFilter === 'all' || c.level === levelFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      c.companyName?.toLowerCase().includes(q) ||
      c.contactName?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    return matchLevel && matchSearch
  })

  const active = b2bCustomers.filter(c => c.status === '合作中').length
  const totalMonthly = b2bCustomers
    .filter(c => c.status === '合作中')
    .reduce((s, c) => s + (c.monthlyOrders || 0), 0)

  return (
    <div className="p-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">企业客户</h1>
          <p className="text-gray-400 text-sm mt-0.5">合作中 {active} 家 · 月均约 {totalMonthly} 单</p>
        </div>
        <button onClick={() => navigate('/admin/b2b/new')}
          className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm"
          style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
          <PlusCircle size={16} /> 新增企业
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="合作企业" value={active} />
        <StatCard label="月均订单" value={totalMonthly} />
        <StatCard label="A级客户" value={b2bCustomers.filter(c => c.level === 'A').length} highlight />
      </div>

      {/* Level filter + search */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['all','全部'], ['A','A级'], ['B','B级'], ['C','C级']].map(([v, label]) => (
          <button key={v} onClick={() => setLevelFilter(v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              levelFilter === v ? 'text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
            style={levelFilter === v ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}>
            {label}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜索公司名、联系人..."
          className="flex-1 min-w-48 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <Building2 size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 font-medium">暂无企业客户</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const lvl = LEVEL_STYLE[c.level] || LEVEL_STYLE.C
            return (
              <div key={c.id} onClick={() => navigate(`/admin/b2b/${c.id}`)}
                className="bg-white rounded-xl px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #f5f0f0, #ede8e8)' }}>
                    🏢
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{c.companyName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${lvl.bg}`}>{lvl.label}</span>
                      {c.status !== '合作中' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">{c.status}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span>{c.contactName}</span>
                      {c.phone && <><span>·</span><span>{c.phone}</span></>}
                      {c.monthlyOrders > 0 && <><span>·</span><span>月均 {c.monthlyOrders} 单</span></>}
                    </div>
                    {c.specialPricing && (
                      <p className="text-xs text-blue-500 mt-0.5">{c.specialPricing}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, highlight }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm text-center">
      <p className={`text-2xl font-bold ${highlight ? 'text-red-600' : 'text-gray-800'}`}>{value}</p>
      <p className="text-gray-400 text-xs mt-0.5">{label}</p>
    </div>
  )
}
