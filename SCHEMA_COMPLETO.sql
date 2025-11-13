/*
  ============================================================================
  SCHEMA COMPLETO - PLATAFORMA DE AGENDAMENTOS DE SERVIÇOS DE BELEZA
  ============================================================================

  Este script contém o schema completo do banco de dados incluindo:
  - Todas as tabelas
  - Funções de autenticação customizadas
  - Triggers e funções auxiliares
  - Políticas RLS (DESABILITADAS para desenvolvimento local)
  - Índices para performance

  IMPORTANTE: Este schema está configurado para desenvolvimento com
  autenticação local. Para produção, será necessário reabilitar RLS
  e configurar políticas apropriadas.

  Data: 2025-11-03
  ============================================================================
*/

-- ============================================================================
-- EXTENSÕES
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABELA: profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  password_hash text,
  full_name text,
  role text CHECK (role IN ('client', 'professional', 'admin')) DEFAULT 'client',
  avatar_url text,
  mobile_number text,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_mobile_number CHECK (mobile_number IS NULL OR mobile_number ~ '^\+?[1-9]\d{1,14}$')
);

-- Índices para profiles
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON profiles(created_at);

-- ============================================================================
-- TABELA: services
-- ============================================================================

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  price numeric NOT NULL CHECK (price >= 0),
  duration interval NOT NULL,
  image_url text,
  whatsapp_number text,
  category text,
  team jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para services
CREATE INDEX IF NOT EXISTS services_professional_id_idx ON services(professional_id);
CREATE INDEX IF NOT EXISTS services_category_idx ON services(category);
CREATE INDEX IF NOT EXISTS services_created_at_idx ON services(created_at);

-- ============================================================================
-- TABELA: bookings
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')) DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Índices para bookings
CREATE INDEX IF NOT EXISTS bookings_client_id_idx ON bookings(client_id);
CREATE INDEX IF NOT EXISTS bookings_professional_id_idx ON bookings(professional_id);
CREATE INDEX IF NOT EXISTS bookings_service_id_idx ON bookings(service_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);
CREATE INDEX IF NOT EXISTS bookings_start_time_idx ON bookings(start_time);
CREATE INDEX IF NOT EXISTS bookings_created_at_idx ON bookings(created_at);

-- ============================================================================
-- TABELA: reviews
-- ============================================================================

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

-- Índices para reviews
CREATE INDEX IF NOT EXISTS reviews_booking_id_idx ON reviews(booking_id);
CREATE INDEX IF NOT EXISTS reviews_professional_id_idx ON reviews(professional_id);
CREATE INDEX IF NOT EXISTS reviews_service_id_idx ON reviews(service_id);
CREATE INDEX IF NOT EXISTS reviews_rating_idx ON reviews(rating);

-- ============================================================================
-- TABELA: clients (informações adicionais de clientes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  notes text,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, professional_id)
);

-- Índices para clients
CREATE INDEX IF NOT EXISTS clients_profile_id_idx ON clients(profile_id);
CREATE INDEX IF NOT EXISTS clients_professional_id_idx ON clients(professional_id);

-- ============================================================================
-- TABELA: client_notes
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para client_notes
CREATE INDEX IF NOT EXISTS idx_client_notes_client_professional ON client_notes (client_id, professional_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_created ON client_notes (created_at);

-- ============================================================================
-- TABELA: availability (disponibilidade dos profissionais)
-- ============================================================================

CREATE TABLE IF NOT EXISTS availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week integer CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_availability_time CHECK (end_time > start_time)
);

-- Índices para availability
CREATE INDEX IF NOT EXISTS availability_professional_id_idx ON availability(professional_id);
CREATE INDEX IF NOT EXISTS availability_day_of_week_idx ON availability(day_of_week);

-- ============================================================================
-- TABELA: blocked_dates (datas bloqueadas/feriados)
-- ============================================================================

CREATE TABLE IF NOT EXISTS blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(professional_id, date)
);

-- Índices para blocked_dates
CREATE INDEX IF NOT EXISTS blocked_dates_professional_id_idx ON blocked_dates(professional_id);
CREATE INDEX IF NOT EXISTS blocked_dates_date_idx ON blocked_dates(date);

-- ============================================================================
-- TABELA: calendar_notes (notas do calendário)
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_notes (
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

-- Índices para calendar_notes
CREATE INDEX IF NOT EXISTS idx_calendar_notes_professional_date ON calendar_notes (professional_id, date);

-- ============================================================================
-- FUNÇÕES DE AUTENTICAÇÃO
-- ============================================================================

-- Função para registrar utilizador
CREATE OR REPLACE FUNCTION register_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_mobile_number text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_result json;
BEGIN
  -- Validar email
  IF p_email IS NULL OR p_email = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Email é obrigatório'
    );
  END IF;

  -- Validar password
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'A palavra-passe deve ter pelo menos 6 caracteres'
    );
  END IF;

  -- Validar role
  IF p_role NOT IN ('client', 'professional', 'admin') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Tipo de conta inválido'
    );
  END IF;

  -- Verificar se email já existe
  IF EXISTS (SELECT 1 FROM profiles WHERE email = lower(trim(p_email))) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Este email já está registrado'
    );
  END IF;

  -- Criar novo utilizador
  v_user_id := gen_random_uuid();

  INSERT INTO profiles (
    id,
    email,
    password_hash,
    full_name,
    role,
    mobile_number,
    created_at
  ) VALUES (
    v_user_id,
    lower(trim(p_email)),
    crypt(p_password, gen_salt('bf')),
    p_full_name,
    p_role,
    p_mobile_number,
    now()
  );

  -- Retornar sucesso com dados do utilizador (sem password)
  SELECT json_build_object(
    'success', true,
    'user', json_build_object(
      'id', id,
      'email', email,
      'full_name', full_name,
      'role', role,
      'mobile_number', mobile_number,
      'avatar_url', avatar_url
    )
  ) INTO v_result
  FROM profiles
  WHERE id = v_user_id;

  RETURN v_result;
