/* ============================================================
   notas.js
   Instituto American Land
   Ubicación: assets/js/notas.js
============================================================ */

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

// ── 1. VERIFICAR SESIÓN ─────────────────────────────────────
const token = sessionStorage.getItem('token');
const rol   = sessionStorage.getItem('rol');

if (!token || rol !== 'estudiante') {
  window.location.href = '../auth/login.html';
}

// ── 2. NOMBRE Y AVATAR ──────────────────────────────────────
const nombre    = sessionStorage.getItem('nombre') || 'Estudiante';
const navNombre = document.getElementById('nav-nombre');
const navAvatar = document.getElementById('nav-avatar');
if (navNombre) navNombre.textContent = nombre;
if (navAvatar) navAvatar.textContent = nombre.charAt(0).toUpperCase();

// ── 3. CERRAR SESIÓN ────────────────────────────────────────
document.querySelector('.btn-cerrar').addEventListener('click', function (e) {
  e.preventDefault();
  sessionStorage.clear();
  window.location.href = '../auth/login.html';
});

// ── 4. HELPER PARA LA API ───────────────────────────────────
async function apiFetch(ruta) {
  const respuesta = await fetch(API + ruta, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if (respuesta.status === 401) {
    sessionStorage.clear();
    window.location.href = '../auth/login.html';
    return null;
  }
  return respuesta.json();
}

// ── 5. UTILIDADES ───────────────────────────────────────────
const TOTAL_CICLOS = 4;

function crear(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

// Devuelve un número o null (la BD puede mandar null o texto)
function num(valor) {
  const n = parseFloat(valor);
  return isNaN(n) ? null : n;
}

function fmtNota(valor) {
  const n = num(valor);
  return n === null ? '—' : n.toFixed(1);
}

function claseNota(valor) {
  const n = num(valor);
  if (n === null) return 'nota-pendiente';
  return n >= 4 ? 'nota-alta' : 'nota-media';
}

function mayuscula(texto) {
  const t = String(texto || '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ── 6. ESTADO ───────────────────────────────────────────────
let notasPorCiclo = {};   // { 1: {...}, 2: {...} }
let filtroActual  = 'todos';

// ── 7. TARJETAS DE CICLOS ───────────────────────────────────
function pintarCiclos() {
  const grid = document.getElementById('grid-ciclos');
  grid.innerHTML = '';

  for (let c = 1; c <= TOTAL_CICLOS; c++) {
    const n = notasPorCiclo[c];
    const promedio = n ? num(n.promedio) : null;
    const tiene = promedio !== null;

    const card = crear('div', 'ciclo-card' + (tiene ? '' : ' ciclo-pendiente'));

    const header = crear('div', 'ciclo-header');
    header.appendChild(crear('span', 'ciclo-label', 'Ciclo ' + c));
    const aprobado = n && n.estado === 'aprobado';
    header.appendChild(crear('span',
      'ciclo-estado ' + (aprobado ? 'completado' : 'pendiente'),
      tiene ? mayuscula(n.estado) : 'Pendiente'));
    card.appendChild(header);

    card.appendChild(crear('p', 'ciclo-nota' + (tiene ? '' : ' ciclo-nota-gris'), fmtNota(promedio)));

    const examen = crear('p', 'ciclo-examen', 'Examen Final: ');
    const examenNota = n && num(n.nota_examen_final) !== null;
    examen.appendChild(crear('strong', '', examenNota ? fmtNota(n.nota_examen_final) : 'Próximamente'));
    card.appendChild(examen);

    const wrap = crear('div', 'ciclo-barra-wrap');
    const barra = crear('div', 'ciclo-barra');
    barra.style.width = (tiene ? Math.min(100, promedio / 5 * 100) : 0) + '%';
    wrap.appendChild(barra);
    card.appendChild(wrap);

    grid.appendChild(card);
  }
}

// ── 8. PROMEDIO GENERAL Y ENCABEZADO ────────────────────────
function pintarResumen(notas) {
  const valores = notas.map(function (n) { return num(n.promedio); })
                       .filter(function (v) { return v !== null; });
  const prom = valores.length
    ? (valores.reduce(function (a, b) { return a + b; }, 0) / valores.length).toFixed(1)
    : '—';
  document.getElementById('promedio-general').textContent = prom;

  const sub = document.getElementById('texto-subtitulo');
  sub.textContent = notas.length
    ? notas[0].salon + '  ·  ' + notas.length + ' de ' + TOTAL_CICLOS + ' ciclos con nota'
    : 'Aún no tienes notas registradas';
}

// ── 9. HISTORIAL ────────────────────────────────────────────
function filaHistorial(ciclo, actividad, valor, estadoTexto, estadoClase) {
  const tr = crear('tr');
  tr.dataset.ciclo = ciclo;
  tr.appendChild(crear('td', '', actividad));
  tr.appendChild(crear('td', '', 'Ciclo ' + ciclo));
  const tdNota = crear('td');
  tdNota.appendChild(crear('span', 'nota-badge ' + claseNota(valor), fmtNota(valor)));
  tr.appendChild(tdNota);
  const tdEstado = crear('td');
  tdEstado.appendChild(crear('span', 'badge ' + estadoClase, estadoTexto));
  tr.appendChild(tdEstado);
  return tr;
}

function pintarHistorial() {
  const tbody = document.getElementById('tbody-historial');
  tbody.innerHTML = '';

  const ciclos = Object.keys(notasPorCiclo).map(Number).sort(function (a, b) { return a - b; })
    .filter(function (c) { return filtroActual === 'todos' || String(c) === filtroActual; });

  if (ciclos.length === 0) {
    const tr = crear('tr');
    const td = crear('td', '',
      filtroActual === 'todos'
        ? 'Aún no tienes notas registradas.'
        : 'No hay notas para el ciclo ' + filtroActual + '.');
    td.colSpan = 4;
    td.style.padding = '24px';
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  ciclos.forEach(function (c) {
    const n = notasPorCiclo[c];
    const aprobado = n.estado === 'aprobado';
    const texto = mayuscula(n.estado || 'pendiente');
    const clase = aprobado ? 'badge-aprobado' : 'badge-pendiente';
    tbody.appendChild(filaHistorial(c, 'Nota del ciclo', n.nota_ciclo, texto, clase));
    tbody.appendChild(filaHistorial(c, 'Examen final', n.nota_examen_final, texto, clase));
  });
}

// ── 10. FILTRO POR CICLO ────────────────────────────────────
document.querySelectorAll('.btn-filtro').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.btn-filtro').forEach(function (b) { b.classList.remove('activo'); });
    btn.classList.add('activo');
    filtroActual = btn.dataset.ciclo;
    pintarHistorial();
  });
});

// ── 11. ARRANCAR ────────────────────────────────────────────
async function cargarNotas() {
  let notas = [];
  let salon = null;

  try {
    const resultados = await Promise.all([
      apiFetch('/alumnos/notas'),
      apiFetch('/alumnos/horario')
    ]);
    notas = (resultados[0] && resultados[0].notas) ? resultados[0].notas : [];
    const horario = (resultados[1] && resultados[1].horario) ? resultados[1].horario : [];
    if (horario.length) salon = horario[0].salon;
  } catch (err) {
    console.error('Error al cargar las notas:', err);
  }

  notasPorCiclo = {};
  notas.forEach(function (n) { notasPorCiclo[n.numero_ciclo] = n; });

  const enlace = document.querySelector('.clase-item a');
  if (enlace) enlace.textContent = salon || 'Sin salón asignado';

  pintarResumen(notas);
  pintarCiclos();
  pintarHistorial();
}

cargarNotas();