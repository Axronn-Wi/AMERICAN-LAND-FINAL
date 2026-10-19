/* ============================================================
   menu_movil.js — Barra de navegación inferior (solo celular)
   Instituto American Land
   Ubicación: assets/js/menu_movil.js

   Lee los enlaces de:  header nav .nav-links
   y arma la barra con un ícono por enlace (según el nombre del archivo).
   El menú de escritorio no se modifica: solo se reordenan los enlaces
   dentro de la barra. El CSS (menu_movil.css) la muestra únicamente en
   pantallas de hasta 768 px.
============================================================ */

(function () {
  'use strict';

  // Enlace que va en el botón central (solo si hay cantidad impar de enlaces)
  const CENTRAL_PREFERIDO = 'salon_virtual';

  // Orden en la barra. Solo se aplica si TODOS los enlaces de la página
  // están en esta lista (alumnos y docentes); si no, se respeta el orden
  // del menú original.
  const ORDEN = ['inicio', 'horario', 'salon_virtual', 'asistencia', 'tareas', 'notas'];

  // Íconos de línea (24 x 24). Contenido fijo del programa, no datos del usuario.
  const ICONOS = {
    inicio:        '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V10"/>',
    horario:       '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    salon_virtual: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8 20.5h8M12 16.5v4"/>',
    tareas:        '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5M9 13l2.2 2.2L15.5 11"/>',
    notas:         '<path d="M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9Z"/><path d="M6.5 11.2v4.3c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-4.3M21.5 9v5"/>',
    matriculas:    '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.4-1.6 1.6-2.5 3-2.5s2.6.9 3 2.5M14.5 10h4M14.5 13.5h3"/>',
    alumnos:       '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
    docentes:      '<circle cx="9.5" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 7-5.5s6.4 2.1 7 5.5"/><path d="m16.5 8.5 2 2 3.5-4"/>',
    salones:       '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    asistencia:    '<rect x="4" y="4.5" width="16" height="16" rx="2.5"/><path d="M8 3v3M16 3v3M4 9.5h16M8.5 14.5l2.2 2.2 4.8-4.7"/>',
    perfil:        '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
    personal:      '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M15.5 11.5l1.8 1.8 4-4"/>',
    anuncios:      '<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    contactos:     '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
    generico:      '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.5"/>'
  };

  // "../alumnos/salon_virtual.html?x=1" -> "salon_virtual"
  function nombreDe(href) {
    const ruta = (href || '').split('#')[0].split('?')[0];
    const archivo = ruta.substring(ruta.lastIndexOf('/') + 1);
    return archivo.replace(/\.html?$/i, '').toLowerCase();
  }

  function leerEnlaces() {
    const enlaces = document.querySelectorAll('header nav .nav-links a');
    const paginaActual = nombreDe(window.location.pathname);

    return Array.from(enlaces).map(function (a) {
      const href = a.getAttribute('href') || '#';
      const nombre = nombreDe(href);
      return {
        href: href,
        nombre: nombre,
        texto: a.textContent.trim(),
        activo: a.classList.contains('activo') || (nombre !== '' && nombre === paginaActual)
      };
    });
  }

  function ordenar(items) {
    let lista = items.slice();

    // 1) Orden fijo, solo si se conocen todos los enlaces
    if (lista.every(function (i) { return ORDEN.indexOf(i.nombre) !== -1; })) {
      lista.sort(function (a, b) { return ORDEN.indexOf(a.nombre) - ORDEN.indexOf(b.nombre); });
    }

    // 2) Con cantidad impar hay botón central; si el preferido existe, va al medio
    if (lista.length % 2 === 1) {
      const pos = lista.findIndex(function (i) { return i.nombre === CENTRAL_PREFERIDO; });
      if (pos !== -1) {
        const central = lista.splice(pos, 1)[0];
        lista.splice(Math.floor(items.length / 2), 0, central);
      }
    }
    return lista;
  }

  function crearBarra(items) {
    const barra = document.createElement('div');
    barra.className = 'menu-movil';
    barra.setAttribute('role', 'navigation');
    barra.setAttribute('aria-label', 'Navegación principal');

    const hayCentral = items.length % 2 === 1;
    const indiceCentral = Math.floor(items.length / 2);

    items.forEach(function (item, i) {
      const a = document.createElement('a');
      a.className = 'menu-movil__item' +
        (item.activo ? ' activo' : '') +
        (hayCentral && i === indiceCentral ? ' central' : '');
      a.setAttribute('href', item.href);
      a.setAttribute('aria-label', item.texto);
      a.setAttribute('title', item.texto);
      if (item.activo) a.setAttribute('aria-current', 'page');

      a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        (ICONOS[item.nombre] || ICONOS.generico) + '</svg>';

      barra.appendChild(a);
    });

    document.body.appendChild(barra);
  }

  // Menú lateral: cambia los emojis por los mismos íconos de línea de la barra,
  // para que todo el portal tenga un estilo uniforme. Si no hay ícono para ese
  // enlace, se deja el emoji original.
  function iconosLaterales() {
    document.querySelectorAll('.sidebar a[href]').forEach(function (a) {
      const contenedor = a.closest('.menu-item');
      const icono = contenedor ? contenedor.querySelector('.menu-icono') : a.querySelector('span:first-child');
      const nombre = nombreDe(a.getAttribute('href'));
      if (!icono || !ICONOS[nombre] || icono.querySelector('svg')) return;
      icono.innerHTML = '<svg class="icono-linea" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONOS[nombre] + '</svg>';
    });
  }

  function iniciar() {
    iconosLaterales();
    if (document.querySelector('.menu-movil')) return;   // ya existe
    const items = leerEnlaces();
    if (items.length === 0) return;                      // la página no tiene menú
    crearBarra(ordenar(items));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();