END;
$$;

-- Função para login
CREATE OR REPLACE FUNCTION login_user(
  p_email text,
  p_password text,
  p_role text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user profiles%ROWTYPE;
  v_result json;
BEGIN
  -- Buscar utilizador por email
  SELECT * INTO v_user
  FROM profiles
  WHERE email = lower(trim(p_email));

  -- Verificar se utilizador existe
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Email ou palavra-passe incorretos'
    );
  END IF;

  -- Verificar password
  IF v_user.password_hash IS NULL OR
     v_user.password_hash != crypt(p_password, v_user.password_hash) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Email ou palavra-passe incorretos'
    );
  END IF;

  -- Verificar role (atualizar se necessário)
  IF p_role IS NOT NULL AND v_user.role != p_role THEN
    UPDATE profiles
    SET role = p_role,
        last_login = now()
    WHERE id = v_user.id;

    v_user.role := p_role;
  ELSE
    -- Apenas atualizar last_login
    UPDATE profiles
    SET last_login = now()
    WHERE id = v_user.id;
  END IF;

  -- Retornar sucesso com dados do utilizador
  RETURN json_build_object(
    'success', true,
    'user', json_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'full_name', v_user.full_name,
      'role', v_user.role,
      'mobile_number', v_user.mobile_number,
      'avatar_url', v_user.avatar_url
    )
  );
END;
$$;

-- ============================================================================
-- FUNÇÃO: Estatísticas de clientes
-- ============================================================================

CREATE OR REPLACE FUNCTION get_client_stats(
  p_professional_id uuid,
  p_client_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'total_bookings', COUNT(DISTINCT b.id),
    'completed_bookings', COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END),
    'cancelled_bookings', COUNT(DISTINCT CASE WHEN b.status = 'cancelled' THEN b.id END),
    'total_spent', COALESCE(SUM(s.price) FILTER (WHERE b.status = 'completed'), 0),
    'average_rating', COALESCE(AVG(r.rating), 0),
    'last_visit', MAX(b.start_time),
    'notes_count', COUNT(DISTINCT n.id)
  )
  INTO v_result
  FROM bookings b
  LEFT JOIN services s ON b.service_id = s.id
  LEFT JOIN reviews r ON b.id = r.booking_id
  LEFT JOIN client_notes n ON b.client_id = n.client_id
  WHERE b.professional_id = p_professional_id
  AND b.client_id = p_client_id;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- TRIGGERS: Update timestamps
-- ============================================================================

-- Função genérica para atualizar updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar timestamps
DROP TRIGGER IF EXISTS update_profiles_timestamp ON profiles;
CREATE TRIGGER update_profiles_timestamp
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_services_timestamp ON services;
CREATE TRIGGER update_services_timestamp
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_bookings_timestamp ON bookings;
CREATE TRIGGER update_bookings_timestamp
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_clients_timestamp ON clients;
CREATE TRIGGER update_clients_timestamp
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_client_notes_timestamp ON client_notes;
CREATE TRIGGER update_client_notes_timestamp
  BEFORE UPDATE ON client_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_availability_timestamp ON availability;
CREATE TRIGGER update_availability_timestamp
  BEFORE UPDATE ON availability
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_calendar_notes_timestamp ON calendar_notes;
CREATE TRIGGER update_calendar_notes_timestamp
  BEFORE UPDATE ON calendar_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- PERMISSÕES
-- ============================================================================

-- Permitir acesso às funções de autenticação
GRANT EXECUTE ON FUNCTION register_user TO anon, authenticated;
GRANT EXECUTE ON FUNCTION login_user TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_client_stats TO anon, authenticated;

-- Permitir acesso ao schema e tabelas
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - DESABILITADO PARA DESENVOLVIMENTO
-- ============================================================================
--
-- IMPORTANTE: RLS está desabilitado para permitir desenvolvimento com
-- autenticação local. Antes de ir para produção, você deve:
-- 1. Reabilitar RLS em todas as tabelas
-- 2. Configurar políticas apropriadas
-- 3. Migrar para autenticação Supabase Auth
-- ============================================================================

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE availability DISABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates DISABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_notes DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIM DO SCHEMA
-- ============================================================================

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✓ Schema completo criado com sucesso!';
  RAISE NOTICE '✓ Todas as tabelas, funções e triggers foram configurados';
  RAISE NOTICE '⚠ RLS está DESABILITADO para desenvolvimento';
  RAISE NOTICE '⚠ Lembre-se de reabilitar RLS antes de ir para produção';
END $$;
