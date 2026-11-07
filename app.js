'use strict';

/* =========================================================
   GanSo Chaco — Índice de Ganadería Sostenible de Bosque
   IGSB = Σ (cumplimiento × valor del criterio) / 100
   ========================================================= */

const APP_VERSION = '1.0';
const STORE_KEY = 'ganso.evaluaciones.v1';
const DRAFT_KEY = 'ganso.borrador.v1';

// Ficha técnica: valores sobre 100 puntos.
// Pastoreo controlado es acumulativo: 2–3 áreas = 10; 4 o más = 10 + 15 = 25.
const CRITERIOS = [
  { id: 'plan', num: '1', titulo: 'Plan del establecimiento', detalle: 'Plan ganadero basado en la aplicación de criterios de sostenibilidad', pts: 15 },
  { id: 'cerrado', num: '2', titulo: 'Cerrado perimetral', detalle: 'El predio cuenta con cerrado perimetral', pts: 20 },
  {
    id: 'pastoreo', num: '3', titulo: 'Pastoreo controlado', detalle: 'Áreas de pastoreo con manejo controlado', pts: 25,
    niveles: [
      { v: 0, label: 'Menos de 2', pts: 0 },
      { v: 1, label: '2 a 3 áreas', pts: 10 },
      { v: 2, label: '4 o más', pts: 25 },
    ],
  },
  { id: 'agua', num: '4', titulo: 'Sitio de agua permanente', detalle: 'Cuenta con sitio de agua permanente', pts: 15 },
  { id: 'ubicacion', num: '5', titulo: 'Aguadas bien distribuidas', detalle: 'Ubicación equitativa de los sitios de agua permanente', pts: 15 },
  { id: 'pasturaDirecto', num: '6a', titulo: 'Pastura para pastoreo directo', detalle: 'Área con pastura implantada destinada a pastoreo directo', pts: 5 },
  { id: 'pasturaAlmacen', num: '6b', titulo: 'Pastura para almacenar', detalle: 'Área con pastura implantada destinada a silo o heno', pts: 5 },
];

const CLASES = [
  { key: 'roja', min: 0, rango: '0 – 0,39', color: 'Rojo', label: 'Baja aplicación', desc: 'Baja incorporación de criterios de sostenibilidad' },
  { key: 'amarilla', min: 40, rango: '0,40 – 0,69', color: 'Amarillo', label: 'Transición inicial', desc: 'Proceso inicial de adopción de prácticas' },
  { key: 'verde', min: 70, rango: '0,70 – 0,99', color: 'Verde claro', label: 'Transición avanzada', desc: 'Alta incorporación de criterios' },
  { key: 'plena', min: 100, rango: '1,00', color: 'Verde pleno', label: 'Sostenible plena', desc: 'Cumple todos los criterios' },
];

/* ---------- Cálculo ---------- */

function ptsCriterio(c, valor) {
  if (c.niveles) return (c.niveles.find(n => n.v === valor) || c.niveles[0]).pts;
  return valor ? c.pts : 0;
}

function calcularPuntaje(criterios) {
  return CRITERIOS.reduce((sum, c) => sum + ptsCriterio(c, criterios[c.id]), 0);
}

function clasificar(pts) {
  let clase = CLASES[0];
  for (const c of CLASES) if (pts >= c.min) clase = c;
  return clase;
}

function fmtIndice(pts) {
  // Redondeo a 2 decimales (half-up) sobre el puntaje, para evitar errores de coma flotante.
  return (Math.round(pts) / 100).toFixed(2).replace('.', ',');
}

function criteriosVacios() {
  return { plan: false, cerrado: false, pastoreo: 0, agua: false, ubicacion: false, pasturaDirecto: false, pasturaAlmacen: false };
}

// Mejoras posibles, de mayor a menor aporte.
function mejoras(criterios) {
  const out = [];
  for (const c of CRITERIOS) {
    const v = criterios[c.id];
    if (c.niveles) {
      if (v === 0) out.push({ pts: 25, texto: 'Pastoreo controlado en 4 áreas o más', alt: 'o en 2 a 3 áreas (+10)' });
      else if (v === 1) out.push({ pts: 15, texto: 'Ampliar el pastoreo controlado a 4 áreas o más' });
    } else if (!v) {
      out.push({ pts: c.pts, texto: c.detalle });
    }
  }
  return out.sort((a, b) => b.pts - a.pts);
}

/* ---------- Almacenamiento local ---------- */

function leer(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function escribir(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast('No se pudo guardar en el dispositivo'); }
}
function borrar(key) { try { localStorage.removeItem(key); } catch { /* sin acceso */ } }

const db = {
  todas() { return leer(STORE_KEY, []).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || b.creado - a.creado); },
  get(id) { return leer(STORE_KEY, []).find(e => e.id === id); },
  guardar(ev) {
    const lista = leer(STORE_KEY, []);
    const i = lista.findIndex(e => e.id === ev.id);
    if (i >= 0) lista[i] = ev; else lista.push(ev);
    escribir(STORE_KEY, lista);
  },
  eliminar(id) { escribir(STORE_KEY, leer(STORE_KEY, []).filter(e => e.id !== id)); },
};

