import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

export function Profile() {
  const { t } = useTranslation();
  const { user, profile, loadProfile } = useAuthStore();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [businessName, setBusinessName] = useState(profile?.business_name || '');
  const [businessDescription, setBusinessDescription] = useState(profile?.business_description || '');
  const [businessAddress, setBusinessAddress] = useState(profile?.business_address || '');
  const [businessPhone, setBusinessPhone] = useState(profile?.business_phone || '');
  const [saving, setSaving] = useState(false);
  const [validatingImage, setValidatingImage] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToastNotification = useCallback((message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }, []);

  const preloadImage = useCallback((url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        reject(new Error('Tempo esgotado ao carregar imagem'));
      }, 10000);

      img.onload = () => {
        clearTimeout(timeout);
        resolve();
      };

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Não foi possível carregar a imagem'));
      };

      img.src = url;
    });
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        await loadProfile();
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [loadProfile]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setAvatarUrl(profile.avatar_url || '');
      setBusinessName(profile.business_name || '');
      setBusinessDescription(profile.business_description || '');
      setBusinessAddress(profile.business_address || '');
      setBusinessPhone(profile.business_phone || '');
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleAddAvatarUrl = async () => {
    if (!avatarUrlInput.trim()) {
      setError('Por favor, insira uma URL válida');
      return;
    }

    try {
      new URL(avatarUrlInput);

      setValidatingImage(true);
      setError('');

      await preloadImage(avatarUrlInput);

      setAvatarUrl(avatarUrlInput);
      setAvatarUrlInput('');
      showToastNotification('Imagem adicionada com sucesso', 'success');
    } catch (err: any) {
      if (err.message.includes('Tempo esgotado')) {
        setError('A imagem demorou muito tempo a carregar. Verifique a URL e tente novamente.');
      } else if (err.message.includes('carregar a imagem')) {
        setError('Não foi possível carregar a imagem. Verifique se a URL está correta.');
      } else {
        setError('URL inválida. Por favor, insira uma URL completa (ex: https://exemplo.com/avatar.jpg)');
      }
    } finally {
      setValidatingImage(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    showToastNotification('Imagem removida com sucesso', 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id && !profile?.id) {
      setError('Usuário não autenticado');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { updateProfile } = useAuthStore.getState();

      await updateProfile({
        full_name: fullName,
        avatar_url: avatarUrl,
        business_name: businessName,
        business_description: businessDescription,
        business_address: businessAddress,
        business_phone: businessPhone,
      });

      showToastNotification('Perfil atualizado com sucesso', 'success');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      showToastNotification('Erro ao atualizar perfil. Tente novamente.', 'error');
      setError(err.message || 'Erro ao atualizar perfil');
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-8">Perfil</h1>

      <form onSubmit={handleSubmit} className="space-y-6 card-gradient p-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}
        {success && (
          <div className="rounded-md bg-green-50 p-4">
            <div className="text-sm text-green-700">{success}</div>
          </div>
        )}

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
            Nome Completo
          </label>
          <input
            type="text"
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input-glow mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            O seu nome pessoal
          </p>
        </div>

        {profile?.role === 'professional' && (
          <>
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Dados do Estabelecimento</h3>
              <p className="text-sm text-gray-600 mb-4">
                Estas informacoes aparecerao nos cartoes dos seus servicos
              </p>
            </div>

            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">
                Nome do Estabelecimento
              </label>
              <input
                type="text"
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="input-glow mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
                placeholder="Ex: Salao Beleza Pura"
              />
              <p className="mt-1 text-xs text-gray-500">
                O nome do seu salao/estabelecimento que aparecera nos servicos
              </p>
            </div>

            <div>
              <label htmlFor="businessDescription" className="block text-sm font-medium text-gray-700">
                Descricao do Estabelecimento
              </label>
              <textarea
                id="businessDescription"
                rows={3}
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                className="input-glow mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
                placeholder="Descreva o seu estabelecimento..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Uma breve descricao sobre o seu negocio
              </p>
            </div>

            <div>
              <label htmlFor="businessAddress" className="block text-sm font-medium text-gray-700">
                Morada do Estabelecimento
              </label>
              <input
                type="text"
                id="businessAddress"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                className="input-glow mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
                placeholder="Rua, Numero, Cidade"
              />
              <p className="mt-1 text-xs text-gray-500">
                A morada fisica do seu estabelecimento
              </p>
            </div>

            <div>
              <label htmlFor="businessPhone" className="block text-sm font-medium text-gray-700">
                Telefone de Contacto
              </label>
              <input
                type="tel"
                id="businessPhone"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
                className="input-glow mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
                placeholder="+351 912 345 678"
              />
              <p className="mt-1 text-xs text-gray-500">
                Numero de telefone para contacto direto (nacional ou internacional)
              </p>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Foto de Perfil
          </label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={avatarUrlInput}
              onChange={(e) => setAvatarUrlInput(e.target.value)}
              placeholder="Cole a URL da imagem (ex: https://exemplo.com/avatar.jpg)"
              className="input-glow flex-1 rounded-md border border-gray-300 px-3 py-2 sm:text-sm"
            />
            <button
              type="button"
              onClick={handleAddAvatarUrl}
              disabled={validatingImage}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validatingImage ? 'A validar...' : 'Adicionar'}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Insira a URL completa de uma imagem hospedada online
          </p>
        </div>

        {avatarUrl && (
          <div className="relative inline-block">
            <img
              src={avatarUrl}
              alt="Pré-visualização"
              className="mt-2 h-20 w-20 rounded-full object-cover"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.src = 'https://via.placeholder.com/80?text=Error';
              }}
            />
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="absolute -top-2 -right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={saving}
            className="btn-gradient w-full disabled:opacity-50"
          >
            {saving ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
      </form>

      {showToast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
            toastType === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}>
            {toastType === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span className="font-medium">{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}