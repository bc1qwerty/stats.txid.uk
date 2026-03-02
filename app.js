'use strict';
const API='https://mempool.space/api';
(function(){const t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme:light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);document.getElementById('theme-btn').textContent=t==='dark'?'🌙':'☀️';})();
function toggleTheme(){const h=document.documentElement;const n=h.getAttribute('data-theme')==='dark'?'light':'dark';h.setAttribute('data-theme',n);localStorage.setItem('theme',n);document.getElementById('theme-btn').textContent=n==='dark'?'🌙':'☀️';loadAll();}

function period(){return document.getElementById('period-sel').value;}

async function loadAll(){
  try{
    const p=period();
    const[hashData,blocks,pools,recBlocks]=await Promise.all([
      fetch(`${API}/v1/mining/hashrate/${p}`).then(r=>r.json()),
      fetch(`${API}/v1/mining/blocks/sizes-weights/${p}`).then(r=>r.json()),
      fetch(`${API}/v1/mining/pools/1w`).then(r=>r.json()),
      fetch(`${API}/v1/blocks`).then(r=>r.json()),
    ]);
    renderKPIs(hashData,recBlocks);
    drawLineChart('hash-chart',hashData.hashrates.map(d=>({t:d.timestamp,v:d.avgHashrate/1e18})),'EH/s','#f7931a');
    drawLineChart('diff-chart',hashData.difficulty.map(d=>({t:d.timestamp,v:d.difficulty/1e12})),'T','#58a6ff');
    if(blocks.sizes) drawLineChart('fee-chart',blocks.sizes.map((d,i)=>({t:d.timestamp||i,v:(d.avgSize||0)/1e6})),'MB','#3fb950');
    renderPools(pools);
    renderBlockStats(recBlocks);
  }catch(e){console.warn(e);}
}

function renderKPIs(hash,blocks){
  const last=hash.hashrates[hash.hashrates.length-1]||{};
  const lastDiff=hash.difficulty[hash.difficulty.length-1]||{};
  const prevDiff=hash.difficulty[hash.difficulty.length-2]||{};
  const diffChg=prevDiff.difficulty?(lastDiff.difficulty-prevDiff.difficulty)/prevDiff.difficulty*100:0;
  const block=blocks[0]||{};
  const totalBtc=21000000;
  const mined=block.height?Math.floor(block.height/210000)*10.5+Math.min(block.height%210000,210000)*(50/(Math.pow(2,Math.floor(block.height/210000)))):0;
  document.getElementById('kpi-row').innerHTML=`
    <div class="kpi-card"><div class="kpi-val">${((last.avgHashrate||0)/1e18).toFixed(1)}</div><div class="kpi-lbl">해시레이트 (EH/s)</div></div>
    <div class="kpi-card"><div class="kpi-val">${((lastDiff.difficulty||0)/1e12).toFixed(2)}T</div><div class="kpi-lbl">채굴 난이도</div><div class="kpi-change ${diffChg>=0?'up':'down'}">${diffChg>=0?'+':''}${diffChg.toFixed(2)}%</div></div>
    <div class="kpi-card"><div class="kpi-val">${(block.height||0).toLocaleString()}</div><div class="kpi-lbl">현재 블록높이</div></div>
    <div class="kpi-card"><div class="kpi-val">${((block.extras?.totalFees||0)/1e8).toFixed(4)}</div><div class="kpi-lbl">최근 블록 수수료(BTC)</div></div>
    <div class="kpi-card"><div class="kpi-val">${(block.tx_count||0).toLocaleString()}</div><div class="kpi-lbl">최근 블록 TX 수</div></div>
    <div class="kpi-card"><div class="kpi-val">${(mined/1e6).toFixed(3)}M</div><div class="kpi-lbl">채굴된 BTC</div></div>
    <div class="kpi-card"><div class="kpi-val">${((totalBtc-mined)/1e4).toFixed(0)}만</div><div class="kpi-lbl">남은 BTC</div></div>
  `;
}

