
-- 1) business_listings: prevent users from setting status themselves
DROP POLICY IF EXISTS "Users can create their own business listings" ON public.business_listings;
DROP POLICY IF EXISTS "Users can update their own business listings" ON public.business_listings;

CREATE POLICY "Users can create their own business listings"
ON public.business_listings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Users can update their own business listings"
ON public.business_listings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- 2) signup_notifications: explicit deny-all to authenticated/anon; service role bypasses RLS
CREATE POLICY "Deny all client access to signup notifications"
ON public.signup_notifications
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);
