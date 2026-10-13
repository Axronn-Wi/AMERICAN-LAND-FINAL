/* ============================================================
   inscripcion.js — Flujo de inscripción en línea
   Instituto American Land
   Ubicación: assets/js/inscripcion.js

   Consume el backend (módulo admisiones):
     GET  /api/admisiones/niveles               (público)
     GET  /api/admisiones/niveles/:id/salones   (público)
     POST /api/admisiones/matricula             (token de estudiante)
     POST /api/admisiones/pago                  (token de estudiante)

   IMPORTANTE: abrir la página desde http://localhost:4000/admisiones/inscripcion.html
   (no con Live Server), porque la API se calcula con window.location.origin.
============================================================ */

// ── 0. CONFIGURACIÓN ───────────────────────────────────────

const API = window.location.origin + '/api';

// login.js guarda el token con sessionStorage.setItem('token', ...).
// Si algún día cambias ese nombre en login.js, cámbialo también aquí.
const CLAVE_TOKEN = 'token';

// Guarda la selección en curso para no perderla al ir a iniciar sesión.
const CLAVE_PENDIENTE = 'inscripcionPendiente';

// niveles.html muestra 6 niveles (A1…C2) pero la base de datos tiene 3 grupos
// ordenados por la columna "orden": 0 = Básico, 1 = Intermedio, 2 = Avanzado.
const GRUPO_POR_CODIGO = { A1: 0, A2: 0, B1: 1, B2: 1, C1: 2, C2: 2 };
const RANGOS = ['A1 – A2', 'B1 – B2', 'C1 – C2'];

const estado = {
  niveles: [],
  nivel: null,
  salones: [],
  salon: null,
  matriculaId: null
};

const $ = (id) => document.getElementById(id);


// ── 1. UTILIDADES ──────────────────────────────────────────

// Crea un elemento con texto seguro (textContent evita inyección de HTML)
function el(etiqueta, clase, texto) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined && texto !== null) nodo.textContent = texto;
  return nodo;
}

function moneda(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(Number(valor) || 0);
}

// SQL Server devuelve las columnas TIME como "1970-01-01T18:00:00.000Z":
// la hora real está en UTC, no en la zona horaria del navegador.
function formatearHora(valor) {
  if (!valor) return '';
  let h, m;
  if (/^\d{2}:\d{2}/.test(valor)) {
    [h, m] = valor.split(':').map(Number);
  } else {
    const d = new Date(valor);
    h = d.getUTCHours();
    m = d.getUTCMinutes();
  }
  const sufijo = h >= 12 ? 'PM' : 'AM';
  return ((h + 11) % 12 + 1) + ':' + String(m).padStart(2, '0') + ' ' + sufijo;
}

function formatearFecha(valor) {
  if (!valor) return '—';
  return new Date(valor).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  });
}

// Lee los datos del JWT (id_usuario, rol, correo, exp) solo para decidir qué
// mostrar. La seguridad real la hace el backend con verificarToken.
function datosToken() {
  const token = sessionStorage.getItem(CLAVE_TOKEN);
  if (!token) return null;
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null; // caducado
    return payload;
  } catch (e) {
    return null;
  }
}

