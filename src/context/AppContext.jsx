import { createContext, useContext, useState, useEffect } from 'react'
import { MOCK_B2B_CUSTOMERS, generateOrderId } from '../data/mockData'
import { supabase } from '../lib/supabase'
import { isLegalOrderTransition } from '../data/orderStatus'
import { isDepositPaid } from '../utils/orderHelpers'

const AppContext = createContext(null)

// 写库失败时的去重提示（避免短时间多次失败弹一堆 alert）
let _lastBgErrorAt = 0
function notifyBgError(opLabel, error) {
  console.error(`[Supabase] ${opLabel || 'write'} failed:`, error)
  const now = Date.now()
  if (now - _lastBgErrorAt < 3000) return  // 3 秒内只提示一次
  _lastBgErrorAt = now
  // Why alert 不是 toast：项目没装 toast 库，alert 至少能阻断让用户立刻看见
  // How: 关键操作（确认/派单/创单）已经走 async+throw 路径不会到这里；
  //      这里兜底的是 updateOrder/updateOrderStatus/updateStorageOrder 等次要写
  if (typeof window !== 'undefined' && window.alert) {
    window.alert(`⚠️ ${opLabel || '操作'}未保存到服务器\n${error?.message || '网络错误'}\n请刷新页面后重试`)
  }
}

// 后台写：UI 已乐观更新，DB 写失败时不静默 — 弹窗提示用户操作未持久化
function bg(queryBuilder, opLabel) {
  queryBuilder.then(({ error }) => {
    if (error) notifyBgError(opLabel, error)
  })
}

// Schema-known columns for orders table — strips extra form fields before insert/update
const ORDER_COLUMNS = new Set([
  'id','createdAt','status','serviceType','customerName','customerPhone','wechat',
  'date','startTime','endTime','fromAddress','toAddress','vehicle','quote',
  // 客服设定的"跟客户约定的实际到场/开工时间"（7/13 加列，区别于时段 startTime 和师傅计时 workStartedAt）
  'actualStartTime','actualEndTime',
  'finalAmount','paymentMethod','depositPaid','depositStatus','depositScreenshot',
  'deposit','distanceKm','remoteSurcharge','heavyItemFee','heavyFee','heavyItems','heavyDescription','stairFee','quoteNote',
  'requestedMaterials','items','notes','source','assignedTo','assignedWorkers',
  'dispatchedAt','confirmedAt','confirmChecks','csNote','createdBy','createdByName',
  'ikeaOrderNo','storeLocation','rubbishDisposal','riskItems','photos','hasVideo',
  'paymentStatus','collectedBy','completedAt',
  // 师傅端工作计时上云（6/2 加列）— 计时状态存订单行，靠 realtime 同步给同组师傅
  // workStatus: idle|running|paused|stopped；workStartedAt/EndedAt 是真实开工/收工时间
  // workStartedBy: 第一个按开始的师傅 id（并发提示用，7/13 加列）
  'workStatus','workStartedAt','workEndedAt','workAccumulatedSec','workRunStartedAt','workStartedBy',
  'materials','materialsCost',
  'fragileItems','fragileDescription','fragileEstimatedFee',
  'customer_code','workerNote','orderNo',
  // 师傅交单时写入的费用明细 + 工时（5/7 加列，但白名单一直没收录，导致 completeOrder 走 pickOrder 后这些字段被过滤）
  'billedHours','overtimeFee','timeFee','returnFee','highwayFee','parkingFee',
  'suppliesFee','fuelFee','discountAmount','gst','hourlyRate',
  // 客服端编辑已完成订单的审计字段
  'editedAt','editedBy','editReason',
  // B2B 企业客户联动（5/18 加）— isB2BOrder 标记企业月结单跳过定金，b2bCompanyId 关联 b2bCustomers
  'isB2BOrder','b2bCompanyId','b2bCompanyName',
])

