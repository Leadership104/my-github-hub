import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import kipitaLogo from '@/assets/kipita-icon.png';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash automatically and emits PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setRecoveryReady(true);
    });
    // Also handle cold-load: if hash already processed, getSession will return one.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setRecoveryReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setBusy(false); return; }
    setDone(true);
    setBusy(false);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src={kipitaLogo} alt="Kipita" className="h-12 w-auto mb-3" />
          <h1 className="text-2xl font-extrabold text-kipita-navy">Set a new password</h1>
        </div>

        {done ? (
          <div className="text-center space-y-4">
            <div className="text-sm text-kipita-green">Password updated.</div>
            <a href="/" className="inline-block bg-kipita-red text-white rounded-kipita-sm py-2.5 px-4 text-sm font-bold">
              Continue to app
            </a>
          </div>
        ) : !recoveryReady ? (
          <div className="text-center text-sm text-muted-foreground">Verifying reset link…</div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground">New password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 bg-card border border-border rounded-kipita-sm text-sm outline-none focus:border-kipita-red"
              />
            </div>
            {error && <div className="text-xs text-kipita-red bg-kipita-red/10 rounded-kipita-sm p-2">{error}</div>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-kipita-red text-white rounded-kipita-sm py-3 text-sm font-extrabold disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
