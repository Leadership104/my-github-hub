CREATE TABLE public.business_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  phone TEXT,
  website TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.business_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own business listings"
ON public.business_listings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Approved listings are viewable by everyone"
ON public.business_listings FOR SELECT
USING (status = 'approved');

CREATE POLICY "Users can create their own business listings"
ON public.business_listings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own business listings"
ON public.business_listings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own business listings"
ON public.business_listings FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_business_listings_updated_at
BEFORE UPDATE ON public.business_listings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_business_listings_user_id ON public.business_listings(user_id);
CREATE INDEX idx_business_listings_status ON public.business_listings(status);