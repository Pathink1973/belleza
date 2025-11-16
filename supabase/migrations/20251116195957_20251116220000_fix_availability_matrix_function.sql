/*
  # Corrigir Função get_service_team_availability_matrix
  
  A função tinha um erro no generate_series com TIME.
  Precisamos converter para timestamp para funcionar.
*/

CREATE OR REPLACE FUNCTION public.get_service_team_availability_matrix(
  p_service_id uuid, 
  p_date date
)
RETURNS TABLE(
  time_slot time,
  available_count integer,
  total_capacity integer,
  is_available boolean,
  utilization_percentage integer
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_slot_time time;
  v_result RECORD;
  v_capacity integer;
BEGIN
  SELECT public.get_service_total_capacity(p_service_id) INTO v_capacity;

  -- CORREÇÃO: Usar timestamp com date para generate_series funcionar
  FOR v_slot_time IN 
    SELECT (p_date + t)::time
    FROM generate_series(
      '09:00'::time,
      '19:30'::time,
      interval '30 minutes'
    ) AS t
  LOOP
    SELECT * INTO v_result
    FROM public.get_professionals_availability_for_slot(
      p_service_id,
      p_date,
      v_slot_time,
      (v_slot_time::interval + interval '30 minutes')::time
    );

    RETURN QUERY SELECT
      v_slot_time,
      COALESCE(v_result.available_count, 0),
      COALESCE(v_result.total_capacity, v_capacity, 0),
      COALESCE(v_result.is_available, false),
      CASE 
        WHEN COALESCE(v_result.total_capacity, v_capacity, 0) > 0 
        THEN ROUND((COALESCE(v_result.occupied_count, 0)::numeric / COALESCE(v_result.total_capacity, v_capacity, 1)::numeric) * 100)::integer
        ELSE 0
      END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION get_service_team_availability_matrix IS
'Retorna matriz de disponibilidade para todos os horários do dia (09:00-19:30 em intervalos de 30 minutos)';