function drawLineChart(id,data,unit,color){
  const canvas=document.getElementById(id);
  if(!canvas||!data||!data.length)return;
  const ctx=canvas.getContext('2d');
  const W=canvas.offsetWidth||500;const H=160;
  canvas.width=W*2;canvas.height=H*2;ctx.scale(2,2);
  const isDark=document.documentElement.getAttribute('data-theme')!=='light';
  ctx.fillStyle=isDark?'#161b22':'#ffffff';ctx.fillRect(0,0,W,H);
  const vals=data.map(d=>d.v);
  const min=Math.min(...vals);const max=Math.max(...vals);
  const pad={t:14,r:8,b:20,l:44};
  const W2=W-pad.l-pad.r;const H2=H-pad.t-pad.b;
  const x=i=>pad.l+i*(W2/(data.length-1));
  const y=v=>pad.t+H2-(v-min)/(max-min||1)*H2;
  // 그리드
  ctx.strokeStyle=isDark?'#21262d':'#eaeef2';ctx.lineWidth=0.5;
  for(let i=0;i<=4;i++){const yy=pad.t+H2/4*i;ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(W-pad.r,yy);ctx.stroke();}
  // 레이블
  ctx.fillStyle=isDark?'#6e7681':'#8c959f';ctx.font='8px monospace';ctx.textAlign='right';
  for(let i=0;i<=4;i++){const v=max-(max-min)/4*i;ctx.fillText(v.toFixed(1),pad.l-3,pad.t+H2/4*i+3);}
  // 라인
  const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+H2);
  grad.addColorStop(0,color+'66');grad.addColorStop(1,color+'00');
  ctx.beginPath();data.forEach((d,i)=>i===0?ctx.moveTo(x(i),y(d.v)):ctx.lineTo(x(i),y(d.v)));
  ctx.lineTo(x(data.length-1),pad.t+H2);ctx.lineTo(x(0),pad.t+H2);ctx.closePath();
  ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();data.forEach((d,i)=>i===0?ctx.moveTo(x(i),y(d.v)):ctx.lineTo(x(i),y(d.v)));
  ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.stroke();
  // 단위
  ctx.fillStyle=isDark?'#8b949e':'#656d76';ctx.textAlign='left';ctx.fillText(unit,pad.l+2,pad.t+10);
}

function renderPools(pools){
  const el=document.getElementById('pool-list');
  const total=pools.blockCount||1;
  el.innerHTML=(pools.pools||[]).slice(0,15).map(p=>{
    const pct=((p.blockCount/total)*100).toFixed(1);
    const w=((p.blockCount/pools.pools[0].blockCount)*100).toFixed(0);
    return`<div class="pool-row">
      <span class="pool-name">${p.name}</span>
      <div class="pool-bar-wrap"><div class="pool-bar" style="width:${w}%"></div></div>
      <span class="pool-pct">${pct}%</span>
    </div>`;
  }).join('');
}

function renderBlockStats(blocks){
  const el=document.getElementById('block-stats');
  const avg=arr=>arr.reduce((s,v)=>s+v,0)/arr.length;
  const sizes=blocks.map(b=>b.size);const fees=blocks.map(b=>b.extras?.totalFees||0);const txs=blocks.map(b=>b.tx_count);
  el.innerHTML=`
    <div class="bs-row"><span class="bs-key">평균 블록 크기</span><span class="bs-val">${(avg(sizes)/1024).toFixed(0)} KB</span></div>
    <div class="bs-row"><span class="bs-key">평균 TX 수</span><span class="bs-val">${avg(txs).toFixed(0)}</span></div>
    <div class="bs-row"><span class="bs-key">평균 총 수수료</span><span class="bs-val">${(avg(fees)/1e8).toFixed(4)} BTC</span></div>
    <div class="bs-row"><span class="bs-key">최대 TX 수</span><span class="bs-val">${Math.max(...txs).toLocaleString()}</span></div>
    <div class="bs-row"><span class="bs-key">최소 TX 수</span><span class="bs-val">${Math.min(...txs).toLocaleString()}</span></div>
    <div class="bs-row"><span class="bs-key">데이터 기준</span><span class="bs-val">최근 ${blocks.length}블록</span></div>
  `;
}

loadAll();
