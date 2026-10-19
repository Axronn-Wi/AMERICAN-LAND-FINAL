-- Muro de la comunidad: publicaciones con foto, comentarios y "me gusta" (PostgreSQL)
-- Se puede ejecutar varias veces sin romper nada.

CREATE TABLE IF NOT EXISTS publicaciones (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER       NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto       VARCHAR(2200) NOT NULL DEFAULT '',
  imagen_url  VARCHAR(255)  NOT NULL,
  creada_en   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_publicaciones_fecha ON publicaciones (id DESC);

CREATE TABLE IF NOT EXISTS publicacion_comentarios (
  id              SERIAL PRIMARY KEY,
  publicacion_id  INTEGER      NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  usuario_id      INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto           VARCHAR(500) NOT NULL CHECK (length(trim(texto)) > 0),
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comentarios_publicacion ON publicacion_comentarios (publicacion_id, id);

CREATE TABLE IF NOT EXISTS publicacion_likes (
  publicacion_id  INTEGER     NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  usuario_id      INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (publicacion_id, usuario_id)
);
