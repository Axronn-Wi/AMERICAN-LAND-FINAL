/* ============================================================
   matriculas_admin.js
   Instituto American Land
   Ubicación: assets/js/matriculas_admin.js
============================================================ */

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

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
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const POR_PAGINA = 10;

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

const formatoPesos = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
});

// ── 6. ESTADO DE LA PÁGINA ──────────────────────────────────
let matriculas = [];
let salones = [];
let estudiantes = [];
let pagina = 1;

// ── 7. CARGA DE DATOS ───────────────────────────────────────
async function cargarMatriculas() {
  const res = await apiFetch('/admin/matriculas');
  if (res && res.ok && res.datos && Array.isArray(res.datos.matriculas)) {
    matriculas = res.datos.matriculas;
    return true;
  }
  mostrarAlerta('error', (res && res.datos && res.datos.mensaje) || 'No se pudieron cargar las matrículas.');
  return false;
}

async function cargarEstudiantes() {
  try {
    const res = await apiFetch('/admin/estudiantes');
    if (res && res.ok && res.datos && Array.isArray(res.datos.estudiantes)) {
      estudiantes = res.datos.estudiantes;
    }
  } catch (err) {
    console.error('Error al cargar los estudiantes:', err);
  }
}

async function cargarSalones() {
  try {
    const res = await apiFetch('/admin/salones');
    if (res && res.ok && res.datos && Array.isArray(res.datos.salones)) {
      salones = res.datos.salones;
    }
  } catch (err) {
    console.error('Error al cargar los salones:', err);
  }
}

// El nivel no viene en la matrícula: se busca en el salón (nombre + año)
function nivelDe(m) {
  const salon = salones.find(function (s) { return s.nombre === m.salon && s.anno === m.anno; });
  return salon ? salon.nivel : '—';
}

// ── 8. FECHA, TARJETAS Y FILTROS ────────────────────────────
function pintarFecha() {
  const texto = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  setTexto('texto-fecha', texto.charAt(0).toUpperCase() + texto.slice(1));
}

function pintarStats() {
  const contar = function (estado) {
    return matriculas.filter(function (m) { return m.estado === estado; }).length;
  };
  const pendientes = contar('pendiente');

  setTexto('stat-total', matriculas.length);
  setTexto('stat-pendientes', pendientes);
  setTexto('stat-aprobadas', contar('activa'));
  setTexto('stat-rechazadas', contar('cancelada'));

  const delta = document.getElementById('delta-pendientes');
  if (pendientes > 0) {
    delta.textContent = '\u26A0 Requiere revisión';
    delta.className = 'stat-delta alerta';
  } else {
    delta.textContent = 'Todo al día';
    delta.className = 'stat-delta neutro';
  }
}

function llenarFiltros() {
  const selNivel = document.getElementById('filtro-nivel');
  const selSalon = document.getElementById('filtro-salon');

  const niveles = [];
  const nombres = [];
  salones.forEach(function (s) {
    if (niveles.indexOf(s.nivel) === -1) niveles.push(s.nivel);
    if (nombres.indexOf(s.nombre) === -1) nombres.push(s.nombre);
  });

  niveles.forEach(function (n) {
    const op = crear('option', '', n);
    op.value = n;
    selNivel.appendChild(op);
  });
  nombres.forEach(function (n) {
    const op = crear('option', '', n);
    op.value = n;
    selSalon.appendChild(op);
  });
}

