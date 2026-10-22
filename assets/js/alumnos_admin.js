/* ============================================================
   alumnos_admin.js
   Instituto American Land
   Ubicación: assets/js/alumnos_admin.js
============================================================ */

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

// ── 1. VERIFICAR SESIÓN ─────────────────────────────────────
const token = sessionStorage.getItem('token');
const rol   = sessionStorage.getItem('rol');
// Admin y secretaría comparten esta página (panel_roles.js ajusta el menú)
const sesionValida = !!token && (rol === 'admin' || rol === 'secretaria');

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

function inicial(texto) {
  return String(texto || '?').trim().charAt(0).toUpperCase();
}

function plural(n, singular, pluralTexto) {
  return n + ' ' + (n === 1 ? singular : pluralTexto);
}

// "2026-10-09T11:23:18.393Z" -> "9 Oct 2026" (en UTC para que no se corra un día)
function fmtFecha(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  return d.getUTCDate() + ' ' + MESES[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

// Texto gris pequeño (ej. "Sin matrícula" o "pago pendiente")
function textoSuave(texto) {
  const s = crear('span', '', texto);
  s.style.color = 'var(--gris-texto)';
  s.style.fontSize = '0.78rem';
  s.style.fontStyle = 'italic';
  return s;
}

// Este CSS no tiene clases de alerta, así que los estilos se ponen aquí
function mostrarAlerta(tipo, texto) {
  const alerta = porId('alerta');
  alerta.textContent = texto;
  alerta.style.padding = '12px 16px';
  alerta.style.borderRadius = '10px';
  alerta.style.marginBottom = '16px';
  alerta.style.fontSize = '0.85rem';
  alerta.style.fontWeight = '600';
  if (tipo === 'exito') {
    alerta.style.background = 'rgba(39,174,96,0.12)';
    alerta.style.color = 'var(--verde)';
    alerta.style.border = '1px solid rgba(39,174,96,0.3)';
  } else {
    alerta.style.background = 'rgba(192,57,43,0.1)';
    alerta.style.color = 'var(--rojo)';
    alerta.style.border = '1px solid rgba(192,57,43,0.3)';
  }
  alerta.classList.remove('oculto');
}

function ocultarAlerta() {
  porId('alerta').classList.add('oculto');
}

// ── 6. ESTADO DE LA PÁGINA ──────────────────────────────────
let alumnos = [];                 // usuarios con rol "estudiante"
let filtroEstado = 'todos';       // todos | activo | inactivo | pendiente
let filtroNivel = 'todos';        // todos | nombre del nivel | sin (sin matrícula)
let orden = { col: 'nombre', dir: 'asc' };
let vista = 'tabla';              // tabla | cards
let alumnoADesactivar = null;
let alumnoABorrar = null;
let alumnoEditando = null;        // null = agregar; objeto = editar
let codigos = {};                 // usuario_id -> codigo_estudiante
let matriculaDe = {};             // usuario_id -> { nivel, salon, estado } de su matrícula vigente

function estadoDe(a) {
  return a.activo ? 'activo' : 'inactivo';
}

// Matrícula activa (o, si no hay, la pendiente más reciente); null si no tiene
function matricula(a) {
  return matriculaDe[a.id] || null;
}

// ── 7. CARGA DE DATOS ───────────────────────────────────────
async function cargarAlumnos() {
  const res = await apiFetch('/admin/usuarios');
  if (res && res.ok && res.datos && Array.isArray(res.datos.usuarios)) {
    alumnos = res.datos.usuarios.filter(function (u) { return u.rol === 'estudiante'; });
    await cargarCodigos();
    return true;
  }
  mostrarAlerta('error', (res && res.datos && res.datos.mensaje) || 'No se pudieron cargar los alumnos.');
  return false;
}

// Código, nivel y salón vienen de GET /admin/estudiantes (se cruzan por usuario_id)
async function cargarCodigos() {
  try {
    const res = await apiFetch('/admin/estudiantes');
    codigos = {};
    matriculaDe = {};
    if (res && res.ok && res.datos && Array.isArray(res.datos.estudiantes)) {
      res.datos.estudiantes.forEach(function (e) {
        codigos[e.usuario_id] = e.codigo_estudiante;
        if (e.estado_matricula) {
          matriculaDe[e.usuario_id] = { nivel: e.nivel, salon: e.salon, estado: e.estado_matricula };
        }
      });
    }
  } catch (err) {
    console.error('Error al cargar los datos de los estudiantes:', err);
  }
  pintarFiltrosNivel();
}

// Botones del filtro por nivel: los niveles que tienen alumnos matriculados + "Sin matrícula"
function pintarFiltrosNivel() {
  const niveles = [];
  Object.keys(matriculaDe).forEach(function (id) {
    const n = matriculaDe[id].nivel;
    if (n && niveles.indexOf(n) === -1) niveles.push(n);
  });
  niveles.sort(function (a, b) { return a.localeCompare(b, 'es'); });
  if (filtroNivel !== 'todos' && filtroNivel !== 'sin' && niveles.indexOf(filtroNivel) === -1) filtroNivel = 'todos';

  const lista = porId('filtros-nivel');
  lista.innerHTML = '';
  [['todos', 'Todos los niveles']]
    .concat(niveles.map(function (n) { return [n, n]; }))
    .concat([['sin', 'Sin matrícula']])
    .forEach(function (op) {
      const li = crear('li');
      const btn = crear('button', 'filtro-sb' + (filtroNivel === op[0] ? ' activo' : ''), op[1]);
      btn.type = 'button';
      btn.dataset.nivel = op[0];
      btn.addEventListener('click', function () {
        filtroNivel = op[0];
        lista.querySelectorAll('.filtro-sb').forEach(function (b) { b.classList.toggle('activo', b === btn); });
        pintarLista();
      });
      li.appendChild(btn);
      lista.appendChild(li);
    });
}

// ── 8. FILTRAR Y ORDENAR ────────────────────────────────────
function filtrar() {
  const texto = porId('input-busqueda').value.trim().toLowerCase();

  const lista = alumnos.filter(function (a) {
    const m = matricula(a);
    if (filtroEstado === 'pendiente') {
      if (!m || m.estado !== 'pendiente') return false;
    } else if (filtroEstado !== 'todos' && estadoDe(a) !== filtroEstado) {
      return false;
    }
    if (filtroNivel === 'sin' && m) return false;
    if (filtroNivel !== 'todos' && filtroNivel !== 'sin' && (!m || m.nivel !== filtroNivel)) return false;
    if (texto) {
      const paja = (String(a.nombre_completo) + ' ' + String(a.correo) + ' ' + String(codigos[a.id] || '') + ' ' +
        (m ? String(m.nivel) + ' ' + String(m.salon) : '')).toLowerCase();
      if (paja.indexOf(texto) === -1) return false;
    }
    return true;
  });

  const factor = orden.dir === 'asc' ? 1 : -1;
  lista.sort(function (a, b) {
    if (orden.col === 'ingreso') {
      return (new Date(a.creado_en) - new Date(b.creado_en)) * factor;
    }
    return String(a.nombre_completo).localeCompare(String(b.nombre_completo), 'es') * factor;
  });

  return lista;
}

// ── 9. PINTAR STATS ─────────────────────────────────────────
function pintarStats() {
  const activos = alumnos.filter(function (a) { return a.activo; }).length;
  const pendientes = alumnos.filter(function (a) { const m = matricula(a); return m && m.estado === 'pendiente'; }).length;
  setTexto('sm-activos', activos);
  setTexto('sm-inactivos', alumnos.length - activos);
  setTexto('sm-pendientes', pendientes);
  setTexto('sm-total', alumnos.length);
  setTexto('texto-conteo', plural(alumnos.length, 'alumno registrado', 'alumnos registrados') +
    ' \u00B7 ' + plural(activos, 'activo', 'activos'));
}

// ── 10. TABLA Y TARJETAS ────────────────────────────────────
function crearBadgeEstado(a) {
  const estado = estadoDe(a);
  return crear('span', 'badge-estado ' + estado, estado === 'activo' ? 'Activo' : 'Inactivo');
}

function crearBotonEditar(a) {
  const btn = crear('button', 'btn-editar-fila', 'Editar');
  btn.addEventListener('click', function () { abrirModalAlumno(a); });
  return btn;
}

// Botón de acción: Desactivar (pide confirmar) o Activar (directo)
function crearBotonAccion(a) {
  if (a.activo) {
    const btn = crear('button', 'btn-eliminar-fila', 'Desactivar');
    btn.addEventListener('click', function () { pedirDesactivar(a); });
    return btn;
  }
  const btn = crear('button', 'btn-editar-fila', 'Activar');
  btn.addEventListener('click', function () { cambiarEstado(a, true, btn); });
  return btn;
}

function crearBotonBorrar(a) {
  const btn = crear('button', 'btn-eliminar-fila', 'Eliminar');
  btn.addEventListener('click', function () { pedirBorrar(a); });
  return btn;
}

function crearFila(a) {
  const tr = crear('tr');

  const tdAlumno = crear('td');
  const info = crear('div', 'alumno-info');
  info.appendChild(crear('div', 'avatar-alumno', inicial(a.nombre_completo)));
  const textos = crear('div');
  textos.appendChild(crear('div', 'alumno-nombre', a.nombre_completo));
  textos.appendChild(crear('div', 'alumno-correo', a.correo));
  info.appendChild(textos);
  tdAlumno.appendChild(info);
  tr.appendChild(tdAlumno);

  const tdMat = crear('td', 'td-matricula', codigos[a.id] || '—');
  tr.appendChild(tdMat);

  // Nivel y salón de la matrícula vigente (activa o pendiente de pago)
  const m = matricula(a);
  const tdNivel = crear('td');
  if (m) tdNivel.textContent = m.nivel;
  else tdNivel.appendChild(textoSuave('Sin matrícula'));
  tr.appendChild(tdNivel);

  const tdSalon = crear('td', '', m ? m.salon : '—');
  if (m && m.estado === 'pendiente') {
    tdSalon.appendChild(crear('br'));
    tdSalon.appendChild(textoSuave('pago pendiente'));
  }
  tr.appendChild(tdSalon);

  tr.appendChild(crear('td', '', a.telefono || '—'));
  tr.appendChild(crear('td', '', fmtFecha(a.creado_en)));

  const tdEstado = crear('td');
  tdEstado.appendChild(crearBadgeEstado(a));
  tr.appendChild(tdEstado);

  const tdAcc = crear('td');
  const btns = crear('div', 'btns-accion');
  btns.appendChild(crearBotonEditar(a));
  btns.appendChild(crearBotonAccion(a));
  btns.appendChild(crearBotonBorrar(a));
  tdAcc.appendChild(btns);
  tr.appendChild(tdAcc);

  return tr;
}

function crearLineaCard(etiqueta, valor) {
  const linea = crear('span');
  linea.appendChild(document.createTextNode(etiqueta + ': '));
  linea.appendChild(crear('strong', '', valor));
  return linea;
}

function crearCard(a) {
  const card = crear('div', 'alumno-card');

  const cabecera = crear('div', 'card-avatar-wrap');
  cabecera.appendChild(crear('div', 'card-avatar', inicial(a.nombre_completo)));
  const textos = crear('div');
  textos.appendChild(crear('div', 'card-nombre', a.nombre_completo));
  textos.appendChild(crear('div', 'card-correo', a.correo));
  cabecera.appendChild(textos);
  card.appendChild(cabecera);

  const datos = crear('div', 'card-data');
  const m = matricula(a);
  datos.appendChild(crearLineaCard('Matrícula', codigos[a.id] || '—'));
  datos.appendChild(crearLineaCard('Nivel', m ? m.nivel : 'Sin matrícula'));
  datos.appendChild(crearLineaCard('Salón', m ? m.salon + (m.estado === 'pendiente' ? ' (pago pendiente)' : '') : '—'));
  datos.appendChild(crearLineaCard('Teléfono', a.telefono || '—'));
  datos.appendChild(crearLineaCard('Ingreso', fmtFecha(a.creado_en)));
  card.appendChild(datos);

  const pie = crear('div', 'card-footer');
  pie.appendChild(crearBadgeEstado(a));
  const btns = crear('div', 'card-btns');
  btns.appendChild(crearBotonEditar(a));
  btns.appendChild(crearBotonAccion(a));
  btns.appendChild(crearBotonBorrar(a));
  pie.appendChild(btns);
  card.appendChild(pie);

  return card;
}

function pintarLista() {
  const lista = filtrar();
  const tbody = porId('tbody-alumnos');
  const cards = porId('seccion-cards');
  tbody.innerHTML = '';
  cards.innerHTML = '';

  setTexto('badge-resultados', plural(lista.length, 'resultado', 'resultados'));

  // Mensaje de "sin resultados"
  const sinRes = porId('sin-resultados');
  const textoSin = sinRes.querySelector('p');
  if (alumnos.length === 0) {
    textoSin.textContent = 'Todavía no hay alumnos registrados.';
  } else {
    textoSin.textContent = 'No se encontraron alumnos con ese criterio.';
  }

  if (lista.length === 0) {
    if (vista === 'tabla') {
      sinRes.classList.remove('oculto');
    } else {
      sinRes.classList.add('oculto');
      cards.appendChild(crear('p', '', textoSin.textContent));
    }
  } else {
    sinRes.classList.add('oculto');
    lista.forEach(function (a) {
      tbody.appendChild(crearFila(a));
      cards.appendChild(crearCard(a));
    });
  }

  // Iconos de orden en los encabezados
  document.querySelectorAll('.th-sort').forEach(function (th) {
    const icono = th.querySelector('.sort-icon');
    if (!icono) return;
    if (th.dataset.col === orden.col) {
      icono.textContent = orden.dir === 'asc' ? '\u2191' : '\u2193';
    } else {
      icono.textContent = '\u2195';
    }
  });

  porId('btn-limpiar').classList.toggle('oculto', porId('input-busqueda').value === '');
}

function aplicarVista() {
  const esTabla = vista === 'tabla';
  porId('seccion-tabla').classList.toggle('oculto', !esTabla);
  porId('seccion-cards').classList.toggle('oculto', esTabla);
  porId('btn-vista-tabla').classList.toggle('activo', esTabla);
  porId('btn-vista-cards').classList.toggle('activo', !esTabla);
  pintarLista();
}

// ── 11. ACTIVAR / DESACTIVAR ────────────────────────────────
function pedirDesactivar(a) {
  alumnoADesactivar = a;
  setTexto('nombre-a-eliminar', a.nombre_completo);
  porId('modal-eliminar').classList.remove('oculto');
}

function cerrarModalDesactivar() {
  porId('modal-eliminar').classList.add('oculto');
  alumnoADesactivar = null;
}

async function cambiarEstado(a, activo, boton) {
  if (boton) boton.disabled = true;

  try {
    const res = await apiFetch('/admin/usuarios/' + a.id + '/estado', {
      method: 'PUT',
      body: { activo: activo }
    });

    if (res && res.ok) {
      await cargarAlumnos();
      pintarStats();
      pintarLista();
      mostrarAlerta('exito', activo
        ? a.nombre_completo + ' fue activado.'
        : a.nombre_completo + ' fue desactivado.');
      return true;
    }
    mostrarAlerta('error', (res && res.datos && res.datos.mensaje) || 'No se pudo cambiar el estado del alumno.');
  } catch (err) {
    console.error(err);
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
  }

  if (boton) boton.disabled = false;
  return false;
}
function pedirBorrar(a) {
  alumnoABorrar = a;
  setTexto('nombre-a-borrar', a.nombre_completo);
  porId('modal-borrar').classList.remove('oculto');
}

function cerrarModalBorrar() {
  porId('modal-borrar').classList.add('oculto');
  alumnoABorrar = null;
}

async function borrarAlumno(a) {
  try {
    const res = await apiFetch('/admin/usuarios/' + a.id, { method: 'DELETE' });
    if (res && res.ok) {
      await cargarAlumnos();
      pintarStats();
      pintarLista();
      mostrarAlerta('exito', a.nombre_completo + ' fue eliminado.');
      return;
    }
    mostrarAlerta('error', (res && res.datos && res.datos.mensaje) || 'No se pudo eliminar el alumno.');
  } catch (err) {
    console.error(err);
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
  }
}
// ── 12. MODAL: AGREGAR ALUMNO ───────────────────────────────
const CAMPOS_MODAL = ['m-nombre', 'm-correo', 'm-contrasena', 'm-telefono', 'm-fecha-nac', 'm-pais', 'm-ciudad'];
const ERRORES_MODAL = ['e-nombre', 'e-correo', 'e-contrasena', 'e-telefono', 'e-fecha-nac', 'e-general'];

function limpiarErroresModal() {
  ERRORES_MODAL.forEach(function (id) { setTexto(id, ''); });
  CAMPOS_MODAL.forEach(function (id) { porId(id).classList.remove('invalido'); });
}

function abrirModalAlumno(alumno) {
  alumnoEditando = alumno || null;
  const editando = !!alumnoEditando;

  CAMPOS_MODAL.forEach(function (id) { porId(id).value = ''; });
  if (editando) {
    porId('m-nombre').value = alumno.nombre_completo || '';
    porId('m-correo').value = alumno.correo || '';
    porId('m-telefono').value = alumno.telefono || '';
  }
  setTexto('modal-titulo', editando ? 'Editar Alumno' : 'Agregar Alumno');
  setTexto('btn-guardar-modal', editando ? 'Guardar Cambios' : 'Guardar Alumno');
  porId('m-contrasena').placeholder = editando ? 'Vacía = conservar la actual' : 'Mínimo 6 caracteres';
  porId('m-contrasena-oblig').classList.toggle('oculto', editando);
  porId('m-contrasena-oblig').style.display = editando ? 'none' : '';
  porId('ayuda-edicion').classList.toggle('oculto', !editando);
  limpiarErroresModal();
  porId('btn-guardar-modal').classList.remove('cargando');
  porId('modal-alumno').classList.remove('oculto');
  porId('m-nombre').focus();
}

function cerrarModalAlumno() {
  porId('modal-alumno').classList.add('oculto');
  alumnoEditando = null;
}

function marcarError(idCampo, idError, mensaje) {
  porId(idCampo).classList.add('invalido');
  setTexto(idError, mensaje);
}

async function guardarAlumno() {
  limpiarErroresModal();

  const nombreCompleto = porId('m-nombre').value.trim();
  const correo = porId('m-correo').value.trim();
  const contrasena = porId('m-contrasena').value;
  const telefono = porId('m-telefono').value.trim();
  const fechaNac = porId('m-fecha-nac').value;
  const pais = porId('m-pais').value.trim();
  const ciudad = porId('m-ciudad').value.trim();

  // Validaciones en el navegador (el backend vuelve a validar)
  let valido = true;
  if (!nombreCompleto) {
    marcarError('m-nombre', 'e-nombre', 'Escribe el nombre completo.');
    valido = false;
  }
  if (!correo) {
    marcarError('m-correo', 'e-correo', 'Escribe el correo.');
    valido = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    marcarError('m-correo', 'e-correo', 'El correo no es válido.');
    valido = false;
  }
  if ((!alumnoEditando && contrasena.length < 6) || (alumnoEditando && contrasena && contrasena.length < 6)) {
    marcarError('m-contrasena', 'e-contrasena', 'Mínimo 6 caracteres.');
    valido = false;
  }
  if (telefono && !/^\+?[0-9\s-]{7,15}$/.test(telefono)) {
    marcarError('m-telefono', 'e-telefono', 'Teléfono no válido.');
    valido = false;
  }
  if (fechaNac && new Date(fechaNac) > new Date()) {
    marcarError('m-fecha-nac', 'e-fecha-nac', 'La fecha no puede ser futura.');
    valido = false;
  }
  if (!valido) return;

  const cuerpo = {
    nombre_completo: nombreCompleto,
    correo: correo
  };
  if (contrasena) cuerpo.contrasena = contrasena;
  if (!alumnoEditando) cuerpo.rol = 'estudiante';
  if (telefono) cuerpo.telefono = telefono;
  if (fechaNac) cuerpo.fecha_nacimiento = fechaNac;
  if (pais) cuerpo.pais = pais;
  if (ciudad) cuerpo.ciudad = ciudad;

  const btn = porId('btn-guardar-modal');
  btn.classList.add('cargando');

  try {
    const editando = !!alumnoEditando;
    const res = editando
      ? await apiFetch('/admin/usuarios/' + alumnoEditando.id, { method: 'PUT', body: cuerpo })
      : await apiFetch('/admin/usuarios', { method: 'POST', body: cuerpo });

    if (res && res.ok) {
      cerrarModalAlumno();
      await cargarAlumnos();
      pintarStats();
      pintarLista();
      mostrarAlerta('exito', 'Alumno ' + nombreCompleto + (editando ? ' actualizado correctamente.' : ' creado correctamente.'));
    } else {
      setTexto('e-general', (res && res.datos && res.datos.mensaje) || (editando ? 'No se pudo actualizar el alumno.' : 'No se pudo crear el alumno.'));
      btn.classList.remove('cargando');
    }
  } catch (err) {
    console.error(err);
    setTexto('e-general', 'No se pudo conectar con el servidor.');
    btn.classList.remove('cargando');
  }
}

// ── 13. EVENTOS ─────────────────────────────────────────────
function limpiarBusqueda() {
  porId('input-busqueda').value = '';
  filtroEstado = 'todos';
  filtroNivel = 'todos';
  document.querySelectorAll('.filtro-sb-estado').forEach(function (b) {
    b.classList.toggle('activo', b.dataset.estado === 'todos');
  });
  document.querySelectorAll('#filtros-nivel .filtro-sb').forEach(function (b) {
    b.classList.toggle('activo', b.dataset.nivel === 'todos');
  });
  pintarLista();
}

porId('input-busqueda').addEventListener('input', pintarLista);
porId('btn-limpiar').addEventListener('click', limpiarBusqueda);
porId('btn-reset').addEventListener('click', limpiarBusqueda);

// Filtro lateral por estado (el de nivel se arma en pintarFiltrosNivel)
document.querySelectorAll('.filtro-sb-estado').forEach(function (btn) {
  btn.addEventListener('click', function () {
    if (btn.disabled) return;
    filtroEstado = btn.dataset.estado;
    document.querySelectorAll('.filtro-sb-estado').forEach(function (b) {
      b.classList.toggle('activo', b === btn);
    });
    pintarLista();
  });
});

// Ordenar al hacer clic en los encabezados Alumno / Ingreso
document.querySelectorAll('.th-sort').forEach(function (th) {
  th.addEventListener('click', function () {
    const col = th.dataset.col;
    if (orden.col === col) {
      orden.dir = orden.dir === 'asc' ? 'desc' : 'asc';
    } else {
      orden = { col: col, dir: 'asc' };
    }
    pintarLista();
  });
});

// Vista tabla / tarjetas
porId('btn-vista-tabla').addEventListener('click', function () { vista = 'tabla'; aplicarVista(); });
porId('btn-vista-cards').addEventListener('click', function () { vista = 'cards'; aplicarVista(); });

// Modal agregar
porId('btn-nuevo-alumno').addEventListener('click', function () { abrirModalAlumno(); });
porId('btn-cerrar-modal').addEventListener('click', cerrarModalAlumno);
porId('btn-cancelar-modal').addEventListener('click', cerrarModalAlumno);
porId('btn-guardar-modal').addEventListener('click', guardarAlumno);
porId('modal-alumno').addEventListener('click', function (e) {
  if (e.target === this) cerrarModalAlumno();
});

// Modal desactivar
porId('btn-cerrar-eliminar').addEventListener('click', cerrarModalDesactivar);
porId('btn-cancelar-eliminar').addEventListener('click', cerrarModalDesactivar);
porId('modal-eliminar').addEventListener('click', function (e) {
  if (e.target === this) cerrarModalDesactivar();
});
porId('btn-confirmar-eliminar').addEventListener('click', async function () {
  if (!alumnoADesactivar) return;
  const alumno = alumnoADesactivar;
  const btn = this;
  btn.disabled = true;
  await cambiarEstado(alumno, false, null);
  btn.disabled = false;
  cerrarModalDesactivar();
});
// Modal eliminar definitivo
porId('btn-cerrar-borrar').addEventListener('click', cerrarModalBorrar);
porId('btn-cancelar-borrar').addEventListener('click', cerrarModalBorrar);
porId('modal-borrar').addEventListener('click', function (e) {
  if (e.target === this) cerrarModalBorrar();
});
porId('btn-confirmar-borrar').addEventListener('click', async function () {
  if (!alumnoABorrar) return;
  const alumno = alumnoABorrar;
  const btn = this;
  btn.disabled = true;
  await borrarAlumno(alumno);
  btn.disabled = false;
  cerrarModalBorrar();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    cerrarModalAlumno();
    cerrarModalDesactivar();
    cerrarModalBorrar();
  }
});

// ── 14. ARRANCAR ────────────────────────────────────────────
async function iniciar() {
  try {
    await cargarAlumnos();
  } catch (err) {
    console.error('Error al cargar los alumnos:', err);
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
  }
  pintarStats();
  aplicarVista();

  // Llegó desde "Nuevo Alumno" del inicio: abrir el modal y limpiar la URL
  const params = new URLSearchParams(window.location.search);
  if (params.get('nuevo') === '1') {
    abrirModalAlumno();
    window.history.replaceState({}, '', window.location.pathname);
  }
}

if (sesionValida) iniciar();