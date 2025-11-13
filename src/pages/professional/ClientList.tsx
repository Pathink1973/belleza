import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ptLocale } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/currency';
import {
  User,
  Calendar,
  DollarSign,
  Star,
  Search,
  AlertCircle,
  CheckCircle,
  XCircle,
  Plus,
  Loader,
  Phone,
  MessageSquare,
  Clock,
  Edit2,
  Trash2
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
  mobile_number: string;
  notes: Array<{
    id: string;
    note: string;
    created_at: string;
  }>;
  last_visit?: string;
}

interface NewClient {
  name: string;
  mobile_number: string;
  service: string;
  notes: string;
}

export function ClientList() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [showClientNotes, setShowClientNotes] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteConfirmClient, setDeleteConfirmClient] = useState<string | null>(null);
  const [newClient, setNewClient] = useState<NewClient>({
    name: '',
    mobile_number: '',
    service: '',
    notes: ''
  });
  const [services, setServices] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    if (profile?.id) {
      fetchClients();
      fetchServices();
    }
  }, [profile?.id]);

  const fetchClients = async () => {
    if (!profile?.id) return;

    try {
      setError('');
      
      // First get all client notes
      const { data: clientNotes, error: notesError } = await supabase
        .from('client_notes')
        .select(`
          id,
          client_id,
          note,
          created_at
        `)
        .eq('professional_id', profile.id)
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;

      // Get all bookings to find last visits
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          client_id,
          start_time
        `)
        .eq('professional_id', profile.id)
        .order('start_time', { ascending: false });

      if (bookingsError) throw bookingsError;

      // Group notes and find last visits by client
      const clientsMap = new Map<string, Client>();
      
      // Process client notes
      if (clientNotes) {
        clientNotes.forEach(note => {
          if (!note.client_id) return; // Skip notes without client_id
          
          const existingClient = clientsMap.get(note.client_id);
          if (existingClient) {
            existingClient.notes.push({
              id: note.id,
              note: note.note,
              created_at: note.created_at
            });
          } else {
            // Try to extract name and mobile number from the first note
            const noteLines = note.note.split('\n');
            let name = '';
            let mobile = '';
            
            noteLines.forEach(line => {
              if (line.startsWith('Novo cliente:')) {
                name = line.replace('Novo cliente:', '').trim();
              } else if (line.startsWith('Telemóvel:')) {
                mobile = line.replace('Telemóvel:', '').trim();
              }
            });

            clientsMap.set(note.client_id, {
              id: note.client_id,
              name: name,
              mobile_number: mobile,
              notes: [{
                id: note.id,
                note: note.note,
                created_at: note.created_at
              }]
            });
          }
        });
      }

      // Add last visit dates
      if (bookings) {
        bookings.forEach(booking => {
          if (!booking.client_id) return; // Skip bookings without client_id
          
          const client = clientsMap.get(booking.client_id);
          if (client) {
            if (!client.last_visit || new Date(client.last_visit) < new Date(booking.start_time)) {
              client.last_visit = booking.start_time;
            }
          }
        });
      }

      setClients(Array.from(clientsMap.values()));
    } catch (err: any) {
      console.error('Error fetching clients:', err);
      console.error('Error details:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint
      });
      setError('Falha ao carregar lista de clientes');
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    if (!profile?.id) return;

    try {
      const { data, error: servicesError } = await supabase
        .from('services')
        .select('id, title')
        .eq('professional_id', profile.id);

      if (servicesError) throw servicesError;
      setServices(data || []);
    } catch (err) {
      console.error('Error fetching services:', err);
    }
  };

  const handleNewClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      if (!profile?.id) {
        throw new Error('Não autorizado');
      }

      // Validate mobile number format
      if (!/^\+?[1-9]\d{1,14}$/.test(newClient.mobile_number)) {
        throw new Error('Formato de número de telemóvel inválido');
      }

      // Generate a unique client ID
      const clientId = crypto.randomUUID();

      // Create the guest client profile (no auth account)
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: clientId,
          full_name: newClient.name,
          role: 'client',
          mobile_number: newClient.mobile_number,
          is_guest: true
        }]);

      if (profileError) throw profileError;

      // Create client note with structured information
      const noteContent = [
        `Novo cliente: ${newClient.name}`,
        `Telemóvel: ${newClient.mobile_number}`,
        newClient.service ? `Serviço de interesse: ${services.find(s => s.id === newClient.service)?.title}` : '',
        newClient.notes ? `\nNotas adicionais:\n${newClient.notes}` : ''
      ].filter(Boolean).join('\n');

      const { data: noteData, error: noteError } = await supabase
        .from('client_notes')
        .insert({
          client_id: clientId,
          professional_id: profile.id,
          note: noteContent,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (noteError) throw noteError;

      setSuccess(t('clients.success.clientAdded'));
      setNewClient({
        name: '',
        mobile_number: '',
        service: '',
        notes: ''
      });
      setShowNewClientForm(false);
      fetchClients();
    } catch (err: any) {
      console.error('Error adding client:', err);
      console.error('Error details:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint
      });
      const errorMessage = err?.message || err?.details || 'Ocorreu um erro ao adicionar o cliente';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async (clientId: string, note: string) => {
    try {
      const { error: noteError } = await supabase
        .from('client_notes')
        .insert({
          client_id: clientId,
          professional_id: profile?.id,
          note
        });

      if (noteError) throw noteError;

      setSuccess('Nota adicionada com sucesso!');
      fetchClients();
    } catch (err) {
      console.error('Error adding note:', err);
      setError('Erro ao adicionar nota');
    }
  };

  const handleUpdateClient = async () => {
    if (!editingClient) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: editingClient.name,
          mobile_number: editingClient.mobile_number
        })
        .eq('id', editingClient.id);

      if (updateError) throw updateError;

      setSuccess(t('clients.success.clientUpdated'));
      setEditingClient(null);
      fetchClients();
    } catch (err: any) {
      console.error('Error updating client:', err);
      setError(err.message || 'Erro ao atualizar cliente');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const { error: notesDeleteError } = await supabase
        .from('client_notes')
        .delete()
        .eq('client_id', clientId);

      if (notesDeleteError) throw notesDeleteError;

      const { error: profileDeleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', clientId);

      if (profileDeleteError) throw profileDeleteError;

      setSuccess(t('clients.success.clientUpdated'));
      setDeleteConfirmClient(null);
      fetchClients();
    } catch (err: any) {
      console.error('Error deleting client:', err);
      setError(err.message || 'Erro ao remover cliente');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{t('clients.title')}</h1>
        <button
          onClick={() => setShowNewClientForm(true)}
          className="btn-gradient inline-flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          {t('clients.addClient')}
        </button>
      </div>

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

      {editingClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">{t('common.edit')} {t('auth.client')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome</label>
                <input
                  type="text"
                  required
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Telemóvel</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={editingClient.mobile_number}
                    onChange={(e) => setEditingClient({ ...editingClient, mobile_number: e.target.value })}
                    className="block w-full pl-10 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateClient}
                  className="btn-gradient inline-flex items-center"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader className="animate-spin h-5 w-5 mr-2" />
                      Atualizando...
                    </>
                  ) : (
                    'Atualizar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 text-red-600">Confirmar Remoção</h2>
            <p className="text-gray-700 mb-6">
              Tem certeza que deseja remover este cliente? Esta ação não pode ser desfeita e todas as notas do cliente serão permanentemente removidas.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmClient(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteClient(deleteConfirmClient)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 inline-flex items-center"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader className="animate-spin h-5 w-5 mr-2" />
                    Removendo...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-5 w-5 mr-2" />
                    Remover
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewClientForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-t-2xl">
              <h2 className="text-2xl font-bold">{t('clients.addClient')}</h2>
              <p className="text-blue-100 text-sm mt-1">Preencha os dados do cliente</p>
            </div>

            <form onSubmit={handleNewClientSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-all px-4 py-3 text-gray-900 placeholder-gray-400"
                  placeholder="Nome completo do cliente"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Telemóvel
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-blue-500" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={newClient.mobile_number}
                    onChange={(e) => setNewClient({ ...newClient, mobile_number: e.target.value })}
                    placeholder="+351912345678"
                    className="block w-full pl-12 pr-4 py-3 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-all text-gray-900 placeholder-gray-400"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500 flex items-center">
                  <AlertCircle className="h-3.5 w-3.5 mr-1" />
                  Digite o número com código do país (ex: +351912345678)
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Serviço de Interesse
                </label>
                <select
                  value={newClient.service}
                  onChange={(e) => setNewClient({ ...newClient, service: e.target.value })}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-all px-4 py-3 text-gray-900"
                >
                  <option value="">Selecione um serviço (opcional)</option>
                  {services.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notas
                </label>
                <textarea
                  value={newClient.notes}
                  onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
                  rows={4}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-all px-4 py-3 text-gray-900 placeholder-gray-400 resize-none"
                  placeholder="Adicione notas sobre o cliente, preferências, etc."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewClientForm(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center shadow-lg shadow-blue-500/30"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader className="animate-spin h-5 w-5 mr-2" />
                      Adicionando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5 mr-2" />
                      Adicionar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {clients.map((client) => (
          <div key={client.id} className="card-gradient p-6 hover:border-blue-300 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
                    <User className="h-7 w-7 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {client.name}
                  </h3>
                  <div className="flex items-center text-gray-600">
                    <Phone className="h-4 w-4 mr-2 text-blue-500" />
                    <p className="text-sm font-medium">
                      {client.mobile_number}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditingClient(client)}
                  className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  title="Editar cliente"
                >
                  <Edit2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setDeleteConfirmClient(client.id)}
                  className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title="Apagar cliente"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setShowClientNotes(showClientNotes === client.id ? null : client.id)}
                  className={`p-2.5 rounded-lg transition-all ${
                    showClientNotes === client.id
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                  title="Ver notas"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
              </div>
            </div>

            {client.last_visit && (
              <div className="flex items-center bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 rounded-lg">
                <div className="flex items-center justify-center h-10 w-10 bg-white rounded-lg shadow-sm mr-3">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Última Visita</p>
                  <p className="text-sm font-medium text-gray-700">
                    {format(new Date(client.last_visit), 'PPP', {
                      locale: ptLocale
                    })}
                  </p>
                </div>
              </div>
            )}

            {showClientNotes === client.id && (
              <div className="mt-6 space-y-4 animate-slide-up">
                <div className="border-t border-blue-100 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                    <h4 className="font-bold text-gray-900">Notas</h4>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                      {client.notes.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {client.notes.map((note) => (
                      <div key={note.id} className="bg-gradient-to-br from-gray-50 to-blue-50/30 p-4 rounded-lg border border-gray-100 hover:border-blue-200 transition-all">
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{note.note}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <p className="text-xs text-gray-500 font-medium">
                            {format(new Date(note.created_at), 'PPp', {
                              locale: ptLocale
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Adicionar nova nota..."
                    className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 text-sm placeholder-gray-400"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        if (input.value.trim()) {
                          handleAddNote(client.id, input.value);
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => setShowClientNotes(null)}
                    className="px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-all"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {clients.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Nenhum cliente encontrado
            </h3>
            <p className="mt-2 text-gray-500">
              {search ? 'Tente ajustar sua busca' : 'Sua lista de clientes aparecerá aqui'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}