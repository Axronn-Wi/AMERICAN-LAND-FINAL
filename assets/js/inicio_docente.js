/* ============================================================
   inicio_docente.js
   Instituto American Land
   Ubicación: assets/js/inicio_docente.js
============================================================ */

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

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
const COLORES = ['rojo', 'azul', 'morado'];

function crear(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function setTexto(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
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

function inicial(texto) {
  return String(texto || '?').trim().charAt(0).toUpperCase();
}

// ── 6. SIDEBAR: MIS CLASES ──────────────────────────────────
function pintarSidebar(salones, actualId) {
  const ul = document.querySelector('.sidebar-seccion ul');
  ul.innerHTML = '';

  if (salones.length === 0) {
    const li = crear('li', 'clase-item');
    li.appendChild(crear('a', '', 'Sin salones asignados'));
    ul.appendChild(li);
    return;
  }

  salones.forEach(function (s, i) {
    const li = crear('li', 'clase-item' + (s.id === actualId ? ' activa' : ''));
    li.appendChild(crear('span', 'clase-dot ' + COLORES[i % COLORES.length]));
    const a = crear('a', '', s.nombre);
    a.href = 'inicio.html?salon=' + s.id;
    li.appendChild(a);
    ul.appendChild(li);
  });
}

// ── 7. ENCABEZADO Y TARJETAS ────────────────────────────────
function pintarSalon(s, totalSalones) {
  setTexto('salon-titulo', s.nombre);
  setTexto('salon-detalle',
    s.dias_semana.replace(/,/g, ', ') + '  ·  ' +
    fmtHora(s.hora_inicio) + ' - ' + fmtHora(s.hora_fin) + '  ·  ' +
    'Nivel ' + s.nivel);

  setTexto('stat-alumnos', s.total_estudiantes);
  setTexto('stat-ciclo', s.ciclo_actual != null ? s.ciclo_actual : '—');
  setTexto('stat-horas', horasSemana(s) + ' h');
  setTexto('stat-salones', totalSalones);

  const btn = document.getElementById('btn-ingresar-nota');
  btn.href = 'notas.html?salon=' + s.id;
  const ver = document.getElementById('ver-notas');
  ver.href = 'notas.html?salon=' + s.id;
}

// ── 8. TABLA DE ALUMNOS ─────────────────────────────────────
function pintarAlumnos(estudiantes) {
  const tbody = document.getElementById('tbody-alumnos');
  tbody.innerHTML = '';

  if (estudiantes.length === 0) {
    const tr = crear('tr');
    const td = crear('td', '', 'Este salón todavía no tiene estudiantes matriculados.');
    td.colSpan = 3;
    td.style.padding = '24px';
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  estudiantes.forEach(function (e) {
    const tr = crear('tr');

    const tdNombre = crear('td');
    const info = crear('div', 'alumno-info');
    info.appendChild(crear('div', 'alumno-avatar', inicial(e.nombre_completo)));
    info.appendChild(document.createTextNode(e.nombre_completo));
    tdNombre.appendChild(info);

    tr.appendChild(tdNombre);
    tr.appendChild(crear('td', '', e.codigo_estudiante));
    tr.appendChild(crear('td', '', e.correo));
    tbody.appendChild(tr);
  });
}

// ── 9. SIN SALONES ──────────────────────────────────────────
function pintarSinSalones() {
  setTexto('salon-titulo', 'Sin salones asignados');
  setTexto('salon-detalle', 'Cuando la administración te asigne un salón, aparecerá aquí.');
  setTexto('stat-alumnos', '0');
  setTexto('stat-ciclo', '—');
  setTexto('stat-horas', '—');
  setTexto('stat-salones', '0');
  pintarAlumnos([]);
  pintarSidebar([], null);
}

// ── 10. ARRANCAR ────────────────────────────────────────────
async function cargarInicio() {
  let salones = [];
  try {
    const data = await apiFetch('/docentes/salones');
    salones = (data && data.salones) ? data.salones : [];
  } catch (err) {
    console.error('Error al cargar los salones:', err);
  }

  if (salones.length === 0) {
    pintarSinSalones();
    return;
  }

  // Salón elegido: ?salon=<id>; si no existe, el primero
  const pedido = parseInt(new URLSearchParams(window.location.search).get('salon'), 10);
  const salon = salones.find(function (s) { return s.id === pedido; }) || salones[0];

  pintarSidebar(salones, salon.id);
  pintarSalon(salon, salones.length);

  try {
    const data = await apiFetch('/docentes/salones/' + salon.id + '/estudiantes');
    pintarAlumnos((data && data.estudiantes) ? data.estudiantes : []);
  } catch (err) {
    console.error('Error al cargar los estudiantes:', err);
    pintarAlumnos([]);
  }
}

// ── ACTIVIDAD RECIENTE (últimas notificaciones del docente) ──
const ICONOS_ACTIVIDAD = {
  entrega: { clase: 'verde', texto: '✓' },
  salon:   { clase: 'morado', texto: '★' },
  pago:    { clase: 'azul', texto: '$' }
};

function haceCuanto(fecha) {
  const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
  if (min < 1) return 'Justo ahora';
  if (min < 60) return 'Hace ' + min + ' min';
  const horas = Math.round(min / 60);
  if (horas < 24) return 'Hace ' + horas + (horas === 1 ? ' hora' : ' horas');
  const dias = Math.round(horas / 24);
  return dias === 1 ? 'Ayer' : 'Hace ' + dias + ' días';
}

async function cargarActividad() {
  const lista = document.getElementById('lista-actividad');
  if (!lista) return;

  let notificaciones = [];
  try {
    const data = await apiFetch('/comunicaciones/notificaciones?limite=6');
    notificaciones = (data && data.notificaciones) ? data.notificaciones : [];
  } catch (err) {
    console.error('Error al cargar la actividad:', err);
  }

  lista.textContent = '';
  if (notificaciones.length === 0) {
    const vacio = crear('li', 'act-tiempo', 'Aún no hay actividad. Aquí verás las entregas de tus estudiantes y otros avisos.');
    vacio.style.cssText = 'padding:24px;text-align:center';
    lista.appendChild(vacio);
    return;
  }

  notificaciones.forEach(function (n) {
    const icono = ICONOS_ACTIVIDAD[n.tipo] || { clase: 'amarillo', texto: '!' };
    const li = crear('li', 'actividad-item');
    li.appendChild(crear('span', 'act-icono ' + icono.clase, icono.texto));
    const cuerpo = crear('div');
    cuerpo.appendChild(crear('p', 'act-texto', n.mensaje || n.titulo));
    cuerpo.appendChild(crear('span', 'act-tiempo', n.titulo + ' · ' + haceCuanto(n.creada_en)));
    li.appendChild(cuerpo);
    lista.appendChild(li);
  });
}

cargarInicio();
cargarActividad();