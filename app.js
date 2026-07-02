const BOOK_ORDER = [
  'Gênesis','Êxodo','Levítico','Números','Deuteronômio','Josué','Juízes','Rute',
  '1Samuel','2Samuel','1Reis','2Reis','1Crônicas','2Crônicas','Esdras','Neemias',
  'Ester','Jó','Salmos','Provérbios','Eclesiastes','Cantares','Isaías','Jeremias',
  'Lamentações','Ezequiel','Daniel','Oséias','Joel','Amós','Obadias','Jonas',
  'Miquéias','Naum','Habacuque','Sofonias','Ageu','Zacarias','Malaquias',
  'Mateus','Marcos','Lucas','João','Atos','Romanos','1Coríntios','2Coríntios',
  'Gálatas','Efésios','Filipenses','Colossenses','1Tessalonicenses','2Tessalonicenses',
  '1Timóteo','2Timóteo','Tito','Filémon','Hebreus','Tiago','1Pedro','2Pedro',
  '1João','2João','3João','Judas','Apocalipse'
];
const OT_COUNT = 39;

let ALL = [];
let fuse = null;
let state = { q:'', preletor:'', tipo:'', livro:'', ano:'', view:'grade' };

const $ = (sel) => document.querySelector(sel);
const grid = $('#grid');
const resultCount = $('#result-count');
const shelfEl = $('#shelf');

function normalize(s){
  return (s||'').toLowerCase();
}

function fillSelect(el, values, placeholder){
  el.innerHTML = `<option value="">${placeholder}</option>` +
    values.map(v => `<option value="${v}">${v}</option>`).join('');
}

function buildFilters(){
  const preletores = [...new Set(ALL.map(v=>v.preletor).filter(Boolean))].sort();
  const tipos = [...new Set(ALL.map(v=>v.tipo).filter(Boolean))].sort();
  const anos = [...new Set(ALL.map(v=>v.ano).filter(Boolean))].sort((a,b)=>b-a);
  fillSelect($('#f-preletor'), preletores, 'Preletor');
  fillSelect($('#f-tipo'), tipos, 'Tipo');
  fillSelect($('#f-ano'), anos, 'Ano');
}

function applyFilters(){
  let list = ALL;
  if(state.preletor) list = list.filter(v=>v.preletor===state.preletor);
  if(state.tipo) list = list.filter(v=>v.tipo===state.tipo);
  if(state.livro) list = list.filter(v=>v.livro===state.livro);
  if(state.ano) list = list.filter(v=>String(v.ano)===String(state.ano));
  if(state.q.trim()){
    const ids = new Set(fuse.search(state.q.trim()).map(r=>r.item.video_id));
    list = list.filter(v=>ids.has(v.video_id));
  }
  return list.slice().sort((a,b)=> (b.data||'').localeCompare(a.data||''));
}

function iconPlay(){
  return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
}

function cardHTML(v){
  const texto = v.texto_base ? `<span class="tag tag-texto">${v.texto_base}</span>` : '';
  const tipo = v.tipo ? `<span class="tag tag-tipo">${v.tipo}</span>` : '';
  const dur = v.duracao ? `<div class="duration-badge">${v.duracao}</div>` : '';
  const dataFmt = v.data ? new Date(v.data+'T00:00:00').toLocaleDateString('pt-BR') : '';
  return `
  <div class="card" data-id="${v.video_id}">
    <div class="thumb-wrap">
      <img loading="lazy" src="${v.thumbnail_url}" alt="">
      ${dur}
      <div class="play-overlay">${iconPlay()}</div>
    </div>
    <div class="card-body">
      <p class="card-title">${v.titulo||''}</p>
      <div class="card-meta">${tipo}${texto}</div>
      <p class="card-preletor">${v.preletor||''}</p>
      <p class="card-date">${dataFmt}</p>
    </div>
  </div>`;
}

function render(){
  const list = applyFilters();
  resultCount.textContent = `${list.length} vídeo${list.length===1?'':'s'} encontrado${list.length===1?'':'s'}`;

  if(state.view==='livro'){
    grid.style.display = 'none';
    shelfEl.style.display = 'block';
    renderShelf();
    return;
  }
  shelfEl.style.display = 'none';
  grid.style.display = 'grid';

  if(list.length===0){
    grid.innerHTML = `<div class="empty-state">Nenhum vídeo encontrado com esses filtros. Tente ajustar a busca.</div>`;
    return;
  }
  grid.innerHTML = list.map(cardHTML).join('');
  grid.querySelectorAll('.card').forEach(card=>{
    card.addEventListener('click', ()=> openModal(card.dataset.id));
  });
}

