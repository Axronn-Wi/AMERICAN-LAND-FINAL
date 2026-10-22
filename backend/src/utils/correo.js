const nodemailer = require('nodemailer');

// ---------------------------------------------------------------
// Envío de correos. Se usa el primero que esté configurado:
//   1. BREVO_API_KEY -> API HTTP de Brevo. Es la opción para Render gratis,
//      que bloquea los puertos SMTP (25, 465 y 587) desde septiembre de 2025.
//   2. SMTP_HOST     -> servidor SMTP (sirve en local o en un plan pago).
//   3. Ninguno       -> en desarrollo el correo se muestra en la consola;
//                       en producción (NODE_ENV=production) es un error.
// ---------------------------------------------------------------

// "Instituto American Land <correo@x.com>" -> { name, email }
function remitente() {
  const texto = process.env.CORREO_REMITENTE || process.env.SMTP_USER || '';
  const m = texto.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || 'Instituto American Land', email: m[2].trim() };
  return { name: 'Instituto American Land', email: texto.trim() };
}

async function enviarConBrevo({ para, asunto, texto, html }) {
  const de = remitente();
  if (!de.email) throw new Error('Falta CORREO_REMITENTE para enviar con Brevo.');
  const url = process.env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email';
  const respuesta = await fetch(url, {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: de,
      to: [{ email: para }],
      subject: asunto,
      textContent: texto,
      htmlContent: html || `<pre>${texto}</pre>`
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(`Brevo respondió ${respuesta.status}: ${detalle.slice(0, 200)}`);
  }
}

// Transporte SMTP armado con las variables del .env (se crea una sola vez)
let transporte = null;

function obtenerTransporte() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporte) {
    const puerto = Number(process.env.SMTP_PORT) || 587;
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: puerto,
      // true para el puerto 465 (SSL); con 587 se usa STARTTLS
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : puerto === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
    });
  }
  return transporte;
}

async function enviarCorreo({ para, asunto, texto, html }) {
  if (process.env.BREVO_API_KEY) {
    return enviarConBrevo({ para, asunto, texto, html });
  }

  const t = obtenerTransporte();
  if (!t) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Falta configurar BREVO_API_KEY (o SMTP_HOST) para enviar correos.');
    }
    console.log(`📧 [Correo sin configurar: solo se muestra aquí] Para: ${para}\nAsunto: ${asunto}\n${texto}`);
    return;
  }
  await t.sendMail({
    from: process.env.CORREO_REMITENTE || process.env.SMTP_USER,
    to: para,
    subject: asunto,
    text: texto,
    html
  });
}

module.exports = { enviarCorreo };
