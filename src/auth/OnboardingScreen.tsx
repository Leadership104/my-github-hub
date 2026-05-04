import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import kipitaLogo from '@/assets/kipita-icon.png';

const COMMON_COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France',
  'Spain', 'Portugal', 'Mexico', 'Brazil', 'Japan', 'Thailand', 'Singapore', 'India',
];

export default function OnboardingScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [homeCountry, setHomeCountry] = useState(profile?.home_country || '');
  const [homeCity, setHomeCity] = useState(profile?.home_city || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true); setError(null);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        home_country: homeCountry.trim() || null,
        home_city: homeCity.trim() || null,
        onboarded: true,
      })
      .eq('user_id', user.id);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    await refreshProfile();
    setBusy(false);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src={kipitaLogo} alt="Kipita" className="h-12 w-auto mb-3" />
          <h1 className="text-2xl font-extrabold text-kipita-navy">Tell us about you</h1>
          <p className="text-xs text-muted-foreground mt-1 text-center">
            Just a couple of details so we can tailor your experience.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground">Display name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full mt-1 px-3 py-2.5 bg-card border border-border rounded-kipita-sm text-sm outline-none focus:border-kipita-red"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Home country</label>
            <input
              list="countries"
              value={homeCountry}
              onChange={e => setHomeCountry(e.target.value)}
              placeholder="e.g. United States"
              className="w-full mt-1 px-3 py-2.5 bg-card border border-border rounded-kipita-sm text-sm outline-none focus:border-kipita-red"
            />
            <datalist id="countries">
              {COMMON_COUNTRIES.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Home city <span className="font-normal text-muted-foreground/70">(optional)</span></label>
            <input
              type="text"
              value={homeCity}
              onChange={e => setHomeCity(e.target.value)}
              placeholder="e.g. New York"
              className="w-full mt-1 px-3 py-2.5 bg-card border border-border rounded-kipita-sm text-sm outline-none focus:border-kipita-red"
            />
          </div>

          {error && <div className="text-xs text-kipita-red bg-kipita-red/10 rounded-kipita-sm p-2">{error}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-kipita-red text-white rounded-kipita-sm py-3 text-sm font-extrabold hover:opacity-95 disabled:opacity-60 active:scale-[0.99] transition mt-2"
          >
            {busy ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
