/* ============================================================
   panel_roles.js — Ajusta el panel de administración según el rol
   Instituto American Land
   Ubicación: assets/js/panel_roles.js

   Admin y secretaría comparten las páginas de la carpeta admin/.
   Con rol "secretaria" este script:
     - cambia los textos del perfil ("Secretaría"),
     - quita del menú las páginas que no le corresponden,
     - y si abre una de ellas, la manda al inicio.
   Se carga ANTES del script propio de la página y de menu_movil.js.
   El backend vuelve a validar cada permiso: esto es solo la interfaz.
============================================================ */

(function () {
  'use strict';

  const rol = sessionStorage.getItem('rol');
  document.documentElement.dataset.rol = rol || '';
  if (rol !== 'secretaria') return;

  // Páginas del panel que la secretaría no usa
  const SOLO_ADMIN = ['docentes.html', 'salones.html', 'personal.html'];

  const pagina = window.location.pathname.split('/').pop();
  if (SOLO_ADMIN.indexOf(pagina) !== -1) {
    window.location.replace('inicio.html');
    return;
  }

  // Textos del perfil
  document.querySelectorAll('.nav-rol').forEach(function (el) { el.textContent = 'Secretaría'; });
  document.querySelectorAll('.sidebar-seccion h3').forEach(function (h3) {
    if (h3.textContent.trim() === 'Panel Admin') h3.textContent = 'Panel Secretaría';
  });
  document.title = document.title.replace('Panel Admin', 'Panel Secretaría');

  // Enlaces y botones a páginas de solo admin
  document.querySelectorAll('a[href]').forEach(function (a) {
    const destino = a.getAttribute('href').split('/').pop().split('?')[0];
    if (SOLO_ADMIN.indexOf(destino) === -1) return;
    // "Gestión" apunta a personal.html: para la secretaría abre anuncios
    if (destino === 'personal.html' && a.closest('.nav-links')) {
      a.setAttribute('href', 'anuncios.html');
      return;
    }
    // Del menú superior se quitan (de ahí sale la barra del celular);
    // en el resto solo se ocultan, porque los scripts de la página pueden usarlos
    const item = a.closest('li') || a;
    if (a.closest('.nav-links')) item.remove();
    else item.hidden = true;
  });

  ['sb-nuevo-docente', 'sb-nuevo-salon', 'btn-nuevo-docente', 'btn-nuevo-salon'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) (el.closest('li') || el).hidden = true;
  });

  // Acciones que solo puede hacer el admin (el backend las rechaza igual)
  const estilo = document.createElement('style');
  estilo.textContent = '[data-rol="secretaria"] .solo-admin, [data-rol="secretaria"] .sidebar [hidden] { display: none !important; }';
  document.head.appendChild(estilo);
})();