/* ---------- Utilidades ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const hoy = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtFecha = iso => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const normZona = z => (z || '').trim().toLowerCase();
const fmtHa = n => (n === '' || n == null) ? '—' : `${Number(n).toLocaleString('es-BO')} ha`;

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  map: '<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  table: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>',
  check: '<path d="M5 12.5 9.5 17 19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15zM5 19l7-7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5h.01"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};
const ic = name => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2400);
}

function confirmar({ titulo, texto, ok = 'Confirmar', peligro = false }) {
  return new Promise(resolve => {
    const bd = $('#sheet');
    bd.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">
      <h2 id="sh-t">${esc(titulo)}</h2><p>${esc(texto)}</p>
      <div class="btn-row"><button class="btn btn-ghost" data-r="0">Cancelar</button>
      <button class="btn ${peligro ? 'btn-danger' : 'btn-primary'}" data-r="1">${esc(ok)}</button></div></div>`;
    bd.hidden = false;
    const cerrar = r => { bd.hidden = true; bd.innerHTML = ''; resolve(r); };
    bd.onclick = e => {
      if (e.target === bd) return cerrar(false);
      const b = e.target.closest('[data-r]');
      if (b) cerrar(b.dataset.r === '1');
    };
  });
}

/* ---------- Componentes ---------- */

function gauge(pts, size = 'lg', sub = 'Índice IGSB') {
  const p = Math.max(0, Math.min(100, pts));
  const clase = clasificar(pts);
  const arc = 'M24 112 A86 86 0 0 1 196 112';
  const band = 'M8 112 A102 102 0 0 1 212 112';
  return `<div class="gauge gauge-${size}" role="img" aria-label="Índice ${fmtIndice(pts)}, ${clase.label}">
    <svg viewBox="0 0 220 124">
      <path d="${band}" class="g-band" stroke="var(--red)" pathLength="100" stroke-dasharray="39.4 200"/>
      <path d="${band}" class="g-band" stroke="var(--yellow)" pathLength="100" stroke-dasharray="0 40.4 28.8 200"/>
      <path d="${band}" class="g-band" stroke="var(--lgreen)" pathLength="100" stroke-dasharray="0 70.2 28.8 200"/>
      <path d="${band}" class="g-band" stroke="var(--green)" pathLength="100" stroke-dasharray="0 99.6 0.4 200"/>
      <path d="${arc}" class="g-track"/>
      ${p > 0 ? `<path d="${arc}" class="g-value c-${clase.key}" stroke="var(--c)" pathLength="100" style="stroke-dashoffset:${100 - p}"/>` : ''}
    </svg>
    <div class="g-center"><div class="g-num num">${fmtIndice(pts)}</div><div class="g-sub">${esc(sub)}</div></div>
  </div>`;
}

const pill = pts => { const c = clasificar(pts); return `<span class="pill c-${c.key}"><span class="dot"></span>${c.label}</span>`; };

function filaEvaluacion(ev) {
  const pts = calcularPuntaje(ev.criterios);
  const c = clasificar(pts);
  return `<a class="row" href="#/eval/${ev.id}">
    <span class="dot c-${c.key}" style="width:12px;height:12px"></span>
    <div class="grow"><div class="t">${esc(ev.productor)}</div>
      <div class="s">${esc(ev.propiedad)} · ${esc(ev.zona)} · ${fmtFecha(ev.fecha)}</div></div>
    <div class="idx num">${fmtIndice(pts)}</div><span class="chev">${ic('chev')}</span></a>`;
}

function vacio(titulo, texto, cta = true) {
  return `<div class="card empty"><div class="e-ico">${ic('leaf')}</div><h2>${titulo}</h2><p>${texto}</p>
    ${cta ? `<a class="btn btn-primary" href="#/nueva">${ic('plus')}Nueva evaluación</a>` : ''}</div>`;
}

function topbar(titulo, back = '#/', acciones = '') {
  return `<header class="topbar"><a class="icon-btn" href="${back}" aria-label="Volver">${ic('back')}</a>
    <h1>${esc(titulo)}</h1>${acciones}</header>`;
}

function promedio(evs) {
  if (!evs.length) return 0;
  return evs.reduce((s, e) => s + calcularPuntaje(e.criterios), 0) / evs.length;
}

function conteoClases(evs) {
  const n = Object.fromEntries(CLASES.map(c => [c.key, 0]));
  evs.forEach(e => n[clasificar(calcularPuntaje(e.criterios)).key]++);
  return n;
}

/* ---------- Vistas ---------- */