const STORAGE_COLUMNS = new Set([
  'id','status','customerName','customerPhone','wechat','moveInDate','moveOutDate',
  'actualMoveOutDate','boxes','furniture','items','location','deposit','depositStatus',
  'depositScreenshot','paymentStatus','notes','requestedMaterials','photos','hasVideo',
  'assignedTo','assignedWorkers','dispatchedAt','confirmedAt','confirmChecks','csNote',
  'workerStatus','arrivedAt','movingFee','completedAt','createdAt',
  // 取件信息 — 占用同一时段容量池，slot 函数会读这几列
  'vehicle','date','startTime','endTime','fromAddress','deliveryAddress',
  'needsPickup','needsReturn','source','createdBy','createdByName',
  'weeklyFee','totalFee','weeks','orderNo',
  // 师傅交单时写入的运输部分账单（结构和 orders 表完全对齐）
  'billedHours','timeFee','returnFee','stairFee','overtimeFee','heavyFee','heavyItems',
  'highwayFee','parkingFee','suppliesFee','fuelFee','discountAmount','gst',
  'hourlyRate','finalAmount','paymentMethod','workerNote',
  // 客服端「编辑账单」审计字段
  'editedAt','editedBy','editReason',
  // B2B 企业客户联动（5/18 加）
  'isB2BOrder','b2bCompanyId','b2bCompanyName',
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

  // Per-order timer state — localStorage key 形如 timerState_<orderId>
  // Why: 旧版用单个全局 timerState key，会让订单 A 的"已结束"状态污染到订单 B
  // How to apply: 师傅端进 WorkPage 时只读对应 orderId 的 timer，离开时清掉对应 key
  function getTimerState(orderId) {
    if (!orderId) return null
    try {
      const raw = localStorage.getItem(`timerState_${orderId}`)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }
  function setTimerState(orderId, state) {
    if (!orderId) return
    if (state) localStorage.setItem(`timerState_${orderId}`, JSON.stringify(state))
    else localStorage.removeItem(`timerState_${orderId}`)
  }
  function clearAllTimerStates() {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('timerState_')) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
  }

  // One-time cleanup of old localStorage order/staff data (v3 → v4 → v5)
  // v5: clean up old global timerState key (now per-order)
  useEffect(() => {
    if (localStorage.getItem('appVersion') !== 'v5') {
      localStorage.removeItem('orders')
      localStorage.removeItem('storageOrders')
      localStorage.removeItem('staff')
      localStorage.removeItem('timerState')  // 旧的全局 key，已被 per-order 替换
      localStorage.setItem('appVersion', 'v5')
    }
  }, [])

  // Fetch all Supabase data on mount + subscribe to realtime changes
  useEffect(() => {
    async function init() {
      try {
        const [ordersRes, storageRes, staffRes] = await Promise.all([
          supabase.from('orders').select('*').order('created_at', { ascending: false }),
          supabase.from('storage_orders').select('*').order('created_at', { ascending: false }),
          // S1-D: staff 表已锁，必须通过 list_staff RPC 读取（不含密码）
          supabase.rpc('list_staff'),
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
        else if (eventType === 'UPDATE') setOrders(prev => prev.map(x => {
          if (x.id !== n.id) return x
          // 并发防护 7/13：已完成/已取消是终态，不被迟到的旧事件顶回进行中等非终态，
          // 保证同组师傅看到的最终状态一致（满足需求④）
          const TERMINAL = ['已完成', '已取消']
          if (TERMINAL.includes(x.status) && !TERMINAL.includes(n.status)) return x
          return n
        }))
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

  const worker = user?.role === 'worker' ? user : null
  const workers = staff.filter(s => s.role === 'worker')

  // S1-D: 登录走 RPC，不再让前端能直接 SELECT staff 表
  // RPC 用 SECURITY DEFINER 在数据库内部验证密码 + 返回不含密码字段的用户对象
  async function login(username, password) {
    const { data, error } = await supabase.rpc('login_staff', {
      p_username: username,
      p_password: password,
    })
    if (error) {
      console.error('[Supabase] login_staff failed:', error)
      return false
    }
    if (!data) return false  // 用户名或密码错误，RPC 返回 null
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
    localStorage.removeItem('user')
    clearAllTimerStates()  // 切账号时清掉所有 per-order timer，避免下个登录用户继承
  }

  // 师傅确认派单 — async + throw 版，调用方必须 try/catch
  // Why: 之前 fire-and-forget 让师傅误以为确认成功，DB 实际没写
  async function confirmOrder(orderId) {
    const updates = { status: '师傅已确认', confirmedAt: new Date().toISOString() }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o))
    const { error } = await supabase.from('orders').update(pickOrder(updates)).eq('id', orderId)
    if (error) {
      console.error('[Supabase] confirmOrder failed:', error)
      throw new Error(error.message || '确认失败，请刷新重试')
    }
  }

  // async + throw 版：调用方必须 await + try/catch，失败能给用户明确反馈
  // 师傅交单 = 终态权威写入：不管几个师傅、同一单被按开始/暂停/结束多少次，
  // 谁提交一次就必须落库。
  // 【历史坑】旧版用「进 FormPage 时锁的 version」当乐观锁闸门（.eq('version', 旧值)）。
  // 但 orders 有 bump_version 触发器，师傅自己的备注自动保存 / 计时写入都会把 version +1，
  // 导致提交时旧 version 对不上 → 匹配 0 行 → 状态和费用一个字都没写进去 → 还停「进行中」，
  // 要交两次才成（师傅越多越容易中招）。现去掉该闸门。
  // 【并发闸门 7/13】提交闸门从「≠已取消」收紧为「status 不在 已完成/已取消」：
  //   多师傅时，师傅 A 交完 → status 已完成；师傅 B 再交，闸门匹配 0 行 → 不覆盖 A 的账单，
  //   明确提示「已由他人提交」。旧版只拦已取消，B 会把 A 的账单盖掉且读回仍是已完成 → 静默覆盖。
  // 不会让「单人交两次」复发：单人第一次提交时 status 还是「进行中」，闸门放行。
  // 用 .select() 返回的行数判定是否真的写入（0 行 = 被闸门拦下），取代原来的额外读回。
  async function completeOrder(orderId, result) {
    const updates = { status: '已完成', ...result }
    const snapshot = orders.find(o => o.id === orderId)  // 失败时回滚用
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o))

    const { data, error } = await supabase
      .from('orders')
      .update(pickOrder(updates))
      .eq('id', orderId)
      .neq('status', '已完成')   // 已完成不覆盖（防第二个师傅盖掉第一个的账单）
      .neq('status', '已取消')   // 客服已取消不覆盖
      .select('id')
    if (error) {
      console.error('[Supabase] completeOrder failed:', error)
      if (snapshot) setOrders(prev => prev.map(o => o.id === orderId ? snapshot : o))
      throw new Error(error.message || '提交失败，请重试')
    }

    // 匹配 0 行 = 被闸门拦下（单已是 已完成 或 已取消）。拉最新真实行同步本地（不回滚成旧的进行中，
    // 要反映真实终态：若别人已交完，本地就该显示那份已完成账单），再明确报错。
    if (!data || data.length === 0) {
      const { data: cur } = await supabase.from('orders').select('*').eq('id', orderId).single()
      if (cur) setOrders(prev => prev.map(o => o.id === orderId ? cur : o))
      throw new Error(cur?.status === '已取消'
        ? '此单已被客服取消，无法交单，请刷新页面'
        : '此单已由其他师傅提交完成，无需重复提交')
    }
  }

  // 【并发闸门 7/13】师傅开始计时 — 条件原子写，保证一个订单只有一个开始时间。
  // 只有「还没人开始（workStartedAt IS NULL）且未完成/未取消」才抢到第一个开始并置为进行中。
  // 抢不到（0 行）= 已有人开始 → 拉最新行同步本地，师傅直接加入已在跑的计时（不另起一个开始时间）。
  // 返回 { alreadyStarted } 供 UI 决定是否提示。
  async function startWork(orderId) {
    const now = new Date().toISOString()
    const patch = {
      workStatus: 'running',
      workStartedAt: now,
      workAccumulatedSec: 0,
      workRunStartedAt: now,
      workEndedAt: null,
      workStartedBy: user?.id || null,
      status: '进行中',
    }
    const { data, error } = await supabase
      .from('orders')
      .update(pickOrder(patch))
      .eq('id', orderId)
      .is('workStartedAt', null)   // 只有还没人开始才写
      .neq('status', '已完成')
      .neq('status', '已取消')
      .select('*')
    if (error) {
      console.error('[Supabase] startWork failed:', error)
      throw new Error(error.message || '开始失败，请重试')
    }
    if (data && data.length > 0) {
      // 抢到第一个开始 —— 用返回行更新本地
      setOrders(prev => prev.map(o => o.id === orderId ? data[0] : o))
      return { alreadyStarted: false }
    }
    // 已有人开始（或已完成/已取消）→ 拉最新行同步本地，加入已在跑的计时
    const { data: cur } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (cur) setOrders(prev => prev.map(o => o.id === orderId ? cur : o))
    return { alreadyStarted: true, status: cur?.status, startedBy: cur?.workStartedBy }
  }

  // 寄存订单师傅交单：状态进入「寄存中」（不是「已完成」—— 寄存中是物品仍在库的状态）
  async function completeStorageOrder(orderId, result, expectedVersion) {
    const updates = { status: '寄存中', workerStatus: 'done', completedAt: new Date().toISOString(), ...result }
    setStorageOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o))
    let query = supabase.from('storage_orders').update(pickStorage(updates)).eq('id', orderId)
    if (typeof expectedVersion === 'number') {
      query = query.eq('version', expectedVersion)
    }
    const { error, count } = await query.select('*', { count: 'exact', head: true })
    if (typeof expectedVersion === 'number' && count === 0 && !error) {
      throw new Error('寄存订单已被他人修改，请刷新页面后重新提交')
    }
    if (error) {
      console.error('[Supabase] completeStorageOrder failed:', error)
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

  // 创建订单 — async + throw 版
  // Why: 创单失败必须让用户知道，不能假装成功（之前 IkeaBooking 静默失败一周）
  async function createOrder(orderData) {
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
    const { data, error } = await supabase.from('orders').insert(pickOrder(newOrder)).select().single()
    if (error) {
      console.error('[Supabase] createOrder failed:', error)
      // 回滚乐观更新，避免本地 state 留个数据库没有的"幽灵单"
      setOrders(prev => prev.filter(o => o.id !== newOrder.id))
      throw new Error(error.message || '创建订单失败，请重试')
    }
    // 用返回行替换本地乐观行 —— 带上触发器生成的 orderNo
    if (data) setOrders(prev => prev.map(o => o.id === newOrder.id ? data : o))
    return data || newOrder
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
    bg(supabase.from('orders').update({ customer_code: customerCode }).eq('id', data.order_id), '客户编码生成')

    // 取回触发器生成的 orderNo（RPC 内部已 INSERT，号已生成）
    let assignedOrderNo
    try {
      const { data: row } = await supabase.from('orders').select('*').eq('id', data.order_id).single()
      assignedOrderNo = row?.orderNo
    } catch { /* 取不到不影响下单，realtime 会补 */ }

    // Build local order object with the server-generated ID
    const newOrder = { ...payload, id: data.order_id, customer_code: customerCode, orderNo: assignedOrderNo }
    // Guard against realtime duplicate (subscription will also fire INSERT)
    setOrders(prev => prev.some(x => x.id === newOrder.id) ? prev : [newOrder, ...prev])
    return newOrder
  }

  function updateOrder(orderId, updates) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o))
    bg(supabase.from('orders').update(pickOrder(updates)).eq('id', orderId), '更新订单')
  }

  // 师傅端工作计时上云 — 把计时状态写到订单行，靠 realtime 同步给同组所有师傅
  // Why: 旧版计时只存本地 localStorage，导致①同组师傅各跑各的不同步 ②重登录/清缓存丢失
  // How: 只在按钮（开始/暂停/继续/结束）时调用，不是每秒写；写失败 bg() 会弹窗提示
  function updateOrderTimer(orderId, patch) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...patch } : o))
    bg(supabase.from('orders').update(pickOrder(patch)).eq('id', orderId), '工作计时同步')
  }

  // 派单 — async + throw 版
  // Why: 派单失败不能让客服误以为派出去了，导致漏单
  async function dispatchOrder(orderId, workerIds) {
    const ids = Array.isArray(workerIds) ? workerIds : [workerIds]
    const updates = {
      assignedTo: ids[0],
      assignedWorkers: ids,
      status: '已派单',
      dispatchedAt: new Date().toISOString(),
    }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o))
    const { error } = await supabase.from('orders').update(pickOrder(updates)).eq('id', orderId)
    if (error) {
      console.error('[Supabase] dispatchOrder failed:', error)
      throw new Error(error.message || '派单失败，请重试')
    }
  }

  function updateOrderStatus(orderId, status) {
    // 合法转换校验 — 防止"已完成"被误改回"待确认"等非法转换
    const current = orders.find(o => o.id === orderId)
    if (current && !isLegalOrderTransition(current.status, status)) {
      console.warn(`[orderStatus] illegal transition: ${current.status} -> ${status}`)
      throw new Error(`状态转换不合法：${current.status} → ${status}`)
    }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    bg(supabase.from('orders').update(pickOrder({ status })).eq('id', orderId), '更新订单状态')
  }

  // 创建寄存订单 — async + throw 版
  // Why: 5/7-5/13 静默漏单一周事故的根因，绝不能再 fire-and-forget
  async function createStorageOrder(data) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
    const newStorage = {
      ...data,
      id: `STG-${dateStr}-${rand}`,
      status: data.status || '待确认',
      createdAt: new Date().toISOString(),
    }
    setStorageOrders(prev => [newStorage, ...prev])
    const { data: inserted, error } = await supabase.from('storage_orders').insert(pickStorage(newStorage)).select().single()
    if (error) {
      console.error('[Supabase] createStorageOrder failed:', error)
      // 回滚乐观更新
      setStorageOrders(prev => prev.filter(o => o.id !== newStorage.id))
      throw new Error(error.message || '创建寄存订单失败，请重试')
    }
    // 用返回行替换本地乐观行 —— 带上触发器生成的 orderNo
    if (inserted) setStorageOrders(prev => prev.map(o => o.id === newStorage.id ? inserted : o))
    return inserted || newStorage
  }

  function updateStorageOrder(id, updates) {
    setStorageOrders(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    bg(supabase.from('storage_orders').update(pickStorage(updates)).eq('id', id), '更新寄存订单')
  }

  function deleteOrder(id) {
    if ((id || '').startsWith('STG-')) {
      setStorageOrders(prev => prev.filter(o => o.id !== id))
      bg(supabase.from('storage_orders').delete().eq('id', id), '删除寄存订单')
    } else {
      setOrders(prev => prev.filter(o => o.id !== id))
      bg(supabase.from('orders').delete().eq('id', id), '删除订单')
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

  // S1-D: staff 表已锁，走 RPC 而不是直接 insert/update
  // Note: 本地 setStaff 仍是乐观更新；RPC 失败会弹 alert（bg() 包装会处理）
  function addStaffMember(data) {
    const newStaff = { ...data, id: data.username, active: true, stars: 1, isDriver: !!(data.canDrive?.length) }
    setStaff(prev => [...prev, newStaff])
    bg(supabase.rpc('add_staff', { p_data: newStaff }), '添加员工')
  }

  function updateStaffMember(id, updates) {
    setStaff(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    bg(supabase.rpc('update_staff', { p_id: id, p_updates: updates }), '更新员工信息')
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
      o.orderNo || o.id,
      o.date || '',
      o.startTime || '',
      o.customerName || '',
      o.customerPhone || '',
      o.vehicle || '',
      (o.fromAddress || '').replace(/,/g, '，'),
      (o.toAddress || '').replace(/,/g, '，'),
      o.quote || '',
      o.finalAmount || '',
      isDepositPaid(o) ? '已收' : (o.depositStatus === 'pending' ? '待定' : '未收'),
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
      orders, confirmOrder, completeOrder, startWork, getMyOrders,
      createOrder, createOrderWithSlotCheck,
      updateOrder, updateOrderTimer, dispatchOrder, updateOrderStatus,
      storageOrders, createStorageOrder, updateStorageOrder, completeStorageOrder, deleteOrder,
      secondhandItems, createSecondhandItem, updateSecondhandItem,
      secondhandLeads, createSecondhandLead, updateSecondhandLead,
      secondhandListings, createSecondhandListing, updateSecondhandListing, deleteSecondhandListing,
      b2bCustomers, createB2BCustomer, updateB2BCustomer,
      staff, addStaffMember, updateStaffMember,
      appSettings, updateAppSettings,
      getCustomers,
      getMyStorageOrders,
      workers,
      getTimerState, setTimerState,
      exportOrdersCSV,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
