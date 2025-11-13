import { useState } from 'react';
import { X, AlertTriangle, Download, Trash2, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
  professionalId: string;
  archivedCount: number;
  onSuccess: () => void;
}

export function CleanupModal({
  isOpen,
  onClose,
  professionalId,
  archivedCount,
  onSuccess
}: CleanupModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'confirm' | 'export'>('confirm');

  if (!isOpen) return null;

  const handleExport = async () => {
    setExporting(true);
    setError('');

    try {
      const { data, error: exportError } = await supabase.rpc(
        'export_archived_bookings_data',
        { p_professional_id: professionalId }
      );

      if (exportError) throw exportError;

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reservas-arquivadas-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setStep('export');
    } catch (err: any) {
      console.error('Error exporting data:', err);
      setError('Erro ao exportar dados. Por favor, tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  const handleCleanup = async () => {
    if (confirmText !== 'CONFIRMAR EXCLUSAO') {
      setError('Por favor, digite exatamente "CONFIRMAR EXCLUSAO" para continuar.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: cleanupError } = await supabase.rpc(
        'cleanup_archived_bookings',
        {
          p_professional_id: professionalId,
          p_confirmation_text: confirmText
        }
      );

      if (cleanupError) throw cleanupError;

      if (data && !data.success) {
        throw new Error(data.message || 'Erro ao limpar dados');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error cleaning up data:', err);
      setError(err.message || 'Erro ao limpar dados. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading && !exporting) {
      setConfirmText('');
      setError('');
      setStep('confirm');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Trash2 className="h-6 w-6 mr-2 text-red-600" />
            Limpar Dados Arquivados
          </h2>
          <button
            onClick={handleClose}
            disabled={loading || exporting}
            className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-2">Atenção: Esta ação é irreversível!</h3>
              <p className="text-sm text-red-800 mb-2">
                Você está prestes a deletar permanentemente <strong>{archivedCount}</strong> reserva
                {archivedCount !== 1 ? 's' : ''} arquivada{archivedCount !== 1 ? 's' : ''} (concluídas e canceladas).
              </p>
              <p className="text-sm text-red-800">
                Todos os dados relacionados serão removidos e não poderão ser recuperados.
              </p>
            </div>
          </div>

          {step === 'confirm' && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                  <Download className="h-5 w-5 mr-2" />
                  Recomendação: Exportar Backup
                </h4>
                <p className="text-sm text-blue-800 mb-3">
                  Antes de deletar os dados, recomendamos exportar um backup em formato JSON
                  para seus registros.
                </p>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      <span>Exportando...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>Exportar Backup</span>
                    </>
                  )}
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Confirmação de Exclusão
                </label>
                <p className="text-sm text-gray-600 mb-3">
                  Para confirmar a exclusão permanente, digite exatamente:{' '}
                  <code className="bg-gray-100 px-2 py-1 rounded text-red-600 font-mono text-xs">
                    CONFIRMAR EXCLUSAO
                  </code>
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Digite aqui..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">O que será deletado:</h4>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>Todas as reservas com status "concluído" ou "cancelado"</li>
              <li>Notificações relacionadas a estas reservas</li>
              <li>Histórico de interações com clientes destas reservas</li>
            </ul>
            <p className="text-xs text-gray-500 mt-3">
              Nota: Os dados dos clientes e serviços serão mantidos intactos.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={handleClose}
            disabled={loading || exporting}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleCleanup}
            disabled={loading || confirmText !== 'CONFIRMAR EXCLUSAO' || exporting}
            className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center space-x-2"
          >
            {loading ? (
              <>
                <Loader className="h-5 w-5 animate-spin" />
                <span>Deletando...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-5 w-5" />
                <span>Deletar Permanentemente</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