function viewInicio() {
  const evs = db.todas();
  const avg = promedio(evs);
  const n = conteoClases(evs);
  const total = evs.length;

  const hero = total
    ? `<section class="card hero">
        <div class="eyebrow">Índice promedio del territorio</div>
        <div class="mt">${gauge(avg, 'lg', `${total} establecimiento${total === 1 ? '' : 's'}`)}</div>
        <div class="mt">${pill(avg)}</div>
        <a class="btn btn-light btn-block mt" href="#/nueva">${ic('plus')}Nueva evaluación</a>
      </section>`
    : `<section class="card hero">
        <div class="eyebrow">Bienvenido</div>
        <h2 style="font-size:22px;margin:10px 0 6px">Midamos la sostenibilidad de su ganadería de bosque</h2>
        <p>Evalúe un establecimiento con 6 criterios y obtenga su índice de 0 a 1 al instante.</p>
        <a class="btn btn-light btn-block mt" href="#/nueva">${ic('plus')}Comenzar evaluación</a>
      </section>`;

  return {
    tab: 'inicio',
    html: `
      <header class="brand"><img src="icons/icon.svg" alt=""><div class="grow">
        <h1>GanSo Chaco</h1><p>Ganadería Sostenible de Bosque</p></div>
        <a class="info-btn" href="#/acerca" aria-label="Información">${ic('info')}</a></header>
      ${hero}
      ${total ? `
        <div class="section-title">Semáforo</div>
        <div class="semaforo-grid">${CLASES.map(c => `
          <div class="s-item c-${c.key}"><span class="dot"></span><b class="num">${n[c.key]}</b><span>${c.label}</span></div>`).join('')}
        </div>
        <div class="section-title">Últimas evaluaciones <a href="#/evaluaciones">Ver todas</a></div>
        <div class="list">${evs.slice(0, 4).map(filaEvaluacion).join('')}</div>` : ''}
      <div class="section-title">Aprenda</div>
      <a class="card row" href="#/metodo" style="padding:16px">
        <span class="e-ico" style="width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:var(--primary-soft);color:var(--primary)">${ic('help')}</span>
        <div class="grow"><div class="t">¿Cómo se calcula el índice?</div><div class="s">Criterios, puntajes y semáforo</div></div>
        <span class="chev">${ic('chev')}</span></a>`,
  };
}

const filtro = { q: '', clase: '' };

function viewLista() {
  const todas = db.todas();
  const chips = [{ key: '', label: 'Todas' }, ...CLASES.map(c => ({ key: c.key, label: c.label }))];
  return {
    tab: 'evaluaciones',
    html: `
      <header class="brand" style="justify-content:space-between"><div><h1>Evaluaciones</h1>
        <p class="num">${todas.length} registrada${todas.length === 1 ? '' : 's'}</p></div>
        ${todas.length ? `<button class="icon-btn" data-action="exportar" aria-label="Exportar evaluaciones">${ic('download')}</button>` : ''}</header>
      ${todas.length ? `
        <label class="search">${ic('search')}<input id="q" type="search" placeholder="Buscar productor, propiedad o zona" value="${esc(filtro.q)}" autocomplete="off"></label>
        <div class="chips">${chips.map(c => `<button class="chip" data-clase="${c.key}" aria-pressed="${filtro.clase === c.key}">
          ${c.key ? `<span class="dot c-${c.key}"></span>` : ''}${c.label}</button>`).join('')}</div>
        <div id="resultados" class="mt"></div>`
        : vacio('Aún no hay evaluaciones', 'Las evaluaciones que realice quedarán guardadas en este dispositivo.')}`,
    mount() {
      if (!todas.length) return;
      const pintar = () => {
        const q = normZona(filtro.q);
        const r = todas.filter(e =>
          (!filtro.clase || clasificar(calcularPuntaje(e.criterios)).key === filtro.clase) &&
          (!q || [e.productor, e.propiedad, e.zona].some(v => normZona(v).includes(q))));
        $('#resultados').innerHTML = r.length
          ? `<div class="list">${r.map(filaEvaluacion).join('')}</div>`
          : `<p class="center muted mt">Sin resultados para este filtro.</p>`;
      };
      $('#q').addEventListener('input', e => { filtro.q = e.target.value; pintar(); });
      document.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
        filtro.clase = b.dataset.clase;
        document.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === b));
        pintar();
      }));
      pintar();
    },
  };
}

