/* ============================================================
   asistencia_alumno.js — Resumen de asistencia del estudiante
   Instituto American Land
   Ubicación: assets/js/asistencia_alumno.js
   Se usa en alumnos/notas.html (después de notas.js, que ya
   verifica la sesión).
============================================================ */

(function () {
  'use strict';

  const token = sessionStorage.getItem('token');
  const seccion = document.getElementById('mi-asistencia');
  if (!token || !seccion) return;

  const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

  const ESTADOS = [
    { valor: 'presente', clave: 'presentes', texto: 'Presente' },
    { valor: 'tarde', clave: 'tardes', texto: 'Tarde' },
    { valor: 'ausente', clave: 'ausentes', texto: 'Ausente' },
    { valor: 'excusa', clave: 'excusas', texto: 'Excusa' }
  ];

  function crear(tag, clase, texto) {
    const el = document.createElement(tag);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  }

  function fechaLegible(valor) {
    const texto = new Date(valor).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  async function cargar() {
    let datos;
    try {
      const r = await fetch(API + '/alumnos/asistencia', { headers: { 'Authorization': 'Bearer ' + token } });
      if (!r.ok) throw new Error();
      datos = await r.json();
    } catch (_) {
      document.getElementById('asistencia-detalle').textContent = 'No se pudo cargar la asistencia.';
      return;
    }

    const res = datos.resumen;
    const anillo = document.getElementById('asistencia-anillo');
    const pct = res.porcentaje;
    document.getElementById('asistencia-porcentaje').textContent = pct === null ? '—' : pct + '%';
    anillo.style.setProperty('--valor', pct === null ? 0 : pct);
    anillo.style.setProperty('--asis-color', pct === null ? 'var(--gris-borde)' : pct < 70 ? 'var(--asis-ausente)' : pct < 85 ? 'var(--asis-tarde)' : 'var(--asis-presente)');
    anillo.setAttribute('aria-label', pct === null ? 'Sin registros de asistencia' : 'Asistencia del ' + pct + ' por ciento');

    document.getElementById('asistencia-detalle').textContent = res.total === 0
      ? 'Tu docente aún no ha registrado asistencia.'
      : res.total + (res.total === 1 ? ' clase registrada' : ' clases registradas');

    const contadores = document.getElementById('asistencia-contadores');
    contadores.textContent = '';
    ESTADOS.forEach(function (e) {
      const c = crear('div', 'asis-contador ' + e.valor);
      c.appendChild(crear('strong', null, String(res[e.clave])));
      c.appendChild(crear('span', null, e.texto + (res[e.clave] === 1 ? '' : 's')));
      contadores.appendChild(c);
    });

    const historial = document.getElementById('asistencia-historial');
    historial.textContent = '';
    datos.registros.forEach(function (r) {
      const li = crear('li');
      const izq = crear('div');
      izq.appendChild(document.createTextNode(fechaLegible(r.fecha)));
      izq.appendChild(crear('small', null, r.observacion ? r.salon + ' · ' + r.observacion : r.salon));
      li.appendChild(izq);
      const est = ESTADOS.find(function (e) { return e.valor === r.estado; });
      li.appendChild(crear('span', 'asis-etiqueta ' + r.estado, est ? est.texto : r.estado));
      historial.appendChild(li);
    });
  }

  cargar();
})();
