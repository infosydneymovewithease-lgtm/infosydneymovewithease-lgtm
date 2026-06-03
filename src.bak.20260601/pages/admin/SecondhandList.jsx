import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Search, ClipboardList, Plus, Edit3 } from 'lucide-react'

/* ── Leads (customer submissions) ── */

const LEAD_STATUS_TABS = [
  { value: 'all',    label: '全部' },
  { value: '待评估',  label: '待评估' },
  { value: '可收购',  label: '可收购' },
  { value: '可寄售',  label: '可寄售' },
  { value: '已联系',  label: '已联系' },
  { value: '已收货',  label: '已收货' },
  { value: '已上架',  label: '已上架' },
  { value: '已售出',  label: '已售出' },
]

const STATUS_COLOR = {
  '待评估':   'bg-yellow-100 text-yellow-700',
  '可收购':   'bg-green-100 text-green-700',
  '可寄售':   'bg-purple-100 text-purple-700',
  '暂未匹配': 'bg-gray-100 text-gray-500',
  '已联系':   'bg-blue-100 text-blue-700',
  '已收货':   'bg-indigo-100 text-indigo-700',
  '已上架':   'bg-teal-100 text-teal-700',
  '已售出':   'bg-gray-100 text-gray-500',
  '已取消':   'bg-red-50 text-red-400',
}

const LISTING_STATUS_COLOR = {
  '在售':  'bg-green-100 text-green-700',
  '已下架': 'bg-yellow-100 text-yellow-600',
  '已售出': 'bg-gray-100 text-gray-500',
}