function viewTerritorio() {
  const evs = db.todas();
  if (!evs.length) {
    return { tab: 'territorio', html: `<header class="brand"><div><h1>Territorio</h1><p>Índice promedio por zona</p></div></header>
      ${vacio('Sin datos del territorio', 'El índice promedio se calcula a partir de los establecimientos evaluados.')}` };
  }
  const zonas = new Map();
  evs.forEach(e => {
    const k = normZona(e.zona);
    if (!zonas.has(k)) zonas.set(k, { nombre: e.zona.trim(), evs: [] });
    zonas.get(k).evs.push(e);
  });
  const lista = [...zonas.values()].map(z => ({ ...z, avg: promedio(z.evs) })).sort((a, b) => b.avg - a.avg);
  const avg = promedio(evs);
  const n = conteoClases(evs);

  return {
    tab: 'territorio',
    html: `
      <header class="brand"><div><h1>Territorio</h1><p>Índice promedio (IP-GBST)</p></div></header>
      <section class="card center">
        ${gauge(avg, 'lg', `Promedio de ${evs.length} establecimiento${evs.length === 1 ? '' : 's'}`)}
        <div class="mt">${pill(avg)}</div>
        <div class="distbar" aria-hidden="true">${CLASES.map(c => n[c.key] ? `<span class="c-${c.key}" style="flex:${n[c.key]}"></span>` : '').join('')}</div>
        <p class="small mt">${CLASES.filter(c => n[c.key]).map(c => `${n[c.key]} ${c.label.toLowerCase()}`).join(' · ')}</p>
      </section>
      <div class="section-title">Por zona o comunidad</div>
      <div class="list">${lista.map(z => {
        const c = clasificar(z.avg);
        return `<div class="row"><span class="dot c-${c.key}" style="width:12px;height:12px"></span>
          <div class="grow"><div class="t">${esc(z.nombre)}</div>
          <div class="s">${z.evs.length} establecimiento${z.evs.length === 1 ? '' : 's'} · ${c.label}</div>
          <div class="minibar c-${c.key}"><span style="width:${z.avg}%"></span></div></div>
          <div class="idx num">${fmtIndice(z.avg)}</div></div>`;
      }).join('')}</div>
      <button class="btn btn-ghost btn-block mt" data-action="exportar">${ic('download')}Exportar evaluaciones (Excel / CSV)</button>`,
  };
}

function viewMetodo() {
  return {
    tab: 'metodo',
    html: `
      <header class="brand"><div><h1>Método</h1><p>Cómo se calcula el índice</p></div></header>
      <section class="card prose">
        <h2>Índice de Ganadería Sostenible de Bosque</h2>
        <p class="mt">La sostenibilidad no se alcanza de un día para otro: es un proceso de transición. El índice mide qué criterios de sostenibilidad aplica cada establecimiento y va de 0 a 1.</p>
        <div class="formula">Puntaje = Σ (cumple × valor)<br>cumple: 1 = sí · 0 = no<br>IGSB = Puntaje ÷ 100</div>
      </section>
      <div class="section-title">Criterios de la ficha</div>
      <div class="list">${CRITERIOS.map(c => c.niveles
        ? `<div class="row"><span class="crit-num">${c.num}</span><div class="grow"><div class="t">${c.titulo}</div>
            <div class="s">2 a 3 áreas: 10 · 4 o más: 10 + 15</div></div><div class="pts num">${c.pts}</div></div>`
        : `<div class="row"><span class="crit-num">${c.num}</span><div class="grow"><div class="t">${c.titulo}</div>
            <div class="s">${c.detalle}</div></div><div class="pts num">${c.pts}</div></div>`).join('')}
        <div class="row total-row"><div class="grow"><div class="t">Puntaje máximo</div></div><div class="pts num">100</div></div>
      </div>
      <div class="section-title">Semáforo</div>
      <div class="list">${CLASES.map(c => `<div class="row c-${c.key}"><span class="dot" style="width:14px;height:14px"></span>
        <div class="grow"><div class="t">${c.label}</div><div class="s">${c.color} · ${c.desc}</div></div>
        <div class="pts num">${c.rango}</div></div>`).join('')}</div>
      <p class="small muted center mt">El índice del territorio es el promedio de los índices de sus establecimientos.</p>
      <a class="card row mt" href="#/acerca" style="padding:16px">
        <span class="chip-ico">${ic('info')}</span>
        <div class="grow"><div class="t">Acerca de GanSo Chaco</div><div class="s">Instituciones y desarrollo</div></div>
        <span class="chev">${ic('chev')}</span></a>`,
  };
}

function viewAcerca() {
  return {
    tab: '',
    html: `
      ${topbar('Información', '#/')}
      <section class="card center">
        <img class="about-icon" src="icons/icon.svg" alt="">
        <h2 style="font-size:20px;margin-top:12px">GanSo Chaco</h2>
        <p>Índice de Ganadería Sostenible de Bosque en condiciones de Chaco</p>
        <p class="small mt">Versión ${APP_VERSION}</p>
      </section>

      <div class="section-title">Una iniciativa de</div>
      <a class="logo-tile logo-lg logo-link" href="https://nativabolivia.org/" target="_blank" rel="noopener">
        <img src="img/nativa.webp" alt="NATIVA — Naturaleza Tierra y Vida">
        <span>nativabolivia.org ${ic('external')}</span>
      </a>

      <div class="section-title">Con el apoyo de</div>
      <div class="logo-grid">
        <div class="logo-tile"><img src="img/fontagro.webp" alt="FONTAGRO"></div>
        <div class="logo-tile"><img src="img/suecia-ue.webp" alt="Suecia (Sverige) y Unión Europea"></div>
      </div>

      <div class="section-title">Desarrollado por</div>
      <a class="logo-tile logo-link" href="https://buck-di.com" target="_blank" rel="noopener">
        <img src="img/buckdi.webp" alt="Buckdi">
        <span>buck-di.com ${ic('external')}</span>
      </a>

      <a class="card row mt" href="https://nativamlopez.github.io/ganso-chaco/privacidad.html" target="_blank" rel="noopener" style="padding:16px">
        <span class="chip-ico">${ic('info')}</span>
        <div class="grow"><div class="t">Política de privacidad</div><div class="s">La app no recopila ni comparte datos</div></div>
        <span class="chev">${ic('external')}</span></a>`,
  };
}

