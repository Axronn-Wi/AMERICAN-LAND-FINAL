/* ============================================================
   comunicaciones.js — Notificaciones y chat de los portales
   Instituto American Land
   Ubicación: assets/js/comunicaciones.js

   Se incluye en las páginas de admin, alumnos y docentes (después
   del script propio de la página). Agrega a la barra superior:
     - Campana: avisos del sistema (tareas, notas, pagos...).
     - Burbuja: chat directo con docentes, estudiantes y administración.
   Revisa si hay novedades cada 30 s (solo con la pestaña visible).
   Todo el texto que viene de la base se pinta con textContent.
============================================================ */

(function () {
  'use strict';

  const token = sessionStorage.getItem('token');
  if (!token) return;

  const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

  const BASE = API + '/comunicaciones';
  const SONDEO_RESUMEN_MS = 30000;
  const SONDEO_CHAT_MS = 5000;

  const ICONOS_TIPO = {
    tarea: '📝', entrega: '📥', calificacion: '✅', nota: '⭐',
    material: '📚', matricula: '🎓', pago: '💳', salon: '🏫', anuncio: '📣',
    asistencia: '🗓️', contacto: '✉️', general: '🔔'
  };

  const SVG = {
    campana: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>',
    enviar: '<path d="M4 12 20 4l-6.5 16-2.5-6.5L4 12Z"/><path d="M11 13.5 20 4"/>'
  };

  // ── Utilidades ────────────────────────────────────────────
  function el(etiqueta, clase, texto) {
    const nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto !== undefined && texto !== null) nodo.textContent = texto;
    return nodo;
  }

  function icono(nombre) {
    // Contenido fijo del programa, no datos del usuario
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + SVG[nombre] + '</svg>';
  }

  async function api(ruta, opciones) {
    const op = opciones || {};
    const respuesta = await fetch(BASE + ruta, {
      method: op.method || 'GET',
      headers: Object.assign(
        { 'Authorization': 'Bearer ' + token },
        op.body ? { 'Content-Type': 'application/json' } : {}
      ),
      body: op.body ? JSON.stringify(op.body) : undefined
    });
    if (respuesta.status === 401) {
      sessionStorage.clear();
      window.location.href = '../auth/login.html';
      throw new Error('Sesión vencida');
    }
    const datos = await respuesta.json().catch(function () { return {}; });
    if (!respuesta.ok) throw new Error(datos.mensaje || 'Error de conexión');
    return datos;
  }

  const formatoRelativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  function haceCuanto(fecha) {
    const seg = Math.round((new Date(fecha).getTime() - Date.now()) / 1000);
    const abs = Math.abs(seg);
    if (abs < 45) return 'justo ahora';
    if (abs < 3600) return formatoRelativo.format(Math.round(seg / 60), 'minute');
    if (abs < 86400) return formatoRelativo.format(Math.round(seg / 3600), 'hour');
    if (abs < 604800) return formatoRelativo.format(Math.round(seg / 86400), 'day');
    return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  }

  function horaCorta(fecha) {
    return new Date(fecha).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  }

  function etiquetaDia(fecha) {
    const d = new Date(fecha);
    const hoy = new Date();
    const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function hoyOFecha(fecha) {
    if (!fecha) return '';
    const d = new Date(fecha);
    return d.toDateString() === new Date().toDateString()
      ? horaCorta(fecha)
      : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  }

  // "/alumnos/tareas.html" -> "../alumnos/tareas.html" (las páginas viven en una subcarpeta)
  function rutaRelativa(enlace) {
    if (!enlace || enlace.charAt(0) !== '/' || enlace.charAt(1) === '/') return null;
    return '..' + enlace;
  }

  function iniciales(nombre) {
    const partes = String(nombre || '?').trim().split(/\s+/);
    return ((partes[0] || '?').charAt(0) + (partes.length > 1 ? partes[partes.length - 1].charAt(0) : '')).toUpperCase();
  }

  // ── Avisos flotantes ──────────────────────────────────────
  const contToasts = el('div', 'com-toasts');
  contToasts.setAttribute('role', 'status');
  contToasts.setAttribute('aria-live', 'polite');
  document.body.appendChild(contToasts);

  function toast(texto, alHacerClic) {
    const t = el('div', 'com-toast', texto);
    const cerrar = function () {
      t.classList.add('com-saliendo');
      setTimeout(function () { t.remove(); }, 200);
    };
    t.addEventListener('click', function () { cerrar(); if (alHacerClic) alHacerClic(); });
    contToasts.appendChild(t);
    setTimeout(cerrar, 5000);
  }

  // ── Botones en la barra superior ──────────────────────────
  const acciones = document.querySelector('header .nav-acciones');
  if (!acciones) return;

  function crearBoton(nombreIcono, titulo) {
    const b = el('button', 'com-btn');
    b.type = 'button';
    b.title = titulo;
    b.setAttribute('aria-label', titulo);
    b.setAttribute('aria-expanded', 'false');
    b.innerHTML = icono(nombreIcono);
    const contador = el('span', 'com-contador');
    contador.hidden = true;
    b.appendChild(contador);
    return { boton: b, contador: contador };
  }

  const btnNotif = crearBoton('campana', 'Notificaciones');
  const btnChat = crearBoton('chat', 'Mensajes');
  const btnCerrar = acciones.querySelector('.btn-cerrar');
  acciones.insertBefore(btnNotif.boton, btnCerrar);
  acciones.insertBefore(btnChat.boton, btnCerrar);

  function pintarContador(contador, valor) {
    const anterior = Number(contador.dataset.valor || 0);
    contador.dataset.valor = valor;
    contador.hidden = valor <= 0;
    contador.textContent = valor > 99 ? '99+' : String(valor);
    if (valor > anterior) {
      contador.classList.remove('com-pulso');
      void contador.offsetWidth; // reinicia la animación
      contador.classList.add('com-pulso');
    }
  }

  // ══════════════════════════════════════════════════════════
  // NOTIFICACIONES
  // ══════════════════════════════════════════════════════════
  const panel = el('section', 'com-panel');
  panel.setAttribute('aria-label', 'Notificaciones');
  const cabPanel = el('div', 'com-panel-cabecera');
  cabPanel.appendChild(el('h2', null, 'Notificaciones'));
  const btnTodas = el('button', 'com-enlace-btn', 'Marcar todas como leídas');
  btnTodas.type = 'button';
  cabPanel.appendChild(btnTodas);
  const listaNotif = el('ul', 'com-lista');
  panel.appendChild(cabPanel);
  panel.appendChild(listaNotif);
  document.body.appendChild(panel);

  function vacio(contenedor, emoji, texto) {
    contenedor.textContent = '';
    const v = el('li', 'com-vacio');
    v.appendChild(el('span', 'com-vacio-icono', emoji));
    v.appendChild(document.createTextNode(texto));
    contenedor.appendChild(v);
  }

  function pintarNotificaciones(datos) {
    listaNotif.textContent = '';
    btnTodas.disabled = datos.no_leidas === 0;
    pintarContador(btnNotif.contador, datos.no_leidas);

    if (datos.notificaciones.length === 0) {
      vacio(listaNotif, '🔕', 'No tienes notificaciones por ahora.');
      return;
    }

    datos.notificaciones.forEach(function (n) {
      const li = el('li', 'com-notif' + (n.leida ? '' : ' com-no-leida'));
      li.tabIndex = 0;
      li.appendChild(el('span', 'com-notif-icono', ICONOS_TIPO[n.tipo] || ICONOS_TIPO.general));
      const cuerpo = el('div', 'com-notif-cuerpo');
      cuerpo.appendChild(el('p', 'com-notif-titulo', n.titulo));
      if (n.mensaje) cuerpo.appendChild(el('p', 'com-notif-texto', n.mensaje));
      cuerpo.appendChild(el('span', 'com-notif-tiempo', haceCuanto(n.creada_en)));
      li.appendChild(cuerpo);

      const borrar = el('button', 'com-notif-borrar', '✕');
      borrar.type = 'button';
      borrar.title = 'Eliminar notificación';
      borrar.setAttribute('aria-label', 'Eliminar notificación');
      borrar.addEventListener('click', function (e) {
        e.stopPropagation();
        api('/notificaciones/' + n.id, { method: 'DELETE' })
          .then(cargarNotificaciones)
          .catch(function (err) { toast(err.message); });
      });
      li.appendChild(borrar);

      const abrir = async function () {
        if (!n.leida) {
          await api('/notificaciones/' + n.id + '/leida', { method: 'PUT' }).catch(function () {});
        }
        const destino = rutaRelativa(n.enlace);
        if (destino) window.location.href = destino;
        else cargarNotificaciones();
      };
      li.addEventListener('click', abrir);
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
      });
      listaNotif.appendChild(li);
    });
  }

  async function cargarNotificaciones() {
    try {
      pintarNotificaciones(await api('/notificaciones?limite=30'));
    } catch (err) {
      vacio(listaNotif, '⚠️', err.message === 'Sesión vencida' ? '' : 'No se pudieron cargar las notificaciones.');
    }
  }

  function abrirPanel() {
    cerrarChat();
    panel.classList.add('com-abierto');
    btnNotif.boton.setAttribute('aria-expanded', 'true');
    vacio(listaNotif, '⏳', 'Cargando…');
    cargarNotificaciones();
  }

  function cerrarPanel() {
    panel.classList.remove('com-abierto');
    btnNotif.boton.setAttribute('aria-expanded', 'false');
  }

  btnNotif.boton.addEventListener('click', function (e) {
    e.stopPropagation();
    if (panel.classList.contains('com-abierto')) cerrarPanel();
    else abrirPanel();
  });

  btnTodas.addEventListener('click', function () {
    api('/notificaciones/leidas', { method: 'PUT' })
      .then(cargarNotificaciones)
      .catch(function (err) { toast(err.message); });
  });

  document.addEventListener('click', function (e) {
    if (panel.classList.contains('com-abierto') && !panel.contains(e.target)) cerrarPanel();
  });

  // ══════════════════════════════════════════════════════════
  // CHAT
  // ══════════════════════════════════════════════════════════
  const velo = el('div', 'com-velo');
  const chat = el('aside', 'com-chat');
  chat.setAttribute('aria-label', 'Mensajes');
  chat.setAttribute('role', 'dialog');

  const cabChat = el('div', 'com-chat-cabecera');
  const btnVolver = el('button', 'com-icono-btn', '←');
  btnVolver.type = 'button';
  btnVolver.title = 'Volver a los contactos';
  btnVolver.setAttribute('aria-label', 'Volver a los contactos');
  btnVolver.hidden = true;
  const tituloChat = el('div', 'com-chat-titulo');
  const h2Chat = el('h2', null, 'Mensajes');
  const subChat = el('span', 'com-sub', 'Tus conversaciones');
  tituloChat.appendChild(h2Chat);
  tituloChat.appendChild(subChat);
  const btnCerrarChat = el('button', 'com-icono-btn', '✕');
  btnCerrarChat.type = 'button';
  btnCerrarChat.title = 'Cerrar';
  btnCerrarChat.setAttribute('aria-label', 'Cerrar mensajes');
  cabChat.appendChild(btnVolver);
  cabChat.appendChild(tituloChat);
  cabChat.appendChild(btnCerrarChat);

  // Vista 1: contactos
  const vistaContactos = el('div', 'com-vista');
  const cajaBuscar = el('div', 'com-buscar');
  const inputBuscar = el('input');
  inputBuscar.type = 'search';
  inputBuscar.placeholder = 'Buscar por nombre…';
  inputBuscar.setAttribute('aria-label', 'Buscar contacto');
  cajaBuscar.appendChild(inputBuscar);
  const listaContactos = el('ul', 'com-lista');
  vistaContactos.appendChild(cajaBuscar);
  vistaContactos.appendChild(listaContactos);

  // Vista 2: conversación
  const vistaConversacion = el('div', 'com-vista');
  vistaConversacion.hidden = true;
  const cajaMensajes = el('div', 'com-mensajes');
  cajaMensajes.setAttribute('aria-live', 'polite');
  const formulario = el('form', 'com-redactar');
  const areaTexto = el('textarea');
  areaTexto.rows = 1;
  areaTexto.maxLength = 2000;
  areaTexto.placeholder = 'Escribe un mensaje…';
  areaTexto.setAttribute('aria-label', 'Mensaje');
  const btnEnviar = el('button', 'com-enviar');
  btnEnviar.type = 'submit';
  btnEnviar.title = 'Enviar';
  btnEnviar.setAttribute('aria-label', 'Enviar mensaje');
  btnEnviar.innerHTML = icono('enviar');
  btnEnviar.disabled = true;
  formulario.appendChild(areaTexto);
  formulario.appendChild(btnEnviar);
  vistaConversacion.appendChild(cajaMensajes);
  vistaConversacion.appendChild(formulario);

  chat.appendChild(cabChat);
  chat.appendChild(vistaContactos);
  chat.appendChild(vistaConversacion);
  document.body.appendChild(velo);
  document.body.appendChild(chat);

  let contactos = [];
  let conversacion = null;      // contacto abierto
  let ultimoId = 0;             // último mensaje pintado
  let ultimoDia = '';
  let temporizadorChat = null;

  const NOMBRES_ROL = { estudiante: 'Estudiante', docente: 'Docente', admin: 'Administración', secretaria: 'Secretaría' };

  function pintarContactos() {
    const filtro = inputBuscar.value.trim().toLowerCase();
    const visibles = contactos.filter(function (c) {
      return !filtro || c.nombre_completo.toLowerCase().indexOf(filtro) !== -1;
    });

    listaContactos.textContent = '';
    if (visibles.length === 0) {
      vacio(listaContactos, '💬', filtro
        ? 'Nadie coincide con tu búsqueda.'
        : 'Aún no tienes contactos. Aparecerán tus docentes, compañeros de salón o la administración.');
      return;
    }

    visibles.forEach(function (c) {
      const li = el('li');
      const b = el('button', 'com-contacto');
      b.type = 'button';
      b.appendChild(el('span', 'com-avatar com-rol-' + c.rol, iniciales(c.nombre_completo)));

      const info = el('span', 'com-contacto-info');
      const fila1 = el('span', 'com-contacto-fila');
      fila1.appendChild(el('span', 'com-contacto-nombre', c.nombre_completo));
      if (c.ultimo_en) fila1.appendChild(el('span', 'com-contacto-hora', hoyOFecha(c.ultimo_en)));
      const fila2 = el('span', 'com-contacto-fila');
      if (c.ultimo_mensaje) {
        fila2.appendChild(el('span', 'com-contacto-ultimo', (c.ultimo_es_mio ? 'Tú: ' : '') + c.ultimo_mensaje));
      } else {
        fila2.appendChild(el('span', 'com-contacto-rol', NOMBRES_ROL[c.rol] || c.rol));
      }
      if (c.no_leidos > 0) fila2.appendChild(el('span', 'com-chip', String(c.no_leidos)));
      info.appendChild(fila1);
      info.appendChild(fila2);
      b.appendChild(info);

      b.addEventListener('click', function () { abrirConversacion(c); });
      li.appendChild(b);
      listaContactos.appendChild(li);
    });
  }

  async function cargarContactos() {
    try {
      const datos = await api('/chat/contactos');
      contactos = datos.contactos;
      pintarContactos();
    } catch (err) {
      vacio(listaContactos, '⚠️', 'No se pudieron cargar los contactos.');
    }
  }

  function agregarBurbuja(m, clasesExtra) {
    const aviso = cajaMensajes.querySelector('.com-sin-mensajes');
    if (aviso) aviso.remove();
    const dia = etiquetaDia(m.enviado_en);
    if (dia !== ultimoDia) {
      cajaMensajes.appendChild(el('div', 'com-dia', dia));
      ultimoDia = dia;
    }
    const b = el('div', 'com-burbuja ' + (m.es_mio ? 'com-mia' : 'com-suya') + (clasesExtra ? ' ' + clasesExtra : ''));
    b.appendChild(document.createTextNode(m.contenido));
    const meta = el('span', 'com-meta', horaCorta(m.enviado_en) + (m.es_mio && m.leido_en ? ' · Visto' : ''));
    b.appendChild(meta);
    cajaMensajes.appendChild(b);
    return b;
  }

  function bajarAlFinal() {
    cajaMensajes.scrollTop = cajaMensajes.scrollHeight;
  }

  async function traerMensajes(inicial) {
    if (!conversacion) return;
    const idActual = conversacion.id;
    try {
      const datos = await api('/chat/' + idActual + '/mensajes' + (inicial ? '' : '?despues=' + ultimoId));
      if (!conversacion || conversacion.id !== idActual) return; // cambió de chat mientras cargaba
      if (inicial) {
        cajaMensajes.textContent = '';
        ultimoDia = '';
        if (datos.mensajes.length === 0) {
          cajaMensajes.appendChild(el('div', 'com-dia com-sin-mensajes', 'Escribe el primer mensaje a ' + conversacion.nombre_completo));
        }
      }
      const cercaDelFinal = cajaMensajes.scrollHeight - cajaMensajes.scrollTop - cajaMensajes.clientHeight < 80;
      datos.mensajes.forEach(function (m) {
        if (m.id > ultimoId) {
          agregarBurbuja(m);
          ultimoId = m.id;
        }
      });
      if (inicial || cercaDelFinal) bajarAlFinal();
      if (datos.mensajes.length > 0) actualizarResumen();
    } catch (err) {
      if (inicial) {
        cajaMensajes.textContent = '';
        cajaMensajes.appendChild(el('div', 'com-dia', err.message));
      }
    }
  }

  function abrirConversacion(contacto) {
    conversacion = contacto;
    ultimoId = 0;
    ultimoDia = '';
    h2Chat.textContent = contacto.nombre_completo;
    subChat.textContent = NOMBRES_ROL[contacto.rol] || contacto.rol;
    btnVolver.hidden = false;
    vistaContactos.hidden = true;
    vistaConversacion.hidden = false;
    cajaMensajes.textContent = '';
    cajaMensajes.appendChild(el('div', 'com-dia', 'Cargando…'));
    areaTexto.value = '';
    ajustarAltura();
    traerMensajes(true);
    clearInterval(temporizadorChat);
    temporizadorChat = setInterval(function () {
      if (!document.hidden) traerMensajes(false);
    }, SONDEO_CHAT_MS);
    setTimeout(function () { areaTexto.focus(); }, 260);
  }

  function volverAContactos() {
    conversacion = null;
    clearInterval(temporizadorChat);
    h2Chat.textContent = 'Mensajes';
    subChat.textContent = 'Tus conversaciones';
    btnVolver.hidden = true;
    vistaConversacion.hidden = true;
    vistaContactos.hidden = false;
    cargarContactos();
  }

  function abrirChat() {
    cerrarPanel();
    chat.classList.add('com-abierto');
    velo.classList.add('com-abierto');
    btnChat.boton.setAttribute('aria-expanded', 'true');
    if (!conversacion) {
      vacio(listaContactos, '⏳', 'Cargando…');
      cargarContactos();
      setTimeout(function () { inputBuscar.focus(); }, 260);
    }
  }

  function cerrarChat() {
    if (!chat.classList.contains('com-abierto')) return;
    chat.classList.remove('com-abierto');
    velo.classList.remove('com-abierto');
    btnChat.boton.setAttribute('aria-expanded', 'false');
    if (conversacion) volverAContactos();
    btnChat.boton.focus();
  }

  function ajustarAltura() {
    areaTexto.style.height = 'auto';
    areaTexto.style.height = Math.min(areaTexto.scrollHeight, 120) + 'px';
    btnEnviar.disabled = areaTexto.value.trim() === '';
  }

  btnChat.boton.addEventListener('click', function (e) {
    e.stopPropagation();
    if (chat.classList.contains('com-abierto')) cerrarChat();
    else abrirChat();
  });
  btnCerrarChat.addEventListener('click', cerrarChat);
  velo.addEventListener('click', cerrarChat);
  btnVolver.addEventListener('click', volverAContactos);
  inputBuscar.addEventListener('input', pintarContactos);
  areaTexto.addEventListener('input', ajustarAltura);

  // Enter envía; Shift+Enter hace salto de línea
  areaTexto.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      formulario.requestSubmit();
    }
  });

  formulario.addEventListener('submit', async function (e) {
    e.preventDefault();
    const texto = areaTexto.value.trim();
    if (!texto || !conversacion) return;

    areaTexto.value = '';
    ajustarAltura();
    const pendiente = agregarBurbuja({ contenido: texto, enviado_en: new Date().toISOString(), es_mio: true }, 'com-enviando');
    bajarAlFinal();

    try {
      const datos = await api('/chat/' + conversacion.id + '/mensajes', { method: 'POST', body: { contenido: texto } });
      pendiente.remove();
      if (datos.mensaje.id > ultimoId) {
        agregarBurbuja(datos.mensaje);
        ultimoId = datos.mensaje.id;
      }
      bajarAlFinal();
    } catch (err) {
      pendiente.classList.remove('com-enviando');
      pendiente.classList.add('com-fallido');
      pendiente.title = err.message;
      pendiente.querySelector('.com-meta').textContent = 'No enviado · ' + err.message;
    }
    areaTexto.focus();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (panel.classList.contains('com-abierto')) { cerrarPanel(); btnNotif.boton.focus(); }
    else if (chat.classList.contains('com-abierto')) cerrarChat();
  });

  // ══════════════════════════════════════════════════════════
  // SONDEO DE NOVEDADES
  // ══════════════════════════════════════════════════════════
  let primeraVez = true;

  async function actualizarResumen() {
    try {
      const r = await api('/resumen');
      const notifAntes = Number(btnNotif.contador.dataset.valor || 0);
      const msjAntes = Number(btnChat.contador.dataset.valor || 0);
      pintarContador(btnNotif.contador, r.notificaciones);
      pintarContador(btnChat.contador, r.mensajes);

      if (!primeraVez) {
        if (r.notificaciones > notifAntes) {
          toast('🔔 Tienes ' + (r.notificaciones - notifAntes === 1 ? 'una notificación nueva' : (r.notificaciones - notifAntes) + ' notificaciones nuevas'), abrirPanel);
        }
        if (r.mensajes > msjAntes && !conversacion) {
          toast('💬 Tienes mensajes nuevos', abrirChat);
          if (chat.classList.contains('com-abierto')) cargarContactos();
        }
      }
      primeraVez = false;
    } catch (_) { /* sin conexión: se reintenta en el siguiente ciclo */ }
  }

  actualizarResumen();
  setInterval(function () {
    if (!document.hidden) actualizarResumen();
  }, SONDEO_RESUMEN_MS);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) actualizarResumen();
  });

  // Para que otras páginas puedan abrir el chat (por ejemplo, desde una lista de estudiantes)
  window.ALComunicaciones = {
    abrirChat: abrirChat,
    abrirNotificaciones: abrirPanel
  };
})();
