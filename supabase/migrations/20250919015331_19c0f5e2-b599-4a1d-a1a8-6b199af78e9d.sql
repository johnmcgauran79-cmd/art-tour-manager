-- Create tour_itineraries table for storing itinerary data
CREATE TABLE public.tour_itineraries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  title TEXT,
  notes TEXT
);

-- Create tour_itinerary_days table for storing daily entries
CREATE TABLE public.tour_itinerary_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  itinerary_id UUID NOT NULL,
  day_number INTEGER NOT NULL,
  activity_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tour_itinerary_entries table for storing time-based entries within each day
CREATE TABLE public.tour_itinerary_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_id UUID NOT NULL,
  time_slot TIME,
  subject TEXT NOT NULL,
  content TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tour_itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_itinerary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_itinerary_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tour_itineraries
CREATE POLICY "Users with tour access can view itineraries"
ON public.tour_itineraries
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'booking_agent'::app_role)
);

CREATE POLICY "Users with tour access can create itineraries"
ON public.tour_itineraries
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR 
   has_role(auth.uid(), 'manager'::app_role) OR 
   has_role(auth.uid(), 'booking_agent'::app_role)) AND
  auth.uid() = created_by
);

CREATE POLICY "Users with tour access can update itineraries"
ON public.tour_itineraries
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'booking_agent'::app_role)
);

CREATE POLICY "Users with tour access can delete itineraries"
ON public.tour_itineraries
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Create RLS policies for tour_itinerary_days
CREATE POLICY "Users can view itinerary days"
ON public.tour_itinerary_days
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'booking_agent'::app_role)
);

CREATE POLICY "Users can manage itinerary days"
ON public.tour_itinerary_days
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'booking_agent'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'booking_agent'::app_role)
);

-- Create RLS policies for tour_itinerary_entries
CREATE POLICY "Users can view itinerary entries"
ON public.tour_itinerary_entries
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'booking_agent'::app_role)
);

CREATE POLICY "Users can manage itinerary entries"
ON public.tour_itinerary_entries
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'booking_agent'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'booking_agent'::app_role)
);

-- Create trigger for updated_at columns
CREATE TRIGGER update_tour_itineraries_updated_at
  BEFORE UPDATE ON public.tour_itineraries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tour_itinerary_days_updated_at
  BEFORE UPDATE ON public.tour_itinerary_days
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tour_itinerary_entries_updated_at
  BEFORE UPDATE ON public.tour_itinerary_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_tour_itineraries_tour_id ON public.tour_itineraries(tour_id);
CREATE INDEX idx_tour_itineraries_current ON public.tour_itineraries(tour_id, is_current) WHERE is_current = true;
CREATE INDEX idx_tour_itinerary_days_itinerary_id ON public.tour_itinerary_days(itinerary_id);
CREATE INDEX idx_tour_itinerary_days_date ON public.tour_itinerary_days(activity_date);
CREATE INDEX idx_tour_itinerary_entries_day_id ON public.tour_itinerary_entries(day_id);
CREATE INDEX idx_tour_itinerary_entries_sort ON public.tour_itinerary_entries(day_id, sort_order);