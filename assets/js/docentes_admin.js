/* ============================================================
   docentes_admin.js
   Instituto American Land
   Ubicación: assets/js/docentes_admin.js
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
  alerta.className = 'alerta ' + tipo + ' visible';
  alerta.style.display = 'block';
}

function pintarFecha() {
  const texto = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  setTexto('texto-fecha', texto.charAt(0).toUpperCase() + texto.slice(1));
}

// "MR" a partir de "Mario Ramírez"
function iniciales(texto) {
  const palabras = String(texto || '?').trim().split(/\s+/);
  const a = palabras[0] ? palabras[0].charAt(0) : '';
  const b = palabras[1] ? palabras[1].charAt(0) : '';
  return (a + b).toUpperCase();
}

// Las horas TIME llegan en UTC: "1970-01-01T18:00:00.000Z" -> "18:00"
function fmtHora(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  return d.getUTCHours() + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}

function fmtDias(dias) {
  return dias ? String(dias).split(',').join(', ') : '';
}

// Horas por semana de un salón = número de días x duración de la clase
function horasSemana(salon) {
  if (!salon.dias_semana || !salon.hora_inicio || !salon.hora_fin) return 0;
  const dias = String(salon.dias_semana).split(',').filter(function (d) { return d.trim() !== ''; }).length;
  const duracion = (new Date(salon.hora_fin) - new Date(salon.hora_inicio)) / 3600000;
  return dias * (duracion > 0 ? duracion : 0);
}

function fmtNumero(n) {
  return String(Math.round(n * 10) / 10);
}

// Colores de tus clases CSS, repartidos entre los salones
const COLORES_SALON = ['rojo-tag', 'azul-tag', 'morado-tag', 'amarillo-tag'];
const GRADIENTES = [
  'linear-gradient(135deg,#4B0082,#6A0DAD)',
  'linear-gradient(135deg,#2980B9,#5dade2)',
  'linear-gradient(135deg,#27AE60,#58d68d)',
  'linear-gradient(135deg,#F39C12,#f8c471)'
];
const GRADIENTE_INACTIVO = 'linear-gradient(135deg,#888,#aaa)';

// ── 6. ESTADO DE LA PÁGINA ──────────────────────────────────
let docentes = [];     // usuarios con rol "docente"
let salones = [];      // GET /admin/salones
let matriculas = [];   // GET /admin/matriculas
let docenteADesactivar = null;
let docenteEditando = null;   // null = nuevo; objeto = editar

// ── 7. CARGA DE DATOS ───────────────────────────────────────
async function cargarUsuarios() {
  const res = await apiFetch('/admin/usuarios');
  if (res && res.ok && res.datos && Array.isArray(res.datos.usuarios)) {
    docentes = res.datos.usuarios.filter(function (u) { return u.rol === 'docente'; });
    await unirPerfiles();
    return true;
  }
  mostrarAlerta('error', (res && res.datos && res.datos.mensaje) || 'No se pudieron cargar los docentes.');
  return false;
}

// GET /admin/docentes trae Docentes.id y la especialidad (se une por usuario_id).
// El estado activo/inactivo sigue saliendo de /admin/usuarios, que es el que cambia el PUT.
async function unirPerfiles() {
  const perfiles = {};
  try {
    const res = await apiFetch('/admin/docentes');
    if (res && res.ok && res.datos && Array.isArray(res.datos.docentes)) {
      res.datos.docentes.forEach(function (p) { perfiles[p.usuario_id] = p; });
    }
  } catch (err) {
    console.error('Error al cargar los perfiles de docentes:', err);
  }
  docentes.forEach(function (d) {
    const p = perfiles[d.id];
    d.docente_id = p ? p.id : null;
    d.especialidad = p ? p.especialidad : null;
  });
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

async function cargarMatriculas() {
  try {
    const res = await apiFetch('/admin/matriculas');
    if (res && res.ok && res.datos && Array.isArray(res.datos.matriculas)) {
      matriculas = res.datos.matriculas;
    }
  } catch (err) {
    console.error('Error al cargar las matrículas:', err);
  }
}

// ── 8. DATOS DERIVADOS ──────────────────────────────────────
// Se cruza por Docentes.id cuando /admin/salones trae docente_id;
// si todavía no lo trae, se usa el nombre como respaldo.
function salonesDe(docente) {
  return salones.filter(function (s) {
    if (s.docente_id !== undefined && docente.docente_id !== null) {
      return s.docente_id === docente.docente_id;
    }
    return s.docente === docente.nombre_completo;
  });
}

// Alumnos con matrícula activa en un salón (se busca por nombre + año)
function alumnosDe(salon) {
  return matriculas.filter(function (m) {
    return m.salon === salon.nombre && m.anno === salon.anno && m.estado === 'activa';
  }).length;
}

function colorDeSalon(nombreSalon) {
  const nombres = [];
  salones.forEach(function (s) {
    if (nombres.indexOf(s.nombre) === -1) nombres.push(s.nombre);
  });
  return COLORES_SALON[nombres.indexOf(nombreSalon) % COLORES_SALON.length];
}

// ── 9. TARJETAS Y FILTROS ───────────────────────────────────
function pintarStats() {
  let totalSalones = 0;
  let totalAlumnos = 0;
  let totalHoras = 0;

  docentes.forEach(function (d) {
    salonesDe(d).forEach(function (s) {
      totalSalones++;
      totalAlumnos += alumnosDe(s);
      totalHoras += horasSemana(s);
    });
  });

  const activos = docentes.filter(function (d) { return d.activo; }).length;
  setTexto('stat-total', docentes.length);
  setTexto('delta-total', '\u21E7 ' + plural(activos, 'activo', 'activos'));
  setTexto('stat-salones-asig', totalSalones);
  setTexto('stat-alumnos-asig', totalAlumnos);
  setTexto('stat-horas', fmtNumero(totalHoras));
}

function llenarFiltroSalon() {
  const sel = porId('filtro-salon');
  const nombres = [];
  salones.forEach(function (s) {
    if (nombres.indexOf(s.nombre) === -1) nombres.push(s.nombre);
  });
  nombres.forEach(function (n) {
    const op = crear('option', '', n);
    op.value = n;
    sel.appendChild(op);
  });
}

function filtrar() {
  const texto = porId('input-busqueda').value.trim().toLowerCase();
  const estado = porId('filtro-estado').value;
  const salon = porId('filtro-salon').value;

  return docentes.filter(function (d) {
    if (estado === 'activo' && !d.activo) return false;
    if (estado === 'inactivo' && d.activo) return false;
    if (salon) {
      const tiene = salonesDe(d).some(function (s) { return s.nombre === salon; });
      if (!tiene) return false;
    }
    if (texto) {
      const paja = (String(d.nombre_completo) + ' ' + String(d.correo) + ' ' + String(d.especialidad || '')).toLowerCase();
      if (paja.indexOf(texto) === -1) return false;
    }
    return true;
  });
}

// ── 10. TABLA ───────────────────────────────────────────────
// Cada salón ocupa una línea de la misma altura en las columnas Salón y Horario
function lineaApilada(elemento) {
  elemento.style.minHeight = '26px';
  elemento.style.display = 'flex';
  elemento.style.alignItems = 'center';
  return elemento;
}

function contenedorApilado() {
  const c = crear('div');
  c.style.display = 'flex';
  c.style.flexDirection = 'column';
  c.style.gap = '4px';
  c.style.alignItems = 'flex-start';
  return c;
}

function crearBotonAccion(d) {
  const acciones = crear('div', 'acciones-fila');

  const btnEditar = crear('button', 'btn-editar', '\u270E');
  btnEditar.title = 'Editar';
  btnEditar.dataset.id = d.id;
  btnEditar.addEventListener('click', function () { abrirModalDocente(d); });
  acciones.appendChild(btnEditar);

  if (d.activo) {
    const btn = crear('button', 'btn-eliminar', '\uD83D\uDDD1');
    btn.title = 'Desactivar';
    btn.dataset.id = d.id;
    btn.addEventListener('click', function () { pedirDesactivar(d); });
    acciones.appendChild(btn);
  } else {
    const btn = crear('button', 'btn-editar', '\u2714');
    btn.title = 'Activar';
    btn.dataset.id = d.id;
    btn.addEventListener('click', function () { cambiarEstado(d, true, btn); });
    acciones.appendChild(btn);
  }
  return acciones;
}

function crearFila(d, indice) {
  const tr = crear('tr', 'fila-docente');
  const susSalones = salonesDe(d);

  // Docente
  const tdDoc = crear('td');
  const info = crear('div', 'docente-info');
  const avatar = crear('div', 'avatar-docente', iniciales(d.nombre_completo));
  avatar.style.background = d.activo ? GRADIENTES[indice % GRADIENTES.length] : GRADIENTE_INACTIVO;
  info.appendChild(avatar);
  const textos = crear('div');
  textos.appendChild(crear('p', 'docente-nombre', d.nombre_completo));
  textos.appendChild(crear('p', 'docente-correo', d.correo));
  info.appendChild(textos);
  tdDoc.appendChild(info);
  tr.appendChild(tdDoc);

  // Especialidad (GET /admin/docentes)
  const tdEsp = crear('td');
  if (d.especialidad) {
    tdEsp.appendChild(crear('span', 'tag-especialidad', d.especialidad));
  } else {
    tdEsp.appendChild(crear('span', 'gris-texto', '\u2014'));
  }
  tr.appendChild(tdEsp);

  // Salón asignado
  const tdSalon = crear('td');
  if (susSalones.length === 0) {
    tdSalon.appendChild(crear('span', 'gris-texto', 'Sin asignar'));
  } else {
    const cont = contenedorApilado();
    susSalones.forEach(function (s) {
      const linea = lineaApilada(crear('div'));
      linea.appendChild(crear('div', 'salon-tag ' + colorDeSalon(s.nombre), '\uD83C\uDFE0 ' + s.nombre));
      cont.appendChild(linea);
    });
    tdSalon.appendChild(cont);
  }
  tr.appendChild(tdSalon);

  // Horario
  const tdHor = crear('td');
  if (susSalones.length === 0) {
    tdHor.appendChild(crear('span', 'horario-texto gris-texto', '\u2014'));
  } else {
    const cont = contenedorApilado();
    susSalones.forEach(function (s) {
      let texto = '\u2014';
      if (s.dias_semana && s.hora_inicio && s.hora_fin) {
        texto = fmtDias(s.dias_semana) + ' ' + fmtHora(s.hora_inicio) + '\u2013' + fmtHora(s.hora_fin);
      }
      cont.appendChild(lineaApilada(crear('span', 'horario-texto', texto)));
    });
    tdHor.appendChild(cont);
  }
  tr.appendChild(tdHor);

  // Alumnos (matrículas activas en sus salones)
  const totalAlumnos = susSalones.reduce(function (suma, s) { return suma + alumnosDe(s); }, 0);
  const tdAlu = crear('td');
  tdAlu.appendChild(crear('span', 'num-alumnos' + (susSalones.length === 0 ? ' gris-texto' : ''), String(totalAlumnos)));
  tr.appendChild(tdAlu);

  // Estado
  const tdEst = crear('td');
  tdEst.appendChild(crear('span', 'badge-estado ' + (d.activo ? 'activo' : 'inactivo'), d.activo ? 'Activo' : 'Inactivo'));
  tr.appendChild(tdEst);

  // Acciones
  const tdAcc = crear('td');
  tdAcc.appendChild(crearBotonAccion(d));
  tr.appendChild(tdAcc);

  return tr;
}

function pintarTabla() {
  const tbody = porId('tbody-docentes');
  tbody.innerHTML = '';

  const lista = filtrar();
  setTexto('badge-total', plural(lista.length, 'docente', 'docentes'));

  const sinRes = porId('sin-resultados');
  if (lista.length === 0) {
    sinRes.querySelector('p').textContent = docentes.length === 0
      ? 'Todavía no hay docentes registrados'
      : 'No se encontraron docentes con ese criterio';
    sinRes.style.display = 'block';
    return;
  }
  sinRes.style.display = 'none';

  lista.forEach(function (d) {
    tbody.appendChild(crearFila(d, docentes.indexOf(d)));
  });
}

// ── 11. ACTIVAR / DESACTIVAR ────────────────────────────────
function pedirDesactivar(d) {
  docenteADesactivar = d;
  setTexto('nombre-a-eliminar', d.nombre_completo);
  porId('modal-eliminar').style.display = 'flex';
}

function cerrarModalDesactivar() {
  porId('modal-eliminar').style.display = 'none';
  docenteADesactivar = null;
}

async function cambiarEstado(d, activo, boton) {
  if (boton) boton.disabled = true;

  try {
    const res = await apiFetch('/admin/usuarios/' + d.id + '/estado', {
      method: 'PUT',
      body: { activo: activo }
    });

    if (res && res.ok) {
      await cargarUsuarios();
      pintarStats();
      pintarTabla();
      mostrarAlerta('exito', activo
        ? d.nombre_completo + ' fue activado.'
        : d.nombre_completo + ' fue desactivado.');
      return true;
    }
    mostrarAlerta('error', (res && res.datos && res.datos.mensaje) || 'No se pudo cambiar el estado del docente.');
  } catch (err) {
    console.error(err);
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
  }

  if (boton) boton.disabled = false;
  return false;
}

// ── 12. MODAL: NUEVO DOCENTE ────────────────────────────────
const CAMPOS_MODAL = ['doc-nombre', 'doc-correo', 'doc-contrasena', 'doc-telefono', 'doc-especialidad'];
const ERRORES_MODAL = ['err-nombre', 'err-correo', 'err-contrasena', 'err-telefono', 'err-especialidad', 'err-general'];

function limpiarErroresModal() {
  ERRORES_MODAL.forEach(function (id) { setTexto(id, ''); });
  CAMPOS_MODAL.forEach(function (id) { porId(id).classList.remove('invalido'); });
}

function abrirModalDocente(docente) {
  docenteEditando = docente && docente.id ? docente : null;
  const editando = !!docenteEditando;

  CAMPOS_MODAL.forEach(function (id) { porId(id).value = ''; });
  if (editando) {
    porId('doc-nombre').value = docente.nombre_completo || '';
    porId('doc-correo').value = docente.correo || '';
    porId('doc-telefono').value = docente.telefono || '';
    porId('doc-especialidad').value = docente.especialidad || '';
  }
  setTexto('modal-titulo', editando ? 'Editar Docente' : 'Nuevo Docente');
  setTexto('btn-guardar-docente', editando ? 'Guardar Cambios' : 'Guardar Docente');
  porId('doc-contrasena').placeholder = editando ? 'Vacía = conservar la actual' : 'Mínimo 6 caracteres';
  porId('doc-contrasena-oblig').style.display = editando ? 'none' : '';
  porId('ayuda-edicion').style.display = editando ? 'block' : 'none';
  limpiarErroresModal();
  porId('btn-guardar-docente').disabled = false;
  porId('modal-overlay').style.display = 'flex';
  porId('doc-nombre').focus();
}

function cerrarModalDocente() {
  porId('modal-overlay').style.display = 'none';
  docenteEditando = null;
}

function marcarError(idCampo, idError, mensaje) {
  porId(idCampo).classList.add('invalido');
  setTexto(idError, mensaje);
}

async function guardarDocente(e) {
  e.preventDefault();
  limpiarErroresModal();

  const nombreCompleto = porId('doc-nombre').value.trim();
  const correo = porId('doc-correo').value.trim();
  const contrasena = porId('doc-contrasena').value;
  const telefono = porId('doc-telefono').value.trim();
  const especialidad = porId('doc-especialidad').value.trim();

  // Validaciones en el navegador (el backend vuelve a validar)
  let valido = true;
  if (!nombreCompleto) {
    marcarError('doc-nombre', 'err-nombre', 'Escribe el nombre completo.');
    valido = false;
  }
  if (!correo) {
    marcarError('doc-correo', 'err-correo', 'Escribe el correo.');
    valido = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    marcarError('doc-correo', 'err-correo', 'El correo no es válido.');
    valido = false;
  }
  if ((!docenteEditando && contrasena.length < 6) || (docenteEditando && contrasena && contrasena.length < 6)) {
    marcarError('doc-contrasena', 'err-contrasena', 'Mínimo 6 caracteres.');
    valido = false;
  }
  if (telefono && !/^\+?[0-9\s-]{7,15}$/.test(telefono)) {
    marcarError('doc-telefono', 'err-telefono', 'Teléfono no válido.');
    valido = false;
  }
  if (!especialidad) {
    marcarError('doc-especialidad', 'err-especialidad', 'Escribe la especialidad.');
    valido = false;
  }
  if (!valido) return;

  const cuerpo = {
    nombre_completo: nombreCompleto,
    correo: correo,
    datosPerfil: { especialidad: especialidad }
  };
  if (contrasena) cuerpo.contrasena = contrasena;
  if (!docenteEditando) cuerpo.rol = 'docente';
  if (telefono) cuerpo.telefono = telefono;

  const btn = porId('btn-guardar-docente');
  btn.disabled = true;

  try {
    const editando = !!docenteEditando;
    const res = editando
      ? await apiFetch('/admin/usuarios/' + docenteEditando.id, { method: 'PUT', body: cuerpo })
      : await apiFetch('/admin/usuarios', { method: 'POST', body: cuerpo });

    if (res && res.ok) {
      cerrarModalDocente();
      await cargarUsuarios();
      pintarStats();
      pintarTabla();
      mostrarAlerta('exito', 'Docente ' + nombreCompleto + (editando ? ' actualizado correctamente.' : ' creado correctamente.'));
    } else {
      setTexto('err-general', (res && res.datos && res.datos.mensaje) || (editando ? 'No se pudo actualizar el docente.' : 'No se pudo crear el docente.'));
      btn.disabled = false;
    }
  } catch (err) {
    console.error(err);
    setTexto('err-general', 'No se pudo conectar con el servidor.');
    btn.disabled = false;
  }
}

// ── 13. EVENTOS ─────────────────────────────────────────────
porId('input-busqueda').addEventListener('input', pintarTabla);
porId('filtro-estado').addEventListener('change', pintarTabla);
porId('filtro-salon').addEventListener('change', pintarTabla);

porId('btn-limpiar').addEventListener('click', function () {
  porId('input-busqueda').value = '';
  porId('filtro-estado').value = '';
  porId('filtro-salon').value = '';
  pintarTabla();
});

// Modal nuevo docente
porId('btn-nuevo-docente').addEventListener('click', function () { abrirModalDocente(); });
porId('sb-nuevo-docente').addEventListener('click', function () { abrirModalDocente(); });
porId('btn-cerrar-modal').addEventListener('click', cerrarModalDocente);
porId('btn-cancelar-modal').addEventListener('click', cerrarModalDocente);
porId('form-docente').addEventListener('submit', guardarDocente);
porId('modal-overlay').addEventListener('click', function (e) {
  if (e.target === this) cerrarModalDocente();
});

// Modal desactivar
porId('btn-cerrar-eliminar').addEventListener('click', cerrarModalDesactivar);
porId('btn-cancelar-eliminar').addEventListener('click', cerrarModalDesactivar);
porId('modal-eliminar').addEventListener('click', function (e) {
  if (e.target === this) cerrarModalDesactivar();
});
porId('btn-confirmar-eliminar').addEventListener('click', async function () {
  if (!docenteADesactivar) return;
  const docente = docenteADesactivar;
  const btn = this;
  btn.disabled = true;
  await cambiarEstado(docente, false, null);
  btn.disabled = false;
  cerrarModalDesactivar();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    cerrarModalDocente();
    cerrarModalDesactivar();
  }
});

// Acciones rápidas hacia las otras páginas
porId('sb-nuevo-alumno').addEventListener('click', function () {
  window.location.href = 'alumnos.html?nuevo=1';
});
porId('sb-nuevo-salon').addEventListener('click', function () {
  window.location.href = 'salones.html?nuevo=1';
});

// ── 14. ARRANCAR ────────────────────────────────────────────
async function iniciar() {
  pintarFecha();
  try {
    await Promise.all([cargarUsuarios(), cargarSalones(), cargarMatriculas()]);
  } catch (err) {
    console.error('Error al cargar los datos:', err);
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
  }
  llenarFiltroSalon();
  pintarStats();
  pintarTabla();

  // Llegó desde "Nuevo Docente" del inicio: abrir el modal y limpiar la URL
  const params = new URLSearchParams(window.location.search);
  if (params.get('nuevo') === '1') {
    abrirModalDocente();
    window.history.replaceState({}, '', window.location.pathname);
  }
}

if (sesionValida) iniciar();