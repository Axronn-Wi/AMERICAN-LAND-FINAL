/* ============================================================
   index.js — Funcionalidad de la página principal
   Instituto American Land
   Ubicación: assets/js/index.js
============================================================ */

// ── 1. MENÚ MÓVIL ──────────────────────────────────────────
const btnMenu  = document.getElementById('btn-menu');
const navLinks = document.getElementById('nav-links');
const navAuth  = document.getElementById('nav-auth');

let menuAbierto = false;

btnMenu.addEventListener('click', function () {
  menuAbierto = !menuAbierto;
  navLinks.classList.toggle('abierto', menuAbierto);

  if (menuAbierto) {
    const altoLinks = navLinks.offsetHeight;
    navAuth.style.top = (73 + altoLinks) + 'px';
    navAuth.classList.add('abierto');
  } else {
    navAuth.classList.remove('abierto');
  }
});

// Cerrar menú al hacer clic en cualquier enlace
document.querySelectorAll('.nav-links a, .nav-auth a').forEach(function (enlace) {
  enlace.addEventListener('click', function () {
    menuAbierto = false;
    navLinks.classList.remove('abierto');
    navAuth.classList.remove('abierto');
  });
});

// ── 2. ENLACE ACTIVO AL HACER SCROLL ───────────────────────
const secciones = document.querySelectorAll('section[id]');

window.addEventListener('scroll', function () {
  let scrollY = window.pageYOffset;

  secciones.forEach(function (seccion) {
    const tope = seccion.offsetTop - 90;
    const alto = seccion.offsetHeight;
    const id   = seccion.getAttribute('id');
    const enlace = navLinks.querySelector('a[href="#' + id + '"]');

    if (enlace) {
      if (scrollY > tope && scrollY <= tope + alto) {
        navLinks.querySelectorAll('a').forEach(a => a.classList.remove('activo'));
        enlace.classList.add('activo');
      }
    }
  });
});

// ── 3. ANIMACIÓN DE ENTRADA CON INTERSECTIONOBSERVER ───────
const elementosAnimados = document.querySelectorAll('.animar-entrada');

const observador = new IntersectionObserver(function (entradas) {
  entradas.forEach(function (entrada) {
    if (entrada.isIntersecting) {
      entrada.target.classList.add('visible');
      observador.unobserve(entrada.target);
    }
  });
}, { threshold: 0.15 });

elementosAnimados.forEach(el => observador.observe(el));

// ── 4. SMOOTH SCROLL EN ENLACES INTERNOS ───────────────────
document.querySelectorAll('a[href^="#"]').forEach(function (enlace) {
  enlace.addEventListener('click', function (e) {
    const destino = document.querySelector(this.getAttribute('href'));
    if (destino) {
      e.preventDefault();
      destino.scrollIntoView({ behavior: 'smooth' });
    }
  });
});