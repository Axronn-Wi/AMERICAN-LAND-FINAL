/* ============================================================
   contacto_web.js — Formulario de contacto de la página principal
   Instituto American Land
   Ubicación: assets/js/contacto_web.js
   Envía a POST /api/contacto (público). Llega a admin/contactos.html.
============================================================ */

(function () {
  'use strict';

  const form = document.getElementById('form-contacto');
  if (!form) return;

  const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

  const aviso = document.getElementById('contacto-aviso');
  const boton = document.getElementById('contacto-enviar');

  function mostrar(texto, tipo) {
    aviso.textContent = texto;
    aviso.className = 'contacto-aviso ' + tipo;
  }

  function validar() {
    const reglas = [
      [form.nombre_apellido, form.nombre_apellido.value.trim().length >= 3, 'Escribe tu nombre y apellido.'],
      [form.correo, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.value.trim()), 'Escribe un correo válido.'],
      [form.telefono, !form.telefono.value.trim() || /^[0-9+()\s-]{7,20}$/.test(form.telefono.value.trim()), 'El teléfono no es válido.'],
      [form.mensaje, form.mensaje.value.trim().length >= 10, 'Cuéntanos un poco más en el mensaje (mínimo 10 caracteres).']
    ];
    let primerError = null;
    reglas.forEach(function (r) {
      r[0].classList.toggle('invalido', !r[1]);
      r[0].setAttribute('aria-invalid', String(!r[1]));
      if (!r[1] && !primerError) primerError = r;
    });
    if (primerError) {
      mostrar(primerError[2], 'error');
      primerError[0].focus();
      return false;
    }
    return true;
  }

  form.addEventListener('input', function (e) {
    if (e.target.classList.contains('invalido')) e.target.classList.remove('invalido');
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validar()) return;

    boton.disabled = true;
    boton.textContent = 'Enviando...';
    mostrar('', '');

    try {
      const respuesta = await fetch(API + '/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_apellido: form.nombre_apellido.value.trim(),
          telefono: form.telefono.value.trim(),
          correo: form.correo.value.trim(),
          mensaje: form.mensaje.value.trim(),
          sitio_web: form.sitio_web.value
        })
      });
      const datos = await respuesta.json().catch(function () { return {}; });
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo enviar tu mensaje.');
      form.reset();
      mostrar('✓ ' + datos.mensaje, 'ok');
    } catch (err) {
      mostrar(err.message === 'Failed to fetch' ? 'No se pudo conectar. Revisa tu internet e inténtalo de nuevo.' : err.message, 'error');
    } finally {
      boton.disabled = false;
      boton.textContent = 'Enviar mensaje';
    }
  });
})();
