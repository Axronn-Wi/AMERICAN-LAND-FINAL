-- Recuperación de contraseña con código de 6 dígitos (PostgreSQL)
-- Se puede ejecutar varias veces sin romper nada.

-- token_hash guarda el HMAC del código; "sal" lo hace único por solicitud
-- y "intentos" cuenta los códigos equivocados (al 5.º el código deja de servir).
ALTER TABLE tokens_recuperacion ADD COLUMN IF NOT EXISTS sal CHAR(32);
ALTER TABLE tokens_recuperacion ADD COLUMN IF NOT EXISTS intentos INTEGER NOT NULL DEFAULT 0;
