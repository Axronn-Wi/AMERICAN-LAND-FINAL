/* ============================================================
   tareas.js
   Instituto American Land
   Ubicación: assets/js/tareas.js
============================================================ */

const API = window.location.origin + '/api';

// ── 1. VERIFICAR SESIÓN ─────────────────────────────────────
const token = sessionStorage.getItem('token');
const rol   = sessionStorage.getItem('rol');
const sesionValida = !!token && rol === 'estudiante';

if (!sesionValida) {
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
// Devuelve { ok, datos } o null si la sesión expiró (401).
// Si el body es FormData NO se fija Content-Type: el navegador lo pone.
async function apiFetch(ruta, opciones) {
  const config = opciones || {};
  config.headers = Object.assign({}, config.headers, { 'Authorization': 'Bearer ' + token });

  const respuesta = await fetch(API + ruta, config);
  if (respuesta.status === 401) {
    sessionStorage.clear();
    window.location.href = '../auth/login.html';
    return null;
  }

  let datos = {};
  try { datos = await respuesta.json(); } catch (e) { datos = {}; }
  return { ok: respuesta.ok, datos: datos };
}

// ── 5. UTILIDADES ───────────────────────────────────────────
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function crear(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

// "2026-10-10T00:00:00.000Z" -> "10 Oct 2026" (en UTC, para que no cambie el día)
function fmtFecha(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  if (isNaN(d)) return '';
  return d.getUTCDate() + ' ' + MESES[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

function mayuscula(texto) {
  const t = String(texto || '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// La BD guarda 'entregada' y 'calificada'; la pantalla usa
// pendiente | entregado | revisado (los mismos data-estado de los filtros)
function estadoDe(t) {
  if (!t.estado_entrega) return 'pendiente';
  const e = String(t.estado_entrega).toLowerCase();
  if (e === 'entregada') return 'entregado';
  if (e === 'calificada') return 'revisado';
  return e;
}

// Compara solo la fecha (AAAA-MM-DD), igual que el servidor:
// el último día todavía se puede entregar.
function estaVencida(t) {
  if (!t.fecha_limite) return false;
  const hoy = new Date();
  const hoyTexto = hoy.getFullYear() + '-' +
    String(hoy.getMonth() + 1).padStart(2, '0') + '-' +
    String(hoy.getDate()).padStart(2, '0');
  return String(t.fecha_limite).substring(0, 10) < hoyTexto;
}

function iconoDe(t) {
  const tipo = String(t.tipo || '').toLowerCase();
  return (tipo.indexOf('oral') !== -1 || tipo.indexOf('exposi') !== -1) ? '🎙' : '📝';
}

// Aviso temporal (éxito / error) sobre las tarjetas
function mostrarAviso(texto, esError) {
  const anterior = document.getElementById('aviso-tareas');
  if (anterior) anterior.remove();

  const aviso = crear('p', '', texto);
  aviso.id = 'aviso-tareas';
  aviso.style.padding = '12px 16px';
  aviso.style.borderRadius = '8px';
  aviso.style.marginBottom = '16px';
  aviso.style.fontWeight = '600';
  aviso.style.background = esError ? '#fde8e8' : '#e6f6ec';
  aviso.style.color = esError ? '#b42318' : '#157347';

  const primeraCard = document.querySelector('main.contenido .card-seccion');
  primeraCard.parentNode.insertBefore(aviso, primeraCard);
  setTimeout(function () { aviso.remove(); }, 6000);
}

// ── 6. ESTADO ───────────────────────────────────────────────
let tareas = [];
let filtroActual = 'todos';
let tareaActual = null;       // tarea que se está entregando en el modal
let archivoElegido = null;    // archivo seleccionado en el modal

const EXTENSIONES = ['pdf', 'doc', 'docx', 'ppt', 'pptx'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB (igual que el servidor)

// ── 7. RESUMEN (Pendientes / Entregadas / Total) ────────────
function pintarResumen() {
  const pendientes = tareas.filter(function (t) { return estadoDe(t) === 'pendiente'; }).length;
  document.getElementById('num-pendientes').textContent = pendientes;
  document.getElementById('num-entregadas').textContent = tareas.length - pendientes;
  document.getElementById('num-total').textContent = tareas.length;
}

// ── 8. LISTA DE ENTREGAS ────────────────────────────────────
function tarjeta(t) {
  const estado = estadoDe(t);
  const vencida = estado === 'pendiente' && estaVencida(t);

  const card = crear('div', 'entrega-card');
  card.dataset.estado = estado;

  const info = crear('div', 'entrega-info');
  info.appendChild(crear('div', 'entrega-icono', iconoDe(t)));
  const detalle = crear('div', 'entrega-detalle');
  detalle.appendChild(crear('p', 'entrega-nombre', t.titulo || 'Tarea'));

  const partes = [];
  if (t.tipo) partes.push(mayuscula(t.tipo));
  if (t.valor_porcentaje !== null && t.valor_porcentaje !== undefined) partes.push(t.valor_porcentaje + '%');
  if (estado === 'pendiente') {
    partes.push((vencida ? 'Venció el ' : 'Vence el ') + fmtFecha(t.fecha_limite));
  } else if (t.fecha_entrega) {
    partes.push('Entregado el ' + fmtFecha(t.fecha_entrega));
  }
  if (estado === 'revisado' && t.calificacion !== null && t.calificacion !== undefined) {
    partes.push('Calificación ' + parseFloat(t.calificacion).toFixed(1));
  }
  detalle.appendChild(crear('p', 'entrega-meta', partes.join('  ·  ')));
  if (t.descripcion) {
    const desc = crear('p', 'entrega-meta', t.descripcion);
    desc.style.marginTop = '4px';
    detalle.appendChild(desc);
  }
  info.appendChild(detalle);
  card.appendChild(info);

  const acciones = crear('div', 'entrega-acciones');
  const claseBadge = estado === 'revisado' ? 'badge-revisado'
                   : estado === 'entregado' ? 'badge-entregado'
                   : 'badge-pendiente';
  acciones.appendChild(crear('span', 'badge ' + claseBadge, vencida ? 'Vencida' : mayuscula(estado)));

  // Solo se puede entregar una tarea pendiente y que no haya vencido
  if (estado === 'pendiente' && !vencida) {
    const btn = crear('button', 'btn-entregar', 'Entregar');
    btn.addEventListener('click', function () { abrirModal(t); });
    acciones.appendChild(btn);
  }
  card.appendChild(acciones);
  return card;
}

function pintarLista() {
  const lista = document.getElementById('lista-entregas');
  lista.innerHTML = '';

  const visibles = tareas.filter(function (t) {
    return filtroActual === 'todos' || estadoDe(t) === filtroActual;
  });

  if (visibles.length === 0) {
    const vacio = crear('p', 'entrega-meta',
      tareas.length === 0
        ? 'Todavía no tienes tareas asignadas.'
        : 'No hay tareas con este estado.');
    vacio.style.padding = '24px';
    vacio.style.textAlign = 'center';
    lista.appendChild(vacio);
    return;
  }

  // Pendientes primero (la más próxima a vencer arriba), luego el resto
  visibles.sort(function (a, b) {
    const pa = estadoDe(a) === 'pendiente' ? 0 : 1;
    const pb = estadoDe(b) === 'pendiente' ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return new Date(a.fecha_limite) - new Date(b.fecha_limite);
  });
  visibles.forEach(function (t) { lista.appendChild(tarjeta(t)); });
}

// ── 9. FILTROS ──────────────────────────────────────────────
document.querySelectorAll('.btn-filtro').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.btn-filtro').forEach(function (b) { b.classList.remove('activo'); });
    btn.classList.add('activo');
    filtroActual = btn.dataset.estado;
    pintarLista();
  });
});

// ── 10. MODAL DE ENTREGA ────────────────────────────────────
const overlay      = document.getElementById('modal-overlay');
const modalTitulo  = document.getElementById('modal-titulo');
const uploadArea   = document.getElementById('upload-area');
const inputArchivo = document.getElementById('input-archivo');
const archivoLabel = document.getElementById('archivo-nombre');
const comentario   = document.getElementById('comentario');
const btnConfirmar = document.getElementById('btn-confirmar');

// La BD no guarda comentario del alumno: queda como "Próximamente"
comentario.disabled = true;
comentario.placeholder = 'Comentario para el profesor: Próximamente';

function mensajeArchivo(texto, esError) {
  archivoLabel.textContent = texto;
  archivoLabel.style.color = esError ? '#b42318' : '';
}

function abrirModal(tarea) {
  tareaActual = tarea;
  archivoElegido = null;
  inputArchivo.value = '';
  mensajeArchivo('', false);
  modalTitulo.textContent = 'Entregar: ' + (tarea.titulo || 'Tarea');
  overlay.classList.add('abierto');
}

function cerrarModal() {
  overlay.classList.remove('abierto');
  tareaActual = null;
  archivoElegido = null;
  inputArchivo.value = '';
  mensajeArchivo('', false);
  btnConfirmar.classList.remove('cargando');
  btnConfirmar.disabled = false;
}

// Valida extensión y tamaño ANTES de enviar (el servidor valida igual)
function elegirArchivo(archivo) {
  archivoElegido = null;
  if (!archivo) { mensajeArchivo('', false); return; }

  const ext = archivo.name.split('.').pop().toLowerCase();
  if (EXTENSIONES.indexOf(ext) === -1) {
    inputArchivo.value = '';
    mensajeArchivo('Formato no permitido. Usa PDF, DOC, DOCX, PPT o PPTX.', true);
    return;
  }
  if (archivo.size > MAX_BYTES) {
    inputArchivo.value = '';
    mensajeArchivo('El archivo supera los 10 MB.', true);
    return;
  }
  archivoElegido = archivo;
  mensajeArchivo(archivo.name, false);
}

uploadArea.addEventListener('click', function (e) {
  if (e.target === inputArchivo) return; // evita un bucle de clics
  inputArchivo.click();
});
inputArchivo.addEventListener('change', function () {
  elegirArchivo(inputArchivo.files[0]);
});

// Arrastrar y soltar
uploadArea.addEventListener('dragover', function (e) { e.preventDefault(); });
uploadArea.addEventListener('drop', function (e) {
  e.preventDefault();
  if (e.dataTransfer.files.length) elegirArchivo(e.dataTransfer.files[0]);
});

document.getElementById('modal-cerrar').addEventListener('click', cerrarModal);
document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
overlay.addEventListener('click', function (e) {
  if (e.target === overlay) cerrarModal();
});

btnConfirmar.addEventListener('click', async function () {
  if (!tareaActual) return;
  if (!archivoElegido) {
    mensajeArchivo('Selecciona un archivo antes de enviar.', true);
    return;
  }

  const formulario = new FormData();
  formulario.append('archivo', archivoElegido); // el servidor espera el campo "archivo"

  btnConfirmar.classList.add('cargando');
  btnConfirmar.disabled = true;

  try {
    const r = await apiFetch('/alumnos/tareas/' + tareaActual.id + '/entrega', {
      method: 'POST',
      body: formulario
    });
    if (!r) return; // sesión expirada

    if (r.ok) {
      cerrarModal();
      mostrarAviso('Tarea entregada correctamente.', false);
      await recargarTareas();
    } else {
      // 400, 409 (ya entregada / vencida), 413 (muy grande)...
      mensajeArchivo(r.datos.mensaje || 'No se pudo entregar la tarea.', true);
      btnConfirmar.classList.remove('cargando');
      btnConfirmar.disabled = false;
      if (r.datos.mensaje && r.datos.mensaje.indexOf('Ya entregaste') === 0) {
        await recargarTareas();
      }
    }
  } catch (err) {
    console.error('Error al entregar la tarea:', err);
    mensajeArchivo('No se pudo conectar con el servidor.', true);
    btnConfirmar.classList.remove('cargando');
    btnConfirmar.disabled = false;
  }
});

// ── 11. MATERIAL DE APOYO ───────────────────────────────────
// GET /alumnos/material -> {material:[{id,salon,numero_ciclo,titulo,tipo,subido_en}]}
// (solo publico=1 y de salones con matrícula activa; sin archivo_url)
function pintarMaterial(materialLista) {
  const grid  = document.getElementById('grid-material');
  const badge = document.getElementById('badge-material');
  if (!grid) return;

  grid.innerHTML = '';

  if (badge) {
    badge.textContent = materialLista.length === 0
      ? 'Sin archivos'
      : materialLista.length + (materialLista.length === 1 ? ' archivo' : ' archivos');
  }

  if (materialLista.length === 0) {
    const vacio = crear('p', 'material-desc', 'Todavía no hay material de apoyo disponible.');
    vacio.style.padding = '24px';
    vacio.style.textAlign = 'center';
    vacio.style.gridColumn = '1 / -1';
    grid.appendChild(vacio);
    return;
  }

  materialLista.forEach(function (m) {
    const card = crear('div', 'material-card');

    const tipo = String(m.tipo || '').toLowerCase();
    const iconoClase = tipo === 'pdf' ? 'material-icono pdf' : 'material-icono';
    card.appendChild(crear('div', iconoClase, tipo ? tipo.toUpperCase() : '?'));

    card.appendChild(crear('p', 'material-nombre', m.titulo || 'Material'));

    const metaPartes = [];
    if (m.salon) metaPartes.push(m.salon);
    if (m.numero_ciclo !== null && m.numero_ciclo !== undefined) metaPartes.push('Ciclo ' + m.numero_ciclo);
    card.appendChild(crear('p', 'material-desc', metaPartes.join('  ·  ')));

    const btn = crear('button', 'btn-descargar', 'Descargar');
    btn.addEventListener('click', function () { descargarMaterial(m, btn); });
    card.appendChild(btn);

    grid.appendChild(card);
  });
}

// Descarga protegida: un <a href> normal no puede enviar el token,
// así que se pide el archivo con fetch + Authorization y se arma un
// enlace temporal con el blob recibido.
async function descargarMaterial(material, btn) {
  if (btn) {
    btn.disabled = true;
    btn.classList.add('descargando');
    btn.textContent = 'Descargando...';
  }

  try {
    const respuesta = await fetch(API + '/material/' + material.id + '/archivo', {
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
      } catch (e) { /* respuesta sin JSON */ }
      mostrarAviso(mensaje, true);
      return;
    }

    const blob = await respuesta.blob();

    let nombreArchivo = (material.titulo || 'material') + (material.tipo ? '.' + material.tipo : '');
    const disposicion = respuesta.headers.get('Content-Disposition');
    if (disposicion) {
      const match = disposicion.match(/filename="?([^"]+)"?/);
      if (match && match[1]) nombreArchivo = match[1];
    }

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error al descargar el material:', err);
    mostrarAviso('No se pudo conectar con el servidor.', true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('descargando');
      btn.textContent = 'Descargar';
    }
  }
}

// ── 12. ARRANCAR ────────────────────────────────────────────
async function recargarTareas() {
  try {
    const r = await apiFetch('/alumnos/tareas');
    tareas = (r && r.datos && r.datos.tareas) ? r.datos.tareas : [];
  } catch (err) {
    console.error('Error al recargar las tareas:', err);
  }
  pintarResumen();
  pintarLista();
}

async function iniciar() {
  let horario  = [];
  let material = [];
  try {
    const r = await Promise.all([
      apiFetch('/alumnos/tareas'),
      apiFetch('/alumnos/horario'),
      apiFetch('/alumnos/material')
    ]);
    tareas   = (r[0] && r[0].datos.tareas)   ? r[0].datos.tareas   : [];
    horario  = (r[1] && r[1].datos.horario)  ? r[1].datos.horario  : [];
    material = (r[2] && r[2].datos.material) ? r[2].datos.material : [];
  } catch (err) {
    console.error('Error al cargar las tareas:', err);
  }

  const salon = horario.length ? horario[0] : null;
  const enlace = document.querySelector('.clase-item a');
  if (enlace) enlace.textContent = salon ? salon.salon : 'Sin salón asignado';
  document.getElementById('texto-subtitulo').textContent =
    salon ? salon.nivel + '  ·  ' + salon.salon : 'Sin matrícula activa';

  pintarResumen();
  pintarLista();
  pintarMaterial(material);
}

if (sesionValida) iniciar();