export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_date: string | null
          activity_status: Database["public"]["Enums"]["activity_status"] | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          depart_for_activity: string | null
          dress_code: string | null
          driver_name: string | null
          driver_phone: string | null
          end_time: string | null
          hospitality_inclusions: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          operations_notes: string | null
          pickup_location_transport: string | null
          spots_available: number | null
          spots_booked: number | null
          spots_remaining: number | null
          start_time: string | null
          tour_id: string | null
          transport_company: string | null
          transport_contact_name: string | null
          transport_email: string | null
          transport_mode: string | null
          transport_notes: string | null
          transport_phone: string | null
          transport_status:
            | Database["public"]["Enums"]["transport_status"]
            | null
          updated_at: string | null
        }
        Insert: {
          activity_date?: string | null
          activity_status?:
            | Database["public"]["Enums"]["activity_status"]
            | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          depart_for_activity?: string | null
          dress_code?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          end_time?: string | null
          hospitality_inclusions?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          operations_notes?: string | null
          pickup_location_transport?: string | null
          spots_available?: number | null
          spots_booked?: number | null
          spots_remaining?: number | null
          start_time?: string | null
          tour_id?: string | null
          transport_company?: string | null
          transport_contact_name?: string | null
          transport_email?: string | null
          transport_mode?: string | null
          transport_notes?: string | null
          transport_phone?: string | null
          transport_status?:
            | Database["public"]["Enums"]["transport_status"]
            | null
          updated_at?: string | null
        }
        Update: {
          activity_date?: string | null
          activity_status?:
            | Database["public"]["Enums"]["activity_status"]
            | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          depart_for_activity?: string | null
          dress_code?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          end_time?: string | null
          hospitality_inclusions?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          operations_notes?: string | null
          pickup_location_transport?: string | null
          spots_available?: number | null
          spots_booked?: number | null
          spots_remaining?: number | null
          start_time?: string | null
          tour_id?: string | null
          transport_company?: string | null
          transport_contact_name?: string | null
          transport_email?: string | null
          transport_mode?: string | null
          transport_notes?: string | null
          transport_phone?: string | null
          transport_status?:
            | Database["public"]["Enums"]["transport_status"]
            | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_attachments: {
        Row: {
          activity_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          activity_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          activity_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_attachments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_bookings: {
        Row: {
          activity_id: string | null
          booking_id: string | null
          created_at: string | null
          id: string
          passengers_attending: number
          updated_at: string | null
        }
        Insert: {
          activity_id?: string | null
          booking_id?: string | null
          created_at?: string | null
          id?: string
          passengers_attending?: number
          updated_at?: string | null
        }
        Update: {
          activity_id?: string | null
          booking_id?: string | null
          created_at?: string | null
          id?: string
          passengers_attending?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_bookings_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_bookings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_journeys: {
        Row: {
          activity_id: string
          created_at: string
          destination: string | null
          id: string
          journey_number: number
          pickup_location: string | null
          pickup_time: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          destination?: string | null
          id?: string
          journey_number: number
          pickup_location?: string | null
          pickup_time?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          destination?: string | null
          id?: string
          journey_number?: number
          pickup_location?: string | null
          pickup_time?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_journeys_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          details: Json | null
          id: string
          operation_type: string
          record_id: string | null
          table_name: string
          timestamp: string | null
          user_id: string
        }
        Insert: {
          details?: Json | null
          id?: string
          operation_type: string
          record_id?: string | null
          table_name: string
          timestamp?: string | null
          user_id: string
        }
        Update: {
          details?: Json | null
          id?: string
          operation_type?: string
          record_id?: string | null
          table_name?: string
          timestamp?: string | null
          user_id?: string
        }
        Relationships: []
      }
      automated_email_log: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          booking_count: number | null
          booking_id: string | null
          days_before_send: number
          email_log_id: string | null
          id: string
          rejection_reason: string | null
          rule_id: string
          sent_at: string | null
          tour_id: string | null
          tour_start_date: string
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          booking_count?: number | null
          booking_id?: string | null
          days_before_send: number
          email_log_id?: string | null
          id?: string
          rejection_reason?: string | null
          rule_id: string
          sent_at?: string | null
          tour_id?: string | null
          tour_start_date: string
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          booking_count?: number | null
          booking_id?: string | null
          days_before_send?: number
          email_log_id?: string | null
          id?: string
          rejection_reason?: string | null
          rule_id?: string
          sent_at?: string | null
          tour_id?: string | null
          tour_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "automated_email_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automated_email_log_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automated_email_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automated_email_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automated_email_log_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      automated_email_rules: {
        Row: {
          created_at: string | null
          created_by: string
          days_before_tour: number
          email_template_id: string | null
          id: string
          is_active: boolean
          recipient_filter: string
          requires_approval: boolean
          rule_name: string
          rule_type: string
          status_filter: string[] | null
          trigger_conditions: Json | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          days_before_tour: number
          email_template_id?: string | null
          id?: string
          is_active?: boolean
          recipient_filter?: string
          requires_approval?: boolean
          rule_name: string
          rule_type?: string
          status_filter?: string[] | null
          trigger_conditions?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          days_before_tour?: number
          email_template_id?: string | null
          id?: string
          is_active?: boolean
          recipient_filter?: string
          requires_approval?: boolean
          rule_name?: string
          rule_type?: string
          status_filter?: string[] | null
          trigger_conditions?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automated_email_rules_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      automated_report_log: {
        Row: {
          error_message: string | null
          id: string
          recipient_emails: string[] | null
          report_types: string[] | null
          rule_id: string | null
          sent_at: string | null
          status: string | null
          tour_id: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          recipient_emails?: string[] | null
          report_types?: string[] | null
          rule_id?: string | null
          sent_at?: string | null
          status?: string | null
          tour_id?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          recipient_emails?: string[] | null
          report_types?: string[] | null
          rule_id?: string | null
          sent_at?: string | null
          status?: string | null
          tour_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automated_report_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automated_report_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automated_report_log_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      automated_report_rules: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          recipient_emails: string[]
          report_types: string[]
          rule_name: string
          schedule_type: string
          schedule_value: number
          tour_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          recipient_emails: string[]
          report_types: string[]
          rule_name: string
          schedule_type: string
          schedule_value: number
          tour_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          recipient_emails?: string[]
          report_types?: string[]
          rule_name?: string
          schedule_type?: string
          schedule_value?: number
          tour_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      booking_assignments: {
        Row: {
          agent_id: string
          assigned_at: string
          assigned_by: string
          booking_id: string
          id: string
          is_active: boolean
        }
        Insert: {
          agent_id: string
          assigned_at?: string
          assigned_by: string
          booking_id: string
          id?: string
          is_active?: boolean
        }
        Update: {
          agent_id?: string
          assigned_at?: string
          assigned_by?: string
          booking_id?: string
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "booking_assignments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_comments: {
        Row: {
          booking_id: string
          comment: string
          comment_type: string | null
          created_at: string
          id: string
          is_internal: boolean | null
          user_id: string
        }
        Insert: {
          booking_id: string
          comment: string
          comment_type?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean | null
          user_id: string
        }
        Update: {
          booking_id?: string
          comment?: string
          comment_type?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_travel_docs: {
        Row: {
          booking_id: string
          created_at: string
          customer_id: string | null
          date_of_birth: string | null
          id: string
          id_number: string | null
          name_as_per_passport: string | null
          nationality: string | null
          passenger_slot: number
          passport_country: string | null
          passport_expiry_date: string | null
          passport_first_name: string | null
          passport_middle_name: string | null
          passport_number: string | null
          passport_surname: string | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          customer_id?: string | null
          date_of_birth?: string | null
          id?: string
          id_number?: string | null
          name_as_per_passport?: string | null
          nationality?: string | null
          passenger_slot: number
          passport_country?: string | null
          passport_expiry_date?: string | null
          passport_first_name?: string | null
          passport_middle_name?: string | null
          passport_number?: string | null
          passport_surname?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          customer_id?: string | null
          date_of_birth?: string | null
          id?: string
          id_number?: string | null
          name_as_per_passport?: string | null
          nationality?: string | null
          passenger_slot?: number
          passport_country?: string | null
          passport_expiry_date?: string | null
          passport_first_name?: string | null
          passport_middle_name?: string | null
          passport_number?: string | null
          passport_surname?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_travel_docs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_travel_docs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_waivers: {
        Row: {
          booking_id: string
          created_at: string
          customer_id: string | null
          id: string
          ip_address: string | null
          passenger_slot: number
          signed_at: string
          signed_name: string
          token_id: string | null
          user_agent: string | null
          waiver_content: string
          waiver_version: number
        }
        Insert: {
          booking_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: string | null
          passenger_slot?: number
          signed_at?: string
          signed_name: string
          token_id?: string | null
          user_agent?: string | null
          waiver_content: string
          waiver_version?: number
        }
        Update: {
          booking_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: string | null
          passenger_slot?: number
          signed_at?: string
          signed_name?: string
          token_id?: string | null
          user_agent?: string | null
          waiver_content?: string
          waiver_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_waivers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_waivers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_waivers_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "customer_access_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          accommodation_required: boolean | null
          booking_agent: string | null
          booking_notes: string | null
          check_in_date: string | null
          check_out_date: string | null
          created_at: string | null
          group_name: string | null
          id: string
          id_number: string | null
          invoice_notes: string | null
          invoice_reference: string | null
          lead_passenger_id: string | null
          nationality: string | null
          passenger_2_id: string | null
          passenger_2_name: string | null
          passenger_3_id: string | null
          passenger_3_name: string | null
          passenger_count: number
          passport_country: string | null
          passport_expiry_date: string | null
          passport_number: string | null
          revenue: number | null
          secondary_contact_id: string | null
          selected_pickup_option_id: string | null
          split_invoice: boolean
          status: Database["public"]["Enums"]["booking_status"] | null
          total_nights: number | null
          tour_id: string | null
          updated_at: string | null
          whatsapp_group_comms: boolean
        }
        Insert: {
          accommodation_required?: boolean | null
          booking_agent?: string | null
          booking_notes?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string | null
          group_name?: string | null
          id?: string
          id_number?: string | null
          invoice_notes?: string | null
          invoice_reference?: string | null
          lead_passenger_id?: string | null
          nationality?: string | null
          passenger_2_id?: string | null
          passenger_2_name?: string | null
          passenger_3_id?: string | null
          passenger_3_name?: string | null
          passenger_count?: number
          passport_country?: string | null
          passport_expiry_date?: string | null
          passport_number?: string | null
          revenue?: number | null
          secondary_contact_id?: string | null
          selected_pickup_option_id?: string | null
          split_invoice?: boolean
          status?: Database["public"]["Enums"]["booking_status"] | null
          total_nights?: number | null
          tour_id?: string | null
          updated_at?: string | null
          whatsapp_group_comms?: boolean
        }
        Update: {
          accommodation_required?: boolean | null
          booking_agent?: string | null
          booking_notes?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string | null
          group_name?: string | null
          id?: string
          id_number?: string | null
          invoice_notes?: string | null
          invoice_reference?: string | null
          lead_passenger_id?: string | null
          nationality?: string | null
          passenger_2_id?: string | null
          passenger_2_name?: string | null
          passenger_3_id?: string | null
          passenger_3_name?: string | null
          passenger_count?: number
          passport_country?: string | null
          passport_expiry_date?: string | null
          passport_number?: string | null
          revenue?: number | null
          secondary_contact_id?: string | null
          selected_pickup_option_id?: string | null
          split_invoice?: boolean
          status?: Database["public"]["Enums"]["booking_status"] | null
          total_nights?: number | null
          tour_id?: string | null
          updated_at?: string | null
          whatsapp_group_comms?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bookings_lead_passenger_id_fkey"
            columns: ["lead_passenger_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_passenger_2_id_fkey"
            columns: ["passenger_2_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_passenger_3_id_fkey"
            columns: ["passenger_3_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_secondary_contact_id_fkey"
            columns: ["secondary_contact_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_selected_pickup_option_id_fkey"
            columns: ["selected_pickup_option_id"]
            isOneToOne: false
            referencedRelation: "tour_pickup_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_monitoring_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          rule_name: string
          rule_type: string
          task_category: Database["public"]["Enums"]["task_category"]
          task_description_template: string | null
          task_priority: Database["public"]["Enums"]["task_priority"]
          task_title_template: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          rule_name: string
          rule_type: string
          task_category?: Database["public"]["Enums"]["task_category"]
          task_description_template?: string | null
          task_priority?: Database["public"]["Enums"]["task_priority"]
          task_title_template: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          rule_name?: string
          rule_type?: string
          task_category?: Database["public"]["Enums"]["task_category"]
          task_description_template?: string | null
          task_priority?: Database["public"]["Enums"]["task_priority"]
          task_title_template?: string
        }
        Relationships: []
      }
      customer_access_tokens: {
        Row: {
          booking_id: string | null
          created_at: string
          created_by: string
          customer_id: string
          expires_at: string
          form_id: string | null
          id: string
          last_used_at: string | null
          purpose: string | null
          token: string
          use_count: number
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          expires_at?: string
          form_id?: string | null
          id?: string
          last_used_at?: string | null
          purpose?: string | null
          token?: string
          use_count?: number
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          expires_at?: string
          form_id?: string | null
          id?: string
          last_used_at?: string | null
          purpose?: string | null
          token?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_access_tokens_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_access_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_access_tokens_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "tour_custom_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profile_updates: {
        Row: {
          changes: Json
          customer_id: string
          id: string
          ip_address: string | null
          token_id: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          changes: Json
          customer_id: string
          id?: string
          ip_address?: string | null
          token_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          changes?: Json
          customer_id?: string
          id?: string
          ip_address?: string | null
          token_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_profile_updates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_profile_updates_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "customer_access_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          accessibility_needs: string | null
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string | null
          dietary_requirements: string | null
          email: string | null
          emergency_contact_email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          first_name: string
          id: string
          keap_contact_id: string | null
          last_name: string
          medical_conditions: string | null
          notes: string | null
          phone: string | null
          preferred_name: string | null
          spouse_name: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          accessibility_needs?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          dietary_requirements?: string | null
          email?: string | null
          emergency_contact_email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name: string
          id?: string
          keap_contact_id?: string | null
          last_name: string
          medical_conditions?: string | null
          notes?: string | null
          phone?: string | null
          preferred_name?: string | null
          spouse_name?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          accessibility_needs?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          dietary_requirements?: string | null
          email?: string | null
          emergency_contact_email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name?: string
          id?: string
          keap_contact_id?: string | null
          last_name?: string
          medical_conditions?: string | null
          notes?: string | null
          phone?: string | null
          preferred_name?: string | null
          spouse_name?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_events: {
        Row: {
          created_at: string
          email_log_id: string | null
          event_data: Json | null
          event_type: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          email_log_id?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string
          email_log_id?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_issue_acknowledgments: {
        Row: {
          acknowledged_at: string
          acknowledged_by: string
          created_at: string
          email_address: string | null
          email_log_id: string | null
          id: string
          issue_type: string
          last_event_at: string | null
        }
        Insert: {
          acknowledged_at?: string
          acknowledged_by: string
          created_at?: string
          email_address?: string | null
          email_log_id?: string | null
          id?: string
          issue_type: string
          last_event_at?: string | null
        }
        Update: {
          acknowledged_at?: string
          acknowledged_by?: string
          created_at?: string
          email_address?: string | null
          email_log_id?: string | null
          id?: string
          issue_type?: string
          last_event_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_issue_acknowledgments_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          message_id: string
          recipient_email: string
          recipient_name: string | null
          sent_at: string
          sent_by: string | null
          subject: string
          template_name: string | null
          tour_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          message_id: string
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string
          sent_by?: string | null
          subject: string
          template_name?: string | null
          tour_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          message_id?: string
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string
          sent_by?: string | null
          subject?: string
          template_name?: string | null
          tour_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          bounce_count: number
          created_at: string
          email_address: string
          first_bounced_at: string
          id: string
          is_active: boolean
          last_bounced_at: string
          reason: string | null
          suppression_type: string
        }
        Insert: {
          bounce_count?: number
          created_at?: string
          email_address: string
          first_bounced_at?: string
          id?: string
          is_active?: boolean
          last_bounced_at?: string
          reason?: string | null
          suppression_type?: string
        }
        Update: {
          bounce_count?: number
          created_at?: string
          email_address?: string
          first_bounced_at?: string
          id?: string
          is_active?: boolean
          last_bounced_at?: string
          reason?: string | null
          suppression_type?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          content_template: string
          created_at: string
          created_by: string
          from_email: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          subject_template: string
          type: string
          updated_at: string
        }
        Insert: {
          content_template: string
          created_at?: string
          created_by: string
          from_email?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          subject_template: string
          type: string
          updated_at?: string
        }
        Update: {
          content_template?: string
          created_at?: string
          created_by?: string
          from_email?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          subject_template?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      general_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      hotel_attachments: {
        Row: {
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          hotel_id: string
          id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          hotel_id: string
          id?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          hotel_id?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_attachments_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_bookings: {
        Row: {
          allocated: boolean | null
          bedding: Database["public"]["Enums"]["bedding_type"] | null
          booking_id: string | null
          check_in_date: string | null
          check_out_date: string | null
          confirmation_number: string | null
          created_at: string | null
          hotel_id: string | null
          id: string
          nights: number | null
          required: boolean | null
          room_requests: string | null
          room_type: string | null
          room_upgrade: string | null
          updated_at: string | null
        }
        Insert: {
          allocated?: boolean | null
          bedding?: Database["public"]["Enums"]["bedding_type"] | null
          booking_id?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          confirmation_number?: string | null
          created_at?: string | null
          hotel_id?: string | null
          id?: string
          nights?: number | null
          required?: boolean | null
          room_requests?: string | null
          room_type?: string | null
          room_upgrade?: string | null
          updated_at?: string | null
        }
        Update: {
          allocated?: boolean | null
          bedding?: Database["public"]["Enums"]["bedding_type"] | null
          booking_id?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          confirmation_number?: string | null
          created_at?: string | null
          hotel_id?: string | null
          id?: string
          nights?: number | null
          required?: boolean | null
          room_requests?: string | null
          room_type?: string | null
          room_upgrade?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_bookings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_bookings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          address: string | null
          booking_status:
            | Database["public"]["Enums"]["hotel_booking_status"]
            | null
          cancellation_policy: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contract_url: string | null
          created_at: string | null
          default_check_in: string | null
          default_check_out: string | null
          default_room_type: string | null
          extra_night_price: number | null
          final_rooms_cutoff_date: string | null
          id: string
          initial_rooms_cutoff_date: string | null
          name: string
          operations_notes: string | null
          rooms_available: number | null
          rooms_booked: number | null
          rooms_reserved: number | null
          tour_id: string | null
          updated_at: string | null
          upgrade_options: string | null
        }
        Insert: {
          address?: string | null
          booking_status?:
            | Database["public"]["Enums"]["hotel_booking_status"]
            | null
          cancellation_policy?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_url?: string | null
          created_at?: string | null
          default_check_in?: string | null
          default_check_out?: string | null
          default_room_type?: string | null
          extra_night_price?: number | null
          final_rooms_cutoff_date?: string | null
          id?: string
          initial_rooms_cutoff_date?: string | null
          name: string
          operations_notes?: string | null
          rooms_available?: number | null
          rooms_booked?: number | null
          rooms_reserved?: number | null
          tour_id?: string | null
          updated_at?: string | null
          upgrade_options?: string | null
        }
        Update: {
          address?: string | null
          booking_status?:
            | Database["public"]["Enums"]["hotel_booking_status"]
            | null
          cancellation_policy?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_url?: string | null
          created_at?: string | null
          default_check_in?: string | null
          default_check_out?: string | null
          default_room_type?: string | null
          extra_night_price?: number | null
          final_rooms_cutoff_date?: string | null
          id?: string
          initial_rooms_cutoff_date?: string | null
          name?: string
          operations_notes?: string | null
          rooms_available?: number | null
          rooms_booked?: number | null
          rooms_reserved?: number | null
          tour_id?: string | null
          updated_at?: string | null
          upgrade_options?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotels_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sync_dismissals: {
        Row: {
          amount_paid_at_dismissal: number | null
          booking_id: string
          current_status_at_dismissal: string
          dismissed_at: string
          dismissed_by: string
          id: string
          proposed_status: string
          reason: string | null
          xero_invoice_id: string
          xero_status_at_dismissal: string | null
        }
        Insert: {
          amount_paid_at_dismissal?: number | null
          booking_id: string
          current_status_at_dismissal: string
          dismissed_at?: string
          dismissed_by: string
          id?: string
          proposed_status: string
          reason?: string | null
          xero_invoice_id: string
          xero_status_at_dismissal?: string | null
        }
        Update: {
          amount_paid_at_dismissal?: number | null
          booking_id?: string
          current_status_at_dismissal?: string
          dismissed_at?: string
          dismissed_by?: string
          id?: string
          proposed_status?: string
          reason?: string | null
          xero_invoice_id?: string
          xero_status_at_dismissal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sync_dismissals_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      post_booking_email_log: {
        Row: {
          booking_id: string
          created_at: string | null
          email_log_id: string | null
          id: string
          rule_id: string
          sent_at: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          email_log_id?: string | null
          id?: string
          rule_id: string
          sent_at?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          email_log_id?: string | null
          id?: string
          rule_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_booking_email_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_booking_email_log_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_booking_email_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automated_email_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          must_change_password: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          must_change_password?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          must_change_password?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      status_change_email_queue: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          batch_date: string
          booking_id: string
          created_at: string
          email_log_id: string | null
          id: string
          new_status: string
          previous_status: string | null
          processed_at: string | null
          rejection_reason: string | null
          rule_id: string
          tour_id: string | null
          triggered_at: string
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          batch_date?: string
          booking_id: string
          created_at?: string
          email_log_id?: string | null
          id?: string
          new_status: string
          previous_status?: string | null
          processed_at?: string | null
          rejection_reason?: string | null
          rule_id: string
          tour_id?: string | null
          triggered_at?: string
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          batch_date?: string
          booking_id?: string
          created_at?: string
          email_log_id?: string | null
          id?: string
          new_status?: string
          previous_status?: string | null
          processed_at?: string | null
          rejection_reason?: string | null
          rule_id?: string
          tour_id?: string | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_change_email_queue_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_change_email_queue_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_change_email_queue_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automated_email_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_change_email_queue_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          task_id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          task_id: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          task_id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          category: Database["public"]["Enums"]["task_category"]
          created_at: string
          date_field_type: string | null
          days_before_tour: number | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          priority: Database["public"]["Enums"]["task_priority"]
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["task_category"]
          created_at?: string
          date_field_type?: string | null
          days_before_tour?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: Database["public"]["Enums"]["task_priority"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["task_category"]
          created_at?: string
          date_field_type?: string | null
          days_before_tour?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          automated_rule: string | null
          category: Database["public"]["Enums"]["task_category"]
          completed_at: string | null
          created_at: string
          created_by: string
          depends_on_task_id: string | null
          description: string | null
          due_date: string | null
          id: string
          is_automated: boolean
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          tour_id: string | null
          updated_at: string
          url_reference: string | null
        }
        Insert: {
          automated_rule?: string | null
          category?: Database["public"]["Enums"]["task_category"]
          completed_at?: string | null
          created_at?: string
          created_by: string
          depends_on_task_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_automated?: boolean
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          tour_id?: string | null
          updated_at?: string
          url_reference?: string | null
        }
        Update: {
          automated_rule?: string | null
          category?: Database["public"]["Enums"]["task_category"]
          completed_at?: string | null
          created_at?: string
          created_by?: string
          depends_on_task_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_automated?: boolean
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          tour_id?: string | null
          updated_at?: string
          url_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          activity_id: string | null
          alert_type: string
          booking_id: string | null
          created_at: string
          details: Json | null
          hotel_id: string | null
          id: string
          is_acknowledged: boolean
          message: string
          severity: string
          tour_id: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          activity_id?: string | null
          alert_type: string
          booking_id?: string | null
          created_at?: string
          details?: Json | null
          hotel_id?: string | null
          id?: string
          is_acknowledged?: boolean
          message: string
          severity?: string
          tour_id: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          activity_id?: string | null
          alert_type?: string
          booking_id?: string | null
          created_at?: string
          details?: Json | null
          hotel_id?: string | null
          id?: string
          is_acknowledged?: boolean
          message?: string
          severity?: string
          tour_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_alerts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_alerts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_alerts_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_alerts_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_attachments: {
        Row: {
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          tour_id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          tour_id: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          tour_id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_attachments_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_custom_form_fields: {
        Row: {
          created_at: string
          field_label: string
          field_options: Json | null
          field_type: string
          form_id: string
          id: string
          is_required: boolean
          placeholder: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_label: string
          field_options?: Json | null
          field_type: string
          form_id: string
          id?: string
          is_required?: boolean
          placeholder?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_label?: string
          field_options?: Json | null
          field_type?: string
          form_id?: string
          id?: string
          is_required?: boolean
          placeholder?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_custom_form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "tour_custom_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_custom_form_responses: {
        Row: {
          booking_id: string
          customer_id: string | null
          form_id: string
          id: string
          ip_address: string | null
          passenger_slot: number
          response_data: Json
          submitted_at: string
          token_id: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          booking_id: string
          customer_id?: string | null
          form_id: string
          id?: string
          ip_address?: string | null
          passenger_slot?: number
          response_data?: Json
          submitted_at?: string
          token_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          booking_id?: string
          customer_id?: string | null
          form_id?: string
          id?: string
          ip_address?: string | null
          passenger_slot?: number
          response_data?: Json
          submitted_at?: string
          token_id?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_custom_form_responses_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_custom_form_responses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_custom_form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "tour_custom_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_custom_form_responses_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "customer_access_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_custom_forms: {
        Row: {
          created_at: string
          created_by: string
          form_description: string | null
          form_title: string
          id: string
          is_published: boolean
          response_mode: string
          tour_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          form_description?: string | null
          form_title?: string
          id?: string
          is_published?: boolean
          response_mode?: string
          tour_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          form_description?: string | null
          form_title?: string
          id?: string
          is_published?: boolean
          response_mode?: string
          tour_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_custom_forms_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: true
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_external_links: {
        Row: {
          created_at: string
          created_by: string
          id: string
          label: string
          tour_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          label: string
          tour_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          tour_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      tour_host_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          host_user_id: string
          id: string
          notes: string | null
          tour_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          host_user_id: string
          id?: string
          notes?: string | null
          tour_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          host_user_id?: string
          id?: string
          notes?: string | null
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_host_assignments_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_itineraries: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_current: boolean
          notes: string | null
          title: string | null
          tour_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_current?: boolean
          notes?: string | null
          title?: string | null
          tour_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_current?: boolean
          notes?: string | null
          title?: string | null
          tour_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      tour_itinerary_days: {
        Row: {
          activity_date: string
          created_at: string
          day_number: number
          id: string
          itinerary_id: string
          updated_at: string
        }
        Insert: {
          activity_date: string
          created_at?: string
          day_number: number
          id?: string
          itinerary_id: string
          updated_at?: string
        }
        Update: {
          activity_date?: string
          created_at?: string
          day_number?: number
          id?: string
          itinerary_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tour_itinerary_entries: {
        Row: {
          content: string | null
          created_at: string
          day_id: string
          id: string
          sort_order: number
          subject: string
          time_slot: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          day_id: string
          id?: string
          sort_order?: number
          subject: string
          time_slot?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          day_id?: string
          id?: string
          sort_order?: number
          subject?: string
          time_slot?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tour_ops_reviews: {
        Row: {
          created_at: string
          data_snapshot: Json
          id: string
          reviewed_at: string
          reviewed_by: string
          tour_id: string
        }
        Insert: {
          created_at?: string
          data_snapshot?: Json
          id?: string
          reviewed_at?: string
          reviewed_by: string
          tour_id: string
        }
        Update: {
          created_at?: string
          data_snapshot?: Json
          id?: string
          reviewed_at?: string
          reviewed_by?: string
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_ops_reviews_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_pickup_options: {
        Row: {
          created_at: string
          details: string | null
          id: string
          name: string
          pickup_time: string | null
          sort_order: number
          tour_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          name: string
          pickup_time?: string | null
          sort_order?: number
          tour_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          name?: string
          pickup_time?: string | null
          sort_order?: number
          tour_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_pickup_options_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tours: {
        Row: {
          capacity: number | null
          created_at: string | null
          days: number
          deposit_required: number | null
          end_date: string
          exclusions: string | null
          final_payment_date: string | null
          host_flights_status: string | null
          id: string
          inclusions: string | null
          instalment_amount: number | null
          instalment_date: string | null
          instalment_details: string | null
          instalment_required: boolean
          keap_tag_id: string | null
          location: string | null
          minimum_passengers_required: number | null
          name: string
          nights: number
          notes: string | null
          ops_accomm_notes: string | null
          ops_activities_notes: string | null
          ops_dinner_notes: string | null
          ops_notes: string | null
          ops_other_notes: string | null
          ops_races_notes: string | null
          ops_transport_notes: string | null
          outbound_flight_date: string | null
          outbound_flight_number: string | null
          pickup_location_required: boolean
          pickup_point: string | null
          price_double: number | null
          price_single: number | null
          price_twin: number | null
          return_flight_date: string | null
          return_flight_number: string | null
          start_date: string
          status: Database["public"]["Enums"]["tour_status"] | null
          tour_host: string
          tour_hosts_notes: string | null
          tour_type: string | null
          travel_documents_required: boolean
          updated_at: string | null
          url_reference: string | null
          xero_product_id: string | null
          xero_reference: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          days: number
          deposit_required?: number | null
          end_date: string
          exclusions?: string | null
          final_payment_date?: string | null
          host_flights_status?: string | null
          id?: string
          inclusions?: string | null
          instalment_amount?: number | null
          instalment_date?: string | null
          instalment_details?: string | null
          instalment_required?: boolean
          keap_tag_id?: string | null
          location?: string | null
          minimum_passengers_required?: number | null
          name: string
          nights: number
          notes?: string | null
          ops_accomm_notes?: string | null
          ops_activities_notes?: string | null
          ops_dinner_notes?: string | null
          ops_notes?: string | null
          ops_other_notes?: string | null
          ops_races_notes?: string | null
          ops_transport_notes?: string | null
          outbound_flight_date?: string | null
          outbound_flight_number?: string | null
          pickup_location_required?: boolean
          pickup_point?: string | null
          price_double?: number | null
          price_single?: number | null
          price_twin?: number | null
          return_flight_date?: string | null
          return_flight_number?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["tour_status"] | null
          tour_host?: string
          tour_hosts_notes?: string | null
          tour_type?: string | null
          travel_documents_required?: boolean
          updated_at?: string | null
          url_reference?: string | null
          xero_product_id?: string | null
          xero_reference?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          days?: number
          deposit_required?: number | null
          end_date?: string
          exclusions?: string | null
          final_payment_date?: string | null
          host_flights_status?: string | null
          id?: string
          inclusions?: string | null
          instalment_amount?: number | null
          instalment_date?: string | null
          instalment_details?: string | null
          instalment_required?: boolean
          keap_tag_id?: string | null
          location?: string | null
          minimum_passengers_required?: number | null
          name?: string
          nights?: number
          notes?: string | null
          ops_accomm_notes?: string | null
          ops_activities_notes?: string | null
          ops_dinner_notes?: string | null
          ops_notes?: string | null
          ops_other_notes?: string | null
          ops_races_notes?: string | null
          ops_transport_notes?: string | null
          outbound_flight_date?: string | null
          outbound_flight_number?: string | null
          pickup_location_required?: boolean
          pickup_point?: string | null
          price_double?: number | null
          price_single?: number | null
          price_twin?: number | null
          return_flight_date?: string | null
          return_flight_number?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["tour_status"] | null
          tour_host?: string
          tour_hosts_notes?: string | null
          tour_type?: string | null
          travel_documents_required?: boolean
          updated_at?: string | null
          url_reference?: string | null
          xero_product_id?: string | null
          xero_reference?: string | null
        }
        Relationships: []
      }
      user_departments: {
        Row: {
          created_at: string
          department: Database["public"]["Enums"]["department"]
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department: Database["public"]["Enums"]["department"]
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: Database["public"]["Enums"]["department"]
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_departments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_dismissals: {
        Row: {
          dismissed_at: string
          id: string
          notification_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          id?: string
          notification_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          id?: string
          notification_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_dismissals_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "user_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          acknowledged: boolean
          created_at: string
          department: Database["public"]["Enums"]["department"] | null
          id: string
          message: string
          priority: string
          read: boolean
          related_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          acknowledged?: boolean
          created_at?: string
          department?: Database["public"]["Enums"]["department"] | null
          id?: string
          message: string
          priority: string
          read?: boolean
          related_id?: string | null
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          acknowledged?: boolean
          created_at?: string
          department?: Database["public"]["Enums"]["department"] | null
          id?: string
          message?: string
          priority?: string
          read?: boolean
          related_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      xero_integration_settings: {
        Row: {
          access_token: string | null
          created_at: string | null
          id: string
          is_connected: boolean | null
          last_contact_sync_at: string | null
          refresh_token: string | null
          tenant_id: string | null
          tenant_name: string | null
          token_expires_at: string | null
          updated_at: string | null
          webhook_key: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          last_contact_sync_at?: string | null
          refresh_token?: string | null
          tenant_id?: string | null
          tenant_name?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          webhook_key?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          last_contact_sync_at?: string | null
          refresh_token?: string | null
          tenant_id?: string | null
          tenant_name?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          webhook_key?: string | null
        }
        Relationships: []
      }
      xero_invoice_mappings: {
        Row: {
          amount_due: number | null
          amount_paid: number | null
          booking_id: string
          created_at: string | null
          currency_code: string | null
          id: string
          invoice_reference: string | null
          last_payment_date: string | null
          total_amount: number | null
          updated_at: string | null
          xero_invoice_id: string
          xero_invoice_number: string | null
          xero_status: string | null
        }
        Insert: {
          amount_due?: number | null
          amount_paid?: number | null
          booking_id: string
          created_at?: string | null
          currency_code?: string | null
          id?: string
          invoice_reference?: string | null
          last_payment_date?: string | null
          total_amount?: number | null
          updated_at?: string | null
          xero_invoice_id: string
          xero_invoice_number?: string | null
          xero_status?: string | null
        }
        Update: {
          amount_due?: number | null
          amount_paid?: number | null
          booking_id?: string
          created_at?: string | null
          currency_code?: string | null
          id?: string
          invoice_reference?: string | null
          last_payment_date?: string | null
          total_amount?: number | null
          updated_at?: string | null
          xero_invoice_id?: string
          xero_invoice_number?: string | null
          xero_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "xero_invoice_mappings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      xero_sync_log: {
        Row: {
          action: string | null
          booking_id: string | null
          created_at: string | null
          customer_id: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          new_value: string | null
          old_value: string | null
          status: string | null
          sync_type: string
        }
        Insert: {
          action?: string | null
          booking_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          status?: string | null
          sync_type: string
        }
        Update: {
          action?: string | null
          booking_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          status?: string | null
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "xero_sync_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xero_sync_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      agent_assigned_to_booking: {
        Args: { _agent_id: string; _booking_id: string }
        Returns: boolean
      }
      auto_archive_completed_tours: { Args: never; Returns: number }
      calculate_nights: {
        Args: { check_in: string; check_out: string }
        Returns: number
      }
      check_missing_activity_allocations: {
        Args: never
        Returns: {
          booking_id: string
          first_name: string
          last_name: string
          passenger_count: number
          start_date: string
          status: string
          tour_activities: number
          tour_id: string
          tour_name: string
        }[]
      }
      check_pending_bookings: { Args: never; Returns: number }
      check_user_role: {
        Args: { required_role: string; user_id: string }
        Returns: boolean
      }
      create_capacity_monitoring_task: {
        Args: {
          p_activity_id?: string
          p_additional_context?: Json
          p_hotel_id?: string
          p_rule_type: string
          p_tour_id?: string
        }
        Returns: string
      }
      create_pending_booking_task: {
        Args: { p_booking_id: string }
        Returns: string
      }
      delete_automated_tour_tasks: {
        Args: { p_tour_id: string }
        Returns: number
      }
      delete_booking_simple: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      delete_booking_with_cascade: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      evaluate_trigger_conditions:
        | {
            Args: {
              p_booking_status: Database["public"]["Enums"]["booking_status"]
              p_conditions: Json
              p_passenger_count?: number
              p_tour_id?: string
              p_tour_type?: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_booking_status: string
              p_conditions: Json
              p_passenger_count?: number
              p_tour_id?: string
              p_tour_type?: string
            }
            Returns: boolean
          }
      generate_temp_password: { Args: never; Returns: string }
      generate_tour_operation_tasks: {
        Args: { p_tour_id: string }
        Returns: undefined
      }
      get_activity_allocation_discrepancies: {
        Args: never
        Returns: {
          activity_date: string
          activity_id: string
          activity_name: string
          allocated_count: number
          booking_id: string
          discrepancy_type: string
          group_name: string
          lead_passenger_first_name: string
          lead_passenger_last_name: string
          passenger_count: number
          status: string
          tour_id: string
          tour_name: string
          tour_start_date: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_host_for_tour: {
        Args: { _tour_id: string; _user_id: string }
        Returns: boolean
      }
      log_sensitive_operation: {
        Args: {
          details?: Json
          operation_type: string
          record_id: string
          table_name: string
        }
        Returns: undefined
      }
      migrate_dietary_to_customer_profile: {
        Args: { p_customer_id: string; p_dietary_value: string }
        Returns: undefined
      }
      purge_passport_data: { Args: never; Returns: number }
      refresh_capacity_alerts: { Args: never; Returns: number }
      secure_customer_search: {
        Args: { search_term: string }
        Returns: {
          email: string
          first_name: string
          has_active_bookings: boolean
          id: string
          last_name: string
        }[]
      }
      user_has_department: {
        Args: {
          _department: Database["public"]["Enums"]["department"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      activity_status:
        | "pending"
        | "booked"
        | "paid_deposit"
        | "fully_paid"
        | "confirmed"
        | "on_hold"
        | "contacted_enquiry_sent"
        | "tentative_booking"
        | "finalised"
        | "cancelled"
      app_role: "admin" | "manager" | "booking_agent" | "agent" | "host"
      bedding_type: "single" | "double" | "twin"
      booking_status:
        | "pending"
        | "invoiced"
        | "deposited"
        | "instalment_paid"
        | "fully_paid"
        | "cancelled"
        | "waitlisted"
        | "host"
        | "racing_breaks_invoice"
        | "complimentary"
      department:
        | "operations"
        | "finance"
        | "marketing"
        | "booking"
        | "maintenance"
        | "general"
      hotel_booking_status:
        | "enquiry_sent"
        | "pending"
        | "confirmed"
        | "contracted"
        | "updated"
        | "paid"
        | "finalised"
      task_category:
        | "operations"
        | "finance"
        | "marketing"
        | "booking"
        | "maintenance"
        | "general"
      task_priority: "low" | "medium" | "high" | "critical"
      task_status:
        | "not_started"
        | "in_progress"
        | "waiting"
        | "completed"
        | "cancelled"
        | "archived"
      tour_status:
        | "pending"
        | "available"
        | "closed"
        | "sold_out"
        | "past"
        | "archived"
        | "limited_availability"
      transport_status:
        | "pending"
        | "booked"
        | "paid_deposit"
        | "fully_paid"
        | "confirmed"
        | "not_required"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_status: [
        "pending",
        "booked",
        "paid_deposit",
        "fully_paid",
        "confirmed",
        "on_hold",
        "contacted_enquiry_sent",
        "tentative_booking",
        "finalised",
        "cancelled",
      ],
      app_role: ["admin", "manager", "booking_agent", "agent", "host"],
      bedding_type: ["single", "double", "twin"],
      booking_status: [
        "pending",
        "invoiced",
        "deposited",
        "instalment_paid",
        "fully_paid",
        "cancelled",
        "waitlisted",
        "host",
        "racing_breaks_invoice",
        "complimentary",
      ],
      department: [
        "operations",
        "finance",
        "marketing",
        "booking",
        "maintenance",
        "general",
      ],
      hotel_booking_status: [
        "enquiry_sent",
        "pending",
        "confirmed",
        "contracted",
        "updated",
        "paid",
        "finalised",
      ],
      task_category: [
        "operations",
        "finance",
        "marketing",
        "booking",
        "maintenance",
        "general",
      ],
      task_priority: ["low", "medium", "high", "critical"],
      task_status: [
        "not_started",
        "in_progress",
        "waiting",
        "completed",
        "cancelled",
        "archived",
      ],
      tour_status: [
        "pending",
        "available",
        "closed",
        "sold_out",
        "past",
        "archived",
        "limited_availability",
      ],
      transport_status: [
        "pending",
        "booked",
        "paid_deposit",
        "fully_paid",
        "confirmed",
        "not_required",
      ],
    },
  },
} as const
