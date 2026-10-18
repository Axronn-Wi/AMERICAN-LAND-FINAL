/* ============================================================
   inicio_alumnos.js
   Instituto American Land
   Ubicación: assets/js/inicio_alumnos.js
============================================================ */

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

// ── 1. VERIFICAR SESIÓN ─────────────────────────────────────
// Si no hay token o el rol no es estudiante, manda al login
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

// ── 4. FUNCIÓN HELPER PARA LLAMADAS A LA API ────────────────
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

// ── 5. CARGAR DATOS DEL DASHBOARD ───────────────────────────

// Formatea la hora que manda el backend (1970-01-01T18:00:00.000Z) como "6:00 PM"
function fmtHora(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const suf = h >= 12 ? 'PM' : 'AM';
  h = ((h + 11) % 12 + 1);
  return h + ':' + String(m).padStart(2, '0') + ' ' + suf;
}

// Crea una fila <tr> con celdas de texto (sin innerHTML: el texto viene de la BD)
function filaTabla(celdas) {
  const tr = document.createElement('tr');
  celdas.forEach(function (contenido) {
    const td = document.createElement('td');
    if (contenido instanceof Node) td.appendChild(contenido);
    else td.textContent = contenido;
    tr.appendChild(td);
  });
  return tr;
}

function filaVacia(tbody, texto) {
  tbody.textContent = '';
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 2;
  td.className = 'celda-vacia';
  td.textContent = texto;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

function badge(clase, texto) {
  const span = document.createElement('span');
  span.className = clase;
  span.textContent = texto;
  return span;
}

// La BD guarda 'entregada' y 'calificada' (igual que en tareas.js)
const ESTADOS_TAREA = {
  entregada:  { clase: 'badge badge-entregado', texto: 'Entregada' },
  calificada: { clase: 'badge badge-revisado',  texto: 'Calificada' },
  pendiente:  { clase: 'badge badge-pendiente', texto: 'Pendiente' }
};

async function cargarDashboard() {
  const tbodyTareas = document.querySelector('.grid-inferior .card-seccion:nth-child(1) tbody');
  const tbodyNotas  = document.querySelector('.grid-inferior .card-seccion:nth-child(2) tbody');

  // Las tres consultas van en paralelo para que el panel cargue más rápido
  const [dataHorario, dataNotas, dataTareas] = await Promise.all([
    apiFetch('/alumnos/horario').catch(function () { return null; }),
    apiFetch('/alumnos/notas').catch(function () { return null; }),
    apiFetch('/alumnos/tareas').catch(function () { return null; })
  ]);

  // ── 5a. HORARIO (salón, nivel, docente) ───────────────────
  const h1  = document.querySelector('.encabezado-info h1');
  const sub = document.querySelector('.encabezado-info p');
  const sidebarSalon = document.querySelector('.clase-item a');
  const nivelEl = document.getElementById('nivel-valor');

  if (dataHorario && dataHorario.horario && dataHorario.horario.length > 0) {
    const salon = dataHorario.horario[0];
    if (h1) h1.textContent = salon.salon || 'Mi Salón';
    if (sub) sub.textContent =
      (salon.dias_semana || '') + ' · ' +
      fmtHora(salon.hora_inicio) + ' - ' + fmtHora(salon.hora_fin) +
      (salon.docente ? ' · Prof. ' + salon.docente : '');
    if (sidebarSalon) sidebarSalon.textContent = salon.salon || 'Mi Salón';
    if (nivelEl) nivelEl.textContent = salon.nivel || '—';
  } else {
    if (h1) h1.textContent = 'Aún no tienes un salón activo';
    if (sub) sub.textContent = 'Cuando tu matrícula esté activa verás aquí tu horario y tu docente.';
    if (sidebarSalon) sidebarSalon.textContent = 'Sin salón asignado';
  }

  // ── 5b. NOTAS (promedio y últimas notas) ──────────────────
  const notas = (dataNotas && dataNotas.notas) || [];
  const valores = notas
    .map(function (n) { return parseFloat(n.promedio); })
    .filter(function (v) { return !isNaN(v); });

  const promedioEl = document.getElementById('promedio-valor');
  if (promedioEl) {
    promedioEl.textContent = valores.length > 0
      ? (valores.reduce(function (a, b) { return a + b; }, 0) / valores.length).toFixed(1)
      : '—';
  }

  if (tbodyNotas) {
    if (notas.length === 0) {
      filaVacia(tbodyNotas, dataNotas ? 'Todavía no tienes notas registradas.' : 'No se pudieron cargar las notas.');
    } else {
      tbodyNotas.textContent = '';
      // Las más recientes primero (el backend las ordena por ciclo ascendente)
      notas.slice(-3).reverse().forEach(function (n) {
        const nota = n.promedio != null ? Number(n.promedio).toFixed(1) : '—';
        tbodyNotas.appendChild(filaTabla(['Ciclo ' + (n.numero_ciclo || ''), badge('nota-badge', nota)]));
      });
    }
  }

  // ── 5c. TAREAS (pendientes / entregadas) ──────────────────
  const tareas = (dataTareas && dataTareas.tareas) || [];
  const pendientes = tareas.filter(function (t) { return !t.estado_entrega || t.estado_entrega === 'pendiente'; });

  const tareasEl = document.getElementById('tareas-valor');
  if (tareasEl) tareasEl.textContent = dataTareas ? pendientes.length : '—';
  const entregadasEl = document.getElementById('entregadas-valor');
  if (entregadasEl) entregadasEl.textContent = dataTareas ? tareas.length - pendientes.length : '—';

  if (tbodyTareas) {
    if (tareas.length === 0) {
      filaVacia(tbodyTareas, dataTareas ? 'No tienes tareas asignadas.' : 'No se pudieron cargar las tareas.');
    } else {
      tbodyTareas.textContent = '';
      // Primero las pendientes (las más urgentes), luego las demás
      const ordenadas = pendientes.concat(tareas.filter(function (t) { return pendientes.indexOf(t) === -1; }));
      ordenadas.slice(0, 3).forEach(function (t) {
        const estado = ESTADOS_TAREA[t.estado_entrega] || ESTADOS_TAREA.pendiente;
        tbodyTareas.appendChild(filaTabla([t.titulo || 'Tarea', badge(estado.clase, estado.texto)]));
      });
    }
  }
}

// ── 6. ANIMACIÓN DE TARJETAS STAT ───────────────────────────
const statCards = document.querySelectorAll('.stat-card');
const observador = new IntersectionObserver(function (entradas) {
  entradas.forEach(function (entrada) {
    if (entrada.isIntersecting) {
      entrada.target.style.opacity    = '1';
      entrada.target.style.transform  = 'translateY(0)';
      observador.unobserve(entrada.target);
    }
  });
}, { threshold: 0.1 });

statCards.forEach(function (card, i) {
  card.style.opacity    = '0';
  card.style.transform  = 'translateY(16px)';
  card.style.transition =
    'opacity 0.4s ease ' + (i * 0.08) + 's, ' +
    'transform 0.4s ease ' + (i * 0.08) + 's';
  observador.observe(card);
});

// ── 7. ARRANCAR ─────────────────────────────────────────────
cargarDashboard();