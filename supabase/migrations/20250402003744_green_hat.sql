/*
  # Enable pgcrypto Extension

  1. Changes
    - Enable the pgcrypto extension which provides cryptographic functions
    - Required for password hashing and salt generation
    - Must be enabled before any functions that use gen_salt()
    
  2. Security
    - Extension is safe to enable
    - Only provides cryptographic functions
    - No additional security concerns
*/

-- Enable the pgcrypto extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;

-- Ensure the extension is available to the authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;