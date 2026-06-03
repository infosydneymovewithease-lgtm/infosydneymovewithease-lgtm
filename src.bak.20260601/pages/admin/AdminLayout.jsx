import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useState } from 'react'
import {
  LayoutDashboard, ClipboardList, PlusCircle, Truck,
  Users, Building2, DollarSign, Package, Recycle,
  Settings, LogOut, Menu, X, ChevronRight, Ban, Sparkles, Gauge, BookOpen
} from 'lucide-react'

const NAV_ITEMS = [
  { label: '工作台',       icon: LayoutDashboard, to: '/admin',             end: true },
  { label: '新建订单',     icon: PlusCircle,      to: '/admin/orders/new' },
  { label: '全部订单',     icon: ClipboardList,   to: '/admin/orders',
    isActive: loc => loc.pathname.startsWith('/admin/orders') && !loc.pathname.startsWith('/admin/orders/new') && new URLSearchParams(loc.search).get('service') !== 'IKEA' },
  { label: '取消历史',     icon: Ban,             to: '/admin/cancelled' },
  { label: '派单管理',     icon: Truck,           to: '/admin/dispatch' },
  { divider: true },
  { label: '客户主档', icon: Users,            to: '/admin/customers',  adminOnly: true },
  { label: '企业客户', icon: Building2,        to: '/admin/b2b' },
  { divider: true },
  { label: '收款记录', icon: DollarSign,       to: '/admin/bills' },
  { label: '工资结算', icon: DollarSign,       to: '/admin/wages',      adminOnly: true },
  { divider: true },
  { label: '提货安装', icon: Truck,            to: '/admin/orders?service=IKEA',
    isActive: loc => new URLSearchParams(loc.search).get('service') === 'IKEA' },
  { label: '清洁业务', icon: Sparkles,         to: '/admin/cleaning' },
  { label: '寄存业务', icon: Package,          to: '/admin/storage' },
  { label: '二手物品', icon: Recycle,          to: '/admin/secondhand' },
  { divider: true },
  { label: '运力管理', icon: Gauge,             to: '/admin/vehicles',   adminOnly: true },
  { label: '系统设置', icon: Settings,         to: '/admin/settings',   adminOnly: true },
  { divider: true },
  { label: '操作手册', icon: BookOpen,         to: '/admin/help' },
]

export default function AdminLayout() {
  const { user, logout } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-60 flex flex-col
        transition-transform duration-200 lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `} style={{ background: '#1a0808' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 bg-white/10">
            <img src="/logo.jpg" alt="logo" className="w-full h-full object-contain p-1" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">迁喜搬家</p>
            <p className="text-red-400 text-xs">客服后台</p>
          </div>
          <button
            className="ml-auto lg:hidden text-white/60"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {NAV_ITEMS.map((item, i) => {
            if (item.divider) return <div key={i} className="my-2 border-t border-white/10" />
            if (item.adminOnly && user?.role !== 'admin') return null
            if (item.soon) return (
              <div key={item.to} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/30 cursor-not-allowed text-sm">
                <item.icon size={17} />
                <span>{item.label}</span>
                <span className="ml-auto text-xs bg-white/10 px-1.5 py-0.5 rounded text-white/40">即将</span>
              </div>
            )
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => {
                  const active = item.isActive ? item.isActive(location) : isActive
                  return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-red-800/80 text-white font-semibold'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }}
              >
                <item.icon size={17} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* User + logout */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-800 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user?.name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <p className="text-white/40 text-xs">{user?.role === 'admin' ? '管理员' : '客服'}</p>
            </div>
            <button onClick={handleLogout} className="text-white/40 hover:text-white/80 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0 shadow-sm">
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="text-red-700 font-semibold">迁喜搬家</span>
            <ChevronRight size={14} />
            <span>客服后台</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:block">
              {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 text-sm font-bold">
              {user?.name?.[0] || '?'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
