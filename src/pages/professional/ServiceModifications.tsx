import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Clock, Eye, FileText, Trash2, User, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/currency';

interface ServiceModification {
  id: string;
  service_id: string | null;
  service_title: string;
  professional_id: string;
  admin_id: string;
  action_type: 'edited' | 'deleted';
  changes_made: any;
  reason: string;
  created_at: string;
  admin: {
    full_name: string;
    avatar_url: string | null;
  };
}

export function ServiceModifications() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [modifications, setModifications] = useState<ServiceModification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'edited' | 'deleted'>('all');
  const [selectedModification, setSelectedModification] = useState<ServiceModification | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadModifications();
  }, [user]);

  const loadModifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('service_modifications_log')
        .select(`
          *,
          admin:profiles!service_modifications_log_admin_id_fkey(
            full_name,
            avatar_url
          )
        `)
        .eq('professional_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setModifications(data || []);
    } catch (error) {
      console.error('Error loading modifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredModifications = modifications.filter(mod => {
    if (filter === 'all') return true;
    return mod.action_type === filter;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderChangeDetail = (key: string, change: { from: any; to: any }) => {
    const formatValue = (value: any) => {
      if (key === 'price') return formatCurrency(value);
      if (key === 'images' && Array.isArray(value)) return `${value.length} imagens`;
      if (typeof value === 'object') return JSON.stringify(value);
      return value || '(vazio)';
    };

    const labels: Record<string, string> = {
      title: 'Título',
      description: 'Descrição',
      price: 'Preço',
      duration: 'Duração',
      category: 'Categoria',
      images: 'Imagens',
      whatsapp_number: 'WhatsApp'
    };

    return (
      <div key={key} className="py-3 border-b border-gray-200 last:border-0">
        <p className="text-sm font-semibold text-gray-700 mb-2">{labels[key] || key}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-red-50 p-3 rounded-md">
            <p className="text-xs text-red-600 font-medium mb-1">Antes</p>
            <p className="text-sm text-gray-900">{formatValue(change.from)}</p>
          </div>
          <div className="bg-green-50 p-3 rounded-md">
            <p className="text-xs text-green-600 font-medium mb-1">Depois</p>
            <p className="text-sm text-gray-900">{formatValue(change.to)}</p>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Histórico de Modificações</h1>
        <p className="mt-2 text-gray-600">
          Veja todas as alterações feitas aos seus serviços pelo Super Admin
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos ({modifications.length})
          </button>
          <button
            onClick={() => setFilter('edited')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'edited'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Editados ({modifications.filter(m => m.action_type === 'edited').length})
          </button>
          <button
            onClick={() => setFilter('deleted')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'deleted'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Eliminados ({modifications.filter(m => m.action_type === 'deleted').length})
          </button>
        </div>
      </div>

      {filteredModifications.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhuma modificação encontrada
          </h3>
          <p className="text-gray-600">
            {filter === 'all'
              ? 'Ainda não houve modificações nos seus serviços.'
              : `Não há serviços ${filter === 'edited' ? 'editados' : 'eliminados'}.`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Serviço
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ação
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Modificado Por
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredModifications.map((modification) => (
                  <tr key={modification.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 text-gray-400 mr-2" />
                        {formatDate(modification.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {modification.service_title}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {modification.action_type === 'edited' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Editado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <Trash2 className="h-3 w-3 mr-1" />
                          Eliminado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src={
                            modification.admin.avatar_url ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              modification.admin.full_name
                            )}&background=random`
                          }
                          alt={modification.admin.full_name}
                          className="h-8 w-8 rounded-full mr-3"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {modification.admin.full_name}
                          </div>
                          <div className="text-xs text-gray-500">Super Admin</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => setSelectedModification(modification)}
                        className="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedModification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Detalhes da Modificação</h3>
              <button
                onClick={() => setSelectedModification(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {selectedModification.action_type === 'edited' ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-bold text-gray-900 mb-1">
                      {selectedModification.action_type === 'edited' ? 'Serviço Editado' : 'Serviço Eliminado'}
                    </h4>
                    <p className="text-sm text-gray-700">
                      <strong>Serviço:</strong> {selectedModification.service_title}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      <strong>Data:</strong> {formatDate(selectedModification.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                  <User className="h-4 w-4 mr-2 text-blue-600" />
                  Modificado Por
                </h4>
                <div className="flex items-center bg-gray-50 rounded-lg p-3">
                  <img
                    src={
                      selectedModification.admin.avatar_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        selectedModification.admin.full_name
                      )}&background=random`
                    }
                    alt={selectedModification.admin.full_name}
                    className="h-12 w-12 rounded-full mr-3"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedModification.admin.full_name}
                    </p>
                    <p className="text-xs text-gray-500">Super Admin</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-blue-600" />
                  Razão
                </h4>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {selectedModification.reason}
                  </p>
                </div>
              </div>

              {selectedModification.action_type === 'edited' &&
               selectedModification.changes_made &&
               Object.keys(selectedModification.changes_made).length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3">
                    Alterações Realizadas
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    {Object.entries(selectedModification.changes_made).map(([key, change]: [string, any]) =>
                      renderChangeDetail(key, change)
                    )}
                  </div>
                </div>
              )}

              {selectedModification.action_type === 'deleted' && selectedModification.changes_made?.deleted_service && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3">
                    Informação do Serviço Eliminado
                  </h4>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                    {Object.entries(selectedModification.changes_made.deleted_service).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex justify-between py-2 border-b border-red-100 last:border-0">
                        <span className="text-sm font-medium text-gray-700 capitalize">{key}:</span>
                        <span className="text-sm text-gray-900">
                          {key === 'price' ? formatCurrency(value) : value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => setSelectedModification(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
