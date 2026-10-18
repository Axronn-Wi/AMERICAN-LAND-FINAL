/* ============================================================
   asistencia_docente.js — Toma de asistencia por salón y fecha
   Instituto American Land
   Ubicación: assets/js/asistencia_docente.js
============================================================ */

(function () {
  'use strict';

  const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

  // ── Sesión ───────────────────────────────────────────────
  const token = sessionStorage.getItem('token');
  if (!token || sessionStorage.getItem('rol') !== 'docente') {
    window.location.href = '../auth/login.html';
    return;
  }
  const nombre = sessionStorage.getItem('nombre') || 'Docente';
  document.getElementById('nav-nombre').textContent = nombre;
  document.getElementById('nav-avatar').textContent = nombre.charAt(0).toUpperCase();
  document.querySelector('.btn-cerrar').addEventListener('click', function (e) {
    e.preventDefault();
    sessionStorage.clear();
    window.location.href = '../auth/login.html';
  });

  const ESTADOS = [
    { valor: 'presente', letra: 'P', texto: 'Presente' },
    { valor: 'ausente', letra: 'A', texto: 'Ausente' },
    { valor: 'tarde', letra: 'T', texto: 'Tarde' },
    { valor: 'excusa', letra: 'E', texto: 'Excusa' }
  ];
  const COLORES = ['rojo', 'azul', 'morado'];

  const porId = function (id) { return document.getElementById(id); };
  const inputFecha = porId('input-fecha');
  const btnGuardar = porId('btn-guardar');

  let salonId = null;
  let hoy = null;
  let lista = [];          // [{ id_estudiante, nombre_completo, codigo_estudiante, estado, observacion }]
  let hayCambios = false;

  function crear(tag, clase, texto) {
    const el = document.createElement(tag);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  }

  async function api(ruta, opciones) {
    const op = opciones || {};
    const r = await fetch(API + ruta, {
      method: op.method || 'GET',
      headers: Object.assign({ 'Authorization': 'Bearer ' + token }, op.body ? { 'Content-Type': 'application/json' } : {}),
      body: op.body ? JSON.stringify(op.body) : undefined
    });
    if (r.status === 401) {
      sessionStorage.clear();
      window.location.href = '../auth/login.html';
      throw new Error('Sesión vencida');
    }
    const datos = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(datos.mensaje || 'Error de conexión');
    return datos;
  }

  function alerta(tipo, texto) {
    const el = porId('alerta');
    el.textContent = texto;
    el.className = 'alerta ' + tipo + ' visible';
    clearTimeout(alerta.t);
    alerta.t = setTimeout(function () { el.className = 'alerta'; }, 5000);
  }

  function iniciales(texto) {
    const p = String(texto || '?').trim().split(/\s+/);
    return ((p[0] || '?').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
  }

  function sumarDias(fecha, dias) {
    const d = new Date(fecha + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  function fechaLegible(fecha) {
    const texto = new Date(fecha + 'T12:00:00Z').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function marcarCambios(valor) {
    hayCambios = valor;
    const estado = porId('estado-guardado');
    const completos = lista.every(function (e) { return e.estado; });
    btnGuardar.disabled = !valor || !completos || lista.length === 0;
    if (valor) {
      estado.textContent = completos ? 'Cambios sin guardar' : 'Falta marcar ' + lista.filter(function (e) { return !e.estado; }).length + ' estudiante(s)';
      estado.className = 'asis-estado-guardado pendiente';
    }
  }

  // ── Salones (barra lateral) ──────────────────────────────
  async function cargarSalones() {
    const datos = await api('/docentes/salones');
    const ul = porId('lista-clases');
    ul.textContent = '';
    if (datos.salones.length === 0) {
      ul.appendChild(crear('li', 'clase-item', 'Sin salones asignados'));
      porId('salon-detalle').textContent = 'Aún no tienes salones asignados.';
      porId('lista-asistencia').textContent = '';
      porId('lista-asistencia').appendChild(crear('p', 'asis-vacio', 'Cuando el administrador te asigne un salón podrás tomar lista aquí.'));
      return null;
    }
    const pedido = parseInt(new URLSearchParams(window.location.search).get('salon'), 10);
    const actual = datos.salones.find(function (s) { return s.id === pedido; }) || datos.salones[0];

    datos.salones.forEach(function (s, i) {
      const li = crear('li', 'clase-item' + (s.id === actual.id ? ' activa' : ''));
      li.appendChild(crear('span', 'clase-dot ' + COLORES[i % COLORES.length]));
      const a = crear('a', '', s.nombre);
      a.href = 'asistencia.html?salon=' + s.id;
      li.appendChild(a);
      ul.appendChild(li);
    });
    porId('salon-detalle').textContent = actual.nombre + ' · ' + actual.nivel + ' · ' + actual.total_estudiantes + ' estudiante(s)';
    return actual.id;
  }

  // ── Lista del día ────────────────────────────────────────
  async function cargarDia(fecha) {
    porId('lista-asistencia').textContent = '';
    porId('lista-asistencia').appendChild(crear('p', 'asis-vacio', 'Cargando...'));
    try {
      const datos = await api('/docentes/salones/' + salonId + '/asistencia' + (fecha ? '?fecha=' + fecha : ''));
      hoy = datos.hoy;
      inputFecha.value = datos.fecha;
      inputFecha.max = hoy;
      porId('btn-dia-siguiente').disabled = datos.fecha >= hoy;
      lista = datos.estudiantes;

      const guardada = lista.some(function (e) { return e.estado; });
      const estado = porId('estado-guardado');
      estado.textContent = guardada ? '✓ Lista guardada para ' + fechaLegible(datos.fecha) : 'Sin registrar: ' + fechaLegible(datos.fecha);
      estado.className = 'asis-estado-guardado';
      hayCambios = false;
      btnGuardar.disabled = true;

      pintarLista();
      pintarAcumulado(datos.resumen, datos.fechas_registradas.length);
    } catch (err) {
      porId('lista-asistencia').textContent = '';
      porId('lista-asistencia').appendChild(crear('p', 'asis-vacio', err.message));
    }
  }

  function pintarResumenDia() {
    const cont = porId('resumen-dia');
    cont.textContent = '';
    ESTADOS.forEach(function (e) {
      const n = lista.filter(function (x) { return x.estado === e.valor; }).length;
      const c = crear('div', 'asis-contador ' + e.valor);
      c.appendChild(crear('strong', null, String(n)));
      c.appendChild(crear('span', null, e.texto + (n === 1 ? '' : 's')));
      cont.appendChild(c);
    });
  }

  function pintarLista() {
    const cont = porId('lista-asistencia');
    cont.textContent = '';
    pintarResumenDia();

    if (lista.length === 0) {
      cont.appendChild(crear('p', 'asis-vacio', 'Este salón no tiene estudiantes con matrícula activa.'));
      porId('btn-todos-presentes').disabled = true;
      return;
    }
    porId('btn-todos-presentes').disabled = false;

    lista.forEach(function (est) {
      const fila = crear('div', 'asis-fila');

      const alumno = crear('div', 'asis-alumno');
      alumno.appendChild(crear('div', 'alumno-avatar', iniciales(est.nombre_completo)));
      const textos = crear('div');
      textos.appendChild(crear('div', 'asis-alumno-nombre', est.nombre_completo));
      textos.appendChild(crear('div', 'asis-alumno-codigo', est.codigo_estudiante));
      alumno.appendChild(textos);
      fila.appendChild(alumno);

      const opciones = crear('div', 'asis-opciones');
      opciones.setAttribute('role', 'group');
      opciones.setAttribute('aria-label', 'Asistencia de ' + est.nombre_completo);
      ESTADOS.forEach(function (e) {
        const b = crear('button', 'asis-opcion ' + e.valor);
        b.type = 'button';
        b.title = e.texto;
        b.setAttribute('aria-label', e.texto);
        b.setAttribute('aria-pressed', String(est.estado === e.valor));
        b.appendChild(crear('span', null, e.letra));
        b.addEventListener('click', function () {
          est.estado = e.valor;
          opciones.querySelectorAll('.asis-opcion').forEach(function (o) {
            o.setAttribute('aria-pressed', String(o === b));
          });
          pintarResumenDia();
          marcarCambios(true);
        });
        opciones.appendChild(b);
      });
      fila.appendChild(opciones);

      const obs = crear('input', 'asis-observacion');
      obs.type = 'text';
      obs.maxLength = 250;
      obs.placeholder = 'Observación (opcional)';
      obs.value = est.observacion || '';
      obs.setAttribute('aria-label', 'Observación de ' + est.nombre_completo);
      obs.addEventListener('input', function () {
        est.observacion = obs.value;
        marcarCambios(true);
      });
      fila.appendChild(obs);

      cont.appendChild(fila);
    });
  }

  function pintarAcumulado(resumen, clases) {
    porId('clases-registradas').textContent = clases + (clases === 1 ? ' clase registrada' : ' clases registradas');
    const tbody = porId('tbody-acumulado');
    tbody.textContent = '';
    const porEstudiante = {};
    resumen.forEach(function (r) { porEstudiante[r.id_estudiante] = r; });

    lista.forEach(function (est) {
      const r = porEstudiante[est.id_estudiante] || { presentes: 0, tardes: 0, ausentes: 0, excusas: 0, porcentaje: null };
      const tr = crear('tr');
      const tdNombre = crear('td');
      const info = crear('div', 'alumno-info');
      info.appendChild(crear('div', 'alumno-avatar', iniciales(est.nombre_completo)));
      info.appendChild(crear('span', null, est.nombre_completo));
      tdNombre.appendChild(info);
      tr.appendChild(tdNombre);
      [r.presentes, r.tardes, r.ausentes, r.excusas].forEach(function (n) { tr.appendChild(crear('td', null, String(n))); });

      const tdPct = crear('td');
      if (r.porcentaje === null) {
        tdPct.appendChild(crear('span', 'asis-alumno-codigo', 'Sin datos'));
      } else {
        const pct = crear('div', 'asis-porcentaje');
        const barra = crear('div', 'asis-barra' + (r.porcentaje < 70 ? ' baja' : r.porcentaje < 85 ? ' media' : ''));
        const relleno = crear('span');
        relleno.style.width = r.porcentaje + '%';
        barra.appendChild(relleno);
        pct.appendChild(barra);
        pct.appendChild(crear('strong', null, r.porcentaje + '%'));
        tdPct.appendChild(pct);
      }
      tr.appendChild(tdPct);
      tbody.appendChild(tr);
    });

    if (lista.length === 0) {
      const tr = crear('tr');
      const td = crear('td', 'asis-alumno-codigo', 'Sin estudiantes.');
      td.colSpan = 6;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  // ── Guardar ──────────────────────────────────────────────
  btnGuardar.addEventListener('click', async function () {
    const registros = lista.map(function (e) {
      return { estudiante_id: e.id_estudiante, estado: e.estado, observacion: e.observacion || null };
    });
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';
    try {
      await api('/docentes/salones/' + salonId + '/asistencia', {
        method: 'PUT', body: { fecha: inputFecha.value, registros: registros }
      });
      alerta('exito', '✓ Asistencia guardada: ' + fechaLegible(inputFecha.value) + ' (' + registros.length + (registros.length === 1 ? ' estudiante).' : ' estudiantes).'));
      await cargarDia(inputFecha.value);
    } catch (err) {
      alerta('error', err.message);
      btnGuardar.disabled = false;
    } finally {
      btnGuardar.innerHTML = '&#128190; Guardar asistencia';
    }
  });

  porId('btn-todos-presentes').addEventListener('click', function () {
    lista.forEach(function (e) { if (!e.estado || e.estado === 'ausente') e.estado = 'presente'; });
    pintarLista();
    marcarCambios(true);
  });

  // Cambiar de día avisa si hay cambios sin guardar
  function irA(fecha) {
    if (!fecha) return;
    if (hayCambios && !window.confirm('Tienes cambios sin guardar. ¿Cambiar de día de todas formas?')) {
      inputFecha.value = inputFecha.dataset.anterior || inputFecha.value;
      return;
    }
    if (hoy && fecha > hoy) fecha = hoy;
    inputFecha.dataset.anterior = fecha;
    cargarDia(fecha);
  }
  inputFecha.addEventListener('focus', function () { inputFecha.dataset.anterior = inputFecha.value; });
  inputFecha.addEventListener('change', function () { irA(inputFecha.value); });
  porId('btn-dia-anterior').addEventListener('click', function () { irA(sumarDias(inputFecha.value, -1)); });
  porId('btn-dia-siguiente').addEventListener('click', function () { irA(sumarDias(inputFecha.value, 1)); });
  porId('btn-hoy').addEventListener('click', function () { irA(hoy); });

  window.addEventListener('beforeunload', function (e) {
    if (hayCambios) { e.preventDefault(); e.returnValue = ''; }
  });

  // ── Inicio ───────────────────────────────────────────────
  cargarSalones()
    .then(function (id) {
      if (id === null) return;
      salonId = id;
      return cargarDia(null);
    })
    .catch(function (err) { alerta('error', err.message); });
})();
