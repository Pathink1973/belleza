-- Create calendar_notes table
CREATE TABLE calendar_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  time_slot text NOT NULL,
  note text NOT NULL,
  is_opt_in boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(professional_id, date, time_slot)
);

-- Enable RLS
ALTER TABLE calendar_notes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Professionals can manage their own notes"
  ON calendar_notes
  FOR ALL
  TO authenticated
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

-- Create index for better performance
CREATE INDEX idx_calendar_notes_professional_date 
ON calendar_notes (professional_id, date);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_calendar_notes_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating timestamp
CREATE TRIGGER update_calendar_notes_timestamp
  BEFORE UPDATE ON calendar_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_notes_updated_at();