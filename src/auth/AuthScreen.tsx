import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import kipitaLogo from '@/assets/kipita-icon.png';

type Mode = 'signin' | 'signup' | 'forgot';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null); setBusy(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: displayName || email.split('@')[0] },
          },
        });
        if (error) throw error;
        setInfo('Check your email to confirm your account, then sign in.');
        setMode('signin');
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setInfo('Password reset link sent. Check your inbox.');
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null); setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      // If redirected, browser navigates away; otherwise session is set.
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src={kipitaLogo} alt="Kipita" className="h-14 w-auto mb-3" />
          <h1 className="text-2xl font-extrabold text-kipita-navy">
            {mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset password' : 'Welcome back'}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 text-center">
            {mode === 'signup' ? 'Start exploring with Kipita.' : mode === 'forgot' ? "We'll email you a reset link." : 'Sign in to continue your journey.'}
          </p>
        </div>

        {mode !== 'forgot' && (
          <>
            <button
              onClick={handleGoogle}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-white border border-border rounded-kipita-sm py-3 text-sm font-bold text-foreground hover:bg-muted transition-colors disabled:opacity-60 mb-3"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.62z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.95 10.7a5.41 5.41 0 0 1 0-3.4V4.97H.96a9 9 0 0 0 0 8.06l2.99-2.33z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>
            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground font-bold uppercase">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-bold text-muted-foreground">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Alex"
                className="w-full mt-1 px-3 py-2.5 bg-card border border-border rounded-kipita-sm text-sm outline-none focus:border-kipita-red"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-muted-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full mt-1 px-3 py-2.5 bg-card border border-border rounded-kipita-sm text-sm outline-none focus:border-kipita-red"
            />
          </div>
          {mode !== 'forgot' && (
            <div>
              <label className="text-xs font-bold text-muted-foreground">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full mt-1 px-3 py-2.5 bg-card border border-border rounded-kipita-sm text-sm outline-none focus:border-kipita-red"
              />
            </div>
          )}

          {error && <div className="text-xs text-kipita-red bg-kipita-red/10 rounded-kipita-sm p-2">{error}</div>}
          {info && <div className="text-xs text-kipita-green bg-kipita-green/10 rounded-kipita-sm p-2">{info}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-kipita-red text-white rounded-kipita-sm py-3 text-sm font-extrabold hover:opacity-95 disabled:opacity-60 active:scale-[0.99] transition"
          >
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            localStorage.setItem('kip_guest', '1');
            window.dispatchEvent(new Event('kip-guest-changed'));
          }}
          className="w-full mt-3 bg-card border border-border rounded-kipita-sm py-3 text-sm font-bold text-foreground hover:bg-muted transition"
        >
          Continue as guest
        </button>

        <div className="mt-5 text-center text-xs text-muted-foreground space-y-1.5">
          {mode === 'signin' && (
            <>
              <button onClick={() => { setMode('forgot'); setError(null); setInfo(null); }} className="text-kipita-red font-semibold">
                Forgot password?
              </button>
              <div>
                New here?{' '}
                <button onClick={() => { setMode('signup'); setError(null); setInfo(null); }} className="text-kipita-red font-semibold">
                  Create an account
                </button>
              </div>
            </>
          )}
          {mode === 'signup' && (
            <div>
              Already have an account?{' '}
              <button onClick={() => { setMode('signin'); setError(null); setInfo(null); }} className="text-kipita-red font-semibold">
                Sign in
              </button>
            </div>
          )}
          {mode === 'forgot' && (
            <button onClick={() => { setMode('signin'); setError(null); setInfo(null); }} className="text-kipita-red font-semibold">
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
