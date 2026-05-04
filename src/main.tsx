import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { I18nProvider } from './i18n';
import { AuthProvider, useAuth } from './auth/useAuth';
import AuthScreen from './auth/AuthScreen';
import OnboardingScreen from './auth/OnboardingScreen';
import ResetPasswordScreen from './auth/ResetPasswordScreen';
import kipitaSplash from './assets/kipita-splash.jpeg';

function AuthGate() {
  const { session, profile, loading } = useAuth();

  // Public route: password reset (must work without an active app session)
  if (typeof window !== 'undefined' && window.location.pathname === '/reset-password') {
    return <ResetPasswordScreen />;
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
        <img src={kipitaSplash} alt="Kipita" className="max-w-[60%] max-h-[60%] object-contain" />
      </div>
    );
  }

  if (!session) return <AuthScreen />;
  if (!profile?.onboarded) return <OnboardingScreen />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </I18nProvider>
  </React.StrictMode>
);
