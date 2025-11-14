import { Link } from 'react-router-dom';
import { Scissors, UserCircle, Briefcase, ArrowLeft } from 'lucide-react';

export function AccountTypeSelection() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 py-8 sm:py-12 px-3 sm:px-4">
      <div className="max-w-4xl w-full space-y-6 sm:space-y-8 bg-white p-6 sm:p-8 rounded-2xl shadow-xl">
        <div>
          <Link
            to="/auth/login"
            className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar ao Login
          </Link>

          <div className="flex flex-col items-center mb-8">
            <img
              src="/icons/belleza-logo.svg"
              alt="Belleza"
              className="h-8 sm:h-12 w-auto mb-3 sm:mb-4"
            />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mt-4 sm:mt-6 text-center">
              Como deseja usar o Belleza?
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Escolha o tipo de conta que melhor se adequa às suas necessidades
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <Link
            to="/auth/register-client"
            className="group relative overflow-hidden rounded-xl border-2 border-gray-200 p-8 transition-all duration-300 hover:border-blue-500 hover:shadow-xl"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 transition-transform duration-300 group-hover:scale-150"></div>

            <div className="relative z-10">
              <div className="flex justify-center mb-6">
                <div className="h-16 w-16 text-blue-600 bg-blue-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <UserCircle className="h-10 w-10" />
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 text-center mb-3">
                Sou Cliente
              </h3>

              <p className="text-gray-600 text-center mb-6">
                Quero encontrar e reservar serviços de beleza e bem-estar
              </p>

              <ul className="space-y-3 mb-6">
                <li className="flex items-start text-sm text-gray-700">
                  <svg className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Pesquisar e descobrir serviços
                </li>
                <li className="flex items-start text-sm text-gray-700">
                  <svg className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Fazer reservas online
                </li>
                <li className="flex items-start text-sm text-gray-700">
                  <svg className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Gerir as minhas reservas
                </li>
                <li className="flex items-start text-sm text-gray-700">
                  <svg className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Avaliar profissionais
                </li>
              </ul>

              <div className="flex justify-center">
                <span className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white font-medium group-hover:bg-blue-700 transition-colors">
                  Criar Conta de Cliente
                  <svg className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </Link>

          <Link
            to="/auth/register-professional"
            className="group relative overflow-hidden rounded-xl border-2 border-gray-200 p-8 transition-all duration-300 hover:border-blue-500 hover:shadow-xl"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 transition-transform duration-300 group-hover:scale-150"></div>

            <div className="relative z-10">
              <div className="flex justify-center mb-6">
                <div className="h-16 w-16 text-blue-600 bg-blue-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Briefcase className="h-10 w-10" />
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 text-center mb-3">
                Sou Profissional
              </h3>

              <p className="text-gray-600 text-center mb-6">
                Quero oferecer os meus serviços e gerir o meu negócio
              </p>

              <ul className="space-y-3 mb-6">
                <li className="flex items-start text-sm text-gray-700">
                  <svg className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Criar e gerir serviços
                </li>
                <li className="flex items-start text-sm text-gray-700">
                  <svg className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Gerir agenda e disponibilidade
                </li>
                <li className="flex items-start text-sm text-gray-700">
                  <svg className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Aceitar reservas online
                </li>
                <li className="flex items-start text-sm text-gray-700">
                  <svg className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Gerir lista de clientes
                </li>
              </ul>

              <div className="flex justify-center">
                <span className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white font-medium group-hover:bg-blue-700 transition-colors">
                  Criar Conta de Profissional
                  <svg className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Já tem uma conta?{' '}
            <Link to="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
