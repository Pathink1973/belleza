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
  'Maquilhagem'
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
    'Maquilhagem'
  ));