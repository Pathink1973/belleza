/*
  # Update service categories

  1. Changes
    - Drop existing category constraint
    - Update existing records to use new categories
    - Add new constraint with updated categories
    
  2. Categories
    - Added comprehensive list of beauty and wellness services
    - Ensures data consistency by dropping constraint first
*/

-- First drop the existing constraint to allow updates
ALTER TABLE services DROP CONSTRAINT IF EXISTS valid_service_category;

-- Now update existing records to use valid categories
UPDATE services 
SET category = 'Cabelo e penteado' 
WHERE category NOT IN (
  'Cabelo e penteado',
  'Unhas',
  'Sobrancelhas',
  'Massagem',
  'Barbearia',
  'Depilação',
  'Tratamento Facial',
  'Tratamento Corporal',
  'Injectáveis',
  'Corpo',
  'Tatuagem e piercing',
  'Maquilhagem',
  'Fitness'
);

-- Add new constraint with updated categories
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
    'Corpo',
    'Tatuagem e piercing',
    'Maquilhagem',
    'Fitness'
  ));