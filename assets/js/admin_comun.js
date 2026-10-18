/* ============================================================
   admin_comun.js — Utilidades de las páginas de Gestión
   (personal, anuncios y contactos)
   Instituto American Land
   Ubicación: assets/js/admin_comun.js

   Uso: window.Panel.iniciar(['admin', 'secretaria']) al comienzo
   del script de la página. Todo el texto de la base se pinta con
   textContent.
============================================================ */

(function () {
  'use strict';

  const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

  const token = sessionStorage.getItem('token');
  const rol = sessionStorage.getItem('rol');

  function salirAlLogin() {
    sessionStorage.clear();
    window.location.href = '../auth/login.html';
  }

  // Verifica la sesión, pinta nombre/avatar y activa "Cerrar sesión"
  function iniciar(rolesPermitidos) {
    if (!token || rolesPermitidos.indexOf(rol) === -1) {
      if (rol === 'secretaria') window.location.replace('inicio.html');
      else salirAlLogin();
      return false;
    }
    const nombre = sessionStorage.getItem('nombre') || 'Usuario';
    const navNombre = document.getElementById('nav-nombre');
    const navAvatar = document.getElementById('nav-avatar');
    if (navNombre) navNombre.textContent = nombre;
    if (navAvatar) navAvatar.textContent = nombre.charAt(0).toUpperCase();

    const cerrar = document.querySelector('.btn-cerrar');
    if (cerrar) {
      cerrar.addEventListener('click', function (e) {
        e.preventDefault();
        salirAlLogin();
      });
    }
    return true;
  }

  // Devuelve { ok, status, datos }. Si la sesión venció, va al login.
  async function api(ruta, opciones) {
    const config = opciones || {};
    const headers = { 'Authorization': 'Bearer ' + token };
    if (config.body) headers['Content-Type'] = 'application/json';

    let respuesta;
    try {
      respuesta = await fetch(API + ruta, {
        method: config.method || 'GET',
        headers: headers,
        body: config.body ? JSON.stringify(config.body) : undefined
      });
    } catch (err) {
      return { ok: false, status: 0, datos: { mensaje: 'No se pudo conectar con el servidor.' } };
    }

    if (respuesta.status === 401) {
      salirAlLogin();
      return { ok: false, status: 401, datos: {} };
    }
    let datos = {};
    try { datos = await respuesta.json(); } catch (_) { /* sin cuerpo */ }
    return { ok: respuesta.ok, status: respuesta.status, datos: datos };
  }

  function crear(tag, clase, texto) {
    const el = document.createElement(tag);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  }

  function iniciales(texto) {
    const partes = String(texto || '?').trim().split(/\s+/);
    return ((partes[0] || '?').charAt(0) + (partes.length > 1 ? partes[partes.length - 1].charAt(0) : '')).toUpperCase();
  }

  let temporizadorAlerta = null;
  function alerta(tipo, texto) {
    const el = document.getElementById('alerta');
    if (!el) return;
    el.textContent = texto;
    el.className = 'alerta ' + tipo + ' visible';
    clearTimeout(temporizadorAlerta);
    temporizadorAlerta = setTimeout(function () { el.className = 'alerta'; }, 5000);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function fechaLarga(valor) {
    if (!valor) return '';
    return new Date(valor).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fechaHora(valor) {
    if (!valor) return '';
    return new Date(valor).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }

  function pintarFechaHoy(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const texto = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    el.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  // Modales: abre/cierra un .modal-overlay y cierra con Escape o clic afuera
  function abrirModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.style.display = 'flex';
    const primero = m.querySelector('input:not([type=hidden]), textarea, select, button');
    if (primero) setTimeout(function () { primero.focus(); }, 50);
  }

  function cerrarModal(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = 'none';
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay').forEach(function (m) { m.style.display = 'none'; });
  });
  document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('modal-overlay')) e.target.style.display = 'none';
  });

  // Confirmación con el modal genérico #modal-confirmar (si existe en la página)
  function confirmar(titulo, texto, textoBoton) {
    return new Promise(function (resolver) {
      const m = document.getElementById('modal-confirmar');
      if (!m) { resolver(window.confirm(texto)); return; }
      m.querySelector('.modal-titulo').textContent = titulo;
      m.querySelector('.modal-aviso').textContent = texto;
      const si = m.querySelector('[data-confirmar]');
      const no = m.querySelectorAll('[data-cancelar]');
      si.textContent = textoBoton || 'Sí, continuar';
      function terminar(valor) {
        si.removeEventListener('click', alSi);
        no.forEach(function (b) { b.removeEventListener('click', alNo); });
        cerrarModal('modal-confirmar');
        resolver(valor);
      }
      function alSi() { terminar(true); }
      function alNo() { terminar(false); }
      si.addEventListener('click', alSi);
      no.forEach(function (b) { b.addEventListener('click', alNo); });
      abrirModal('modal-confirmar');
    });
  }

  window.Panel = {
    rol: rol, iniciar: iniciar, api: api, crear: crear, iniciales: iniciales, alerta: alerta,
    fechaLarga: fechaLarga, fechaHora: fechaHora, pintarFechaHoy: pintarFechaHoy,
    abrirModal: abrirModal, cerrarModal: cerrarModal, confirmar: confirmar
  };
})();
