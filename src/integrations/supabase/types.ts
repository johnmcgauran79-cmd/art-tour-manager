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
          booking_status: Database["public"]["Enums"]["booking_workflow_status"]
          cancellation_details: string | null
          cancellation_status:
            | Database["public"]["Enums"]["cancellation_refund_status"]
            | null
          cancellation_terms: string | null
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
          legacy_status: Database["public"]["Enums"]["activity_status"] | null
          location: string | null
          name: string
          notes: string | null
          operations_notes: string | null
          payment_status: Database["public"]["Enums"]["payment_workflow_status"]
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
          booking_status?: Database["public"]["Enums"]["booking_workflow_status"]
          cancellation_details?: string | null
          cancellation_status?:
            | Database["public"]["Enums"]["cancellation_refund_status"]
            | null
          cancellation_terms?: string | null
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
          legacy_status?: Database["public"]["Enums"]["activity_status"] | null
          location?: string | null
          name: string
          notes?: string | null
          operations_notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_workflow_status"]
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
          booking_status?: Database["public"]["Enums"]["booking_workflow_status"]
          cancellation_details?: string | null
          cancellation_status?:
            | Database["public"]["Enums"]["cancellation_refund_status"]
            | null
          cancellation_terms?: string | null
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
          legacy_status?: Database["public"]["Enums"]["activity_status"] | null
          location?: string | null
          name?: string
          notes?: string | null
          operations_notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_workflow_status"]
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
      activity_discrepancy_acknowledgments: {
        Row: {
          acknowledged_at: string
          acknowledged_by: string
          activity_id: string
          booking_id: string
          discrepancy_type: string
          id: string
          snapshot_allocated_count: number
          snapshot_passenger_count: number
          tour_id: string
        }
        Insert: {
          acknowledged_at?: string
          acknowledged_by: string
          activity_id: string
          booking_id: string
          discrepancy_type: string
          id?: string
          snapshot_allocated_count: number
          snapshot_passenger_count: number
          tour_id: string
        }
        Update: {
          acknowledged_at?: string
          acknowledged_by?: string
          activity_id?: string
          booking_id?: string
          discrepancy_type?: string
          id?: string
          snapshot_allocated_count?: number
          snapshot_passenger_count?: number
          tour_id?: string
        }
        Relationships: []
      }
      activity_external_links: {
        Row: {
          activity_id: string
          created_at: string
          created_by: string
          id: string
          label: string
          updated_at: string
          url: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          created_by: string
          id?: string
          label: string
          updated_at?: string
          url: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_external_links_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
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
      additional_from_emails: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_active: boolean
          label: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          is_active?: boolean
          label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      additional_info_templates: {
        Row: {
          created_at: string
          created_by: string
          default_content: string | null
          icon_name: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_content?: string | null
          icon_name?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_content?: string | null
          icon_name?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          context: Json
          created_at: string
          deleted_at: string | null
          expires_at: string
          id: string
          retain_indefinitely: boolean
          system_prompt_version: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: Json
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          id?: string
          retain_indefinitely?: boolean
          system_prompt_version?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: Json
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          id?: string
          retain_indefinitely?: boolean
          system_prompt_version?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          parts: Json
          role: string
          user_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          parts?: Json
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_rate_limits: {
        Row: {
          id: string
          requested_at: string
          user_id: string
        }
        Insert: {
          id?: string
          requested_at?: string
          user_id: string
        }
        Update: {
          id?: string
          requested_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          conversation_id: string
          created_at: string
          entry_point: string | null
          estimated_cost_usd: number
          id: string
          input_tokens: number
          latency_ms: number
          message_id: string | null
          model: string
          output_tokens: number
          skill_id: string | null
          source_page: string | null
          success: boolean | null
          tool_call_count: number
          tools_used: string[] | null
          total_tokens: number
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          entry_point?: string | null
          estimated_cost_usd?: number
          id?: string
          input_tokens?: number
          latency_ms?: number
          message_id?: string | null
          model: string
          output_tokens?: number
          skill_id?: string | null
          source_page?: string | null
          success?: boolean | null
          tool_call_count?: number
          tools_used?: string[] | null
          total_tokens?: number
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          entry_point?: string | null
          estimated_cost_usd?: number
          id?: string
          input_tokens?: number
          latency_ms?: number
          message_id?: string | null
          model?: string
          output_tokens?: number
          skill_id?: string | null
          source_page?: string | null
          success?: boolean | null
          tool_call_count?: number
          tools_used?: string[] | null
          total_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
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
          email_template_id: string | null
          host_user_id: string | null
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
          email_template_id?: string | null
          host_user_id?: string | null
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
          email_template_id?: string | null
          host_user_id?: string | null
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
            foreignKeyName: "automated_email_log_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
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
      backup_runs: {
        Row: {
          artifact_name: string | null
          created_at: string
          destination: string | null
          duration_seconds: number | null
          error_message: string | null
          finished_at: string
          id: string
          kind: string
          metadata: Json
          size_bytes: number | null
          source: string
          started_at: string | null
          status: string
          tables_count: number | null
        }
        Insert: {
          artifact_name?: string | null
          created_at?: string
          destination?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          finished_at?: string
          id?: string
          kind?: string
          metadata?: Json
          size_bytes?: number | null
          source?: string
          started_at?: string | null
          status?: string
          tables_count?: number | null
        }
        Update: {
          artifact_name?: string | null
          created_at?: string
          destination?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          finished_at?: string
          id?: string
          kind?: string
          metadata?: Json
          size_bytes?: number | null
          source?: string
          started_at?: string | null
          status?: string
          tables_count?: number | null
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
          automation_override: Database["public"]["Enums"]["booking_automation_override"]
          booking_agent: string | null
          booking_notes: string | null
          brand_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
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
          passport_not_required: boolean
          passport_number: string | null
          pre_cancellation_snapshot: Json | null
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
          automation_override?: Database["public"]["Enums"]["booking_automation_override"]
          booking_agent?: string | null
          booking_notes?: string | null
          brand_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
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
          passport_not_required?: boolean
          passport_number?: string | null
          pre_cancellation_snapshot?: Json | null
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
          automation_override?: Database["public"]["Enums"]["booking_automation_override"]
          booking_agent?: string | null
          booking_notes?: string | null
          brand_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
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
          passport_not_required?: boolean
          passport_number?: string | null
          pre_cancellation_snapshot?: Json | null
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
            foreignKeyName: "bookings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
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
      brands: {
        Row: {
          color_accent: string
          color_border: string
          color_button: string
          color_button_text: string
          color_primary: string
          company_address: string | null
          company_phone: string | null
          company_website: string | null
          created_at: string
          email_header_image_url: string | null
          footer_text: string | null
          from_email_client: string | null
          from_email_operational: string | null
          id: string
          is_active: boolean
          is_default: boolean
          legal_name: string | null
          logo_url: string | null
          name: string
          partner_handles_billing: boolean
          partner_name: string | null
          partnership_note: string | null
          sender_name: string
          short_name: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          color_accent?: string
          color_border?: string
          color_button?: string
          color_button_text?: string
          color_primary?: string
          company_address?: string | null
          company_phone?: string | null
          company_website?: string | null
          created_at?: string
          email_header_image_url?: string | null
          footer_text?: string | null
          from_email_client?: string | null
          from_email_operational?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name: string
          partner_handles_billing?: boolean
          partner_name?: string | null
          partnership_note?: string | null
          sender_name?: string
          short_name?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color_accent?: string
          color_border?: string
          color_button?: string
          color_button_text?: string
          color_primary?: string
          company_address?: string | null
          company_phone?: string | null
          company_website?: string | null
          created_at?: string
          email_header_image_url?: string | null
          footer_text?: string | null
          from_email_client?: string | null
          from_email_operational?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          partner_handles_billing?: boolean
          partner_name?: string | null
          partnership_note?: string | null
          sender_name?: string
          short_name?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
      custom_card_templates: {
        Row: {
          accent_color: string
          created_at: string
          created_by: string
          header_emoji: string
          header_title: string
          id: string
          name: string
          rows: Json
          updated_at: string
        }
        Insert: {
          accent_color?: string
          created_at?: string
          created_by: string
          header_emoji?: string
          header_title?: string
          id?: string
          name: string
          rows?: Json
          updated_at?: string
        }
        Update: {
          accent_color?: string
          created_at?: string
          created_by?: string
          header_emoji?: string
          header_title?: string
          id?: string
          name?: string
          rows?: Json
          updated_at?: string
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
          date_of_birth: string | null
          dietary_requirements: string | null
          email: string | null
          emergency_contact_email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          first_name: string
          id: string
          keap_contact_id: string | null
          keap_match_checked_at: string | null
          last_name: string
          latest_tour_end_date: string | null
          latest_tour_name: string | null
          medical_conditions: string | null
          notes: string | null
          phone: string | null
          phone_missing_acknowledged_at: string | null
          preferred_name: string | null
          spouse_name: string | null
          state: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          accessibility_needs?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          dietary_requirements?: string | null
          email?: string | null
          emergency_contact_email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name: string
          id?: string
          keap_contact_id?: string | null
          keap_match_checked_at?: string | null
          last_name: string
          latest_tour_end_date?: string | null
          latest_tour_name?: string | null
          medical_conditions?: string | null
          notes?: string | null
          phone?: string | null
          phone_missing_acknowledged_at?: string | null
          preferred_name?: string | null
          spouse_name?: string | null
          state?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          accessibility_needs?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          dietary_requirements?: string | null
          email?: string | null
          emergency_contact_email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name?: string
          id?: string
          keap_contact_id?: string | null
          keap_match_checked_at?: string | null
          last_name?: string
          latest_tour_end_date?: string | null
          latest_tour_name?: string | null
          medical_conditions?: string | null
          notes?: string | null
          phone?: string | null
          phone_missing_acknowledged_at?: string | null
          preferred_name?: string | null
          spouse_name?: string | null
          state?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          file_name: string
          file_path: string
          file_url: string
          id: string
          label: string
          mime_type: string | null
          size_bytes: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_url: string
          id?: string
          label: string
          mime_type?: string | null
          size_bytes?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_url?: string
          id?: string
          label?: string
          mime_type?: string | null
          size_bytes?: number | null
          slug?: string
          updated_at?: string
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
          batch_id: string | null
          booking_id: string | null
          created_at: string
          error_message: string | null
          from_email: string | null
          id: string
          message_id: string
          recipient_email: string
          recipient_name: string | null
          rendered_html: string | null
          sent_at: string
          sent_by: string | null
          subject: string
          template_id: string | null
          template_name: string | null
          tour_id: string | null
        }
        Insert: {
          batch_id?: string | null
          booking_id?: string | null
          created_at?: string
          error_message?: string | null
          from_email?: string | null
          id?: string
          message_id: string
          recipient_email: string
          recipient_name?: string | null
          rendered_html?: string | null
          sent_at?: string
          sent_by?: string | null
          subject: string
          template_id?: string | null
          template_name?: string | null
          tour_id?: string | null
        }
        Update: {
          batch_id?: string | null
          booking_id?: string | null
          created_at?: string
          error_message?: string | null
          from_email?: string | null
          id?: string
          message_id?: string
          recipient_email?: string
          recipient_name?: string | null
          rendered_html?: string | null
          sent_at?: string
          sent_by?: string | null
          subject?: string
          template_id?: string | null
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
            foreignKeyName: "email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
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
          acknowledged_at: string | null
          acknowledged_by: string | null
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
          acknowledged_at?: string | null
          acknowledged_by?: string | null
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
          acknowledged_at?: string | null
          acknowledged_by?: string | null
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
          header_image_url: string | null
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
          header_image_url?: string | null
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
          header_image_url?: string | null
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
      host_briefing_tokens: {
        Row: {
          created_at: string
          expires_at: string
          host_user_id: string
          id: string
          token: string
          tour_id: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          host_user_id: string
          id?: string
          token: string
          tour_id: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          host_user_id?: string
          id?: string
          token?: string
          tour_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "host_briefing_tokens_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
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
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
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
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
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
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
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
      hotel_external_links: {
        Row: {
          created_at: string
          created_by: string
          hotel_id: string
          id: string
          label: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          hotel_id: string
          id?: string
          label: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          hotel_id?: string
          id?: string
          label?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_external_links_hotel_id_fkey"
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
          auto_allocate_on_create: boolean
          booking_status: Database["public"]["Enums"]["booking_workflow_status"]
          cancellation_details: string | null
          cancellation_policy: string | null
          cancellation_status:
            | Database["public"]["Enums"]["cancellation_refund_status"]
            | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          default_check_in: string | null
          default_check_out: string | null
          default_room_type: string | null
          extra_night_price: string | null
          final_rooms_cutoff_date: string | null
          id: string
          initial_rooms_cutoff_date: string | null
          legacy_status:
            | Database["public"]["Enums"]["hotel_booking_status"]
            | null
          name: string
          operations_notes: string | null
          payment_status: Database["public"]["Enums"]["payment_workflow_status"]
          rooms_available: number | null
          rooms_booked: number | null
          rooms_reserved: number | null
          tour_id: string | null
          updated_at: string | null
          upgrade_options: string | null
        }
        Insert: {
          address?: string | null
          auto_allocate_on_create?: boolean
          booking_status?: Database["public"]["Enums"]["booking_workflow_status"]
          cancellation_details?: string | null
          cancellation_policy?: string | null
          cancellation_status?:
            | Database["public"]["Enums"]["cancellation_refund_status"]
            | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          default_check_in?: string | null
          default_check_out?: string | null
          default_room_type?: string | null
          extra_night_price?: string | null
          final_rooms_cutoff_date?: string | null
          id?: string
          initial_rooms_cutoff_date?: string | null
          legacy_status?:
            | Database["public"]["Enums"]["hotel_booking_status"]
            | null
          name: string
          operations_notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_workflow_status"]
          rooms_available?: number | null
          rooms_booked?: number | null
          rooms_reserved?: number | null
          tour_id?: string | null
          updated_at?: string | null
          upgrade_options?: string | null
        }
        Update: {
          address?: string | null
          auto_allocate_on_create?: boolean
          booking_status?: Database["public"]["Enums"]["booking_workflow_status"]
          cancellation_details?: string | null
          cancellation_policy?: string | null
          cancellation_status?:
            | Database["public"]["Enums"]["cancellation_refund_status"]
            | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          default_check_in?: string | null
          default_check_out?: string | null
          default_room_type?: string | null
          extra_night_price?: string | null
          final_rooms_cutoff_date?: string | null
          id?: string
          initial_rooms_cutoff_date?: string | null
          legacy_status?:
            | Database["public"]["Enums"]["hotel_booking_status"]
            | null
          name?: string
          operations_notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_workflow_status"]
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
      invoice_line_templates: {
        Row: {
          created_at: string
          created_by: string
          description_template: string
          id: string
          is_active: boolean
          line_type: string
          name: string
          sort_order: number
          unit_amount_type: string
          unit_amount_value: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description_template?: string
          id?: string
          is_active?: boolean
          line_type: string
          name: string
          sort_order?: number
          unit_amount_type?: string
          unit_amount_value?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description_template?: string
          id?: string
          is_active?: boolean
          line_type?: string
          name?: string
          sort_order?: number
          unit_amount_type?: string
          unit_amount_value?: number | null
          updated_at?: string
        }
        Relationships: []
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
      operations_document_sections: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      operations_documents: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          department: string
          description: string | null
          external_url: string | null
          file_name: string | null
          file_path: string | null
          id: string
          name: string
          note: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          department: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          name: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          department?: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          name?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      personal_events: {
        Row: {
          all_day: boolean
          color: string
          created_at: string
          description: string | null
          ends_at: string
          id: string
          starts_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          color?: string
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          starts_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          color?: string
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          starts_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_note_shares: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          note_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          note_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_note_shares_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "personal_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_todo_shares: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          todo_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          todo_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          todo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_todo_shares_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "personal_todos"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_todos: {
        Row: {
          completed: boolean
          converted_task_id: string | null
          created_at: string
          due_date: string | null
          id: string
          link_url: string | null
          notes: string | null
          position: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          converted_task_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          link_url?: string | null
          notes?: string | null
          position?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          converted_task_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          link_url?: string | null
          notes?: string | null
          position?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_todos_converted_task_id_fkey"
            columns: ["converted_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
          notification_preference: string
          teams_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          must_change_password?: boolean | null
          notification_preference?: string
          teams_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          must_change_password?: boolean | null
          notification_preference?: string
          teams_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      scheduled_emails: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          booking_id: string | null
          created_at: string | null
          created_by: string
          email_payload: Json
          error_message: string | null
          id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          scheduled_send_at: string
          sent_at: string | null
          status: string
          tour_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          booking_id?: string | null
          created_at?: string | null
          created_by: string
          email_payload?: Json
          error_message?: string | null
          id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          scheduled_send_at: string
          sent_at?: string | null
          status?: string
          tour_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          booking_id?: string | null
          created_at?: string | null
          created_by?: string
          email_payload?: Json
          error_message?: string | null
          id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          scheduled_send_at?: string
          sent_at?: string | null
          status?: string
          tour_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_emails_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_leave: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          end_date: string
          id: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          end_date: string
          id?: string
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          end_date?: string
          id?: string
          start_date?: string
          updated_at?: string
          user_id?: string
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
          email_template_id: string | null
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
          email_template_id?: string | null
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
          email_template_id?: string | null
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
            foreignKeyName: "status_change_email_queue_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
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
      task_activity_log: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          message: string | null
          new_value: Json | null
          old_value: Json | null
          task_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          new_value?: Json | null
          old_value?: Json | null
          task_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          new_value?: Json | null
          old_value?: Json | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_approvers: {
        Row: {
          created_at: string
          decided_at: string | null
          decision: Database["public"]["Enums"]["task_approval_decision"]
          id: string
          notes: string | null
          requested_at: string
          requested_by: string | null
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["task_approval_decision"]
          id?: string
          notes?: string | null
          requested_at?: string
          requested_by?: string | null
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["task_approval_decision"]
          id?: string
          notes?: string | null
          requested_at?: string
          requested_by?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_approvers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
          description: string | null
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
          description?: string | null
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
          description?: string | null
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
      task_comment_attachments: {
        Row: {
          comment_id: string
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
          comment_id: string
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
          comment_id?: string
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
            foreignKeyName: "task_comment_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comment_attachments_task_id_fkey"
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
          edited_at: string | null
          edited_by: string | null
          id: string
          parent_comment_id: string | null
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          parent_comment_id?: string | null
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          parent_comment_id?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_entity_links: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["task_link_entity_type"]
          id: string
          source: string
          source_id: string | null
          task_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["task_link_entity_type"]
          id?: string
          source: string
          source_id?: string | null
          task_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["task_link_entity_type"]
          id?: string
          source?: string
          source_id?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_entity_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_notification_log: {
        Row: {
          id: string
          kind: string
          sent_at: string
          task_id: string
          threshold_hours: number | null
          user_id: string
        }
        Insert: {
          id?: string
          kind: string
          sent_at?: string
          task_id: string
          threshold_hours?: number | null
          user_id: string
        }
        Update: {
          id?: string
          kind?: string
          sent_at?: string
          task_id?: string
          threshold_hours?: number | null
          user_id?: string
        }
        Relationships: []
      }
      task_notification_preferences: {
        Row: {
          alert_on_overdue: boolean
          alert_priority_filter: string[]
          alert_thresholds_hours: number[]
          alerts_channel: Database["public"]["Enums"]["task_notif_channel"]
          alerts_enabled: boolean
          created_at: string
          digest_cadence: Database["public"]["Enums"]["task_digest_cadence"]
          digest_channel: Database["public"]["Enums"]["task_notif_channel"]
          digest_enabled: boolean
          digest_include_due_today: boolean
          digest_include_newly_assigned: boolean
          digest_include_overdue: boolean
          digest_include_subtasks: boolean
          digest_include_upcoming: boolean
          digest_include_watched: boolean
          digest_lookahead_days: number
          digest_priority_filter: string[]
          digest_skip_if_empty: boolean
          digest_time_local: string
          digest_weekdays: number[]
          last_digest_sent_at: string | null
          overdue_reminder_interval_hours: number
          scope_assigned: boolean
          scope_mentioned: boolean
          scope_watching: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_on_overdue?: boolean
          alert_priority_filter?: string[]
          alert_thresholds_hours?: number[]
          alerts_channel?: Database["public"]["Enums"]["task_notif_channel"]
          alerts_enabled?: boolean
          created_at?: string
          digest_cadence?: Database["public"]["Enums"]["task_digest_cadence"]
          digest_channel?: Database["public"]["Enums"]["task_notif_channel"]
          digest_enabled?: boolean
          digest_include_due_today?: boolean
          digest_include_newly_assigned?: boolean
          digest_include_overdue?: boolean
          digest_include_subtasks?: boolean
          digest_include_upcoming?: boolean
          digest_include_watched?: boolean
          digest_lookahead_days?: number
          digest_priority_filter?: string[]
          digest_skip_if_empty?: boolean
          digest_time_local?: string
          digest_weekdays?: number[]
          last_digest_sent_at?: string | null
          overdue_reminder_interval_hours?: number
          scope_assigned?: boolean
          scope_mentioned?: boolean
          scope_watching?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_on_overdue?: boolean
          alert_priority_filter?: string[]
          alert_thresholds_hours?: number[]
          alerts_channel?: Database["public"]["Enums"]["task_notif_channel"]
          alerts_enabled?: boolean
          created_at?: string
          digest_cadence?: Database["public"]["Enums"]["task_digest_cadence"]
          digest_channel?: Database["public"]["Enums"]["task_notif_channel"]
          digest_enabled?: boolean
          digest_include_due_today?: boolean
          digest_include_newly_assigned?: boolean
          digest_include_overdue?: boolean
          digest_include_subtasks?: boolean
          digest_include_upcoming?: boolean
          digest_include_watched?: boolean
          digest_lookahead_days?: number
          digest_priority_filter?: string[]
          digest_skip_if_empty?: boolean
          digest_time_local?: string
          digest_weekdays?: number[]
          last_digest_sent_at?: string | null
          overdue_reminder_interval_hours?: number
          scope_assigned?: boolean
          scope_mentioned?: boolean
          scope_watching?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_statuses: {
        Row: {
          created_at: string
          id: string
          is_finished: boolean
          is_system: boolean
          label: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_finished?: boolean
          is_system?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          is_finished?: boolean
          is_system?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      task_subtasks: {
        Row: {
          assignee_id: string | null
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          latest_note: string | null
          latest_note_at: string | null
          latest_note_by: string | null
          sort_order: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          latest_note?: string | null
          latest_note_at?: string | null
          latest_note_by?: string | null
          sort_order?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          latest_note?: string | null
          latest_note_at?: string | null
          latest_note_by?: string | null
          sort_order?: number
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_template_approvers: {
        Row: {
          created_at: string
          id: string
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_template_approvers_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_template_assignees: {
        Row: {
          created_at: string
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_template_assignees_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          approval_policy: string
          category: Database["public"]["Enums"]["task_category"]
          created_at: string
          date_field_type: string | null
          days_before_tour: number | null
          default_status: string
          default_url_reference: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          priority: Database["public"]["Enums"]["task_priority"]
          template_type: string
          updated_at: string
        }
        Insert: {
          approval_policy?: string
          category?: Database["public"]["Enums"]["task_category"]
          created_at?: string
          date_field_type?: string | null
          days_before_tour?: number | null
          default_status?: string
          default_url_reference?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: Database["public"]["Enums"]["task_priority"]
          template_type?: string
          updated_at?: string
        }
        Update: {
          approval_policy?: string
          category?: Database["public"]["Enums"]["task_category"]
          created_at?: string
          date_field_type?: string | null
          days_before_tour?: number | null
          default_status?: string
          default_url_reference?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_watchers: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_watchers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          approval_policy: string
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
          last_activity_at: string
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          quick_update: string | null
          quick_update_at: string | null
          quick_update_by: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          tour_id: string | null
          updated_at: string
          url_reference: string | null
        }
        Insert: {
          approval_policy?: string
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
          last_activity_at?: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          quick_update?: string | null
          quick_update_at?: string | null
          quick_update_by?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          tour_id?: string | null
          updated_at?: string
          url_reference?: string | null
        }
        Update: {
          approval_policy?: string
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
          last_activity_at?: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          quick_update?: string | null
          quick_update_at?: string | null
          quick_update_by?: string | null
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
      teams_channel_notify_config: {
        Row: {
          channel_id: string | null
          channel_name: string | null
          chat_id: string | null
          chat_name: string | null
          enabled: boolean
          id: boolean
          notify_statuses: string[]
          poster_user_id: string | null
          team_id: string | null
          team_name: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          channel_id?: string | null
          channel_name?: string | null
          chat_id?: string | null
          chat_name?: string | null
          enabled?: boolean
          id?: boolean
          notify_statuses?: string[]
          poster_user_id?: string | null
          team_id?: string | null
          team_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          channel_id?: string | null
          channel_name?: string | null
          chat_id?: string | null
          chat_name?: string | null
          enabled?: boolean
          id?: boolean
          notify_statuses?: string[]
          poster_user_id?: string | null
          team_id?: string | null
          team_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      teams_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      tour_additional_info_sections: {
        Row: {
          content: string | null
          created_at: string
          created_by: string
          icon_name: string
          id: string
          include_in_email_rules: string[]
          include_in_guest_document: boolean
          is_visible: boolean
          name: string
          sort_order: number
          template_id: string | null
          tour_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by: string
          icon_name?: string
          id?: string
          include_in_email_rules?: string[]
          include_in_guest_document?: boolean
          is_visible?: boolean
          name: string
          sort_order?: number
          template_id?: string | null
          tour_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string
          icon_name?: string
          id?: string
          include_in_email_rules?: string[]
          include_in_guest_document?: boolean
          is_visible?: boolean
          name?: string
          sort_order?: number
          template_id?: string | null
          tour_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_additional_info_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "additional_info_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_additional_info_sections_tour_id_fkey"
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
      tour_custom_form_exemptions: {
        Row: {
          booking_id: string
          created_at: string
          created_by: string | null
          form_id: string
          id: string
          passenger_slot: number
          reason: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          created_by?: string | null
          form_id: string
          id?: string
          passenger_slot: number
          reason?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          created_by?: string | null
          form_id?: string
          id?: string
          passenger_slot?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_custom_form_exemptions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_custom_form_exemptions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "tour_custom_forms"
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
          email_recipients: string
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
          email_recipients?: string
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
          email_recipients?: string
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
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_document_images: {
        Row: {
          caption: string | null
          created_at: string
          file_path: string
          height: number | null
          id: string
          sort_order: number
          tour_id: string
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_path: string
          height?: number | null
          id?: string
          sort_order?: number
          tour_id: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_path?: string
          height?: number | null
          id?: string
          sort_order?: number
          tour_id?: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_document_images_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_email_rule_overrides: {
        Row: {
          created_at: string
          email_template_id: string
          id: string
          rule_id: string
          tour_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_template_id: string
          id?: string
          rule_id: string
          tour_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_template_id?: string
          id?: string
          rule_id?: string
          tour_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_email_rule_overrides_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_email_rule_overrides_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automated_email_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_email_rule_overrides_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
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
      tour_inclusion_items: {
        Row: {
          content_html: string
          created_at: string
          id: string
          kind: string
          sort_order: number
          tour_id: string
          updated_at: string
        }
        Insert: {
          content_html?: string
          created_at?: string
          id?: string
          kind: string
          sort_order?: number
          tour_id: string
          updated_at?: string
        }
        Update: {
          content_html?: string
          created_at?: string
          id?: string
          kind?: string
          sort_order?: number
          tour_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_inclusion_items_tour_id_fkey"
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
          guest_document_file_name: string | null
          guest_document_file_path: string | null
          id: string
          is_current: boolean
          notes: string | null
          snapshot_file_name: string | null
          snapshot_file_path: string | null
          title: string | null
          tour_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          guest_document_file_name?: string | null
          guest_document_file_path?: string | null
          id?: string
          is_current?: boolean
          notes?: string | null
          snapshot_file_name?: string | null
          snapshot_file_path?: string | null
          title?: string | null
          tour_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          guest_document_file_name?: string | null
          guest_document_file_path?: string | null
          id?: string
          is_current?: boolean
          notes?: string | null
          snapshot_file_name?: string | null
          snapshot_file_path?: string | null
          title?: string | null
          tour_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      tour_itinerary_day_images: {
        Row: {
          caption: string | null
          created_at: string
          day_id: string
          file_name: string | null
          file_path: string
          id: string
          sort_order: number
          updated_at: string
          uploaded_by: string | null
          wp_media_id: number | null
          wp_source_url: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          day_id: string
          file_name?: string | null
          file_path: string
          id?: string
          sort_order?: number
          updated_at?: string
          uploaded_by?: string | null
          wp_media_id?: number | null
          wp_source_url?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          day_id?: string
          file_name?: string | null
          file_path?: string
          id?: string
          sort_order?: number
          updated_at?: string
          uploaded_by?: string | null
          wp_media_id?: number | null
          wp_source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_itinerary_day_images_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "tour_itinerary_days"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "tour_itinerary_days_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "tour_itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_itinerary_entries: {
        Row: {
          content: string | null
          created_at: string
          day_id: string
          id: string
          sort_order: number
          subject: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          day_id: string
          id?: string
          sort_order?: number
          subject: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          day_id?: string
          id?: string
          sort_order?: number
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_itinerary_entries_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "tour_itinerary_days"
            referencedColumns: ["id"]
          },
        ]
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
          alerts_enabled: boolean
          alerts_manually_overridden: boolean
          brand_id: string | null
          cancellation_policy_enabled: boolean
          cancellation_policy_override: Json | null
          capacity: number | null
          created_at: string | null
          dates_not_confirmed: boolean
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
          is_test_tour: boolean
          location: string | null
          manual_billing: boolean
          manual_emails: boolean
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
          payment_receipts_enabled: boolean
          photos_videos_url: string | null
          pickup_arrival_doc_name: string | null
          pickup_arrival_doc_path: string | null
          pickup_arrival_message: string | null
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
          website_description: string | null
          website_link_status: string
          welcome_drinks_message: string | null
          welcome_message_body: string | null
          welcome_message_enabled: boolean
          welcome_message_heading: string | null
          welcome_message_image_path: string | null
          welcome_message_signoff: string | null
          xero_product_id: string | null
          xero_reference: string | null
        }
        Insert: {
          alerts_enabled?: boolean
          alerts_manually_overridden?: boolean
          brand_id?: string | null
          cancellation_policy_enabled?: boolean
          cancellation_policy_override?: Json | null
          capacity?: number | null
          created_at?: string | null
          dates_not_confirmed?: boolean
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
          is_test_tour?: boolean
          location?: string | null
          manual_billing?: boolean
          manual_emails?: boolean
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
          payment_receipts_enabled?: boolean
          photos_videos_url?: string | null
          pickup_arrival_doc_name?: string | null
          pickup_arrival_doc_path?: string | null
          pickup_arrival_message?: string | null
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
          website_description?: string | null
          website_link_status?: string
          welcome_drinks_message?: string | null
          welcome_message_body?: string | null
          welcome_message_enabled?: boolean
          welcome_message_heading?: string | null
          welcome_message_image_path?: string | null
          welcome_message_signoff?: string | null
          xero_product_id?: string | null
          xero_reference?: string | null
        }
        Update: {
          alerts_enabled?: boolean
          alerts_manually_overridden?: boolean
          brand_id?: string | null
          cancellation_policy_enabled?: boolean
          cancellation_policy_override?: Json | null
          capacity?: number | null
          created_at?: string | null
          dates_not_confirmed?: boolean
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
          is_test_tour?: boolean
          location?: string | null
          manual_billing?: boolean
          manual_emails?: boolean
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
          payment_receipts_enabled?: boolean
          photos_videos_url?: string | null
          pickup_arrival_doc_name?: string | null
          pickup_arrival_doc_path?: string | null
          pickup_arrival_message?: string | null
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
          website_description?: string | null
          website_link_status?: string
          welcome_drinks_message?: string | null
          welcome_message_body?: string | null
          welcome_message_enabled?: boolean
          welcome_message_heading?: string | null
          welcome_message_image_path?: string | null
          welcome_message_signoff?: string | null
          xero_product_id?: string | null
          xero_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tours_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_layouts: {
        Row: {
          created_at: string
          hidden_widgets: Json
          layout: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hidden_widgets?: Json
          layout?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hidden_widgets?: Json
          layout?: Json
          updated_at?: string
          user_id?: string
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
      user_teams_connections: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          connected_at: string
          id: string
          ms_display_name: string | null
          ms_user_id: string
          ms_user_principal_name: string | null
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          connected_at?: string
          id?: string
          ms_display_name?: string | null
          ms_user_id: string
          ms_user_principal_name?: string | null
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          connected_at?: string
          id?: string
          ms_display_name?: string | null
          ms_user_id?: string
          ms_user_principal_name?: string | null
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      website_change_events: {
        Row: {
          after_value: Json | null
          before_value: Json | null
          changed_at: string
          changed_by: string | null
          id: string
          request_id: string
          section: string
          summary: string
          tour_id: string
        }
        Insert: {
          after_value?: Json | null
          before_value?: Json | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          request_id: string
          section: string
          summary: string
          tour_id: string
        }
        Update: {
          after_value?: Json | null
          before_value?: Json | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          request_id?: string
          section?: string
          summary?: string
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_change_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "website_change_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      website_change_requests: {
        Row: {
          change_count: number
          created_at: string
          first_changed_at: string
          id: string
          last_changed_at: string
          last_changed_by: string | null
          published_at: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          section: string
          status: string
          tour_id: string
          updated_at: string
        }
        Insert: {
          change_count?: number
          created_at?: string
          first_changed_at?: string
          id?: string
          last_changed_at?: string
          last_changed_by?: string | null
          published_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          section: string
          status?: string
          tour_id: string
          updated_at?: string
        }
        Update: {
          change_count?: number
          created_at?: string
          first_changed_at?: string
          id?: string
          last_changed_at?: string
          last_changed_by?: string | null
          published_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          section?: string
          status?: string
          tour_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_change_requests_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      wordpress_field_mappings: {
        Row: {
          art_source: string | null
          created_at: string
          enabled: boolean
          id: string
          notes: string | null
          updated_at: string
          wp_field_key: string
          wp_group: string
          wp_kind: string
          wp_label: string | null
        }
        Insert: {
          art_source?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          notes?: string | null
          updated_at?: string
          wp_field_key: string
          wp_group?: string
          wp_kind?: string
          wp_label?: string | null
        }
        Update: {
          art_source?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          notes?: string | null
          updated_at?: string
          wp_field_key?: string
          wp_group?: string
          wp_kind?: string
          wp_label?: string | null
        }
        Relationships: []
      }
      wordpress_integration_audit_logs: {
        Row: {
          action: string
          after_snapshot: Json | null
          before_snapshot: Json | null
          correlation_id: string
          created_at: string
          dry_run: boolean
          error_message: string | null
          id: string
          request_summary: Json | null
          response_code: number | null
          result_status: string
          source: string
          user_id: string | null
          wordpress_object_id: number | null
          wordpress_object_type: string | null
        }
        Insert: {
          action: string
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          correlation_id?: string
          created_at?: string
          dry_run?: boolean
          error_message?: string | null
          id?: string
          request_summary?: Json | null
          response_code?: number | null
          result_status: string
          source: string
          user_id?: string | null
          wordpress_object_id?: number | null
          wordpress_object_type?: string | null
        }
        Update: {
          action?: string
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          correlation_id?: string
          created_at?: string
          dry_run?: boolean
          error_message?: string | null
          id?: string
          request_summary?: Json | null
          response_code?: number | null
          result_status?: string
          source?: string
          user_id?: string | null
          wordpress_object_id?: number | null
          wordpress_object_type?: string | null
        }
        Relationships: []
      }
      wordpress_tour_links: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string | null
          last_wp_modified_at: string | null
          linked_at: string
          linked_by: string | null
          tour_id: string
          updated_at: string
          wp_slug: string | null
          wp_title_snapshot: string | null
          wp_tour_id: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          last_wp_modified_at?: string | null
          linked_at?: string
          linked_by?: string | null
          tour_id: string
          updated_at?: string
          wp_slug?: string | null
          wp_title_snapshot?: string | null
          wp_tour_id: number
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          last_wp_modified_at?: string | null
          linked_at?: string
          linked_by?: string | null
          tour_id?: string
          updated_at?: string
          wp_slug?: string | null
          wp_title_snapshot?: string | null
          wp_tour_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "wordpress_tour_links_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: true
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      xero_api_locks: {
        Row: {
          acquired_at: string
          expires_at: string
          holder: string
          lock_name: string
        }
        Insert: {
          acquired_at?: string
          expires_at: string
          holder: string
          lock_name: string
        }
        Update: {
          acquired_at?: string
          expires_at?: string
          holder?: string
          lock_name?: string
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
      xero_payment_receipts: {
        Row: {
          amount: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          booking_id: string | null
          created_at: string
          currency_code: string | null
          id: string
          invoice_amount_due: number | null
          invoice_amount_paid: number | null
          invoice_total: number | null
          payment_date: string | null
          payment_reference: string | null
          receipt_email_id: string | null
          receipt_email_sent_at: string | null
          recipient_email: string | null
          rejected_at: string | null
          rejection_reason: string | null
          send_error: string | null
          skipped_reason: string | null
          updated_at: string
          xero_invoice_id: string
          xero_invoice_number: string | null
          xero_payment_id: string
        }
        Insert: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          booking_id?: string | null
          created_at?: string
          currency_code?: string | null
          id?: string
          invoice_amount_due?: number | null
          invoice_amount_paid?: number | null
          invoice_total?: number | null
          payment_date?: string | null
          payment_reference?: string | null
          receipt_email_id?: string | null
          receipt_email_sent_at?: string | null
          recipient_email?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          send_error?: string | null
          skipped_reason?: string | null
          updated_at?: string
          xero_invoice_id: string
          xero_invoice_number?: string | null
          xero_payment_id: string
        }
        Update: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          booking_id?: string | null
          created_at?: string
          currency_code?: string | null
          id?: string
          invoice_amount_due?: number | null
          invoice_amount_paid?: number | null
          invoice_total?: number | null
          payment_date?: string | null
          payment_reference?: string | null
          receipt_email_id?: string | null
          receipt_email_sent_at?: string | null
          recipient_email?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          send_error?: string | null
          skipped_reason?: string | null
          updated_at?: string
          xero_invoice_id?: string
          xero_invoice_number?: string | null
          xero_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xero_payment_receipts_booking_id_fkey"
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
      ai_retention_days: { Args: never; Returns: number }
      auto_archive_completed_tours: { Args: never; Returns: number }
      booking_skips_billing: { Args: { _booking_id: string }; Returns: boolean }
      booking_skips_emails: { Args: { _booking_id: string }; Returns: boolean }
      calculate_nights: {
        Args: { check_in: string; check_out: string }
        Returns: number
      }
      can_write_attachments: { Args: { _user_id: string }; Returns: boolean }
      check_ai_rate_limit: {
        Args: {
          _max_requests?: number
          _user_id: string
          _window_seconds?: number
        }
        Returns: Json
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
      delete_tour_with_cascade: {
        Args: { p_tour_id: string }
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
      extract_entity_links: {
        Args: { _text: string }
        Returns: {
          entity_id: string
          entity_type: string
        }[]
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
      is_note_owner: {
        Args: { _note_id: string; _user_id: string }
        Returns: boolean
      }
      is_note_shared_with: {
        Args: { _note_id: string; _user_id: string }
        Returns: boolean
      }
      is_task_watcher: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      is_todo_owner: {
        Args: { _todo_id: string; _user_id: string }
        Returns: boolean
      }
      is_todo_shared_with: {
        Args: { _todo_id: string; _user_id: string }
        Returns: boolean
      }
      is_website_approver: { Args: { _user_id: string }; Returns: boolean }
      log_sensitive_operation: {
        Args: {
          details?: Json
          operation_type: string
          record_id: string
          table_name: string
        }
        Returns: undefined
      }
      log_task_activity: {
        Args: {
          p_event_type: string
          p_message?: string
          p_new: Json
          p_old: Json
          p_task_id: string
        }
        Returns: undefined
      }
      migrate_dietary_to_customer_profile: {
        Args: { p_customer_id: string; p_dietary_value: string }
        Returns: undefined
      }
      purge_ai_conversations: { Args: never; Returns: number }
      purge_passport_data: { Args: never; Returns: number }
      recompute_customer_latest_tour: {
        Args: { _customer_id: string }
        Returns: undefined
      }
      record_website_change: {
        Args: {
          _after: Json
          _before: Json
          _section: string
          _summary: string
          _tour_id: string
        }
        Returns: undefined
      }
      refresh_capacity_alerts: { Args: never; Returns: number }
      release_xero_lock: {
        Args: { _holder: string; _lock_name: string }
        Returns: undefined
      }
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
      try_acquire_xero_lock: {
        Args: { _holder: string; _lock_name: string; _ttl_seconds?: number }
        Returns: boolean
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
      booking_automation_override:
        | "inherit"
        | "force_automated"
        | "manual_billing"
        | "manual_emails"
        | "manual_all"
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
      booking_workflow_status:
        | "pending"
        | "enquiry_sent"
        | "quote_received"
        | "on_hold"
        | "contract_signed"
        | "booked"
        | "confirmed"
        | "finalised"
        | "cancelled"
      cancellation_refund_status:
        | "waiting_for_refund"
        | "cancellation_processed"
        | "cash_refund_received"
        | "credit_received"
        | "no_refund"
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
      payment_workflow_status:
        | "unpaid"
        | "partially_paid"
        | "fully_paid"
        | "cancelled"
        | "not_required"
        | "pay_on_the_day"
      task_approval_decision: "pending" | "approved" | "changes_requested"
      task_category:
        | "operations"
        | "finance"
        | "marketing"
        | "booking"
        | "maintenance"
        | "general"
      task_digest_cadence: "daily" | "weekly" | "custom_weekdays"
      task_link_entity_type:
        | "booking"
        | "hotel"
        | "activity"
        | "tour"
        | "contact"
      task_notif_channel: "off" | "email" | "teams" | "both"
      task_priority: "low" | "medium" | "high" | "critical"
      task_status:
        | "not_started"
        | "in_progress"
        | "waiting"
        | "completed"
        | "cancelled"
        | "archived"
        | "not_required"
        | "with_third_party"
        | "awaiting_further_information"
        | "approval_required"
        | "approved"
        | "changes_needed"
      tour_status:
        | "pending"
        | "available"
        | "closed"
        | "sold_out"
        | "past"
        | "archived"
        | "limited_availability"
        | "cancelled"
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
      booking_automation_override: [
        "inherit",
        "force_automated",
        "manual_billing",
        "manual_emails",
        "manual_all",
      ],
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
      booking_workflow_status: [
        "pending",
        "enquiry_sent",
        "quote_received",
        "on_hold",
        "contract_signed",
        "booked",
        "confirmed",
        "finalised",
        "cancelled",
      ],
      cancellation_refund_status: [
        "waiting_for_refund",
        "cancellation_processed",
        "cash_refund_received",
        "credit_received",
        "no_refund",
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
      payment_workflow_status: [
        "unpaid",
        "partially_paid",
        "fully_paid",
        "cancelled",
        "not_required",
        "pay_on_the_day",
      ],
      task_approval_decision: ["pending", "approved", "changes_requested"],
      task_category: [
        "operations",
        "finance",
        "marketing",
        "booking",
        "maintenance",
        "general",
      ],
      task_digest_cadence: ["daily", "weekly", "custom_weekdays"],
      task_link_entity_type: [
        "booking",
        "hotel",
        "activity",
        "tour",
        "contact",
      ],
      task_notif_channel: ["off", "email", "teams", "both"],
      task_priority: ["low", "medium", "high", "critical"],
      task_status: [
        "not_started",
        "in_progress",
        "waiting",
        "completed",
        "cancelled",
        "archived",
        "not_required",
        "with_third_party",
        "awaiting_further_information",
        "approval_required",
        "approved",
        "changes_needed",
      ],
      tour_status: [
        "pending",
        "available",
        "closed",
        "sold_out",
        "past",
        "archived",
        "limited_availability",
        "cancelled",
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
