import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin } from 'lucide-react'
import { useApp } from '../../context/AppContext'

const BLUE_DARK   = '#96394E'
const BLUE_MID    = '#B3475C'
const BLUE_BG     = '#FFF8F7'
const BLUE_BORDER = '#EAD5D1'
const T1 = '#172033'
const T2 = '#3F4854'
const T3 = '#6B7280'

const CATEGORIES = ['全部', '沙发', '床架/床垫', '桌椅', '柜子', '家电', '其他']

export default function SecondhandStore() {
  const navigate = useNavigate()
  const { secondhandListings } = useApp()
  const [category, setCategory] = useState('全部')
  const [lightbox, setLightbox] = useState(null)
  const [contactItem, setContactItem] = useState(null)

  const activeListings = secondhandListings.filter(l => l.status === '在售')
  const filtered = category === '全部'
    ? activeListings
    : activeListings.filter(l => l.category === category)

  return (
    <div className="min-h-screen" style={{ background: BLUE_BG }}>

      {/* Top bar */}
      <div style={{ background: BLUE_DARK }} className="px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-white/70 hover:text-white p-1">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm leading-tight">二手家具选购</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {activeListings.length} 件在售好物
            </p>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="sticky top-[52px] z-10 bg-white border-b" style={{ borderColor: BLUE_BORDER }}>
        <div className="max-w-lg mx-auto px-3 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={category === cat
                ? { background: BLUE_DARK, color: '#fff' }
                : { background: '#F3F4F6', color: T2 }
              }>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🛋️</div>
            <p className="font-semibold text-gray-500">暂无在售商品</p>
            <p className="text-sm text-gray-400 mt-1">稍后再来看看，或提交您的旧家具</p>
            <button onClick={() => navigate('/book/secondhand/sell')}
              className="mt-4 text-sm font-semibold px-4 py-2 rounded-xl text-white"
              style={{ background: BLUE_DARK }}>
              我要出售旧家具
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(item => (
              <ItemCard key={item.id} item={item}
                onViewPhoto={src => setLightbox(src)}
                onContact={() => setContactItem(item)} />
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        {filtered.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl p-4 text-center"
            style={{ border: `1px solid ${BLUE_BORDER}` }}>
            <p className="text-sm font-semibold" style={{ color: T1 }}>没找到想要的？</p>
            <p className="text-xs mt-1 mb-3" style={{ color: T3 }}>提交您的需求，我们帮您寻找合适的二手好物</p>
            <a href="tel:0450461917"
              className="inline-flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-xl"
              style={{ background: BLUE_DARK }}>
              <Phone size={14} /> 联系我们
            </a>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}

      {/* Contact modal */}
      {contactItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setContactItem(null)}>
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">联系咨询</h3>
              <button onClick={() => setContactItem(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                对 <span className="font-semibold text-gray-900">{contactItem.title}</span> 感兴趣？
              </p>
              <p className="text-sm font-bold text-2xl" style={{ color: BLUE_MID }}>
                ${contactItem.price}
              </p>
              <a href="tel:0450461917"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-semibold"
                style={{ background: BLUE_DARK }}>
                <Phone size={16} /> 致电 0450 461 917
              </a>
              {contactItem.location && (
                <div className="flex items-start gap-2 text-sm text-gray-500">
                  <MapPin size={14} className="flex-shrink-0 mt-0.5 text-gray-400" />
                  <span>{contactItem.location}</span>
                </div>
              )}
              <p className="text-xs text-gray-400 text-center">营业时间即时接听 · 欢迎微信联系</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ItemCard({ item, onViewPhoto, onContact }) {
  const photo = item.photos?.[0]

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm"
      style={{ border: `1px solid ${BLUE_BORDER}` }}>
      {/* Photo */}
      <div className="relative w-full aspect-square bg-gray-100 overflow-hidden"
        onClick={() => photo && onViewPhoto(photo)}
        style={{ cursor: photo ? 'pointer' : 'default' }}>
        {photo
          ? <img src={photo} alt={item.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-4xl">🛋️</div>
        }
        {item.photos?.length > 1 && (
          <span className="absolute bottom-1.5 right-1.5 text-xs bg-black/50 text-white px-1.5 py-0.5 rounded-full">
            +{item.photos.length - 1}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-semibold text-sm leading-tight mb-1" style={{ color: '#172033' }}>
          {item.title}
        </p>

        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {item.condition && (
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">
              {item.condition}
            </span>
          )}
          {item.canDeliver && (
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600">可送货</span>
          )}
          {item.canInstall && (
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-green-50 text-green-600">可安装</span>
          )}
        </div>

        {item.dimensions && (
          <p className="text-xs text-gray-400 mb-2">{item.dimensions}</p>
        )}

        <div className="flex items-center justify-between">
          <p className="font-bold text-base" style={{ color: BLUE_MID }}>
            ${item.price}
          </p>
          <button onClick={onContact}
            className="text-xs text-white font-semibold px-2.5 py-1.5 rounded-lg"
            style={{ background: BLUE_DARK }}>
            咨询
          </button>
        </div>
      </div>
    </div>
  )
}
