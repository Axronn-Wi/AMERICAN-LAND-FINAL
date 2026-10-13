/* ============================================================
   inicio_admin.js
   Instituto American Land
   Ubicación: assets/js/inicio_admin.js
============================================================ */

const API = window.location.origin + '/api';

// ── 1. VERIFICAR SESIÓN ─────────────────────────────────────
const token = sessionStorage.getItem('token');
const rol   = sessionStorage.getItem('rol');
const sesionValida = !!token && rol === 'admin';

if (!sesionValida) {
  window.location.href = '../auth/login.html';
}

// ── 2. NOMBRE Y AVATAR ──────────────────────────────────────
const nombre    = sessionStorage.getItem('nombre') || 'Administrador';
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

// ── 4. HELPER PARA LA API (GET, POST, PUT) ──────────────────
// Devuelve { ok, datos } o null si el token venció.
async function apiFetch(ruta, opciones) {
  const config = opciones || {};
  const headers = { 'Authorization': 'Bearer ' + token };
  if (config.body) headers['Content-Type'] = 'application/json';

  const respuesta = await fetch(API + ruta, {
    method: config.method || 'GET',
    headers: headers,
    body: config.body ? JSON.stringify(config.body) : undefined
  });

  if (respuesta.status === 401) {
    sessionStorage.clear();
    window.location.href = '../auth/login.html';
    return null;
  }

  let datos = null;
  try { datos = await respuesta.json(); } catch (err) { /* sin cuerpo JSON */ }
  return { ok: respuesta.ok, datos: datos };
}