function renderShelf(){
  const counts = {};
  ALL.forEach(v=>{ if(v.livro) counts[v.livro] = (counts[v.livro]||0)+1; });

  const spine = (name) => {
    const c = counts[name] || 0;
    const cls = c===0 ? 'spine empty' : 'spine';
    return `<div class="${cls}" data-livro="${name}">
      <span class="spine-name">${name}</span>
      <span class="spine-count">${c}</span>
    </div>`;
  };

  const ot = BOOK_ORDER.slice(0, OT_COUNT);
  const nt = BOOK_ORDER.slice(OT_COUNT);

  shelfEl.innerHTML = `
    <div class="testament-label">Antigo testamento</div>
    <div class="shelf">${ot.map(spine).join('')}</div>
    <div class="testament-label">Novo testamento</div>
    <div class="shelf">${nt.map(spine).join('')}</div>
  `;

  shelfEl.querySelectorAll('.spine:not(.empty)').forEach(el=>{
    el.addEventListener('click', ()=>{
      state.livro = el.dataset.livro;
      state.view = 'grade';
      $('#f-livro').value = state.livro;
      syncViewToggle();
      render();
      window.scrollTo({top:0, behavior:'smooth'});
    });
  });
}

function openModal(id){
  const v = ALL.find(x=>x.video_id===id);
  if(!v) return;
  const dataFmt = v.data ? new Date(v.data+'T00:00:00').toLocaleDateString('pt-BR') : '—';
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-video">
        <iframe src="${v.embed_url}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
      <div class="modal-body">
        <button class="modal-close" aria-label="Fechar">✕</button>
        <h2 class="modal-title">${v.titulo||''}</h2>
        <div class="modal-row"><span class="label">Preletor</span><span>${v.preletor||'—'}</span></div>
        <div class="modal-row"><span class="label">Texto base</span><span>${v.texto_base||'—'}</span></div>
        <div class="modal-row"><span class="label">Tipo</span><span>${v.tipo||'—'}</span></div>
        <div class="modal-row"><span class="label">Data</span><span>${dataFmt}</span></div>
        <div class="modal-row"><span class="label">Duração</span><span>${v.duracao||'—'}</span></div>
        <a class="modal-link" href="${v.url}" target="_blank" rel="noopener">Abrir no YouTube ↗</a>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  function close(){
    backdrop.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e){ if(e.key==='Escape') close(); }
  backdrop.addEventListener('click', (e)=>{ if(e.target===backdrop) close(); });
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
}

function syncViewToggle(){
  $('#view-grade').classList.toggle('active', state.view==='grade');
  $('#view-livro').classList.toggle('active', state.view==='livro');
}

function bindControls(){
  $('#search').addEventListener('input', e=>{ state.q = e.target.value; render(); });
  $('#f-preletor').addEventListener('change', e=>{ state.preletor = e.target.value; render(); });
  $('#f-tipo').addEventListener('change', e=>{ state.tipo = e.target.value; render(); });
  $('#f-livro').addEventListener('change', e=>{ state.livro = e.target.value; render(); });
  $('#f-ano').addEventListener('change', e=>{ state.ano = e.target.value; render(); });
  $('#view-grade').addEventListener('click', ()=>{ state.view='grade'; syncViewToggle(); render(); });
  $('#view-livro').addEventListener('click', ()=>{ state.view='livro'; syncViewToggle(); render(); });
  $('#clear-filters').addEventListener('click', ()=>{
    state = { q:'', preletor:'', tipo:'', livro:'', ano:'', view: state.view };
    $('#search').value=''; $('#f-preletor').value=''; $('#f-tipo').value='';
    $('#f-livro').value=''; $('#f-ano').value='';
    render();
  });
}

async function init(){
  const res = await fetch('data/videos.json');
  ALL = await res.json();

  fuse = new Fuse(ALL, {
    keys: ['titulo','preletor','texto_base','playlist','livro'],
    threshold: 0.32,
    ignoreLocation: true
  });

  buildFilters();

  const anos = ALL.map(v=>v.ano).filter(Boolean);
  const min = Math.min(...anos), max = Math.max(...anos);
  const preletores = new Set(ALL.map(v=>v.preletor).filter(Boolean));
  $('#stats').innerHTML = `<strong>${ALL.length}</strong> vídeos catalogados · <strong>${preletores.size}</strong> preletores · ${min}–${max}`;

  bindControls();
  render();
}

init();
