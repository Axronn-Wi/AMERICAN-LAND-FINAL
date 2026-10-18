-- Completa los ciclos de los salones creados antes de que crearSalon los generara.
-- Agrega solo los números de ciclo que faltan (no duplica ni borra nada).
INSERT INTO ciclos (salon_id, numero_ciclo, estado)
SELECT s.id, g,
       CASE WHEN g < s.ciclo_actual THEN 'finalizado'
            WHEN g = s.ciclo_actual THEN 'en curso'
            ELSE 'pendiente' END
FROM salones s
JOIN niveles n ON n.id = s.nivel_id
CROSS JOIN LATERAL generate_series(1, GREATEST(n.ciclos_totales, 1)) AS g
WHERE NOT EXISTS (
  SELECT 1 FROM ciclos c WHERE c.salon_id = s.id AND c.numero_ciclo = g
);
