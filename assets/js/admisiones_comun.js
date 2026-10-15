/* admisiones_comun.js — utilidades compartidas del flujo de admisiones */
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

const btnMenu  = document.getElementById('btn-menu');
const navLinks = document.getElementById('nav-links');
const navAuth  = document.getElementById('nav-auth');
if (btnMenu) {
  btnMenu.addEventListener('click', function () {
    const abrir = !navLinks.classList.contains('abierto');
    navLinks.classList.toggle('abierto', abrir);
    navAuth.classList.toggle('abierto', abrir);
    if (abrir) navAuth.style.top = (73 + navLinks.offsetHeight) + 'px';
  });
}

// Escapa texto antes de insertarlo como HTML
function esc(texto) {
  const d = document.createElement('div');
  d.textContent = texto ?? '';
  return d.innerHTML;
}

function formatoCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}