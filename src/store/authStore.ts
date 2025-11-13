import { create } from 'zustand';
import * as auth from '../lib/auth';
import { supabase } from '../lib/supabase';
import { USER_ROLES } from '../types/roles';

interface AuthState {
  user: auth.User | null;
  profile: auth.User | null;
  loading: boolean;
  initialized: boolean;
  isLoggingIn: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<auth.User>;
  loginSuperAdmin: (email: string, password: string) => Promise<auth.User>;
  register: (email: string, password: string, fullName: string, phone?: string, role?: 'professional' | 'client') => Promise<void>;
  registerSuperAdmin: (email: string, password: string, fullName: string) => Promise<auth.User>;
  checkSuperAdminExists: () => Promise<boolean>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<auth.User>) => Promise<void>;
}

let authStateSubscription: { data: { subscription: { unsubscribe: () => void } } } | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,
  isLoggingIn: false,

  initialize: async () => {
    const state = get();
    if (state.initialized || state.isLoggingIn) {
      return;
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error during initialization:', sessionError);
        await supabase.auth.signOut();
        set({ user: null, profile: null, loading: false, initialized: true });
        return;
      }

      if (session?.user) {
        const user = await auth.getCurrentUser();

        if (!user) {
          await supabase.auth.signOut();
          set({ user: null, profile: null, loading: false, initialized: true });
          return;
        }

        set({ user, profile: user, loading: false, initialized: true });
      } else {
        set({ user: null, profile: null, loading: false, initialized: true });
      }
    } catch (error) {
      console.error('Initialize error:', error);
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error('Error signing out during initialization:', signOutError);
      }
      set({ user: null, profile: null, loading: false, initialized: true });
    }
  },

  login: async (email, password) => {
    try {
      const result = await auth.login(email, password);

      if (!result.success || !result.user) {
        throw new Error(result.error || 'Erro ao fazer login');
      }

      set({ user: result.user, profile: result.user, loading: false, initialized: true });
      return result.user;
    } catch (error: any) {
      throw error;
    }
  },

  loginSuperAdmin: async (email, password) => {
    set({ loading: true, isLoggingIn: true });
    try {
      const result = await auth.loginSuperAdmin(email, password);

      if (!result.success) {
        set({ loading: false, isLoggingIn: false });
        throw new Error(result.error || 'Acesso negado');
      }

      if (!result.user) {
        set({ loading: false, isLoggingIn: false });
        throw new Error('Acesso negado');
      }

      set({
        user: result.user,
        profile: result.user,
        loading: false,
        initialized: true,
        isLoggingIn: false
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      return result.user;
    } catch (error) {
      set({ loading: false, isLoggingIn: false });
      throw error;
    }
  },

  register: async (email, password, fullName, phone, role = 'professional') => {
    set({ loading: true });
    try {
      const result = await auth.register(email, password, fullName, phone, role);

      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar conta');
      }

      set({ user: result.user, profile: result.user, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  registerSuperAdmin: async (email, password, fullName) => {
    set({ loading: true });
    try {
      const result = await auth.registerSuperAdmin(email, password, fullName);

      if (!result.success) {
        set({ loading: false });
        throw new Error(result.error || 'Erro ao criar super administrador');
      }

      if (!result.user) {
        set({ loading: false });
        throw new Error('Falha ao criar super administrador');
      }

      set({ loading: false });
      return result.user;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  checkSuperAdminExists: async () => {
    try {
      return await auth.checkSuperAdminExists();
    } catch (error) {
      console.error('Error checking super admin:', error);
      return true;
    }
  },

  logout: async () => {
    sessionStorage.removeItem('super_admin_session');
    await auth.logout();
    set({ user: null, profile: null });
  },

  signOut: async () => {
    sessionStorage.removeItem('super_admin_session');
    await auth.logout();
    set({ user: null, profile: null });
  },

  loadProfile: async () => {
    try {
      const user = await auth.getCurrentUser();
      set({ user, profile: user });
    } catch (error) {
      console.error('Load profile error:', error);
    }
  },

  updateProfile: async (updates: Partial<auth.User>) => {
    const currentUser = get().user;
    if (!currentUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: updates.full_name,
          avatar_url: updates.avatar_url,
          mobile_number: updates.phone || updates.mobile_number,
          bio: updates.bio,
          business_name: updates.business_name,
          business_description: updates.business_description,
          business_address: updates.business_address,
          business_phone: updates.business_phone,
          business_hours: updates.business_hours
        })
        .eq('id', currentUser.id);

      if (error) {
        console.error('Update profile error:', error);
        throw error;
      }

      const updatedUser = { ...currentUser, ...updates };
      set({ user: updatedUser, profile: updatedUser });
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }
}));
