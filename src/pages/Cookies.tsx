import { Link } from 'react-router-dom';
import { Cookie, Shield, Settings, BarChart3, Info, CheckCircle } from 'lucide-react';
import { GlowCard } from '../components/ui/spotlight-card';

export function Cookies() {
  const cookieTypes = [
    {
      icon: Shield,
      title: 'Cookies Necessários',
      description: 'Essenciais para o funcionamento básico da plataforma',
      examples: ['Autenticação de sessão', 'Preferências de segurança', 'Carrinho de compras'],
      required: true,
      color: 'from-blue-600 to-blue-700'
    },
    {
      icon: Settings,
      title: 'Cookies Funcionais',
      description: 'Melhoram a experiência e lembram suas preferências',
      examples: ['Idioma preferido', 'Configurações de interface', 'Histórico de pesquisa'],
      required: false,
      color: 'from-purple-600 to-purple-700'
    },
    {
      icon: BarChart3,
      title: 'Cookies Analíticos',
      description: 'Ajudam-nos a entender como você usa a plataforma',
      examples: ['Páginas visitadas', 'Tempo de sessão', 'Comportamento de navegação'],
      required: false,
      color: 'from-green-600 to-green-700'
    }
  ];

  const thirdPartyServices = [
    {
      name: 'Google Analytics',
      purpose: 'Análise de tráfego e comportamento dos utilizadores',
      website: 'https://policies.google.com/privacy'
    },
    {
      name: 'Supabase',
      purpose: 'Gestão de base de dados e autenticação',
      website: 'https://supabase.com/privacy'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <div className="max-w-5xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="font-abril text-3xl md:text-6xl font-semibold text-gray-900 mb-6 leading-tight">
            Política de Cookies
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Última atualização: 11 de novembro de 2025
          </p>
        </div>

        <div className="mb-16">
          <GlowCard glowColor="blue" customSize={true} variant="white" className="!p-8">
            <div className="flex items-start">
              <Info className="h-6 w-6 text-blue-600 mr-4 mt-1 flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">O Que São Cookies?</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Cookies são pequenos ficheiros de texto que são armazenados no seu dispositivo
                  quando visita um website. Eles ajudam-nos a fornecer uma melhor experiência,
                  lembrando as suas preferências e melhorando o desempenho da plataforma.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  A Belleza utiliza cookies para garantir o funcionamento adequado da plataforma,
                  personalizar a sua experiência e analisar como o serviço é utilizado.
                </p>
              </div>
            </div>
          </GlowCard>
        </div>

        <section className="mb-16">
          <h2 className="font-abril text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 text-center mb-12">
            Tipos de Cookies
          </h2>
          <div className="space-y-6">
            {cookieTypes.map((type, index) => (
              <GlowCard
                key={index}
                glowColor={index === 0 ? 'blue' : index === 1 ? 'purple' : 'green'}
                customSize={true}
                className="!p-8"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start">
                    <div className={`inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br ${type.color} rounded-xl mr-4 flex-shrink-0 shadow-lg`}>
                      <type.icon className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{type.title}</h3>
                      <p className="text-gray-600 mb-4">{type.description}</p>
                    </div>
                  </div>
                  {type.required && (
                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                      Obrigatório
                    </span>
                  )}
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Exemplos:</p>
                  <ul className="space-y-1">
                    {type.examples.map((example, idx) => (
                      <li key={idx} className="flex items-center text-sm text-gray-600">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                        {example}
                      </li>
                    ))}
                  </ul>
                </div>
              </GlowCard>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="font-abril text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 text-center mb-12">
            Serviços de Terceiros
          </h2>
          <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
            <div className="p-6 bg-gray-50 border-b border-gray-200">
              <p className="text-gray-700">
                A Belleza utiliza alguns serviços de terceiros que podem definir os seus próprios cookies:
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              {thirdPartyServices.map((service, index) => (
                <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-2">{service.name}</h3>
                      <p className="text-gray-600 text-sm mb-3">{service.purpose}</p>
                      <a
                        href={service.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
                      >
                        Ver Política de Privacidade →
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="font-abril text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 text-center mb-8">
            Gestão de Cookies
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <GlowCard glowColor="blue" customSize={true} variant="white" className="!p-8">
              <Settings className="h-12 w-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Controlos do Navegador</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                A maioria dos navegadores permite controlar cookies através das configurações.
                Pode optar por bloquear ou eliminar cookies, mas isto pode afetar a funcionalidade
                da plataforma.
              </p>
              <p className="text-sm text-gray-500">
                Consulte a ajuda do seu navegador para mais informações.
              </p>
            </GlowCard>

            <GlowCard glowColor="purple" customSize={true} variant="white" className="!p-8">
              <Shield className="h-12 w-12 text-purple-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Os Seus Direitos</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Você tem direito a aceder, corrigir ou eliminar os seus dados pessoais a qualquer momento.
                Pode também retirar o consentimento para cookies não essenciais.
              </p>
              <Link
                to="/contact"
                className="text-purple-600 font-semibold hover:text-purple-700 text-sm"
              >
                Contactar para exercer direitos →
              </Link>
            </GlowCard>
          </div>
        </section>

        <section className="mb-16">
          <GlowCard glowColor="green" customSize={true} className="!p-8">
            <h2 className="font-abril text-xl sm:text-2xl md:text-3xl font-semibold text-gray-900 mb-4">
              Duração dos Cookies
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Cookies de Sessão</h3>
                <p className="text-gray-600 text-sm">
                  Temporários e eliminados quando fecha o navegador. Usados para funcionalidades
                  essenciais como autenticação.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Cookies Persistentes</h3>
                <p className="text-gray-600 text-sm">
                  Permanecem no seu dispositivo por um período específico. Usados para lembrar
                  preferências e melhorar a experiência.
                </p>
              </div>
            </div>
          </GlowCard>
        </section>

        <section className="mb-16 bg-white rounded-2xl border-2 border-gray-200 p-8">
          <h2 className="font-bold text-xl text-gray-900 mb-4">Atualizações a Esta Política</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Podemos atualizar esta Política de Cookies periodicamente para refletir mudanças nas
            nossas práticas ou por outros motivos operacionais, legais ou regulamentares.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Recomendamos que reveja esta página periodicamente para se manter informado sobre como
            utilizamos cookies. A data da última atualização está sempre indicada no topo desta página.
          </p>
        </section>

        <div className="grid md:grid-cols-2 gap-6">
          <GlowCard glowColor="blue" customSize={true} className="!p-8 text-center">
            <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-3">Termos de Uso</h3>
            <p className="text-gray-600 mb-4">
              Consulte os nossos termos completos de utilização
            </p>
            <Link
              to="/terms"
              className="text-blue-600 font-semibold hover:text-blue-700"
            >
              Ver Termos
            </Link>
          </GlowCard>

          <GlowCard glowColor="purple" customSize={true} className="!p-8 text-center">
            <Info className="h-12 w-12 text-purple-600 mx-auto mb-4" />
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
            Ao continuar a utilizar a plataforma Belleza, você consente com o uso de cookies
            conforme descrito nesta política.
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Versão 1.0 - Última atualização: 11 de novembro de 2025
          </p>
        </div>
      </div>
    </div>
  );
}
