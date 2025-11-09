-- Fix all RLS policies to use the new text-based role system

-- Drop all old policies that use has_role with app_role enum
-- tours table
DROP POLICY IF EXISTS "Admins can manage all tours" ON tours;
DROP POLICY IF EXISTS "Agents can view tours" ON tours;
DROP POLICY IF EXISTS "Managers can manage all tours" ON tours;

-- bookings table  
DROP POLICY IF EXISTS "Admins can manage all bookings" ON bookings;
DROP POLICY IF EXISTS "Agents can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Booking agents can manage bookings" ON bookings;
DROP POLICY IF EXISTS "Managers can manage all bookings" ON bookings;

-- customers table
DROP POLICY IF EXISTS "Admins can insert customers" ON customers;
DROP POLICY IF EXISTS "Admins can manage all customers" ON customers;
DROP POLICY IF EXISTS "Agents can view all customers" ON customers;
DROP POLICY IF EXISTS "Booking agents can access assigned customers only" ON customers;
DROP POLICY IF EXISTS "Booking agents can create customers" ON customers;
DROP POLICY IF EXISTS "Booking agents can update assigned customers only" ON customers;
DROP POLICY IF EXISTS "Managers can delete customers" ON customers;
DROP POLICY IF EXISTS "Managers can insert customers" ON customers;
DROP POLICY IF EXISTS "Managers can update all customers" ON customers;

-- hotels table
DROP POLICY IF EXISTS "Admins can manage all hotels" ON hotels;
DROP POLICY IF EXISTS "Booking agents can view hotels" ON hotels;
DROP POLICY IF EXISTS "Managers can manage all hotels" ON hotels;

-- activities table
DROP POLICY IF EXISTS "Admins can manage all activities" ON activities;
DROP POLICY IF EXISTS "Booking agents can manage activities" ON activities;
DROP POLICY IF EXISTS "Managers can manage all activities" ON activities;

-- activity_bookings table
DROP POLICY IF EXISTS "Admins can manage all activity bookings" ON activity_bookings;
DROP POLICY IF EXISTS "Booking agents can manage activity bookings" ON activity_bookings;
DROP POLICY IF EXISTS "Managers can manage all activity bookings" ON activity_bookings;

-- hotel_bookings table
DROP POLICY IF EXISTS "Admins can manage all hotel bookings" ON hotel_bookings;
DROP POLICY IF EXISTS "Booking agents can manage hotel bookings" ON hotel_bookings;
DROP POLICY IF EXISTS "Managers can manage all hotel bookings" ON hotel_bookings;

-- booking_comments table
DROP POLICY IF EXISTS "Only authorized users can create booking comments" ON booking_comments;
DROP POLICY IF EXISTS "Only authorized users can view booking comments" ON booking_comments;

-- tour_itineraries table
DROP POLICY IF EXISTS "Users with tour access can create itineraries" ON tour_itineraries;
DROP POLICY IF EXISTS "Users with tour access can delete itineraries" ON tour_itineraries;
DROP POLICY IF EXISTS "Users with tour access can update itineraries" ON tour_itineraries;
DROP POLICY IF EXISTS "Users with tour access can view itineraries" ON tour_itineraries;

-- tour_itinerary_days table
DROP POLICY IF EXISTS "Users can manage itinerary days" ON tour_itinerary_days;

-- tour_itinerary_entries table
DROP POLICY IF EXISTS "Users can manage itinerary entries" ON tour_itinerary_entries;
DROP POLICY IF EXISTS "Users can view itinerary entries" ON tour_itinerary_entries;

-- tour_external_links table
DROP POLICY IF EXISTS "Users can delete tour external links they created or admins can" ON tour_external_links;
DROP POLICY IF EXISTS "Users can update tour external links they created or admins can" ON tour_external_links;

-- tour_attachments table
DROP POLICY IF EXISTS "Only authorized users can view tour attachments" ON tour_attachments;

-- email_events table
DROP POLICY IF EXISTS "Users can view email events" ON email_events;

