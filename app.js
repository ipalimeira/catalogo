const BOOK_ORDER = [
  "Gênesis","Êxodo","Levítico","Números","Deuteronômio","Josué","Juízes","Rute",
  "1 Samuel","2 Samuel","1 Reis","2 Reis","1 Crônicas","2 Crônicas","Esdras","Neemias",
  "Ester","Jó","Salmos","Provérbios","Eclesiastes","Cantares","Isaías","Jeremias",
  "Lamentações","Ezequiel","Daniel","Oséias","Joel","Amós","Obadias","Jonas",
  "Miquéias","Naum","Habacuque","Sofonias","Ageu","Zacarias","Malaquias",
  "Mateus","Marcos","Lucas","João","Atos","Romanos","1 Coríntios","2 Coríntios",
  "Gálatas","Efésios","Filipenses","Colossenses","1 Tessalonicenses","2 Tessalonicenses",
  "1 Timóteo","2 Timóteo","Tito","Filémon","Hebreus","Tiago","1 Pedro","2 Pedro",
  "1 João","2 João","3 João","Judas","Apocalipse"
];
const CAT_COLORS = {};
const PALETTE = ['#2F5F49','#C99A3E','#8C6A22','#51625A','#1E3D2F','#7A9E8A','#B98A2E'];

let ALL = [], PLAYLISTS = [];
let fuse = null;
let shuffleSeed = 0;
let state = { q:'', preletor:'', categoria:'', livro:'', testamento:'', ano:'', playlist:'', sort:'recente', view:'grade' };

const $ = s => document.querySelector(s);
const grid = $('#grid'), list = $('#list'), compact = $('#compact');
const resultCount = $('#result-count'), playlistBanner = $('#playlist-banner');

function fillSelect(el, values, placeholder){
  el.innerHTML = `<option value="">${placeholder}</option>` + values.map(v=>`<option value="${v}">${v}</option>`).join('');
}

function catColor(cat){
  if(!CAT_COLORS[cat]){
    const keys = Object.keys(CAT_COLORS).length;
    CAT_COLORS[cat] = PALETTE[keys % PALETTE.length];
  }
  return CAT_COLORS[cat];
}

function buildFilters(){
  fillSelect($('#f-preletor'), [...new Set(ALL.map(v=>v.preletor).filter(Boolean))].sort(), 'Preletor');
  fillSelect($('#f-categoria'), [...new Set(ALL.map(v=>v.categoria).filter(Boolean))].sort(), 'Categoria');
  fillSelect($('#f-ano'), [...new Set(ALL.map(v=>v.ano).filter(Boolean))].sort((a,b)=>b-a), 'Ano');
  const livros = [...new Set(ALL.map(v=>v.livro).filter(Boolean))].sort((a,b)=>BOOK_ORDER.indexOf(a)-BOOK_ORDER.indexOf(b));
  fillSelect($('#f-livro'), livros, 'Livro');
  const pls = PLAYLISTS.slice().sort((a,b)=>b.count-a.count);
  fillSelect($('#f-playlist'), pls.map(p=>p.playlist_name), 'Playlist');
}

