/* ============================================================
   admisiones_inicio.js — Funcionalidad de la página de admisiones
   Instituto American Land
   Ubicación: assets/js/admisiones_inicio.js
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

// ── 2. ANIMACIÓN DE ENTRADA CON INTERSECTIONOBSERVER ───────
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

// ── 3. SMOOTH SCROLL EN ENLACES INTERNOS ───────────────────
document.querySelectorAll('a[href^="#"]').forEach(function (enlace) {
  enlace.addEventListener('click', function (e) {
    const destino = document.querySelector(this.getAttribute('href'));
    if (destino) {
      e.preventDefault();
      destino.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ── 4. FAQ: SOLO UNA PREGUNTA ABIERTA A LA VEZ ─────────────
const itemsFaq = document.querySelectorAll('.faq-item');

itemsFaq.forEach(function (item) {
  item.addEventListener('toggle', function () {
    if (item.open) {
      itemsFaq.forEach(function (otro) {
        if (otro !== item) otro.removeAttribute('open');
      });
    }
  });
});

// Año actual en el pie de página
const anioPie = document.getElementById('anio-actual');
if (anioPie) anioPie.textContent = new Date().getFullYear();
