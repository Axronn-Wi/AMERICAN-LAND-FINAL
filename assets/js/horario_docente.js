/* ============================================================
   horario_docente.js
   Instituto American Land
   Ubicación: assets/js/horario_docente.js
============================================================ */

const API = window.location.origin + '/api';

// ── 1. VERIFICAR SESIÓN ─────────────────────────────────────
const token = sessionStorage.getItem('token');
const rol   = sessionStorage.getItem('rol');

if (!token || rol !== 'docente') {
  window.location.href = '../auth/login.html';
}

// ── 2. NOMBRE Y AVATAR ──────────────────────────────────────
const nombre    = sessionStorage.getItem('nombre') || 'Docente';
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
const DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
               'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
// Un color por salón, en el mismo orden que el menú lateral
const COLORES = ['rojo', 'azul', 'morado'];
const BLOQUES = ['bloque-canada', 'bloque-nueva-zelanda', 'bloque-miami'];
const BADGES  = ['morado', 'azul', 'azul'];

function crear(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function fmtHora(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  let h = d.getUTCHours(), m = d.getUTCMinutes();
  const suf = h >= 12 ? 'PM' : 'AM';
  h = ((h + 11) % 12 + 1);
  return h + ':' + String(m).padStart(2, '0') + ' ' + suf;
}

// "Lun,Mie,Vie" -> [0,2,4]
function parsearDias(texto) {
  const limpio = String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const indices = [];
  limpio.split(/[^a-z]+/).forEach(function (palabra) {
    const i = DIAS.indexOf(palabra.slice(0, 3));
    if (palabra.length >= 3 && i !== -1 && indices.indexOf(i) === -1) indices.push(i);
  });
  return indices;
}

function horasSemana(s) {
  const a = new Date(s.hora_inicio), b = new Date(s.hora_fin);
  const min = (b.getUTCHours() * 60 + b.getUTCMinutes()) -
              (a.getUTCHours() * 60 + a.getUTCMinutes());
  const horas = (min > 0 ? min / 60 : 0) * parsearDias(s.dias_semana).length;
  return Math.round(horas * 10) / 10;
}

function fmtNum(n) {
  return String(n).replace('.', ',');
}

function lunesDe(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// ── 6. ESTADO ───────────────────────────────────────────────
let salones = [];
let lunesActual = lunesDe(new Date());

// ── 7. SIDEBAR ──────────────────────────────────────────────
function pintarSidebar() {
  const ul = document.querySelector('.sidebar-seccion ul');
  ul.innerHTML = '';
  if (salones.length === 0) {
    const li = crear('li', 'clase-item');
    li.appendChild(crear('a', '', 'Sin salones asignados'));
    ul.appendChild(li);
    return;
  }
  salones.forEach(function (s, i) {
    const li = crear('li', 'clase-item');
    li.appendChild(crear('span', 'clase-dot ' + COLORES[i % COLORES.length]));
    const a = crear('a', '', s.nombre);
    a.href = 'inicio.html?salon=' + s.id;
    li.appendChild(a);
    ul.appendChild(li);
  });
}

// ── 8. TEXTO DE LA SEMANA ───────────────────────────────────
function pintarSemana() {
  const sab = new Date(lunesActual);
  sab.setDate(sab.getDate() + 5);
  const mismoMes = lunesActual.getMonth() === sab.getMonth();
  const ini = lunesActual.getDate() + (mismoMes ? '' : ' ' + MESES[lunesActual.getMonth()]);
  document.getElementById('texto-semana').textContent =
    'Semana ' + ini + ' – ' + sab.getDate() + ' ' + MESES[sab.getMonth()] +
    ' – ' + sab.getFullYear();
}

// ── 9. TABLA SEMANAL ────────────────────────────────────────
function pintarTabla() {
  const tbody = document.getElementById('tbody-horario');
  tbody.innerHTML = '';

  if (salones.length === 0) {
    const tr = crear('tr');
    const td = crear('td', 'td-vacio', 'No tienes salones asignados. Cuando la administración te asigne uno, tu horario aparecerá aquí.');
    td.colSpan = 7;
    td.style.padding = '24px';
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const esSemanaActual = lunesDe(new Date()).getTime() === lunesActual.getTime();
  const hoy = (new Date().getDay() + 6) % 7;

  // Una fila por cada franja distinta, ordenadas por hora de inicio
  const franjas = [];
  salones.forEach(function (s) {
    const clave = s.hora_inicio + '|' + s.hora_fin;
    if (!franjas.some(function (f) { return f.clave === clave; })) {
      franjas.push({ clave: clave, inicio: s.hora_inicio, fin: s.hora_fin });
    }
  });
  franjas.sort(function (a, b) { return new Date(a.inicio) - new Date(b.inicio); });

  franjas.forEach(function (f) {
    const tr = crear('tr');
    const tdHora = crear('td', 'td-hora');
    tdHora.appendChild(document.createTextNode(fmtHora(f.inicio)));
    tdHora.appendChild(document.createElement('br'));
    tdHora.appendChild(document.createTextNode(fmtHora(f.fin)));
    tr.appendChild(tdHora);

    for (let col = 0; col < 6; col++) {
      const delDia = salones.filter(function (s) {
        return s.hora_inicio === f.inicio && s.hora_fin === f.fin &&
               parsearDias(s.dias_semana).indexOf(col) !== -1;
      });
      const td = crear('td', delDia.length ? '' : 'td-vacio');
      if (esSemanaActual && col === hoy) td.style.background = 'rgba(0,0,0,0.03)';
      delDia.forEach(function (s) {
        const i = salones.indexOf(s);
        const bloque = crear('div', 'clase-bloque ' + BLOQUES[i % BLOQUES.length]);
        bloque.appendChild(crear('p', 'bloque-nombre', s.nombre));
        bloque.appendChild(crear('span', 'bloque-nivel', s.nivel));
        td.appendChild(bloque);
      });
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
}

// ── 10. RESUMEN DE CARGA ────────────────────────────────────
function pintarResumen() {
  const tbody = document.getElementById('tbody-resumen');
  tbody.innerHTML = '';
  let total = 0;

  if (salones.length === 0) {
    const tr = crear('tr');
    const td = crear('td', '', 'Sin salones asignados.');
    td.colSpan = 3;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  salones.forEach(function (s, i) {
    const horas = horasSemana(s);
    total += horas;
    const tr = crear('tr');

    const td1 = crear('td');
    const info = crear('div', 'salon-info');
    info.appendChild(crear('span', 'dot-sm ' + COLORES[i % COLORES.length]));
    info.appendChild(document.createTextNode(s.nombre));
    td1.appendChild(info);

    const td2 = crear('td', '', s.nivel);

    const td3 = crear('td');
    td3.appendChild(crear('span', 'horas-badge ' + BADGES[i % BADGES.length], fmtNum(horas) + ' h / semana'));

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tbody.appendChild(tr);
  });

  document.getElementById('horas-total').textContent = fmtNum(Math.round(total * 10) / 10) + ' h / semana';
}

// ── 11. PRÓXIMAS FECHAS ─────────────────────────────────────
// Todavía no existe un endpoint de calendario.
function pintarFechas() {
  const cont = document.getElementById('lista-fechas');
  cont.innerHTML = '';
  const p = crear('p', 'fecha-sub', 'Aún no hay fechas importantes publicadas.');
  p.style.padding = '24px';
  p.style.textAlign = 'center';
  cont.appendChild(p);
}

// ── 12. NAVEGACIÓN DE SEMANAS ───────────────────────────────
function moverSemana(dias) {
  lunesActual.setDate(lunesActual.getDate() + dias);
  pintarSemana();
  pintarTabla();
}
document.getElementById('btn-anterior').addEventListener('click', function () { moverSemana(-7); });
document.getElementById('btn-siguiente').addEventListener('click', function () { moverSemana(7); });

// ── 13. ARRANCAR ────────────────────────────────────────────
async function cargarHorario() {
  try {
    const data = await apiFetch('/docentes/salones');
    salones = (data && data.salones) ? data.salones : [];
  } catch (err) {
    console.error('Error al cargar el horario:', err);
    salones = [];
  }
  pintarSidebar();
  pintarSemana();
  pintarTabla();
  pintarResumen();
  pintarFechas();
}

cargarHorario();