/*
  # Corrigir Função get_service_team_availability_matrix v2
  
  Usar timestamps para generate_series funcionar corretamente.
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
  v_slot_timestamp timestamp;
  v_slot_time time;
  v_result RECORD;
  v_capacity integer;
BEGIN
  SELECT public.get_service_total_capacity(p_service_id) INTO v_capacity;

  -- Usar timestamps completos para generate_series
  FOR v_slot_timestamp IN 
    SELECT generate_series(
      (p_date || ' 09:00:00')::timestamp,
      (p_date || ' 19:30:00')::timestamp,
      interval '30 minutes'
    )
  LOOP
    v_slot_time := v_slot_timestamp::time;
    
    SELECT * INTO v_result
    FROM public.get_professionals_availability_for_slot(
      p_service_id,
      p_date,
      v_slot_time,
      (v_slot_timestamp + interval '30 minutes')::time
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
