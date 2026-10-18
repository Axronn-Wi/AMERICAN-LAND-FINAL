-- Tokens de recuperación de contraseña (PostgreSQL)
-- Se guarda solo el hash SHA-256 del token: si alguien lee la tabla no puede usar los enlaces.
CREATE TABLE IF NOT EXISTS tokens_recuperacion (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash  CHAR(64)    NOT NULL UNIQUE,
  expira_en   TIMESTAMPTZ NOT NULL,
  usado_en    TIMESTAMPTZ,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_recuperacion_usuario ON tokens_recuperacion (usuario_id);
