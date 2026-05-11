import { useState } from 'react';
import kipitaLogo from '../assets/kipita-icon.png';

const APP_PASSWORD = 'KipitaAI';
const STORAGE_KEY = 'kip_unlocked';

export function isAppUnlocked(): boolean {
  if (typeof window === 'undefined') return true;
  return sessionStorage.getItem(STORAGE_KEY) === '1';
}

export default function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd === APP_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, '1');
      onUnlock();
    } else {
      setErr(true);
      setPwd('');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background px-6">
      <img src={kipitaLogo} alt="Kipita" className="w-20 h-20 mb-4 rounded-2xl" />
      <h1 className="text-xl font-bold text-foreground mb-1">Kipita Locked</h1>
      <p className="text-sm text-muted-foreground mb-6">Enter password to continue</p>
      <form onSubmit={submit} className="w-full max-w-xs flex flex-col gap-3">
        <input
          autoFocus
          type="password"
          value={pwd}
          onChange={(e) => { setPwd(e.target.value); setErr(false); }}
          placeholder="Password"
          className={`w-full rounded-xl border px-4 py-3 bg-card text-foreground text-base outline-none focus:ring-2 focus:ring-kipita-red ${err ? 'border-destructive' : 'border-border'}`}
        />
        {err && <p className="text-xs text-destructive text-center">Incorrect password</p>}
        <button
          type="submit"
          className="w-full rounded-xl bg-kipita-red text-white font-semibold py-3 active:opacity-80"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
