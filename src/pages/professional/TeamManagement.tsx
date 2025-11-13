import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Users, Plus, Trash2, AlertCircle, User } from 'lucide-react';

interface TeamMember {
  id: string;
  service_id: string;
  name: string;
  photo_url: string | null;
  display_order: number;
  created_at: string;
  service: {
    title: string;
  };
}

interface Service {
  id: string;
  title: string;
}

export function TeamManagement() {
  const { profile } = useAuthStore();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (profile?.id) {
      loadServices();
    }
  }, [profile?.id]);

  useEffect(() => {
    if (selectedServiceId) {
      loadTeamMembers();
    }
  }, [selectedServiceId]);

  const loadServices = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, title')
        .eq('professional_id', profile.id)
        .order('title');

      if (error) throw error;
      setServices(data || []);

      if (data && data.length > 0) {
        setSelectedServiceId(data[0].id);
      }
    } catch (err) {
      console.error('Error loading services:', err);
      setError('Erro ao carregar serviços');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    if (!selectedServiceId) return;

    try {
      const { data, error } = await supabase
        .from('service_team_members')
        .select(`
          *,
          service:services(title)
        `)
        .eq('service_id', selectedServiceId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (err) {
      console.error('Error loading team members:', err);
      setError('Erro ao carregar colaboradores');
    }
  };

  const handleAddTeamMember = async () => {
    if (!selectedServiceId) return;

    const name = prompt('Nome do colaborador:');
    if (!name || !name.trim()) return;

    const photoUrl = prompt('URL da foto do colaborador (opcional):');

    setAdding(true);
    setError('');
    setSuccess('');

    try {
      const maxDisplayOrder = teamMembers.length > 0
        ? Math.max(...teamMembers.map(m => m.display_order))
        : 0;

      const { error } = await supabase
        .from('service_team_members')
        .insert({
          service_id: selectedServiceId,
          name: name.trim(),
          photo_url: photoUrl?.trim() || null,
          display_order: maxDisplayOrder + 1
        });

      if (error) throw error;

      setSuccess(`${name} foi adicionado(a) à equipa com sucesso!`);
      loadTeamMembers();
    } catch (err: any) {
      console.error('Error adding team member:', err);
      setError(err.message || 'Erro ao adicionar colaborador');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveTeamMember = async (memberId: string) => {
    if (!confirm('Tem certeza que deseja remover este colaborador da equipa?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('service_team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      setSuccess('Colaborador removido com sucesso');
      loadTeamMembers();
    } catch (err) {
      console.error('Error removing team member:', err);
      setError('Erro ao remover colaborador');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum Serviço Disponível</h3>
        <p className="text-gray-600 mb-6">Precisa de criar um serviço antes de adicionar colaboradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gestão de Colaboradores</h1>
        <p className="text-gray-600 mt-2">Adicione profissionais à sua equipa para expandir a disponibilidade dos seus serviços</p>
      </div>

      <div className="card-gradient p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecionar Serviço
          </label>
          <select
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {services.map(service => (
              <option key={service.id} value={service.id}>
                {service.title}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-4 flex items-start">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-4 mb-4 flex items-start">
            <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 mr-3" />
            <div className="text-sm text-green-700">{success}</div>
          </div>
        )}
      </div>

      <div className="card-gradient p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <Users className="h-6 w-6 mr-3 text-blue-600" />
            Equipa Atual
            <span className="ml-3 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
              {teamMembers.length} {teamMembers.length === 1 ? 'Membro' : 'Membros'}
            </span>
          </h3>
          <button
            onClick={handleAddTeamMember}
            disabled={adding}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Adicionar Membro
          </button>
        </div>

        {teamMembers.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-100 rounded-full h-24 w-24 flex items-center justify-center mx-auto mb-4">
              <User className="h-12 w-12 text-gray-300" />
            </div>
            <p className="text-lg font-medium text-gray-500 mb-1">Nenhum colaborador adicionado ainda</p>
            <p className="text-sm text-gray-400">Clique no botão "Adicionar Membro" para começar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamMembers.map(member => (
              <div
                key={member.id}
                className="relative p-5 rounded-xl border-2 bg-white border-gray-200 hover:border-blue-200 hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="relative">
                      <img
                        src={member.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`}
                        alt={member.name}
                        className="h-16 w-16 rounded-full object-cover border-3 border-white shadow-md"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-bold text-gray-900 truncate">
                        {member.name}
                      </h4>
                      <p className="text-sm text-gray-500">Ordem: {member.display_order}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveTeamMember(member.id)}
                    className="ml-2 p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-all hover:scale-110"
                    title="Remover da equipa"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-gradient p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-semibold mb-2">Como funciona:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Adicione membros da equipa para apresentar os colaboradores do seu serviço</li>
              <li>Os membros aparecem na página de detalhes do serviço para os clientes</li>
              <li>Pode definir a ordem de exibição através do campo "display_order"</li>
              <li>As fotos dos membros ajudam os clientes a conhecer a equipa</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
