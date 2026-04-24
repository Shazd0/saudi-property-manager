import React from 'react';
import { useLanguage } from '../i18n';
import { Globe } from 'lucide-react';
import SoundService from '../services/soundService';

interface LanguageToggleProps {
  compact?: boolean;
  className?: string;
}

const LanguageToggle: React.FC<LanguageToggleProps> = ({ compact = false, className = '' }) => {
  const { language, setLanguage, t } = useLanguage();

  const toggle = () => {
    SoundService.play('toggle');
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  if (compact) {
    return (
      <button
        onClick={toggle}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 ${className}`}
        title={t('settings.language')}
      >
        <Globe size={14} />
        <span>{language === 'en' ? 'عربي' : 'EN'}</span>
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Globe size={16} className="text-emerald-600" />
      <span className="text-sm font-semibold text-slate-700">{t('settings.language')}</span>
      <div className="flex items-center bg-slate-100 rounded-full p-0.5">
        <button
          onClick={() => { SoundService.play('toggle'); setLanguage('en'); }}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
            language === 'en' 
              ? 'bg-emerald-600 text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >{t('common.english')}</button>
        <button
          onClick={() => { SoundService.play('toggle'); setLanguage('ar'); }}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
            language === 'ar' 
              ? 'bg-emerald-600 text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >{t('common.arabic')}</button>
      </div>
    </div>
  );
};

export default LanguageToggle;
