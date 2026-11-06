// 收款账户 —— 全站唯一一份
//
// ⚠️ 2026-11-06 换账号时发现：三个下单页各抄了一份账号，
//    其中【两份是占位符】—— IKEA 预订和寄存预订页上写着
//      BSB：062-000  账号：1234 5678
//    客人照着这个转账根本转不出去。不知道挂了多久，
//    也不知道多少人看到后直接放弃了预订。
//
//    这就是复制三份的代价：改一份，忘两份，而且没人会发现 ——
//    因为下单页是客人看的，自己人平时不打开。
//
// 规矩：账号只在这里写一次。任何页面要显示收款信息，从这里取。
export const BANK = {
  bank:          'Commonwealth Bank (CBA)',
  accountName:   'Sydney MoveWithEase',
  bsb:           '062133',
  accountNumber: '11849844',
}

// ⚠️ PayID 暂时不显示。换账号时没确认它还指不指向新账户 ——
//    一个指错地方的 PayID 比没有 PayID 危险得多，钱会进别人的账。
//    确认有效后在这里填上，三个页面会一起出现。
export const PAYID = null

/** 定金：澳洲银行转账 $30 AUD，支付宝 ¥150 RMB（老板 5/7 定） */
export const DEPOSIT_AUD = 30
export const DEPOSIT_RMB = 150