function shuffle(arr, seed){
  const a = arr.slice();
  let s = seed || 1;
  const rand = () => { s = (s*9301+49297) % 233280; return s/233280; };
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(rand()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function applyFilters(){
  let out = ALL;
  if(state.preletor) out = out.filter(v=>v.preletor===state.preletor);
  if(state.categoria) out = out.filter(v=>v.categoria===state.categoria);
  if(state.livro) out = out.filter(v=>v.livro===state.livro);
  if(state.testamento) out = out.filter(v=>v.testamento===state.testamento);
  if(state.ano) out = out.filter(v=>String(v.ano)===String(state.ano));
  if(state.playlist) out = out.filter(v=>v.playlist_name===state.playlist);
  if(state.q.trim()){
    const ids = new Set(fuse.search(state.q.trim()).map(r=>r.item.video_id));
    out = out.filter(v=>ids.has(v.video_id));
  }
  switch(state.sort){
    case 'recente': out = out.slice().sort((a,b)=>(b.data||'').localeCompare(a.data||'')); break;
    case 'antigo': out = out.slice().sort((a,b)=>(a.data||'').localeCompare(b.data||'')); break;
    case 'titulo': out = out.slice().sort((a,b)=>(a.titulo||'').localeCompare(b.titulo||'')); break;
    case 'duracao_desc': out = out.slice().sort((a,b)=>(b.duracao_seg||0)-(a.duracao_seg||0)); break;
    case 'duracao_asc': out = out.slice().sort((a,b)=>(a.duracao_seg||0)-(b.duracao_seg||0)); break;
    case 'aleatorio': out = shuffle(out, shuffleSeed); break;
  }
  return out;
}

const iconPlay = () => `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;

function fmtDate(d){ return d ? new Date(d+'T00:00:00').toLocaleDateString('pt-BR') : ''; }

function metaTags(v){
  const cat = v.categoria ? `<span class="tag tag-cat">${v.categoria}</span>` : '';
  const texto = v.texto_base ? `<span class="tag tag-texto">${v.texto_base}</span>` : '';
  const pl = v.playlist_name ? `<span class="tag tag-playlist" data-playlist="${v.playlist_name}">${v.playlist_name}</span>` : '';
  return cat+texto+pl;
}

function cardHTML(v){
  const dur = v.duracao ? `<div class="duration-badge">${v.duracao}</div>` : '';
  return `<div class="card" data-id="${v.video_id}">
    <div class="thumb-wrap"><img loading="lazy" src="${v.thumbnail_url}" alt="">${dur}
      <div class="play-overlay">${iconPlay()}</div></div>
    <div class="card-body">
      <p class="card-title">${v.titulo||''}</p>
      <div class="card-meta">${metaTags(v)}</div>
      <p class="card-preletor">${v.preletor||''}</p>
      <p class="card-date">${fmtDate(v.data)}</p>
    </div></div>`;
}

function rowHTML(v){
  const dur = v.duracao ? `<div class="duration-badge">${v.duracao}</div>` : '';
  return `<div class="row-item" data-id="${v.video_id}">
    <div class="row-thumb"><img loading="lazy" src="${v.thumbnail_url}" alt="">${dur}</div>
    <div class="row-info">
      <p class="row-title">${v.titulo||''}</p>
      <div class="row-meta">${metaTags(v)}</div>
      <p class="row-sub">${v.preletor||''} <span class="row-date">· ${fmtDate(v.data)}</span></p>
    </div></div>`;
}

function compactHTML(v){
  return `<div class="compact-item" data-id="${v.video_id}">
    <span class="cat-dot" style="background:${catColor(v.categoria||'—')}"></span>
    <span class="compact-title">${v.titulo||''} ${v.preletor?'— '+v.preletor:''}</span>
    <span class="compact-sub">${fmtDate(v.data)}</span></div>`;
}

function bindItemClicks(container){
  container.querySelectorAll('.tag-playlist').forEach(el=>{
    el.addEventListener('click', e=>{
      e.stopPropagation();
      state.playlist = el.dataset.playlist;
      $('#f-playlist').value = state.playlist;
      render();
    });
  });
  container.querySelectorAll('[data-id]').forEach(el=>{
    el.addEventListener('click', ()=> openModal(el.dataset.id));
  });
}

function updatePlaylistBanner(){
  if(!state.playlist){ playlistBanner.classList.remove('show'); return; }
  const pl = PLAYLISTS.find(p=>p.playlist_name===state.playlist);
  playlistBanner.classList.add('show');
  playlistBanner.innerHTML = `Playlist: <strong>${state.playlist}</strong> (${pl?pl.count:'?'} vídeos)
    ${pl && pl.playlist_url ? `<a href="${pl.playlist_url}" target="_blank" rel="noopener">Ver no YouTube ↗</a>` : ''}
    <button id="clear-playlist">limpar</button>`;
  $('#clear-playlist').addEventListener('click', ()=>{ state.playlist=''; $('#f-playlist').value=''; render(); });
}

function render(){
  const filtered = applyFilters();
  resultCount.textContent = `${filtered.length} vídeo${filtered.length===1?'':'s'} encontrado${filtered.length===1?'':'s'}`;
  updatePlaylistBanner();

  grid.style.display = state.view==='grade' ? 'grid' : 'none';
  list.style.display = state.view==='lista' ? 'flex' : 'none';
  compact.style.display = state.view==='compacta' ? 'flex' : 'none';

  if(filtered.length===0){
    const emptyMsg = `<div class="empty-state">Nenhum vídeo encontrado com esses filtros. Tente ajustar a busca.</div>`;
    grid.innerHTML = list.innerHTML = compact.innerHTML = emptyMsg;
    return;
  }

  if(state.view==='grade'){
    grid.innerHTML = filtered.map(cardHTML).join('');
    bindItemClicks(grid);
  } else if(state.view==='lista'){
    list.innerHTML = filtered.map(rowHTML).join('');
    bindItemClicks(list);
  } else {
    compact.innerHTML = filtered.map(compactHTML).join('');
    bindItemClicks(compact);
  }
}

function openModal(id){
  const v = ALL.find(x=>x.video_id===id);
  if(!v) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const plLink = v.playlist_url ? `<a class="modal-link secondary" href="${v.playlist_url}" target="_blank" rel="noopener">Ver playlist "${v.playlist_name}" ↗</a>` : '';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-video"><iframe src="${v.embed_url}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>
      <div class="modal-body">
        <button class="modal-close" aria-label="Fechar">✕</button>
        <h2 class="modal-title">${v.titulo||''}</h2>
        <div class="modal-row"><span class="label">Preletor</span><span>${v.preletor||'—'}</span></div>
        <div class="modal-row"><span class="label">Texto base</span><span>${v.texto_base||'—'}</span></div>
        <div class="modal-row"><span class="label">Categoria</span><span>${v.categoria||'—'}</span></div>
        <div class="modal-row"><span class="label">Data</span><span>${fmtDate(v.data)||'—'}</span></div>
        <div class="modal-row"><span class="label">Duração</span><span>${v.duracao||'—'}</span></div>
        <div class="modal-links">
          <a class="modal-link primary" href="${v.url}" target="_blank" rel="noopener">Abrir no YouTube ↗</a>
          ${plLink}
        </div>
      </div></div>`;
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  function close(){ backdrop.remove(); document.body.style.overflow=''; document.removeEventListener('keydown', onKey); }
  function onKey(e){ if(e.key==='Escape') close(); }
  backdrop.addEventListener('click', e=>{ if(e.target===backdrop) close(); });
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
}

function syncToggles(){
  document.querySelectorAll('.view-toggle button').forEach(b=>b.classList.toggle('active', b.dataset.view===state.view));
  document.querySelectorAll('.segmented button').forEach(b=>b.classList.toggle('active', b.dataset.testamento===state.testamento));
}

function bindControls(){
  $('#search').addEventListener('input', e=>{ state.q=e.target.value; render(); });
  $('#f-preletor').addEventListener('change', e=>{ state.preletor=e.target.value; render(); });
  $('#f-categoria').addEventListener('change', e=>{ state.categoria=e.target.value; render(); });
  $('#f-livro').addEventListener('change', e=>{ state.livro=e.target.value; render(); });
  $('#f-ano').addEventListener('change', e=>{ state.ano=e.target.value; render(); });
  $('#f-playlist').addEventListener('change', e=>{ state.playlist=e.target.value; render(); });
  $('#f-sort').addEventListener('change', e=>{
    state.sort = e.target.value;
    if(state.sort==='aleatorio') shuffleSeed = Date.now()%100000;
    render();
  });
  document.querySelectorAll('.segmented button').forEach(b=>{
    b.addEventListener('click', ()=>{ state.testamento = b.dataset.testamento; syncToggles(); render(); });
  });
  document.querySelectorAll('.view-toggle button').forEach(b=>{
    b.addEventListener('click', ()=>{ state.view = b.dataset.view; syncToggles(); render(); });
  });
  $('#clear-filters').addEventListener('click', ()=>{
    state = { q:'', preletor:'', categoria:'', livro:'', testamento:'', ano:'', playlist:'', sort:'recente', view: state.view };
    ['search'].forEach(id=>$('#'+id).value='');
    ['f-preletor','f-categoria','f-livro','f-ano','f-playlist','f-sort'].forEach(id=>$('#'+id).value=id==='f-sort'?'recente':'');
    syncToggles();
    render();
  });
  $('#stats-toggle').addEventListener('click', async ()=>{
    const panel = $('#charts-panel');
    panel.classList.toggle('open');
    if(panel.classList.contains('open') && !window.Chart){
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js');
      buildCharts();
    }
  });
}

function loadScript(src){
  return new Promise((resolve,reject)=>{
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

const valueLabelsPlugin = {
  id:'valueLabels',
  afterDatasetsDraw(chart){
    const {ctx} = chart;
    ctx.save();
    ctx.font = "600 11px 'IBM Plex Mono', monospace";
    ctx.fillStyle = '#182620';
    chart.data.datasets.forEach((ds, di)=>{
      const meta = chart.getDatasetMeta(di);
      meta.data.forEach((bar, i)=>{
        const val = ds.data[i];
        if(chart.config.type==='bar' && chart.options.indexAxis==='y'){
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(val, bar.x + 6, bar.y);
        }
      });
    });
    ctx.restore();
  }
};

function buildCharts(){
  const gridColor = '#DEE6DC';
  Chart.defaults.font.family = "'Manrope', sans-serif";
  Chart.defaults.color = '#51625A';

  // top 10 preletores, com número ao lado da barra
  const byPreletor = {};
  ALL.forEach(v=>{ if(v.preletor) byPreletor[v.preletor]=(byPreletor[v.preletor]||0)+1; });
  const topPreletores = Object.entries(byPreletor).sort((a,b)=>b[1]-a[1]).slice(0,10);
  new Chart($('#chart-preletores'), {
    type:'bar',
    data:{ labels:topPreletores.map(p=>p[0].replace(/\s*\(.*\)/,'')), datasets:[{ data:topPreletores.map(p=>p[1]), backgroundColor:'#2F5F49', borderRadius:4, barThickness:16 }] },
    options:{
      indexAxis:'y',
      layout:{padding:{right:34}},
      plugins:{legend:{display:false}},
      scales:{x:{grid:{color:gridColor}, ticks:{font:{size:11}}}, y:{grid:{display:false}, ticks:{font:{size:12}}}}
    },
    plugins:[valueLabelsPlugin]
  });

  // AT x NT com contagem e total no centro
  const byTest = {AT:0, NT:0};
  ALL.forEach(v=>{ if(v.testamento) byTest[v.testamento]++; });
  const totalTest = byTest.AT + byTest.NT;
  new Chart($('#chart-testamento'), {
    type:'doughnut',
    data:{
      labels:[`Antigo Testamento (${byTest.AT})`, `Novo Testamento (${byTest.NT})`],
      datasets:[{ data:[byTest.AT, byTest.NT], backgroundColor:['#C99A3E','#2F5F49'] }]
    },
    options:{ plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:11}}}} },
    plugins:[{
      id:'centerText',
      afterDraw(chart){
        const {ctx, chartArea:{left,right,top,bottom}} = chart;
        const cx = (left+right)/2, cy = (top+bottom)/2;
        ctx.save();
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.font = "600 20px 'IBM Plex Mono', monospace";
        ctx.fillStyle = '#182620';
        ctx.fillText(totalTest, cx, cy-8);
        ctx.font = "11px 'Manrope', sans-serif";
        ctx.fillStyle = '#8C9990';
        ctx.fillText('vídeos', cx, cy+12);
        ctx.restore();
      }
    }]
  });
}

