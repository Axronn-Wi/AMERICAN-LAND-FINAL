/* ============================================================
   anuncios_admin.js — CRUD de anuncios (admin y secretaría)
   Instituto American Land
   Ubicación: assets/js/anuncios_admin.js
============================================================ */

(function () {
  'use strict';

  const P = window.Panel;
  if (!P.iniciar(['admin', 'secretaria'])) return;

  const PARA = { todos: 'Todo el instituto', estudiantes: 'Estudiantes', docentes: 'Docentes' };
  const NOMBRE_ROL = { admin: 'Administración', secretaria: 'Secretaría', docente: 'Docente' };

  let anuncios = [];
  let editando = null;
  const porId = function (id) { return document.getElementById(id); };

  function hoy() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  }

  function vigente(a) {
    return a.activo && (!a.expira_en || String(a.expira_en).slice(0, 10) >= hoy());
  }

  async function cargarSalones() {
    const r = await P.api('/admin/salones');
    if (!r.ok) return;
    const sel = porId('anu-salon');
    r.datos.salones.forEach(function (s) {
      const op = P.crear('option', null, s.nombre + ' (' + s.nivel + ')');
      op.value = s.id;
      sel.appendChild(op);
    });
  }

  async function cargar() {
    const r = await P.api('/anuncios/gestion');
    if (!r.ok) {
      P.alerta('error', r.datos.mensaje || 'No se pudieron cargar los anuncios.');
      return;
    }
    anuncios = r.datos.anuncios;
    pintar();
  }

  function filtrados() {
    const texto = porId('input-busqueda').value.trim().toLowerCase();
    const dirigido = porId('filtro-dirigido').value;
    const estado = porId('filtro-estado').value;
    return anuncios.filter(function (a) {
      if (dirigido === 'salon' && !a.salon_id) return false;
      if (dirigido && dirigido !== 'salon' && (a.salon_id || a.dirigido_a !== dirigido)) return false;
      if (estado === 'vigente' && !vigente(a)) return false;
      if (estado === 'oculto' && vigente(a)) return false;
      return !texto || (a.titulo + ' ' + a.contenido).toLowerCase().indexOf(texto) !== -1;
    });
  }

  function pintar() {
    const cont = porId('lista-anuncios');
    const lista = filtrados();
    cont.textContent = '';
    porId('badge-total').textContent = lista.length + (lista.length === 1 ? ' anuncio' : ' anuncios');

    if (lista.length === 0) {
      const v = P.crear('div', 'vacio-grande');
      v.appendChild(P.crear('span', 'vacio-icono', '📣'));
      v.appendChild(P.crear('p', null, anuncios.length === 0
        ? 'Todavía no hay anuncios. Publica el primero con el botón "Nuevo anuncio".'
        : 'Ningún anuncio coincide con los filtros.'));
      cont.appendChild(v);
      return;
    }

    lista.forEach(function (a) {
      const esVigente = vigente(a);
      const card = P.crear('article', 'tarjeta-item' + (esVigente ? '' : ' inactivo'));

      const cab = P.crear('div', 'tarjeta-cabecera');
      cab.appendChild(P.crear('h3', 'tarjeta-titulo', a.titulo));
      const acc = P.crear('div', 'acciones-fila');
      const bEditar = P.crear('button', 'btn-texto', '✎ Editar');
      bEditar.type = 'button';
      bEditar.addEventListener('click', function () { abrirModal(a); });
      const bBorrar = P.crear('button', 'btn-texto peligro', '🗑 Eliminar');
      bBorrar.type = 'button';
      bBorrar.addEventListener('click', function () { eliminar(a); });
      acc.appendChild(bEditar);
      acc.appendChild(bBorrar);
      cab.appendChild(acc);
      card.appendChild(cab);

      const chips = P.crear('div', 'tarjeta-chips');
      if (a.salon_id) chips.appendChild(P.crear('span', 'chip chip-salon', '🏫 ' + a.salon));
      else chips.appendChild(P.crear('span', 'chip chip-' + a.dirigido_a, PARA[a.dirigido_a]));
      if (!a.activo) chips.appendChild(P.crear('span', 'chip chip-inactivo', 'Oculto'));
      else if (!esVigente) chips.appendChild(P.crear('span', 'chip chip-inactivo', 'Vencido'));
      if (a.expira_en && esVigente) chips.appendChild(P.crear('span', 'chip chip-yo', 'Hasta ' + P.fechaLarga(String(a.expira_en).slice(0, 10) + 'T12:00:00')));
      card.appendChild(chips);

      card.appendChild(P.crear('p', 'tarjeta-texto', a.contenido));

      const pie = P.crear('div', 'tarjeta-pie');
      pie.appendChild(P.crear('span', null, 'Por ' + a.autor + ' · ' + (NOMBRE_ROL[a.autor_rol] || a.autor_rol)));
      pie.appendChild(P.crear('span', null, P.fechaHora(a.publicado_en)));
      card.appendChild(pie);

      cont.appendChild(card);
    });
  }

  function abrirModal(a) {
    editando = a || null;
    porId('form-anuncio').reset();
    porId('err-anuncio').textContent = '';
    porId('modal-anuncio-titulo').textContent = a ? 'Editar anuncio' : 'Nuevo anuncio';
    porId('btn-guardar-anuncio').textContent = a ? 'Guardar cambios' : 'Publicar';
    porId('anu-salon').disabled = !!a;
    porId('anu-expira').min = hoy();
    if (a) {
      porId('anu-titulo').value = a.titulo;
      porId('anu-contenido').value = a.contenido;
      porId('anu-dirigido').value = a.dirigido_a;
      porId('anu-salon').value = a.salon_id || '';
      porId('anu-expira').value = a.expira_en ? String(a.expira_en).slice(0, 10) : '';
      porId('anu-activo').checked = a.activo;
    }
    actualizarDirigido();
    porId('anu-contador').textContent = porId('anu-contenido').value.length;
    P.abrirModal('modal-anuncio');
  }

  // Con un salón elegido, el anuncio es para los estudiantes de ese salón
  function actualizarDirigido() {
    const conSalon = porId('anu-salon').value !== '';
    porId('anu-dirigido').disabled = conSalon;
    if (conSalon) porId('anu-dirigido').value = 'estudiantes';
  }

  porId('form-anuncio').addEventListener('submit', async function (e) {
    e.preventDefault();
    const err = porId('err-anuncio');
    const datos = {
      titulo: porId('anu-titulo').value.trim(),
      contenido: porId('anu-contenido').value.trim(),
      dirigido_a: porId('anu-dirigido').value,
      expira_en: porId('anu-expira').value || null,
      activo: porId('anu-activo').checked
    };
    if (!datos.titulo || !datos.contenido) { err.textContent = 'Escribe el título y el mensaje.'; return; }
    if (!editando && porId('anu-salon').value) datos.salon_id = Number(porId('anu-salon').value);

    const btn = porId('btn-guardar-anuncio');
    btn.disabled = true;
    const r = editando
      ? await P.api('/anuncios/' + editando.id, { method: 'PUT', body: datos })
      : await P.api('/anuncios', { method: 'POST', body: datos });
    btn.disabled = false;

    if (!r.ok) { err.textContent = r.datos.mensaje || 'No se pudo guardar.'; return; }
    P.cerrarModal('modal-anuncio');
    P.alerta('exito', editando ? 'Anuncio actualizado.' : 'Anuncio publicado. Los destinatarios recibirán una notificación.');
    cargar();
  });

  async function eliminar(a) {
    const ok = await P.confirmar('¿Eliminar anuncio?', '"' + a.titulo + '" dejará de verse para todos.', 'Sí, eliminar');
    if (!ok) return;
    const r = await P.api('/anuncios/' + a.id, { method: 'DELETE' });
    if (!r.ok) { P.alerta('error', r.datos.mensaje || 'No se pudo eliminar.'); return; }
    P.alerta('exito', 'Anuncio eliminado.');
    cargar();
  }

  porId('btn-nuevo').addEventListener('click', function () { abrirModal(null); });
  porId('btn-cerrar-anuncio').addEventListener('click', function () { P.cerrarModal('modal-anuncio'); });
  porId('btn-cancelar-anuncio').addEventListener('click', function () { P.cerrarModal('modal-anuncio'); });
  porId('anu-salon').addEventListener('change', actualizarDirigido);
  porId('anu-contenido').addEventListener('input', function () { porId('anu-contador').textContent = this.value.length; });
  porId('input-busqueda').addEventListener('input', pintar);
  porId('filtro-dirigido').addEventListener('change', pintar);
  porId('filtro-estado').addEventListener('change', pintar);

  cargarSalones();
  cargar();
})();
