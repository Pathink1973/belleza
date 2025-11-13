import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Não autorizado' 
        }), 
        { 
          status: 401,
          headers: corsHeaders
        }
      );
    }

    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Método não permitido' 
        }), 
        { 
          status: 405,
          headers: corsHeaders
        }
      );
    }

    // Get request body
    const { id, full_name, role } = await req.json();

    // Validate required fields
    if (!id || typeof id !== 'string') {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'ID inválido ou ausente' 
        }), 
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    if (!full_name || typeof full_name !== 'string' || full_name.trim() === '') {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Nome inválido ou ausente' 
        }), 
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    if (!role || role !== 'client') {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Função inválida. Deve ser "client"' 
        }), 
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // First check if profile already exists
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      throw new Error(`Falha ao verificar perfil existente: ${checkError.message}`);
    }

    if (existingProfile) {
      return new Response(
        JSON.stringify({
          success: true,
          data: existingProfile,
          message: 'Perfil já existe'
        }),
        { 
          status: 200,
          headers: corsHeaders
        }
      );
    }

    // Create new profile
    const { data: profile, error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id,
        full_name,
        role,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (insertError) {
      throw new Error(`Falha ao criar perfil: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: profile
      }),
      { 
        status: 201,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );

  } catch (error) {
    console.error('Erro na função create-client:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Ocorreu um erro desconhecido'
      }),
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
});