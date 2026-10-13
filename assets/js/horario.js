/* ============================================================
   horario.js
   Instituto American Land
   Ubicación: assets/js/horario.js
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
const DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
               'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Hora UTC -> "6:00 PM" (igual que en inicio_alumnos.js)
function fmtHora(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  let h = d.getUTCHours(), m = d.getUTCMinutes();
  const suf = h >= 12 ? 'PM' : 'AM';
  h = ((h + 11) % 12 + 1);
  return h + ':' + String(m).padStart(2, '0') + ' ' + suf;
}

// Horas decimales entre inicio y fin (para el resumen de carga)
function duracionHoras(inicio, fin) {
  const a = new Date(inicio), b = new Date(fin);
  const min = (b.getUTCHours() * 60 + b.getUTCMinutes()) -
              (a.getUTCHours() * 60 + a.getUTCMinutes());
  return min > 0 ? min / 60 : 0;
}

// "Lun-Mie-Vie" / "Lunes, Miércoles y Viernes" -> índices de columna [0,2,4]
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

// Lunes de la semana de una fecha
function lunesDe(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function crear(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

// ── 6. ESTADO ───────────────────────────────────────────────
let clases = [];                       // horario del alumno (API)
let lunesActual = lunesDe(new Date()); // semana que se muestra

// ── 7. TEXTO DE LA SEMANA ───────────────────────────────────
function pintarSemana() {
  const sab = new Date(lunesActual);
  sab.setDate(sab.getDate() + 5);
  const mismoMes = lunesActual.getMonth() === sab.getMonth();
  const ini = lunesActual.getDate() + (mismoMes ? '' : ' ' + MESES[lunesActual.getMonth()]);
  document.getElementById('texto-semana').textContent =
    'Semana ' + ini + ' – ' + sab.getDate() + ' ' + MESES[sab.getMonth()] +
    ' – ' + sab.getFullYear();
}

// ── 8. TABLA SEMANAL ────────────────────────────────────────
function pintarTabla() {
  const tbody = document.getElementById('tbody-horario');
  tbody.innerHTML = '';

  if (clases.length === 0) {
    const tr = crear('tr');
    const td = crear('td', 'td-vacio', 'No tienes una matrícula activa. Cuando te inscribas en un salón, tu horario aparecerá aquí.');
    td.colSpan = 7;
    td.style.padding = '24px';
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  // Día de hoy (solo si la semana mostrada es la actual)
  const esSemanaActual = lunesDe(new Date()).getTime() === lunesActual.getTime();
  const hoy = (new Date().getDay() + 6) % 7;

  // Una fila por cada franja distinta, ordenadas por hora de inicio
  const franjas = [];
  clases.forEach(function (c) {
    const clave = c.hora_inicio + '|' + c.hora_fin;
    if (!franjas.some(function (f) { return f.clave === clave; })) {
      franjas.push({ clave: clave, inicio: c.hora_inicio, fin: c.hora_fin });
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
      const delDia = clases.filter(function (c) {
        return c.hora_inicio === f.inicio && c.hora_fin === f.fin &&
               parsearDias(c.dias_semana).indexOf(col) !== -1;
      });
      const td = crear('td', delDia.length ? '' : 'td-vacio');
      if (esSemanaActual && col === hoy) td.style.background = 'rgba(0,0,0,0.03)';
      delDia.forEach(function (c) {
        const bloque = crear('div', 'clase-bloque');
        bloque.appendChild(crear('p', 'bloque-nombre', c.salon));
        bloque.appendChild(crear('span', 'bloque-nivel', c.nivel));
        if (c.docente) {
          const p = crear('p', '', 'Prof. ' + c.docente);
          p.style.fontSize = '0.8rem';
          p.style.margin = '4px 0 0';
          bloque.appendChild(p);
        }
        td.appendChild(bloque);
      });
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
}

// ── 9. RESUMEN DE CARGA ─────────────────────────────────────
function pintarResumen() {
  const tbody = document.getElementById('tbody-resumen');
  tbody.innerHTML = '';

  if (clases.length === 0) {
    const tr = crear('tr');
    const td = crear('td', '', 'Sin clases asignadas.');
    td.colSpan = 2;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  clases.forEach(function (c) {
    const horas = duracionHoras(c.hora_inicio, c.hora_fin) * parsearDias(c.dias_semana).length;
    const tr = crear('tr');

    const td1 = crear('td');
    const info = crear('div', 'clase-info');
    info.appendChild(crear('span', 'clase-dot-sm'));
    info.appendChild(document.createTextNode(c.salon + ' · ' + c.dias_semana));
    td1.appendChild(info);

    const td2 = crear('td');
    const horasTxt = (Math.round(horas * 10) / 10).toString().replace('.', ',');
    td2.appendChild(crear('span', 'horas-badge', horasTxt + ' h / semana'));

    tr.appendChild(td1);
    tr.appendChild(td2);
    tbody.appendChild(tr);
  });
}

// ── 10. SIDEBAR ─────────────────────────────────────────────
function pintarSidebar() {
  const enlace = document.querySelector('.clase-item a');
  if (enlace) enlace.textContent = clases.length ? clases[0].salon : 'Sin salón asignado';
}

// ── 11. PRÓXIMAS FECHAS ─────────────────────────────────────
// Todavía no existe un endpoint de calendario: se muestra un aviso.
function pintarFechas() {
  const tbody = document.getElementById('tbody-fechas');
  tbody.innerHTML = '';
  const tr = crear('tr');
  const td = crear('td', '', 'Aún no hay fechas importantes publicadas.');
  td.colSpan = 2;
  tr.appendChild(td);
  tbody.appendChild(tr);
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
    const data = await apiFetch('/alumnos/horario');
    clases = (data && data.horario) ? data.horario : [];
  } catch (err) {
    console.error('Error al cargar el horario:', err);
    clases = [];
  }
  pintarSemana();
  pintarTabla();
  pintarResumen();
  pintarSidebar();
  pintarFechas();
}

cargarHorario();