/* ============================================================
   contactos_admin.js — Bandeja de mensajes de la página web
   Instituto American Land
   Ubicación: assets/js/contactos_admin.js
   Admin y secretaría cambian el estado; solo el admin elimina.
============================================================ */

(function () {
  'use strict';

  const P = window.Panel;
  if (!P.iniciar(['admin', 'secretaria'])) return;

  const ESTADOS = { nuevo: 'Nuevo', en_proceso: 'En proceso', atendido: 'Atendido' };
  let contactos = [];
  const porId = function (id) { return document.getElementById(id); };

  async function cargar() {
    const r = await P.api('/contacto');
    if (!r.ok) {
      P.alerta('error', r.datos.mensaje || 'No se pudieron cargar los mensajes.');
      return;
    }
    contactos = r.datos.contactos;
    Object.keys(ESTADOS).forEach(function (e) { porId('stat-' + e).textContent = r.datos.totales[e] || 0; });
    pintar();
  }

  function filtrados() {
    const texto = porId('input-busqueda').value.trim().toLowerCase();
    const estado = porId('filtro-estado').value;
    return contactos.filter(function (c) {
      if (estado && c.estado !== estado) return false;
      return !texto || (c.nombre_apellido + ' ' + c.correo + ' ' + c.mensaje + ' ' + (c.telefono || '')).toLowerCase().indexOf(texto) !== -1;
    });
  }

  function botonEstado(c, estado, texto, clase) {
    const b = P.crear('button', 'btn-texto ' + (clase || ''), texto);
    b.type = 'button';
    b.addEventListener('click', function () { cambiarEstado(c, estado, b); });
    return b;
  }

  function pintar() {
    const cont = porId('lista-contactos');
    const lista = filtrados();
    cont.textContent = '';
    porId('badge-total').textContent = lista.length + (lista.length === 1 ? ' mensaje' : ' mensajes');

    if (lista.length === 0) {
      const v = P.crear('div', 'vacio-grande');
      v.appendChild(P.crear('span', 'vacio-icono', '📭'));
      v.appendChild(P.crear('p', null, contactos.length === 0
        ? 'Aún no hay mensajes. Llegarán aquí cuando alguien llene el formulario de contacto de la página principal.'
        : 'Ningún mensaje coincide con los filtros.'));
      cont.appendChild(v);
      return;
    }

    lista.forEach(function (c) {
      const card = P.crear('article', 'tarjeta-item es-' + c.estado);

      const cab = P.crear('div', 'tarjeta-cabecera');
      const titulo = P.crear('div');
      titulo.appendChild(P.crear('h3', 'tarjeta-titulo', c.nombre_apellido));
      const datos = P.crear('div', 'tarjeta-datos tarjeta-pie');
      datos.style.marginTop = '4px';
      const correo = P.crear('a', null, '✉ ' + c.correo);
      correo.href = 'mailto:' + encodeURIComponent(c.correo) + '?subject=' + encodeURIComponent('Instituto American Land - Respuesta a tu mensaje');
      datos.appendChild(correo);
      if (c.telefono) {
        const tel = P.crear('a', null, '☎ ' + c.telefono);
        tel.href = 'tel:' + c.telefono.replace(/[^0-9+]/g, '');
        datos.appendChild(tel);
        const wa = P.crear('a', null, 'WhatsApp');
        const soloNumeros = c.telefono.replace(/\D/g, '');
        wa.href = 'https://wa.me/' + (soloNumeros.length === 10 ? '57' + soloNumeros : soloNumeros);
        wa.target = '_blank';
        wa.rel = 'noopener noreferrer';
        datos.appendChild(wa);
      }
      titulo.appendChild(datos);
      cab.appendChild(titulo);
      cab.appendChild(P.crear('span', 'chip chip-' + c.estado, ESTADOS[c.estado]));
      card.appendChild(cab);

      card.appendChild(P.crear('p', 'tarjeta-texto', c.mensaje));

      const pie = P.crear('div', 'tarjeta-pie');
      let info = 'Recibido ' + P.fechaHora(c.recibido_en);
      if (c.atendido_por) info += ' · ' + (c.estado === 'atendido' ? 'Atendido' : 'Tomado') + ' por ' + c.atendido_por;
      pie.appendChild(P.crear('span', null, info));

      const acc = P.crear('div', 'acciones-fila');
      if (c.estado !== 'en_proceso' && c.estado !== 'atendido') acc.appendChild(botonEstado(c, 'en_proceso', '⏳ Tomar'));
      if (c.estado !== 'atendido') acc.appendChild(botonEstado(c, 'atendido', '✔ Marcar atendido', 'exito'));
      if (c.estado !== 'nuevo') acc.appendChild(botonEstado(c, 'nuevo', '↺ Reabrir'));
      const borrar = P.crear('button', 'btn-texto peligro solo-admin', '🗑');
      borrar.type = 'button';
      borrar.title = 'Eliminar mensaje';
      borrar.setAttribute('aria-label', 'Eliminar mensaje');
      borrar.addEventListener('click', function () { eliminar(c); });
      acc.appendChild(borrar);
      pie.appendChild(acc);
      card.appendChild(pie);

      cont.appendChild(card);
    });
  }

  async function cambiarEstado(c, estado, btn) {
    btn.disabled = true;
    const r = await P.api('/contacto/' + c.id, { method: 'PUT', body: { estado: estado } });
    btn.disabled = false;
    if (!r.ok) { P.alerta('error', r.datos.mensaje || 'No se pudo actualizar.'); return; }
    cargar();
  }

  async function eliminar(c) {
    const ok = await P.confirmar('¿Eliminar mensaje?', 'El mensaje de ' + c.nombre_apellido + ' se borrará definitivamente.', 'Sí, eliminar');
    if (!ok) return;
    const r = await P.api('/contacto/' + c.id, { method: 'DELETE' });
    if (!r.ok) { P.alerta('error', r.datos.mensaje || 'No se pudo eliminar.'); return; }
    P.alerta('exito', 'Mensaje eliminado.');
    cargar();
  }

  porId('input-busqueda').addEventListener('input', pintar);
  porId('filtro-estado').addEventListener('change', pintar);

  cargar();
})();
