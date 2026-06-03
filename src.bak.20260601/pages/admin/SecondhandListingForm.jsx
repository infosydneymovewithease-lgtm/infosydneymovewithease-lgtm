import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { ArrowLeft, X, ImagePlus } from 'lucide-react'

const CATEGORIES = ['沙发', '床架/床垫', '桌椅', '柜子', '家电', '其他']
const CONDITIONS = ['全新', '九成新', '八成新', '七成新', '有使用痕迹']

function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const MAX = 900
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve({ data: canvas.toDataURL('image/jpeg', 0.75), name: file.name })
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

export default function SecondhandListingForm() {
  const { lid } = useParams()
  const navigate = useNavigate()
  const { secondhandListings, createSecondhandListing, updateSecondhandListing, deleteSecondhandListing } = useApp()

  const isEdit = !!lid
  const existing = isEdit ? secondhandListings.find(l => l.id === lid) : null

  const [form, setForm] = useState({
    title:      existing?.title      || '',
    category:   existing?.category   || '',
    price:      existing?.price      || '',
    condition:  existing?.condition  || '',
    dimensions: existing?.dimensions || '',
    location:   existing?.location   || '',
    canDeliver: existing?.canDeliver || false,
    canInstall: existing?.canInstall || false,
    description: existing?.description || '',
    status:     existing?.status     || '在售',
  })
  const [photos, setPhotos] = useState(existing?.photos || [])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  function set(key, val) { setForm(p => ({ ...p, [key]: val })) }

  async function handlePhotoAdd(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const remaining = 6 - photos.length
    const toAdd = files.slice(0, remaining)
    const compressed = await Promise.all(toAdd.map(f => compressImage(f)))
    setPhotos(prev => [...prev, ...compressed.map(c => c.data)])
    e.target.value = ''
  }

  function removePhoto(idx) {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  function handleSave() {
    if (!form.title.trim()) { alert('请输入商品标题'); return }
    if (!form.price)        { alert('请输入售价');     return }
    setSaving(true)
    const data = { ...form, price: Number(form.price), photos }
    if (isEdit) {
      updateSecondhandListing(lid, data)
    } else {
      createSecondhandListing(data)
    }
    navigate('/admin/secondhand?tab=listings')
  }

  return (
    <div className="max-w-2xl mx-auto p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? '编辑商品' : '新增展示商品'}
        </h1>
      </div>

      {/* Status management (edit mode only) */}
      {isEdit && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">上架状态</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: '在售',  label: '在售',  color: 'bg-green-100 text-green-700 border-green-300' },
              { value: '已下架', label: '已下架', color: 'bg-gray-100 text-gray-500 border-gray-300' },
              { value: '已售出', label: '已售出', color: 'bg-gray-100 text-gray-400 border-gray-200' },
            ].map(opt => (
              <button key={opt.value}
                onClick={() => { set('status', opt.value); updateSecondhandListing(lid, { status: opt.value }) }}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
                  form.status === opt.value ? opt.color + ' ring-2 ring-offset-1 ring-gray-300' : 'border-transparent bg-gray-50 text-gray-400'
                }`}>
                {form.status === opt.value ? '● ' : ''}{opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {form.status === '在售' ? '✅ 商品对买家可见' : form.status === '已下架' ? '⏸ 商品已隐藏，买家不可见' : '✓ 已售出，不再展示'}
          </p>
        </div>
      )}

      {/* Delete */}
      {isEdit && (
        <button
          onClick={() => {
            if (window.confirm('确认删除这件商品？')) {
              deleteSecondhandListing(lid)
              navigate('/admin/secondhand?tab=listings')
            }
          }}
          className="w-full py-2.5 rounded-xl text-red-400 text-sm border border-red-100 hover:bg-red-50">
          删除商品
        </button>
      )}

      {/* Photos */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">商品照片（最多6张）</p>
        <div className="flex gap-2 flex-wrap">
          {photos.map((src, i) => (
            <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button onClick={() => removePhoto(i)}
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5">
                <X size={10} />
              </button>
            </div>
          ))}
          {photos.length < 6 && (
            <button onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-gray-300 hover:bg-gray-50 transition-colors">
              <ImagePlus size={20} />
              <span className="text-xs mt-1">添加</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />
      </div>

      {/* Basic info */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">基本信息</p>

        <div>
          <label className="text-sm text-gray-600 block mb-1.5">标题 <span className="text-red-400">*</span></label>
          <input value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="例：宜家 KIVIK 三人位沙发"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-600 block mb-1.5">分类</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white">
              <option value="">请选择</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1.5">成色</label>
            <select value={form.condition} onChange={e => set('condition', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white">
              <option value="">请选择</option>
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-600 block mb-1.5">售价 (AUD) <span className="text-red-400">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" value={form.price} onChange={e => set('price', e.target.value)}
                placeholder="0"
                className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1.5">尺寸（可选）</label>
            <input value={form.dimensions} onChange={e => set('dimensions', e.target.value)}
              placeholder="例：200×90×75cm"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-600 block mb-1.5">所在区域</label>
          <input value={form.location} onChange={e => set('location', e.target.value)}
            placeholder="例：Chatswood / Sydney CBD"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
        </div>

        <div>
          <label className="text-sm text-gray-600 block mb-1.5">描述（可选）</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            rows={3} placeholder="材质、品牌、使用年限、注意事项..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none" />
        </div>

        {/* Toggles */}
        <div className="flex gap-4">
          {[
            { key: 'canDeliver', label: '可送货上门' },
            { key: 'canInstall', label: '可安装服务' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => set(key, !form[key])}
              className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl border transition-colors ${
                form[key] ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 bg-white'
              }`}>
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                form[key] ? 'border-green-500 bg-green-500' : 'border-gray-300'
              }`}>
                {form[key] && <span className="text-white text-xs">✓</span>}
              </span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Save button */}
      <button onClick={handleSave} disabled={saving}
        className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
        {saving ? '保存中...' : isEdit ? '保存修改' : '发布商品'}
      </button>
    </div>
  )
}
