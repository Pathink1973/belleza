import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { pt } from 'date-fns/locale';
import ptPTTranslations from './locales/pt_PT.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'pt-PT': {
        translation: ptPTTranslations
      }
    },
    lng: 'pt-PT',
    fallbackLng: 'pt-PT',
    interpolation: {
      escapeValue: false
    }
  });

export { pt as ptLocale };
export default i18n;