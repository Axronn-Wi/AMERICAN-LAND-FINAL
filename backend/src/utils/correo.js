const nodemailer = require('nodemailer');

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

// Envía un correo. Sin SMTP configurado, en desarrollo lo muestra en la consola
async function enviarCorreo({ para, asunto, texto, html }) {
  const t = obtenerTransporte();
  if (!t) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Falta configurar SMTP_HOST para enviar correos.');
    }
    console.log(`📧 [Correo sin SMTP] Para: ${para}\nAsunto: ${asunto}\n${texto}`);
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