function renderLivroNav(){
  const counts = {};
  ALL.forEach(v=>{ if(v.livro) counts[v.livro] = (counts[v.livro]||0)+1; });
  const max = Math.max(1, ...Object.values(counts));
  const OT_COUNT = 39;

  const row = (name) => {
    const c = counts[name] || 0;
    const pct = Math.round((c/max)*100);
    return `<div class="livro-row ${c===0?'is-empty':''}" data-livro="${name}">
      <span class="livro-name">${name}</span>
      <span class="livro-bar-track"><span class="livro-bar-fill" style="width:${c===0?0:Math.max(pct,4)}%"></span></span>
      <span class="livro-count">${c}</span>
    </div>`;
  };

  const ot = BOOK_ORDER.slice(0, OT_COUNT).filter(b=>counts[b]);
  const nt = BOOK_ORDER.slice(OT_COUNT).filter(b=>counts[b]);

  $('#livro-nav').innerHTML = `
    <div class="livro-testamento-label">Antigo testamento</div>
    ${ot.map(row).join('')}
    <div class="livro-testamento-label">Novo testamento</div>
    ${nt.map(row).join('')}
  `;

  $('#livro-nav').querySelectorAll('.livro-row:not(.is-empty)').forEach(el=>{
    el.addEventListener('click', ()=>{
      state.livro = el.dataset.livro;
      state.view = 'grade';
      $('#f-livro').value = state.livro;
      syncToggles();
      render();
      $('#charts-panel').classList.remove('open');
      window.scrollTo({top:0, behavior:'smooth'});
    });
  });
}

async function init(){
  const [videosRes, playlistsRes] = await Promise.all([fetch('data/videos.json'), fetch('data/playlists.json')]);
  ALL = await videosRes.json();
  PLAYLISTS = await playlistsRes.json();

  fuse = new Fuse(ALL, { keys:['titulo','preletor','texto_base','playlist_name','livro'], threshold:0.32, ignoreLocation:true });

  buildFilters();

  const anos = ALL.map(v=>v.ano).filter(Boolean);
  const preletores = new Set(ALL.map(v=>v.preletor).filter(Boolean));
  $('#metric-total').textContent = ALL.length;
  $('#metric-preletores').textContent = preletores.size;
  $('#metric-playlists').textContent = PLAYLISTS.length;
  $('#metric-anos').textContent = `${Math.min(...anos)}–${Math.max(...anos)}`;

  bindControls();
  syncToggles();
  renderLivroNav();
  render();
}

init();
