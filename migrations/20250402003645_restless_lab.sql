/*
  # Enable pgcrypto Extension

  1. Changes
    - Enable the pgcrypto extension which provides cryptographic functions
    - Required for password hashing and salt generation
    
  2. Security
    - Extension is safe to enable
    - Only provides cryptographic functions
    - No additional security concerns
*/

-- Enable the pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;