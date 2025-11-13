import { useEffect, useState } from 'react';
import { Mail, Inbox, Archive, Trash2, Tag, User, Clock, Search, Filter, CheckCircle, X, ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

interface ContactMessage {
  id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'archived';
  category_tag: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  read_at: string | null;
  assigned_profile?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface MessageCategory {
  value: string;
  name: string;
  color: string;
}

const categoryColors: Record<string, string> = {
  general: 'bg-blue-100 text-blue-800 border-blue-200',
  support: 'bg-orange-100 text-orange-800 border-orange-200',
  professional: 'bg-green-100 text-green-800 border-green-200',
  partnership: 'bg-purple-100 text-purple-800 border-purple-200',
  other: 'bg-gray-100 text-gray-800 border-gray-200'
};

export function SuperAdminEmails() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [categories, setCategories] = useState<MessageCategory[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'read' | 'archived'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAssignment, setFilterAssignment] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
    loadMessages();
    subscribeToMessages();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('message_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contact_messages')
        .select(`
          *,
          assigned_profile:profiles!contact_messages_assigned_to_fkey(
            full_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel('contact_messages_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_messages'
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const handleMessageClick = async (message: ContactMessage) => {
    setSelectedMessage(message);

    if (message.status === 'unread') {
      try {
        const { error } = await supabase
          .from('contact_messages')
          .update({
            status: 'read',
            read_at: new Date().toISOString()
          })
          .eq('id', message.id);

        if (error) throw error;

        setMessages(messages.map(m =>
          m.id === message.id
            ? { ...m, status: 'read', read_at: new Date().toISOString() }
            : m
        ));
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    }
  };

  const handleToggleStatus = async (messageId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'read' ? 'unread' : 'read';

    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({
          status: newStatus,
          read_at: newStatus === 'read' ? new Date().toISOString() : null
        })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(messages.map(m =>
        m.id === messageId
          ? { ...m, status: newStatus as 'read' | 'unread', read_at: newStatus === 'read' ? new Date().toISOString() : null }
          : m
      ));

      if (selectedMessage?.id === messageId) {
        setSelectedMessage({ ...selectedMessage, status: newStatus as 'read' | 'unread' });
      }
    } catch (error) {
      console.error('Error toggling message status:', error);
    }
  };

  const handleArchive = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ status: 'archived' })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(messages.map(m =>
        m.id === messageId ? { ...m, status: 'archived' } : m
      ));

      if (selectedMessage?.id === messageId) {
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Error archiving message:', error);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      setMessages(messages.filter(m => m.id !== messageId));

      if (selectedMessage?.id === messageId) {
        setSelectedMessage(null);
      }

      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleAssignToMe = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ assigned_to: user?.id })
        .eq('id', messageId);

      if (error) throw error;

      loadMessages();
    } catch (error) {
      console.error('Error assigning message:', error);
    }
  };

  const filteredMessages = messages.filter(message => {
    if (filterStatus !== 'all' && message.status !== filterStatus) return false;
    if (filterCategory !== 'all' && message.category_tag !== filterCategory) return false;
    if (filterAssignment === 'assigned' && !message.assigned_to) return false;
    if (filterAssignment === 'unassigned' && message.assigned_to) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        message.sender_name.toLowerCase().includes(query) ||
        message.sender_email.toLowerCase().includes(query) ||
        message.subject.toLowerCase().includes(query) ||
        message.message.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const unreadCount = messages.filter(m => m.status === 'unread').length;
  const myMessagesCount = messages.filter(m => m.assigned_to === user?.id).length;

  const getCategoryName = (value: string) => {
    const category = categories.find(c => c.value === value);
    return category?.name || value;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Mail className="h-8 w-8 mr-3 text-blue-600" />
            Mensagens de Contacto
          </h1>
          <p className="mt-2 text-gray-600">Gerir todas as mensagens recebidas através do formulário de contacto</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total de Mensagens</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">{messages.length}</p>
            </div>
            <Inbox className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Não Lidas</p>
              <p className="mt-1 text-2xl font-bold text-orange-900">{unreadCount}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Atribuídas a Mim</p>
              <p className="mt-1 text-2xl font-bold text-green-900">{myMessagesCount}</p>
            </div>
            <User className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar mensagens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos os Estados</option>
                <option value="unread">Não Lidas</option>
                <option value="read">Lidas</option>
                <option value="archived">Arquivadas</option>
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todas as Categorias</option>
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                value={filterAssignment}
                onChange={(e) => setFilterAssignment(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todas</option>
                <option value="assigned">Atribuídas</option>
                <option value="unassigned">Não Atribuídas</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
          <div className="overflow-y-auto max-h-[600px]">
            {filteredMessages.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Mail className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>Nenhuma mensagem encontrada</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredMessages.map((message) => (
                  <div
                    key={message.id}
                    onClick={() => handleMessageClick(message)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedMessage?.id === message.id ? 'bg-blue-50' : ''
                    } ${message.status === 'unread' ? 'bg-blue-50/30' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {message.status === 'unread' && (
                            <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                          )}
                          <h3 className={`text-sm font-semibold text-gray-900 truncate ${
                            message.status === 'unread' ? 'font-bold' : ''
                          }`}>
                            {message.sender_name}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{message.sender_email}</p>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {new Date(message.created_at).toLocaleDateString('pt-PT', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                        categoryColors[message.category_tag] || categoryColors.other
                      }`}>
                        <Tag className="h-3 w-3 mr-1" />
                        {getCategoryName(message.category_tag)}
                      </span>

                      {message.assigned_to && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                          <User className="h-3 w-3 mr-1" />
                          Atribuída
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-700 line-clamp-2">
                      {message.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 overflow-y-auto max-h-[600px]">
            {selectedMessage ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {selectedMessage.sender_name}
                    </h2>
                    <a
                      href={`mailto:${selectedMessage.sender_email}`}
                      className="text-blue-600 hover:text-blue-700 flex items-center text-sm"
                    >
                      {selectedMessage.sender_email}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                    categoryColors[selectedMessage.category_tag] || categoryColors.other
                  }`}>
                    <Tag className="h-4 w-4 mr-1" />
                    {getCategoryName(selectedMessage.category_tag)}
                  </span>

                  {selectedMessage.assigned_to && selectedMessage.assigned_profile && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                      <User className="h-4 w-4 mr-1" />
                      {selectedMessage.assigned_profile.full_name}
                    </span>
                  )}

                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 border border-gray-200">
                    <Clock className="h-4 w-4 mr-1" />
                    {new Date(selectedMessage.created_at).toLocaleDateString('pt-PT', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Mensagem</h3>
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedMessage.message}</p>
                </div>

                <div className="flex gap-2 flex-wrap pt-4 border-t border-gray-200">
                  {!selectedMessage.assigned_to && (
                    <button
                      onClick={() => handleAssignToMe(selectedMessage.id)}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <User className="h-4 w-4 mr-2" />
                      Atribuir a Mim
                    </button>
                  )}

                  <button
                    onClick={() => handleToggleStatus(selectedMessage.id, selectedMessage.status)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {selectedMessage.status === 'read' ? 'Marcar Não Lida' : 'Marcar Lida'}
                  </button>

                  {selectedMessage.status !== 'archived' && (
                    <button
                      onClick={() => handleArchive(selectedMessage.id)}
                      className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Arquivar
                    </button>
                  )}

                  <button
                    onClick={() => setDeleteConfirm(selectedMessage.id)}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Mail className="h-16 w-16 mb-4 text-gray-400" />
                <p className="text-lg font-medium">Selecione uma mensagem</p>
                <p className="text-sm">Escolha uma mensagem da lista para visualizar os detalhes</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirmar Exclusão</h3>
            <p className="text-gray-600 mb-6">
              Tem certeza que deseja eliminar esta mensagem? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
