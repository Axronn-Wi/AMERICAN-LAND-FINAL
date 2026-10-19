/* ============================================================
   perfil.js — Página "Mi perfil"
   Instituto American Land
   Ubicación: assets/js/perfil.js

   Usada por admin/perfil.html (admin y secretaría),
   docentes/perfil.html y alumnos/perfil.html.
   Todo el texto que viene de la base se pinta con textContent.
============================================================ */

(function () {
  'use strict';

  const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

  // ── Sesión ───────────────────────────────────────────────
  const token = sessionStorage.getItem('token');
  const rol = sessionStorage.getItem('rol');
  const permitidos = (document.body.dataset.roles || '').split(',');
  if (!token || permitidos.indexOf(rol) === -1) {
    sessionStorage.clear();
    window.location.href = '../auth/login.html';
    return;
  }

  const NOMBRE_ROL = { admin: 'Administrador', secretaria: 'Secretaría', docente: 'Docente', estudiante: 'Estudiante' };

  const ICONOS = {
    camara: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/>',
    lapiz: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    ubicacion: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
    calendario: '<rect x="4" y="4.5" width="16" height="16" rx="2.5"/><path d="M8 3v3M16 3v3M4 9.5h16"/>',
    telefono: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    globo: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.5 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.5-3.5-8.5s1-5.9 3.5-8.5Z"/>',
    pastel: '<path d="M4 20h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7Z"/><path d="M4 15c2 1.5 4 1.5 6 0s4-1.5 6 0 2.7 1 4 0M12 11V7M12 4.5v.5"/>',
    birrete: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5Z"/><path d="M6.5 11.2v4.3c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-4.3"/>',
    salon: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    alumnos: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
    tareas: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 13l2.2 2.2L15.5 11"/>',
    estrella: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z"/>',
    asistencia: '<rect x="4" y="4.5" width="16" height="16" rx="2.5"/><path d="M8 3v3M16 3v3M4 9.5h16M8.5 14.5l2.2 2.2 4.8-4.7"/>',
    maletin: '<rect x="3.5" y="7" width="17" height="12.5" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>',
    sede: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>',
    id: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.4-1.6 1.6-2.5 3-2.5s2.6.9 3 2.5M14.5 10h4M14.5 13.5h3"/>'
  };
  function svg(nombre) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONOS[nombre] + '</svg>'; }

  const $ = function (id) { return document.getElementById(id); };
  function crear(tag, clase, texto) {
    const el = document.createElement(tag);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  }

  async function api(ruta, opciones) {
    const op = opciones || {};
    const headers = { 'Authorization': 'Bearer ' + token };
    let cuerpo = op.body;
    if (cuerpo && !(cuerpo instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      cuerpo = JSON.stringify(cuerpo);
    }
    const r = await fetch(API + ruta, { method: op.method || 'GET', headers: headers, body: cuerpo });
    if (r.status === 401) {
      sessionStorage.clear();
      window.location.href = '../auth/login.html';
      throw new Error('Sesión vencida');
    }
    const datos = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(datos.mensaje || 'No se pudo completar la acción.');
    return datos;
  }

  let temporizadorToast = null;
  function aviso(texto, tipo) {
    const t = $('pf-toast');
    t.textContent = texto;
    t.className = 'pf-toast visible' + (tipo === 'error' ? ' error' : '');
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(function () { t.className = 'pf-toast'; }, 3200);
  }

  function iniciales(nombre) {
    const p = String(nombre || '?').trim().split(/\s+/);
    return ((p[0] || '?').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
  }

  function fechaLarga(valor, conAnio) {
    if (!valor) return '';
    const d = new Date(String(valor).slice(0, 10) + 'T12:00:00Z');
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: conAnio === false ? undefined : 'numeric', timeZone: 'UTC' });
  }

  function urlFoto(foto) {
    return foto ? API + foto.url + '?v=' + encodeURIComponent(foto.version) : null;
  }

  // Barra superior: nombre y foto (también lo usa portal_lateral.js en las demás páginas)
  function actualizarBarra(perfil) {
    const nombre = $('nav-nombre');
    if (nombre) nombre.textContent = perfil.nombre_completo;
    sessionStorage.setItem('nombre', perfil.nombre_completo);
    const url = urlFoto(perfil.foto);
    sessionStorage.setItem('foto', url || '');
    const avatar = $('nav-avatar');
    if (avatar) {
      avatar.textContent = url ? '' : perfil.nombre_completo.charAt(0).toUpperCase();
      avatar.style.backgroundImage = url ? 'url("' + url + '")' : '';
      avatar.classList.toggle('con-foto', !!url);
    }
  }

  let perfil = null;

  // ── Pintar ───────────────────────────────────────────────
  function pintar() {
    document.title = 'Mi perfil - ' + perfil.nombre_completo + ' - Instituto American Land';

    // Avatar grande
    const caja = $('pf-avatar-in');
    caja.textContent = '';
    const url = urlFoto(perfil.foto);
    if (url) {
      const img = crear('img');
      img.src = url;
      img.alt = 'Foto de ' + perfil.nombre_completo;
      caja.appendChild(img);
    } else {
      caja.textContent = iniciales(perfil.nombre_completo);
    }
    $('pf-quitar-foto').hidden = !url;

    // Identidad
    $('pf-nombre').textContent = perfil.nombre_completo;
    const titular = $('pf-titular');
    titular.textContent = perfil.titular || 'Agrega un titular que te presente en una línea';
    titular.classList.toggle('vacio', !perfil.titular);

    const meta = $('pf-meta');
    meta.textContent = '';
    const chipRol = crear('span', 'pf-chip rol', NOMBRE_ROL[perfil.rol] || perfil.rol);
    meta.appendChild(chipRol);
    const lugar = [perfil.ciudad, perfil.pais].filter(Boolean).join(', ');
    if (lugar) {
      const c = crear('span', 'pf-chip');
      c.innerHTML = svg('ubicacion');
      c.appendChild(document.createTextNode(lugar));
      meta.appendChild(c);
    }
    const desde = crear('span', 'pf-chip dorado');
    desde.innerHTML = svg('calendario');
    desde.appendChild(document.createTextNode('Desde ' + fechaLarga(perfil.miembro_desde)));
    meta.appendChild(desde);

    pintarStats();

    // Sobre mí
    const sobre = $('pf-sobre');
    sobre.textContent = perfil.descripcion || 'Aún no has escrito nada sobre ti. Cuéntale a la comunidad quién eres, qué te gusta y qué te motiva a aprender o enseñar inglés.';
    sobre.classList.toggle('vacio', !perfil.descripcion);

    // Datos
    const datos = $('pf-datos');
    datos.textContent = '';
    const filas = [
      ['telefono', 'Teléfono', perfil.telefono],
      ['ubicacion', 'Ciudad', perfil.ciudad],
      ['globo', 'País', perfil.pais],
      ['pastel', 'Cumpleaños', perfil.fecha_nacimiento ? fechaLarga(perfil.fecha_nacimiento, false) : null]
    ];
    if (perfil.rol === 'docente') filas.push(['birrete', 'Especialidad', perfil.extra.especialidad]);
    if (perfil.rol === 'secretaria' || perfil.rol === 'admin') {
      filas.push(['maletin', 'Cargo', perfil.extra.cargo]);
      filas.push(['sede', 'Sede', perfil.extra.sede]);
    }
    filas.forEach(function (f) {
      const d = crear('div', 'pf-dato');
      const ic = crear('span', 'pf-dato-ic');
      ic.innerHTML = svg(f[0]);
      d.appendChild(ic);
      const t = crear('div');
      t.appendChild(crear('small', null, f[1]));
      t.appendChild(crear('span', f[2] ? null : 'vacio', f[2] || 'Sin completar'));
      d.appendChild(t);
      datos.appendChild(d);
    });

    // Cuenta
    const cuenta = $('pf-cuenta');
    cuenta.textContent = '';
    const filasCuenta = [['Correo', perfil.correo], ['Rol', NOMBRE_ROL[perfil.rol] || perfil.rol], ['Miembro desde', fechaLarga(perfil.miembro_desde)]];
    if (perfil.rol === 'estudiante' && perfil.extra.codigo_estudiante) filasCuenta.push(['Código', perfil.extra.codigo_estudiante]);
    if (perfil.rol === 'docente' && perfil.extra.fecha_ingreso) filasCuenta.push(['Ingreso como docente', fechaLarga(perfil.extra.fecha_ingreso)]);
    filasCuenta.forEach(function (f) {
      const li = crear('li');
      li.appendChild(crear('small', null, f[0]));
      li.appendChild(crear('span', null, f[1]));
      cuenta.appendChild(li);
    });

    pintarProgreso();
    actualizarBarra(perfil);
  }

  function pintarStats() {
    const cont = $('pf-stats');
    cont.textContent = '';
    const e = perfil.extra || {};
    let stats = [];
    if (perfil.rol === 'docente') {
      stats = [
        ['salon', '#7E22CE', 'Salones', e.salones || 0],
        ['alumnos', '#C026D3', 'Alumnos activos', e.alumnos || 0],
        ['tareas', '#E11D48', 'Tareas creadas', e.tareas || 0],
        ['birrete', '#CA8A04', 'Especialidad', e.especialidad || '—']
      ];
    } else if (perfil.rol === 'estudiante') {
      stats = [
        ['birrete', '#7E22CE', 'Nivel', e.nivel || '—'],
        ['estrella', '#CA8A04', 'Promedio', e.promedio !== null && e.promedio !== undefined ? e.promedio.toFixed(1) : '—'],
        ['asistencia', '#16A34A', 'Asistencia', e.asistencia !== null && e.asistencia !== undefined ? e.asistencia + '%' : '—'],
        ['tareas', '#E11D48', 'Tareas entregadas', e.entregas || 0]
      ];
    } else {
      stats = [
        ['maletin', '#7E22CE', 'Cargo', e.cargo || '—'],
        ['sede', '#C026D3', 'Sede', e.sede || '—'],
        ['id', '#E11D48', 'Rol', NOMBRE_ROL[perfil.rol]],
        ['calendario', '#CA8A04', 'En el equipo desde', new Date(perfil.miembro_desde).getFullYear()]
      ];
    }
    stats.forEach(function (s) {
      const card = crear('article', 'pf-stat');
      card.style.setProperty('--c', s[1]);
      const ic = crear('span', 'pf-stat-ic');
      ic.innerHTML = svg(s[0]);
      card.appendChild(ic);
      const t = crear('div');
      t.appendChild(crear('small', null, s[2]));
      // Los textos largos (especialidad, cargo...) van más pequeños que las cifras
      t.appendChild(crear('b', String(s[3]).length > 10 ? 'largo' : null, String(s[3])));
      card.appendChild(t);
      cont.appendChild(card);
    });
  }

  function pintarProgreso() {
    const items = [
      ['Foto de perfil', !!perfil.foto],
      ['Titular', !!perfil.titular],
      ['Sobre mí', !!perfil.descripcion],
      ['Teléfono', !!perfil.telefono],
      ['Ciudad y país', !!(perfil.ciudad && perfil.pais)],
      ['Fecha de nacimiento', !!perfil.fecha_nacimiento]
    ];
    if (perfil.rol === 'docente') items.push(['Especialidad', !!perfil.extra.especialidad]);
    const hechos = items.filter(function (i) { return i[1]; }).length;
    const pct = Math.round((hechos / items.length) * 100);
    $('pf-anillo').style.setProperty('--v', pct);
    $('pf-pct').textContent = pct + '%';
    $('pf-progreso-texto').textContent = pct === 100
      ? '¡Tu perfil está completo! Así tus docentes, compañeros y la administración te conocen mejor.'
      : 'Completa tu perfil para que la comunidad del instituto te conozca mejor.';
    const lista = $('pf-pendientes');
    lista.textContent = '';
    items.forEach(function (i) { lista.appendChild(crear('li', i[1] ? 'hecho' : null, i[0])); });
  }

  // ── Edición ─────────────────────────────────────────────
  const raiz = $('pf');
  const form = $('pf-form-datos');

  function llenarFormulario() {
    form.titular.value = perfil.titular || '';
    form.descripcion.value = perfil.descripcion || '';
    form.telefono.value = perfil.telefono || '';
    form.ciudad.value = perfil.ciudad || '';
    form.pais.value = perfil.pais || '';
    form.fecha_nacimiento.value = perfil.fecha_nacimiento ? String(perfil.fecha_nacimiento).slice(0, 10) : '';
    form.fecha_nacimiento.max = new Date().toISOString().slice(0, 10);
    if (form.especialidad) form.especialidad.value = perfil.extra.especialidad || '';
    actualizarContadores();
  }

  function actualizarContadores() {
    document.querySelectorAll('[data-contador]').forEach(function (el) {
      const campo = form[el.dataset.contador];
      el.textContent = campo.value.length + '/' + campo.maxLength;
    });
  }

  function editar(activo) {
    if (activo) llenarFormulario();
    raiz.classList.toggle('editando', activo);
    $('pf-editar').hidden = activo;
    if (activo) setTimeout(function () { form.titular.focus(); }, 50);
  }

  $('pf-editar').addEventListener('click', function () { editar(true); });
  $('pf-cancelar').addEventListener('click', function () { editar(false); });
  form.addEventListener('input', actualizarContadores);

  $('pf-guardar').addEventListener('click', async function () {
    const boton = this;
    const datos = {
      titular: form.titular.value,
      descripcion: form.descripcion.value,
      telefono: form.telefono.value,
      ciudad: form.ciudad.value,
      pais: form.pais.value,
      fecha_nacimiento: form.fecha_nacimiento.value || null
    };
    if (form.especialidad) datos.especialidad = form.especialidad.value;
    if (datos.telefono.trim() && !/^[0-9+()\s-]{7,20}$/.test(datos.telefono.trim())) {
      aviso('El teléfono no es válido.', 'error');
      form.telefono.focus();
      return;
    }
    boton.disabled = true;
    try {
      await api('/perfil', { method: 'PUT', body: datos });
      await cargar();
      editar(false);
      aviso('✓ Perfil actualizado');
    } catch (err) {
      aviso(err.message, 'error');
    } finally {
      boton.disabled = false;
    }
  });

  // ── Foto: se recorta cuadrada y se reduce a 512 px en el navegador ──
  function prepararFoto(archivo) {
    return new Promise(function (resolver, rechazar) {
      if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) {
        rechazar(new Error('Usa una imagen JPG, PNG o WEBP.'));
        return;
      }
      if (archivo.size > 15 * 1024 * 1024) {
        rechazar(new Error('La imagen es demasiado grande (máximo 15 MB).'));
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(archivo);
      img.onload = function () {
        const lado = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - lado) / 2;
        const sy = (img.naturalHeight - lado) / 2;
        const tam = Math.min(512, lado);
        const lienzo = document.createElement('canvas');
        lienzo.width = tam;
        lienzo.height = tam;
        const ctx = lienzo.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, lado, lado, 0, 0, tam, tam);
        URL.revokeObjectURL(url);
        lienzo.toBlob(function (blob) {
          if (blob) resolver(blob); else rechazar(new Error('No se pudo procesar la imagen.'));
        }, 'image/jpeg', 0.88);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rechazar(new Error('No se pudo leer la imagen.')); };
      img.src = url;
    });
  }

  $('pf-foto').addEventListener('change', async function () {
    const archivo = this.files && this.files[0];
    this.value = '';
    if (!archivo) return;
    const avatar = $('pf-avatar');
    avatar.classList.add('cargando');
    try {
      const blob = await prepararFoto(archivo);
      const datos = new FormData();
      datos.append('foto', blob, 'perfil.jpg');
      const r = await api('/perfil/foto', { method: 'POST', body: datos });
      perfil.foto = r.foto;
      pintar();
      aviso('✓ Foto actualizada');
    } catch (err) {
      aviso(err.message, 'error');
    } finally {
      avatar.classList.remove('cargando');
    }
  });

  $('pf-quitar-foto').addEventListener('click', async function () {
    if (!window.confirm('¿Quitar tu foto de perfil?')) return;
    try {
      await api('/perfil/foto', { method: 'DELETE' });
      perfil.foto = null;
      pintar();
      aviso('Foto eliminada');
    } catch (err) {
      aviso(err.message, 'error');
    }
  });

  // ── Contraseña ──────────────────────────────────────────
  $('pf-form-clave').addEventListener('submit', async function (e) {
    e.preventDefault();
    const f = this;
    const msg = $('pf-clave-msg');
    msg.className = 'pf-mensaje';
    if (f.nueva.value.length < 6) { msg.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.'; msg.classList.add('error'); return; }
    if (f.nueva.value !== f.confirmar.value) { msg.textContent = 'Las contraseñas nuevas no coinciden.'; msg.classList.add('error'); return; }
    const boton = f.querySelector('button[type=submit]');
    boton.disabled = true;
    try {
      const r = await api('/perfil/contrasena', { method: 'PUT', body: { actual: f.actual.value, nueva: f.nueva.value } });
      f.reset();
      msg.textContent = '✓ ' + r.mensaje;
      msg.classList.add('ok');
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add('error');
    } finally {
      boton.disabled = false;
    }
  });

  // ── Cerrar sesión ───────────────────────────────────────
  const cerrar = document.querySelector('.btn-cerrar');
  if (cerrar) cerrar.addEventListener('click', function (e) {
    e.preventDefault();
    sessionStorage.clear();
    window.location.href = '../auth/login.html';
  });

  // ── Inicio ──────────────────────────────────────────────
  async function cargar() {
    const datos = await api('/perfil');
    perfil = datos.perfil;
    pintar();
  }

  $('pf-nombre').textContent = sessionStorage.getItem('nombre') || 'Mi perfil';
  cargar().catch(function (err) { aviso(err.message, 'error'); });
})();
