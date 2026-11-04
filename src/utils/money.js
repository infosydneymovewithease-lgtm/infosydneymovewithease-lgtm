// 金额显示 —— 唯一一个口径
//
// ⚠️ 2026-11-04 老板看到工作台写着「今日收入 $1083.8899999999999」。
//    数据没问题，是显示没格式化：
//        const todayRevenue = orders.reduce((s, o) => s + o.finalAmount, 0)
//        <StatCard value={`$${todayRevenue}`} />
//    一串两位小数相加，浮点误差就露出来了（0.1 + 0.2 = 0.30000000000000004）。
//
// 规矩：【任何金额】都经过这个函数再显示，不许直接 `${n}` 插进模板字符串。
//    单个存着的价钱（$30 定金、$160/小时）看着没事，但只要参与过加减，
//    迟早会变成一串 9。
//
// 带千分位：$1,083.89 比 $1083.89 好认，金额一大就看得出来。
export function money(n) {
  return `$${(Number(n) || 0).toLocaleString('en-AU', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`
}

/** 只要数字不要美元符号（填进输入框、拼在句子里用） */
export function amount(n) {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2)
}