function viewDetalle(id) {
  const ev = db.get(id);
  if (!ev) return { tab: 'evaluaciones', html: topbar('Evaluación', '#/evaluaciones') + vacio('No encontrada', 'La evaluación no existe o fue eliminada.', false) };
  const pts = calcularPuntaje(ev.criterios);
  const clase = clasificar(pts);
  const sig = CLASES.find(c => c.min > pts);
  const tips = mejoras(ev.criterios);

  return {
    tab: 'evaluaciones',
    html: `
      ${topbar(ev.productor, '#/evaluaciones', `<button class="icon-btn" data-action="share" aria-label="Compartir">${ic('share')}</button>`)}
      <section class="card center">
        ${gauge(pts, 'lg', `${pts} de 100 puntos`)}
        <div class="mt">${pill(pts)}</div>
        <p class="small mt">${clase.desc}</p>
      </section>

      <div class="section-title">Establecimiento</div>
      <section class="card kv">
        <div><small>Productor</small><span>${esc(ev.productor)}</span></div>
        <div><small>Propiedad</small><span>${esc(ev.propiedad)}</span></div>
        <div><small>Comunidad / Zona</small><span>${esc(ev.zona)}</span></div>
        <div><small>Superficie</small><span class="num">${fmtHa(ev.superficie)}</span></div>
        <div><small>Fecha</small><span class="num">${fmtFecha(ev.fecha)}</span></div>
        <div><small>Evaluador</small><span>${esc(ev.evaluador) || '—'}</span></div>
      </section>

      <div class="section-title">Criterios</div>
      <div class="list">${CRITERIOS.map(c => {
        const got = ptsCriterio(c, ev.criterios[c.id]);
        const sub = c.niveles ? (c.niveles.find(n => n.v === ev.criterios[c.id]) || c.niveles[0]).label : c.detalle;
        return `<div class="row"><span class="check ${got ? 'ok' : 'no'}">${ic(got ? 'check' : 'x')}</span>
          <div class="grow"><div class="t">${c.titulo}</div><div class="s">${esc(sub)}</div></div>
          <div class="pts num">${got}<small>/${c.pts}</small></div></div>`;
      }).join('')}
        <div class="row total-row"><div class="grow"><div class="t">Total</div></div>
          <div class="pts num">${pts}<small>/100</small> · ${fmtIndice(pts)}</div></div>
      </div>

      ${tips.length ? `
        <div class="section-title">Para mejorar el índice</div>
        <section class="card">
          ${tips.map(t => `<div class="tip"><span class="plus num">+${t.pts}</span><div>${esc(t.texto)}${t.alt ? ` <span class="muted small">${esc(t.alt)}</span>` : ''}</div></div>`).join('')}
          ${sig ? `<div class="next-level">Faltan <b class="num">${sig.min - pts} puntos</b> para llegar a <b>${sig.label}</b>.</div>` : ''}
        </section>` : ''}

      <div class="btn-row mt">
        <a class="btn btn-ghost" href="#/editar/${ev.id}">${ic('edit')}Editar</a>
        <button class="btn btn-danger" data-action="delete">${ic('trash')}Eliminar</button>
      </div>`,
    mount() {
      $('[data-action="delete"]').addEventListener('click', async () => {
        const ok = await confirmar({ titulo: '¿Eliminar evaluación?', texto: `Se borrará la evaluación de ${ev.productor}. Esta acción no se puede deshacer.`, ok: 'Eliminar', peligro: true });
        if (!ok) return;
        db.eliminar(ev.id);
        toast('Evaluación eliminada');
        location.hash = '#/evaluaciones';
      });
      $('[data-action="share"]').addEventListener('click', () => compartir(ev));
    },
  };
}

/* ---------- Formulario (2 pasos) ---------- */

let form = null;

function iniciarForm(id) {
  if (form && form.routeId === (id || 'nueva')) return;
  if (id) {
    const ev = db.get(id);
    form = ev ? { routeId: id, step: 1, data: structuredClone(ev), borrador: false } : null;
    return;
  }
  const guardado = leer(DRAFT_KEY, null);
  form = {
    routeId: 'nueva', step: 1, borrador: !!guardado,
    data: guardado || { id: null, productor: '', propiedad: '', zona: '', superficie: '', fecha: hoy(), evaluador: leer('ganso.evaluador', ''), criterios: criteriosVacios() },
  };
}

function guardarBorrador() { if (form && form.routeId === 'nueva') escribir(DRAFT_KEY, form.data); }

