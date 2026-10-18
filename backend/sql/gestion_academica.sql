-- Secretaría, asistencia, anuncios y contacto web (PostgreSQL)
-- Se puede ejecutar varias veces sin romper nada.

-- ── Rol secretaria ───────────────────────────────────────────
INSERT INTO roles (nombre, descripcion)
SELECT 'secretaria', 'Secretaría académica: matrículas, pagos y atención'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE nombre = 'secretaria');

-- Quién registró una matrícula o un pago (admin o secretaria).
-- secretaria_id sigue apuntando a la tabla admin por compatibilidad.
ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS registrado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE pagos      ADD COLUMN IF NOT EXISTS registrado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;

-- ── Asistencia ──────────────────────────────────────────────
-- Un solo registro por estudiante, salón y día (permite guardar la lista varias veces)
CREATE UNIQUE INDEX IF NOT EXISTS uq_asistencias_estudiante_salon_fecha
  ON asistencias (estudiante_id, salon_id, fecha);
CREATE INDEX IF NOT EXISTS idx_asistencias_salon_fecha ON asistencias (salon_id, fecha);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_asistencias_estado') THEN
    ALTER TABLE asistencias ADD CONSTRAINT ck_asistencias_estado
      CHECK (estado IN ('presente', 'ausente', 'tarde', 'excusa'));
  END IF;
END $$;

-- ── Anuncios ────────────────────────────────────────────────
-- salon_id opcional: el docente publica para un salón; admin y secretaría para todos
ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS salon_id INTEGER REFERENCES salones(id) ON DELETE CASCADE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_anuncios_dirigido_a') THEN
    ALTER TABLE anuncios ADD CONSTRAINT ck_anuncios_dirigido_a
      CHECK (dirigido_a IN ('todos', 'estudiantes', 'docentes'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_anuncios_activos ON anuncios (activo, publicado_en DESC);

-- ── Contacto web ────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_contacto_web_estado') THEN
    ALTER TABLE contacto_web ADD CONSTRAINT ck_contacto_web_estado
      CHECK (estado IN ('nuevo', 'en_proceso', 'atendido'));
  END IF;
END $$;

ALTER TABLE contacto_web ADD COLUMN IF NOT EXISTS atendido_en TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_contacto_web_estado ON contacto_web (estado, recibido_en DESC);
