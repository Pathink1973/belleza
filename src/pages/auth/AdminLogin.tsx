import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Shield, Eye, EyeOff, ArrowLeft, Info } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBootstrapLink, setShowBootstrapLink] = useState(false);
  const { loginSuperAdmin, checkSuperAdminExists } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkBootstrapAvailability = async () => {
      try {
        const exists = await checkSuperAdminExists();
        setShowBootstrapLink(!exists);
      } catch (error) {
        console.error('Error checking bootstrap availability:', error);
        setShowBootstrapLink(false);
      }
    };

    checkBootstrapAvailability();

    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      setTimeout(() => setSuccessMessage(''), 5000);
    }
  }, [checkSuperAdminExists, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await loginSuperAdmin(email, password);

      await new Promise(resolve => setTimeout(resolve, 150));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Erro ao estabelecer sessão');
      }

      navigate('/super-admin/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Acesso negado. Verifique suas credenciais.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(239,68,68,0.1),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(239,68,68,0.08),transparent_50%)]"></div>

      <div className="max-w-md w-full space-y-8 relative">
        <div className="bg-slate-800/50 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-slate-700/50">
          <div>
            <Link
              to="/auth/login"
              className="inline-flex items-center text-sm text-slate-400 hover:text-slate-200 transition-colors mb-8 group"
            >
              <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Voltar ao Login
            </Link>

            <div className="flex flex-col items-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse"></div>
                <img
                  src="/icons/belleza-logo.svg"
                  alt="Belleza Admin"
                  className="relative h-7 sm:h-9 w-auto transform hover:scale-105 transition-transform brightness-0 invert"
                />
              </div>

              <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                Área Administrativa
              </h1>

              <div className="flex items-center gap-2 mb-4">
                <div className="h-px w-8 bg-gradient-to-r from-transparent to-red-500"></div>
                <h2 className="text-lg font-semibold text-red-400 uppercase tracking-wider text-sm">
                  Acesso Restrito
                </h2>
                <div className="h-px w-8 bg-gradient-to-l from-transparent to-red-500"></div>
              </div>

              <p className="mt-2 text-center text-sm text-slate-400 leading-relaxed">
                Esta área é destinada apenas para administradores autorizados da plataforma.
              </p>
            </div>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {successMessage && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 backdrop-blur-sm animate-slide-up">
                <div className="text-sm text-emerald-300">{successMessage}</div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 backdrop-blur-sm animate-slide-up">
                <div className="text-sm text-red-300">{error}</div>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium text-slate-300 mb-2">
                  Email Administrativo
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="username"
                  className="block w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-slate-500 transition-all hover:bg-slate-700/70"
                  placeholder="admin@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-slate-300 mb-2">
                  Palavra-passe
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className="block w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent pr-12 placeholder-slate-500 transition-all hover:bg-slate-700/70"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-lg shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? 'A verificar...' : 'Aceder à Área Administrativa'}
            </button>

            {showBootstrapLink && (
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-blue-300 mb-2 font-medium">
                      Primeira vez a aceder à plataforma?
                    </p>
                    <Link
                      to="/auth/super-admin-bootstrap"
                      className="text-blue-400 hover:text-blue-300 underline font-medium transition-colors inline-flex items-center gap-1"
                    >
                      Inicializar sistema e criar conta de super administrador
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 backdrop-blur-sm">
              <p className="text-xs text-amber-300 text-center leading-relaxed">
                Todas as ações administrativas são registadas e monitoradas por questões de segurança.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
