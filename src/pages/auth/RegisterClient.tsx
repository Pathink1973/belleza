import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Scissors, Eye, EyeOff, ArrowLeft, UserCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export function RegisterClient() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await register(email, password, fullName, phone || undefined, 'client');
      navigate('/services', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 py-8 sm:py-12 px-3 sm:px-4">
      <div className="max-w-md w-full space-y-6 sm:space-y-8 bg-white p-6 sm:p-8 rounded-2xl shadow-xl">
        <div>
          <Link
            to="/auth/register"
            className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar à Seleção
          </Link>

          <div className="flex flex-col items-center">
            <img
              src="/icons/belleza-logo.svg"
              alt="Belleza"
              className="h-8 sm:h-12 w-auto mb-3 sm:mb-4"
            />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mt-4 sm:mt-6">
              Criar Conta de Cliente
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Já tem uma conta?{' '}
              <Link to="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
                Entrar
              </Link>
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
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Nome Completo
              </label>
              <input
                id="fullName"
                type="text"
                required
                className="input-glow mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Seu nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                className="input-glow mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Telemóvel <span className="text-gray-400 text-xs">(opcional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                className="input-glow mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="+351 900 000 000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                Para receber notificações sobre as suas reservas
              </p>
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
                  minLength={6}
                  className="input-glow block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm pr-10 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              Como Cliente, você poderá:
            </h3>
            <ul className="space-y-1 text-sm text-blue-800">
              <li className="flex items-start">
                <svg className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Descobrir e reservar serviços
              </li>
              <li className="flex items-start">
                <svg className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Gerir as suas reservas
              </li>
              <li className="flex items-start">
                <svg className="h-4 w-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Avaliar profissionais
              </li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isLoading ? 'A criar conta...' : 'Criar Conta de Cliente'}
          </button>

          <p className="text-xs text-center text-gray-500 mt-4">
            Ao criar uma conta, concorda com os nossos{' '}
            <Link to="/terms" className="text-blue-600 hover:text-blue-500">
              Termos de Serviço
            </Link>{' '}
            e{' '}
            <Link to="/cookies" className="text-blue-600 hover:text-blue-500">
              Política de Privacidade
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
