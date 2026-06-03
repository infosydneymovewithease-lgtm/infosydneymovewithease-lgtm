import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { ArrowLeft, Phone, MapPin, Edit3, CheckCircle, Tag } from 'lucide-react'

const ALL_STATUSES = [
  '待评估', '可收购', '可寄售', '暂未匹配', '已联系', '已收货', '已上架', '已售出', '已取消',
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

const CATEGORIES = ['沙发', '床架/床垫', '桌椅', '柜子', '家电', '其他']

function guessCategory(itemType) {
  if (!itemType) return ''
  const t = itemType
  if (t.includes('沙发')) return '沙发'
  if (t.includes('床')) return '床架/床垫'
  if (t.includes('桌') || t.includes('椅')) return '桌椅'
  if (t.includes('柜')) return '柜子'
  if (t.includes('冰箱') || t.includes('洗衣') || t.includes('电视') || t.includes('家电')) return '家电'
  return ''
}

export default function SecondhandDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { secondhandLeads, updateSecondhandLead, createSecondhandListing, updateSecondhandListing } = useApp()

  const lead = secondhandLeads.find(l => l.id === id)

  const [showStatusModal,  setShowStatusModal]  = useState(false)
  const [editingOffer,     setEditingOffer]     = useState(false)
  const [offerInput,       setOfferInput]       = useState(String(lead?.offerPrice || ''))
  const [editingNote,      setEditingNote]      = useState(false)
  const [noteInput,        setNoteInput]        = useState(lead?.adminNotes || '')
  const [lightbox,         setLightbox]         = useState(null)
  const [showListModal,    setShowListModal]    = useState(false)
  const [listForm,         setListForm]         = useState({ title: '', category: '', price: '', canDeliver: false, canInstall: false })

  if (!lead) return (
    <div className="flex items-center justify-center h-64 text-gray-400">记录不存在</div>
  )

  function handleStatusChange(status) {
    updateSecondhandLead(id, { status })
    setShowStatusModal(false)
  }

  function handleSaveOffer() {
    const val = parseFloat(offerInput)
    if (!isNaN(val) && val >= 0) updateSecondhandLead(id, { offerPrice: val })
    setEditingOffer(false)
  }

  function handleSaveNote() {
    updateSecondhandLead(id, { adminNotes: noteInput.trim() })
    setEditingNote(false)
  }

  function openListModal() {
    setListForm({
      title: [lead.itemType, lead.brand].filter(Boolean).join(' · '),
      category: guessCategory(lead.itemType),
      price: String(lead.offerPrice || ''),
      canDeliver: false,
      canInstall: false,
    })
    setShowListModal(true)
  }

  function handlePromoteToListing() {
    if (!listForm.title.trim()) { alert('请输入商品标题'); return }
    if (!listForm.price)        { alert('请输入售价');     return }
    const listing = createSecondhandListing({
      title:      listForm.title,
      category:   listForm.category,
      price:      Number(listForm.price),
      condition:  lead.condition,
      photos:     lead.photos || [],
      canDeliver: listForm.canDeliver,
      canInstall: listForm.canInstall,
      leadId:     lead.id,
      status:     '在售',
    })
    updateSecondhandLead(id, { status: '已上架', listingId: listing.id })
    setShowListModal(false)
  }

  function setLF(key, val) { setListForm(p => ({ ...p, [key]: val })) }

  const alreadyListed = !!lead.listingId

  return (
    <div className="max-w-2xl mx-auto p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{lead.customerName}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR[lead.status] || 'bg-gray-100 text-gray-500'}`}>
              {lead.status}
            </span>
            {lead.isUrgent && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-semibold">🔥 急售</span>
            )}
          </div>
          <p className="text-gray-400 text-xs mt-0.5">{lead.id} · {lead.createdAt?.slice(0, 10)} 提交</p>
        </div>
      </div>

      {/* Photos */}
      {lead.photos?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">物品照片</h3>
          </div>
          <div className="px-4 py-3 flex gap-2 flex-wrap">
            {lead.photos.map((src, i) => (
              <img key={i} src={src} alt=""
                className="w-24 h-24 rounded-xl object-cover cursor-pointer active:opacity-80"
                onClick={() => setLightbox(src)} />
            ))}
          </div>
        </div>
      )}

      {/* Item info */}
      <Card title="物品信息">
        <Row label="类型">{lead.itemType || '—'}</Row>
        {lead.brand        && <Row label="品牌">{lead.brand}</Row>}
        <Row label="成色">{lead.condition || '—'}</Row>
        {lead.purchaseYear && <Row label="购买年份">{lead.purchaseYear}</Row>}
        {lead.originalPrice && <Row label="原价"><span className="text-gray-600">${lead.originalPrice}</span></Row>}
        {lead.expectedPrice && <Row label="期望价格"><span className="text-green-600 font-semibold">${lead.expectedPrice}</span></Row>}
        {lead.notes && (
          <div className="mt-1 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">{lead.notes}</div>
        )}
      </Card>

      {/* Customer + location */}
      <Card title="客户信息">
        <div className="flex items-center justify-between mb-1">
          <p className="text-gray-900 font-semibold">{lead.customerName}</p>
          <a href={`tel:${lead.customerPhone}`}
            className="flex items-center gap-2 bg-green-500 text-white px-3 py-2 rounded-xl text-sm font-semibold">
            <Phone size={14} /> {lead.customerPhone}
          </a>
        </div>
        {lead.address && (
          <div className="flex items-start gap-2 mt-2 text-sm text-gray-600">
            <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <span>{lead.address}</span>
          </div>
        )}
        {lead.accessType && <Row label="楼层情况">{lead.accessType}</Row>}
      </Card>

      {/* Admin evaluation */}
      <Card title="客服评估">
        {/* Offer price */}
        <div className="flex items-center justify-between py-0.5">
          <span className="text-gray-500 text-sm">报价 / 出价</span>
          <div className="flex items-center gap-2">
            {editingOffer ? (
              <>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" value={offerInput} onChange={e => setOfferInput(e.target.value)}
                    className="w-24 pl-6 pr-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                </div>
                <button onClick={handleSaveOffer}
                  className="text-xs text-white px-2.5 py-1.5 rounded-lg font-semibold"
                  style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>保存</button>
                <button onClick={() => setEditingOffer(false)} className="text-xs text-gray-400">取消</button>
              </>
            ) : (
              <>
                <span className="text-gray-800 text-sm font-semibold">
                  {lead.offerPrice ? `$${lead.offerPrice}` : '—'}
                </span>
                <button onClick={() => { setOfferInput(String(lead.offerPrice || '')); setEditingOffer(true) }}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                  <Edit3 size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Admin notes */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-gray-500 text-sm">内部备注</span>
            {!editingNote && (
              <button onClick={() => { setNoteInput(lead.adminNotes || ''); setEditingNote(true) }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <Edit3 size={14} />
              </button>
            )}
          </div>
          {editingNote ? (
            <div className="space-y-2">
              <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} rows={3}
                placeholder="评估结论、沟通记录、跟进说明..."
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none" />
              <div className="flex gap-2">
                <button onClick={handleSaveNote}
                  className="text-xs text-white px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>保存</button>
                <button onClick={() => setEditingNote(false)} className="text-xs text-gray-400 px-2 py-1.5">取消</button>
              </div>
            </div>
          ) : (
            lead.adminNotes
              ? <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">{lead.adminNotes}</div>
              : <p className="text-xs text-gray-300 italic">暂无备注</p>
          )}
        </div>

        {/* Listing promotion */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-gray-500 text-sm mb-2">展示上架</p>
          {alreadyListed ? (
            <div className="flex items-center justify-between bg-teal-50 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Tag size={14} className="text-teal-600" />
                <span className="text-sm text-teal-700 font-medium">已上架展示</span>
                <span className="text-xs text-teal-500">{lead.listingId}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/admin/secondhand/listing/${lead.listingId}`)}
                  className="text-xs text-teal-600 font-semibold hover:text-teal-800">
                  编辑 →
                </button>
                <button
                  onClick={() => {
                    updateSecondhandListing(lead.listingId, { status: '已下架' })
                    updateSecondhandLead(id, { listingId: null, status: '已收货' })
                  }}
                  className="text-xs text-gray-400 hover:text-red-500">
                  下架
                </button>
              </div>
            </div>
          ) : (
            <button onClick={openListModal}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
              <Tag size={15} /> 上架至买家展示页
            </button>
          )}
        </div>
      </Card>

      {/* Change status */}
      <button onClick={() => setShowStatusModal(true)}
        className="w-full bg-white border border-gray-200 text-gray-600 py-3 rounded-xl font-medium text-sm hover:bg-gray-50 shadow-sm">
        修改状态（当前：{lead.status}）
      </button>

      {/* Status modal */}
      {showStatusModal && (
        <Modal title="修改状态" onClose={() => setShowStatusModal(false)}>
          <div className="space-y-2">
            {ALL_STATUSES.map(s => (
              <button key={s} onClick={() => handleStatusChange(s)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                  lead.status === s ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                <span className="text-gray-800 text-sm">{s}</span>
                {lead.status === s && <CheckCircle size={16} className="text-red-500" />}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Listing promotion modal */}
      {showListModal && (
        <Modal title="上架至买家展示页" onClose={() => setShowListModal(false)}>
          <div className="space-y-4">
            <p className="text-xs text-gray-400">设置展示信息后，商品将出现在「我要买二手家具」页面</p>

            <div>
              <label className="text-sm text-gray-600 block mb-1.5">标题 <span className="text-red-400">*</span></label>
              <input value={listForm.title} onChange={e => setLF('title', e.target.value)}
                placeholder="例：宜家 KIVIK 三人位沙发"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600 block mb-1.5">分类</label>
                <select value={listForm.category} onChange={e => setLF('category', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200 bg-white">
                  <option value="">请选择</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1.5">售价 (AUD) <span className="text-red-400">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" value={listForm.price} onChange={e => setLF('price', e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {[
                { key: 'canDeliver', label: '可送货上门' },
                { key: 'canInstall', label: '可安装服务' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setLF(key, !listForm[key])}
                  className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors ${
                    listForm[key] ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'
                  }`}>
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    listForm[key] ? 'border-green-500 bg-green-500' : 'border-gray-300'
                  }`}>
                    {listForm[key] && <span className="text-white text-xs leading-none">✓</span>}
                  </span>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={handlePromoteToListing}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-sm"
                style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                确认上架
              </button>
              <button onClick={() => setShowListModal(false)}
                className="px-4 py-3 rounded-xl text-gray-500 text-sm border border-gray-200">
                取消
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {title && <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</h3>
      </div>}
      <div className="px-4 py-3 space-y-2">{children}</div>
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

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
