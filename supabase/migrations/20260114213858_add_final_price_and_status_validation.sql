/*
  # Add Final Price and Status Transition Validation

  1. New Fields
    - `final_price` (numeric) - Stores the price at the time of booking creation
    - This ensures historical revenue data remains accurate even if service prices change

  2. New Triggers
    - `validate_status_transition` - Prevents invalid status transitions
      - Cancelled bookings cannot be reopened
      - Completed bookings cannot be reopened
    - `set_booking_final_price` - Automatically sets final_price on booking creation

  3. Security
    - Status transitions are now enforced at database level
    - Price snapshots ensure data integrity for reporting

  4. Notes
    - Existing bookings without final_price will use service price as fallback
    - Only affects new bookings going forward
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'final_price'
  ) THEN
    ALTER TABLE bookings ADD COLUMN final_price numeric(10,2);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION validate_booking_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'cancelado' AND NEW.status != 'cancelado' THEN
    RAISE EXCEPTION 'Não é possível alterar o estado de uma reserva cancelada';
  END IF;
  
  IF OLD.status = 'concluído' AND NEW.status != 'concluído' THEN
    RAISE EXCEPTION 'Não é possível alterar o estado de uma reserva concluída';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_booking_status_transitions ON bookings;
CREATE TRIGGER enforce_booking_status_transitions
  BEFORE UPDATE OF status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_status_transition();

CREATE OR REPLACE FUNCTION set_booking_final_price()
RETURNS TRIGGER AS $$
DECLARE
  v_price numeric(10,2);
BEGIN
  IF NEW.final_price IS NULL THEN
    IF NEW.service_variant_id IS NOT NULL THEN
      SELECT price INTO v_price
      FROM service_variants
      WHERE id = NEW.service_variant_id;
    END IF;
    
    IF v_price IS NULL THEN
      SELECT price INTO v_price
      FROM services
      WHERE id = NEW.service_id;
    END IF;
    
    NEW.final_price := COALESCE(v_price, 0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_booking_price_on_insert ON bookings;
CREATE TRIGGER set_booking_price_on_insert
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_final_price();