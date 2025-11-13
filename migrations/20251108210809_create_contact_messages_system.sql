/*
  # Internal Email System - Contact Messages

  1. New Tables
    - `message_categories`
      - `id` (uuid, primary key)
      - `name` (text) - Category name in Portuguese
      - `value` (text) - Value matching contact form subjects
      - `color` (text) - Color code for UI badges
      - `created_at` (timestamptz)
    
    - `contact_messages`
      - `id` (uuid, primary key)
      - `sender_name` (text) - Name of person who sent message
      - `sender_email` (text) - Email address of sender
      - `subject` (text) - Subject/topic of message
      - `message` (text) - Full message content
      - `status` (text) - Message status: unread, read, archived
      - `category_tag` (text) - Category for organizing messages
      - `assigned_to` (uuid) - ID of super admin assigned to handle this
      - `created_at` (timestamptz) - When message was submitted
      - `updated_at` (timestamptz) - Last modification time
      - `read_at` (timestamptz) - When message was first read

  2. Security
    - Enable RLS on all tables
    - Only super_admin role can access contact messages
    - Public can insert contact messages (contact form submissions)
    - Add policies for read, update, delete operations
    
  3. Indexes
    - Index on status for filtering
    - Index on category_tag for filtering
    - Index on assigned_to for filtering
    - Index on created_at for sorting

  4. Important Notes
    - Contact form submissions are public (anyone can submit)
    - Only super admins can view and manage messages
    - Automatic timestamp updates on modification
    - Category tags match contact form subject options
*/

-- Create message_categories table
CREATE TABLE IF NOT EXISTS message_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  value text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT 'blue',
  created_at timestamptz DEFAULT now()
);

-- Insert predefined categories matching contact form
INSERT INTO message_categories (name, value, color) VALUES
  ('Informação Geral', 'general', 'blue'),
  ('Suporte Técnico', 'support', 'orange'),
  ('Tornar-me Profissional', 'professional', 'green'),
  ('Parceria', 'partnership', 'purple'),
  ('Outro', 'other', 'gray')
ON CONFLICT (value) DO NOTHING;

-- Create contact_messages table
CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  category_tag text REFERENCES message_categories(value) ON DELETE SET NULL,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_category ON contact_messages(category_tag);
CREATE INDEX IF NOT EXISTS idx_contact_messages_assigned ON contact_messages(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_sender_email ON contact_messages(sender_email);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contact_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS contact_messages_updated_at ON contact_messages;
CREATE TRIGGER contact_messages_updated_at
  BEFORE UPDATE ON contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_messages_updated_at();

-- Function to automatically set category_tag based on subject
CREATE OR REPLACE FUNCTION set_category_tag_from_subject()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category_tag IS NULL THEN
    NEW.category_tag := NEW.subject;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set category_tag from subject
DROP TRIGGER IF EXISTS set_category_on_insert ON contact_messages;
CREATE TRIGGER set_category_on_insert
  BEFORE INSERT ON contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION set_category_tag_from_subject();

-- Enable Row Level Security
ALTER TABLE message_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Message Categories Policies
CREATE POLICY "Message categories are viewable by everyone"
  ON message_categories FOR SELECT
  USING (true);

-- Contact Messages Policies

-- Anyone can insert contact messages (public contact form)
CREATE POLICY "Anyone can submit contact messages"
  ON contact_messages FOR INSERT
  WITH CHECK (true);

-- Only super admins can view contact messages
CREATE POLICY "Super admins can view all contact messages"
  ON contact_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Only super admins can update contact messages
CREATE POLICY "Super admins can update contact messages"
  ON contact_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Only super admins can delete contact messages
CREATE POLICY "Super admins can delete contact messages"
  ON contact_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );