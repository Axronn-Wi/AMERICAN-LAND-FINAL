/* ============================================================
   notas_docente.js
   Instituto American Land
   Ubicación: assets/js/notas_docente.js
============================================================ */

const API = window.location.origin + '/api';

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

// ── 4. HELPER PARA LA API (GET y POST) ──────────────────────
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
const COLORES = ['rojo', 'azul', 'morado'];

function crear(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function inicial(texto) {
  return String(texto || '?').trim().charAt(0).toUpperCase();
}

function redondear1(n) {
  return Math.round(n * 10) / 10;
}

// Texto del input -> null (vacío), NaN (no es número) o número con 1 decimal
function leerNota(texto) {
  if (texto === '' || texto === null || texto === undefined) return null;
  const n = parseFloat(texto);
  if (isNaN(n)) return NaN;
  return redondear1(n);
}

function mostrarAlerta(tipo, texto) {
  const alerta = document.getElementById('alerta');
  alerta.textContent = texto;
  alerta.className = 'alerta ' + tipo + ' visible';
  alerta.style.display = 'block';
}

// ── 6. ESTADO DE LA PÁGINA ──────────────────────────────────
let salonActual = null;
let datosNotas = { ciclos: [], estudiantes: [], notas: [] };
let cicloActualId = null;

// ── 7. SIDEBAR: MIS CLASES ──────────────────────────────────
function pintarSidebar(salones, actualId) {
  const ul = document.getElementById('lista-clases');
  ul.innerHTML = '';

  if (salones.length === 0) {
    const li = crear('li', 'clase-item');
    li.appendChild(crear('a', '', 'Sin salones asignados'));
    ul.appendChild(li);
    return;
  }

  salones.forEach(function (s, i) {
    const li = crear('li', 'clase-item' + (s.id === actualId ? ' activa' : ''));
    li.appendChild(crear('span', 'clase-dot ' + COLORES[i % COLORES.length]));
    const a = crear('a', '', s.nombre);
    a.href = 'notas.html?salon=' + s.id;
    li.appendChild(a);
    ul.appendChild(li);
  });
}

// Los accesos rápidos conservan el salón elegido
function actualizarAccesos(salonId) {
  document.querySelectorAll('.acceso-link').forEach(function (a) {
    const base = a.getAttribute('href').split('?')[0];
    a.href = base + '?salon=' + salonId;
  });
}

// ── 8. BOTONES DE CICLO ─────────────────────────────────────
function hayCambiosSinGuardar() {
  const inputs = document.querySelectorAll('#tbody-notas .input-nota');
  return Array.prototype.some.call(inputs, function (input) {
    return leerNota(input.value) !== leerNota(input.dataset.original);
  });
}

function pintarCiclos() {
  const wrap = document.getElementById('ciclos-wrap');
  wrap.innerHTML = '';

  datosNotas.ciclos.forEach(function (c) {
    const btn = crear('button', 'btn-ciclo' + (c.id === cicloActualId ? ' activo' : ''), 'Ciclo ' + c.numero_ciclo);
    btn.type = 'button';
    btn.addEventListener('click', function () {
      if (c.id === cicloActualId) return;
      if (hayCambiosSinGuardar() &&
          !confirm('Tienes notas sin guardar en este ciclo. ¿Cambiar de ciclo y perderlas?')) {
        return;
      }
      cicloActualId = c.id;
      pintarCiclos();
      pintarTabla();
    });
    wrap.appendChild(btn);
  });
}

// ── 9. TABLA DE NOTAS ───────────────────────────────────────
function crearInputNota(valor, campo, tr) {
  const input = crear('input', 'input-nota');
  input.type = 'number';
  input.name = campo;
  input.min = '0';
  input.max = '5';
  input.step = '0.1';
  input.placeholder = '—';
  if (valor !== null && valor !== undefined) input.value = Number(valor).toFixed(1);
  input.dataset.original = (valor !== null && valor !== undefined) ? Number(valor).toFixed(1) : '';
  input.addEventListener('input', function () { previsualizarFila(tr); });
  return input;
}

// Muestra promedio y estado en la fila (promedio null = pendiente)
function pintarResultado(tr, promedio, estado) {
  const spanProm = tr.querySelector('.promedio-alumno');
  const badge = tr.querySelector('.badge');

  tr.dataset.promedio = (promedio === null || promedio === undefined) ? '' : String(promedio);

  if (promedio === null || promedio === undefined) {
    spanProm.textContent = '—';
    spanProm.className = 'promedio-alumno nota-pendiente';
  } else {
    spanProm.textContent = Number(promedio).toFixed(1);
    spanProm.className = 'promedio-alumno ' + (Number(promedio) >= 3 ? 'nota-alta' : 'nota-baja');
  }

  if (estado === 'aprobado') {
    badge.textContent = 'Aprobado';
    badge.className = 'badge badge-aprobado';
  } else if (estado === 'reprobado') {
    badge.textContent = 'Reprobado';
    badge.className = 'badge badge-riesgo';
  } else {
    badge.textContent = 'Pendiente';
    badge.className = 'badge badge-pendiente';
  }
}

// Mientras el docente escribe: misma regla que el backend (promedio de las notas que existan, aprobado desde 3.0)
function previsualizarFila(tr) {
  const valores = ['nota_ciclo', 'nota_examen_final']
    .map(function (campo) { return leerNota(tr.querySelector('input[name="' + campo + '"]').value); })
    .filter(function (n) { return n !== null && !isNaN(n) && n >= 0 && n <= 5; });

  if (valores.length === 0) {
    pintarResultado(tr, null, null);
  } else {
    const suma = valores.reduce(function (a, b) { return a + b; }, 0);
    const promedio = redondear1(suma / valores.length);
    pintarResultado(tr, promedio, promedio >= 3 ? 'aprobado' : 'reprobado');
  }
  actualizarPromedioGrupo();
}

function actualizarPromedioGrupo() {
  const filas = document.querySelectorAll('#tbody-notas tr[data-estudiante]');
  const promedios = [];
  filas.forEach(function (tr) {
    if (tr.dataset.promedio !== '') promedios.push(Number(tr.dataset.promedio));
  });

  const el = document.getElementById('promedio-grupo');
  if (promedios.length === 0) {
    el.textContent = '—';
  } else {
    const suma = promedios.reduce(function (a, b) { return a + b; }, 0);
    el.textContent = (suma / promedios.length).toFixed(1);
  }
}

function mensajeTabla(texto) {
  const tbody = document.getElementById('tbody-notas');
  tbody.innerHTML = '';
  const tr = crear('tr');
  const td = crear('td', '', texto);
  td.colSpan = 5;
  td.style.padding = '24px';
  td.style.textAlign = 'center';
  tr.appendChild(td);
  tbody.appendChild(tr);
  document.getElementById('promedio-grupo').textContent = '—';
}

function pintarTabla() {
  const tbody = document.getElementById('tbody-notas');

  if (datosNotas.estudiantes.length === 0) {
    mensajeTabla('Este salón todavía no tiene estudiantes matriculados.');
    return;
  }

  // Notas del ciclo elegido, por id de estudiante
  const notasCiclo = {};
  datosNotas.notas.forEach(function (n) {
    if (n.ciclo_id === cicloActualId) notasCiclo[n.estudiante_id] = n;
  });

  tbody.innerHTML = '';

  datosNotas.estudiantes.forEach(function (est) {
    const nota = notasCiclo[est.id_estudiante] || null;
    const tr = crear('tr');
    tr.dataset.estudiante = est.id_estudiante;
    tr.dataset.nombre = est.nombre_completo;

    const tdNombre = crear('td');
    const info = crear('div', 'alumno-info');
    info.appendChild(crear('div', 'alumno-avatar', inicial(est.nombre_completo)));
    info.appendChild(document.createTextNode(est.nombre_completo));
    tdNombre.appendChild(info);
    tr.appendChild(tdNombre);

    const tdCiclo = crear('td');
    tdCiclo.appendChild(crearInputNota(nota ? nota.nota_ciclo : null, 'nota_ciclo', tr));
    tr.appendChild(tdCiclo);

    const tdExamen = crear('td');
    tdExamen.appendChild(crearInputNota(nota ? nota.nota_examen_final : null, 'nota_examen_final', tr));
    tr.appendChild(tdExamen);

    const tdProm = crear('td');
    tdProm.appendChild(crear('span', 'promedio-alumno nota-pendiente', '—'));
    tr.appendChild(tdProm);

    const tdEstado = crear('td');
    tdEstado.appendChild(crear('span', 'badge badge-pendiente', 'Pendiente'));
    tr.appendChild(tdEstado);

    tbody.appendChild(tr);

    // Al abrir se muestran el promedio y el estado guardados en la base de datos
    pintarResultado(tr, nota ? nota.promedio : null, nota ? nota.estado : null);
  });

  actualizarPromedioGrupo();
}

// ── 10. GUARDAR NOTAS ───────────────────────────────────────
async function recargarNotas() {
  const res = await apiFetch('/docentes/salones/' + salonActual.id + '/notas');
  if (res && res.ok && res.datos) {
    datosNotas = {
      ciclos: res.datos.ciclos || [],
      estudiantes: res.datos.estudiantes || [],
      notas: res.datos.notas || []
    };
  }
  pintarTabla();
}

async function guardarNotas() {
  const btn = document.getElementById('btn-guardar');
  const filas = Array.prototype.slice.call(document.querySelectorAll('#tbody-notas tr[data-estudiante]'));

  const pendientes = [];
  let alumnoInvalido = null;
  let borradas = 0;

  filas.forEach(function (tr) {
    const cambios = {};
    ['nota_ciclo', 'nota_examen_final'].forEach(function (campo) {
      const input = tr.querySelector('input[name="' + campo + '"]');
      const nuevo = leerNota(input.value);
      const original = leerNota(input.dataset.original);

      if (nuevo !== null && (isNaN(nuevo) || nuevo < 0 || nuevo > 5)) {
        if (!alumnoInvalido) alumnoInvalido = tr.dataset.nombre;
        return;
      }
      if (nuevo === null && original !== null) { borradas++; return; }
      if (nuevo !== null && nuevo !== original) cambios[campo] = nuevo;
    });

    if (Object.keys(cambios).length > 0) {
      pendientes.push({ id: Number(tr.dataset.estudiante), nombre: tr.dataset.nombre, cambios: cambios });
    }
  });

  if (alumnoInvalido) {
    mostrarAlerta('error', 'Revisa las notas de ' + alumnoInvalido + ': deben ser números entre 0 y 5.');
    return;
  }

  const avisoBorradas = borradas > 0
    ? ' Las notas que dejaste vacías no se pueden borrar, se mantienen como estaban.'
    : '';

  if (pendientes.length === 0) {
    mostrarAlerta('exito', 'No hay cambios por guardar.' + avisoBorradas);
    if (borradas > 0) await recargarNotas();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Guardando...';

  let guardados = 0;
  const errores = [];

  // Un POST por alumno (el endpoint recibe un solo estudiante a la vez)
  for (let i = 0; i < pendientes.length; i++) {
    const p = pendientes[i];
    const cuerpo = Object.assign(
      { estudiante_id: p.id, salon_id: salonActual.id, ciclo_id: cicloActualId },
      p.cambios
    );
    try {
      const res = await apiFetch('/docentes/notas', { method: 'POST', body: cuerpo });
      if (res && res.ok) {
        guardados++;
      } else {
        errores.push(p.nombre + ': ' + ((res && res.datos && res.datos.mensaje) || 'error al guardar'));
      }
    } catch (err) {
      console.error(err);
      errores.push(p.nombre + ': no se pudo conectar con el servidor');
    }
  }

  btn.disabled = false;
  btn.innerHTML = '&#128190; Guardar Notas';

  await recargarNotas();

  if (errores.length === 0) {
    mostrarAlerta('exito', 'Notas guardadas: ' + guardados + (guardados === 1 ? ' alumno.' : ' alumnos.') + avisoBorradas);
  } else {
    mostrarAlerta('error', 'Se guardaron ' + guardados + ' y fallaron ' + errores.length + '. ' + errores.join(' | '));
  }
}

document.getElementById('btn-guardar').addEventListener('click', guardarNotas);

// ── 11. SIN SALONES / SIN CICLOS ────────────────────────────
function pintarSinSalones() {
  document.getElementById('salon-detalle').textContent = 'Sin salones asignados';
  document.getElementById('btn-guardar').disabled = true;
  pintarSidebar([], null);
  mensajeTabla('Cuando la administración te asigne un salón, aparecerá aquí.');
}

// ── 12. ARRANCAR ────────────────────────────────────────────
async function cargarNotas() {
  let salones = [];
  try {
    const res = await apiFetch('/docentes/salones');
    salones = (res && res.datos && res.datos.salones) ? res.datos.salones : [];
  } catch (err) {
    console.error('Error al cargar los salones:', err);
  }

  if (salones.length === 0) {
    pintarSinSalones();
    return;
  }

  // Salón elegido: ?salon=<id>; si no existe, el primero
  const pedido = parseInt(new URLSearchParams(window.location.search).get('salon'), 10);
  salonActual = salones.find(function (s) { return s.id === pedido; }) || salones[0];

  pintarSidebar(salones, salonActual.id);
  actualizarAccesos(salonActual.id);
  document.getElementById('salon-detalle').textContent =
    salonActual.nombre + '  ·  Nivel ' + salonActual.nivel;

  try {
    const res = await apiFetch('/docentes/salones/' + salonActual.id + '/notas');
    if (!res || !res.ok || !res.datos) {
      mostrarAlerta('error', (res && res.datos && res.datos.mensaje) || 'No se pudieron cargar las notas.');
      mensajeTabla('No se pudieron cargar las notas.');
      return;
    }
    datosNotas = {
      ciclos: res.datos.ciclos || [],
      estudiantes: res.datos.estudiantes || [],
      notas: res.datos.notas || []
    };
  } catch (err) {
    console.error('Error al cargar las notas:', err);
    mostrarAlerta('error', 'No se pudo conectar con el servidor.');
    mensajeTabla('No se pudieron cargar las notas.');
    return;
  }

  if (datosNotas.ciclos.length === 0) {
    document.getElementById('btn-guardar').disabled = true;
    mensajeTabla('Este salón todavía no tiene ciclos creados.');
    return;
  }

  // Ciclo inicial: el actual del salón; si no coincide, el primero
  const actual = datosNotas.ciclos.find(function (c) { return c.numero_ciclo === salonActual.ciclo_actual; });
  cicloActualId = (actual || datosNotas.ciclos[0]).id;

  pintarCiclos();
  pintarTabla();
}

if (sesionValida) cargarNotas();