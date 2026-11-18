const QR=require('qrcode'), fs=require('fs'), {execFileSync}=require('child_process')
module.exports = async function make(o, out='/tmp/labels.html'){
  const qr=await QR.toDataURL('https://qianxibanjia.com.au/storage/'+o.id,{margin:0,width:240})
  const L=[]
  for(let i=1;i<=(o.boxes||0);i++)L.push({t:'纸箱',n:i,m:o.boxes})
  for(let i=1;i<=(o.furniture||0);i++)L.push({t:'家具',n:i,m:o.furniture})
  const lab=x=>`<div class=label>
  <div class=hd><span class=b>迁喜搬家 · 仓储</span><span class=no>${o.orderNo}</span></div>
  <div class=mid><div class=lf>
    <div class=nm>${o.customerName}</div><div class=ph>${o.customerPhone||''}</div>
    <div class=dt><div>入库　<b>${o.moveInDate}</b></div><div>出库　<b>${o.moveOutDate}</b></div></div>
  </div><div class=qr><img src='${qr}'><div class=qt>扫码看这单</div></div></div>
  <div class=ft><span class=cnt>${x.t} ${x.n} / ${x.m}</span><span class=tel>0426 033 899</span></div>
</div>`
  const pages=[]
  for(let p=0;p<Math.ceil(L.length/8);p++) pages.push('<div class=sheet>'+L.slice(p*8,p*8+8).map(lab).join('')+'</div>')
  fs.writeFileSync(out,`<!doctype html><meta charset=utf-8><style>
@page{size:A4;margin:0}body{margin:0;font-family:'PingFang SC',-apple-system,sans-serif;color:#000}
.sheet{width:210mm;height:297mm;display:grid;grid-template-columns:99.1mm 99.1mm;grid-auto-rows:67.7mm;padding:13.1mm 5.9mm;box-sizing:border-box;page-break-after:always}
.label{width:99.1mm;height:67.7mm;box-sizing:border-box;padding:4.5mm 5mm;display:flex;flex-direction:column;overflow:hidden}
.hd{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1.5px solid #000;padding-bottom:1.5mm}
.b{font-size:10pt;font-weight:700}.no{font-size:11pt;font-weight:700}
.mid{display:flex;gap:3mm;margin-top:2.5mm;flex:1}.lf{flex:1;min-width:0}
.nm{font-size:12pt;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ph{font-size:9.5pt;margin-top:.5mm}.dt{font-size:9pt;margin-top:2mm;line-height:1.45}
.qr{text-align:center}.qr img{width:17mm;height:17mm;display:block}.qt{font-size:6pt;color:#666}
.ft{margin-top:1.5mm;padding-top:1.5mm;border-top:1px dashed #888;display:flex;justify-content:space-between;align-items:baseline}
.cnt{font-size:15pt;font-weight:800}.tel{font-size:7.5pt;color:#555}
</style>`+pages.join(''))
  return L.length
}
