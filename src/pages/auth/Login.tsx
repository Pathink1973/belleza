import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Scissors, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await login(email, password);

      if (user.role === 'professional') {
        navigate('/professional/dashboard', { replace: true });
      } else {
        navigate('/services', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 py-8 sm:py-12 px-3 sm:px-4">
      <div className="max-w-md w-full space-y-6 sm:space-y-8 bg-white p-6 sm:p-8 rounded-2xl shadow-xl">
        <div>
          <Link
            to="/services"
            className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar aos Serviços
          </Link>

          <div className="flex flex-col items-center">
            <img
              src="/icons/belleza-logo.svg"
              alt="Belleza"
              className="h-6 sm:h-9 w-auto mb-3 sm:mb-4"
            />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mt-4 sm:mt-6">
              Bem-vindo de Volta
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Não tem uma conta?{' '}
              <Link to="/auth/register" className="font-medium text-blue-600 hover:text-blue-500">
                Registar-se
              </Link>
            </p>
            <p className="mt-1 text-center text-xs text-gray-500">
              Escolha entre conta de Cliente ou Profissional
            </p>
          </div>
        </div>

        <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-3 sm:p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div className="space-y-3 sm:space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                className="input-glow mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Palavra-passe
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-glow block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'A entrar...' : 'Entrar'}
          </button>

          <div className="mt-4">
            <Link
              to="/auth/admin-login"
              className="flex justify-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Área Administrativa
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}