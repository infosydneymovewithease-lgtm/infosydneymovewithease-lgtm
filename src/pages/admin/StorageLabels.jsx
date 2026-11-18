// 寄存标签打印
//
// 2026-11-18。老板：「我们寄存订单需要给客户贴寄存单在物品上，
//   以前打印出模板手动填写，一张两张还好，多了就要大量时间很是麻烦」
//
// 以前是打印空白表格手写。一单 10 件就要写 10 张，
// 每张都要重抄订单号、客户名、电话、入库日、出库日。
//
// 排版按 A4 【八格】不干胶标签纸：99.1 × 67.7 mm，2 列 × 4 行。
// 老板 11-18 买的是 PPS Shipping Labels（8 labels per A4 sheet），
// 等同于 Avery L7165 规格。宽度和四格的一样，高度只有一半 ——
// 所以内容排得更紧，二维码挪到右边和文字并排。
// 没有标签纸时用普通 A4 打出来剪开也一样。
//
// 页边距是算出来居中的：
//   上下  (297 − 4×67.7) ÷ 2 = 13.1mm
//   左右  (210 − 2×99.1) ÷ 2 = 5.9mm

import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useEffect, useState } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'
import QRCode from 'qrcode'

/** 一张 A4 八格（99.1 × 67.7 mm，2 列 × 4 行）*/
const PER_SHEET = 8

/** 一单拆成几张标签：纸箱和家具分开编号，出库时好点数 */
function buildLabels(order) {
  const out = []
  const n箱 = Number(order?.boxes) || 0
  const n家 = Number(order?.furniture) || 0
  for (let i = 1; i <= n箱; i++) out.push({ 类: '纸箱', 第: i, 共: n箱 })
  for (let i = 1; i <= n家; i++) out.push({ 类: '家具', 第: i, 共: n家 })
  return out
}

export default function StorageLabels() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { storageOrders } = useApp()
  const order = storageOrders.find(o => o.id === id)
  const [qr, setQr] = useState('')

  // ⚠️ 二维码指向【师傅端】那个页面 —— 在仓库扫码的是师傅，不是客服。
  //    扫一下就知道这件东西是谁的、什么时候到期。
  const url = typeof window !== 'undefined' ? `${window.location.origin}/storage/${id}` : ''

  useEffect(() => {
    if (!url) return
    QRCode.toDataURL(url, { margin: 0, width: 240, errorCorrectionLevel: 'M' })
      .then(setQr).catch(() => setQr(''))
  }, [url])

  if (!order) return <div className="p-8 text-gray-400">找不到这张单</div>

  const labels = buildLabels(order)

  return (
    <>
      {/* ⚠️ 打印样式：屏幕上是预览，打印时只出标签。
          @page margin 0 + 外层 padding 对齐 L7169 的页边距（上下 9.5mm / 左右 5.9mm） */}
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { margin: 0; }
          .no-print { display: none !important; }
          .sheet {
          width: 210mm; display: grid;
          grid-template-columns: 99.1mm 99.1mm;
          grid-auto-rows: 67.7mm;
          gap: 0; padding: 13.1mm 5.9mm; box-sizing: border-box;
          background: #fff;
        }
        .label {
          width: 99.1mm; height: 67.7mm; box-sizing: border-box;
          padding: 4.5mm 5mm; display: flex; flex-direction: column;
          font-family: -apple-system, 'PingFang SC', sans-serif; color: #000;
          overflow: hidden;
        }
      `}</style>

      <div className="no-print bg-gray-100 px-5 py-4 flex items-center gap-3 sticky top-0 z-10 border-b">
        <button onClick={() => navigate(`/admin/storage/${id}`)} className="p-2 text-gray-500 hover:text-gray-800">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900">{order.customerName} · 寄存标签</h1>
          <p className="text-gray-400 text-sm">
            {labels.length} 张（纸箱 {order.boxes || 0} · 家具 {order.furniture || 0}）
            · 共 {Math.ceil(labels.length / PER_SHEET)} 页 A4
          </p>
        </div>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg, #6b1414, #c0392b)' }}>
          <Printer size={16} /> 打印
        </button>
      </div>

      <div className="no-print px-5 py-3 text-xs text-gray-500 bg-amber-50 border-b border-amber-200">
        💡 用 <strong>A4 八格不干胶标签纸</strong>（PPS Shipping Labels · 99.1×67.7mm · 8/页）。
        打印时记得把缩放设成 <strong>100%</strong>，不要勾「适合页面」——
        缩放了就对不上格子。没有标签纸的话用普通 A4 打出来剪开也一样。
      </div>

      {/* 每 4 张一页 */}
      {Array.from({ length: Math.ceil(labels.length / PER_SHEET) }).map((_, p) => (
        <div className="sheet" key={p}>
          {labels.slice(p * PER_SHEET, p * PER_SHEET + PER_SHEET).map((L, i) => (
            <div className="label" key={i}>
              {/* 顶栏：品牌 + 订单号 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                            borderBottom: '1.5px solid #000', paddingBottom: '1.5mm' }}>
                <span style={{ fontSize: '10pt', fontWeight: 700 }}>迁喜搬家 · 仓储</span>
                <span style={{ fontSize: '11pt', fontWeight: 700, letterSpacing: '0.3px' }}>
                  {order.orderNo || order.id}
                </span>
              </div>

              {/* 中段：左边文字，右边二维码并排 —— 八格只有 67.7mm 高，不能上下堆 */}
              <div style={{ display: 'flex', gap: '3mm', marginTop: '2.5mm', flex: 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12pt', fontWeight: 700, whiteSpace: 'nowrap',
                                overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {order.customerName}
                  </div>
                  <div style={{ fontSize: '9.5pt', marginTop: '0.5mm' }}>{order.customerPhone}</div>
                  <div style={{ fontSize: '9pt', marginTop: '2mm', lineHeight: 1.45 }}>
                    <div>入库　<strong>{order.moveInDate}</strong></div>
                    <div>出库　<strong>{order.moveOutDate}</strong></div>
                  </div>
                </div>
                {qr && (
                  <div style={{ textAlign: 'center' }}>
                    <img src={qr} alt="" style={{ width: '17mm', height: '17mm', display: 'block' }} />
                    <div style={{ fontSize: '6pt', color: '#666', marginTop: '0.5mm' }}>扫码看这单</div>
                  </div>
                )}
              </div>

              {/* ⚠️ 件号是手写标签没有的 —— 出库时一眼看出少没少。
                  客户说「我有 7 箱」，现在能对得上。放最底下，撕标签时最先看到。 */}
              <div style={{
                marginTop: '1.5mm', paddingTop: '1.5mm', borderTop: '1px dashed #888',
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              }}>
                <span style={{ fontSize: '15pt', fontWeight: 800, letterSpacing: '0.5px' }}>
                  {L.类} {L.第} / {L.共}
                </span>
                <span style={{ fontSize: '7.5pt', color: '#555' }}>0426 033 899</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
