
CREATE TABLE public.signup_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  display_name text,
  email text NOT NULL,
  notified_email_to text,
  email_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_notifications ENABLE ROW LEVEL SECURITY;

-- No public read/write policies; only the service role (edge functions) may write.
