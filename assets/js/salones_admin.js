/* ============================================================
   salones_admin.js
   Instituto American Land
   Ubicación: assets/js/salones_admin.js
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

// ── 4. HELPER PARA LA API (GET, POST, PUT, DELETE) ──────────
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
function crear(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function porId(id) {
  return document.getElementById(id);
}

function setTexto(id, texto) {
  const el = porId(id);
  if (el) el.textContent = texto;
}

function plural(n, singular, pluralTexto) {
  return n + ' ' + (n === 1 ? singular : pluralTexto);
}

function mostrarAlerta(tipo, texto) {
  const alerta = porId('alerta');
  alerta.textContent = texto;
  alerta.className = 'aviso-salones ' + tipo + ' visible';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Las horas TIME llegan en UTC: "1970-01-01T18:00:00.000Z" -> "18:00"
function fmtHora(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  return d.getUTCHours() + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}

function textoHorario(h) {
  if (!h || !h.dias_semana || !h.hora_inicio || !h.hora_fin) return 'Sin horario';
  return String(h.dias_semana).split(',').join(', ') + ' ' + fmtHora(h.hora_inicio) + '\u2013' + fmtHora(h.hora_fin);
}

// "2026-11-30T00:00:00.000Z" -> "2026-11-30" (para <input type="date">)
function fechaParaInput(valor) {
  return valor ? String(valor).slice(0, 10) : '';
}

// ── 6. ESTADO DE LA PÁGINA ──────────────────────────────────
let salones = [];
let matriculas = [];
let niveles = [];
let docentes = [];
let horarios = [];
let salonEditando = null;     // null = nuevo; objeto = editar
let salonAEliminar = null;

const COLORES_BARRA = ['azul', 'morado', 'rojo', 'amarillo', 'verde'];
// Estados que ofrece el selector al editar, además de los que ya existan en los datos
const ESTADOS_BASE = ['activo', 'inactivo'];

// ── 7. CARGA DE DATOS ───────────────────────────────────────
async function cargarSalones() {
  const res = await apiFetch('/admin/salones');
  if (res && res.ok && res.datos && Array.isArray(res.datos.salones)) {
    salones = res.datos.salones;
    return true;
  }
  mostrarAlerta('error', (res && res.datos && res.datos.mensaje) || 'No se pudieron cargar los salones.');
  return false;
}

// Cada carga auxiliar falla por separado sin romper la página
async function cargarLista(ruta, clave) {
  try {
    const res = await apiFetch(ruta);
    if (res && res.ok && res.datos && Array.isArray(res.datos[clave])) return res.datos[clave];
  } catch (err) {
    console.error('Error al cargar ' + ruta + ':', err);
  }
  return [];
}

async function cargarAuxiliares() {
  const r = await Promise.all([
    cargarLista('/admin/matriculas', 'matriculas'),
    cargarLista('/admin/niveles', 'niveles'),
    cargarLista('/admin/docentes', 'docentes'),
    cargarLista('/admin/horarios-tipo', 'horarios')
  ]);
  matriculas = r[0];
  niveles = r[1];
  docentes = r[2];
  horarios = r[3];
}

// Cupos ocupados: matrículas pendientes o activas (igual que valida el backend)
function ocupadosDe(s) {
  return matriculas.filter(function (m) {
    return m.salon === s.nombre && m.anno === s.anno && (m.estado === 'pendiente' || m.estado === 'activa');
  }).length;
}

function colorDeNivel(nombreNivel) {
  const i = niveles.findIndex(function (n) { return n.nombre === nombreNivel; });
  return COLORES_BARRA[(i < 0 ? 0 : i) % COLORES_BARRA.length];
}

// ── 8. FILTROS ──────────────────────────────────────────────
function llenarFiltros() {
  const selNivel = porId('filtro-nivel');
  const selEstado = porId('filtro-estado');

  const nombresNivel = [];
  niveles.forEach(function (n) { nombresNivel.push(n.nombre); });
  salones.forEach(function (s) {
    if (nombresNivel.indexOf(s.nivel) === -1) nombresNivel.push(s.nivel);
  });
  nombresNivel.forEach(function (n) {
    const op = crear('option', '', n);
    op.value = n;
    selNivel.appendChild(op);
  });

  const estados = [];
  salones.forEach(function (s) {
    if (s.estado && estados.indexOf(s.estado) === -1) estados.push(s.estado);
  });
  estados.forEach(function (e) {
    const op = crear('option', '', e.charAt(0).toUpperCase() + e.slice(1));
    op.value = e;
    selEstado.appendChild(op);
  });
}

function filtrar() {
  const texto = porId('filtro-busqueda').value.trim().toLowerCase();
  const nivel = porId('filtro-nivel').value;
  const estado = porId('filtro-estado').value;

  return salones.filter(function (s) {
    if (nivel !== 'todos' && s.nivel !== nivel) return false;
    if (estado !== 'todos' && s.estado !== estado) return false;
    if (texto) {
      const paja = (String(s.nombre) + ' ' + String(s.docente)).toLowerCase();
      if (paja.indexOf(texto) === -1) return false;
    }
    return true;
  });
}

// ── 9. TARJETAS DE ARRIBA ───────────────────────────────────
function pintarStats() {
  let cupos = 0;
  let ocupados = 0;
  let llenos = 0;
  let activos = 0;

  salones.forEach(function (s) {
    const oc = ocupadosDe(s);
    cupos += Number(s.capacidad_max) || 0;
    ocupados += oc;
    if (s.capacidad_max && oc >= s.capacidad_max) llenos++;
    if (s.estado === 'activo') activos++;
  });

  setTexto('stat-total', salones.length);
  setTexto('stat-activos', activos);
  setTexto('stat-capacidad', ocupados);
  setTexto('stat-capacidad-detalle', 'de ' + cupos + ' cupos');
  setTexto('stat-revision', llenos);
  setTexto('texto-resumen', plural(salones.length, 'salón registrado', 'salones registrados') +
    ' \u00B7 ' + plural(activos, 'activo', 'activos'));
}

// ── 10. TARJETAS DE SALONES ─────────────────────────────────
function crearTarjeta(s) {
  const ocupados = ocupadosDe(s);
  const capacidad = Number(s.capacidad_max) || 0;
  const pct = capacidad > 0 ? Math.min(100, Math.round(ocupados / capacidad * 100)) : 0;

  const tarjeta = crear('div', 'salon-tarjeta');
  tarjeta.appendChild(crear('div', 'salon-tarjeta-barra ' + colorDeNivel(s.nivel)));

  const cuerpo = crear('div', 'salon-tarjeta-cuerpo');

  const top = crear('div', 'salon-tarjeta-top');
  const titulos = crear('div');
  titulos.appendChild(crear('div', 'salon-tarjeta-nombre', s.nombre));
  titulos.appendChild(crear('div', 'salon-tarjeta-nivel', s.nivel + ' \u00B7 ' + s.anno));
  top.appendChild(titulos);
  top.appendChild(crear('span', 'salon-estado ' + (s.estado === 'activo' ? 'activo' : 'otro'), s.estado || '\u2014'));
  cuerpo.appendChild(top);

  cuerpo.appendChild(crear('div', 'salon-tarjeta-horario', '\uD83D\uDD52 ' + textoHorario(s)));
  cuerpo.appendChild(crear('div', 'salon-tarjeta-horario', '\uD83D\uDC68\u200D\uD83C\uDFEB ' + (s.docente || 'Sin docente')));
  cuerpo.appendChild(crear('div', 'salon-tarjeta-horario', '\uD83D\uDD04 Ciclo actual: ' + (s.ciclo_actual === null || s.ciclo_actual === undefined ? '\u2014' : s.ciclo_actual)));

  const cap = crear('div', 'salon-tarjeta-capacidad');
  const capTexto = crear('div', 'salon-tarjeta-capacidad-texto');
  capTexto.appendChild(crear('span', '', 'Cupos'));
  capTexto.appendChild(crear('span', '', ocupados + ' / ' + capacidad));
  cap.appendChild(capTexto);
  const barra = crear('div', 'barra-capacidad');
  const fill = crear('div', 'barra-capacidad-fill ' + (pct >= 100 ? 'llena' : pct >= 70 ? 'media' : 'ok'));
  fill.style.width = pct + '%';
  barra.appendChild(fill);
  cap.appendChild(barra);
  cuerpo.appendChild(cap);

  tarjeta.appendChild(cuerpo);

  const pie = crear('div', 'salon-tarjeta-footer');
  pie.appendChild(crear('span', 'salon-tarjeta-horario', 'ID #' + s.id));
  const acciones = crear('div', 'salon-tarjeta-acciones');
  const btnEditar = crear('button', 'btn-editar-salon', 'Editar');
  btnEditar.addEventListener('click', function () { abrirModalSalon(s); });
  const btnEliminar = crear('button', 'btn-eliminar-salon', 'Eliminar');
  btnEliminar.addEventListener('click', function () { pedirEliminar(s); });
  acciones.appendChild(btnEditar);
  acciones.appendChild(btnEliminar);
  pie.appendChild(acciones);
  tarjeta.appendChild(pie);

  return tarjeta;
}

function pintarGrid() {
  const grid = porId('grid-salones');
  grid.innerHTML = '';

  const lista = filtrar();
  setTexto('badge-resultados', plural(lista.length, 'resultado', 'resultados'));

  const vacio = porId('mensaje-vacio');
  if (lista.length === 0) {
    vacio.textContent = salones.length === 0
      ? 'Todavía no hay salones registrados.'
      : 'No se encontraron salones con los filtros seleccionados.';
    vacio.style.display = 'block';
    return;
  }
  vacio.style.display = 'none';
  lista.forEach(function (s) { grid.appendChild(crearTarjeta(s)); });
}

async function recargar() {
  await Promise.all([cargarSalones(), cargarLista('/admin/matriculas', 'matriculas').then(function (m) { matriculas = m; })]);
  pintarStats();
  pintarGrid();
}

// ── 11. MODAL NUEVO / EDITAR ────────────────────────────────
function llenarSelect(id, items, valor, texto) {
  const sel = porId(id);
  sel.innerHTML = '';
  const op0 = crear('option', '', 'Selecciona...');
  op0.value = '';
  sel.appendChild(op0);
  items.forEach(function (it) {
    const op = crear('option', '', texto(it));
    op.value = valor(it);
    sel.appendChild(op);
  });
}

function llenarSelectoresCreacion() {
  llenarSelect('salon-docente', docentes.filter(function (d) { return d.activo; }),
    function (d) { return d.id; },
    function (d) { return d.nombre_completo + (d.especialidad ? ' \u2014 ' + d.especialidad : ''); });
  llenarSelect('salon-nivel', niveles,
    function (n) { return n.id; },
    function (n) { return n.nombre; });
  llenarSelect('salon-horario', horarios,
    function (h) { return h.id; },
    function (h) { return textoHorario(h); });
}

function llenarSelectEstado(actual) {
  const estados = ESTADOS_BASE.slice();
  salones.forEach(function (s) {
    if (s.estado && estados.indexOf(s.estado) === -1) estados.push(s.estado);
  });
  const sel = porId('salon-estado');
  sel.innerHTML = '';
  estados.forEach(function (e) {
    const op = crear('option', '', e.charAt(0).toUpperCase() + e.slice(1));
    op.value = e;
    sel.appendChild(op);
  });
  sel.value = actual || 'activo';
}

function abrirModalSalon(salon) {
  salonEditando = salon || null;
  const editando = !!salonEditando;

  setTexto('modal-titulo', editando ? 'Editar Salón' : 'Nuevo Salón');
  setTexto('btn-guardar-salon', editando ? 'Guardar Cambios' : 'Guardar Salón');
  setTexto('salon-error', '');

  porId('grupo-asignacion').style.display = editando ? 'none' : '';
  porId('grupo-ciclo').style.display = editando ? '' : 'none';
  porId('grupo-estado').style.display = editando ? '' : 'none';
  porId('nota-edicion').style.display = editando ? 'block' : 'none';

  if (editando) {
    porId('salon-id').value = salon.id;
    porId('salon-nombre').value = salon.nombre || '';
    porId('salon-capacidad').value = salon.capacidad_max || '';
    porId('salon-ciclo').value = salon.ciclo_actual || 1;
    porId('salon-inicio').value = fechaParaInput(salon.fecha_inicio);
    porId('salon-fin').value = fechaParaInput(salon.fecha_fin);
    llenarSelectEstado(salon.estado);
  } else {
    porId('salon-id').value = '';
    porId('salon-nombre').value = '';
    porId('salon-capacidad').value = 15;
    porId('salon-ciclo').value = 1;
    porId('salon-inicio').value = '';
    porId('salon-fin').value = '';
    porId('salon-anno').value = new Date().getFullYear();
    llenarSelectoresCreacion();
  }

  porId('btn-guardar-salon').disabled = false;
  porId('modal-overlay').classList.add('activo');
  porId('salon-nombre').focus();
}

function cerrarModalSalon() {
  porId('modal-overlay').classList.remove('activo');
  salonEditando = null;
}

async function guardarSalon(e) {
  e.preventDefault();
  setTexto('salon-error', '');

  const nombreSalon = porId('salon-nombre').value.trim();
  const capacidad = Number(porId('salon-capacidad').value);
  const inicio = porId('salon-inicio').value;
  const fin = porId('salon-fin').value;

  // Validaciones en el navegador (el backend vuelve a validar)
  if (!nombreSalon) { setTexto('salon-error', 'Escribe el nombre del salón.'); return; }
  if (!capacidad || capacidad < 1) { setTexto('salon-error', 'La capacidad debe ser al menos 1.'); return; }
  if (inicio && fin && fin < inicio) { setTexto('salon-error', 'La fecha de fin no puede ser anterior a la de inicio.'); return; }

  let ruta, metodo, cuerpo;

  if (salonEditando) {
    const ciclo = Number(porId('salon-ciclo').value);
    if (!ciclo || ciclo < 1) { setTexto('salon-error', 'El ciclo actual debe ser al menos 1.'); return; }
    // El PUT guarda NULL en lo que falte: se envían todos los campos
    ruta = '/admin/salones/' + salonEditando.id;
    metodo = 'PUT';
    cuerpo = {
      nombre: nombreSalon,
      capacidad_max: capacidad,
      estado: porId('salon-estado').value,
      ciclo_actual: ciclo,
      fecha_inicio: inicio || null,
      fecha_fin: fin || null
    };
  } else {
    const docenteId = Number(porId('salon-docente').value);
    const nivelId = Number(porId('salon-nivel').value);
    const horarioId = Number(porId('salon-horario').value);
    const anno = Number(porId('salon-anno').value);

    if (!docenteId) { setTexto('salon-error', 'Selecciona el docente.'); return; }
    if (!nivelId) { setTexto('salon-error', 'Selecciona el nivel.'); return; }
    if (!horarioId) { setTexto('salon-error', 'Selecciona el horario.'); return; }
    if (!anno) { setTexto('salon-error', 'Escribe el año.'); return; }

    ruta = '/admin/salones';
    metodo = 'POST';
    cuerpo = {
      docente_id: docenteId,       // Docentes.id
      nivel_id: nivelId,
      horario_tipo_id: horarioId,
      nombre: nombreSalon,
      capacidad_max: capacidad,
      anno: anno
    };
    if (inicio) cuerpo.fecha_inicio = inicio;
    if (fin) cuerpo.fecha_fin = fin;
  }

  const btn = porId('btn-guardar-salon');
  btn.disabled = true;

  try {
    const editando = !!salonEditando;
    const res = await apiFetch(ruta, { method: metodo, body: cuerpo });

    if (res && res.ok) {
      cerrarModalSalon();
      await recargar();
      mostrarAlerta('exito', 'Salón ' + nombreSalon + (editando ? ' actualizado correctamente.' : ' creado correctamente.'));
    } else {
      setTexto('salon-error', (res && res.datos && res.datos.mensaje) || 'No se pudo guardar el salón.');
      btn.disabled = false;
    }
  } catch (err) {
    console.error(err);
    setTexto('salon-error', 'No se pudo conectar con el servidor.');
    btn.disabled = false;
  }
}

// ── 12. ELIMINAR ────────────────────────────────────────────
function pedirEliminar(s) {
  salonAEliminar = s;
  setTexto('nombre-a-eliminar', s.nombre);
  porId('btn-confirmar-eliminar').disabled = false;
  porId('modal-eliminar').classList.add('activo');
}

function cerrarModalEliminar() {
  porId('modal-eliminar').classList.remove('activo');
  salonAEliminar = null;
}

async function confirmarEliminar() {
  if (!salonAEliminar) return;
  const salon = salonAEliminar;
  const btn = porId('btn-confirmar-eliminar');
  btn.disabled = true;

  try {
    const res = await apiFetch('/admin/salones/' + salon.id, { method: 'DELETE' });
    cerrarModalEliminar();
    if (res && res.ok) {
      await recargar();
      mostrarAlerta('exito', 'Salón ' + salon.nombre + ' eliminado.');
    } else {
      mostrarAlerta('error', (res && res.datos && res.datos.mensaje) || 'No se pudo eliminar el salón.');
    }
  } catch (err) {
    console.error(err);
    cerrarModalEliminar();
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
  }
}

// ── 13. EVENTOS ─────────────────────────────────────────────
// Mensaje de error dentro del modal (el HTML no trae uno)
(function crearZonaError() {
  const p = crear('p', 'modal-nota');
  p.id = 'salon-error';
  p.style.color = 'var(--rojo)';
  p.style.minHeight = '1em';
  const pie = porId('form-salon').querySelector('.modal-footer');
  porId('form-salon').insertBefore(p, pie);
})();

porId('filtro-busqueda').addEventListener('input', pintarGrid);
porId('filtro-nivel').addEventListener('change', pintarGrid);
porId('filtro-estado').addEventListener('change', pintarGrid);

porId('btn-nuevo-salon-header').addEventListener('click', function () { abrirModalSalon(); });
porId('sb-nuevo-salon').addEventListener('click', function () { abrirModalSalon(); });
porId('modal-cerrar').addEventListener('click', cerrarModalSalon);
porId('btn-cancelar').addEventListener('click', cerrarModalSalon);
porId('form-salon').addEventListener('submit', guardarSalon);
porId('modal-overlay').addEventListener('click', function (e) {
  if (e.target === this) cerrarModalSalon();
});

porId('eliminar-cerrar').addEventListener('click', cerrarModalEliminar);
porId('btn-cancelar-eliminar').addEventListener('click', cerrarModalEliminar);
porId('btn-confirmar-eliminar').addEventListener('click', confirmarEliminar);
porId('modal-eliminar').addEventListener('click', function (e) {
  if (e.target === this) cerrarModalEliminar();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    cerrarModalSalon();
    cerrarModalEliminar();
  }
});

// Acciones rápidas hacia las otras páginas
porId('sb-nuevo-alumno').addEventListener('click', function () {
  window.location.href = 'alumnos.html?nuevo=1';
});
porId('sb-nuevo-docente').addEventListener('click', function () {
  window.location.href = 'docentes.html?nuevo=1';
});

// ── 14. ARRANCAR ────────────────────────────────────────────
async function iniciar() {
  try {
    await Promise.all([cargarSalones(), cargarAuxiliares()]);
  } catch (err) {
    console.error('Error al cargar los datos:', err);
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
  }
  llenarFiltros();
  pintarStats();
  pintarGrid();

  // Llegó desde "Nuevo Salón": abrir el modal y limpiar la URL
  const params = new URLSearchParams(window.location.search);
  if (params.get('nuevo') === '1') {
    abrirModalSalon();
    window.history.replaceState({}, '', window.location.pathname);
  }
}

if (sesionValida) iniciar();