function filtrar() {
  const texto = document.getElementById('input-busqueda').value.trim().toLowerCase().replace(/^#/, '');
  const estado = document.getElementById('filtro-estado').value;
  const nivel = document.getElementById('filtro-nivel').value;
  const salon = document.getElementById('filtro-salon').value;

  return matriculas.filter(function (m) {
    if (estado !== 'todos' && m.estado !== estado) return false;
    if (nivel !== 'todos' && nivelDe(m) !== nivel) return false;
    if (salon !== 'todos' && m.salon !== salon) return false;
    if (texto) {
      const paja = (String(m.estudiante) + ' ' + String(m.salon) + ' ' + m.id).toLowerCase();
      if (paja.indexOf(texto) === -1) return false;
    }
    return true;
  });
}

// ── 9. TABLA ────────────────────────────────────────────────
function claseEstado(estado) {
  if (estado === 'pendiente') return 'badge-estado pendiente';
  if (estado === 'activa') return 'badge-estado aprobado activo';
  return 'badge-estado rechazado';
}

function textoEstado(estado) {
  if (estado === 'pendiente') return 'Pendiente';
  if (estado === 'activa') return 'Activa';
  return 'Cancelada';
}

function crearFila(m) {
  const tr = crear('tr', 'fila-matricula');

  tr.appendChild(crear('td', 'td-codigo', '#' + m.id));

  const tdAlumno = crear('td');
  const info = crear('div', 'alumno-info');
  info.appendChild(crear('div', 'avatar-mini', inicial(m.estudiante)));
  info.appendChild(document.createTextNode(m.estudiante));
  tdAlumno.appendChild(info);
  tr.appendChild(tdAlumno);

  tr.appendChild(crear('td', '', nivelDe(m)));
  tr.appendChild(crear('td', '', m.salon));

  const saldo = Number(m.saldo_pendiente) || 0;
  const tdSaldo = crear('td', '', saldo > 0 ? formatoPesos.format(saldo) : 'Pagada');
  tdSaldo.title = 'Valor total: ' + formatoPesos.format(Number(m.valor_total) || 0) +
                  ' \u00B7 Descuento: ' + formatoPesos.format(Number(m.descuento) || 0);
  tr.appendChild(tdSaldo);

  tr.appendChild(crear('td', '', fmtFecha(m.fecha_matricula)));

  const tdEstado = crear('td');
  tdEstado.appendChild(crear('span', claseEstado(m.estado), textoEstado(m.estado)));
  tr.appendChild(tdEstado);

  // Acciones según el estado actual
  const tdAccion = crear('td');
  const acciones = crear('div', 'acciones-fila');
  const botones = [];

  function agregarBoton(clase, texto, nuevoEstado) {
    const btn = crear('button', clase, texto);
    btn.addEventListener('click', function () { cambiarEstado(m, nuevoEstado, botones); });
    botones.push(btn);
    acciones.appendChild(btn);
  }

  if (m.estado === 'pendiente') {
    agregarBoton('btn-aprobar', 'Aprobar', 'activa');
    agregarBoton('btn-rechazar', 'Rechazar', 'cancelada');
  } else if (m.estado === 'activa') {
    agregarBoton('btn-rechazar', 'Cancelar', 'cancelada');
  } else {
    agregarBoton('btn-aprobar', 'Reactivar', 'activa');
  }

  // Registrar pago: solo si la matrícula no está cancelada y aún debe dinero
  if (m.estado !== 'cancelada' && saldo > 0) {
    const btnPago = crear('button', 'btn-aprobar', 'Registrar pago');
    btnPago.addEventListener('click', function () { abrirModalPago(m); });
    acciones.appendChild(btnPago);
  }

  const btnEditar = crear('button', 'btn-aprobar', 'Editar');
  btnEditar.addEventListener('click', function () { abrirModalEditar(m); });
  acciones.appendChild(btnEditar);

  const btnBorrar = crear('button', 'btn-rechazar', 'Eliminar');
  btnBorrar.addEventListener('click', function () { eliminarMatricula(m); });
  acciones.appendChild(btnBorrar);

  tdAccion.appendChild(acciones);
  tr.appendChild(tdAccion);

  return tr;
}

function pintarTabla() {
  const tbody = document.getElementById('tbody-matriculas');
  tbody.innerHTML = '';

  const filtradas = filtrar();
  const total = filtradas.length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  if (pagina > paginas) pagina = paginas;

  setTexto('badge-actividad', plural(total, 'resultado', 'resultados'));

  if (total === 0) {
    const tr = crear('tr');
    const td = crear('td', '', matriculas.length === 0
      ? 'Todavía no hay matrículas registradas.'
      : 'No se encontraron matrículas con esos filtros.');
    td.colSpan = 8;
    td.style.padding = '24px';
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
    setTexto('info-resultados', '');
    pintarPaginacion(1);
    return;
  }

  const inicio = (pagina - 1) * POR_PAGINA;
  const visibles = filtradas.slice(inicio, inicio + POR_PAGINA);
  visibles.forEach(function (m) { tbody.appendChild(crearFila(m)); });

  setTexto('info-resultados',
    'Mostrando ' + (inicio + 1) + '\u2013' + (inicio + visibles.length) + ' de ' + plural(total, 'matrícula', 'matrículas'));
  pintarPaginacion(paginas);
}

function pintarPaginacion(paginas) {
  const cont = document.getElementById('paginacion');
  cont.innerHTML = '';
  if (paginas <= 1) return;

  function boton(texto, destino, activo, desactivado) {
    const btn = crear('button', 'btn-pagina' + (activo ? ' activo' : ''), texto);
    btn.disabled = !!desactivado;
    btn.addEventListener('click', function () {
      pagina = destino;
      pintarTabla();
    });
    cont.appendChild(btn);
  }

  boton('\u2039', pagina - 1, false, pagina === 1);
  for (let p = 1; p <= paginas; p++) boton(String(p), p, p === pagina, false);
  boton('\u203A', pagina + 1, false, pagina === paginas);
}

// ── 10. CAMBIAR ESTADO DE UNA MATRÍCULA ─────────────────────
// Aprobar / Reactivar = "activa"; Rechazar / Cancelar = "cancelada"
async function cambiarEstado(matricula, nuevoEstado, botones) {
  if (nuevoEstado === 'cancelada' &&
      !confirm('¿Cancelar la matrícula de ' + matricula.estudiante + ' en ' + matricula.salon + '?')) {
    return;
  }

  botones.forEach(function (b) { b.disabled = true; });

  try {
    const res = await apiFetch('/admin/matriculas/' + matricula.id + '/estado', {
      method: 'PUT',
      body: { estado: nuevoEstado }
    });

    if (res && res.ok) {
      await cargarMatriculas();
      pintarStats();
      pintarTabla();
      mostrarAlerta('exito', nuevoEstado === 'activa'
        ? 'Matrícula de ' + matricula.estudiante + ' activada.'
        : 'Matrícula de ' + matricula.estudiante + ' cancelada.');
    } else {
      mostrarAlerta('error', (res && res.datos && res.datos.mensaje) || 'No se pudo actualizar la matrícula.');
      botones.forEach(function (b) { b.disabled = false; });
    }
  } catch (err) {
    console.error(err);
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
    botones.forEach(function (b) { b.disabled = false; });
  }
}

// ── 10B. REGISTRAR PAGO (modal) ─────────────────────────────
let matriculaPago = null;

function abrirModalPago(m) {
  matriculaPago = m;
  const saldo = Number(m.saldo_pendiente) || 0;

  setTexto('pago-estudiante', m.estudiante);
  setTexto('pago-salon', m.salon);
  setTexto('pago-saldo', formatoPesos.format(saldo));
  setTexto('pago-error', '');

  const inputMonto = document.getElementById('pago-monto');
  inputMonto.value = '';
  inputMonto.max = saldo;
  document.getElementById('pago-metodo').value = '';
  document.getElementById('pago-referencia').value = '';
  document.getElementById('btn-guardar-pago').disabled = false;

  document.getElementById('modal-pago').classList.add('abierto');
  inputMonto.focus();
}

function cerrarModalPago() {
  document.getElementById('modal-pago').classList.remove('abierto');
  matriculaPago = null;
}

async function enviarPago(e) {
  e.preventDefault();
  if (!matriculaPago) return;

  const saldo = Number(matriculaPago.saldo_pendiente) || 0;
  const monto = Number(document.getElementById('pago-monto').value);
  const metodo = document.getElementById('pago-metodo').value;
  const referencia = document.getElementById('pago-referencia').value.trim();

  // Validaciones en el navegador (el backend vuelve a validar)
  if (!monto || monto <= 0) {
    setTexto('pago-error', 'Escribe un monto mayor a 0.');
    return;
  }
  if (monto > saldo) {
    setTexto('pago-error', 'El monto no puede superar el saldo pendiente (' + formatoPesos.format(saldo) + ').');
    return;
  }
  if (!metodo) {
    setTexto('pago-error', 'Selecciona el método de pago.');
    return;
  }

  const cuerpo = { matricula_id: matriculaPago.id, monto: monto, metodo_pago: metodo };
  if (referencia) cuerpo.referencia_transaccion = referencia;

  const btnGuardar = document.getElementById('btn-guardar-pago');
  btnGuardar.disabled = true;
  setTexto('pago-error', '');

  try {
    const res = await apiFetch('/admin/pagos', { method: 'POST', body: cuerpo });

    if (res && res.ok) {
      const estudiante = matriculaPago.estudiante;
      cerrarModalPago();
      await cargarMatriculas();
      pintarStats();
      pintarTabla();
      mostrarAlerta('exito', 'Pago de ' + formatoPesos.format(monto) + ' registrado para ' + estudiante + '.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setTexto('pago-error', (res && res.datos && res.datos.mensaje) || 'No se pudo registrar el pago.');
      btnGuardar.disabled = false;
    }
  } catch (err) {
    console.error(err);
    setTexto('pago-error', 'No se pudo conectar con el servidor.');
    btnGuardar.disabled = false;
  }
}

// ── 10C. NUEVA MATRÍCULA (modal) ────────────────────────────
function abrirModalNueva() {
  const selEst = document.getElementById('nueva-estudiante');
  const selSal = document.getElementById('nueva-salon');
  selEst.innerHTML = '';
  selSal.innerHTML = '';

  const opEst = crear('option', '', 'Selecciona...');
  opEst.value = '';
  selEst.appendChild(opEst);
  estudiantes.filter(function (e) { return e.activo; }).forEach(function (e) {
    const op = crear('option', '', e.nombre_completo + ' (' + e.codigo_estudiante + ')');
    op.value = e.id;   // Estudiantes.id
    selEst.appendChild(op);
  });

  const opSal = crear('option', '', 'Selecciona...');
  opSal.value = '';
  selSal.appendChild(opSal);
  salones.filter(function (s) { return s.estado === 'activo'; }).forEach(function (s) {
    const op = crear('option', '', s.nombre + ' \u00B7 ' + s.nivel + ' \u00B7 ' + s.anno);
    op.value = s.id;
    selSal.appendChild(op);
  });

  setTexto('nueva-error', '');
  document.getElementById('btn-guardar-nueva').disabled = false;
  document.getElementById('modal-nueva').classList.add('abierto');
  selEst.focus();
}

function cerrarModalNueva() {
  document.getElementById('modal-nueva').classList.remove('abierto');
}

async function enviarNueva(e) {
  e.preventDefault();
  const estudianteId = Number(document.getElementById('nueva-estudiante').value);
  const salonId = Number(document.getElementById('nueva-salon').value);

  if (!estudianteId) { setTexto('nueva-error', 'Selecciona el estudiante.'); return; }
  if (!salonId) { setTexto('nueva-error', 'Selecciona el salón.'); return; }

  const btn = document.getElementById('btn-guardar-nueva');
  btn.disabled = true;
  setTexto('nueva-error', '');

  try {
    const res = await apiFetch('/admin/matriculas', {
      method: 'POST',
      body: { estudiante_id: estudianteId, salon_id: salonId }
    });

    if (res && res.ok) {
      cerrarModalNueva();
      await cargarMatriculas();
      pintarStats();
      pintarTabla();
      mostrarAlerta('exito', (res.datos && res.datos.mensaje) || 'Matrícula creada.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setTexto('nueva-error', (res && res.datos && res.datos.mensaje) || 'No se pudo crear la matrícula.');
      btn.disabled = false;
    }
  } catch (err) {
    console.error(err);
    setTexto('nueva-error', 'No se pudo conectar con el servidor.');
    btn.disabled = false;
  }
}

// ── 10D. EDITAR MATRÍCULA (descuento y observaciones) ───────
let matriculaEditando = null;

function abrirModalEditar(m) {
  matriculaEditando = m;
  setTexto('editar-estudiante', m.estudiante);
  setTexto('editar-salon', m.salon);
  setTexto('editar-total', formatoPesos.format(Number(m.valor_total) || 0));
  document.getElementById('editar-descuento').value = Number(m.descuento) || 0;
  document.getElementById('editar-observaciones').value = m.observaciones || '';
  setTexto('editar-error', '');
  document.getElementById('btn-guardar-editar').disabled = false;
  document.getElementById('modal-editar').classList.add('abierto');
  document.getElementById('editar-descuento').focus();
}

function cerrarModalEditar() {
  document.getElementById('modal-editar').classList.remove('abierto');
  matriculaEditando = null;
}

async function enviarEditar(e) {
  e.preventDefault();
  if (!matriculaEditando) return;

  const descuento = Number(document.getElementById('editar-descuento').value) || 0;
  const observaciones = document.getElementById('editar-observaciones').value.trim();

  if (descuento < 0) {
    setTexto('editar-error', 'El descuento no puede ser negativo.');
    return;
  }

  const btn = document.getElementById('btn-guardar-editar');
  btn.disabled = true;
  setTexto('editar-error', '');

  try {
    const res = await apiFetch('/admin/matriculas/' + matriculaEditando.id, {
      method: 'PUT',
      body: { descuento: descuento, observaciones: observaciones }
    });

    if (res && res.ok) {
      const estudiante = matriculaEditando.estudiante;
      cerrarModalEditar();
      await cargarMatriculas();
      pintarStats();
      pintarTabla();
      mostrarAlerta('exito', 'Matrícula de ' + estudiante + ' actualizada.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setTexto('editar-error', (res && res.datos && res.datos.mensaje) || 'No se pudo actualizar la matrícula.');
      btn.disabled = false;
    }
  } catch (err) {
    console.error(err);
    setTexto('editar-error', 'No se pudo conectar con el servidor.');
    btn.disabled = false;
  }
}

// ── 10E. ELIMINAR MATRÍCULA ─────────────────────────────────
async function eliminarMatricula(m) {
  if (!confirm('¿Eliminar definitivamente la matrícula de ' + m.estudiante + ' en ' + m.salon + '? Esta acción no se puede deshacer.')) {
    return;
  }
  try {
    const res = await apiFetch('/admin/matriculas/' + m.id, { method: 'DELETE' });
    if (res && res.ok) {
      await cargarMatriculas();
      pintarStats();
      pintarTabla();
      mostrarAlerta('exito', 'Matrícula de ' + m.estudiante + ' eliminada.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      mostrarAlerta('error', (res && res.datos && res.datos.mensaje) || 'No se pudo eliminar la matrícula.');
    }
  } catch (err) {
    console.error(err);
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
  }
}

// ── 11. EVENTOS ─────────────────────────────────────────────
document.getElementById('btn-abrir-modal').addEventListener('click', abrirModalNueva);
document.getElementById('form-nueva').addEventListener('submit', enviarNueva);
document.getElementById('btn-cerrar-nueva').addEventListener('click', cerrarModalNueva);
document.getElementById('btn-cancelar-nueva').addEventListener('click', cerrarModalNueva);
document.getElementById('modal-nueva').addEventListener('click', function (e) {
  if (e.target === this) cerrarModalNueva();
});
document.getElementById('form-pago').addEventListener('submit', enviarPago);
document.getElementById('btn-cerrar-pago').addEventListener('click', cerrarModalPago);
document.getElementById('btn-cancelar-pago').addEventListener('click', cerrarModalPago);
document.getElementById('modal-pago').addEventListener('click', function (e) {
  if (e.target === this) cerrarModalPago();   // clic en el fondo oscuro
});
document.getElementById('form-editar').addEventListener('submit', enviarEditar);
document.getElementById('btn-cerrar-editar').addEventListener('click', cerrarModalEditar);
document.getElementById('btn-cancelar-editar').addEventListener('click', cerrarModalEditar);
document.getElementById('modal-editar').addEventListener('click', function (e) {
  if (e.target === this) cerrarModalEditar();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { cerrarModalPago(); cerrarModalNueva(); cerrarModalEditar(); }
});

function alCambiarFiltro() {
  pagina = 1;
  pintarTabla();
}

document.getElementById('input-busqueda').addEventListener('input', alCambiarFiltro);
['filtro-estado', 'filtro-nivel', 'filtro-salon'].forEach(function (id) {
  document.getElementById(id).addEventListener('change', alCambiarFiltro);
});

document.getElementById('btn-reset-filtros').addEventListener('click', function () {
  document.getElementById('input-busqueda').value = '';
  document.getElementById('filtro-estado').value = 'todos';
  document.getElementById('filtro-nivel').value = 'todos';
  document.getElementById('filtro-salon').value = 'todos';
  alCambiarFiltro();
});

// Acciones rápidas: cada página abrirá su formulario al llegar con ?nuevo=1
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
async function iniciar() {
  pintarFecha();
  try {
    await Promise.all([cargarMatriculas(), cargarSalones(), cargarEstudiantes()]);
  } catch (err) {
    console.error('Error al cargar los datos:', err);
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
  }
  llenarFiltros();
  pintarStats();
  pintarTabla();
}

if (sesionValida) iniciar();