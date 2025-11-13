import { Link } from 'react-router-dom';
import { Sparkles, Target, Heart, Shield, TrendingUp, Users, MapPin, Calendar } from 'lucide-react';
import { GlowCard } from '../components/ui/spotlight-card';

export function About() {
  const values = [
    {
      icon: Heart,
      title: 'Paixão pela Beleza',
      description: 'Todos merecem sentir-se bem consigo mesmos'
    },
    {
      icon: Shield,
      title: 'Confiança',
      description: 'Profissionais verificados e avaliações reais de clientes'
    },
    {
      icon: Target,
      title: 'Excelência',
      description: 'Compromisso com qualidade em cada interação'
    },
    {
      icon: Sparkles,
      title: 'Inovação',
      description: 'Tecnologia que simplifica e melhora a experiência'
    }
  ];

  const stats = [
    { icon: Users, value: '32K+', label: 'Profissionais' },
    { icon: Calendar, value: '2.8M+', label: 'Agendamentos' },
    { icon: MapPin, value: '120+', label: 'Cidades' },
    { icon: TrendingUp, value: '18K+', label: 'Estabelecimentos' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h1 className="font-abril text-5xl md:text-6xl lg:text-7xl font-semibold text-gray-900 mb-6 leading-tight">
            Sobre a Belleza
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Conectamos pessoas aos melhores profissionais de beleza e bem-estar em Portugal, numa plataforma projetada para simplificar seu negócio.
          </p>
        </div>

        <section className="mb-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-abril text-4xl font-semibold text-gray-900 mb-6">
                A Nossa Missão
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                Tornar os serviços de beleza e bem-estar acessíveis a todos, através de uma plataforma simples, intuitiva e confiável.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Capacitamos profissionais com ferramentas modernas de gestão, enquanto oferecemos aos clientes uma experiência de reserva sem complicações. Queremos ajudar-lo a expandir seu negócio, atrair novos clientes e aumentar as vendas.
              </p>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="https://res.cloudinary.com/dfeqzodi3/image/upload/v1762642462/foto_profissionais.webp"
                alt="Profissional de beleza"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </section>

        <section className="mb-24">
          <h2 className="font-abril text-4xl font-semibold text-gray-900 text-center mb-12">
            Os Nossos Valores
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <GlowCard
                key={index}
                glowColor={index % 2 === 0 ? 'blue' : 'purple'}
                customSize={true}
                className="!p-8 text-center hover:scale-105 transition-transform duration-300"
              >
                <div className="flex justify-center mb-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg">
                    <value.icon className="h-8 w-8 text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{value.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{value.description}</p>
              </GlowCard>
            ))}
          </div>
        </section>

        <section className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl p-12 text-center text-white shadow-2xl">
          <h2 className="font-abril text-4xl font-semibold mb-6">
            Junte-se a Nós
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Faça parte da maior plataforma de beleza e bem-estar em Portugal
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/auth/register"
              className="px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl hover:shadow-2xl transition-all duration-200 hover:scale-105"
            >
              Criar Conta
            </Link>
            <Link
              to="/services"
              className="px-8 py-4 bg-transparent border-2 border-white text-white font-semibold rounded-xl hover:bg-white hover:text-blue-600 transition-all duration-200"
            >
              Explorar Serviços
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