// Llamada a la API. Siempre devuelve { ok, status, datos } (no lanza errores).
async function pedir(ruta, opciones) {
  const { metodo = 'GET', cuerpo } = opciones || {};
  const cabeceras = { 'Content-Type': 'application/json' };
  const token = sessionStorage.getItem(CLAVE_TOKEN);
  if (token) cabeceras.Authorization = 'Bearer ' + token;

  let respuesta;
  try {
    respuesta = await fetch(API + ruta, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
  } catch (e) {
    return {
      ok: false, status: 0,
      datos: { mensaje: 'No se pudo conectar con el servidor. Verifica que esté encendido y que abriste la página desde http://localhost:4000.' }
    };
  }

  let datos = {};
  try { datos = await respuesta.json(); } catch (e) { /* respuesta sin JSON */ }
  return { ok: respuesta.ok, status: respuesta.status, datos };
}

function mostrarAlerta(texto, tipo) {
  const caja = $('insc-alerta');
  caja.textContent = texto;
  caja.className = 'insc-alerta' + (tipo === 'info' ? ' info' : '');
  caja.hidden = false;
}

function ocultarAlerta() {
  $('insc-alerta').hidden = true;
}

function guardarPendiente() {
  if (!estado.nivel || !estado.salon) return;
  sessionStorage.setItem(CLAVE_PENDIENTE, JSON.stringify({
    nivelId: estado.nivel.id,
    salonId: estado.salon.id,
    matriculaId: estado.matriculaId
  }));
}

function leerPendiente() {
  try { return JSON.parse(sessionStorage.getItem(CLAVE_PENDIENTE)); }
  catch (e) { return null; }
}


// ── 2. NAVEGACIÓN ENTRE PASOS ──────────────────────────────

function irAPaso(numero) {
  [1, 2, 3].forEach(function (n) {
    $('panel-' + n).hidden = (n !== numero);
  });
  $('panel-exito').hidden = true;

  document.querySelectorAll('.insc-paso').forEach(function (li) {
    const n = Number(li.dataset.paso);
    li.classList.toggle('activo', n === numero);
    li.classList.toggle('completo', n < numero);
  });

  document.querySelector('.insc-pasos-barra').scrollIntoView({ behavior: 'smooth' });
}

document.querySelectorAll('[data-volver]').forEach(function (boton) {
  boton.addEventListener('click', function () {
    ocultarAlerta();
    irAPaso(Number(boton.dataset.volver));
  });
});


// ── 3. PASO 1: NIVELES ─────────────────────────────────────

function pintarNiveles() {
  const contenedor = $('lista-niveles');
  contenedor.replaceChildren();

  estado.niveles.forEach(function (nivel, i) {
    const tarjeta = el('button', 'insc-card');
    tarjeta.type = 'button';
    tarjeta.dataset.id = nivel.id;

    if (RANGOS[i]) tarjeta.append(el('span', 'rango', RANGOS[i]));
    tarjeta.append(
      el('h3', '', nivel.nombre),
      el('p', 'desc', nivel.descripcion || ''),
      el('span', 'meta', nivel.ciclos_totales ? nivel.ciclos_totales + ' ciclos' : ''),
      el('span', 'precio', moneda(nivel.precio))
    );

    tarjeta.addEventListener('click', function () { elegirNivel(nivel); });
    contenedor.append(tarjeta);
  });
}

async function elegirNivel(nivel) {
  ocultarAlerta();
  estado.nivel = nivel;
  estado.salon = null;
  estado.matriculaId = null;

  document.querySelectorAll('.insc-card').forEach(function (t) {
    t.classList.toggle('seleccionado', Number(t.dataset.id) === nivel.id);
  });

  const lista = $('lista-salones');
  lista.replaceChildren(el('p', 'insc-cargando', 'Cargando horarios…'));
  $('sub-salones').textContent = 'Grupos disponibles en el nivel ' + nivel.nombre + '.';
  irAPaso(2);

  const r = await pedir('/admisiones/niveles/' + nivel.id + '/salones');
  if (!r.ok) {
    lista.replaceChildren();
    mostrarAlerta(r.datos.mensaje || 'No se pudieron cargar los horarios.');
    return;
  }

  estado.salones = r.datos.salones || [];
  pintarSalones();
}


// ── 4. PASO 2: SALONES (HORARIOS) ──────────────────────────

function pintarSalones() {
  const lista = $('lista-salones');
  lista.replaceChildren();

  if (estado.salones.length === 0) {
    lista.append(el('p', 'insc-cargando',
      'Por ahora no hay grupos abiertos en este nivel. Escríbenos desde la sección de contacto y te avisamos.'));
    return;
  }

  estado.salones.forEach(function (salon) {
    const sinCupos = salon.cupos_disponibles <= 0;
    const boton = el('button', 'insc-salon' + (sinCupos ? ' agotado' : ''));
    boton.type = 'button';
    boton.disabled = sinCupos;

    const horario = [salon.dias_semana, formatearHora(salon.hora_inicio) + ' – ' + formatearHora(salon.hora_fin)]
      .filter(Boolean).join(' · ');

    const cupos = el('span', 'cupos');
    cupos.append(
      el('strong', '', sinCupos ? '0' : String(salon.cupos_disponibles)),
      document.createTextNode(sinCupos ? 'sin cupos' : 'cupos')
    );

    boton.append(
      el('h3', '', salon.nombre),
      el('span', 'linea', 'Docente: ' + salon.docente),
      el('span', 'linea', horario + ' · Inicia el ' + formatearFecha(salon.fecha_inicio)),
      cupos
    );

    boton.addEventListener('click', function () { elegirSalon(salon); });
    lista.append(boton);
  });
}

function elegirSalon(salon) {
  ocultarAlerta();

  // Si cambió de salón, la matrícula pendiente anterior ya no aplica a este.
  const pendiente = leerPendiente();
  const mismoSalon = pendiente && pendiente.salonId === salon.id;
  estado.matriculaId = mismoSalon ? pendiente.matriculaId : null;

  estado.salon = salon;
  guardarPendiente();
  pintarResumen();
  actualizarSesion();
  irAPaso(3);
}


// ── 5. PASO 3: RESUMEN, SESIÓN Y PAGO ──────────────────────

function agregarFila(dl, titulo, valor, clase) {
  dl.append(el('dt', '', titulo), el('dd', clase || '', valor));
}

function pintarResumen() {
  const { nivel, salon } = estado;
  const dl = $('resumen');
  dl.replaceChildren();

  agregarFila(dl, 'Nivel', nivel.nombre);
  agregarFila(dl, 'Grupo', salon.nombre);
  agregarFila(dl, 'Docente', salon.docente);
  agregarFila(dl, 'Horario', [salon.dias_semana,
    formatearHora(salon.hora_inicio) + ' – ' + formatearHora(salon.hora_fin)].filter(Boolean).join(' · '));
  agregarFila(dl, 'Inicio', formatearFecha(salon.fecha_inicio));
  agregarFila(dl, 'Valor a pagar', moneda(nivel.precio), 'total');
}

// Muestra el botón de pago solo si hay sesión de estudiante vigente;
// si no, muestra el bloque para iniciar sesión o crear cuenta.
function actualizarSesion() {
  const datos = datosToken();
  const bloqueSesion = $('bloque-sesion');
  const bloquePago = $('bloque-pago');

  if (datos && datos.rol === 'estudiante') {
    bloqueSesion.hidden = true;
    bloquePago.hidden = false;
    return;
  }

  bloquePago.hidden = true;
  bloqueSesion.hidden = false;
  $('btn-cerrar-sesion').hidden = !datos;

  $('texto-sesion').textContent = datos
    ? 'Tu sesión actual es de ' + datos.rol + ' y solo las cuentas de estudiante pueden inscribirse. Cierra sesión e ingresa con una cuenta de estudiante.'
    : 'Para confirmar tu matrícula necesitas una cuenta de estudiante. Tu selección se conserva mientras inicias sesión o te registras.';

  // Si viene de "Nuevo estudiante", destacamos crear cuenta
  const perfil = new URLSearchParams(window.location.search).get('perfil');
  $('enlace-registro').className = perfil === 'nuevo' ? 'btn-primario' : 'btn-secundario';
  $('enlace-login').className = perfil === 'nuevo' ? 'btn-secundario' : 'btn-primario';
}

$('btn-cerrar-sesion').addEventListener('click', function () {
  sessionStorage.removeItem(CLAVE_TOKEN);
  actualizarSesion();
});

$('btn-confirmar').addEventListener('click', async function () {
  const boton = $('btn-confirmar');
  const metodo = document.querySelector('input[name="metodo"]:checked').value;

  ocultarAlerta();
  boton.disabled = true;
  boton.textContent = 'Procesando…';

  try {
    // 1) Crear la matrícula (queda "pendiente") — solo si aún no existe
    if (!estado.matriculaId) {
      const m = await pedir('/admisiones/matricula', {
        metodo: 'POST', cuerpo: { salon_id: estado.salon.id }
      });
      if (!m.ok) { manejarError(m); return; }
      estado.matriculaId = m.datos.matricula.id;
      guardarPendiente();
    }

    // 2) Pagar: el monto lo calcula el backend, aquí solo se envía el método
    const p = await pedir('/admisiones/pago', {
      metodo: 'POST', cuerpo: { matricula_id: estado.matriculaId, metodo_pago: metodo }
    });
    if (!p.ok) {
      manejarError(p, 'Tu matrícula quedó pendiente de pago; puedes volver a intentarlo.');
      return;
    }

    mostrarExito(p.datos, metodo);

  } finally {
    boton.disabled = false;
    boton.textContent = 'Confirmar matrícula y pagar';
  }
});

function manejarError(r, extra) {
  if (r.status === 401) {
    sessionStorage.removeItem(CLAVE_TOKEN);
    actualizarSesion();
    mostrarAlerta('Tu sesión expiró. Inicia sesión de nuevo; tu selección se conserva.');
    return;
  }
  if (r.status === 403) {
    mostrarAlerta('Tu cuenta no tiene permiso para matricularse: solo los estudiantes pueden hacerlo.');
    return;
  }
  const base = r.datos.mensaje || 'Ocurrió un error inesperado.';
  mostrarAlerta(extra ? base + ' ' + extra : base);
}


// ── 6. ÉXITO ───────────────────────────────────────────────

function mostrarExito(datos, metodo) {
  sessionStorage.removeItem(CLAVE_PENDIENTE);

  [1, 2, 3].forEach(function (n) { $('panel-' + n).hidden = true; });
  document.querySelectorAll('.insc-paso').forEach(function (li) {
    li.classList.remove('activo');
    li.classList.add('completo');
  });

  $('exito-mensaje').textContent = datos.mensaje || 'Pago aprobado.';

  const dl = $('exito-datos');
  dl.replaceChildren();
  agregarFila(dl, 'Nivel', estado.nivel.nombre);
  agregarFila(dl, 'Grupo', estado.salon.nombre);
  agregarFila(dl, 'Monto pagado', moneda(datos.monto), 'total');
  agregarFila(dl, 'Método', metodo);
  agregarFila(dl, 'Referencia', datos.referencia);
  agregarFila(dl, 'Estado', 'Matrícula activa');

  $('panel-exito').hidden = false;
  document.querySelector('.insc-pasos-barra').scrollIntoView({ behavior: 'smooth' });
}


// ── 7. ARRANQUE ────────────────────────────────────────────

// Reconstruye el paso 3 si el estudiante vuelve de iniciar sesión
async function restaurar(pendiente) {
  const nivel = estado.niveles.find(function (n) { return n.id === pendiente.nivelId; });
  if (!nivel) { sessionStorage.removeItem(CLAVE_PENDIENTE); return; }

  await elegirNivel(nivel);

  const salon = estado.salones.find(function (s) { return s.id === pendiente.salonId; });
  if (salon) {
    estado.matriculaId = pendiente.matriculaId || null;
    elegirSalon(salon);
  }
}

async function iniciar() {
  const r = await pedir('/admisiones/niveles');
  const lista = $('lista-niveles');

  if (!r.ok) {
    lista.replaceChildren();
    mostrarAlerta(r.datos.mensaje || 'No se pudieron cargar los niveles.');
    return;
  }

  estado.niveles = r.datos.niveles || [];
  if (estado.niveles.length === 0) {
    lista.replaceChildren(el('p', 'insc-cargando', 'Aún no hay niveles disponibles.'));
    return;
  }
  pintarNiveles();

  // 1) Viene de niveles.html con ?nivel=A1 (etc.): se salta al paso 2
  const codigo = new URLSearchParams(window.location.search).get('nivel');
  if (codigo && GRUPO_POR_CODIGO[codigo.toUpperCase()] !== undefined) {
    const nivel = estado.niveles[GRUPO_POR_CODIGO[codigo.toUpperCase()]];
    if (nivel) {
      sessionStorage.removeItem(CLAVE_PENDIENTE);
      await elegirNivel(nivel);
      return;
    }
  }

  // 2) Regresa de iniciar sesión: se retoma donde iba
  const pendiente = leerPendiente();
  if (pendiente) await restaurar(pendiente);
}

iniciar();
