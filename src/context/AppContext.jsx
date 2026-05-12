import { createContext, useContext, useState, useEffect } from 'react'
import { MOCK_B2B_CUSTOMERS, generateOrderId } from '../data/mockData'
import { supabase } from '../lib/supabase'

const AppContext = createContext(null)

// Fire-and-forget Supabase write with error logging
function bg(queryBuilder) {
  queryBuilder.then(({ error }) => { if (error) console.error('[Supabase]', error) })
}

// Schema-known columns for orders table — strips extra form fields before insert/update
const ORDER_COLUMNS = new Set([
  'id','createdAt','status','serviceType','customerName','customerPhone','wechat',
  'date','startTime','endTime','fromAddress','toAddress','vehicle','quote',
  'finalAmount','paymentMethod','depositPaid','depositStatus','depositScreenshot',
  'deposit','distanceKm','remoteSurcharge','heavyItemFee','heavyFee','heavyItems','heavyDescription','stairFee','quoteNote',
  'requestedMaterials','items','notes','source','assignedTo','assignedWorkers',
  'dispatchedAt','confirmedAt','confirmChecks','csNote','createdBy','createdByName',
  'ikeaOrderNo','storeLocation','rubbishDisposal','riskItems','photos','hasVideo',
  'paymentStatus','collectedBy','completedAt',
  'materials','materialsCost',
  'fragileItems','fragileDescription','fragileEstimatedFee',
  'customer_code','workerNote',
  // 师傅交单时写入的费用明细 + 工时（5/7 加列，但白名单一直没收录，导致 completeOrder 走 pickOrder 后这些字段被过滤）
  'billedHours','overtimeFee','timeFee','returnFee','highwayFee','parkingFee',
  'suppliesFee','fuelFee','discountAmount','gst','hourlyRate',
  // 客服端编辑已完成订单的审计字段
  'editedAt','editedBy','editReason',
])

const STORAGE_COLUMNS = new Set([
  'id','status','customerName','customerPhone','wechat','moveInDate','moveOutDate',
  'actualMoveOutDate','boxes','furniture','items','location','deposit','depositStatus',
  'depositScreenshot','paymentStatus','notes','requestedMaterials','photos','hasVideo',
  'assignedTo','assignedWorkers','dispatchedAt','confirmedAt','confirmChecks','csNote',
  'workerStatus','arrivedAt','movingFee','completedAt','createdAt',
])

function pickOrder(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => ORDER_COLUMNS.has(k)))
}

function pickStorage(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => STORAGE_COLUMNS.has(k)))
}

