
-- Table to track Tour Ops Report reviews with data snapshot for field-level change detection
CREATE TABLE public.tour_ops_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  reviewed_by UUID NOT NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Only keep the latest review per tour
CREATE UNIQUE INDEX idx_tour_ops_reviews_tour_id ON public.tour_ops_reviews(tour_id);

-- Enable RLS
ALTER TABLE public.tour_ops_reviews ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view reviews
CREATE POLICY "Authenticated users can view tour ops reviews"
ON public.tour_ops_reviews
FOR SELECT
TO authenticated
USING (true);

-- All authenticated users can insert reviews
CREATE POLICY "Authenticated users can insert tour ops reviews"
ON public.tour_ops_reviews
FOR INSERT
TO authenticated
WITH CHECK (true);

-- All authenticated users can update reviews (upsert)
CREATE POLICY "Authenticated users can update tour ops reviews"
ON public.tour_ops_reviews
FOR UPDATE
TO authenticated
USING (true);