-- crm_integration_settings table
DROP POLICY IF EXISTS "Admins can manage CRM settings" ON crm_integration_settings;

-- crm_sync_log table
DROP POLICY IF EXISTS "Admins can delete CRM sync logs" ON crm_sync_log;
DROP POLICY IF EXISTS "Admins can view CRM sync logs" ON crm_sync_log;

-- capacity_monitoring_rules table
DROP POLICY IF EXISTS "Admins can manage capacity monitoring rules" ON capacity_monitoring_rules;
DROP POLICY IF EXISTS "Managers can view capacity monitoring rules" ON capacity_monitoring_rules;

-- booking_assignments table
DROP POLICY IF EXISTS "Agents can view their own assignments" ON booking_assignments;
DROP POLICY IF EXISTS "Managers and admins can create assignments" ON booking_assignments;
DROP POLICY IF EXISTS "Managers and admins can delete assignments" ON booking_assignments;
DROP POLICY IF EXISTS "Managers and admins can update assignments" ON booking_assignments;

-- user_roles table
DROP POLICY IF EXISTS "Only admin can delete user roles" ON user_roles;
DROP POLICY IF EXISTS "Only admin can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Only admin can update user roles" ON user_roles;

-- Create new RLS policies using check_user_role function

-- Tours table
CREATE POLICY "Admins can manage all tours"
ON tours FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'admin'))
WITH CHECK (check_user_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can manage all tours"
ON tours FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'manager'))
WITH CHECK (check_user_role(auth.uid(), 'manager'));

CREATE POLICY "Agents can view tours"
ON tours FOR SELECT TO authenticated
USING (check_user_role(auth.uid(), 'agent'));

-- Bookings table
CREATE POLICY "Admins can manage all bookings"
ON bookings FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'admin'))
WITH CHECK (check_user_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can manage all bookings"
ON bookings FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'manager'))
WITH CHECK (check_user_role(auth.uid(), 'manager'));

CREATE POLICY "Booking agents can manage bookings"
ON bookings FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'booking_agent'))
WITH CHECK (check_user_role(auth.uid(), 'booking_agent'));

CREATE POLICY "Agents can view all bookings"
ON bookings FOR SELECT TO authenticated
USING (check_user_role(auth.uid(), 'agent'));

-- Customers table
CREATE POLICY "Admins can manage all customers"
ON customers FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'admin'))
WITH CHECK (check_user_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can manage all customers"
ON customers FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'manager'))
WITH CHECK (check_user_role(auth.uid(), 'manager'));

CREATE POLICY "Booking agents can create customers"
ON customers FOR INSERT TO authenticated
WITH CHECK (check_user_role(auth.uid(), 'booking_agent'));

CREATE POLICY "Booking agents can update customers"
ON customers FOR UPDATE TO authenticated
USING (check_user_role(auth.uid(), 'booking_agent'))
WITH CHECK (check_user_role(auth.uid(), 'booking_agent'));

CREATE POLICY "Agents can view all customers"
ON customers FOR SELECT TO authenticated
USING (check_user_role(auth.uid(), 'agent'));

-- Hotels table
CREATE POLICY "Admins can manage all hotels"
ON hotels FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'admin'))
WITH CHECK (check_user_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can manage all hotels"
ON hotels FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'manager'))
WITH CHECK (check_user_role(auth.uid(), 'manager'));

CREATE POLICY "Booking agents can view hotels"
ON hotels FOR SELECT TO authenticated
USING (check_user_role(auth.uid(), 'booking_agent'));

-- Activities table
CREATE POLICY "Admins can manage all activities"
ON activities FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'admin'))
WITH CHECK (check_user_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can manage all activities"
ON activities FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'manager'))
WITH CHECK (check_user_role(auth.uid(), 'manager'));

CREATE POLICY "Booking agents can manage activities"
ON activities FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'booking_agent'))
WITH CHECK (check_user_role(auth.uid(), 'booking_agent'));

-- Activity bookings table
CREATE POLICY "Admins can manage all activity bookings"
ON activity_bookings FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'admin'))
WITH CHECK (check_user_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can manage all activity bookings"
ON activity_bookings FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'manager'))
WITH CHECK (check_user_role(auth.uid(), 'manager'));

