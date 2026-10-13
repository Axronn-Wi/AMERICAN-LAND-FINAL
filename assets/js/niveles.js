/* ============================================================
   niveles.js — Funcionalidad de la página de Niveles
   Instituto American Land
   Ubicación: assets/js/niveles.js
   (index.js ya maneja el menú móvil, el scroll y las animaciones)
============================================================ */

// ── 1. VER / OCULTAR CONTENIDO DE CADA NIVEL ───────────────
const botonesTemas = document.querySelectorAll('.btn-ver-temas');

botonesTemas.forEach(function (boton) {
  const lista = boton.nextElementSibling;

  boton.addEventListener('click', function () {
    const abierto = lista.classList.toggle('abierto');
    boton.setAttribute('aria-expanded', abierto);
    boton.querySelector('.flecha').textContent = abierto ? '▴' : '▾';
  });
});

// ── 2. RESALTAR NIVEL SI LLEGA POR ANCLA (#nivel-b1, etc.) ─
window.addEventListener('DOMContentLoaded', function () {
  const hash = window.location.hash;
  if (!hash) return;

  const tarjeta = document.querySelector(hash);
  if (!tarjeta || !tarjeta.classList.contains('card-nivel')) return;

  tarjeta.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const boton = tarjeta.querySelector('.btn-ver-temas');
  const lista = tarjeta.querySelector('.card-nivel-temas');
  if (boton && lista) {
    lista.classList.add('abierto');
    boton.setAttribute('aria-expanded', 'true');
    boton.querySelector('.flecha').textContent = '▴';
  }
});
