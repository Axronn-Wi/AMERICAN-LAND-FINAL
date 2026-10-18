/* ============================================================
   anuncios_widget.js — Tablero de anuncios en el inicio
   Instituto American Land
   Ubicación: assets/js/anuncios_widget.js

   Pinta los anuncios vigentes dentro de <section id="anuncios-portal">.
   El docente además puede publicar, editar y borrar anuncios para
   los estudiantes de sus salones. Admin y secretaría gestionan
   desde admin/anuncios.html.
============================================================ */

(function () {
  'use strict';

  const caja = document.getElementById('anuncios-portal');
  const token = sessionStorage.getItem('token');
  const rol = sessionStorage.getItem('rol');
  if (!caja || !token) return;

  const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

  const PARA = { todos: 'Todos', estudiantes: 'Estudiantes', docentes: 'Docentes' };
  const esDocente = rol === 'docente';
  const esAdministracion = rol === 'admin' || rol === 'secretaria';

  function el(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto !== undefined && texto !== null) n.textContent = texto;
    return n;
  }

  async function api(ruta, opciones) {
    const op = opciones || {};
    const r = await fetch(API + ruta, {
      method: op.method || 'GET',
      headers: Object.assign({ 'Authorization': 'Bearer ' + token }, op.body ? { 'Content-Type': 'application/json' } : {}),
      body: op.body ? JSON.stringify(op.body) : undefined
    });
    const datos = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(datos.mensaje || 'Error de conexión');
    return datos;
  }

  function cuando(fecha) {
    const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
    if (dias <= 0) return 'Hoy';
    if (dias === 1) return 'Ayer';
    if (dias < 7) return 'Hace ' + dias + ' días';
    return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  }

  // ── Estructura ───────────────────────────────────────────
  caja.classList.add('anuncios-portal');
  caja.textContent = '';
  const cab = el('div', 'anuncios-cabecera');
  const titulo = el('h2', null, 'Anuncios');
  cab.appendChild(titulo);
  const lista = el('div', 'anuncios-lista');

  if (esDocente) {
    const btnNuevo = el('button', 'anuncios-btn', '+ Publicar anuncio');
    btnNuevo.type = 'button';
    btnNuevo.addEventListener('click', function () { abrirModal(null); });
    cab.appendChild(btnNuevo);
  } else if (esAdministracion) {
    const gestionar = el('a', 'anuncios-btn', 'Gestionar →');
    gestionar.href = 'anuncios.html';
    cab.appendChild(gestionar);
  }
  caja.appendChild(cab);
  caja.appendChild(lista);

  // ── Lista ────────────────────────────────────────────────
  async function cargar() {
    try {
      const datos = await api('/anuncios?limite=6');
      pintar(datos.anuncios);
    } catch (err) {
      lista.textContent = '';
      lista.appendChild(el('p', 'anuncios-vacio', 'No se pudieron cargar los anuncios.'));
    }
  }

  function pintar(anuncios) {
    lista.textContent = '';
    if (anuncios.length === 0) {
      lista.appendChild(el('p', 'anuncios-vacio', esDocente
        ? 'No hay anuncios. Publica uno para avisarle algo a tus estudiantes.'
        : 'No hay anuncios por ahora.'));
      return;
    }

    anuncios.forEach(function (a) {
      const card = el('article', 'anuncio-card');
      const top = el('div', 'anuncio-top');
      top.appendChild(el('span', 'anuncio-etiqueta', a.salon ? '🏫 ' + a.salon : PARA[a.dirigido_a] || 'Todos'));
      top.appendChild(el('span', 'anuncio-fecha', cuando(a.publicado_en)));
      card.appendChild(top);
      card.appendChild(el('h3', 'anuncio-titulo', a.titulo));

      const texto = el('p', 'anuncio-texto', a.contenido);
      card.appendChild(texto);
      if (a.contenido.length > 180) {
        texto.classList.add('recortado');
        const mas = el('button', 'anuncio-mas', 'Leer más');
        mas.type = 'button';
        mas.addEventListener('click', function () {
          const abierto = texto.classList.toggle('recortado');
          mas.textContent = abierto ? 'Leer más' : 'Leer menos';
        });
        card.appendChild(mas);
      }

      const pie = el('div', 'anuncio-pie');
      pie.appendChild(el('span', null, a.autor));

      // Los anuncios de salón publicados por docentes son del docente de ese salón
      if (esDocente && a.autor_rol === 'docente' && a.salon_id) {
        const propios = el('span', 'anuncio-acciones');
        const editar = el('button', null, 'Editar');
        editar.type = 'button';
        editar.addEventListener('click', function () { abrirModal(a); });
        const borrar = el('button', 'peligro', 'Eliminar');
        borrar.type = 'button';
        borrar.addEventListener('click', function () { eliminar(a, borrar); });
        propios.appendChild(editar);
        propios.appendChild(borrar);
        pie.appendChild(propios);
      }
      card.appendChild(pie);
      lista.appendChild(card);
    });
  }

  async function eliminar(a, boton) {
    if (!window.confirm('¿Eliminar el anuncio "' + a.titulo + '"?')) return;
    boton.disabled = true;
    try {
      await api('/anuncios/' + a.id, { method: 'DELETE' });
      cargar();
    } catch (err) {
      window.alert(err.message);
      boton.disabled = false;
    }
  }

  // ── Modal del docente ────────────────────────────────────
  let modal = null;
  let editando = null;

  function crearModal() {
    modal = el('div', 'anuncio-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML =
      '<form class="anuncio-modal-caja" novalidate>' +
      '  <div class="anuncio-modal-cab"><h2>Publicar anuncio</h2><button type="button" data-cerrar aria-label="Cerrar">✕</button></div>' +
      '  <label>Salón<select name="salon" required></select></label>' +
      '  <label>Título<input name="titulo" maxlength="150" required placeholder="Ej: Traer el libro el jueves" /></label>' +
      '  <label>Mensaje<textarea name="contenido" maxlength="2000" rows="5" required placeholder="Escribe el anuncio para tus estudiantes..."></textarea></label>' +
      '  <label>Visible hasta (opcional)<input name="expira" type="date" /></label>' +
      '  <p class="anuncio-modal-error" aria-live="polite"></p>' +
      '  <div class="anuncio-modal-pie"><button type="button" data-cerrar class="secundario">Cancelar</button><button type="submit">Publicar</button></div>' +
      '</form>';
    document.body.appendChild(modal);

    const form = modal.querySelector('form');
    modal.querySelectorAll('[data-cerrar]').forEach(function (b) { b.addEventListener('click', cerrarModal); });
    modal.addEventListener('click', function (e) { if (e.target === modal) cerrarModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('abierto')) cerrarModal(); });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const error = modal.querySelector('.anuncio-modal-error');
      const datos = {
        titulo: form.titulo.value.trim(),
        contenido: form.contenido.value.trim(),
        expira_en: form.expira.value || null,
        dirigido_a: 'estudiantes'
      };
      if (!datos.titulo || !datos.contenido) { error.textContent = 'Escribe el título y el mensaje.'; return; }
      const enviar = form.querySelector('[type=submit]');
      enviar.disabled = true;
      try {
        if (editando) {
          await api('/anuncios/' + editando.id, { method: 'PUT', body: datos });
        } else {
          datos.salon_id = Number(form.salon.value);
          await api('/anuncios', { method: 'POST', body: datos });
        }
        cerrarModal();
        cargar();
      } catch (err) {
        error.textContent = err.message;
      } finally {
        enviar.disabled = false;
      }
    });

    // Salones del docente
    api('/docentes/salones').then(function (d) {
      const sel = form.salon;
      d.salones.forEach(function (s) {
        const op = el('option', null, s.nombre);
        op.value = s.id;
        sel.appendChild(op);
      });
      if (d.salones.length === 0) {
        sel.appendChild(el('option', null, 'No tienes salones asignados'));
        form.querySelector('[type=submit]').disabled = true;
      }
    }).catch(function () {});
  }

  function abrirModal(a) {
    if (!modal) crearModal();
    editando = a;
    const form = modal.querySelector('form');
    form.reset();
    modal.querySelector('h2').textContent = a ? 'Editar anuncio' : 'Publicar anuncio';
    form.querySelector('[type=submit]').textContent = a ? 'Guardar' : 'Publicar';
    form.salon.disabled = !!a;
    form.expira.min = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
    modal.querySelector('.anuncio-modal-error').textContent = '';
    if (a) {
      form.titulo.value = a.titulo;
      form.contenido.value = a.contenido;
      form.expira.value = a.expira_en ? String(a.expira_en).slice(0, 10) : '';
      if (a.salon_id) form.salon.value = a.salon_id;
    }
    modal.classList.add('abierto');
    setTimeout(function () { form.titulo.focus(); }, 50);
  }

  function cerrarModal() {
    if (modal) modal.classList.remove('abierto');
  }

  cargar();
})();
