/* ============================================================
   estudiantes.js — Funcionalidad de la página de Estudiantes
   Instituto American Land
   Ubicación: assets/js/estudiantes.js
   (index.js ya maneja el menú móvil, el scroll y las animaciones)
============================================================ */

// ── CARRUSEL DE TESTIMONIOS ─────────────────────────────────
const slides   = document.querySelectorAll('.testimonio-slide');
const puntosEl = document.getElementById('carrusel-puntos');
const btnAnterior  = document.getElementById('carrusel-anterior');
const btnSiguiente = document.getElementById('carrusel-siguiente');

let indiceActual = 0;
let intervaloAuto = null;

// Crear los puntos de navegación dinámicamente según el número de slides
slides.forEach(function (_, i) {
  const punto = document.createElement('button');
  punto.type = 'button';
  punto.className = 'punto-carrusel' + (i === 0 ? ' activo' : '');
  punto.setAttribute('aria-label', 'Ir al testimonio ' + (i + 1));
  punto.addEventListener('click', function () {
    irASlide(i);
    reiniciarAutoplay();
  });
  puntosEl.appendChild(punto);
});

const puntos = document.querySelectorAll('.punto-carrusel');

function irASlide(indice) {
  slides[indiceActual].classList.remove('activo');
  puntos[indiceActual].classList.remove('activo');

  indiceActual = (indice + slides.length) % slides.length;

  slides[indiceActual].classList.add('activo');
  puntos[indiceActual].classList.add('activo');
}

function siguienteSlide() { irASlide(indiceActual + 1); }
function anteriorSlide()  { irASlide(indiceActual - 1); }

function reiniciarAutoplay() {
  clearInterval(intervaloAuto);
  intervaloAuto = setInterval(siguienteSlide, 7000);
}

if (btnSiguiente) {
  btnSiguiente.addEventListener('click', function () {
    siguienteSlide();
    reiniciarAutoplay();
  });
}

if (btnAnterior) {
  btnAnterior.addEventListener('click', function () {
    anteriorSlide();
    reiniciarAutoplay();
  });
}

if (slides.length > 1) {
  reiniciarAutoplay();
}
