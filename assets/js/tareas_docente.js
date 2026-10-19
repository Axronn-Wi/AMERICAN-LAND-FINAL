/* ============================================================
   tareas_docente.js
   Instituto American Land
   Ubicación: assets/js/tareas_docente.js
============================================================ */

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

// ── 1. VERIFICAR SESIÓN ─────────────────────────────────────
const token = sessionStorage.getItem('token');
const rol   = sessionStorage.getItem('rol');
const sesionValida = !!token && rol === 'docente';

if (!sesionValida) {
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

// ── 4. HELPER PARA LA API (GET, POST y PUT) ──────────────────────
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
const COLORES_DOT    = ['rojo', 'azul', 'morado'];
const COLORES_BLOQUE = ['canada', 'zelanda', 'miami'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function crear(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function mostrarAlerta(tipo, texto) {
  const alerta = document.getElementById('alerta');
  alerta.textContent = texto;
  alerta.className = 'alerta ' + tipo + ' visible';
  alerta.style.display = 'block';
}

// "2026-11-30T00:00:00.000Z" -> "30 Nov 2026" (en UTC para que no se corra un día)
function fmtFecha(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  return d.getUTCDate() + ' ' + MESES[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

// Fecha de hoy como "AAAA-MM-DD" (hora local del navegador)
function hoyISO() {
  const d = new Date();
  return d.getFullYear() + '-' +
         String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

// Estado calculado: activa si no ha vencido, cerrada si ya venció
function estadoDe(tarea) {
  if (!tarea.fecha_limite) return 'activa';
  return String(tarea.fecha_limite).slice(0, 10) >= hoyISO() ? 'activa' : 'cerrada';
}

function plural(n, singular, pluralTexto) {
  return n + ' ' + (n === 1 ? singular : pluralTexto);
}

// ── 6. ESTADO DE LA PÁGINA ──────────────────────────────────
let salones = [];
let tareas = [];
let filtroEstado = 'todas';
let filtroSalon = 'todos';          // 'todos' o el id del salón como texto
const ciclosPorSalon = {};          // caché de ciclos para el modal

// ── 7. SIDEBAR Y SELECTORES DE SALÓN ────────────────────────
function pintarSidebar() {
  const ul = document.getElementById('lista-clases');
  ul.innerHTML = '';

  if (salones.length === 0) {
    const li = crear('li', 'clase-item');
    li.appendChild(crear('a', '', 'Sin salones asignados'));
    ul.appendChild(li);
    return;
  }

  salones.forEach(function (s, i) {
    const li = crear('li', 'clase-item' + (String(s.id) === filtroSalon ? ' activa' : ''));
    li.appendChild(crear('span', 'clase-dot ' + COLORES_DOT[i % COLORES_DOT.length]));
    const a = crear('a', '', s.nombre);
    a.href = 'tareas.html?salon=' + s.id;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      seleccionarSalon(String(s.id));
    });
    li.appendChild(a);
    ul.appendChild(li);
  });
}

function actualizarAccesos() {
  document.querySelectorAll('.acceso-link').forEach(function (a) {
    const base = a.getAttribute('href').split('?')[0];
    a.href = filtroSalon === 'todos' ? base : base + '?salon=' + filtroSalon;
  });
}

function llenarSelectores() {
  const filtro = document.getElementById('select-salon');
  const modal = document.getElementById('m-salon');

  salones.forEach(function (s) {
    const op1 = crear('option', '', s.nombre);
    op1.value = s.id;
    filtro.appendChild(op1);

    const op2 = crear('option', '', s.nombre);
    op2.value = s.id;
    modal.appendChild(op2);

    const op3 = crear('option', '', s.nombre);
    op3.value = s.id;
    document.getElementById('mat-salon').appendChild(op3);
  });
}

function seleccionarSalon(valor) {
  filtroSalon = valor;
  document.getElementById('select-salon').value = valor;
  history.replaceState(null, '', valor === 'todos' ? 'tareas.html' : 'tareas.html?salon=' + valor);
  pintarSidebar();
  actualizarAccesos();
  pintarLista();
  pintarRecientes();
  pintarMaterial();
}

// ── 8. LISTA DE TAREAS ──────────────────────────────────────
function crearTarjeta(t) {
  const item = crear('div', 'tarea-item');
  item.dataset.salon = t.salon_id;
  item.dataset.estado = t.estado;

  item.appendChild(crear('div', 'tarea-color bloque-' + COLORES_BLOQUE[t.color % COLORES_BLOQUE.length]));

  const cuerpo = crear('div', 'tarea-cuerpo');

  // Cabecera: título, salón y estado
  const cabecera = crear('div', 'tarea-cabecera');
  const izquierda = crear('div');
  izquierda.appendChild(crear('p', 'tarea-titulo', t.titulo));
  izquierda.appendChild(crear('p', 'tarea-salon', t.salon_nombre + ' \u2022 Nivel ' + t.nivel));
  cabecera.appendChild(izquierda);
  cabecera.appendChild(crear('span',
    'badge-estado ' + (t.estado === 'activa' ? 'activo' : 'revisado'),
    t.estado === 'activa' ? 'Activa' : 'Cerrada'));
  cuerpo.appendChild(cabecera);

  // Descripción
  cuerpo.appendChild(crear('p', 'tarea-descripcion', t.descripcion || 'Sin descripción.'));

  // Datos: vencimiento, estudiantes, entregas
  const meta = crear('div', 'tarea-meta');

  const vence = crear('span', 'meta-item', '\uD83D\uDCC5 Vence: ');
  vence.appendChild(crear('strong', '', fmtFecha(t.fecha_limite)));
  meta.appendChild(vence);

  meta.appendChild(crear('span', 'meta-item',
    '\uD83D\uDC65 ' + plural(t.total_estudiantes, 'estudiante', 'estudiantes')));

  const pendientes = Math.max(0, t.total_estudiantes - t.total_entregas);
  meta.appendChild(crear('span', 'meta-item entregadas',
    '\u2713 ' + plural(t.total_entregas, 'entregada', 'entregadas')));
  meta.appendChild(crear('span', 'meta-item pendientes',
    '\u25CF ' + plural(pendientes, 'pendiente', 'pendientes')));

  meta.appendChild(crear('span', 'meta-item',
    'Ciclo ' + t.numero_ciclo + ' \u00B7 ' + Number(t.valor_porcentaje) + '%'));
  if (t.archivo_nombre) {
    const adjunto = crear('button', 'meta-item adjunto', '\uD83D\uDCCE ' + t.archivo_nombre);
    adjunto.type = 'button';
    adjunto.title = 'Descargar ' + t.archivo_nombre;
    adjunto.addEventListener('click', function () {
      descargarArchivo('/tareas/' + t.id + '/archivo', t.archivo_nombre, adjunto);
    });
    meta.appendChild(adjunto);
  }
  cuerpo.appendChild(meta);

  // Acciones: "Ver entregas" y "Editar" (abre el modal precargado)
  const acciones = crear('div', 'tarea-acciones');
  const btnVer = crear('button', 'btn-accion btn-ver-entregas', 'Ver entregas');
  btnVer.addEventListener('click', function () { abrirEntregas(t); });
  acciones.appendChild(btnVer);
  const btnEditar = crear('button', 'btn-accion btn-editar', 'Editar');
  btnEditar.addEventListener('click', function () { abrirModalEditar(t); });
  acciones.appendChild(btnEditar);
  const btnEliminar = crear('button', 'btn-accion btn-eliminar', 'Eliminar');
  btnEliminar.style.color = '#c0392b';
  btnEliminar.style.borderColor = '#c0392b';
  btnEliminar.addEventListener('click', function () { eliminarTareaDocente(t, btnEliminar); });
  acciones.appendChild(btnEliminar);
  cuerpo.appendChild(acciones);

  item.appendChild(cuerpo);
  return item;
}

// Elimina una tarea (el servidor responde 409 si ya tiene entregas)
async function eliminarTareaDocente(t, btn) {
  if (!window.confirm('¿Eliminar la tarea "' + t.titulo + '"? Esta acción no se puede deshacer.')) return;

  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Eliminando...';

  try {
    const res = await apiFetch('/docentes/tareas/' + t.id, { method: 'DELETE' });
    if (!res) return;   // el token venció: apiFetch ya redirigió al login

    if (res.ok) {
      await cargarTareas();
      pintarLista();
      mostrarAlerta('exito', 'Tarea eliminada correctamente.');
    } else {
      mostrarAlerta('error', (res.datos && res.datos.mensaje) || 'No se pudo eliminar la tarea.');
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  } catch (err) {
    console.error(err);
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

function pintarLista() {
  const lista = document.getElementById('lista-tareas-activas');
  lista.innerHTML = '';

  const visibles = tareas.filter(function (t) {
    const okSalon = filtroSalon === 'todos' || String(t.salon_id) === filtroSalon;
    const okEstado = filtroEstado === 'todas' || t.estado === filtroEstado;
    return okSalon && okEstado;
  });

  document.getElementById('conteo-tareas').textContent = plural(visibles.length, 'tarea', 'tareas');

  if (visibles.length === 0) {
    const vacio = crear('p', '', salones.length === 0
      ? 'Cuando la administración te asigne un salón, podrás crear tareas aquí.'
      : 'No hay tareas para este filtro. Usa "+ Nueva Tarea" para crear una.');
    vacio.style.padding = '24px';
    vacio.style.textAlign = 'center';
    lista.appendChild(vacio);
    return;
  }

  visibles.forEach(function (t) { lista.appendChild(crearTarjeta(t)); });
}

// ── 9. CARGAR TAREAS DE TODOS LOS SALONES ───────────────────
async function cargarTareas() {
  const resultados = await Promise.all(salones.map(function (s, i) {
    return apiFetch('/docentes/salones/' + s.id + '/tareas')
      .then(function (res) { return { salon: s, indice: i, res: res }; })
      .catch(function (err) { console.error(err); return { salon: s, indice: i, res: null }; });
  }));

  const todas = [];
  const fallidos = [];

  resultados.forEach(function (r) {
    if (r.res && r.res.ok && r.res.datos && r.res.datos.tareas) {
      r.res.datos.tareas.forEach(function (t) {
        t.salon_id = r.salon.id;
        t.salon_nombre = r.salon.nombre;
        t.nivel = r.salon.nivel;
        t.color = r.indice;
        t.estado = estadoDe(t);
        todas.push(t);
      });
    } else {
      fallidos.push(r.salon.nombre);
    }
  });

  // Más recientes (por fecha de vencimiento) primero
  todas.sort(function (a, b) {
    return String(b.fecha_limite).localeCompare(String(a.fecha_limite));
  });

  tareas = todas;

  if (fallidos.length > 0) {
    mostrarAlerta('error', 'No se pudieron cargar las tareas de: ' + fallidos.join(', ') + '.');
  }
}

// ── 10. FILTROS ─────────────────────────────────────────────
document.querySelectorAll('.btn-filtro').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.btn-filtro').forEach(function (b) { b.classList.remove('activo'); });
    btn.classList.add('activo');
    filtroEstado = btn.dataset.filtro;
    pintarLista();
  });
});

document.getElementById('select-salon').addEventListener('change', function () {
  seleccionarSalon(this.value);
});

// ── 11. MODAL NUEVA TAREA ───────────────────────────────────
const modal = document.getElementById('modal-nueva-tarea');

const CAMPOS_ERROR = [
  ['m-titulo', 'e-titulo'],
  ['m-salon', 'e-salon'],
  ['m-ciclo', 'e-ciclo'],
  ['m-porcentaje', 'e-porcentaje'],
  ['m-fecha', 'e-fecha'],
  ['m-descripcion', 'e-descripcion'],
  ['m-archivo', 'e-archivo']
];

// Archivo ya adjunto a la tarea que se edita: true si el docente pidió quitarlo
let quitarArchivo = false;

function pintarArchivoActual(nombre) {
  const caja = document.getElementById('m-archivo-actual');
  quitarArchivo = false;
  caja.classList.remove('quitado');
  document.getElementById('m-archivo-quitar').textContent = 'Quitar';
  document.getElementById('m-archivo').value = '';
  caja.hidden = !nombre;
  document.getElementById('m-archivo-nombre').textContent = nombre ? '\uD83D\uDCCE ' + nombre : '';
  document.getElementById('m-archivo-ayuda').textContent = nombre
    ? 'Si eliges otro archivo, reemplaza al actual. Máximo 20 MB.'
    : 'PDF, Word, PowerPoint, Excel, JPG, PNG o MP3. Máximo 20 MB.';
}

document.getElementById('m-archivo-quitar').addEventListener('click', function () {
  quitarArchivo = !quitarArchivo;
  document.getElementById('m-archivo-actual').classList.toggle('quitado', quitarArchivo);
  this.textContent = quitarArchivo ? 'Deshacer' : 'Quitar';
});

function ponerError(inputId, errorId, mensaje) {
  const input = document.getElementById(inputId);
  const span = document.getElementById(errorId);
  input.classList.add('invalido');
  span.textContent = mensaje;
  span.style.display = 'block';
}

function limpiarErrores() {
  CAMPOS_ERROR.forEach(function (par) {
    document.getElementById(par[0]).classList.remove('invalido');
    const span = document.getElementById(par[1]);
    span.textContent = '';
    span.style.display = 'none';
  });
  const general = document.getElementById('e-general');
  general.textContent = '';
  general.style.display = 'none';
}

async function cargarCiclosModal(salonId) {
  const select = document.getElementById('m-ciclo');
  select.innerHTML = '';

  if (!salonId) {
    select.appendChild(crear('option', '', 'Selecciona primero un salón')).value = '';
    return;
  }

  select.appendChild(crear('option', '', 'Cargando ciclos...')).value = '';

  let ciclos = ciclosPorSalon[salonId];
  if (!ciclos) {
    try {
      // Los ciclos del salón vienen en el GET de notas
      const res = await apiFetch('/docentes/salones/' + salonId + '/notas');
      if (res && res.ok && res.datos) {
        ciclos = res.datos.ciclos || [];
        ciclosPorSalon[salonId] = ciclos;
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Si mientras tanto eligió otro salón, no pisar su lista
  if (document.getElementById('m-salon').value !== String(salonId)) return;

  select.innerHTML = '';

  if (!ciclos) {
    select.appendChild(crear('option', '', 'No se pudieron cargar los ciclos')).value = '';
    return;
  }
  if (ciclos.length === 0) {
    select.appendChild(crear('option', '', 'Este salón no tiene ciclos')).value = '';
    return;
  }

  select.appendChild(crear('option', '', 'Selecciona un ciclo')).value = '';
  ciclos.forEach(function (c) {
    const op = crear('option', '', 'Ciclo ' + c.numero_ciclo);
    op.value = c.id;
    select.appendChild(op);
  });

  // Preseleccionar el ciclo actual del salón (o el único que exista)
  const salon = salones.find(function (s) { return String(s.id) === String(salonId); });
  const actual = salon ? ciclos.find(function (c) { return c.numero_ciclo === salon.ciclo_actual; }) : null;
  if (actual) select.value = actual.id;
  else if (ciclos.length === 1) select.value = ciclos[0].id;
}

// Tarea que se está editando (null = el modal está en modo "Nueva Tarea")
let tareaEditando = null;

// Ajusta títulos, texto del botón y bloqueo de Salón y Ciclo según el modo
function configurarModalModo(edicion) {
  document.getElementById('modal-titulo').textContent = edicion ? 'Editar Tarea' : 'Nueva Tarea';
  document.getElementById('btn-guardar-modal').textContent = edicion ? 'Guardar Cambios' : 'Crear Tarea';
  document.getElementById('m-salon').disabled = edicion;
  document.getElementById('m-ciclo').disabled = edicion;
}

// Abre el mismo modal de "Nueva Tarea", precargado con los datos de la tarea
async function abrirModalEditar(t) {
  tareaEditando = t;
  limpiarErrores();
  configurarModalModo(true);

  document.getElementById('m-titulo').value = t.titulo || '';
  document.getElementById('m-porcentaje').value =
    (t.valor_porcentaje === null || t.valor_porcentaje === undefined) ? '' : String(Number(t.valor_porcentaje));
  document.getElementById('m-descripcion').value = t.descripcion || '';

  // Al editar no se limita la fecha mínima: una tarea vencida conserva su fecha
  const campoFecha = document.getElementById('m-fecha');
  campoFecha.removeAttribute('min');
  campoFecha.value = String(t.fecha_limite).slice(0, 10);

  // Si el tipo de la tarea no está en la lista (ej. "taller"), se agrega para no perderlo
  const selectTipo = document.getElementById('m-tipo');
  const tipoActual = t.tipo || 'tarea';
  const existe = Array.from(selectTipo.options).some(function (op) { return op.value === tipoActual; });
  if (!existe) {
    const opTipo = crear('option', '', tipoActual);
    opTipo.value = tipoActual;
    selectTipo.appendChild(opTipo);
  }
  selectTipo.value = tipoActual;

  document.getElementById('m-salon').value = String(t.salon_id);
  pintarArchivoActual(t.archivo_nombre);

  modal.classList.remove('oculto');
  document.getElementById('m-titulo').focus();

  // Salón y ciclo quedan bloqueados, pero se muestran los de la tarea
  await cargarCiclosModal(String(t.salon_id));
  if (tareaEditando === t) document.getElementById('m-ciclo').value = String(t.ciclo_id);
}

function abrirModal() {
  tareaEditando = null;
  configurarModalModo(false);
  limpiarErrores();
  document.getElementById('m-titulo').value = '';
  document.getElementById('m-porcentaje').value = '';
  document.getElementById('m-fecha').value = '';
  document.getElementById('m-fecha').min = hoyISO();
  document.getElementById('m-tipo').value = 'tarea';
  document.getElementById('m-descripcion').value = '';
  pintarArchivoActual(null);

  // Salón sugerido: el filtrado, o el único que tenga el docente
  let sugerido = '';
  if (filtroSalon !== 'todos') sugerido = filtroSalon;
  else if (salones.length === 1) sugerido = String(salones[0].id);
  document.getElementById('m-salon').value = sugerido;
  cargarCiclosModal(sugerido);

  modal.classList.remove('oculto');
  document.getElementById('m-titulo').focus();
}

function cerrarModal() {
  modal.classList.add('oculto');
  tareaEditando = null;
}

async function crearTarea() {
  limpiarErrores();
  const editando = tareaEditando;   // null = crear, objeto = editar

  const titulo = document.getElementById('m-titulo').value.trim();
  const salonId = document.getElementById('m-salon').value;
  const cicloId = document.getElementById('m-ciclo').value;
  const textoPorc = document.getElementById('m-porcentaje').value.trim();
  const fecha = document.getElementById('m-fecha').value;
  const tipo = document.getElementById('m-tipo').value;
  const descripcion = document.getElementById('m-descripcion').value.trim();

  let valido = true;

  if (!titulo) { ponerError('m-titulo', 'e-titulo', 'Escribe el título de la tarea.'); valido = false; }
  if (!editando && !salonId) { ponerError('m-salon', 'e-salon', 'Selecciona un salón.'); valido = false; }
  if (!editando && !cicloId) { ponerError('m-ciclo', 'e-ciclo', 'Selecciona un ciclo.'); valido = false; }
  if (!fecha) { ponerError('m-fecha', 'e-fecha', 'Selecciona la fecha de vencimiento.'); valido = false; }
  if (!descripcion) { ponerError('m-descripcion', 'e-descripcion', 'Escribe una descripción.'); valido = false; }

  const archivo = document.getElementById('m-archivo').files[0] || null;
  if (archivo) {
    const ext = archivo.name.split('.').pop().toLowerCase();
    if (EXT_MATERIAL.indexOf(ext) === -1) {
      ponerError('m-archivo', 'e-archivo', 'Formato no permitido. Usa PDF, Word, PowerPoint, Excel, JPG, PNG o MP3.');
      valido = false;
    } else if (archivo.size > MAX_MATERIAL) {
      ponerError('m-archivo', 'e-archivo', 'El archivo supera los 20 MB.');
      valido = false;
    }
  }

  let porcentaje = null;
  if (textoPorc !== '') {
    porcentaje = Number(textoPorc);
    if (isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      ponerError('m-porcentaje', 'e-porcentaje', 'Debe ser un número entre 0 y 100.');
      valido = false;
    }
  }

  if (!valido) return;

  const cuerpo = {
    titulo: titulo,
    descripcion: descripcion,
    fecha_limite: fecha,
    tipo: tipo
  };
  // Al crear se envían salón y ciclo; al editar no se pueden cambiar
  if (!editando) {
    cuerpo.salon_id = Number(salonId);
    cuerpo.ciclo_id = Number(cicloId);
  }
  if (porcentaje !== null) cuerpo.valor_porcentaje = porcentaje;

  const btn = document.getElementById('btn-guardar-modal');
  btn.disabled = true;
  btn.textContent = editando ? 'Guardando...' : 'Creando...';

  try {
    const res = editando
      ? await apiFetch('/docentes/tareas/' + editando.id, { method: 'PUT', body: cuerpo })
      : await apiFetch('/docentes/tareas', { method: 'POST', body: cuerpo });

    if (res && res.ok) {
      // La tarea ya quedó guardada; ahora se sube (o se quita) el archivo adjunto
      const idTarea = editando ? editando.id : (res.datos && res.datos.tarea && res.datos.tarea.id);
      let errorArchivo = null;
      if (archivo && idTarea) {
        btn.textContent = 'Subiendo archivo...';
        errorArchivo = await subirArchivoTarea(idTarea, archivo);
      } else if (editando && quitarArchivo) {
        const r = await apiFetch('/docentes/tareas/' + idTarea + '/archivo', { method: 'DELETE' });
        if (!r || !r.ok) errorArchivo = (r && r.datos && r.datos.mensaje) || 'No se pudo quitar el archivo.';
      }

      cerrarModal();
      await cargarTareas();
      pintarLista();
      cargarRecientes();
      if (errorArchivo) {
        mostrarAlerta('error', (editando ? 'La tarea se actualizó' : 'La tarea se creó') +
          ', pero hubo un problema con el archivo: ' + errorArchivo + ' Puedes intentarlo de nuevo con "Editar".');
      } else {
        mostrarAlerta('exito', editando ? 'Tarea actualizada correctamente.' : 'Tarea creada correctamente.');
      }
    } else {
      const general = document.getElementById('e-general');
      general.textContent = (res && res.datos && res.datos.mensaje) || (editando ? 'No se pudo actualizar la tarea.' : 'No se pudo crear la tarea.');
      general.style.display = 'block';
    }
  } catch (err) {
    console.error(err);
    const general = document.getElementById('e-general');
    general.textContent = 'No se pudo conectar con el servidor.';
    general.style.display = 'block';
  }

  btn.disabled = false;
  btn.textContent = editando ? 'Guardar Cambios' : 'Crear Tarea';
}

// Sube la guía o taller de una tarea. Devuelve null si salió bien o el mensaje de error.
async function subirArchivoTarea(idTarea, archivo) {
  // multipart/form-data: NO se fija Content-Type, el navegador lo pone
  const formulario = new FormData();
  formulario.append('archivo', archivo);
  try {
    const respuesta = await fetch(API + '/docentes/tareas/' + idTarea + '/archivo', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formulario
    });
    if (respuesta.status === 401) {
      sessionStorage.clear();
      window.location.href = '../auth/login.html';
      return 'Tu sesión expiró.';
    }
    if (respuesta.ok) return null;
    let datos = null;
    try { datos = await respuesta.json(); } catch (err) { /* sin cuerpo JSON */ }
    return (datos && datos.mensaje) || 'No se pudo subir el archivo.';
  } catch (err) {
    console.error(err);
    return 'No se pudo conectar con el servidor.';
  }
}

document.getElementById('btn-nueva-tarea').addEventListener('click', abrirModal);
document.getElementById('btn-cerrar-modal').addEventListener('click', cerrarModal);
document.getElementById('btn-cancelar-modal').addEventListener('click', cerrarModal);
document.getElementById('btn-guardar-modal').addEventListener('click', crearTarea);
document.getElementById('m-salon').addEventListener('change', function () {
  cargarCiclosModal(this.value);
});
modal.addEventListener('click', function (e) {
  if (e.target === modal) cerrarModal();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !modal.classList.contains('oculto')) cerrarModal();
});

// ── 12. ENTREGAS: MODAL "VER ENTREGAS" Y TABLA DE RECIENTES ─
// Estados de una entrega (los define el backend): 'entregada' y 'calificada'
const modalEntregas = document.getElementById('modal-entregas');
let tareaAbierta = null;
let entregasAbiertas = [];
let recientes = [];          // { tarea, entrega } de todas las tareas con entregas

function inicial(texto) {
  return String(texto || '?').trim().charAt(0).toUpperCase();
}

function crearBadgeEntrega(estado) {
  if (estado === 'calificada') return crear('span', 'badge-estado revisado', 'Calificada');
  if (estado === 'entregada') return crear('span', 'badge-estado entregado', 'Entregada');
  return crear('span', 'badge-estado pendiente', 'Sin entregar');
}

function crearCeldaEstudiante(nombreAlumno) {
  const td = crear('td');
  const info = crear('div', 'estudiante-info');
  info.appendChild(crear('div', 'avatar-mini', inicial(nombreAlumno)));
  info.appendChild(document.createTextNode(nombreAlumno));
  td.appendChild(info);
  return td;
}

function mostrarErrorEntregas(texto) {
  const span = document.getElementById('e-entregas');
  span.textContent = texto;
  span.style.display = texto ? 'block' : 'none';
}

// Descarga el archivo de una entrega. Un <a href> no puede enviar el token,
// por eso se pide con fetch y el resultado (blob) se guarda con un enlace temporal.
async function descargarArchivo(e, btn) {
  mostrarErrorEntregas('');
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Descargando...';

  try {
    const respuesta = await fetch(API + '/entregas/' + e.id_entrega + '/archivo', {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (respuesta.status === 401) {
      sessionStorage.clear();
      window.location.href = '../auth/login.html';
      return;
    }

    if (!respuesta.ok) {
      // 403 (sin permiso), 404 (el archivo ya no está), etc.: el backend manda un JSON con "mensaje"
      let mensaje = 'No se pudo descargar el archivo.';
      try {
        const datos = await respuesta.json();
        if (datos && datos.mensaje) mensaje = datos.mensaje;
      } catch (err) { /* sin cuerpo JSON */ }
      mostrarErrorEntregas(mensaje);
      return;
    }

    // Nombre sugerido por el servidor (entrega-<id>.<extensión>)
    let nombreArchivo = 'entrega-' + e.id_entrega;
    const cabecera = respuesta.headers.get('Content-Disposition') || '';
    const coincide = /filename="?([^";]+)"?/i.exec(cabecera);
    if (coincide) nombreArchivo = coincide[1];

    const blob = await respuesta.blob();
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

  } catch (err) {
    console.error(err);
    mostrarErrorEntregas('No se pudo conectar con el servidor.');
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

function crearFilaEntrega(e) {
  const tr = crear('tr');
  tr.appendChild(crearCeldaEstudiante(e.nombre_completo));

  const tdFecha = crear('td', '', e.id_entrega ? fmtFecha(e.fecha_entrega) : '\u2014');
  tr.appendChild(tdFecha);

  const tdEstado = crear('td');
  tdEstado.appendChild(crearBadgeEntrega(e.id_entrega ? e.estado_entrega : null));
  tr.appendChild(tdEstado);

  // Sin entrega: no hay nada que calificar
  if (!e.id_entrega) {
    const td = crear('td', '', 'El estudiante aún no entrega.');
    td.colSpan = 3;
    td.style.color = 'var(--gris-texto)';
    td.style.fontSize = '0.8rem';
    tr.appendChild(td);
    return tr;
  }

  const inputNota = crear('input', 'input-nota');
  inputNota.type = 'number';
  inputNota.min = '0';
  inputNota.max = '5';
  inputNota.step = '0.1';
  inputNota.value = (e.calificacion === null || e.calificacion === undefined) ? '' : Number(e.calificacion);
  const tdNota = crear('td');
  tdNota.appendChild(inputNota);
  tr.appendChild(tdNota);

  const inputCom = crear('input', 'input-nota');
  inputCom.type = 'text';
  inputCom.maxLength = 500;
  inputCom.placeholder = 'Retroalimentación...';
  inputCom.value = e.retroalimentacion || '';
  inputCom.style.width = '220px';
  inputCom.style.textAlign = 'left';
  const tdCom = crear('td');
  tdCom.appendChild(inputCom);
  tr.appendChild(tdCom);

  const btn = crear('button', 'btn-calificar', 'Guardar');
  btn.addEventListener('click', function () { guardarCalificacion(e, inputNota, inputCom, btn, tdEstado); });
  const tdAcc = crear('td');
  tdAcc.appendChild(btn);
  // Descargar el archivo que entregó el estudiante (si lo hay)
  if (e.archivo_url) {
    const btnDescargar = crear('button', 'btn-calificar', 'Descargar');
    btnDescargar.style.marginLeft = '6px';
    btnDescargar.addEventListener('click', function () { descargarArchivo(e, btnDescargar); });
    tdAcc.appendChild(btnDescargar);
  }
  tr.appendChild(tdAcc);

  return tr;
}

function pintarModalEntregas() {
  const tbody = document.getElementById('tbody-modal-entregas');
  tbody.innerHTML = '';

  if (entregasAbiertas.length === 0) {
    const tr = crear('tr');
    const td = crear('td', '', 'Este salón no tiene estudiantes con matrícula activa.');
    td.colSpan = 6;
    td.style.padding = '24px';
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  entregasAbiertas.forEach(function (e) { tbody.appendChild(crearFilaEntrega(e)); });
}

async function abrirEntregas(t) {
  tareaAbierta = t;
  entregasAbiertas = [];
  mostrarErrorEntregas('');
  document.getElementById('entregas-titulo').textContent = 'Entregas: ' + t.titulo;
  document.getElementById('entregas-subtitulo').textContent =
    t.salon_nombre + ' \u2022 Vence: ' + fmtFecha(t.fecha_limite) + ' \u2022 Ciclo ' + t.numero_ciclo;

  const tbody = document.getElementById('tbody-modal-entregas');
  tbody.innerHTML = '';
  const tr = crear('tr');
  const td = crear('td', '', 'Cargando entregas...');
  td.colSpan = 6;
  td.style.padding = '24px';
  td.style.textAlign = 'center';
  tr.appendChild(td);
  tbody.appendChild(tr);

  modalEntregas.classList.remove('oculto');

  try {
    const res = await apiFetch('/docentes/tareas/' + t.id + '/entregas');
    if (res && res.ok && res.datos && Array.isArray(res.datos.entregas)) {
      entregasAbiertas = res.datos.entregas;
      pintarModalEntregas();
    } else {
      tbody.innerHTML = '';
      mostrarErrorEntregas((res && res.datos && res.datos.mensaje) || 'No se pudieron cargar las entregas.');
    }
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '';
    mostrarErrorEntregas('No se pudo conectar con el servidor.');
  }
}

function cerrarEntregas() {
  modalEntregas.classList.add('oculto');
  tareaAbierta = null;
}

async function guardarCalificacion(e, inputNota, inputCom, btn, tdEstado) {
  mostrarErrorEntregas('');

  const textoNota = inputNota.value.trim();
  const comentario = inputCom.value.trim();
  const cuerpo = {};

  if (textoNota !== '') {
    const nota = Number(textoNota);
    if (isNaN(nota) || nota < 0 || nota > 5) {
      mostrarErrorEntregas('La nota debe ser un número entre 0 y 5.');
      inputNota.focus();
      return;
    }
    cuerpo.calificacion = nota;
  }
  // El backend conserva lo anterior si no llega el campo (no se puede borrar un comentario)
  if (comentario !== '') cuerpo.retroalimentacion = comentario;

  if (cuerpo.calificacion === undefined && cuerpo.retroalimentacion === undefined) {
    mostrarErrorEntregas('Escribe una nota o un comentario para ' + e.nombre_completo + '.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const res = await apiFetch('/docentes/entregas/' + e.id_entrega, { method: 'PUT', body: cuerpo });

    if (res && res.ok && res.datos && res.datos.entrega) {
      const nueva = res.datos.entrega;
      e.calificacion = nueva.calificacion;
      e.retroalimentacion = nueva.retroalimentacion;
      e.estado_entrega = nueva.estado;

      tdEstado.innerHTML = '';
      tdEstado.appendChild(crearBadgeEntrega(e.estado_entrega));
      btn.textContent = 'Guardado \u2713';
      btn.classList.add('guardado');
      setTimeout(function () {
        btn.textContent = 'Guardar';
        btn.classList.remove('guardado');
        btn.disabled = false;
      }, 1500);
      pintarRecientes();
      return;
    }
    mostrarErrorEntregas((res && res.datos && res.datos.mensaje) || 'No se pudo guardar la calificación.');
  } catch (err) {
    console.error(err);
    mostrarErrorEntregas('No se pudo conectar con el servidor.');
  }

  btn.textContent = 'Guardar';
  btn.disabled = false;
}

// Entregas recientes: se piden solo las tareas que ya tienen entregas
async function cargarRecientes() {
  const conEntregas = tareas.filter(function (t) { return Number(t.total_entregas) > 0; });

  const resultados = await Promise.all(conEntregas.map(function (t) {
    return apiFetch('/docentes/tareas/' + t.id + '/entregas')
      .then(function (res) { return { tarea: t, res: res }; })
      .catch(function (err) { console.error(err); return { tarea: t, res: null }; });
  }));

  const lista = [];
  resultados.forEach(function (r) {
    if (r.res && r.res.ok && r.res.datos && Array.isArray(r.res.datos.entregas)) {
      r.res.datos.entregas.forEach(function (e) {
        if (e.id_entrega) lista.push({ tarea: r.tarea, entrega: e });
      });
    }
  });

  lista.sort(function (a, b) {
    return String(b.entrega.fecha_entrega).localeCompare(String(a.entrega.fecha_entrega));
  });
  recientes = lista;
  pintarRecientes();
}

function pintarRecientes() {
  const tbody = document.getElementById('tbody-entregas');
  tbody.innerHTML = '';

  const visibles = recientes.filter(function (r) {
    return filtroSalon === 'todos' || String(r.tarea.salon_id) === filtroSalon;
  }).slice(0, 10);

  document.getElementById('conteo-entregas').textContent = plural(visibles.length, 'entrega', 'entregas');

  if (visibles.length === 0) {
    const tr = crear('tr');
    const td = crear('td', '', 'Todavía no hay entregas de tus estudiantes.');
    td.colSpan = 7;
    td.style.padding = '24px';
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  visibles.forEach(function (r) {
    const e = r.entrega;
    const tr = crear('tr');
    tr.appendChild(crearCeldaEstudiante(e.nombre_completo));
    tr.appendChild(crear('td', 'tarea-nombre-td', r.tarea.titulo));
    tr.appendChild(crear('td', '', r.tarea.salon_nombre));
    tr.appendChild(crear('td', '', fmtFecha(e.fecha_entrega)));

    const tdEstado = crear('td');
    tdEstado.appendChild(crearBadgeEntrega(e.estado_entrega));
    tr.appendChild(tdEstado);

    tr.appendChild(crear('td', '', (e.calificacion === null || e.calificacion === undefined) ? '\u2014' : String(Number(e.calificacion))));

    const tdAcc = crear('td');
    const btn = crear('button', 'btn-calificar', e.estado_entrega === 'calificada' ? 'Ver' : 'Calificar');
    btn.addEventListener('click', function () { abrirEntregas(r.tarea); });
    tdAcc.appendChild(btn);
    tr.appendChild(tdAcc);

    tbody.appendChild(tr);
  });
}

document.getElementById('btn-cerrar-entregas').addEventListener('click', cerrarEntregas);
document.getElementById('btn-cerrar-entregas-pie').addEventListener('click', cerrarEntregas);
modalEntregas.addEventListener('click', function (e) {
  if (e.target === modalEntregas) cerrarEntregas();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !modalEntregas.classList.contains('oculto')) cerrarEntregas();
});

// ── 14. MATERIAL DE APOYO ───────────────────────────────────
const modalMaterial = document.getElementById('modal-material');
let material = [];   // material de todos los salones del docente

const EXT_MATERIAL = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'mp3'];
const MAX_MATERIAL = 20 * 1024 * 1024; // 20 MB (igual que el servidor)

const CAMPOS_ERROR_MAT = [
  ['mat-titulo', 'e-mat-titulo'],
  ['mat-salon', 'e-mat-salon'],
  ['mat-ciclo', 'e-mat-ciclo'],
  ['mat-archivo', 'e-mat-archivo']
];

async function cargarMaterial() {
  const resultados = await Promise.all(salones.map(function (s) {
    return apiFetch('/docentes/salones/' + s.id + '/material')
      .then(function (res) { return { salon: s, res: res }; })
      .catch(function (err) { console.error(err); return { salon: s, res: null }; });
  }));

  const lista = [];
  resultados.forEach(function (r) {
    if (r.res && r.res.ok && r.res.datos && Array.isArray(r.res.datos.material)) {
      r.res.datos.material.forEach(function (m) {
        m.salon_id = r.salon.id;
        m.salon_nombre = r.salon.nombre;
        lista.push(m);
      });
    }
  });

  // Más recientes primero
  lista.sort(function (a, b) {
    return String(b.subido_en).localeCompare(String(a.subido_en));
  });
  material = lista;
}

function pintarMaterial() {
  const tbody = document.getElementById('tbody-material');
  tbody.innerHTML = '';

  const visibles = material.filter(function (m) {
    return filtroSalon === 'todos' || String(m.salon_id) === filtroSalon;
  });

  document.getElementById('conteo-material').textContent = plural(visibles.length, 'archivo', 'archivos');

  if (visibles.length === 0) {
    const tr = crear('tr');
    const td = crear('td', '', salones.length === 0
      ? 'Cuando la administración te asigne un salón, podrás subir material aquí.'
      : 'Todavía no has subido material. Usa "+ Subir Material" para agregar el primero.');
    td.colSpan = 7;
    td.style.padding = '24px';
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  visibles.forEach(function (m) {
    const tr = crear('tr');
    tr.appendChild(crear('td', 'tarea-nombre-td', m.titulo));
    tr.appendChild(crear('td', '', m.salon_nombre));
    tr.appendChild(crear('td', '', 'Ciclo ' + m.numero_ciclo));
    tr.appendChild(crear('td', '', String(m.tipo || '').toUpperCase() || '\u2014'));
    tr.appendChild(crear('td', '', fmtFecha(m.subido_en)));

    const tdVis = crear('td');
    tdVis.appendChild(m.publico
      ? crear('span', 'badge-estado activo', 'Visible')
      : crear('span', 'badge-estado pendiente', 'Oculto'));
    tr.appendChild(tdVis);

    const tdAcc = crear('td');
    const btn = crear('button', 'btn-calificar', 'Descargar');
    btn.addEventListener('click', function () { descargarMaterial(m, btn); });
    tdAcc.appendChild(btn);
    const btnEliminarMat = crear('button', 'btn-calificar', 'Eliminar');
    btnEliminarMat.style.marginLeft = '8px';
    btnEliminarMat.style.color = '#c0392b';
    btnEliminarMat.style.borderColor = '#c0392b';
    btnEliminarMat.addEventListener('click', function () { eliminarMaterialDocente(m, btnEliminarMat); });
    tdAcc.appendChild(btnEliminarMat);
    tr.appendChild(tdAcc);

    tbody.appendChild(tr);
  });
}

// Igual que con las entregas: fetch con token -> blob -> enlace temporal
function descargarMaterial(m, btn) {
  return descargarArchivo('/material/' + m.id + '/archivo', 'material-' + m.id, btn);
}

async function descargarArchivo(ruta, nombrePorDefecto, btn) {
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Descargando...';

  try {
    const respuesta = await fetch(API + ruta, {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (respuesta.status === 401) {
      sessionStorage.clear();
      window.location.href = '../auth/login.html';
      return;
    }

    if (!respuesta.ok) {
      let mensaje = 'No se pudo descargar el archivo.';
      try {
        const datos = await respuesta.json();
        if (datos && datos.mensaje) mensaje = datos.mensaje;
      } catch (err) { /* sin cuerpo JSON */ }
      mostrarAlerta('error', mensaje);
      return;
    }

    let nombreArchivo = nombrePorDefecto;
    const cabecera = respuesta.headers.get('Content-Disposition') || '';
    const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cabecera);
    const coincide = /filename="?([^";]+)"?/i.exec(cabecera);
    if (utf8) nombreArchivo = decodeURIComponent(utf8[1]);
    else if (coincide) nombreArchivo = coincide[1];

    const blob = await respuesta.blob();
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

  } catch (err) {
    console.error(err);
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

// Elimina un material (borra la fila y el archivo en el servidor)
async function eliminarMaterialDocente(m, btn) {
  if (!window.confirm('¿Eliminar el material "' + m.titulo + '"? Los alumnos ya no podrán descargarlo y esta acción no se puede deshacer.')) return;

  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Eliminando...';

  try {
    const res = await apiFetch('/docentes/material/' + m.id, { method: 'DELETE' });
    if (!res) return;   // el token venció: apiFetch ya redirigió al login

    if (res.ok) {
      await cargarMaterial();
      pintarMaterial();
      mostrarAlerta('exito', 'Material eliminado correctamente.');
    } else {
      mostrarAlerta('error', (res.datos && res.datos.mensaje) || 'No se pudo eliminar el material.');
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  } catch (err) {
    console.error(err);
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

// ── Modal "Subir material" ──
function limpiarErroresMaterial() {
  CAMPOS_ERROR_MAT.forEach(function (par) {
    document.getElementById(par[0]).classList.remove('invalido');
    const span = document.getElementById(par[1]);
    span.textContent = '';
    span.style.display = 'none';
  });
  const general = document.getElementById('e-mat-general');
  general.textContent = '';
  general.style.display = 'none';
}

function errorGeneralMaterial(texto) {
  const general = document.getElementById('e-mat-general');
  general.textContent = texto;
  general.style.display = 'block';
}

async function cargarCiclosMaterial(salonId) {
  const select = document.getElementById('mat-ciclo');
  select.innerHTML = '';

  if (!salonId) {
    select.appendChild(crear('option', '', 'Selecciona primero un salón')).value = '';
    return;
  }

  select.appendChild(crear('option', '', 'Cargando ciclos...')).value = '';

  let ciclos = ciclosPorSalon[salonId];
  if (!ciclos) {
    try {
      // Los ciclos del salón vienen en el GET de notas (misma caché del modal de tareas)
      const res = await apiFetch('/docentes/salones/' + salonId + '/notas');
      if (res && res.ok && res.datos) {
        ciclos = res.datos.ciclos || [];
        ciclosPorSalon[salonId] = ciclos;
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Si mientras tanto eligió otro salón, no pisar su lista
  if (document.getElementById('mat-salon').value !== String(salonId)) return;

  select.innerHTML = '';

  if (!ciclos) {
    select.appendChild(crear('option', '', 'No se pudieron cargar los ciclos')).value = '';
    return;
  }
  if (ciclos.length === 0) {
    select.appendChild(crear('option', '', 'Este salón no tiene ciclos')).value = '';
    return;
  }

  select.appendChild(crear('option', '', 'Selecciona un ciclo')).value = '';
  ciclos.forEach(function (c) {
    const op = crear('option', '', 'Ciclo ' + c.numero_ciclo);
    op.value = c.id;
    select.appendChild(op);
  });

  const salon = salones.find(function (s) { return String(s.id) === String(salonId); });
  const actual = salon ? ciclos.find(function (c) { return c.numero_ciclo === salon.ciclo_actual; }) : null;
  if (actual) select.value = actual.id;
  else if (ciclos.length === 1) select.value = ciclos[0].id;
}

function abrirModalMaterial() {
  limpiarErroresMaterial();
  document.getElementById('mat-titulo').value = '';
  document.getElementById('mat-archivo').value = '';

  // Salón sugerido: el filtrado, o el único que tenga el docente
  let sugerido = '';
  if (filtroSalon !== 'todos') sugerido = filtroSalon;
  else if (salones.length === 1) sugerido = String(salones[0].id);
  document.getElementById('mat-salon').value = sugerido;
  cargarCiclosMaterial(sugerido);

  modalMaterial.classList.remove('oculto');
  document.getElementById('mat-titulo').focus();
}

function cerrarModalMaterial() {
  modalMaterial.classList.add('oculto');
}

async function subirMaterial() {
  limpiarErroresMaterial();

  const titulo = document.getElementById('mat-titulo').value.trim();
  const salonId = document.getElementById('mat-salon').value;
  const cicloId = document.getElementById('mat-ciclo').value;
  const archivo = document.getElementById('mat-archivo').files[0];

  let valido = true;
  if (!titulo) { ponerError('mat-titulo', 'e-mat-titulo', 'Escribe el título del material.'); valido = false; }
  if (!salonId) { ponerError('mat-salon', 'e-mat-salon', 'Selecciona un salón.'); valido = false; }
  if (!cicloId) { ponerError('mat-ciclo', 'e-mat-ciclo', 'Selecciona un ciclo.'); valido = false; }

  if (!archivo) {
    ponerError('mat-archivo', 'e-mat-archivo', 'Selecciona un archivo.');
    valido = false;
  } else {
    const ext = archivo.name.split('.').pop().toLowerCase();
    if (EXT_MATERIAL.indexOf(ext) === -1) {
      ponerError('mat-archivo', 'e-mat-archivo', 'Formato no permitido.');
      valido = false;
    } else if (archivo.size > MAX_MATERIAL) {
      ponerError('mat-archivo', 'e-mat-archivo', 'El archivo supera los 20 MB.');
      valido = false;
    }
  }
  if (!valido) return;

  // multipart/form-data: NO se fija Content-Type, el navegador lo pone
  const formulario = new FormData();
  formulario.append('titulo', titulo);
  formulario.append('salon_id', salonId);
  formulario.append('ciclo_id', cicloId);
  formulario.append('archivo', archivo);

  const btn = document.getElementById('btn-guardar-material');
  btn.disabled = true;
  btn.textContent = 'Subiendo...';

  try {
    const respuesta = await fetch(API + '/docentes/material', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formulario
    });

    if (respuesta.status === 401) {
      sessionStorage.clear();
      window.location.href = '../auth/login.html';
      return;
    }

    let datos = null;
    try { datos = await respuesta.json(); } catch (err) { /* sin cuerpo JSON */ }

    if (respuesta.ok) {
      cerrarModalMaterial();
      await cargarMaterial();
      pintarMaterial();
      mostrarAlerta('exito', 'Material subido correctamente.');
    } else {
      errorGeneralMaterial((datos && datos.mensaje) || 'No se pudo subir el material.');
    }
  } catch (err) {
    console.error(err);
    errorGeneralMaterial('No se pudo conectar con el servidor.');
  }

  btn.disabled = false;
  btn.textContent = 'Subir Material';
}

document.getElementById('btn-subir-material').addEventListener('click', abrirModalMaterial);
document.getElementById('btn-cerrar-material').addEventListener('click', cerrarModalMaterial);
document.getElementById('btn-cancelar-material').addEventListener('click', cerrarModalMaterial);
document.getElementById('btn-guardar-material').addEventListener('click', subirMaterial);
document.getElementById('mat-salon').addEventListener('change', function () {
  cargarCiclosMaterial(this.value);
});
modalMaterial.addEventListener('click', function (e) {
  if (e.target === modalMaterial) cerrarModalMaterial();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !modalMaterial.classList.contains('oculto')) cerrarModalMaterial();
});

// ── 13. ARRANCAR ────────────────────────────────────────────
async function iniciar() {
  try {
    const res = await apiFetch('/docentes/salones');
    salones = (res && res.datos && res.datos.salones) ? res.datos.salones : [];
  } catch (err) {
    console.error('Error al cargar los salones:', err);
  }

  llenarSelectores();

  if (salones.length === 0) {
    document.getElementById('btn-nueva-tarea').disabled = true;
    document.getElementById('btn-subir-material').disabled = true;
    pintarSidebar();
    pintarLista();
    pintarMaterial();
    return;
  }

  // Salón elegido: ?salon=<id>; si no existe, se muestran todos
  const pedido = parseInt(new URLSearchParams(window.location.search).get('salon'), 10);
  if (salones.some(function (s) { return s.id === pedido; })) {
    filtroSalon = String(pedido);
    document.getElementById('select-salon').value = filtroSalon;
  }

  pintarSidebar();
  actualizarAccesos();

  try {
    await cargarTareas();
  } catch (err) {
    console.error('Error al cargar las tareas:', err);
    mostrarAlerta('error', 'No se pudieron cargar las tareas.');
  }
  pintarLista();

  try {
    await cargarRecientes();
  } catch (err) {
    console.error('Error al cargar las entregas recientes:', err);
  }

  try {
    await cargarMaterial();
  } catch (err) {
    console.error('Error al cargar el material:', err);
  }
  pintarMaterial();
}

if (sesionValida) iniciar();