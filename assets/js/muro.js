/* ============================================================
   muro.js — Muro de la comunidad (estilo Instagram)
   Instituto American Land
   Ubicación: assets/js/muro.js

   - Cualquier visitante ve las fotos, los "me gusta" y los comentarios.
   - Con sesión (estudiante, docente, secretaría o admin) se puede
     publicar, comentar y dar me gusta.
   - El autor, la secretaría y el admin pueden eliminar.
   Todo el texto de los usuarios se pinta con textContent.
============================================================ */

(function () {
  'use strict';

  const seccion = document.getElementById('muro');
  if (!seccion) return;

  const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

  const LADO_MAX = 1080;       // la foto se reduce en el navegador antes de subirla
  const POR_PAGINA = 12;
  const ROLES = { estudiante: 'Estudiante', docente: 'Docente', secretaria: 'Secretaría', admin: 'Administración' };
  const ICONO_CORAZON = 'M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z';
  const ICONO_BURBUJA = 'M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.5Z';

  const $ = function (id) { return document.getElementById(id); };
  const grid = $('muro-grid');
  const vacio = $('muro-vacio');
  const btnMas = $('muro-mas');

  let token = sessionStorage.getItem('token');
  const publicaciones = new Map();
  let ultimoId = null;
  let actual = null; // publicación abierta en el detalle

  // ── Utilidades ─────────────────────────────────────────
  function el(etiqueta, clase, texto) {
    const n = document.createElement(etiqueta);
    if (clase) n.className = clase;
    if (texto !== undefined && texto !== null) n.textContent = texto;
    return n;
  }

  function icono(ruta) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', ruta);
    svg.appendChild(p);
    return svg;
  }

  function iniciales(nombre) {
    const partes = String(nombre || '?').trim().split(/\s+/);
    return ((partes[0] || '?').charAt(0) + (partes.length > 1 ? partes[partes.length - 1].charAt(0) : '')).toUpperCase();
  }

  function avatar(autor, clase) {
    const a = el('span', 'muro-avatar' + (clase ? ' ' + clase : ''));
    if (autor.foto) {
      const img = el('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = autor.foto.indexOf('http') === 0 ? autor.foto : API + autor.foto;
      img.addEventListener('error', function () { a.textContent = iniciales(autor.nombre); });
      a.appendChild(img);
    } else {
      a.textContent = iniciales(autor.nombre);
    }
    return a;
  }

  function haceCuanto(fecha) {
    const s = Math.max(0, (Date.now() - new Date(fecha).getTime()) / 1000);
    if (s < 60) return 'justo ahora';
    if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'hace ' + Math.floor(s / 3600) + ' h';
    if (s < 604800) { const d = Math.floor(s / 86400); return 'hace ' + d + (d === 1 ? ' día' : ' días'); }
    return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function textoLikes(n) {
    if (n === 0) return 'Sé el primero en darle me gusta';
    return n === 1 ? '1 me gusta' : n.toLocaleString('es-CO') + ' me gusta';
  }

  let temporizadorToast = null;
  function aviso(mensaje) {
    let t = document.querySelector('.muro-toast');
    if (!t) { t = el('div', 'muro-toast'); t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = mensaje;
    t.classList.add('visible');
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(function () { t.classList.remove('visible'); }, 3200);
  }

  // Petición a la API; si la sesión ya no sirve se trata al usuario como visitante
  async function api(ruta, opciones) {
    opciones = opciones || {};
    const cabeceras = Object.assign({}, opciones.headers);
    if (token) cabeceras.Authorization = 'Bearer ' + token;
    const r = await fetch(API + ruta, Object.assign({}, opciones, { headers: cabeceras }));
    let datos = {};
    try { datos = await r.json(); } catch (_) { /* respuesta sin cuerpo */ }
    if (r.status === 401 && token) {
      token = null;
      pintarBarra(true);
    }
    if (!r.ok) {
      const error = new Error(datos.mensaje || 'No se pudo completar la acción.');
      error.status = r.status;
      throw error;
    }
    return datos;
  }

  function pedirSesion() {
    aviso('Inicia sesión para participar en el muro.');
  }

  // ── Barra superior ─────────────────────────────────────
  function pintarBarra(sesionVencida) {
    const barra = $('muro-barra');
    barra.textContent = '';
    if (token) {
      const nombre = sessionStorage.getItem('nombre') || '';
      const foto = sessionStorage.getItem('foto');
      barra.appendChild(avatar({ nombre: nombre, foto: foto || null }));
      const abrir = el('button', 'muro-abrir', '¿Qué quieres compartir hoy, ' + (nombre.split(' ')[0] || 'compañero') + '?');
      abrir.type = 'button';
      abrir.addEventListener('click', abrirNueva);
      const subir = el('button', 'j-btn j-btn-primario', '+ Subir foto');
      subir.type = 'button';
      subir.addEventListener('click', abrirNueva);
      barra.append(abrir, subir);
    } else {
      const p = el('p');
      if (sesionVencida) {
        p.textContent = 'Tu sesión expiró. Vuelve a ingresar para publicar y comentar.';
      } else {
        p.append(el('strong', null, '¿Eres parte de American Land? '), document.createTextNode('Inicia sesión para compartir fotos, comentar y dar me gusta.'));
      }
      const ir = el('a', 'j-btn j-btn-primario', 'Ingresar');
      ir.href = 'auth/login.html?volver=muro';
      barra.append(p, ir);
    }
  }

  // nav_sesion.js pide la foto del perfil una sola vez y avisa cuando llega
  document.addEventListener('sesion:foto', function (e) {
    if (token && e.detail) pintarBarra();
  });

  // ── Cuadrícula ─────────────────────────────────────────
  function esqueleto(n) {
    for (let i = 0; i < n; i++) {
      const s = el('div', 'muro-item cargando');
      s.setAttribute('aria-hidden', 'true');
      grid.appendChild(s);
    }
  }

  function quitarEsqueleto() {
    grid.querySelectorAll('.cargando').forEach(function (s) { s.remove(); });
  }

  function tarjeta(pub) {
    const b = el('button', 'muro-item');
    b.type = 'button';
    b.dataset.id = pub.id;
    b.setAttribute('aria-label', 'Publicación de ' + pub.autor.nombre + (pub.texto ? ': ' + pub.texto.slice(0, 80) : ''));
    const img = el('img');
    img.src = API + pub.imagen;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';

    const capa = el('span', 'muro-capa');
    const quien = el('span', 'muro-capa-autor');
    quien.append(avatar(pub.autor), el('span', null, pub.autor.nombre));
    const cont = el('span', 'muro-contadores');
    const l = el('span'); l.append(icono(ICONO_CORAZON), el('b', 'n-likes', String(pub.likes)));
    const c = el('span'); c.append(icono(ICONO_BURBUJA), el('b', 'n-comentarios', String(pub.comentarios)));
    cont.append(l, c);
    capa.append(quien, cont);

    b.append(img, capa);
    b.addEventListener('click', function () { abrirDetalle(pub.id); });
    return b;
  }

  function actualizarTarjeta(pub) {
    const b = grid.querySelector('.muro-item[data-id="' + pub.id + '"]');
    if (!b) return;
    b.querySelector('.n-likes').textContent = pub.likes;
    b.querySelector('.n-comentarios').textContent = pub.comentarios;
  }

  async function cargar(reiniciar) {
    if (reiniciar) {
      grid.textContent = '';
      publicaciones.clear();
      ultimoId = null;
    }
    btnMas.hidden = true;
    vacio.hidden = true;
    esqueleto(reiniciar ? 6 : 3);
    try {
      const q = '?limite=' + POR_PAGINA + (ultimoId ? '&antes=' + ultimoId : '');
      const datos = await api('/muro/publicaciones' + q);
      quitarEsqueleto();
      datos.publicaciones.forEach(function (pub) {
        publicaciones.set(pub.id, pub);
        grid.appendChild(tarjeta(pub));
        ultimoId = pub.id;
      });
      btnMas.hidden = !datos.hay_mas;
      if (publicaciones.size === 0) {
        vacio.textContent = token
          ? 'Aún no hay publicaciones. ¡Comparte la primera foto de la comunidad!'
          : 'Muy pronto verás aquí los mejores momentos de nuestra comunidad.';
        vacio.hidden = false;
      }
    } catch (err) {
      quitarEsqueleto();
      vacio.textContent = 'No pudimos cargar el muro en este momento. Intenta de nuevo más tarde.';
      vacio.hidden = false;
    }
  }

  btnMas.addEventListener('click', function () { cargar(false); });

  // ── Ventanas ───────────────────────────────────────────
  function abrirDialogo(d) {
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    document.documentElement.style.overflow = 'hidden';
  }
  function cerrarDialogo(d) {
    if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
  }
  document.querySelectorAll('.muro-modal').forEach(function (d) {
    d.addEventListener('close', function () { document.documentElement.style.overflow = ''; });
    d.querySelectorAll('[data-cerrar]').forEach(function (b) {
      b.addEventListener('click', function () { cerrarDialogo(d); });
    });
    // Clic fuera de la ventana la cierra
    d.addEventListener('click', function (e) { if (e.target === d) cerrarDialogo(d); });
  });

  // ── Detalle de la publicación ──────────────────────────
  const detalle = $('muro-detalle');
  const listaComentarios = $('detalle-comentarios');
  const btnLike = $('detalle-like');
  const formComentario = $('detalle-form');
  const inputComentario = $('detalle-input');
  const btnEnviar = $('detalle-enviar');

  function filaComentario(autor, texto, fecha, extra) {
    const fila = el('div', 'comentario' + (extra && extra.leyenda ? ' leyenda' : ''));
    const cuerpo = el('div', 'comentario-cuerpo');
    cuerpo.append(el('strong', null, autor.nombre), el('p', null, texto));
    const meta = el('small', null, haceCuanto(fecha));
    if (extra && extra.onBorrar) {
      const borrar = el('button', null, 'Eliminar');
      borrar.type = 'button';
      borrar.addEventListener('click', extra.onBorrar);
      meta.appendChild(borrar);
    }
    cuerpo.appendChild(meta);
    fila.append(avatar(autor, 'chico'), cuerpo);
    return fila;
  }

  function pintarAutor(pub) {
    const cab = $('detalle-autor');
    cab.textContent = '';
    const datos = el('div');
    datos.append(el('strong', null, pub.autor.nombre), el('span', 'muro-rol', ROLES[pub.autor.rol] || 'Comunidad'));
    cab.append(avatar(pub.autor), datos);
  }

  function pintarLikes(pub) {
    btnLike.setAttribute('aria-pressed', String(!!pub.me_gusta));
    btnLike.setAttribute('aria-label', pub.me_gusta ? 'Quitar me gusta' : 'Me gusta');
    $('detalle-likes').textContent = textoLikes(pub.likes);
  }

  function pintarComentarios(pub, comentarios) {
    listaComentarios.textContent = '';
    if (pub.texto) listaComentarios.appendChild(filaComentario(pub.autor, pub.texto, pub.creada_en, { leyenda: true }));
    if (comentarios.length === 0) {
      listaComentarios.appendChild(el('p', 'sin-comentarios', 'Todavía no hay comentarios.'));
      return;
    }
    comentarios.forEach(function (c) {
      listaComentarios.appendChild(filaComentario(c.autor, c.texto, c.creado_en, {
        onBorrar: c.puede_borrar ? function () { borrarComentario(pub, c.id); } : null
      }));
    });
  }

  async function cargarComentarios(pub) {
    try {
      const datos = await api('/muro/publicaciones/' + pub.id + '/comentarios');
      if (actual !== pub) return;
      pintarComentarios(pub, datos.comentarios);
      pub.comentarios = datos.comentarios.length;
      actualizarTarjeta(pub);
    } catch (err) {
      if (err.status === 404) return publicacionDesaparecida(pub);
      listaComentarios.textContent = '';
      listaComentarios.appendChild(el('p', 'sin-comentarios', 'No se pudieron cargar los comentarios.'));
    }
  }

  function abrirDetalle(id) {
    const pub = publicaciones.get(id);
    if (!pub) return;
    actual = pub;
    const img = $('detalle-img');
    img.src = API + pub.imagen;
    img.alt = pub.texto ? pub.texto.slice(0, 120) : 'Foto de ' + pub.autor.nombre;
    pintarAutor(pub);
    pintarLikes(pub);
    const fecha = $('detalle-fecha');
    fecha.textContent = haceCuanto(pub.creada_en);
    fecha.dateTime = pub.creada_en;
    $('detalle-borrar').hidden = !pub.puede_borrar;
    formComentario.hidden = !token;
    $('detalle-invitar').hidden = !!token;
    inputComentario.value = '';
    btnEnviar.disabled = true;
    listaComentarios.textContent = '';
    listaComentarios.appendChild(el('p', 'sin-comentarios', 'Cargando comentarios…'));
    abrirDialogo(detalle);
    cargarComentarios(pub);
  }

  function publicacionDesaparecida(pub) {
    cerrarDialogo(detalle);
    publicaciones.delete(pub.id);
    const b = grid.querySelector('.muro-item[data-id="' + pub.id + '"]');
    if (b) b.remove();
    aviso('Esta publicación ya fue eliminada.');
  }

  // Me gusta
  let enviandoLike = false;
  async function alternarLike(soloDar) {
    const pub = actual;
    if (!pub) return;
    if (!token) return pedirSesion();
    if (enviandoLike || (soloDar && pub.me_gusta)) return;
    enviandoLike = true;
    // Se refleja de inmediato y se corrige con la respuesta del servidor
    pub.me_gusta = !pub.me_gusta;
    pub.likes += pub.me_gusta ? 1 : -1;
    pintarLikes(pub); actualizarTarjeta(pub);
    try {
      const datos = await api('/muro/publicaciones/' + pub.id + '/me-gusta', { method: 'POST' });
      pub.me_gusta = datos.me_gusta;
      pub.likes = datos.likes;
    } catch (err) {
      pub.me_gusta = !pub.me_gusta;
      pub.likes += pub.me_gusta ? 1 : -1;
      if (err.status === 404) publicacionDesaparecida(pub); else aviso(err.message);
    } finally {
      enviandoLike = false;
      if (actual === pub) pintarLikes(pub);
      actualizarTarjeta(pub);
    }
  }
  btnLike.addEventListener('click', function () { alternarLike(false); });

  // Doble clic (o doble toque) sobre la foto: me gusta, como en Instagram
  const corazon = detalle.querySelector('.corazon-pop');
  $('detalle-foto').addEventListener('dblclick', function () {
    if (!token) return pedirSesion();
    corazon.classList.remove('activo');
    void corazon.offsetWidth; // reinicia la animación
    corazon.classList.add('activo');
    alternarLike(true);
  });

  $('detalle-ir-comentar').addEventListener('click', function () {
    if (!token) return pedirSesion();
    inputComentario.focus();
  });

  // Comentar
  inputComentario.addEventListener('input', function () {
    btnEnviar.disabled = inputComentario.value.trim() === '';
  });
  formComentario.addEventListener('submit', async function (e) {
    e.preventDefault();
    const pub = actual;
    const texto = inputComentario.value.trim();
    if (!pub || !texto) return;
    btnEnviar.disabled = true;
    inputComentario.disabled = true;
    try {
      await api('/muro/publicaciones/' + pub.id + '/comentarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: texto })
      });
      inputComentario.value = '';
      await cargarComentarios(pub);
      listaComentarios.scrollTop = listaComentarios.scrollHeight;
    } catch (err) {
      if (err.status === 404) publicacionDesaparecida(pub); else aviso(err.message);
      btnEnviar.disabled = false;
    } finally {
      inputComentario.disabled = false;
      if (token) inputComentario.focus();
      else { formComentario.hidden = true; $('detalle-invitar').hidden = false; }
    }
  });

  async function borrarComentario(pub, idComentario) {
    if (!window.confirm('¿Eliminar este comentario?')) return;
    try {
      await api('/muro/comentarios/' + idComentario, { method: 'DELETE' });
      await cargarComentarios(pub);
    } catch (err) {
      aviso(err.message);
    }
  }

  $('detalle-borrar').addEventListener('click', async function () {
    const pub = actual;
    if (!pub || !window.confirm('¿Eliminar esta publicación? Se borrarán también sus comentarios.')) return;
    try {
      await api('/muro/publicaciones/' + pub.id, { method: 'DELETE' });
      cerrarDialogo(detalle);
      publicaciones.delete(pub.id);
      const b = grid.querySelector('.muro-item[data-id="' + pub.id + '"]');
      if (b) b.remove();
      if (publicaciones.size === 0) cargar(true);
      aviso('Publicación eliminada.');
    } catch (err) {
      aviso(err.message);
    }
  });

  // ── Nueva publicación ──────────────────────────────────
  const nueva = $('muro-nueva');
  const formNueva = $('form-nueva');
  const zona = $('nueva-zona');
  const archivo = $('nueva-archivo');
  const vista = $('nueva-vista');
  const descripcion = $('nueva-descripcion');
  const contador = $('nueva-contador');
  const avisoNueva = $('nueva-aviso');
  const btnCompartir = $('nueva-compartir');
  let fotoLista = null; // Blob ya reducido
  let urlVista = null;

  function mensajeNueva(texto, esError) {
    avisoNueva.textContent = texto || '';
    avisoNueva.classList.toggle('error', !!esError);
  }

  function reiniciarNueva() {
    formNueva.reset();
    fotoLista = null;
    if (urlVista) URL.revokeObjectURL(urlVista);
    urlVista = null;
    vista.hidden = true;
    vista.removeAttribute('src');
    $('nueva-indicacion').hidden = false;
    zona.classList.remove('con-foto');
    contador.textContent = '0 / 2200';
    btnCompartir.disabled = true;
    btnCompartir.textContent = 'Compartir';
    mensajeNueva('');
  }

  function abrirNueva() {
    if (!token) return pedirSesion();
    reiniciarNueva();
    abrirDialogo(nueva);
  }

  // Reduce la foto a máximo 1080 px y la convierte a JPEG
  function reducirFoto(file) {
    return new Promise(function (resolver, rechazar) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        const escala = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(img.naturalWidth * escala);
        lienzo.height = Math.round(img.naturalHeight * escala);
        const ctx = lienzo.getContext('2d');
        ctx.fillStyle = '#fff'; // fondo para PNG transparentes
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
        ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
        URL.revokeObjectURL(url);
        lienzo.toBlob(function (blob) {
          if (blob) resolver(blob); else rechazar(new Error('No se pudo procesar la foto.'));
        }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rechazar(new Error('El archivo no es una imagen válida.')); };
      img.src = url;
    });
  }

  async function elegirFoto(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      return mensajeNueva('Formato no permitido. Usa una imagen JPG, PNG o WEBP.', true);
    }
    if (file.size > 20 * 1024 * 1024) return mensajeNueva('La foto es demasiado pesada (máximo 20 MB).', true);
    mensajeNueva('Preparando la foto…');
    try {
      fotoLista = await reducirFoto(file);
      if (urlVista) URL.revokeObjectURL(urlVista);
      urlVista = URL.createObjectURL(fotoLista);
      vista.src = urlVista;
      vista.hidden = false;
      $('nueva-indicacion').hidden = true;
      zona.classList.add('con-foto');
      btnCompartir.disabled = false;
      mensajeNueva('');
      descripcion.focus();
    } catch (err) {
      fotoLista = null;
      btnCompartir.disabled = true;
      mensajeNueva(err.message, true);
    }
  }

  archivo.addEventListener('change', function () { elegirFoto(archivo.files[0]); });
  ['dragenter', 'dragover'].forEach(function (ev) {
    zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.add('arrastrando'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    zona.addEventListener(ev, function () { zona.classList.remove('arrastrando'); });
  });
  zona.addEventListener('drop', function (e) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files[0]) elegirFoto(e.dataTransfer.files[0]);
  });

  descripcion.addEventListener('input', function () {
    contador.textContent = descripcion.value.length + ' / 2200';
  });

  formNueva.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!fotoLista) return mensajeNueva('Agrega una foto para publicar.', true);
    const datos = new FormData();
    datos.append('imagen', fotoLista, 'foto.jpg');
    datos.append('texto', descripcion.value.trim());
    btnCompartir.disabled = true;
    btnCompartir.textContent = 'Compartiendo…';
    mensajeNueva('');
    try {
      await api('/muro/publicaciones', { method: 'POST', body: datos });
      cerrarDialogo(nueva);
      reiniciarNueva();
      aviso('¡Tu foto ya está en el muro!');
      await cargar(true);
      seccion.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      btnCompartir.disabled = false;
      btnCompartir.textContent = 'Compartir';
      mensajeNueva(err.message, true);
      if (!token) { cerrarDialogo(nueva); aviso('Tu sesión expiró. Vuelve a ingresar para publicar.'); }
    }
  });

  // ── Inicio ─────────────────────────────────────────────
  pintarBarra();
  cargar(true);
})();
