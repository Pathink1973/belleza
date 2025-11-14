import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Scissors, Sparkles, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GlowCard } from '../components/ui/spotlight-card';

interface Category {
  name: string;
  count: number;
}

const defaultCategories = [
  { name: 'Cabelo e penteado', count: 0 },
  { name: 'Unhas', count: 0 },
  { name: 'Sobrancelhas', count: 0 },
  { name: 'Massagem', count: 0 },
  { name: 'Barbearia', count: 0 },
  { name: 'Depilação', count: 0 },
  { name: 'Tratamento Facial', count: 0 },
  { name: 'Tratamento Corporal', count: 0 },
  { name: 'Injectáveis', count: 0 },
  { name: 'Tatuagem e piercing', count: 0 },
  { name: 'Maquilhagem', count: 0 },
  { name: 'Fitness', count: 0 }
];


export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalServices, setTotalServices] = useState(0);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data: services, error } = await supabase
          .from('services')
          .select('category');

        if (error) throw error;

        const categoryCounts = new Map<string, number>();

        services?.forEach(service => {
          if (service.category) {
            const count = categoryCounts.get(service.category) || 0;
            categoryCounts.set(service.category, count + 1);
          }
        });

        const categoryList = defaultCategories.map(defaultCat => {
          const count = categoryCounts.get(defaultCat.name) || 0;
          return {
            name: defaultCat.name,
            count
          };
        });

        const sortedCategories = categoryList
          .filter(cat => cat.count > 0)
          .sort((a, b) => b.count - a.count);

        setCategories(sortedCategories);
        setTotalServices(services?.length || 0);
      } catch (error) {
        console.error('Error fetching categories:', error);
        setCategories(defaultCategories.map(cat => ({ ...cat, count: 0 })));
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen animated-pastel-gradient flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
          <p className="text-gray-600 font-medium">A carregar categorias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen animated-pastel-gradient">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-12">
        <div className="text-center mb-4 sm:mb-12">
          <div className="inline-flex items-center justify-center p-1.5 sm:p-3 bg-white rounded-xl sm:rounded-2xl shadow-lg mb-2 sm:mb-6">
            <Scissors className="h-6 w-6 sm:h-10 sm:w-10 text-blue-600" />
          </div>

          <h1 className="text-xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-2 sm:mb-4 px-2">
            Explore todas as{' '}
            <span className="bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">
              categorias
            </span>
          </h1>

          <p className="text-sm sm:text-xl text-gray-600 max-w-2xl mx-auto mb-3 sm:mb-6 px-4">
            Descubra os melhores profissionais para cada tipo de serviço
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6 text-[11px] sm:text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
              <span>
                <span className="font-semibold text-gray-900">{totalServices}</span> serviços disponíveis
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
              <span>
                <span className="font-semibold text-gray-900">{categories.length}</span> categorias ativas
              </span>
            </div>
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
              <Scissors className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Nenhuma categoria disponível
            </h3>
            <p className="text-gray-600 mb-8">
              Não encontramos serviços cadastrados no momento.
            </p>
            <Link
              to="/"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-200"
            >
              Voltar ao início
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4 md:gap-6 mb-4 sm:mb-12">
              {categories.map((category, index) => (
                <Link
                  key={category.name}
                  to={`/services?category=${encodeURIComponent(category.name)}`}
                  className="block group"
                >
                  <GlowCard
                    glowColor={index % 3 === 0 ? 'blue' : index % 3 === 1 ? 'purple' : 'green'}
                    customSize={true}
                    variant="white"
                    className="w-full h-full aspect-auto !p-3 sm:!p-6 hover:scale-[1.02] transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-2 sm:space-y-3">
                      <h3 className="text-sm sm:text-xl md:text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">
                        {category.name}
                      </h3>

                      <div className="flex items-center gap-1.5 text-xs sm:text-base">
                        <div className="px-2.5 py-1 sm:px-4 sm:py-2 bg-blue-50 rounded-full">
                          <span className="font-semibold text-blue-600 text-[11px] sm:text-base">
                            {category.count}
                          </span>
                          <span className="text-blue-500 ml-0.5 sm:ml-1 text-[11px] sm:text-base">
                            {category.count === 1 ? 'serviço' : 'serviços'}
                          </span>
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span>Ver serviços</span>
                        <ArrowRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </GlowCard>
                </Link>
              ))}
            </div>

            <div className="bg-gradient-to-r from-blue-600 to-blue-600 rounded-xl sm:rounded-3xl shadow-2xl p-4 sm:p-8 md:p-12 text-center text-white">
              <h2 className="text-lg sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-4">
                Não encontrou o que procura?
              </h2>
              <p className="text-sm sm:text-xl text-blue-100 mb-4 sm:mb-8 max-w-2xl mx-auto px-4">
                Use a pesquisa para encontrar serviços específicos ou explore todos os nossos profissionais
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <Link
                  to="/services"
                  className="inline-flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 bg-white text-blue-600 font-semibold rounded-lg sm:rounded-xl hover:shadow-2xl transition-all duration-200 hover:scale-105 text-sm sm:text-base"
                >
                  Ver todos os serviços
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2" />
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 bg-transparent border-2 border-white text-white font-semibold rounded-lg sm:rounded-xl hover:bg-white hover:text-blue-600 transition-all duration-200 text-sm sm:text-base"
                >
                  Voltar ao início
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
