import { Link } from 'react-router-dom';
import {
  Calendar,
  Users,
  BarChart3,
  Clock,
  CreditCard,
  Bell,
  Shield,
  Smartphone,
  Star,
  TrendingUp,
  Zap,
  CheckCircle
} from 'lucide-react';
import { GlowCard } from '../components/ui/spotlight-card';

export function Features() {
  const mainFeatures = [
    {
      icon: Calendar,
      title: 'Gestão de Agenda',
      description: 'Controle total sobre horários e disponibilidade',
      benefits: ['Sincronização automática', 'Bloqueio de datas', 'Visualização mensal e semanal'],
      color: 'from-blue-600 to-blue-700'
    },
    {
      icon: Users,
      title: 'Base de Clientes',
      description: 'Organize e acompanhe seus clientes',
      benefits: ['Histórico completo', 'Notas personalizadas', 'Lembretes automáticos'],
      color: 'from-purple-600 to-purple-700'
    },
    {
      icon: BarChart3,
      title: 'Análise de Desempenho',
      description: 'Insights sobre seu negócio',
      benefits: ['Receitas e tendências', 'Serviços populares', 'Taxa de ocupação'],
      color: 'from-green-600 to-green-700'
    },
    {
      icon: Bell,
      title: 'Notificações Inteligentes',
      description: 'Nunca perca um agendamento',
      benefits: ['Alertas em tempo real', 'Confirmações automáticas', 'Lembretes personalizáveis'],
      color: 'from-orange-600 to-orange-700'
    }
  ];

  const additionalFeatures = [
    { icon: Clock, text: 'Agendamento 24/7' },
    { icon: CreditCard, text: 'Controlo de pagamentos' },
    { icon: Shield, text: 'Perfil verificado' },
    { icon: Smartphone, text: 'App mobile-friendly' },
    { icon: Star, text: 'Sistema de avaliações' },
    { icon: Zap, text: 'Configuração rápida' }
  ];

  const stats = [
    { value: '87%', label: 'Aumento médio de reservas' },
    { value: '5h', label: 'Tempo poupado por semana' },
    { value: '95%', label: 'Taxa de satisfação' },
    { value: '48h', label: 'Ativação do perfil' }
  ];

  const testimonials = [
    {
      name: 'Sofia Martins',
      business: 'Studio Sofia - Lisboa',
      comment: 'Desde que uso a Belleza, minha agenda está sempre cheia. A plataforma é intuitiva e meus clientes adoram!',
      rating: 5
    },
    {
      name: 'Ricardo Santos',
      business: 'Barbearia Premium - Porto',
      comment: 'Excelente ferramenta! Reduzi tempo de gestão e aumentei minha clientela em 60%.',
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h1 className="font-abril text-3xl md:text-6xl lg:text-7xl font-semibold text-gray-900 mb-6 leading-tight">
            Funcionalidades
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed text-center">
            Tudo o que precisa para gerir o seu negócio de beleza com sucesso.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-20">
          {mainFeatures.map((feature, index) => (
            <GlowCard
              key={index}
              glowColor={index % 2 === 0 ? 'blue' : 'purple'}
              customSize={true}
              className="!p-8"
            >
              <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br ${feature.color} rounded-xl mb-6 shadow-lg`}>
                <feature.icon className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">{feature.description}</p>
              <ul className="space-y-3">
                {feature.benefits.map((benefit, idx) => (
                  <li key={idx} className="flex items-center text-gray-700">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-3 flex-shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </GlowCard>
          ))}
        </div>

        <section className="mb-20">
          <h2 className="font-abril text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 text-center mb-12">
            E Muito Mais
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {additionalFeatures.map((feature, index) => (
              <GlowCard
                key={index}
                glowColor="blue"
                customSize={true}
                variant="white"
                className="!p-6 hover:scale-105 transition-transform duration-300"
              >
                <div className="flex items-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mr-4">
                    <feature.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <span className="font-semibold text-gray-900">{feature.text}</span>
                </div>
              </GlowCard>
            ))}
          </div>
        </section>

        <section className="mb-20 bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl p-12 text-white">
          <h2 className="font-abril text-2xl sm:text-3xl md:text-4xl font-semibold text-center mb-12">
            Resultados Reais
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-5xl font-bold mb-2">{stat.value}</div>
                <div className="text-blue-100">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-20">
          <h2 className="font-abril text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 text-center mb-12">
            O Que Dizem os Profissionais
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {testimonials.map((testimonial, index) => (
              <GlowCard
                key={index}
                glowColor={index % 2 === 0 ? 'blue' : 'purple'}
                customSize={true}
                className="!p-8"
              >
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 italic leading-relaxed">"{testimonial.comment}"</p>
                <div>
                  <div className="font-bold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-600">{testimonial.business}</div>
                </div>
              </GlowCard>
            ))}
          </div>
        </section>

        <section className="mb-20">
          <GlowCard glowColor="green" customSize={true} className="!p-12 text-center">
            <TrendingUp className="h-16 w-16 text-green-600 mx-auto mb-6" />
            <h2 className="font-abril text-xl sm:text-2xl md:text-3xl font-semibold text-gray-900 mb-4">
              Faça Crescer o Seu Negócio
            </h2>
            <p className="text-xl text-gray-600 mb-6 max-w-2xl mx-auto">
              Alcance mais clientes potenciais e simplifique a gestão do seu dia-a-dia
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/auth/register"
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                Começar Agora
              </Link>
              <Link
                to="/contact"
                className="px-8 py-4 bg-transparent border-2 border-gray-300 text-gray-900 font-semibold rounded-xl hover:border-blue-600 hover:text-blue-600 transition-all duration-200"
              >
                Falar com a Equipa
              </Link>
            </div>
          </GlowCard>
        </section>

        <section className="bg-gray-100 rounded-3xl p-8 md:p-12">
          <h2 className="font-abril text-xl sm:text-2xl md:text-3xl font-semibold text-gray-900 text-center mb-8">
            Perguntas Frequentes
          </h2>
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-2">Quanto custa?</h3>
              <p className="text-gray-600">Oferecemos planos flexíveis. Contacte-nos para conhecer as opções disponíveis.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-2">É fácil de configurar?</h3>
              <p className="text-gray-600">Sim! O seu perfil estará ativo em até 48 horas. Oferecemos suporte completo durante a configuração.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-2">Preciso de conhecimentos técnicos?</h3>
              <p className="text-gray-600">Não! A plataforma foi desenhada para ser intuitiva. Qualquer pessoa consegue usar.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