CREATE POLICY "Booking agents can manage activity bookings"
ON activity_bookings FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'booking_agent'))
WITH CHECK (check_user_role(auth.uid(), 'booking_agent'));

-- Hotel bookings table
CREATE POLICY "Admins can manage all hotel bookings"
ON hotel_bookings FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'admin'))
WITH CHECK (check_user_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can manage all hotel bookings"
ON hotel_bookings FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'manager'))
WITH CHECK (check_user_role(auth.uid(), 'manager'));

CREATE POLICY "Booking agents can manage hotel bookings"
ON hotel_bookings FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'booking_agent'))
WITH CHECK (check_user_role(auth.uid(), 'booking_agent'));

-- Booking comments table
CREATE POLICY "Authorized users can create booking comments"
ON booking_comments FOR INSERT TO authenticated
WITH CHECK (
  (check_user_role(auth.uid(), 'admin') OR 
   check_user_role(auth.uid(), 'manager') OR 
   check_user_role(auth.uid(), 'booking_agent')) AND
  auth.uid() = user_id
);

CREATE POLICY "Authorized users can view booking comments"
ON booking_comments FOR SELECT TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
);

-- Tour itineraries table
CREATE POLICY "Users with tour access can manage itineraries"
ON tour_itineraries FOR ALL TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
)
WITH CHECK (
  (check_user_role(auth.uid(), 'admin') OR 
   check_user_role(auth.uid(), 'manager') OR 
   check_user_role(auth.uid(), 'booking_agent')) AND
  auth.uid() = created_by
);

-- Tour itinerary days table
CREATE POLICY "Users can manage itinerary days"
ON tour_itinerary_days FOR ALL TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
)
WITH CHECK (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
);

-- Tour itinerary entries table
CREATE POLICY "Users can manage itinerary entries"
ON tour_itinerary_entries FOR ALL TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
)
WITH CHECK (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
);

-- Tour external links table
CREATE POLICY "Users can manage tour external links"
ON tour_external_links FOR UPDATE TO authenticated
USING (auth.uid() = created_by OR check_user_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete tour external links"
ON tour_external_links FOR DELETE TO authenticated
USING (auth.uid() = created_by OR check_user_role(auth.uid(), 'admin'));

-- Tour attachments table
CREATE POLICY "Authorized users can view tour attachments"
ON tour_attachments FOR SELECT TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
);

-- Email events table
CREATE POLICY "Authorized users can view email events"
ON email_events FOR SELECT TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager') OR 
  check_user_role(auth.uid(), 'booking_agent')
);

-- CRM integration settings table
CREATE POLICY "Admins can manage CRM settings"
ON crm_integration_settings FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'admin'))
WITH CHECK (check_user_role(auth.uid(), 'admin'));

-- CRM sync log table
CREATE POLICY "Admins can manage CRM sync logs"
ON crm_sync_log FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'admin'));

-- Capacity monitoring rules table
CREATE POLICY "Admins can manage capacity monitoring rules"
ON capacity_monitoring_rules FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'admin'))
WITH CHECK (check_user_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view capacity monitoring rules"
ON capacity_monitoring_rules FOR SELECT TO authenticated
USING (check_user_role(auth.uid(), 'manager'));

-- Booking assignments table
CREATE POLICY "Users can view booking assignments"
ON booking_assignments FOR SELECT TO authenticated
USING (
  auth.uid() = agent_id OR 
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager')
);

CREATE POLICY "Admins and managers can manage booking assignments"
ON booking_assignments FOR ALL TO authenticated
USING (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager')
)
WITH CHECK (
  check_user_role(auth.uid(), 'admin') OR 
  check_user_role(auth.uid(), 'manager')
);

-- User roles table
CREATE POLICY "Admins can manage user roles"
ON user_roles FOR ALL TO authenticated
USING (check_user_role(auth.uid(), 'admin'))
WITH CHECK (check_user_role(auth.uid(), 'admin'));