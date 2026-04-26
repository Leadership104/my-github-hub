import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

/**
 * Lightweight i18n provider for Kipita.
 * Translates the most-visible UI chrome (nav labels, profile menu, common
 * controls). Strings not present in a dictionary fall back to English.
 *
 * User language is persisted in localStorage under 'kip_lang'.
 */

export type LangCode = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ja' | 'zh' | 'ar' | 'hi' | 'ko' | 'ru';

export const SUPPORTED_LANGUAGES: { code: LangCode; label: string; flag: string }[] = [
  { code: 'en', label: 'English',     flag: '🇺🇸' },
  { code: 'es', label: 'Español',     flag: '🇪🇸' },
  { code: 'fr', label: 'Français',    flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch',     flag: '🇩🇪' },
  { code: 'pt', label: 'Português',   flag: '🇵🇹' },
  { code: 'it', label: 'Italiano',    flag: '🇮🇹' },
  { code: 'ja', label: '日本語',       flag: '🇯🇵' },
  { code: 'zh', label: '中文',         flag: '🇨🇳' },
  { code: 'ar', label: 'العربية',      flag: '🇸🇦' },
  { code: 'hi', label: 'हिन्दी',        flag: '🇮🇳' },
  { code: 'ko', label: '한국어',       flag: '🇰🇷' },
  { code: 'ru', label: 'Русский',     flag: '🇷🇺' },
];

type Dict = Record<string, string>;

const DICTIONARIES: Record<LangCode, Dict> = {
  en: {
    'nav.home': 'Home', 'nav.ai': 'AI', 'nav.travel': 'Travel', 'nav.places': 'Places',
    'profile.guest': 'Guest User', 'profile.notSignedIn': 'Not signed in',
    'profile.edit': 'Edit Profile', 'profile.safety': 'Travel Safety',
    'profile.replayTour': 'Replay app tour', 'profile.signOut': 'Sign Out',
    'profile.language': 'Language',
    'common.back': 'Back', 'common.cancel': 'Cancel', 'common.save': 'Save', 'common.done': 'Done',
  },
  es: {
    'nav.home': 'Inicio', 'nav.ai': 'IA', 'nav.travel': 'Viajes', 'nav.places': 'Lugares',
    'profile.guest': 'Invitado', 'profile.notSignedIn': 'No conectado',
    'profile.edit': 'Editar perfil', 'profile.safety': 'Seguridad de viaje',
    'profile.replayTour': 'Repetir tour', 'profile.signOut': 'Cerrar sesión',
    'profile.language': 'Idioma',
    'common.back': 'Atrás', 'common.cancel': 'Cancelar', 'common.save': 'Guardar', 'common.done': 'Listo',
  },
  fr: {
    'nav.home': 'Accueil', 'nav.ai': 'IA', 'nav.travel': 'Voyages', 'nav.places': 'Lieux',
    'profile.guest': 'Invité', 'profile.notSignedIn': 'Non connecté',
    'profile.edit': 'Modifier le profil', 'profile.safety': 'Sécurité voyage',
    'profile.replayTour': 'Revoir la visite', 'profile.signOut': 'Déconnexion',
    'profile.language': 'Langue',
    'common.back': 'Retour', 'common.cancel': 'Annuler', 'common.save': 'Enregistrer', 'common.done': 'Terminé',
  },
  de: {
    'nav.home': 'Start', 'nav.ai': 'KI', 'nav.travel': 'Reisen', 'nav.places': 'Orte',
    'profile.guest': 'Gast', 'profile.notSignedIn': 'Nicht angemeldet',
    'profile.edit': 'Profil bearbeiten', 'profile.safety': 'Reisesicherheit',
    'profile.replayTour': 'Tour wiederholen', 'profile.signOut': 'Abmelden',
    'profile.language': 'Sprache',
    'common.back': 'Zurück', 'common.cancel': 'Abbrechen', 'common.save': 'Speichern', 'common.done': 'Fertig',
  },
  pt: {
    'nav.home': 'Início', 'nav.ai': 'IA', 'nav.travel': 'Viagens', 'nav.places': 'Lugares',
    'profile.guest': 'Convidado', 'profile.notSignedIn': 'Não conectado',
    'profile.edit': 'Editar perfil', 'profile.safety': 'Segurança em viagem',
    'profile.replayTour': 'Repetir tour', 'profile.signOut': 'Sair',
    'profile.language': 'Idioma',
    'common.back': 'Voltar', 'common.cancel': 'Cancelar', 'common.save': 'Salvar', 'common.done': 'Feito',
  },
  it: {
    'nav.home': 'Home', 'nav.ai': 'IA', 'nav.travel': 'Viaggi', 'nav.places': 'Luoghi',
    'profile.guest': 'Ospite', 'profile.notSignedIn': 'Non connesso',
    'profile.edit': 'Modifica profilo', 'profile.safety': 'Sicurezza viaggio',
    'profile.replayTour': 'Rivedi il tour', 'profile.signOut': 'Esci',
    'profile.language': 'Lingua',
    'common.back': 'Indietro', 'common.cancel': 'Annulla', 'common.save': 'Salva', 'common.done': 'Fatto',
  },
  ja: {
    'nav.home': 'ホーム', 'nav.ai': 'AI', 'nav.travel': '旅行', 'nav.places': 'スポット',
    'profile.guest': 'ゲスト', 'profile.notSignedIn': '未ログイン',
    'profile.edit': 'プロフィール編集', 'profile.safety': '旅の安全',
    'profile.replayTour': 'ツアーを再生', 'profile.signOut': 'ログアウト',
    'profile.language': '言語',
    'common.back': '戻る', 'common.cancel': 'キャンセル', 'common.save': '保存', 'common.done': '完了',
  },
  zh: {
    'nav.home': '首页', 'nav.ai': 'AI', 'nav.travel': '旅行', 'nav.places': '地点',
    'profile.guest': '访客', 'profile.notSignedIn': '未登录',
    'profile.edit': '编辑个人资料', 'profile.safety': '旅行安全',
    'profile.replayTour': '重新播放教程', 'profile.signOut': '退出',
    'profile.language': '语言',
    'common.back': '返回', 'common.cancel': '取消', 'common.save': '保存', 'common.done': '完成',
  },
  ar: {
    'nav.home': 'الرئيسية', 'nav.ai': 'ذكاء', 'nav.travel': 'السفر', 'nav.places': 'الأماكن',
    'profile.guest': 'ضيف', 'profile.notSignedIn': 'غير مسجل',
    'profile.edit': 'تعديل الملف', 'profile.safety': 'سلامة السفر',
    'profile.replayTour': 'إعادة الجولة', 'profile.signOut': 'تسجيل الخروج',
    'profile.language': 'اللغة',
    'common.back': 'رجوع', 'common.cancel': 'إلغاء', 'common.save': 'حفظ', 'common.done': 'تم',
  },
  hi: {
    'nav.home': 'होम', 'nav.ai': 'एआई', 'nav.travel': 'यात्रा', 'nav.places': 'स्थान',
    'profile.guest': 'अतिथि', 'profile.notSignedIn': 'साइन इन नहीं',
    'profile.edit': 'प्रोफ़ाइल संपादित करें', 'profile.safety': 'यात्रा सुरक्षा',
    'profile.replayTour': 'टूर दोबारा देखें', 'profile.signOut': 'साइन आउट',
    'profile.language': 'भाषा',
    'common.back': 'वापस', 'common.cancel': 'रद्द', 'common.save': 'सहेजें', 'common.done': 'हो गया',
  },
  ko: {
    'nav.home': '홈', 'nav.ai': 'AI', 'nav.travel': '여행', 'nav.places': '장소',
    'profile.guest': '게스트', 'profile.notSignedIn': '로그인 안 됨',
    'profile.edit': '프로필 편집', 'profile.safety': '여행 안전',
    'profile.replayTour': '튜토리얼 다시 보기', 'profile.signOut': '로그아웃',
    'profile.language': '언어',
    'common.back': '뒤로', 'common.cancel': '취소', 'common.save': '저장', 'common.done': '완료',
  },
  ru: {
    'nav.home': 'Главная', 'nav.ai': 'ИИ', 'nav.travel': 'Поездки', 'nav.places': 'Места',
    'profile.guest': 'Гость', 'profile.notSignedIn': 'Не выполнен вход',
    'profile.edit': 'Редактировать профиль', 'profile.safety': 'Безопасность',
    'profile.replayTour': 'Повторить обзор', 'profile.signOut': 'Выйти',
    'profile.language': 'Язык',
    'common.back': 'Назад', 'common.cancel': 'Отмена', 'common.save': 'Сохранить', 'common.done': 'Готово',
  },
};

interface I18nContextValue {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'kip_lang';

function detectInitialLang(): LangCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as LangCode | null;
    if (saved && DICTIONARIES[saved]) return saved;
  } catch { /* ignore */ }
  const nav = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2).toLowerCase() : 'en';
  return (DICTIONARIES as Record<string, Dict>)[nav] ? (nav as LangCode) : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(detectInitialLang);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => ({
    lang,
    setLang: setLangState,
    t: (key, fallback) => DICTIONARIES[lang]?.[key] ?? DICTIONARIES.en[key] ?? fallback ?? key,
  }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback if used outside provider
    return {
      lang: 'en',
      setLang: () => {},
      t: (key, fallback) => DICTIONARIES.en[key] ?? fallback ?? key,
    };
  }
  return ctx;
}
