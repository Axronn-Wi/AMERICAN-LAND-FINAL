/* ============================================================
   inicio_alumnos.js
   Instituto American Land
   Ubicación: assets/js/inicio_alumnos.js
============================================================ */

const API = window.location.origin + '/api';

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
async function cargarDashboard() {

  // ── 5a. HORARIO (nombre del salón, docente, horario) ──────
  const dataHorario = await apiFetch('/alumnos/horario');
  if (dataHorario && dataHorario.horario && dataHorario.horario.length > 0) {
    const salon = dataHorario.horario[0];

    // Encabezado principal
    const h1 = document.querySelector('.encabezado-info h1');
    const sub = document.querySelector('.encabezado-info p');
    if (h1) h1.textContent = salon.salon || 'Mi Salón';
        // Formatea hora UTC correctamente (SQL Server devuelve TIME como 1970-01-01T18:00:00.000Z)
    function fmtHora(valor) {
      if (!valor) return '';
      const d = new Date(valor);
      let h = d.getUTCHours(), m = d.getUTCMinutes();
      const suf = h >= 12 ? 'PM' : 'AM';
      h = ((h + 11) % 12 + 1);
      return h + ':' + String(m).padStart(2, '0') + ' ' + suf;
    }

    if (sub) sub.textContent =
      (salon.dias_semana || '') + ' · ' +
      fmtHora(salon.hora_inicio) + ' - ' +
      fmtHora(salon.hora_fin) + ' · ' +
      'Prof. ' + (salon.docente || '');

    // Sidebar: nombre del salón
    const sidebarSalon = document.querySelector('.clase-item a');
    if (sidebarSalon) sidebarSalon.textContent = salon.salon || 'Mi Salón';
  }

  // ── 5b. NOTAS (promedio) ───────────────────────────────────
  const dataNotas = await apiFetch('/alumnos/notas');
  if (dataNotas && dataNotas.notas) {
    const notas = dataNotas.notas;

    // Calcular promedio general
    const valores = notas
      .map(function (n) { return parseFloat(n.promedio); })
      .filter(function (v) { return !isNaN(v); });

    const promedio = valores.length > 0
      ? (valores.reduce(function (a, b) { return a + b; }, 0) / valores.length).toFixed(1)
      : '—';

    const promedioEl = document.getElementById('promedio-valor');
    if (promedioEl) promedioEl.textContent = promedio;

    // Tabla de notas recientes (últimas 2)
    const tbodyNotas = document.querySelector('.grid-inferior .card-seccion:nth-child(2) tbody');
    if (tbodyNotas && notas.length > 0) {
      tbodyNotas.innerHTML = '';
      notas.slice(0, 2).forEach(function (n) {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>Ciclo ' + (n.numero_ciclo || '') + '</td>' +
          '<td><span class="nota-badge">' + (n.promedio != null ? n.promedio : '—') + '</span></td>';
        tbodyNotas.appendChild(tr);
      });
    }
  }

  // ── 5c. TAREAS (pendientes) ────────────────────────────────
  const dataTareas = await apiFetch('/alumnos/tareas');
  if (dataTareas && dataTareas.tareas) {
    const tareas = dataTareas.tareas;

    // Contar pendientes
    const pendientes = tareas.filter(function (t) {
      return t.estado_entrega === 'pendiente' || !t.estado_entrega;
    }).length;

    const tareasEl = document.getElementById('tareas-valor');
    if (tareasEl) tareasEl.textContent = pendientes;

    // Tabla de tareas recientes (últimas 2)
    const tbodyTareas = document.querySelector('.grid-inferior .card-seccion:nth-child(1) tbody');
    if (tbodyTareas && tareas.length > 0) {
      tbodyTareas.innerHTML = '';
      tareas.slice(0, 2).forEach(function (t) {
        const estado  = t.estado_entrega || 'pendiente';
        const entregada = estado === 'entregado' || estado === 'revisado';
        const clase   = entregada ? 'badge-entregado' : 'badge-pendiente';
        const texto   = entregada ? (estado === 'revisado' ? 'Revisado' : 'Entregado') : 'Pendiente';
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + (t.titulo || 'Tarea') + '</td>' +
          '<td><span class="badge ' + clase + '">' + texto + '</span></td>';
        tbodyTareas.appendChild(tr);
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