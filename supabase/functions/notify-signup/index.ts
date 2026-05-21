// Edge function: records every new signup so the Kipita team can follow up.
// When Lovable Emails is enabled for this project, the record is also forwarded
// to info@kipita.com via a transactional send. Until then, signups are still
// captured in public.signup_notifications.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FOLLOW_UP_EMAIL = 'info@kipita.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { firstName, displayName, email } = await req.json();
    if (!firstName || !email) {
      return new Response(JSON.stringify({ error: 'firstName and email are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1) Always persist the signup so the team has a follow-up list.
    await supabase.from('signup_notifications').insert({
      first_name: String(firstName).slice(0, 80),
      display_name: displayName ? String(displayName).slice(0, 120) : null,
      email: String(email).slice(0, 320),
      notified_email_to: FOLLOW_UP_EMAIL,
      email_sent: false,
    });

    // 2) Try to forward to info@kipita.com via the transactional email sender,
    //    if/when it has been scaffolded for this project.
    try {
      const { error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'signup-team-alert',
          recipientEmail: FOLLOW_UP_EMAIL,
          idempotencyKey: `signup-alert-${email}-${Date.now()}`,
          templateData: { firstName, displayName: displayName ?? null, email },
        },
      });
      if (!error) {
        await supabase.from('signup_notifications')
          .update({ email_sent: true })
          .eq('email', email)
          .order('created_at', { ascending: false })
          .limit(1);
      }
    } catch (_) {
      // email infra not yet set up — already captured in table
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('notify-signup error', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
