import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Home, BookOpen, ClipboardList, User } from 'lucide-react'
import DesktopHeader from '../../components/DesktopHeader'
import DesktopFooter from '../../components/DesktopFooter'

const TABS = [
  { path: '/',         label: '首页', Icon: Home          },
  { path: '/guide',    label: '攻略', Icon: BookOpen      },
  { path: '/my-order', label: '订单', Icon: ClipboardList },
  { path: '/profile',  label: '我的', Icon: User          },
]

const MID    = '#8B2635'
const BORDER = '#EFEFEF'

export default function CustomerLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <div className="md:pb-0" style={{ paddingBottom: 64 }}>
      <DesktopHeader />

      <Outlet />

      <DesktopFooter />

      {/* Mobile bottom tab bar — hidden on desktop */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white z-50"
        style={{ borderTop: `1px solid ${BORDER}` }}>
        <div className="max-w-lg mx-auto flex">
          {TABS.map(({ path, label, Icon }) => {
            const active = pathname === path
            return (
              <button key={path} onClick={() => navigate(path)}
                className="flex-1 flex flex-col items-center gap-0.5 py-2"
                style={{ WebkitTapHighlightColor: 'transparent' }}>
                <Icon size={22} strokeWidth={active ? 2.2 : 1.6}
                  style={{ color: active ? MID : '#9ca3af' }} />
                <span className="text-xs leading-none"
                  style={{ color: active ? MID : '#9ca3af', fontWeight: active ? 600 : 400 }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
