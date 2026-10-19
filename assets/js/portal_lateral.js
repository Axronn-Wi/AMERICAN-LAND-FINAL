/* ============================================================
   portal_lateral.js — Arma el menú lateral oscuro de los portales
   Instituto American Land
   Ubicación: assets/js/portal_lateral.js

   Se carga después de panel_roles.js / comunicaciones.js y ANTES
   de menu_movil.js (que luego pone los íconos de línea).
   1. Agrega la marca (logo + portal) arriba del lateral.
   2. Si el lateral no tiene los enlaces del menú superior (docente
      y estudiante), los copia como sección "Menú".
   3. Pone en la barra superior el título de la página actual.
============================================================ */

(function () {
  'use strict';

  const sidebar = document.querySelector('.sidebar');
  const nav = document.querySelector('header nav');
  if (!sidebar || !nav || sidebar.dataset.lateral) return;
  sidebar.dataset.lateral = '1';

  const NOMBRES = {
    admin: 'Portal administrativo',
    secretaria: 'Portal secretaría',
    docente: 'Portal docente',
    estudiante: 'Portal estudiante'
  };
  const rol = sessionStorage.getItem('rol') || '';

  function archivo(href) {
    const ruta = (href || '').split('#')[0].split('?')[0];
    return ruta.substring(ruta.lastIndexOf('/') + 1).toLowerCase();
  }

  // ── 1. Marca ──────────────────────────────────────────
  const marca = document.createElement('a');
  marca.className = 'lat-marca';
  marca.href = 'inicio.html';
  marca.innerHTML = '<img src="../assets/img/logo_circulo.png" alt="" /><span><b>American Land</b><small></small></span>';
  marca.querySelector('small').textContent = NOMBRES[rol] || 'Portal';
  sidebar.insertBefore(marca, sidebar.firstChild);

  // ── 2. Menú principal dentro del lateral ──────────────
  // El admin ya tiene su menú (.menu-item); docente y estudiante solo tienen
  // "Mis clases" y "Accesos rápidos", así que se les agrega la sección "Menú".
  const enlaces = Array.from(nav.querySelectorAll('.nav-links a'));
  const tieneMenu = sidebar.querySelector('.menu-item') !== null;

  if (!tieneMenu && enlaces.length > 0) {
    const seccion = document.createElement('section');
    // Clase propia: los scripts de cada página llenan la primera .sidebar-seccion ul
    seccion.className = 'lat-menu';
    const titulo = document.createElement('h3');
    titulo.textContent = 'Menú';
    const lista = document.createElement('ul');
    enlaces.forEach(function (a) {
      const li = document.createElement('li');
      li.className = 'menu-item' + (a.classList.contains('activo') ? ' activo' : '');
      const icono = document.createElement('span');
      icono.className = 'menu-icono';
      const enlace = document.createElement('a');
      enlace.href = a.getAttribute('href');
      enlace.textContent = a.textContent.trim();
      li.appendChild(icono);
      li.appendChild(enlace);
      lista.appendChild(li);
    });
    seccion.appendChild(titulo);
    seccion.appendChild(lista);
    marca.insertAdjacentElement('afterend', seccion);

    // "Accesos rápidos" que solo repiten páginas del menú: se ocultan
    const enMenu = new Set(enlaces.map(function (a) { return archivo(a.getAttribute('href')); }));
    sidebar.querySelectorAll('.sidebar-seccion').forEach(function (sec) {
      const accesos = sec.querySelectorAll('.acceso-link');
      if (accesos.length === 0) return;
      const repetidos = Array.from(accesos).every(function (a) { return enMenu.has(archivo(a.getAttribute('href'))); });
      if (repetidos) sec.hidden = true;
    });
  }

  // ── 2b. "Mi cuenta → Mi perfil y Muro" al final del lateral ──
  const enPerfil = archivo(window.location.pathname) === 'perfil.html';
  const cuenta = document.createElement('section');
  cuenta.className = 'lat-menu lat-cuenta';
  cuenta.innerHTML = '<h3>Mi cuenta</h3><ul><li class="menu-item' + (enPerfil ? ' activo' : '') +
    '"><span class="menu-icono"></span><a href="perfil.html">Mi perfil</a></li>' +
    '<li class="menu-item"><span class="menu-icono"></span><a href="../index.html#muro">Muro de la comunidad</a></li></ul>';
  const pie = sidebar.querySelector('.sidebar-footer');
  if (pie) sidebar.insertBefore(cuenta, pie); else sidebar.appendChild(cuenta);

  // Todo el renglón del menú es clicable, no solo el texto
  sidebar.addEventListener('click', function (e) {
    const item = e.target.closest('.menu-item, .clase-item');
    if (!item || e.target.closest('a, button')) return;
    const a = item.querySelector('a[href]');
    if (a) a.click();
  });

  // ── 3. Título de la página en la barra superior ───────
  const pestana = document.querySelector('.gestion-tab.activo');
  const activo = nav.querySelector('.nav-links a.activo');
  const texto = (pestana || activo) ? (pestana || activo).textContent.trim() : document.title.split(' - ')[0];

  const cabecera = document.createElement('div');
  cabecera.className = 'portal-titulo';
  cabecera.innerHTML = '<small></small><strong></strong>';
  cabecera.querySelector('small').textContent = NOMBRES[rol] || 'Portal';
  cabecera.querySelector('strong').textContent = texto;
  nav.insertBefore(cabecera, nav.firstChild);

  // ── 4. Perfil en la barra: lleva a "Mi perfil" y muestra la foto ──
  const perfilBarra = nav.querySelector('.nav-perfil');
  if (perfilBarra) {
    perfilBarra.setAttribute('role', 'link');
    perfilBarra.setAttribute('tabindex', '0');
    perfilBarra.title = 'Ver mi perfil';
    const irAlPerfil = function () { window.location.href = 'perfil.html'; };
    perfilBarra.addEventListener('click', irAlPerfil);
    perfilBarra.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irAlPerfil(); }
    });
  }

  function ponerFoto(url) {
    const avatar = document.getElementById('nav-avatar');
    if (!avatar || !url) return;
    avatar.textContent = '';
    avatar.style.backgroundImage = 'url("' + url + '")';
    avatar.classList.add('con-foto');
  }

  // La foto se guarda en la sesión; si aún no se conoce, se pide una vez
  const token = sessionStorage.getItem('token');
  const fotoGuardada = sessionStorage.getItem('foto');
  if (fotoGuardada !== null) {
    ponerFoto(fotoGuardada);
  } else if (token && !enPerfil) {
    const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:4000/api'
      : 'https://american-land-backend.onrender.com/api';
    fetch(API + '/perfil', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (datos) {
        if (!datos) return;
        const f = datos.perfil.foto;
        const url = f ? API + f.url + '?v=' + encodeURIComponent(f.version) : '';
        sessionStorage.setItem('foto', url);
        ponerFoto(url);
      })
      .catch(function () { /* sin foto: se quedan las iniciales */ });
  }
})();
