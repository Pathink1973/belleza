import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ChevronDown, ChevronUp, Shield, AlertCircle } from 'lucide-react';
import { GlowCard } from '../components/ui/spotlight-card';

export function Terms() {
  const [expandedSection, setExpandedSection] = useState<number | null>(0);

  const sections = [
    {
      title: '1. Aceitação dos Termos',
      content: `Ao aceder e utilizar a plataforma Belleza, você concorda em ficar vinculado a estes Termos de Uso. Se não concordar com qualquer parte destes termos, não deverá utilizar os nossos serviços.

A Belleza reserva-se o direito de modificar estes termos a qualquer momento. As alterações entrarão em vigor imediatamente após a sua publicação na plataforma. É da responsabilidade do utilizador rever periodicamente estes termos.`
    },
    {
      title: '2. Descrição do Serviço',
      content: `A Belleza é uma plataforma digital que conecta clientes a profissionais de beleza e bem-estar. Facilitamos o agendamento de serviços, mas não somos responsáveis pela prestação dos serviços pelos profissionais.

Os profissionais registados na plataforma são independentes e responsáveis pela qualidade dos seus serviços. A Belleza atua apenas como intermediário tecnológico.`
    },
    {
      title: '3. Registo e Conta',
      content: `Para utilizar determinadas funcionalidades, é necessário criar uma conta. Você é responsável por:

• Fornecer informações precisas e atualizadas
• Manter a confidencialidade da sua palavra-passe
• Todas as atividades que ocorram na sua conta
• Notificar-nos imediatamente sobre uso não autorizado

Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos ou que apresentem atividades suspeitas.`
    },
    {
      title: '4. Uso da Plataforma',
      content: `Ao utilizar a Belleza, você concorda em:

• Não usar a plataforma para atividades ilegais
• Não tentar aceder a áreas restritas do sistema
• Não publicar conteúdo ofensivo ou inadequado
• Não fazer uso indevido das informações de outros utilizadores
• Respeitar os direitos de propriedade intelectual

A violação destas regras pode resultar na suspensão ou cancelamento da sua conta.`
    },
    {
      title: '5. Agendamentos e Cancelamentos',
      content: `Os agendamentos estão sujeitos à disponibilidade dos profissionais. A Belleza não garante a disponibilidade de profissionais específicos.

Políticas de cancelamento:
• Os clientes podem cancelar agendamentos conforme a política de cada profissional
• Profissionais devem respeitar compromissos agendados
• Cancelamentos de última hora podem estar sujeitos a penalizações

Recomendamos que clientes e profissionais comuniquem diretamente em caso de necessidade de alterações.`
    },
    {
      title: '6. Pagamentos e Taxas',
      content: `Os pagamentos pelos serviços são acordados diretamente entre clientes e profissionais. A Belleza pode cobrar taxas de utilização da plataforma aos profissionais.

Responsabilidades:
• Profissionais definem os preços dos seus serviços
• A Belleza não é responsável por disputas de pagamento
• Todas as transações financeiras devem ser conduzidas de forma legal

Os profissionais serão informados sobre estruturas de preços e taxas aplicáveis.`
    },
    {
      title: '7. Conteúdo do Utilizador',
      content: `Ao publicar conteúdo na plataforma (fotos, avaliações, descrições), você:

• Garante que possui os direitos sobre o conteúdo
• Concede à Belleza licença para usar, exibir e distribuir esse conteúdo
• É responsável pela precisão e legalidade do conteúdo
• Concorda que a Beautify pode remover conteúdo inadequado

Reservamo-nos o direito de remover qualquer conteúdo que viole estes termos ou leis aplicáveis.`
    },
    {
      title: '8. Avaliações e Comentários',
      content: `O sistema de avaliações destina-se a fornecer feedback genuíno. É proibido:

• Publicar avaliações falsas ou enganosas
• Oferecer incentivos por avaliações positivas
• Publicar conteúdo difamatório ou ofensivo
• Usar avaliações para fins comerciais não autorizados

A Belleza pode remover avaliações que violem estas diretrizes.`
    },
    {
      title: '9. Privacidade e Proteção de Dados',
      content: `O tratamento dos seus dados pessoais está sujeito à nossa Política de Privacidade, que faz parte integrante destes termos.

Comprometemo-nos a:
• Proteger os seus dados pessoais
• Usar os dados apenas para fins legítimos da plataforma
• Não vender os seus dados a terceiros
• Cumprir com a legislação de proteção de dados aplicável

Para mais informações, consulte a nossa Política de Privacidade.`
    },
    {
      title: '10. Limitação de Responsabilidade',
      content: `A Belleza fornece a plataforma "tal como está". Não nos responsabilizamos por:

• Qualidade dos serviços prestados pelos profissionais
• Danos resultantes do uso da plataforma
• Perda de dados ou interrupções no serviço
• Ações ou omissões de outros utilizadores

A nossa responsabilidade está limitada ao máximo permitido pela lei.`
    },
    {
      title: '11. Propriedade Intelectual',
      content: `Todos os direitos de propriedade intelectual da plataforma Belleza (incluindo design, logótipo, código e conteúdo) pertencem à Belleza ou aos seus licenciadores.

É proibido:
• Copiar, modificar ou distribuir elementos da plataforma
• Usar a marca Belleza sem autorização
• Fazer engenharia reversa da plataforma

O uso não autorizado pode resultar em ações legais.`
    },
    {
      title: '12. Rescisão',
      content: `Podemos suspender ou encerrar a sua conta a qualquer momento se:

• Violar estes Termos de Uso
• Usar a plataforma de forma fraudulenta
• Prejudicar outros utilizadores ou a plataforma
• Por solicitação sua

Você pode encerrar a sua conta a qualquer momento através das configurações da conta.`
    },
    {
      title: '13. Lei Aplicável',
      content: `Estes termos são regidos pelas leis de Portugal. Quaisquer disputas serão resolvidas nos tribunais portugueses competentes.

Em caso de conflito entre diferentes versões linguísticas destes termos, a versão em português prevalecerá.`
    },
    {
      title: '14. Contacto',
      content: `Para questões sobre estes Termos de Uso, contacte-nos:

Email: patriciobritodesign@gmail.com
WhatsApp: +351 962 886 031

Responderemos a todas as questões no prazo de 48 horas úteis.`
    }
  ];

  const toggleSection = (index: number) => {
    setExpandedSection(expandedSection === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <div className="max-w-5xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="font-abril text-5xl md:text-6xl font-semibold text-gray-900 mb-6 leading-tight">
            Termos de Uso
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Última atualização: 11 de novembro de 2025
          </p>
        </div>

        <div className="mb-12">
          <GlowCard glowColor="blue" customSize={true} variant="white" className="!p-6">
            <div className="flex items-start">
              <AlertCircle className="h-6 w-6 text-blue-600 mr-4 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Informação Importante</h3>
                <p className="text-gray-700 leading-relaxed">
                  Ao utilizar a plataforma Belleza, você concorda com estes Termos de Uso.
                  Por favor, leia-os cuidadosamente. Se tiver dúvidas, não hesite em{' '}
                  <Link to="/contact" className="text-blue-600 hover:text-blue-700 font-semibold">
                    contactar-nos
                  </Link>.
                </p>
              </div>
            </div>
          </GlowCard>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-12">
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <h2 className="font-bold text-xl text-gray-900 flex items-center">
              <Shield className="h-6 w-6 text-blue-600 mr-3" />
              Índice
            </h2>
          </div>
          <nav className="p-6">
            <ul className="space-y-2">
              {sections.map((section, index) => (
                <li key={index}>
                  <button
                    onClick={() => toggleSection(index)}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    {section.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="space-y-4">
          {sections.map((section, index) => {
            const isExpanded = expandedSection === index;
            return (
              <div
                key={index}
                className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden hover:border-blue-300 transition-colors"
              >
                <button
                  onClick={() => toggleSection(index)}
                  className="w-full px-8 py-6 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <h3 className="font-bold text-lg text-gray-900 pr-4">
                    {section.title}
                  </h3>
                  {isExpanded ? (
                    <ChevronUp className="h-6 w-6 text-blue-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-6 w-6 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-8 pb-8 text-gray-700 leading-relaxed whitespace-pre-line border-t border-gray-100 pt-6">
                    {section.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-16 grid md:grid-cols-2 gap-6">
          <GlowCard glowColor="blue" customSize={true} className="!p-8 text-center">
            <FileText className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-3">Política de Cookies</h3>
            <p className="text-gray-600 mb-4">
              Saiba como utilizamos cookies na plataforma
            </p>
            <Link
              to="/cookies"
              className="text-blue-600 font-semibold hover:text-blue-700"
            >
              Consultar Política
            </Link>
          </GlowCard>

          <GlowCard glowColor="purple" customSize={true} className="!p-8 text-center">
            <Shield className="h-12 w-12 text-purple-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-3">Dúvidas?</h3>
            <p className="text-gray-600 mb-4">
              Entre em contacto para esclarecimentos
            </p>
            <Link
              to="/contact"
              className="text-purple-600 font-semibold hover:text-purple-700"
            >
              Contactar-nos
            </Link>
          </GlowCard>
        </div>

        <div className="mt-12 bg-gray-100 rounded-2xl p-8 text-center">
          <p className="text-gray-700">
            Ao continuar a utilizar a plataforma Belleza, você concorda com estes Termos de Uso.
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Versão 1.0 - Última atualização: 11 de novembro de 2025
          </p>
        </div>
      </div>
    </div>
  );
}