export default function SecondhandList() {
  const { secondhandLeads, secondhandListings, updateSecondhandListing } = useApp()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const mainTab = searchParams.get('tab') === 'listings' ? 'listings' : 'leads'
  function setMainTab(v) { setSearchParams(v === 'listings' ? { tab: 'listings' } : {}) }

  /* ── Leads state ── */
  const [leadTab,    setLeadTab]    = useState('all')
  const [leadSearch, setLeadSearch] = useState('')

  const q = leadSearch.toLowerCase()
  const filteredLeads = secondhandLeads.filter(lead => {
    const matchTab = leadTab === 'all' || lead.status === leadTab
    const matchSearch = !q ||
      lead.customerName?.toLowerCase().includes(q) ||
      lead.customerPhone?.includes(q) ||
      lead.itemType?.toLowerCase().includes(q) ||
      lead.brand?.toLowerCase().includes(q) ||
      lead.id?.toLowerCase().includes(q)
    return matchTab && matchSearch
  })

  const pendingCount  = secondhandLeads.filter(l => l.status === '待评估').length
  const soldCount     = secondhandLeads.filter(l => l.status === '已售出').length
  const activeCount   = secondhandLeads.filter(l => ['可收购','可寄售','已联系','已收货','已上架'].includes(l.status)).length

  const tabCounts = {}
  secondhandLeads.forEach(l => { tabCounts[l.status] = (tabCounts[l.status] || 0) + 1 })

  /* ── Listings state ── */
  const [listingSearch, setListingSearch] = useState('')
  const [listingFilter, setListingFilter] = useState('all')

  const lq = listingSearch.toLowerCase()
  const filteredListings = secondhandListings.filter(item => {
    const matchStatus = listingFilter === 'all' || item.status === listingFilter
    const matchSearch = !lq || item.title?.toLowerCase().includes(lq) || item.category?.toLowerCase().includes(lq)
    return matchStatus && matchSearch
  })

  const onSaleCount = secondhandListings.filter(l => l.status === '在售').length
  const soldListingCount = secondhandListings.filter(l => l.status === '已售出').length

  return (
    <div className="p-5 max-w-4xl mx-auto">

      {/* Main tabs */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">二手家具</h1>
        </div>
        {mainTab === 'listings' && (
          <button onClick={() => navigate('/admin/secondhand/listing/new')}
            className="flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
            <Plus size={16} /> 新增商品
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5">
        {[
          { value: 'leads',    label: `客户线索 ${secondhandLeads.length > 0 ? `(${secondhandLeads.length})` : ''}` },
          { value: 'listings', label: `展示商品 ${secondhandListings.length > 0 ? `(${secondhandListings.length})` : ''}` },
        ].map(t => (
          <button key={t.value} onClick={() => setMainTab(t.value)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mainTab === t.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── LEADS TAB ── */}
      {mainTab === 'leads' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatBox value={pendingCount} label="待评估" color="text-yellow-500" />
            <StatBox value={activeCount}  label="处理中" color="text-blue-600" />
            <StatBox value={soldCount}    label="已售出" color="text-green-600" />
          </div>

          {/* Status tabs */}
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
            {LEAD_STATUS_TABS.map(t => {
              const count = t.value === 'all' ? secondhandLeads.length : (tabCounts[t.value] || 0)
              return (
                <button key={t.value} onClick={() => setLeadTab(t.value)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    leadTab === t.value ? 'text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                  style={leadTab === t.value ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}>
                  {t.label}
                  {count > 0 && (
                    <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                      leadTab === t.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={leadSearch} onChange={e => setLeadSearch(e.target.value)}
              placeholder="搜索姓名、电话、物品类型..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>

          <p className="text-sm text-gray-500 mb-3">{filteredLeads.length} 条记录</p>

          {filteredLeads.length === 0 ? (
            <EmptyState icon={<ClipboardList size={40} className="mx-auto mb-3 text-gray-200" />}
              text="暂无提交记录" sub="客户从前台提交后显示在这里" />
          ) : (
            <div className="space-y-2">
              {filteredLeads.map(lead => (
                <LeadCard key={lead.id} lead={lead} onClick={() => navigate(`/admin/secondhand/${lead.id}`)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── LISTINGS TAB ── */}
      {mainTab === 'listings' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatBox value={secondhandListings.length} label="商品总数" color="text-gray-700" />
            <StatBox value={onSaleCount}               label="在售"    color="text-green-600" />
            <StatBox value={soldListingCount}          label="已售出"  color="text-gray-400" />
          </div>

          {/* Filter */}
          <div className="flex gap-2 mb-3">
            {[
              { value: 'all', label: '全部' },
              { value: '在售', label: '在售' },
              { value: '已下架', label: '已下架' },
              { value: '已售出', label: '已售出' },
            ].map(t => (
              <button key={t.value} onClick={() => setListingFilter(t.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  listingFilter === t.value ? 'text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
                style={listingFilter === t.value ? { background: 'linear-gradient(135deg, #6b1414, #c0392b)' } : {}}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={listingSearch} onChange={e => setListingSearch(e.target.value)}
              placeholder="搜索商品名称、分类..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>

          <p className="text-sm text-gray-500 mb-3">{filteredListings.length} 件商品</p>

          {filteredListings.length === 0 ? (
            <EmptyState
              icon={<span className="text-5xl block mb-3">🛋️</span>}
              text="暂无展示商品"
              sub="点击右上角「新增商品」添加展示商品"
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filteredListings.map(item => (
                <ListingCard key={item.id} item={item}
                  onClick={() => navigate(`/admin/secondhand/listing/${item.id}`)}
                  onStatusChange={(id, status) => updateSecondhandListing(id, { status })} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Sub-components ── */

function StatBox({ value, label, color }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-gray-400 text-xs mt-0.5">{label}</p>
    </div>
  )
}

function EmptyState({ icon, text, sub }) {
  return (
    <div className="bg-white rounded-xl p-12 text-center shadow-sm">
      {icon}
      <p className="text-gray-400 font-medium">{text}</p>
      {sub && <p className="text-gray-300 text-sm mt-1">{sub}</p>}
    </div>
  )
}

function LeadCard({ lead, onClick }) {
  return (
    <div onClick={onClick}
      className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start gap-3">
        <div className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden bg-gray-100 flex items-center justify-center">
          {lead.photos?.[0]
            ? <img src={lead.photos[0]} alt="" className="w-full h-full object-cover" />
            : <span className="text-2xl">🛋️</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{lead.customerName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[lead.status] || 'bg-gray-100 text-gray-500'}`}>
              {lead.status}
            </span>
            {lead.isUrgent && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">🔥 急售</span>
            )}
          </div>
          <p className="text-sm text-gray-700 mt-0.5">
            {lead.itemType}{lead.brand ? ` · ${lead.brand}` : ''}{lead.condition ? ` · ${lead.condition}` : ''}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
            <span>{lead.customerPhone}</span>
            {lead.expectedPrice && <><span>·</span><span className="text-green-600 font-medium">期望 ${lead.expectedPrice}</span></>}
            <span>·</span>
            <span>{lead.createdAt?.slice(0, 10)}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          {lead.offerPrice && (
            <p className="text-green-600 font-bold text-sm">报价 ${lead.offerPrice}</p>
          )}
          <p className="text-xs text-gray-300 mt-1">{lead.id}</p>
        </div>
      </div>
    </div>
  )
}

function ListingCard({ item, onClick, onStatusChange }) {
  const statusCycle = { '在售': '已下架', '已下架': '在售', '已售出': '在售' }
  const statusLabel = { '在售': '⏸ 下架', '已下架': '▶ 上架', '已售出': '↩ 重新上架' }

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
      <div className="aspect-square bg-gray-100 overflow-hidden relative cursor-pointer" onClick={onClick}>
        {item.photos?.[0]
          ? <img src={item.photos[0]} alt={item.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-3xl">🛋️</div>
        }
        <span className={`absolute top-1.5 left-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${
          LISTING_STATUS_COLOR[item.status] || 'bg-gray-100 text-gray-500'
        }`}>
          {item.status}
        </span>
        <button onClick={e => { e.stopPropagation(); onClick() }}
          className="absolute top-1.5 right-1.5 bg-white/90 text-gray-600 p-1 rounded-lg shadow-sm">
          <Edit3 size={12} />
        </button>
      </div>
      <div className="p-3">
        <p className="font-semibold text-sm text-gray-900 truncate mb-1">{item.title}</p>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold" style={{ color: '#B3475C' }}>${item.price}</p>
          {item.condition && <span className="text-xs text-gray-400">{item.condition}</span>}
        </div>
        {/* Quick actions */}
        <div className="mt-2 flex gap-1.5">
          <button
            onClick={() => onStatusChange(item.id, statusCycle[item.status])}
            className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 font-medium">
            {statusLabel[item.status]}
          </button>
          {item.status !== '已售出' && (
            <button
              onClick={() => onStatusChange(item.id, '已售出')}
              className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">
              已售出
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
