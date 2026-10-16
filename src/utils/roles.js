// 角色与可见性 —— 配置驱动，不在组件里写死 if 分支
//
// 2026-10-11 新增 manager（客服经理，Annie Annie）。
// 背景：原来只有 admin / cs 两级，判断写成一句
//   if (item.adminOnly && user?.role !== 'admin') return null
// 非黑即白，没有中间层 —— 客服经理和她管的人看到的是同一个界面，「监管」无从谈起。
//
// 以后要加角色（比如 AI 参谋长的只读角色），只需在 ROLES 里加一行、
// 在对应菜单项的 roles 数组里加个名字，不用改任何组件。

export const ROLES = {
  admin:   { label: '管理员',   rank: 3 },
  manager: { label: '客服经理', rank: 2 },
  cs:      { label: '客服',     rank: 1 },
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
  if (!item.roles) return true
  return item.roles.includes(role)
}
