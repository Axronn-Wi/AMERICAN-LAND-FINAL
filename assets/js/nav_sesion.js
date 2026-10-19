/* ============================================================
   nav_sesion.js — Sesión en la barra del sitio público
   Instituto American Land
   Ubicación: assets/js/nav_sesion.js

   Si el usuario ya inició sesión, cambia "Ingresar / Inscríbete"
   por su foto y nombre (lleva a su portal) y un botón "Salir".
   Se carga en el index y en las páginas de admisiones.
============================================================ */

(function () {
  'use strict';

  const navAuth = document.getElementById('nav-auth');
  const token = sessionStorage.getItem('token');
  if (!navAuth || !token) return;

  // Si el token ya venció, se trata como visitante (sin pedir nada al servidor)
  try {
    const datos = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (datos.exp && datos.exp * 1000 < Date.now()) { sessionStorage.clear(); return; }
  } catch (_) {
    return;
  }

  const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

  // Ruta base de la página ("" en el index, "../" en admisiones), tomada del enlace de ingreso
  const ingresar = navAuth.querySelector('a[href*="auth/login.html"]');
  const base = ingresar ? ingresar.getAttribute('href').split('auth/login.html')[0] : '';

  const PORTALES = {
    estudiante: 'alumnos/inicio.html',
    docente: 'docentes/inicio.html',
    admin: 'admin/inicio.html',
    secretaria: 'admin/inicio.html'
  };
  const rol = sessionStorage.getItem('rol');
  const nombre = (sessionStorage.getItem('nombre') || 'Mi cuenta').trim();
  const partes = nombre.split(/\s+/);
  const iniciales = (partes[0].charAt(0) + (partes.length > 1 ? partes[partes.length - 1].charAt(0) : '')).toUpperCase();

  const usuario = document.createElement('a');
  usuario.className = 'nav-usuario';
  usuario.href = base + (PORTALES[rol] || 'auth/login.html');
  usuario.title = 'Ir a mi portal';

  const avatar = document.createElement('span');
  avatar.className = 'nav-usuario-avatar';
  avatar.textContent = iniciales;

  const texto = document.createElement('span');
  texto.className = 'nav-usuario-texto';
  const strong = document.createElement('strong');
  strong.textContent = partes[0];
  const small = document.createElement('small');
  small.textContent = 'Mi portal';
  texto.append(strong, small);
  usuario.append(avatar, texto);

  const salir = document.createElement('button');
  salir.type = 'button';
  salir.className = 'btn-salir';
  salir.textContent = 'Salir';
  salir.addEventListener('click', function () {
    sessionStorage.clear();
    window.location.reload();
  });

  navAuth.replaceChildren(usuario, salir);

  function ponerFoto(url) {
    if (!url) return;
    avatar.textContent = '';
    avatar.style.backgroundImage = 'url("' + url + '")';
    avatar.classList.add('con-foto');
  }

  // La foto se guarda en la sesión; si aún no se conoce, se pide una sola vez
  // y se avisa a la página (el muro la usa en su barra para publicar)
  const foto = sessionStorage.getItem('foto');
  if (foto !== null) {
    ponerFoto(foto);
  } else {
    fetch(API + '/perfil', { headers: { Authorization: 'Bearer ' + token } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (datos) {
        if (!datos) return;
        const f = datos.perfil.foto;
        const url = f ? API + f.url + '?v=' + encodeURIComponent(f.version) : '';
        sessionStorage.setItem('foto', url);
        ponerFoto(url);
        document.dispatchEvent(new CustomEvent('sesion:foto', { detail: url }));
      })
      .catch(function () { /* sin foto: quedan las iniciales */ });
  }
})();
