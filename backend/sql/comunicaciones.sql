-- Notificaciones y chat (PostgreSQL)
-- Se puede ejecutar varias veces sin romper nada (IF NOT EXISTS).

-- Avisos que el sistema genera para cada usuario (nueva tarea, calificación, pago...)
CREATE TABLE IF NOT EXISTS notificaciones (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo        VARCHAR(30)  NOT NULL DEFAULT 'general',
  titulo      VARCHAR(150) NOT NULL,
  mensaje     VARCHAR(500) NOT NULL DEFAULT '',
  enlace      VARCHAR(255),
  leida       BOOLEAN      NOT NULL DEFAULT FALSE,
  creada_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario
  ON notificaciones (usuario_id, leida, creada_en DESC);

-- Mensajes de chat directo entre dos usuarios
CREATE TABLE IF NOT EXISTS mensajes_chat (
  id              SERIAL PRIMARY KEY,
  remitente_id    INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  destinatario_id INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  contenido       VARCHAR(2000) NOT NULL CHECK (length(trim(contenido)) > 0),
  enviado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  leido_en        TIMESTAMPTZ,
  CHECK (remitente_id <> destinatario_id)
);

CREATE INDEX IF NOT EXISTS idx_mensajes_chat_conversacion
  ON mensajes_chat (LEAST(remitente_id, destinatario_id), GREATEST(remitente_id, destinatario_id), id);

CREATE INDEX IF NOT EXISTS idx_mensajes_chat_no_leidos
  ON mensajes_chat (destinatario_id) WHERE leido_en IS NULL;
