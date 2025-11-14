import { useState } from 'react';
import { Mail, MessageCircle, Phone, MapPin, Clock, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { GlowCard } from '../components/ui/spotlight-card';
import { supabase } from '../lib/supabase';

export function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('contact_messages')
        .insert({
          sender_name: formData.name,
          sender_email: formData.email,
          subject: formData.subject,
          message: formData.message,
          category_tag: formData.subject
        });

      if (insertError) throw insertError;

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setFormData({ name: '', email: '', subject: '', message: '' });
      }, 3000);
    } catch (err) {
      console.error('Error submitting contact form:', err);
      setError('Erro ao enviar mensagem. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const contactMethods = [
    {
      icon: MessageCircle,
      title: 'WhatsApp',
      value: '+351 962 886 031',
      description: 'Resposta rápida . horário comercial',
      action: () => window.open('https://wa.me/351962886031', '_blank'),
      color: 'from-green-600 to-green-700'
    },
    {
      icon: Mail,
      title: 'Email',
      value: 'patriciobritodesign@gmail.com',
      description: 'Resposta em até 24 horas',
      action: () => window.location.href = 'mailto:patriciobritodesign@gmail.com',
      color: 'from-blue-600 to-blue-700'
    },
    {
      icon: Phone,
      title: 'Telefone',
      value: '+351 962 886 031',
      description: 'Segunda-Sexta, 09h00-18h00',
      action: () => window.location.href = 'tel:+351962886031',
      color: 'from-purple-600 to-purple-700'
    }
  ];

  const locations = [
    { city: 'Valença', establishments: '2K+' },
    { city: 'Viana do Castelo', establishments: '1.5K+' },
    { city: 'Braga', establishments: '1.5K+' },
    { city: 'Porto', establishments: '1+' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h1 className="font-abril text-3xl md:text-6xl lg:text-7xl font-semibold text-gray-900 mb-6 leading-tight">
            Contacte-nos
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed text-center">
            Estamos aqui para ajudar. Entre em contacto connosco.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {contactMethods.map((method, index) => (
            <GlowCard
              key={index}
              glowColor={index === 0 ? 'green' : index === 1 ? 'blue' : 'purple'}
              customSize={true}
              className="!p-8 hover:scale-105 transition-transform duration-300 cursor-pointer"
              onClick={method.action}
            >
              <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br ${method.color} rounded-xl mb-4 shadow-lg`}>
                <method.icon className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{method.title}</h3>
              <p className="text-lg font-semibold text-blue-600 mb-2">{method.value}</p>
              <p className="text-sm text-gray-600">{method.description}</p>
            </GlowCard>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          <div>
            <h2 className="font-abril text-xl sm:text-2xl md:text-3xl font-semibold text-gray-900 mb-6">
              Envie-nos uma Mensagem
            </h2>
            <p className="text-gray-600 mb-8">
              Preencha o formulário abaixo e entraremos em contacto o mais breve possível.
            </p>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-6 flex items-center">
                <AlertCircle className="h-6 w-6 text-red-600 mr-3 flex-shrink-0" />
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {submitted ? (
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-8 text-center">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Mensagem Enviada!</h3>
                <p className="text-gray-600">Obrigado pelo seu contacto. Responderemos em breve.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="O seu nome"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="seu@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-semibold text-gray-700 mb-2">
                    Assunto
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="">Selecione um assunto</option>
                    <option value="general">Informação Geral</option>
                    <option value="support">Suporte Técnico</option>
                    <option value="professional">Tornar-me Profissional</option>
                    <option value="partnership">Parceria</option>
                    <option value="other">Outro</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-2">
                    Mensagem
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    placeholder="Como podemos ajudar?"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 sm:px-8 py-3 sm:py-4 min-h-[48px] sm:min-h-[56px] bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg sm:rounded-xl hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-sm sm:text-base touch-manipulation"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white mr-2"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      Enviar Mensagem
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          <div>
            <h2 className="font-abril text-xl sm:text-2xl md:text-3xl font-semibold text-gray-900 mb-6">
              Horário de Atendimento
            </h2>
            <GlowCard glowColor="blue" customSize={true} variant="white" className="!p-6 mb-8">
              <div className="flex items-start">
                <Clock className="h-6 w-6 text-blue-600 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Disponibilidade</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Segunda a Sexta:</span>
                      <span className="font-semibold text-gray-900">09h00 - 18h00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sábado:</span>
                      <span className="font-semibold text-gray-900">10h00 - 12h00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Domingo:</span>
                      <span className="font-semibold text-gray-900">Encerrado</span>
                    </div>
                  </div>
                </div>
              </div>
            </GlowCard>

            <h2 className="font-abril text-xl sm:text-2xl md:text-3xl font-semibold text-gray-900 mb-6">
              Cobertura Nacional
            </h2>
            <GlowCard glowColor="purple" customSize={true} variant="white" className="!p-6">
              <div className="flex items-start mb-4">
                <MapPin className="h-6 w-6 text-blue-600 mr-3 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">A plataforma Belleza já está presente.</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Principais áreas de cobertura:
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {locations.map((location, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                  >
                    <div className="font-semibold text-gray-900">{location.city}</div>
                    <div className="text-xs text-gray-600">{location.establishments} estabelecimentos</div>
                  </div>
                ))}
              </div>
            </GlowCard>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl p-12 text-center text-white shadow-2xl">
          <h2 className="font-abril text-xl sm:text-2xl md:text-3xl font-semibold mb-4">
            Resposta Rápida
          </h2>
          <p className="text-lg text-blue-100 mb-6">
            Tempo médio de resposta: 2 horas em dias úteis
          </p>
          <p className="text-blue-100">
            Para questões urgentes, contacte-nos via WhatsApp
          </p>
        </div>
      </div>
    </div>
  );
}
