/* ============================================================
   salon_virtual.js
   Instituto American Land
   Ubicación: assets/js/salon_virtual.js
============================================================ */

const API = window.location.origin + '/api';

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

// "pepe perez" -> "Pepe Perez"
function titulo(texto) {
  return String(texto || '').toLowerCase().replace(/(^|\s)\S/g, function (l) { return l.toUpperCase(); });
}

function iniciales(texto) {
  const partes = String(texto || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  return (partes[0].charAt(0) + (partes[1] ? partes[1].charAt(0) : '')).toUpperCase();
}

function setTexto(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}

// ── 6. PINTAR SALÓN ─────────────────────────────────────────
function pintarSinSalon() {
  setTexto('salon-titulo', 'Sin salón asignado');
  setTexto('salon-estado', '—');
  setTexto('texto-horario', 'No tienes una matrícula activa.');
  setTexto('salon-horario', '—');
  setTexto('salon-profesor', '—');
  setTexto('salon-nivel', '—');
  setTexto('salon-alumnos', '—');
  setTexto('alumnos-count', 'Sin compañeros');
  const aula = document.getElementById('grid-estudiantes');
  aula.innerHTML = '';
  const p = crear('p', 'est-nombre', 'Cuando te inscribas en un salón, aquí verás a tus compañeros.');
  p.style.padding = '24px';
  aula.appendChild(p);
  const enlace = document.querySelector('.clase-item a');
  if (enlace) enlace.textContent = 'Sin salón asignado';
}

function pintarSalon(salon, companeros, horario) {
  setTexto('salon-titulo', salon.nombre || 'Mi Salón');
  setTexto('salon-profesor', salon.docente || '—');
  setTexto('salon-nivel', salon.nivel || '—');

  const activo = String(salon.estado || '').toLowerCase() === 'activo';
  setTexto('salon-estado', activo ? 'En curso' : titulo(salon.estado || '—'));

  // Horario (viene de /alumnos/horario)
  let textoHorario = '—';
  if (horario) {
    textoHorario = (horario.dias_semana || '') + '  ·  ' +
                   fmtHora(horario.hora_inicio) + ' - ' + fmtHora(horario.hora_fin);
  }
  setTexto('texto-horario', textoHorario);
  setTexto('salon-horario', textoHorario);

  // Compañeros (sin repetir al propio alumno)
  const yo = nombre.trim().toLowerCase();
  const otros = (companeros || []).filter(function (n) {
    return String(n).trim().toLowerCase() !== yo;
  });
  const total = otros.length + 1;
  const etiqueta = total + (total === 1 ? ' alumno' : ' alumnos');
  setTexto('salon-alumnos', etiqueta + ' inscritos');
  setTexto('alumnos-count', '\uD83D\uDC64 ' + etiqueta + ' en el salón');

  const grid = document.getElementById('grid-estudiantes');
  grid.innerHTML = '';

  const tarjetaYo = crear('div', 'estudiante-card activo-yo');
  tarjetaYo.appendChild(crear('div', 'est-avatar est-yo', 'TÚ'));
  tarjetaYo.appendChild(crear('p', 'est-nombre', titulo(nombre)));
  grid.appendChild(tarjetaYo);

  otros.forEach(function (n) {
    const card = crear('div', 'estudiante-card');
    card.appendChild(crear('div', 'est-avatar', iniciales(n)));
    card.appendChild(crear('p', 'est-nombre', titulo(n)));
    grid.appendChild(card);
  });

  const enlace = document.querySelector('.clase-item a');
  if (enlace) enlace.textContent = salon.nombre || 'Mi Salón';
}

// ── 7. ARRANCAR ─────────────────────────────────────────────
async function cargarSalon() {
  let data = null, horario = null;
  try {
    const r = await Promise.all([apiFetch('/alumnos/salon-virtual'), apiFetch('/alumnos/horario')]);
    data = r[0];
    horario = (r[1] && r[1].horario && r[1].horario.length) ? r[1].horario[0] : null;
  } catch (err) {
    console.error('Error al cargar el salón virtual:', err);
  }

  if (!data || !data.salon) {
    pintarSinSalon();
    return;
  }
  pintarSalon(data.salon, data.companeros, horario);
}

cargarSalon();