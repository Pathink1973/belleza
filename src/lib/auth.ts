import { supabase } from './supabase';
import { USER_ROLES, type UserRole } from '../types/roles';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  bio?: string;
  mobile_number?: string;
  business_name?: string;
  business_description?: string;
  business_address?: string;
  business_phone?: string;
  business_hours?: Record<string, string>;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  mobile_number: string | null;
  created_at: string;
  updated_at: string;
}

export async function register(
  email: string,
  password: string,
  fullName: string,
  phone?: string,
  role: 'professional' | 'client' = 'professional'
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
          mobile_number: phone
        }
      }
    });

    if (authError) {
      console.error('Supabase Auth Error:', authError);
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'Falha ao criar utilizador' };
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile fetch error:', profileError);
    }

    if (!profileData) {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          full_name: fullName,
          role: role,
          mobile_number: phone
        });

      if (insertError) {
        console.error('Profile insert error:', insertError);
      }
    }

    const user: User = {
      id: authData.user.id,
      email: authData.user.email || email,
      full_name: fullName,
      role: role,
      phone: phone
    };

    return { success: true, user };
  } catch (error: any) {
    console.error('Register error:', error);
    return { success: false, error: error.message || 'Erro ao criar conta' };
  }
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user) {
      return { success: false, error: authError?.message || 'Falha ao fazer login' };
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile fetch error:', profileError);
    }

    const role = profileData?.role || authData.user.user_metadata?.role || USER_ROLES.PROFESSIONAL;
    const fullName = profileData?.full_name || authData.user.user_metadata?.full_name || email.split('@')[0];

    const user: User = {
      id: authData.user.id,
      email: authData.user.email || email,
      full_name: fullName,
      role: role as UserRole,
      phone: profileData?.mobile_number || authData.user.user_metadata?.mobile_number,
      avatar_url: profileData?.avatar_url || authData.user.user_metadata?.avatar_url,
      business_name: profileData?.business_name,
      business_description: profileData?.business_description,
      business_address: profileData?.business_address,
      business_phone: profileData?.business_phone,
      business_hours: profileData?.business_hours
    };

    return { success: true, user };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro ao fazer login' };
  }
}

export async function loginSuperAdmin(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('Super Admin Auth Error:', authError);
      return { success: false, error: 'Credenciais inválidas' };
    }

    if (!authData.user) {
      return { success: false, error: 'Credenciais inválidas' };
    }

    await new Promise(resolve => setTimeout(resolve, 150));

    let profileData = null;
    let retries = 3;

    while (retries > 0 && !profileData) {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileError);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        await supabase.auth.signOut();
        return { success: false, error: 'Erro ao carregar perfil' };
      }

      profileData = data;
      if (!profileData && retries > 1) {
        retries--;
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        break;
      }
    }

    if (!profileData) {
      await supabase.auth.signOut();
      return { success: false, error: 'Perfil não encontrado' };
    }

    if (profileData.role !== USER_ROLES.SUPER_ADMIN) {
      await supabase.auth.signOut();
      return { success: false, error: 'Acesso negado. Apenas super administradores podem aceder a esta área.' };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Erro ao estabelecer sessão' };
    }

    const fullName = profileData.full_name || authData.user.user_metadata?.full_name || 'Super Admin';

    const user: User = {
      id: authData.user.id,
      email: authData.user.email || email,
      full_name: fullName,
      role: USER_ROLES.SUPER_ADMIN,
      phone: profileData.mobile_number,
      avatar_url: profileData.avatar_url
    };

    return { success: true, user };
  } catch (error: any) {
    console.error('Super Admin login error:', error);

    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.error('Error signing out after failed login:', signOutError);
    }

    return { success: false, error: 'Erro ao fazer login. Por favor, tente novamente.' };
  }
}

export async function checkSuperAdminExists(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_super_admin_exists');

    if (error) {
      console.error('Error checking super admin:', error);
      return true;
    }

    return data === true;
  } catch (error) {
    console.error('Error checking super admin:', error);
    return true;
  }
}

export async function registerSuperAdmin(
  email: string,
  password: string,
  fullName: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const exists = await checkSuperAdminExists();

    if (exists) {
      await supabase
        .from('super_admin_audit')
        .insert({
          email,
          success: false
        });

      return {
        success: false,
        error: 'Sistema já inicializado. Não é possível criar novos super administradores através do bootstrap.'
      };
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: USER_ROLES.SUPER_ADMIN
        }
      }
    });

    if (authError) {
      console.error('Super Admin Auth Error:', authError);

      await supabase
        .from('super_admin_audit')
        .insert({
          email,
          success: false
        });

      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      await supabase
        .from('super_admin_audit')
        .insert({
          email,
          success: false
        });

      return { success: false, error: 'Falha ao criar super administrador' };
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        full_name: fullName,
        role: USER_ROLES.SUPER_ADMIN
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
    }

    await supabase
      .from('super_admin_audit')
      .insert({
        email,
        success: true
      });

    const user: User = {
      id: authData.user.id,
      email: authData.user.email || email,
      full_name: fullName,
      role: USER_ROLES.SUPER_ADMIN
    };

    return { success: true, user };
  } catch (error: any) {
    console.error('Register super admin error:', error);

    try {
      await supabase
        .from('super_admin_audit')
        .insert({
          email,
          success: false
        });
    } catch (auditError) {
      console.error('Audit log error:', auditError);
    }

    return { success: false, error: error.message || 'Erro ao criar super administrador' };
  }
}

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Logout error:', error);
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return null;
    }

    let profileData = null;
    let retries = 2;

    while (retries > 0) {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileError);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
      }

      profileData = data;
      break;
    }

    const role = profileData?.role || authUser.user_metadata?.role || USER_ROLES.PROFESSIONAL;
    const fullName = profileData?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User';

    return {
      id: authUser.id,
      email: authUser.email || '',
      full_name: fullName,
      role: role as UserRole,
      phone: profileData?.mobile_number || authUser.user_metadata?.mobile_number,
      avatar_url: profileData?.avatar_url || authUser.user_metadata?.avatar_url,
      business_name: profileData?.business_name,
      business_description: profileData?.business_description,
      business_address: profileData?.business_address,
      business_phone: profileData?.business_phone,
      business_hours: profileData?.business_hours
    };
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
