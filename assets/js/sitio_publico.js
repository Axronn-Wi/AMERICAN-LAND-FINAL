/* ============================================================
   sitio_publico.js — Barra de navegación y animaciones del
   sitio público (diseño Púrpura Americana)
   Instituto American Land
   Ubicación: assets/js/sitio_publico.js

   Funciona con la barra de todas las páginas públicas:
   header > nav#... con .nav-links, .nav-auth y #btn-menu.
============================================================ */

(function () {
  'use strict';

  const header = document.querySelector('header');
  const nav = header ? header.querySelector('nav') : null;
  const boton = document.getElementById('btn-menu');

  // ── Menú móvil ─────────────────────────────────────────
  if (nav && boton) {
    boton.addEventListener('click', function () {
      const abierto = nav.classList.toggle('abierto');
      boton.setAttribute('aria-expanded', String(abierto));
      boton.innerHTML = abierto ? '&#10005;' : '&#9776;';
    });
    nav.querySelectorAll('.nav-links a, .nav-auth a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('abierto');
        boton.setAttribute('aria-expanded', 'false');
        boton.innerHTML = '&#9776;';
      });
    });
  }

  // ── Sombra de la barra al hacer scroll ─────────────────
  if (header) {
    const alScroll = function () { header.classList.toggle('con-scroll', window.scrollY > 20); };
    window.addEventListener('scroll', alScroll, { passive: true });
    alScroll();
  }

  // ── Enlace activo según la sección visible (solo anclas #) ──
  const enlaces = document.querySelectorAll('.nav-links a[href^="#"]');
  const secciones = Array.from(enlaces)
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);
  if (secciones.length > 0) {
    window.addEventListener('scroll', function () {
      let actual = secciones[0];
      secciones.forEach(function (s) { if (s.getBoundingClientRect().top <= 140) actual = s; });
      enlaces.forEach(function (a) { a.classList.toggle('activo', a.getAttribute('href') === '#' + actual.id); });
    }, { passive: true });
  }

  // ── Animación de entrada ───────────────────────────────
  const animados = document.querySelectorAll('.animar-entrada');
  if ('IntersectionObserver' in window) {
    const observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observador.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    animados.forEach(function (el) { observador.observe(el); });
  } else {
    animados.forEach(function (el) { el.classList.add('visible'); });
  }

  // ── Año del pie de página ──────────────────────────────
  const anio = document.getElementById('anio-actual');
  if (anio) anio.textContent = new Date().getFullYear();
})();