function viewForm(id) {
  iniciarForm(id);
  if (!form) return { tab: '', html: topbar('Editar', '#/evaluaciones') + vacio('No encontrada', 'La evaluación no existe.', false) };
  const d = form.data;
  const editando = form.routeId !== 'nueva';
  const titulo = editando ? 'Editar evaluación' : 'Nueva evaluación';
  const zonas = [...new Set(db.todas().map(e => e.zona.trim()).filter(Boolean))];
  const pasos = `<div class="steps">
      <div class="on"><div class="bar"></div><small>1 · Identificación</small></div>
      <div class="${form.step === 2 ? 'on' : ''}"><div class="bar"></div><small>2 · Criterios</small></div></div>`;

  const campo = (k, label, opts = {}) => `<label class="field" data-f="${k}">
      <span>${label}${opts.req ? ' <em>*</em>' : ''}</span>
      <input name="${k}" type="${opts.type || 'text'}" value="${esc(d[k])}" ${opts.attrs || ''} autocomplete="off">
      ${opts.req ? '<div class="msg">Este dato es obligatorio</div>' : ''}</label>`;

  const paso1 = `
      ${form.borrador && !editando ? `<div class="draft-note"><span>Se recuperó un borrador sin guardar.</span><button type="button" data-action="descartar">Descartar</button></div>` : ''}
      <section class="card">
        ${campo('productor', 'Productor', { req: true, attrs: 'placeholder="Nombre del productor"' })}
        ${campo('propiedad', 'Propiedad', { req: true, attrs: 'placeholder="Nombre del predio"' })}
        ${campo('zona', 'Comunidad / Zona', { req: true, attrs: 'placeholder="Ej.: Villa Montes" list="zonas"' })}
        <datalist id="zonas">${zonas.map(z => `<option value="${esc(z)}">`).join('')}</datalist>
        <div class="grid-2">
          ${campo('superficie', 'Superficie (ha)', { type: 'number', attrs: 'inputmode="decimal" min="0" step="any" placeholder="0"' })}
          ${campo('fecha', 'Fecha', { type: 'date' })}
        </div>
        ${campo('evaluador', 'Evaluador', { attrs: 'placeholder="Nombre del técnico"' })}
      </section>`;

  const paso2 = CRITERIOS.map(c => {
    const v = d.criterios[c.id];
    const got = ptsCriterio(c, v);
    if (c.niveles) {
      return `<div class="crit ${got ? 'on' : ''}" data-c="${c.id}">
        <div class="crit-head"><span class="crit-num">${c.num}</span>
          <div class="crit-body"><b>${c.titulo}</b><small>${c.detalle}</small></div>
          <span class="crit-pts num" data-pts>${got}/${c.pts}</span></div>
        <div class="segmented" role="group" aria-label="${c.titulo}">${c.niveles.map(n => `
          <button type="button" data-nivel="${n.v}" aria-pressed="${v === n.v}">${n.label}<small>+${n.pts}</small></button>`).join('')}</div>
      </div>`;
    }
    return `<label class="crit ${got ? 'on' : ''}" data-c="${c.id}">
      <div class="crit-head"><span class="crit-num">${c.num}</span>
        <div class="crit-body"><b>${c.titulo}</b><small>${c.detalle}</small></div>
        <span class="switch"><input type="checkbox" ${v ? 'checked' : ''} aria-label="${c.titulo} (${c.pts} puntos)"><i></i></span></div>
      <div class="crit-pts num" style="margin:8px 0 0 46px">+${c.pts} puntos</div>
    </label>`;
  }).join('');

  const pts = calcularPuntaje(d.criterios);
  const clase = clasificar(pts);
  const barra = `<div class="formbar"><div class="formbar-in">
      ${form.step === 2 ? `<div class="live c-${clase.key}" id="live">
        <div class="live-num num">${fmtIndice(pts)}</div>
        <div class="live-meta"><b>${clase.label}</b><small class="num">${pts} de 100 puntos</small>
          <div class="minibar"><span style="width:${pts}%"></span></div></div></div>` : ''}
      <div class="btn-row">
        ${form.step === 2 ? `<button class="btn btn-ghost" data-action="atras" style="flex:0 0 auto">${ic('back')}</button>` : ''}
        ${form.step === 1
          ? `<button class="btn btn-primary" data-action="siguiente">Continuar a criterios</button>`
          : `<button class="btn btn-primary" data-action="guardar">${ic('check')}${editando ? 'Guardar cambios' : 'Guardar evaluación'}</button>`}
      </div></div></div>`;

  return {
    tab: '',
    hideTabbar: true,
    html: `${topbar(titulo, editando ? `#/eval/${d.id}` : '#/')}${pasos}
      <div class="fade-in">${form.step === 1 ? paso1 : `<p class="small muted" style="margin:0 2px 12px">Active los criterios que cumple el establecimiento.</p>${paso2}`}</div>
      ${barra}`,
    mount() {
      if (form.step === 1) {
        document.querySelectorAll('.field input').forEach(inp => inp.addEventListener('input', () => {
          d[inp.name] = inp.value;
          inp.closest('.field').classList.remove('err');
          guardarBorrador();
        }));
        $('[data-action="descartar"]')?.addEventListener('click', () => {
          borrar(DRAFT_KEY); form = null; render(); toast('Borrador descartado');
        });
        $('[data-action="siguiente"]').addEventListener('click', () => {
          const faltan = ['productor', 'propiedad', 'zona'].filter(k => !String(d[k]).trim());
          faltan.forEach(k => $(`[data-f="${k}"]`).classList.add('err'));
          if (faltan.length) { $(`[data-f="${faltan[0]}"] input`).focus(); return; }
          form.step = 2; render(); scrollTo(0, 0);
        });
        return;
      }

      const actualizar = () => {
        const p = calcularPuntaje(d.criterios);
        const c = clasificar(p);
        const live = $('#live');
        live.className = `live c-${c.key}`;
        live.querySelector('.live-num').textContent = fmtIndice(p);
        live.querySelector('b').textContent = c.label;
        live.querySelector('small').textContent = `${p} de 100 puntos`;
        live.querySelector('.minibar span').style.width = p + '%';
        guardarBorrador();
      };
      document.querySelectorAll('label.crit input').forEach(inp => inp.addEventListener('change', () => {
        const card = inp.closest('.crit');
        d.criterios[card.dataset.c] = inp.checked;
        card.classList.toggle('on', inp.checked);
        actualizar();
      }));
      document.querySelectorAll('.segmented button').forEach(b => b.addEventListener('click', () => {
        const card = b.closest('.crit');
        const c = CRITERIOS.find(x => x.id === card.dataset.c);
        const v = Number(b.dataset.nivel);
        d.criterios[c.id] = v;
        card.querySelectorAll('.segmented button').forEach(x => x.setAttribute('aria-pressed', x === b));
        const got = ptsCriterio(c, v);
        card.classList.toggle('on', got > 0);
        card.querySelector('[data-pts]').textContent = `${got}/${c.pts}`;
        actualizar();
      }));
      $('[data-action="atras"]').addEventListener('click', () => { form.step = 1; render(); });
      $('[data-action="guardar"]').addEventListener('click', () => {
        const ahora = Date.now();
        const ev = {
          ...d,
          id: d.id || nuevoId(),
          productor: d.productor.trim(), propiedad: d.propiedad.trim(), zona: d.zona.trim(), evaluador: (d.evaluador || '').trim(),
          creado: d.creado || ahora, actualizado: ahora,
        };
        db.guardar(ev);
        if (ev.evaluador) escribir('ganso.evaluador', ev.evaluador);
        if (form.routeId === 'nueva') borrar(DRAFT_KEY);
        form = null;
        toast(editando ? 'Cambios guardados' : 'Evaluación guardada');
        location.hash = `#/eval/${ev.id}`;
      });
    },
  };
}

