/*
  # Add RLS Policies for Booking and Review Updates

  1. Booking Update Policies
    - Clients can update their own bookings if status is 'pending' or 'confirmed'
    - Clients can cancel bookings
    - Clients can archive their own cancelled bookings

  2. Booking Delete Policies
    - Clients can delete their own archived bookings

  3. Review Update Policies
    - Clients can update their own reviews
    - Only allow updates within 30 days of original creation

  4. Review Delete Policies
    - Clients can delete their own reviews within 30 days
*/

-- Booking update policy for regular updates (date/time changes)
CREATE POLICY "Clients can update their pending or confirmed bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = client_id AND
    status IN ('pending', 'confirmed') AND
    is_archived = false
  );

-- Booking delete policy
CREATE POLICY "Clients can delete their archived bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (
    auth.uid() = client_id AND
    is_archived = true AND
    status = 'cancelled'
  );

-- Review update policy
CREATE POLICY "Clients can update their own reviews within 30 days"
  ON reviews FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = client_id AND
    (
      original_created_at IS NULL OR
      original_created_at > now() - interval '30 days' OR
      created_at > now() - interval '30 days'
    )
  );

-- Review delete policy
CREATE POLICY "Clients can delete their own reviews within 30 days"
  ON reviews FOR DELETE
  TO authenticated
  USING (
    auth.uid() = client_id AND
    (
      original_created_at IS NULL OR
      original_created_at > now() - interval '30 days' OR
      created_at > now() - interval '30 days'
    )
  );