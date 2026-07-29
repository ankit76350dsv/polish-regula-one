import { createContext, useContext, useState } from 'react';
import { translations } from '../data/translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('ksef_language') || 'pl';
  });

  const setLanguage = (lang) => {
    setLanguageState(lang);
    localStorage.setItem('ksef_language', lang);
  };

  const t = (key, replacements = {}) => {
    const keys = key.split('.');
    let value = translations[language];
    for (const k of keys) {
      if (value && value[k] !== undefined) {
        value = value[k];
      } else {
        // Fallback to English if not found in current language
        let fallbackValue = translations['en'];
        for (const fk of keys) {
          if (fallbackValue && fallbackValue[fk] !== undefined) {
            fallbackValue = fallbackValue[fk];
          } else {
            fallbackValue = null;
            break;
          }
        }
        value = fallbackValue || key;
        break;
      }
    }

    if (typeof value === 'string') {
      // Replace placeholder values like {host} or {id}
      let result = value;
      Object.entries(replacements).forEach(([placeholder, repVal]) => {
        result = result.replace(new RegExp(`{${placeholder}}`, 'g'), repVal);
      });
      return result;
    }

    return value;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
