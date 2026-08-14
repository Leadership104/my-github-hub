import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import kipitaLogo from '../assets/kipita-icon.png';

type AuthorizationDetails = {
  client?: { name?: string; client_name?: string; client_uri?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

/** Consent screen Supabase redirects to when an MCP client requests access. */
export default function OAuthConsentScreen() {
  const params = new URLSearchParams(window.location.search);
  const authorizationId = params.get('authorization_id') ?? '';
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) { setError('Missing authorization_id'); return; }
      const { data, error: err } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (err) { setError(err.message); return; }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) { window.location.href = immediate; return; }
      setDetails(data);
    })().catch((e) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => { active = false; };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (err) { setBusy(false); setError(err.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError('No redirect returned by the authorization server.'); return; }
    window.location.href = target;
  };

  const clientName = details?.client?.name ?? details?.client?.client_name ?? 'an app';

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm text-center">
        <img src={kipitaLogo} alt="Kipita" className="h-12 w-auto mx-auto mb-4" />
        {error ? (
          <>
            <h1 className="text-xl font-extrabold text-kipita-navy">Authorization failed</h1>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
          </>
        ) : !details ? (
          <p className="text-sm text-muted-foreground">Loading authorization request…</p>
        ) : (
          <>
            <h1 className="text-xl font-extrabold text-kipita-navy">
              Connect {clientName} to your account
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {clientName} will be able to search places, read weather, and read or add your saved
              locations and business listings as you.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                disabled={busy}
                onClick={() => decide(true)}
                className="w-full rounded-xl bg-kipita-navy text-white font-bold py-3 disabled:opacity-60"
              >
                {busy ? 'Working…' : 'Approve'}
              </button>
              <button
                disabled={busy}
                onClick={() => decide(false)}
                className="w-full rounded-xl border border-border font-semibold py-3 disabled:opacity-60"
              >
                Deny
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
