import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Video,
  MessageCircle
} from 'lucide-react';
import { GlowCard } from '../components/ui/spotlight-card';

export function Help() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const faqs = [
    {
      category: 'Primeiros Passos',
      questions: [
        {
          q: 'Como criar o meu perfil profissional?',
          a: 'Registe-se como profissional, preencha as suas informações, adicione fotos do seu trabalho e configure os seus serviços. O seu perfil será ativado em até 48 horas após verificação.'
        },
        {
          q: 'Quanto tempo demora a ativação?',
          a: 'A ativação do perfil demora até 48 horas úteis. Receberá um email assim que o seu perfil for aprovado e estiver visível para clientes.'
        },
        {
          q: 'Como adicionar os meus serviços?',
          a: 'Aceda ao menu "Serviços" no painel profissional, clique em "Adicionar Serviço", preencha os detalhes (nome, preço, duração, descrição) e adicione fotos.'
        }
      ]
    },
    {
      category: 'Gestão de Agenda',
      questions: [
        {
          q: 'Como configurar a minha disponibilidade?',
          a: 'Vá a "Disponibilidade" no menu e defina os dias da semana e horários em que está disponível. Pode criar múltiplos blocos de horário para cada dia.'
        },
        {
          q: 'Posso bloquear datas específicas?',
          a: 'Sim! Use a funcionalidade "Datas Bloqueadas" para marcar férias, dias de folga ou eventos especiais. Os clientes não conseguirão agendar nessas datas.'
        },
        {
          q: 'Como funciona a marcação interna?',
          a: 'Pode criar agendamentos manualmente para clientes que ligam ou aparecem presencialmente. Use "Nova Marcação" no painel de agendamentos.'
        }
      ]
    },
    {
      category: 'Clientes e Comunicação',
      questions: [
        {
          q: 'Como vejo o histórico de um cliente?',
          a: 'Na secção "Clientes", clique em qualquer cliente para ver todo o histórico de agendamentos, notas e informações de contacto.'
        },
        {
          q: 'Posso adicionar notas sobre clientes?',
          a: 'Sim! Cada perfil de cliente tem uma área de notas onde pode registrar preferências, alergias ou observações importantes.'
        },
        {
          q: 'Como os clientes me contactam?',
          a: 'Os clientes podem contactá-lo via WhatsApp (se configurado) ou através do sistema de mensagens da plataforma. Receberá notificações de novas mensagens.'
        }
      ]
    },
    {
      category: 'Pagamentos e Finanças',
      questions: [
        {
          q: 'Como recebo os pagamentos?',
          a: 'Os pagamentos podem ser geridos diretamente com o cliente. A plataforma oferece relatórios para controlo das suas receitas e histórico de serviços prestados.'
        },
        {
          q: 'Posso alterar os preços dos serviços?',
          a: 'Sim! Pode atualizar os preços a qualquer momento na área de gestão de serviços. Os agendamentos já confirmados mantêm o preço acordado.'
        },
        {
          q: 'Existe alguma taxa de utilização?',
          a: 'Contacte-nos para conhecer os planos disponíveis e estrutura de preços. Temos opções flexíveis para diferentes tipos de negócio.'
        }
      ]
    },
    {
      category: 'Avaliações e Reputação',
      questions: [
        {
          q: 'Como funcionam as avaliações?',
          a: 'Após cada serviço, os clientes podem deixar uma avaliação de 1 a 5 estrelas e um comentário. As avaliações aparecem no seu perfil público.'
        },
        {
          q: 'Posso responder a avaliações?',
          a: 'Sim! É recomendado responder às avaliações, especialmente às menos positivas, mostrando profissionalismo e cuidado com o cliente.'
        },
        {
          q: 'Como melhorar a minha visibilidade?',
          a: 'Mantenha o perfil atualizado, responda rapidamente, tenha boas avaliações e adicione fotos de qualidade dos seus serviços.'
        }
      ]
    },
    {
      category: 'Suporte Técnico',
      questions: [
        {
          q: 'Esqueci-me da minha palavra-passe',
          a: 'Use a opção "Recuperar palavra-passe" na página de login. Receberá um email com instruções para criar uma nova palavra-passe.'
        },
        {
          q: 'A plataforma funciona em telemóvel?',
          a: 'Sim! A plataforma é totalmente otimizada para dispositivos móveis. Pode gerir o seu negócio de qualquer lugar.'
        },
        {
          q: 'Como contactar o suporte?',
          a: 'Pode contactar-nos via WhatsApp (+351 962 886 031), email (patriciobritodesign@gmail.com) ou através do formulário de contacto.'
        }
      ]
    }
  ];

  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(faq =>
      searchQuery === '' ||
      faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h1 className="font-abril text-3xl md:text-6xl lg:text-7xl font-semibold text-gray-900 mb-6 leading-tight">
            Centro de Ajuda
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed text-center">
            Tudo o que precisa saber para começar.
          </p>
        </div>

        <div className="max-w-3xl mx-auto mb-16">
          <div className="relative">
            <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400 h-6 w-6" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar ajuda..."
              className="w-full pl-16 pr-6 py-5 text-lg rounded-2xl border-2 border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-lg"
            />
          </div>
        </div>

        <section className="mb-20">
          <h2 className="font-abril text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 text-center mb-12">
            Perguntas Frequentes
          </h2>

          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">
                Nenhum resultado encontrado para "{searchQuery}"
              </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8">
              {filteredFaqs.map((category, categoryIndex) => (
                <div key={categoryIndex}>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {category.category}
                  </h3>
                  <div className="space-y-3">
                    {category.questions.map((faq, faqIndex) => {
                      const globalIndex = categoryIndex * 100 + faqIndex;
                      const isExpanded = expandedFaq === globalIndex;
                      return (
                        <div
                          key={faqIndex}
                          className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-blue-300 transition-colors"
                        >
                          <button
                            onClick={() => toggleFaq(globalIndex)}
                            className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                          >
                            <span className="font-semibold text-gray-900 pr-4">
                              {faq.q}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-blue-600 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            )}
                          </button>
                          {isExpanded && (
                            <div className="px-6 pb-5 text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                              {faq.a}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-20">
          <h2 className="font-abril text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 text-center mb-12">
            Recursos Adicionais
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <GlowCard glowColor="blue" customSize={true} className="!p-8 text-center">
              <BookOpen className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Guias Completos</h3>
              <p className="text-gray-600 mb-4">
                Tutoriais passo-a-passo para todas as funcionalidades
              </p>
              <button className="text-blue-600 font-semibold hover:text-blue-700">
                Em Breve
              </button>
            </GlowCard>

            <GlowCard glowColor="purple" customSize={true} className="!p-8 text-center">
              <Video className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Video Tutoriais</h3>
              <p className="text-gray-600 mb-4">
                Aprenda visualmente como usar a plataforma
              </p>
              <button className="text-purple-600 font-semibold hover:text-purple-700">
                Em Breve
              </button>
            </GlowCard>

            <GlowCard glowColor="green" customSize={true} className="!p-8 text-center">
              <MessageCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Suporte Direto</h3>
              <p className="text-gray-600 mb-4">
                Fale connosco para ajuda personalizada
              </p>
              <Link
                to="/contact"
                className="text-green-600 font-semibold hover:text-green-700"
              >
                Contactar
              </Link>
            </GlowCard>
          </div>
        </section>

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl p-12 text-center text-white shadow-2xl">
          <h2 className="font-abril text-xl sm:text-2xl md:text-3xl font-semibold mb-4">
            Não Encontrou a Resposta?
          </h2>
          <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
            A nossa equipa está pronta para ajudar. Entre em contacto connosco.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              to="/contact"
              className="px-6 sm:px-8 py-3 sm:py-4 min-h-[48px] sm:min-h-[56px] bg-white text-blue-600 font-semibold rounded-lg sm:rounded-xl hover:shadow-2xl transition-all duration-200 hover:scale-105 text-sm sm:text-base touch-manipulation inline-flex items-center justify-center"
            >
              Contactar Suporte
            </Link>
            <a
              href="https://wa.me/351962886031"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 sm:px-8 py-3 sm:py-4 min-h-[48px] sm:min-h-[56px] bg-transparent border-2 border-white text-white font-semibold rounded-lg sm:rounded-xl hover:bg-white hover:text-blue-600 transition-all duration-200 text-sm sm:text-base touch-manipulation inline-flex items-center justify-center"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
