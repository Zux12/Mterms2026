const API = 'https://mterm2026-559f9bf571b5.herokuapp.com';
const ADMIN_KEY = 'mterms-admin-basic';
const $ = id => document.getElementById(id);

let currentPage = 1;
const pageSize = 20;
let totalRows = 0;
let dashboardData = null;

function authHeader(){
  const token = localStorage.getItem(ADMIN_KEY);
  return token ? { Authorization: 'Basic ' + token } : {};
}

function fmtNumber(n){
  return new Intl.NumberFormat('en-MY').format(Number(n || 0));
}

function fmtDuration(seconds){
  const s = Math.max(0, Number(seconds || 0));
  if (s < 60) return `${Math.round(s)} sec`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function fmtDate(value){
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-MY');
}

function escapeHtml(value){
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function dateParams(){
  return new URLSearchParams({
    start: $('startDate').value,
    end: $('endDate').value
  });
}

function setDefaultDates() {
  const end = new Date();

  // Always start from 1 May 2026
  $('startDate').value = '2026-05-01';

  // End date is today
  $('endDate').value = end.toISOString().slice(0, 10);
}

function requireLogin(){
  if (!localStorage.getItem(ADMIN_KEY)) {
    $('loginBlock').classList.remove('hidden');
    $('dashboard').classList.add('hidden');
    return false;
  }
  $('loginBlock').classList.add('hidden');
  $('dashboard').classList.remove('hidden');
  return true;
}

function clearCanvas(canvas){
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.clearRect(0,0,rect.width,rect.height);
  return {ctx,width:rect.width,height:rect.height};
}

function drawBarChart(canvasId, rows, labelKey, valueKey){
  const canvas = $(canvasId);
  const {ctx,width,height} = clearCanvas(canvas);
  const data = (rows || []).slice(0,10);
  const left = 130, right = 30, top = 20, bottom = 28;
  const chartW = Math.max(10,width-left-right);
  const chartH = Math.max(10,height-top-bottom);
  const max = Math.max(1,...data.map(x=>Number(x[valueKey]||0)));
  const gap = 9;
  const barH = Math.max(12,(chartH-gap*(data.length-1))/Math.max(1,data.length));

  ctx.font = '12px Inter, sans-serif';
  ctx.textBaseline = 'middle';

  data.forEach((row,i)=>{
    const y = top + i*(barH+gap);
    const value = Number(row[valueKey]||0);
    const w = chartW*(value/max);
    ctx.fillStyle = '#eef6ff';
    ctx.fillRect(left,y,chartW,barH);
    ctx.fillStyle = '#1e5aa8';
    ctx.fillRect(left,y,w,barH);
    ctx.fillStyle = '#344054';
    let label = String(row[labelKey] || 'Unknown');
    if(label.length>18) label = label.slice(0,17)+'…';
    ctx.textAlign='right';
    ctx.fillText(label,left-8,y+barH/2);
    ctx.textAlign='left';
    ctx.fillText(fmtNumber(value),left+w+7,y+barH/2);
  });
}

function drawLineChart(canvasId, rows, xKey, valueKey){
  const canvas = $(canvasId);
  const {ctx,width,height} = clearCanvas(canvas);
  const data = rows || [];
  const left=48,right=18,top=20,bottom=42;
  const chartW=width-left-right, chartH=height-top-bottom;
  const max=Math.max(1,...data.map(x=>Number(x[valueKey]||0)));

  ctx.strokeStyle='#dce8f5';
  ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=top+(chartH*i/4);
    ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width-right,y);ctx.stroke();
  }

  if(!data.length) return;

  ctx.strokeStyle='#1e5aa8';
  ctx.lineWidth=3;
  ctx.beginPath();
  data.forEach((row,i)=>{
    const x=left+(data.length===1?chartW/2:(chartW*i/(data.length-1)));
    const y=top+chartH-(Number(row[valueKey]||0)/max*chartH);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();

  ctx.fillStyle='#0EA5A6';
  data.forEach((row,i)=>{
    const x=left+(data.length===1?chartW/2:(chartW*i/(data.length-1)));
    const y=top+chartH-(Number(row[valueKey]||0)/max*chartH);
    ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();
  });

  ctx.font='11px Inter, sans-serif';
  ctx.fillStyle='#667085';
  ctx.textAlign='center';
  const step=Math.max(1,Math.ceil(data.length/7));
  data.forEach((row,i)=>{
    if(i%step!==0 && i!==data.length-1) return;
    const x=left+(data.length===1?chartW/2:(chartW*i/(data.length-1)));
    ctx.fillText(String(row[xKey]||'').slice(5),x,height-18);
  });
}

function drawDonut(canvasId, rows){
  const canvas=$(canvasId);
  const {ctx,width,height}=clearCanvas(canvas);
  const data=(rows||[]).slice(0,6);
  const total=data.reduce((s,x)=>s+Number(x.value||0),0)||1;
  const colors=['#0B2A6B','#1e5aa8','#0EA5A6','#16a34a','#7c3aed','#f59e0b'];
  const cx=Math.min(width*0.34,150), cy=height/2, radius=Math.min(95,height*0.33);
  let angle=-Math.PI/2;

  data.forEach((row,i)=>{
    const next=angle+(Number(row.value||0)/total)*Math.PI*2;
    ctx.beginPath();
    ctx.arc(cx,cy,radius,angle,next);
    ctx.arc(cx,cy,radius*0.57,next,angle,true);
    ctx.closePath();
    ctx.fillStyle=colors[i%colors.length];
    ctx.fill();
    angle=next;
  });

  ctx.font='12px Inter, sans-serif';
  ctx.textAlign='left';
  ctx.textBaseline='middle';
  data.forEach((row,i)=>{
    const y=35+i*34;
    ctx.fillStyle=colors[i%colors.length];
    ctx.fillRect(width*0.58,y-7,14,14);
    ctx.fillStyle='#344054';
    ctx.fillText(`${row.name || 'Unknown'} (${fmtNumber(row.value)})`,width*0.58+22,y);
  });
}

function renderSummary(summary){
  $('mVisitors').textContent=fmtNumber(summary.uniqueVisitors);
  $('mSessions').textContent=fmtNumber(summary.sessions);
  $('mViews').textContent=fmtNumber(summary.pageViews);
  $('mDuration').textContent=fmtDuration(summary.avgDurationSeconds);
  $('mPages').textContent=String(summary.avgPages||0);
  $('mNew').textContent=fmtNumber(summary.newVisitors);
  $('mReturning').textContent=fmtNumber(summary.returningVisitors);
  $('mCountries').textContent=fmtNumber(summary.totalCountries);
}

function renderPopularPages(rows){
  $('pageRows').innerHTML=(rows||[]).map(row=>`
    <tr>
      <td><strong>${escapeHtml(row.title || row.path)}</strong><div class="small">${escapeHtml(row.path)}</div></td>
      <td>${fmtNumber(row.views)}</td>
      <td>${fmtDuration(row.avgDurationSeconds)}</td>
    </tr>
  `).join('') || '<tr><td colspan="3"><em>No page data yet.</em></td></tr>';
}

async function loadDashboard(){
  if(!requireLogin()) return;

// ===== Secondary Analytics Access Code =====
const analyticsCode = sessionStorage.getItem('analyticsAccessCode');

if (analyticsCode !== '810304') {

    const entered = prompt(
        'MTERMS 2026 Website Analytics\n\n' +
        'Please enter the Analytics Access Code.'
    );

    if (entered !== '810304') {

        alert('Incorrect Analytics Access Code.');

        localStorage.removeItem(ADMIN_KEY);

        requireLogin();

        return;
    }

    sessionStorage.setItem('analyticsAccessCode', '810304');
}



  
  $('status').textContent='Loading analytics…';

  try{
    const r=await fetch(`${API}/api/analytics/admin/dashboard?${dateParams()}`,{headers:authHeader()});
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error||`HTTP ${r.status}`);

    dashboardData=data;
    renderSummary(data.summary);
    renderPopularPages(data.pages);
    drawLineChart('trendChart',data.visitorsByDay,'date','visitors');
    drawBarChart('countryChart',data.countries,'name','visitors');
    drawDonut('deviceChart',data.devices);
    drawDonut('browserChart',data.browsers);
    drawDonut('osChart',data.operatingSystems);
    drawBarChart('pagesChart',data.pages,'path','views');

    currentPage=1;
    await loadSessions();
    $('status').textContent='✅ Analytics loaded.';
  }catch(err){
    if(String(err.message).includes('401')){
      localStorage.removeItem(ADMIN_KEY);
      requireLogin();
    }
    $('status').textContent='❌ '+err.message;
  }
}

async function loadSessions(){
  const params=dateParams();
  params.set('page',currentPage);
  params.set('limit',pageSize);
  if($('countryFilter').value) params.set('country',$('countryFilter').value);
  if($('deviceFilter').value) params.set('device',$('deviceFilter').value);
  if($('pageFilter').value) params.set('path',$('pageFilter').value);

  const r=await fetch(`${API}/api/analytics/admin/sessions?${params}`,{headers:authHeader()});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||`HTTP ${r.status}`);

  totalRows=data.total||0;
  $('sessionRows').innerHTML=(data.rows||[]).map(row=>{
    const journey=(row.pages||[]).map(p=>p.path).join(' → ');
    return `<tr>
      <td>${escapeHtml(fmtDate(row.startedAt))}</td>
      <td>${escapeHtml(row.country||'Unknown')}</td>
      <td>${escapeHtml(row.deviceType||'Other')}</td>
      <td>${escapeHtml(row.browser||'Unknown')}</td>
      <td>${escapeHtml(row.operatingSystem||'Unknown')}</td>
      <td>${fmtNumber(row.totalPageViews)}</td>
      <td>${fmtDuration(row.durationSeconds)}</td>
      <td><strong>${escapeHtml(row.landingPage||'')}</strong><div class="small">${escapeHtml(journey)}</div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="8"><em>No visitor sessions found.</em></td></tr>';

  $('pageInfo').textContent=`Page ${currentPage} • ${Math.min(currentPage*pageSize,totalRows)} / ${totalRows}`;
  $('prevBtn').disabled=currentPage<=1;
  $('nextBtn').disabled=currentPage*pageSize>=totalRows;

  const countries=[...new Set((dashboardData?.countries||[]).map(x=>x.name).filter(Boolean))];
  const currentCountry=$('countryFilter').value;
  $('countryFilter').innerHTML='<option value="">All countries</option>'+countries.map(x=>`<option>${escapeHtml(x)}</option>`).join('');
  $('countryFilter').value=currentCountry;

  const pages=[...new Set((dashboardData?.pages||[]).map(x=>x.path).filter(Boolean))];
  const currentPath=$('pageFilter').value;
  $('pageFilter').innerHTML='<option value="">All pages</option>'+pages.map(x=>`<option>${escapeHtml(x)}</option>`).join('');
  $('pageFilter').value=currentPath;
}

function login(){
  const user=$('loginUser').value.trim();
  const pass=$('loginPass').value;
  if(!user||!pass){$('loginMsg').textContent='Enter username and password.';return}
  localStorage.setItem(ADMIN_KEY,btoa(`${user}:${pass}`));
  loadDashboard();
}

$('loginBtn').addEventListener('click',login);
$('loginPass').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
$('refreshBtn').addEventListener('click',loadDashboard);
$('applyFilters').addEventListener('click',async()=>{currentPage=1;await loadSessions()});
$('prevBtn').addEventListener('click',async()=>{if(currentPage>1){currentPage--;await loadSessions()}});
$('nextBtn').addEventListener('click',async()=>{if(currentPage*pageSize<totalRows){currentPage++;await loadSessions()}});

$('logoutBtn').addEventListener('click',()=>{

    localStorage.removeItem(ADMIN_KEY);

    sessionStorage.removeItem('analyticsAccessCode');

    location.href='admin.html';

});



window.addEventListener('resize',()=>{
  if(!dashboardData)return;
  drawLineChart('trendChart',dashboardData.visitorsByDay,'date','visitors');
  drawBarChart('countryChart',dashboardData.countries,'name','visitors');
  drawDonut('deviceChart',dashboardData.devices);
  drawDonut('browserChart',dashboardData.browsers);
  drawDonut('osChart',dashboardData.operatingSystems);
  drawBarChart('pagesChart',dashboardData.pages,'path','views');
});

setDefaultDates();
if(requireLogin()) loadDashboard();