/* ---------- Exportar y compartir ---------- */

// Filas comunes para CSV y Excel.
function datosExport() {
  const columnas = [
    { titulo: 'Productor', ancho: 24 }, { titulo: 'Propiedad', ancho: 22 }, { titulo: 'Comunidad/Zona', ancho: 18 },
    { titulo: 'Superficie (ha)', ancho: 12 }, { titulo: 'Fecha', ancho: 12 }, { titulo: 'Evaluador', ancho: 18 },
    ...CRITERIOS.map(c => ({ titulo: `${c.num} ${c.titulo} (pts)`, ancho: 15 })),
    { titulo: 'Puntaje', ancho: 10 }, { titulo: 'Índice IGSB', ancho: 11 }, { titulo: 'Clasificación', ancho: 20 },
  ];
  const evs = db.todas().map(e => {
    const pts = calcularPuntaje(e.criterios);
    return { e, pts, crit: CRITERIOS.map(c => ptsCriterio(c, e.criterios[c.id])), clase: clasificar(pts) };
  });
  return { columnas, evs };
}

function exportarCSV() {
  const { columnas, evs } = datosExport();
  const celda = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = evs.map(({ e, pts, crit, clase }) =>
    [e.productor, e.propiedad, e.zona, e.superficie, fmtFecha(e.fecha), e.evaluador, ...crit, pts, fmtIndice(pts), clase.label].map(celda).join(';'));
  const contenido = '\uFEFF' + [columnas.map(c => celda(c.titulo)).join(';'), ...filas].join('\r\n');
  return guardarArchivo(`ganso-chaco-evaluaciones-${hoy()}.csv`, contenido, 'text/csv;charset=utf-8');
}

function exportarXLSX() {
  const { columnas, evs } = datosExport();
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : (v || ''); };
  const filas = evs.map(({ e, pts, crit, clase }) => [
    e.productor, e.propiedad, e.zona, num(e.superficie), { v: e.fecha, estilo: 'fecha' }, e.evaluador || '',
    ...crit.map(p => ({ v: p, estilo: 'entero' })), { v: pts, estilo: 'entero' },
    { v: Math.round(pts) / 100, estilo: 'indice' }, { v: clase.label, estilo: clase.key },
  ]);
  const bytes = crearXLSX({ hoja: 'Evaluaciones IGSB', columnas, filas });
  return guardarArchivo(`ganso-chaco-evaluaciones-${hoy()}.xlsx`, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

const aBase64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };

