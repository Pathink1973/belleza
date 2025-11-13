import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, Filter, Calendar, AlertCircle } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

type FilterType = 'all' | 'unread' | 'read' | 'booking' | 'system';

export function Notifications() {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.read;
    if (filter === 'read') return notification.read;
    if (filter === 'booking' || filter === 'system') return notification.type === filter;
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return <Calendar className="h-5 w-5 text-blue-600" />;
      case 'review':
        return <AlertCircle className="h-5 w-5 text-green-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-600" />;
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notificações</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              Você tem {unreadCount} {unreadCount === 1 ? 'notificação não lida' : 'notificações não lidas'}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Marcar todas como lidas
          </button>
        )}
      </div>

      <div className="card-gradient p-4">
        <div className="flex items-center space-x-2 overflow-x-auto">
          <Filter className="h-5 w-5 text-gray-500 flex-shrink-0" />
          <div className="flex space-x-2">
            {[
              { value: 'all', label: 'Todas' },
              { value: 'unread', label: 'Não lidas' },
              { value: 'read', label: 'Lidas' },
              { value: 'booking', label: 'Reservas' },
              { value: 'system', label: 'Sistema' }
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value as FilterType)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
                {value === 'unread' && unreadCount > 0 && (
                  <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="card-gradient p-12 text-center">
          <Bell className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {filter === 'all' ? 'Sem notificações' : 'Nenhuma notificação encontrada'}
          </h3>
          <p className="text-gray-500">
            {filter === 'all'
              ? 'Você não tem notificações no momento'
              : `Não há notificações ${
                  filter === 'unread' ? 'não lidas' :
                  filter === 'read' ? 'lidas' :
                  filter === 'booking' ? 'de reservas' :
                  'do sistema'
                }`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`card-gradient p-6 hover:shadow-lg transition-shadow ${
                !notification.read ? 'border-l-4 border-blue-600' : ''
              }`}
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className={`text-base font-semibold ${
                          !notification.read ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Nova
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {notification.message}
                      </p>
                      <div className="mt-2 flex items-center space-x-4">
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: pt
                          })}
                        </span>
                        {notification.type && (
                          <span className="text-xs text-gray-500 capitalize">
                            {notification.type === 'booking' ? 'Reserva' :
                             notification.type === 'review' ? 'Avaliação' : 'Sistema'}
                          </span>
                        )}
                      </div>
                      {notification.booking_id && (
                        <Link
                          to={`/bookings?highlight=${notification.booking_id}`}
                          onClick={() => {
                            if (!notification.read) {
                              markAsRead([notification.id]);
                            }
                          }}
                          className="inline-flex items-center mt-3 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg transition-colors shadow-sm"
                        >
                          <Calendar className="h-4 w-4 mr-1.5" />
                          Ver reserva →
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead([notification.id])}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Marcar como lida"
                        >
                          <Check className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remover notificação"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredNotifications.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Mostrando {filteredNotifications.length} de {notifications.length} notificações
        </div>
      )}
    </div>
  );
}
