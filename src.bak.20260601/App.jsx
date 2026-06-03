import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import Home from './pages/Home'
import OrderDetail from './pages/OrderDetail'
import WorkPage from './pages/WorkPage'
import FormPage from './pages/FormPage'
import SummaryPage from './pages/SummaryPage'
import WorkerStorageDetail from './pages/WorkerStorageDetail'
import WorkerHistory from './pages/WorkerHistory'
import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import OrderList from './pages/admin/OrderList'
import NewOrder from './pages/admin/NewOrder'
import AdminOrderDetail from './pages/admin/AdminOrderDetail'
import CustomerList from './pages/admin/CustomerList'
import CustomerDetail from './pages/admin/CustomerDetail'
import BillRecords from './pages/admin/BillRecords'
import WageRecords from './pages/admin/WageRecords'
import DispatchBoard from './pages/admin/DispatchBoard'
import B2BList from './pages/admin/B2BList'
import B2BDetail from './pages/admin/B2BDetail'
import Settings from './pages/admin/Settings'
import StorageList from './pages/admin/StorageList'
import NewStorage from './pages/admin/NewStorage'
import StorageDetail from './pages/admin/StorageDetail'
import SecondhandList from './pages/admin/SecondhandList'
import SecondhandDetail from './pages/admin/SecondhandDetail'
import CancelledOrders from './pages/admin/CancelledOrders'
import CleaningOrders from './pages/admin/CleaningOrders'
import VehicleManagement from './pages/admin/VehicleManagement'
import HelpPage from './pages/admin/HelpPage'
// Customer portal
import CustomerLayout from './pages/customer/CustomerLayout'
import CustomerHome from './pages/customer/CustomerHome'
import GuidePage from './pages/customer/GuidePage'
import ProfilePage from './pages/customer/ProfilePage'
import MoveBooking from './pages/customer/MoveBooking'
import MoveLandingPage from './pages/customer/MoveLandingPage'
import StorageBooking from './pages/customer/StorageBooking'
import IkeaBooking from './pages/customer/IkeaBooking'
import CleanBooking from './pages/customer/CleanBooking'
import SecondhandHome from './pages/customer/SecondhandHome'
import SecondhandSubmit from './pages/customer/SecondhandSubmit'
import SecondhandStore from './pages/customer/SecondhandStore'
import MyOrder from './pages/customer/MyOrder'
import SecondhandListingForm from './pages/admin/SecondhandListingForm'

/* ── Splash screen (shows once per session on customer routes) ── */
function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1800)
    const t2 = setTimeout(onDone, 2400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#FFF8F7',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.6s ease',
      pointerEvents: fading ? 'none' : 'all',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 96, height: 96, borderRadius: 24,
          overflow: 'hidden', margin: '0 auto 20px',
          boxShadow: '0 8px 32px rgba(150,57,78,0.2)',
        }}>
          <img src="/logo.jpg" alt="logo"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <p style={{
          color: '#96394E', fontSize: 28, fontWeight: 800,
          letterSpacing: 3, marginBottom: 8,
        }}>迁喜搬家</p>
        <p style={{ color: '#B3475C', fontSize: 13 }}>Move With Ease · Sydney</p>
        <p style={{ color: '#9ca3af', fontSize: 11, marginTop: 36 }}>华人团队 · 专业放心</p>
      </div>
    </div>
  )
}

function WorkerRoute({ children }) {
  const { user } = useApp()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'worker') return <Navigate to="/admin" replace />
  return children
}

function AdminRoute({ children }) {
  const { user } = useApp()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'worker') return <Navigate to="/worker" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* ── Customer portal with bottom nav ── */}
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<CustomerHome />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/my-order" element={<MyOrder />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* ── Booking flows (no bottom nav — full screen) ── */}
      <Route path="/lp/move" element={<MoveLandingPage />} />
      <Route path="/book/move" element={<MoveBooking />} />
      <Route path="/book/storage" element={<StorageBooking />} />
      <Route path="/book/ikea" element={<IkeaBooking />} />
      <Route path="/book/clean" element={<CleanBooking />} />
      <Route path="/book/secondhand" element={<SecondhandHome />} />
      <Route path="/book/secondhand/sell" element={<SecondhandSubmit />} />
      <Route path="/book/secondhand/browse" element={<SecondhandStore />} />

      {/* ── Staff login ── */}
      <Route path="/login" element={<Login />} />

      {/* ── Worker routes ── */}
      <Route path="/worker" element={<WorkerRoute><Home /></WorkerRoute>} />
      <Route path="/order/:id" element={<WorkerRoute><OrderDetail /></WorkerRoute>} />
      <Route path="/order/:id/work" element={<WorkerRoute><WorkPage /></WorkerRoute>} />
      <Route path="/order/:id/form" element={<WorkerRoute><FormPage /></WorkerRoute>} />
      <Route path="/order/:id/summary" element={<WorkerRoute><SummaryPage /></WorkerRoute>} />
      <Route path="/storage/:id" element={<WorkerRoute><WorkerStorageDetail /></WorkerRoute>} />
      <Route path="/worker/history" element={<WorkerRoute><WorkerHistory /></WorkerRoute>} />

      {/* ── Admin routes ── */}
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<OrderList />} />
        <Route path="orders/new" element={<NewOrder />} />
        <Route path="orders/:id" element={<AdminOrderDetail />} />
        <Route path="customers" element={<CustomerList />} />
        <Route path="customers/:phone" element={<CustomerDetail />} />
        <Route path="bills" element={<BillRecords />} />
        <Route path="wages" element={<WageRecords />} />
        <Route path="dispatch" element={<DispatchBoard />} />
        <Route path="b2b" element={<B2BList />} />
        <Route path="b2b/:id" element={<B2BDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="storage" element={<StorageList />} />
        <Route path="storage/new" element={<NewStorage />} />
        <Route path="storage/:id" element={<StorageDetail />} />
        <Route path="secondhand" element={<SecondhandList />} />
        <Route path="secondhand/listing/new" element={<SecondhandListingForm />} />
        <Route path="secondhand/listing/:lid" element={<SecondhandListingForm />} />
        <Route path="secondhand/:id" element={<SecondhandDetail />} />
        <Route path="cleaning" element={<CleaningOrders />} />
        <Route path="cancelled" element={<CancelledOrders />} />
        <Route path="vehicles" element={<VehicleManagement />} />
        <Route path="help" element={<HelpPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const isStaffPath = ['/login', '/worker', '/order', '/admin', '/storage'].some(p =>
    window.location.pathname.startsWith(p)
  )
  const [splashDone, setSplashDone] = useState(
    () => sessionStorage.getItem('splashDone') === '1' || isStaffPath
  )

  function handleSplashDone() {
    sessionStorage.setItem('splashDone', '1')
    setSplashDone(true)
  }

  return (
    <AppProvider>
      <BrowserRouter>
        {!splashDone && <SplashScreen onDone={handleSplashDone} />}
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </BrowserRouter>
    </AppProvider>
  )
}