async function guardarArchivo(nombre, datos, mime) {
  // En la app Android el WebView ignora <a download>: se guarda el archivo y se abre "Compartir"
  // para enviarlo por WhatsApp, correo, Drive, etc.
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.()) {
    const { Filesystem, Share } = cap.Plugins;
    try {
      const opts = typeof datos === 'string'
        ? { path: nombre, data: datos, directory: 'CACHE', encoding: 'utf8' }
        : { path: nombre, data: aBase64(datos), directory: 'CACHE' };
      const { uri } = await Filesystem.writeFile(opts);
      await Share.share({ title: 'Evaluaciones GanSo Chaco', text: 'Evaluaciones IGSB exportadas desde GanSo Chaco', files: [uri], dialogTitle: 'Enviar archivo' });
    } catch (e) {
      if (!/cancel/i.test(e?.message || '')) toast('No se pudo exportar el archivo');
    }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([datos], { type: mime }));
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Archivo exportado');
}

function elegirExportacion() {
  const bd = $('#sheet');
  bd.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">
    <h2 id="sh-t">Exportar evaluaciones</h2><p>Elija el formato del archivo.</p>
    <div class="list">
      <button class="row export-op" data-fmt="xlsx"><span class="chip-ico">${ic('table')}</span>
        <div class="grow"><div class="t">Excel (.xlsx)</div><div class="s">Con formato, filtros y colores del semáforo</div></div><span class="chev">${ic('chev')}</span></button>
      <button class="row export-op" data-fmt="csv"><span class="chip-ico">${ic('download')}</span>
        <div class="grow"><div class="t">CSV (.csv)</div><div class="s">Texto simple, para otros sistemas</div></div><span class="chev">${ic('chev')}</span></button>
    </div>
    <button class="btn btn-ghost btn-block mt" data-fmt="">Cancelar</button></div>`;
  bd.hidden = false;
  bd.onclick = e => {
    const b = e.target.closest('[data-fmt]');
    if (e.target !== bd && !b) return;
    bd.hidden = true; bd.innerHTML = '';
    if (b?.dataset.fmt === 'xlsx') exportarXLSX();
    else if (b?.dataset.fmt === 'csv') exportarCSV();
  };
}

async function compartir(ev) {
  const pts = calcularPuntaje(ev.criterios);
  const texto = [
    `GanSo Chaco · Índice de Ganadería Sostenible de Bosque`,
    `${ev.productor} — ${ev.propiedad} (${ev.zona})`,
    `Índice: ${fmtIndice(pts)} · ${clasificar(pts).label} (${pts}/100 pts)`,
    `Fecha: ${fmtFecha(ev.fecha)}`,
  ].join('\n');
  try {
    if (navigator.share) { await navigator.share({ title: 'GanSo Chaco', text: texto }); return; }
    await navigator.clipboard.writeText(texto);
    toast('Resumen copiado');
  } catch (e) {
    if (e.name !== 'AbortError') toast('No se pudo compartir');
  }
}

/* ---------- Router ---------- */

const RUTAS = [
  [/^#?\/?$/, viewInicio],
  [/^#\/evaluaciones$/, viewLista],
  [/^#\/nueva$/, () => viewForm(null)],
  [/^#\/editar\/([\w-]+)$/, viewForm],
  [/^#\/eval\/([\w-]+)$/, viewDetalle],
  [/^#\/territorio$/, viewTerritorio],
  [/^#\/metodo$/, viewMetodo],
  [/^#\/acerca$/, viewAcerca],
];

let rutaAnterior = '';

function render() {
  const hash = location.hash || '#/';
  if (!/^#\/(nueva|editar)/.test(hash)) form = null;
  let view = null;
  for (const [re, fn] of RUTAS) {
    const m = hash.match(re);
    if (m) { view = fn(m[1]); break; }
  }
  if (!view) { location.hash = '#/'; return; }

  const app = $('#app');
  app.innerHTML = view.html;
  if (hash !== rutaAnterior) { app.classList.remove('fade-in'); void app.offsetWidth; app.classList.add('fade-in'); scrollTo(0, 0); }
  rutaAnterior = hash;
  app.classList.toggle('no-tabbar', !!view.hideTabbar);
  document.body.classList.toggle('hide-tabbar', !!view.hideTabbar);
  document.querySelectorAll('#tabbar [data-tab]').forEach(a => a.classList.toggle('active', a.dataset.tab === view.tab));
  document.querySelectorAll('[data-action="exportar"]').forEach(b => b.addEventListener('click', elegirExportacion));
  view.mount?.();
}

document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = ic(el.dataset.icon); });
window.addEventListener('hashchange', render);
render();

// En desarrollo (localhost) no se registra, para no servir archivos viejos desde caché.
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
