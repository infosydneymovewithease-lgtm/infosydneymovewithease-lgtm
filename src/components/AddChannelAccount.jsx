// 新增运营账号 —— 2026-10-12
//
// 老板 10-12：「下面可不可以有个类似 ➕ 可以增加运营数量，
//              例如突然我们运营小红书新号了，或者抖音了怎么办」
//
// 放在两处：系统设置 → 运营配置、以及每日的平台咨询登记页。
// ⚠️ 两处都【只对 admin / manager 显示】。
//    加一个账号 = 所有客服从此每天必须登记它，而且和真实性声明、罚款挂着。
//    那是管理决定，不该让客服自己加 —— 手滑建个重复的、打错字的，
//    全团队都得天天面对。

import { useState } from 'react'

const PRESETS = ['小红书', '微信', '抖音', '小红书私信', '大众点评', 'Google', 'Facebook']

export default function AddChannelAccount({ onAdd, onCancel, busy }) {
  const [v, setV] = useState({ id: '', platform: '小红书', name: '', positioning: '', status: 'active' })
  const set = (k, x) => setV(p => ({ ...p, [k]: x }))

  // ⚠️ id 只能小写字母/数字/下划线。它会被写进 platform_inquiry.account_id，
  //    用中文会让以后查数据和对账非常痛苦。建好之后不能改。
  const idOk = /^[a-z0-9_]{2,20}$/.test(v.id)
  const ready = idOk && v.name.trim() && v.platform.trim()

  return (
    <div className="mt-3 border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50">
      <div className="flex gap-2 flex-wrap">
        <input value={v.name} onChange={e => set('name', e.target.value)}
          placeholder="账号名（如 抖音主号）" autoFocus
          className="flex-1 min-w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-red-400" />
        <input value={v.platform} onChange={e => set('platform', e.target.value)} placeholder="平台" list="platform-presets"
          className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-red-400" />
        <datalist id="platform-presets">
          {PRESETS.map(p => <option key={p} value={p} />)}
        </datalist>
      </div>
      <input value={v.positioning} onChange={e => set('positioning', e.target.value)}
        placeholder="定位（如 短视频 · 年轻客群）"
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-red-400" />
      <div className="flex gap-2 items-center flex-wrap">
        <input value={v.id} onChange={e => set('id', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          placeholder="英文代号 如 douyin"
          className={`w-36 border rounded-lg px-2 py-1.5 text-sm font-mono outline-none focus:border-red-400 ${
            v.id && !idOk ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
        {[['active', '立刻启用'], ['planned', '先放着']].map(([s, l]) => (
          <button key={s} onClick={() => set('status', s)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
              v.status === s ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}>{l}</button>
        ))}
        <span className="flex-1" />
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-500">取消</button>
        <button disabled={busy || !ready} onClick={() => onAdd(v)}
          className="px-4 py-1.5 rounded-lg text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#6b1414,#c0392b)' }}>添加</button>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">
        英文代号只能小写字母/数字/下划线，<b>建好后不能改</b> —— 它会写进每天的咨询登记里。<br />
        选「立刻启用」= 从今天起所有客服每天都要登记它；「先放着」= 灰显不必填。
      </p>
    </div>
  )
}
