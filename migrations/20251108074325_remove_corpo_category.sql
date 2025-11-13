/*
  # Remove 'Corpo' Category from Services

  1. Changes
    - Migrate existing services using 'Corpo' category to 'Tratamento Corporal'
    - Drop existing category constraint
    - Add new constraint without 'Corpo' category
    
  2. Categories After Change
    - Cabelo e penteado
    - Unhas
    - Sobrancelhas
    - Massagem
    - Barbearia
    - Depilação
    - Tratamento Facial
    - Tratamento Corporal
    - Injectáveis
    - Tatuagem e piercing
    - Maquilhagem
    - Fitness
    
  3. Data Migration
    - All existing services with category 'Corpo' will be moved to 'Tratamento Corporal'
    - This ensures no data loss and maintains service availability
*/

-- First, migrate any existing services using 'Corpo' to 'Tratamento Corporal'
UPDATE services 
SET category = 'Tratamento Corporal' 
WHERE category = 'Corpo';

-- Drop the existing constraint
ALTER TABLE services DROP CONSTRAINT IF EXISTS valid_service_category;

-- Add new constraint without 'Corpo' category
ALTER TABLE services
  ADD CONSTRAINT valid_service_category 
  CHECK (category IN (
    'Cabelo e penteado',
    'Unhas',
    'Sobrancelhas',
    'Massagem',
    'Barbearia',
    'Depilação',
    'Tratamento Facial',
    'Tratamento Corporal',
    'Injectáveis',
    'Tatuagem e piercing',
    'Maquilhagem',
    'Fitness'
  ));