export function AppProvider({ children }) {
  const [loading, setLoading] = useState(true)

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })

  // Supabase-backed state — starts empty, populated on mount
  const [orders, setOrders] = useState([])
  const [storageOrders, setStorageOrders] = useState([])
  const [staff, setStaff] = useState([])

  // localStorage-backed state (Phase 2 will migrate these)
  const [b2bCustomers, setB2bCustomers] = useState(() => {
    const saved = localStorage.getItem('b2bCustomers')
    return saved ? JSON.parse(saved) : MOCK_B2B_CUSTOMERS
  })

  const [secondhandItems, setSecondhandItems] = useState(() => {
    const saved = localStorage.getItem('secondhandItems')
    return saved ? JSON.parse(saved) : []
  })

  const [secondhandLeads, setSecondhandLeads] = useState(() => {
    const saved = localStorage.getItem('secondhandLeads')
    return saved ? JSON.parse(saved) : []
  })

  const [secondhandListings, setSecondhandListings] = useState(() => {
    const saved = localStorage.getItem('secondhandListings')
    return saved ? JSON.parse(saved) : []
  })

  const [appSettings, setAppSettings] = useState(() => {
    const saved = localStorage.getItem('appSettings')
    return saved ? JSON.parse(saved) : {
      companyName: '迁喜搬家 / Move With Ease',
      phone: '', email: '', abn: '', address: '', website: '',
    }
  })

  const [timerState, setTimerState] = useState(() => {
    const saved = localStorage.getItem('timerState')
    return saved ? JSON.parse(saved) : null
  })

  // One-time cleanup of old localStorage order/staff data (v3 → v4)
  useEffect(() => {
    if (localStorage.getItem('appVersion') !== 'v4') {
      localStorage.removeItem('orders')
      localStorage.removeItem('storageOrders')
      localStorage.removeItem('staff')
      localStorage.setItem('appVersion', 'v4')
    }
  }, [])

  // Fetch all Supabase data on mount + subscribe to realtime changes
  useEffect(() => {
    async function init() {
      try {
        const [ordersRes, storageRes, staffRes] = await Promise.all([
          supabase.from('orders').select('*').order('created_at', { ascending: false }),
          supabase.from('storage_orders').select('*').order('created_at', { ascending: false }),
          supabase.from('staff').select('*'),
        ])
        if (ordersRes.data) setOrders(ordersRes.data)
        if (storageRes.data) setStorageOrders(storageRes.data)
        if (staffRes.data) setStaff(staffRes.data)
      } catch (err) {
        console.error('[Supabase] Failed to load initial data', err)
      } finally {
        setLoading(false)
      }
    }
    init()

    const channel = supabase.channel('app-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, ({ eventType, new: n, old: o }) => {
        if (eventType === 'INSERT') setOrders(prev => prev.some(x => x.id === n.id) ? prev : [n, ...prev])
        else if (eventType === 'UPDATE') setOrders(prev => prev.map(x => x.id === n.id ? n : x))
        else if (eventType === 'DELETE') setOrders(prev => prev.filter(x => x.id !== o.id))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'storage_orders' }, ({ eventType, new: n, old: o }) => {
        if (eventType === 'INSERT') setStorageOrders(prev => prev.some(x => x.id === n.id) ? prev : [n, ...prev])
        else if (eventType === 'UPDATE') setStorageOrders(prev => prev.map(x => x.id === n.id ? n : x))
        else if (eventType === 'DELETE') setStorageOrders(prev => prev.filter(x => x.id !== o.id))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  // Persist user session and localStorage-backed state
  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user))
    else localStorage.removeItem('user')
  }, [user])

  useEffect(() => { localStorage.setItem('b2bCustomers', JSON.stringify(b2bCustomers)) }, [b2bCustomers])
  useEffect(() => { localStorage.setItem('secondhandItems', JSON.stringify(secondhandItems)) }, [secondhandItems])
  useEffect(() => { localStorage.setItem('secondhandLeads', JSON.stringify(secondhandLeads)) }, [secondhandLeads])
  useEffect(() => { localStorage.setItem('secondhandListings', JSON.stringify(secondhandListings)) }, [secondhandListings])
  useEffect(() => { localStorage.setItem('appSettings', JSON.stringify(appSettings)) }, [appSettings])
  useEffect(() => {
    if (timerState) localStorage.setItem('timerState', JSON.stringify(timerState))
    else localStorage.removeItem('timerState')
  }, [timerState])

  const worker = user?.role === 'worker' ? user : null
  const workers = staff.filter(s => s.role === 'worker')

  async function login(username, password) {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .eq('active', true)
      .maybeSingle()
    if (!data) return false
    setUser(data)
    if (data.role !== 'worker') {
      const today = new Date().toISOString().slice(0, 10)
      const key = `clockin_${data.id}_${today}`
      if (!localStorage.getItem(key)) localStorage.setItem(key, new Date().toISOString())
    }
    return data
  }

  function logout() {
    setUser(null)
    setTimerState(null)
    localStorage.removeItem('user')
    localStorage.removeItem('timerState')
  }

  function confirmOrder(orderId) {
    const updates = { status: '师傅已确认', confirmedAt: new Date().toISOString() }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o))
    bg(supabase.from('orders').update(pickOrder(updates)).eq('id', orderId))
  }

  // async + throw 版：调用方必须 await + try/catch，失败能给用户明确反馈
  // 之前 fire-and-forget 导致师傅看到「提交成功」但 DB 实际没写（5/7-5/10 潜伏 bug）
  async function completeOrder(orderId, result) {
    const updates = { status: '已完成', ...result }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o))
    const { error } = await supabase.from('orders').update(pickOrder(updates)).eq('id', orderId)
    if (error) {
      console.error('[Supabase] completeOrder failed:', error)
      throw new Error(error.message || '提交失败,请重试')
    }
  }

  function getMyOrders() {
    return orders.filter(o =>
      o.assignedTo === user?.id ||
      (Array.isArray(o.assignedWorkers) && o.assignedWorkers.includes(user?.id))
    )
  }

  function getMyStorageOrders() {
    return storageOrders.filter(o =>
      o.assignedTo === user?.id ||
      (Array.isArray(o.assignedWorkers) && o.assignedWorkers.includes(user?.id))
    )
  }

  function createOrder(orderData) {
    const newOrder = {
      ...orderData,
      id: generateOrderId(),
      createdAt: new Date().toISOString(),
      createdBy: user?.id || 'unknown',
      createdByName: user?.name || '未知',
      status: orderData.status || '待确认',
      assignedTo: null,
      assignedWorkers: [],
    }
    setOrders(prev => [newOrder, ...prev])
    bg(supabase.from('orders').insert(pickOrder(newOrder)))
    return newOrder
  }

  // Atomic slot-checked order creation via Supabase RPC.
  // Throws with a user-readable message if the slot is full or on network error.
  async function createOrderWithSlotCheck(orderData) {
    const payload = pickOrder({
      ...orderData,
      // normalise stairsFee (JS name) → stairFee (DB column)
      stairFee:      orderData.stairFee ?? orderData.stairsFee ?? 0,
      createdAt:     new Date().toISOString(),
      createdBy:     user?.id || 'customer',
      createdByName: user?.name || '客户自助',
      status:        orderData.status || '待确认',
      assignedTo:    null,
      assignedWorkers: [],
    })

    const { data, error } = await supabase.rpc('create_order_with_slot_check', {
      p_order: payload,
    })

    if (error) throw new Error('网络错误，请稍后重试')
    if (!data?.success) {
      throw new Error(
        data?.error === 'slot_full' ? '该时段已满，请选择其他时段或联系客服'
        : data?.error === 'day_full' ? '该日期预约已满，请选择其他日期或联系客服'
        : data?.error || '提交失败，请重试'
      )
    }

    // Generate customer archive code and save to DB (fire-and-forget)
    const customerCode = 'C' + Math.floor(100000 + Math.random() * 900000)
    bg(supabase.from('orders').update({ customer_code: customerCode }).eq('id', data.order_id))

    // Build local order object with the server-generated ID
    const newOrder = { ...payload, id: data.order_id, customer_code: customerCode }
    // Guard against realtime duplicate (subscription will also fire INSERT)
    setOrders(prev => prev.some(x => x.id === newOrder.id) ? prev : [newOrder, ...prev])
    return newOrder
  }

  function updateOrder(orderId, updates) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o))
    bg(supabase.from('orders').update(pickOrder(updates)).eq('id', orderId))
  }

  function dispatchOrder(orderId, workerIds) {
    const ids = Array.isArray(workerIds) ? workerIds : [workerIds]
    const updates = {
      assignedTo: ids[0],
      assignedWorkers: ids,
      status: '已派单',
      dispatchedAt: new Date().toISOString(),
    }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o))
    bg(supabase.from('orders').update(pickOrder(updates)).eq('id', orderId))
  }

  function updateOrderStatus(orderId, status) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    bg(supabase.from('orders').update(pickOrder({ status })).eq('id', orderId))
  }

  function createStorageOrder(data) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
    const newStorage = {
      ...data,
      id: `STG-${dateStr}-${rand}`,
      status: data.status || '待确认',
      createdAt: new Date().toISOString().slice(0, 10),
    }
    setStorageOrders(prev => [newStorage, ...prev])
    bg(supabase.from('storage_orders').insert(pickStorage(newStorage)))
    return newStorage
  }

  function updateStorageOrder(id, updates) {
    setStorageOrders(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    bg(supabase.from('storage_orders').update(pickStorage(updates)).eq('id', id))
  }

  function deleteOrder(id) {
    if ((id || '').startsWith('STG-')) {
      setStorageOrders(prev => prev.filter(o => o.id !== id))
      bg(supabase.from('storage_orders').delete().eq('id', id))
    } else {
      setOrders(prev => prev.filter(o => o.id !== id))
      bg(supabase.from('orders').delete().eq('id', id))
    }
  }

  function createSecondhandLead(data) {
    const lead = {
      ...data,
      id: `SHL-${String(secondhandLeads.length + 1).padStart(4, '0')}`,
      status: '待评估',
      source: '官网自助提交',
      createdAt: new Date().toISOString(),
    }
    setSecondhandLeads(prev => [lead, ...prev])
    return lead
  }

  function updateSecondhandLead(id, updates) {
    setSecondhandLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))
  }

  function createSecondhandItem(data) {
    const item = {
      ...data,
      id: `SH-${String(secondhandItems.length + 1).padStart(4, '0')}`,
      status: '在售',
      receivedDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    }
    setSecondhandItems(prev => [item, ...prev])
    return item
  }

  function updateSecondhandItem(id, updates) {
    setSecondhandItems(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  function createSecondhandListing(data) {
    const listing = {
      ...data,
      id: `SHI-${String(secondhandListings.length + 1).padStart(4, '0')}`,
      status: data.status || '在售',
      createdAt: new Date().toISOString(),
    }
    setSecondhandListings(prev => [listing, ...prev])
    return listing
  }

  function updateSecondhandListing(id, updates) {
    setSecondhandListings(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))
  }

  function deleteSecondhandListing(id) {
    setSecondhandListings(prev => prev.filter(l => l.id !== id))
  }

  function createB2BCustomer(data) {
    const next = { ...data, id: `B2B-${String(b2bCustomers.length + 1).padStart(4,'0')}`, createdAt: new Date().toISOString().slice(0,10), status: '合作中' }
    setB2bCustomers(prev => [next, ...prev])
    return next
  }

  function updateB2BCustomer(id, updates) {
    setB2bCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }

  function addStaffMember(data) {
    const newStaff = { ...data, id: data.username, active: true, stars: 1, isDriver: !!(data.canDrive?.length) }
    setStaff(prev => [...prev, newStaff])
    bg(supabase.from('staff').insert(newStaff))
  }

  function updateStaffMember(id, updates) {
    setStaff(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    bg(supabase.from('staff').update(updates).eq('id', id))
  }

  function updateAppSettings(updates) {
    setAppSettings(prev => ({ ...prev, ...updates }))
  }

  function getCustomers() {
    const map = {}
    orders.forEach(o => {
      const phone = o.customerPhone
      if (!phone) return
      if (!map[phone]) {
        map[phone] = {
          phone,
          name: o.customerName,
          wechat: o.wechat || '',
          source: o.source || '',
          firstOrderDate: o.date,
          lastOrderDate: o.date,
          orderCount: 0,
          totalSpent: 0,
        }
      }
      map[phone].orderCount += 1
      map[phone].totalSpent += o.finalAmount || 0
      if (o.date > map[phone].lastOrderDate) map[phone].lastOrderDate = o.date
      if (o.date < map[phone].firstOrderDate) map[phone].firstOrderDate = o.date
    })
    return Object.values(map)
  }

  function exportOrdersCSV() {
    const headers = ['订单号','日期','时间','客户','电话','车型','出发地','目的地','报价','实收','定金状态','付款方式','状态','师傅','登记人','创建时间']
    const rows = orders.map(o => [
      o.id,
      o.date || '',
      o.startTime || '',
      o.customerName || '',
      o.customerPhone || '',
      o.vehicle || '',
      (o.fromAddress || '').replace(/,/g, '，'),
      (o.toAddress || '').replace(/,/g, '，'),
      o.quote || '',
      o.finalAmount || '',
      o.depositPaid ? '已收' : (o.depositStatus === 'pending' ? '待定' : '未收'),
      o.paymentMethod === 'cash' ? '现金' : o.paymentMethod === 'transfer' ? '转账' : '',
      o.status || '',
      o.assignedTo ? (staff.find(s => s.id === o.assignedTo)?.name || o.assignedTo) : '',
      o.createdByName || o.createdBy || '',
      o.createdAt ? o.createdAt.slice(0, 16).replace('T', ' ') : '',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `订单记录_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFF8F7' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #f3e5e8', borderTopColor: '#96394E', borderRadius: '50%', marginBottom: 16, animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#96394E', fontSize: 14, fontWeight: 500 }}>加载中...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <AppContext.Provider value={{
      user, worker, login, logout,
      orders, confirmOrder, completeOrder, getMyOrders,
      createOrder, createOrderWithSlotCheck,
      updateOrder, dispatchOrder, updateOrderStatus,
      storageOrders, createStorageOrder, updateStorageOrder, deleteOrder,
      secondhandItems, createSecondhandItem, updateSecondhandItem,
      secondhandLeads, createSecondhandLead, updateSecondhandLead,
      secondhandListings, createSecondhandListing, updateSecondhandListing, deleteSecondhandListing,
      b2bCustomers, createB2BCustomer, updateB2BCustomer,
      staff, addStaffMember, updateStaffMember,
      appSettings, updateAppSettings,
      getCustomers,
      getMyStorageOrders,
      workers,
      timerState, setTimerState,
      exportOrdersCSV,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
