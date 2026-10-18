// 角色与可见性 —— 配置驱动，不在组件里写死 if 分支
//
// 2026-10-11 新增 manager（客服经理，Annie）。
// 背景：原来只有 admin / cs 两级，判断写成一句
//   if (item.adminOnly && user?.role !== 'admin') return null
// 非黑即白，没有中间层 —— 客服经理和她管的人看到的是同一个界面，「监管」无从谈起。
//
// 2026-10-18 新增 ops（运营，Lili）。
// 老板：「我目前交给 lili 的就一个任务，今天要发，和内容排期」
// 前面几个角色都是「默认全看得到，个别页面挡掉」，
// 运营反过来 —— 默认什么都看不到，只开两页。
// 所以加了 only：列出来的才看得见。两种写法并存，不用把每一行菜单都标一遍。

export const ROLES = {
  admin:   { label: '管理员',   rank: 3 },
  manager: { label: '客服经理', rank: 2 },
  cs:      { label: '客服',     rank: 1 },
  // ⚠️ only 是白名单：没列出来的一律看不见、也进不去。
  //    新人第一周就能翻到全部客户电话和师傅工资，没必要。
  ops:     { label: '运营',     rank: 1, only: ['/admin/content', '/admin/content-today'] },
  worker:  { label: '师傅',     rank: 0 },
}

/** 侧边栏底部显示的角色名。未知角色回退「客服」，与改动前的行为一致。 */
export function roleLabel(role) {
  return ROLES[role]?.label ?? '客服'
}

/**
 * 菜单项/功能是否对该角色可见。
 * item.roles 未声明 = 所有后台角色都能看（和改动前「没有 adminOnly」等价）。
 */
export function canSee(item, role) {
  const only = ROLES[role]?.only
  // 白名单角色：连分隔线都不显示（item.to 是 undefined，不在名单里）
  if (only) return only.includes(item.to)
  if (!item.roles) return true
  return item.roles.includes(role)
}

/**
 * 这个角色能不能打开这个地址。
 * ⚠️ 藏菜单 ≠ 控制访问 —— 直接在地址栏敲 /admin/wages 照样进得去，
 *    所以白名单必须在路由上也挡一道（App.jsx 的 AdminRoute）。
 */
export function canOpen(path, role) {
  const only = ROLES[role]?.only
  if (!only) return true
  return only.includes(path)
}

/** 登录后／被挡回去时落在哪一页。白名单角色落在它的第一页。 */
export function homeFor(role) {
  return ROLES[role]?.only?.[0] ?? '/admin'
}
