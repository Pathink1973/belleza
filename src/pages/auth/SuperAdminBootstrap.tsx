import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Eye, EyeOff, ArrowLeft, Check, X, AlertTriangle } from 'lucide-react';
import { checkSuperAdminExists, registerSuperAdmin } from '../../lib/auth';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

export function SuperAdminBootstrap() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSystem, setCheckingSystem] = useState(true);
  const [systemInitialized, setSystemInitialized] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSystem = async () => {
      try {
        const exists = await checkSuperAdminExists();
        setSystemInitialized(exists);

        if (exists) {
          setTimeout(() => {
            navigate('/auth/admin-login', { replace: true });
          }, 3000);
        }
      } catch (error) {
        console.error('Error checking system:', error);
        setError('Erro ao verificar estado do sistema');
      } finally {
        setCheckingSystem(false);
      }
    };

    checkSystem();
  }, [navigate]);

  const calculatePasswordStrength = (pwd: string): PasswordStrength => {
    let score = 0;

    if (pwd.length >= 12) score++;
    if (pwd.length >= 16) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, label: 'Fraca', color: 'bg-red-500' };
    if (score <= 3) return { score, label: 'Média', color: 'bg-yellow-500' };
    if (score <= 4) return { score, label: 'Forte', color: 'bg-green-500' };
    return { score, label: 'Muito Forte', color: 'bg-green-600' };
  };

  const passwordStrength = calculatePasswordStrength(password);

  const passwordRequirements = [
    { met: password.length >= 12, label: 'Mínimo 12 caracteres' },
    { met: /[A-Z]/.test(password), label: 'Pelo menos uma maiúscula' },
    { met: /[a-z]/.test(password), label: 'Pelo menos uma minúscula' },
    { met: /\d/.test(password), label: 'Pelo menos um número' },
    { met: /[^a-zA-Z0-9]/.test(password), label: 'Pelo menos um caractere especial' }
  ];

  const isFormValid = () => {
    return (
      email.includes('@') &&
      fullName.trim().length > 0 &&
      password.length >= 12 &&
      password === confirmPassword &&
      passwordRequirements.every(req => req.met)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const confirmAndCreate = async () => {
    setShowConfirmModal(false);
    setError('');
    setIsLoading(true);

    try {
      const result = await registerSuperAdmin(email, password, fullName);

      if (!result.success) {
        setError(result.error || 'Erro ao criar conta de super administrador');
        setIsLoading(false);
        return;
      }

      navigate('/auth/admin-login', {
        replace: true,
        state: { message: 'Super administrador criado com sucesso! Faça login para continuar.' }
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta de super administrador');
      setIsLoading(false);
    }
  };

  if (checkingSystem) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-400">A verificar estado do sistema...</p>
        </div>
      </div>
    );
  }

  if (systemInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
        <div className="max-w-md w-full space-y-8 bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700 text-center">
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
              <Check className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Sistema Já Inicializado
            </h1>
            <p className="text-gray-400">
              A plataforma já possui um super administrador configurado.
            </p>
            <p className="text-sm text-gray-500 mt-4">
              A redirecionar para o login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
      <div className="max-w-2xl w-full space-y-8 bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div>
          <Link
            to="/auth/admin-login"
            className="inline-flex items-center text-sm text-gray-400 hover:text-gray-200 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar ao Login Administrativo
          </Link>

          <div className="flex flex-col items-center">
            <div className="h-16 w-16 bg-red-600 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">
              Inicialização do Sistema
            </h1>
            <h2 className="text-xl font-semibold text-gray-300 mt-4">
              Criar Conta de Super Administrador
            </h2>
            <p className="mt-2 text-center text-sm text-gray-400 max-w-lg">
              Este processo permite criar a primeira conta de super administrador da plataforma.
              Esta operação só pode ser realizada uma vez.
            </p>
          </div>
        </div>

        <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-yellow-200">
              <p className="font-semibold mb-1">Atenção: Operação Crítica</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Esta conta terá acesso total à plataforma</li>
                <li>Poderá gerenciar todos os utilizadores e serviços</li>
                <li>Todas as ações são registadas para auditoria</li>
                <li>Use uma palavra-passe forte e única</li>
              </ul>
            </div>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-900 border border-red-700 p-4">
              <div className="text-sm text-red-200">{error}</div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="full-name" className="block text-sm font-medium text-gray-300">
                Nome Completo
              </label>
              <input
                id="full-name"
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 placeholder-gray-400"
                placeholder="Nome do administrador"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-gray-300">
                Email Administrativo
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="username"
                className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 placeholder-gray-400"
                placeholder="admin@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-gray-300">
                Palavra-passe
              </label>
              <div className="mt-1 relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  className="block w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 pr-10 placeholder-gray-400"
                  placeholder="Mínimo 12 caracteres"
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

              {password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">Força da palavra-passe:</span>
                    <span className={`text-xs font-medium ${
                      passwordStrength.score <= 2 ? 'text-red-400' :
                      passwordStrength.score <= 3 ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${passwordStrength.color}`}
                      style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {password && (
              <div className="bg-gray-700 rounded-md p-3">
                <p className="text-xs text-gray-400 mb-2">Requisitos da palavra-passe:</p>
                <div className="space-y-1">
                  {passwordRequirements.map((req, index) => (
                    <div key={index} className="flex items-center text-xs">
                      {req.met ? (
                        <Check className="h-3 w-3 text-green-400 mr-2" />
                      ) : (
                        <X className="h-3 w-3 text-gray-500 mr-2" />
                      )}
                      <span className={req.met ? 'text-green-400' : 'text-gray-500'}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300">
                Confirmar Palavra-passe
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  className="block w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 pr-10 placeholder-gray-400"
                  placeholder="Confirme a palavra-passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-400">As palavras-passe não coincidem</p>
              )}
              {confirmPassword && password === confirmPassword && (
                <p className="mt-1 text-xs text-green-400 flex items-center">
                  <Check className="h-3 w-3 mr-1" />
                  Palavras-passe coincidem
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !isFormValid()}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'A criar conta...' : 'Criar Conta de Super Administrador'}
          </button>
        </form>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-700">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-yellow-400 mr-3" />
              <h3 className="text-lg font-semibold text-white">Confirmar Criação</h3>
            </div>
            <p className="text-gray-300 mb-6">
              Tem a certeza que deseja criar esta conta de super administrador?
              Esta ação não pode ser desfeita e bloqueará futuras criações através do bootstrap.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAndCreate}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