// ── 5. UTILIDADES ───────────────────────────────────────────
const COLORES_SALON = ['rojo', 'azul', 'morado', 'amarillo'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

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

function mostrarAlerta(tipo, texto) {
  const alerta = document.getElementById('alerta');
  alerta.textContent = texto;
  alerta.className = 'alerta ' + tipo + ' visible';
  alerta.style.display = 'block';
}

function inicial(texto) {
  return String(texto || '?').trim().charAt(0).toUpperCase();
}

function plural(n, singular, pluralTexto) {
  return n + ' ' + (n === 1 ? singular : pluralTexto);
}

// "2026-10-08T00:00:00.000Z" -> "8 Oct 2026" (en UTC para que no se corra un día)
function fmtFecha(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  return d.getUTCDate() + ' ' + MESES[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

// Horas TIME de SQL Server llegan en UTC
function fmtHora(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const suf = h >= 12 ? 'PM' : 'AM';
  h = ((h + 11) % 12 + 1);
  return h + ':' + String(m).padStart(2, '0') + ' ' + suf;
}

// ── 6. DATOS ────────────────────────────────────────────────
let usuarios = [];
let salones = [];
let matriculas = [];

async function cargarDatos() {
  const rutas = [
    ['/admin/usuarios', 'usuarios'],
    ['/admin/salones', 'salones'],
    ['/admin/matriculas', 'matriculas']
  ];

  const respuestas = await Promise.all(rutas.map(function (r) {
    return apiFetch(r[0]).catch(function (err) { console.error(err); return null; });
  }));

  const fallidos = [];
  const lista = {};

  respuestas.forEach(function (res, i) {
    const clave = rutas[i][1];
    if (res && res.ok && res.datos && Array.isArray(res.datos[clave])) {
      lista[clave] = res.datos[clave];
    } else {
      lista[clave] = [];
      fallidos.push(clave);
    }
  });

  usuarios = lista.usuarios;
  salones = lista.salones;
  matriculas = lista.matriculas;

  if (fallidos.length > 0) {
    mostrarAlerta('error', 'No se pudieron cargar: ' + fallidos.join(', ') + '.');
  }
}

// ── 7. FECHA Y TARJETAS ─────────────────────────────────────
function pintarFecha() {
  const texto = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  setTexto('texto-fecha', texto.charAt(0).toUpperCase() + texto.slice(1));
}

function pintarStats() {
  const estudiantes = usuarios.filter(function (u) { return u.rol === 'estudiante'; });
  const docentes = usuarios.filter(function (u) { return u.rol === 'docente'; });
  const activos = function (lista) { return lista.filter(function (u) { return u.activo; }).length; };
  const salonesActivos = salones.filter(function (s) { return s.estado === 'activo'; }).length;
  const pendientes = matriculas.filter(function (m) { return m.estado === 'pendiente'; }).length;

  setTexto('stat-alumnos', activos(estudiantes));
  setTexto('delta-alumnos', plural(estudiantes.length, 'registrado', 'registrados'));

  setTexto('stat-docentes', activos(docentes));
  setTexto('delta-docentes', plural(docentes.length, 'registrado', 'registrados'));

  setTexto('stat-salones', salonesActivos);
  setTexto('delta-salones', plural(salones.length, 'salón registrado', 'salones registrados'));

  setTexto('stat-matriculas', pendientes);
  const delta = document.getElementById('delta-matriculas');
  if (pendientes > 0) {
    delta.textContent = '\u26A0 Requiere revisión';
    delta.className = 'stat-delta alerta';
  } else {
    delta.textContent = 'Todo al día';
    delta.className = 'stat-delta neutro';
  }
}

// ── 8. SALONES ACTIVOS ──────────────────────────────────────
function pintarSalones() {
  const lista = document.getElementById('lista-salones');
  lista.innerHTML = '';

  const activos = salones.filter(function (s) { return s.estado === 'activo'; });

  if (activos.length === 0) {
    const vacio = crear('p', '', 'No hay salones activos por ahora.');
    vacio.style.padding = '24px';
    vacio.style.textAlign = 'center';
    lista.appendChild(vacio);
    return;
  }

  activos.slice(0, 5).forEach(function (s, i) {
    // Alumnos = matrículas activas de ese salón en su año
    const total = matriculas.filter(function (m) {
      return m.estado === 'activa' && m.salon === s.nombre && m.anno === s.anno;
    }).length;

    const card = crear('div', 'salon-card');
    card.appendChild(crear('div', 'salon-color ' + COLORES_SALON[i % COLORES_SALON.length]));

    const info = crear('div', 'salon-info');
    info.appendChild(crear('p', 'salon-nombre', s.nombre));
    info.appendChild(crear('p', 'salon-meta',
      'Nivel ' + s.nivel + ' \u2022 ' +
      String(s.dias_semana || '').replace(/,/g, ', ') + ' ' +
      fmtHora(s.hora_inicio) + ' - ' + fmtHora(s.hora_fin) + ' \u2022 ' + s.docente));
    card.appendChild(info);

    const derecha = crear('div', 'salon-derecha');
    derecha.appendChild(crear('span', 'salon-alumnos', plural(total, 'alumno', 'alumnos')));
    derecha.appendChild(crear('span', 'badge-estado activo', 'Activo'));
    card.appendChild(derecha);

    lista.appendChild(card);
  });
}

// ── 9. ACTIVIDAD RECIENTE (se arma con usuarios y matrículas reales) ──
function tiempoRelativo(fecha, soloFecha) {
  if (soloFecha) return fmtFecha(fecha);
  const minutos = Math.floor((Date.now() - fecha.getTime()) / 60000);
  if (minutos < 1) return 'Hace un momento';
  if (minutos < 60) return 'Hace ' + minutos + ' min';
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return 'Hace ' + horas + ' h';
  const dias = Math.floor(horas / 24);
  if (dias < 7) return 'Hace ' + plural(dias, 'día', 'días');
  return fmtFecha(fecha);
}

function pintarActividad() {
  const lista = document.getElementById('lista-actividad');
  lista.innerHTML = '';

  const eventos = [];

  const ROLES = {
    estudiante: { etiqueta: 'alumno', badge: 'Alumno', clase: 'badge-matricula', icono: '\uD83C\uDF93' },
    docente:    { etiqueta: 'docente', badge: 'Docente', clase: 'badge-nota', icono: '\uD83D\uDC68\u200D\uD83C\uDFEB' },
    admin:      { etiqueta: 'administrador', badge: 'Admin', clase: 'badge-salon', icono: '\uD83D\uDEE0' }
  };

  usuarios.forEach(function (u) {
    if (!u.creado_en) return;
    const r = ROLES[u.rol] || ROLES.estudiante;
    eventos.push({
      fecha: new Date(u.creado_en), soloFecha: false,
      prefijo: 'Nuevo ' + r.etiqueta + ' registrado \u2014 ', resaltado: u.nombre_completo, sufijo: '',
      badge: r.badge, claseBadge: r.clase, icono: r.icono, claseIcono: 'icono-media'
    });
  });

  matriculas.forEach(function (m) {
    if (!m.fecha_matricula) return;
    eventos.push({
      fecha: new Date(m.fecha_matricula), soloFecha: true,
      prefijo: 'Matrícula registrada \u2014 ', resaltado: m.estudiante, sufijo: ' en ' + m.salon,
      badge: 'Matrícula', claseBadge: 'badge-matricula', icono: '\uD83D\uDCCB', claseIcono: 'icono-alta'
    });
  });

  eventos.sort(function (a, b) { return b.fecha - a.fecha; });

  if (eventos.length === 0) {
    const vacio = crear('p', '', 'Todavía no hay actividad registrada.');
    vacio.style.padding = '24px';
    vacio.style.textAlign = 'center';
    lista.appendChild(vacio);
    return;
  }

  eventos.slice(0, 5).forEach(function (ev) {
    const item = crear('div', 'actividad-item');
    item.appendChild(crear('div', 'actividad-icono ' + ev.claseIcono, ev.icono));

    const detalle = crear('div', 'actividad-detalle');
    const texto = crear('p', 'actividad-texto', ev.prefijo);
    texto.appendChild(crear('strong', '', ev.resaltado));
    if (ev.sufijo) texto.appendChild(document.createTextNode(ev.sufijo));
    detalle.appendChild(texto);
    detalle.appendChild(crear('span', 'actividad-hora', tiempoRelativo(ev.fecha, ev.soloFecha)));
    item.appendChild(detalle);

    item.appendChild(crear('span', 'actividad-badge ' + ev.claseBadge, ev.badge));
    lista.appendChild(item);
  });
}

// ── 10. MATRÍCULAS PENDIENTES ───────────────────────────────
function nivelDeMatricula(m) {
  const salon = salones.find(function (s) { return s.nombre === m.salon && s.anno === m.anno; });
  return salon ? salon.nivel : '—';
}

function pintarPendientes() {
  const tbody = document.getElementById('tbody-matriculas');
  tbody.innerHTML = '';

  const pendientes = matriculas.filter(function (m) { return m.estado === 'pendiente'; });

  if (pendientes.length === 0) {
    const tr = crear('tr');
    const td = crear('td', '', 'No hay matrículas pendientes por revisar.');
    td.colSpan = 7;
    td.style.padding = '24px';
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  pendientes.slice(0, 5).forEach(function (m) {
    const tr = crear('tr', 'fila-matricula');

    tr.appendChild(crear('td', 'td-codigo', '#' + m.id));

    const tdAlumno = crear('td');
    const info = crear('div', 'alumno-info');
    info.appendChild(crear('div', 'avatar-mini', inicial(m.estudiante)));
    info.appendChild(document.createTextNode(m.estudiante));
    tdAlumno.appendChild(info);
    tr.appendChild(tdAlumno);

    tr.appendChild(crear('td', '', nivelDeMatricula(m)));
    tr.appendChild(crear('td', '', m.salon));
    tr.appendChild(crear('td', '', fmtFecha(m.fecha_matricula)));

    const tdEstado = crear('td');
    tdEstado.appendChild(crear('span', 'badge-estado pendiente', 'Pendiente'));
    tr.appendChild(tdEstado);

    const tdAccion = crear('td');
    const acciones = crear('div', 'acciones-fila');
    const btnAprobar = crear('button', 'btn-aprobar', 'Aprobar');
    const btnRechazar = crear('button', 'btn-rechazar', 'Rechazar');
    btnAprobar.addEventListener('click', function () { cambiarEstado(m, 'activa', btnAprobar, btnRechazar); });
    btnRechazar.addEventListener('click', function () { cambiarEstado(m, 'cancelada', btnAprobar, btnRechazar); });
    acciones.appendChild(btnAprobar);
    acciones.appendChild(btnRechazar);
    tdAccion.appendChild(acciones);
    tr.appendChild(tdAccion);

    tbody.appendChild(tr);
  });
}

// Aprobar = estado "activa"; Rechazar = estado "cancelada"
async function cambiarEstado(matricula, nuevoEstado, btnAprobar, btnRechazar) {
  if (nuevoEstado === 'cancelada' &&
      !confirm('¿Rechazar la matrícula de ' + matricula.estudiante + '? Quedará como cancelada.')) {
    return;
  }

  btnAprobar.disabled = true;
  btnRechazar.disabled = true;

  try {
    const res = await apiFetch('/admin/matriculas/' + matricula.id + '/estado', {
      method: 'PUT',
      body: { estado: nuevoEstado }
    });

    if (res && res.ok) {
      await cargarDatos();
      pintarTodo();
      mostrarAlerta('exito', nuevoEstado === 'activa'
        ? 'Matrícula de ' + matricula.estudiante + ' aprobada.'
        : 'Matrícula de ' + matricula.estudiante + ' rechazada.');
    } else {
      mostrarAlerta('error', (res && res.datos && res.datos.mensaje) || 'No se pudo actualizar la matrícula.');
      btnAprobar.disabled = false;
      btnRechazar.disabled = false;
    }
  } catch (err) {
    console.error(err);
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
    btnAprobar.disabled = false;
    btnRechazar.disabled = false;
  }
}

// ── 11. ACCIONES RÁPIDAS ────────────────────────────────────
// Cada página abrirá su formulario al llegar con ?nuevo=1
document.getElementById('sb-nuevo-alumno').addEventListener('click', function () {
  window.location.href = 'alumnos.html?nuevo=1';
});
document.getElementById('sb-nuevo-docente').addEventListener('click', function () {
  window.location.href = 'docentes.html?nuevo=1';
});
document.getElementById('sb-nuevo-salon').addEventListener('click', function () {
  window.location.href = 'salones.html?nuevo=1';
});

// ── 12. ARRANCAR ────────────────────────────────────────────
function pintarTodo() {
  pintarStats();
  pintarSalones();
  pintarActividad();
  pintarPendientes();
}

async function iniciar() {
  pintarFecha();
  try {
    await cargarDatos();
  } catch (err) {
    console.error('Error al cargar los datos:', err);
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
  }
  pintarTodo();
}

if (sesionValida) iniciar();