export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      accommodations: {
        Row: {
          address: string | null
          amenities: string[] | null
          booking_reference: string | null
          check_in_date: string
          check_out_date: string
          contact_info: Json | null
          cost_per_night: number | null
          created_at: string | null
          id: string
          name: string
          room_type: string | null
          total_rooms: number | null
          tour_id: string | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          booking_reference?: string | null
          check_in_date: string
          check_out_date: string
          contact_info?: Json | null
          cost_per_night?: number | null
          created_at?: string | null
          id?: string
          name: string
          room_type?: string | null
          total_rooms?: number | null
          tour_id?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          booking_reference?: string | null
          check_in_date?: string
          check_out_date?: string
          contact_info?: Json | null
          cost_per_night?: number | null
          created_at?: string | null
          id?: string
          name?: string
          room_type?: string | null
          total_rooms?: number | null
          tour_id?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accommodations_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          activity_date: string
          cost_per_person: number | null
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          end_time: string | null
          equipment_included: string[] | null
          equipment_required: string[] | null
          id: string
          location: string | null
          max_participants: number | null
          name: string
          start_time: string | null
          supplier_info: Json | null
          tour_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          activity_date: string
          cost_per_person?: number | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          end_time?: string | null
          equipment_included?: string[] | null
          equipment_required?: string[] | null
          id?: string
          location?: string | null
          max_participants?: number | null
          name: string
          start_time?: string | null
          supplier_info?: Json | null
          tour_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          activity_date?: string
          cost_per_person?: number | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          end_time?: string | null
          equipment_included?: string[] | null
          equipment_required?: string[] | null
          id?: string
          location?: string | null
          max_participants?: number | null
          name?: string
          start_time?: string | null
          supplier_info?: Json | null
          tour_id?: string | null
          updated_at?: string | null
          user_id?: string | null
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
      booking_participants: {
        Row: {
          accommodation_id: string | null
          booking_id: string | null
          created_at: string | null
          customer_id: string | null
          dietary_requirements: string[] | null
          id: string
          participant_type: string | null
          room_assignment: string | null
          special_needs: string | null
        }
        Insert: {
          accommodation_id?: string | null
          booking_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          dietary_requirements?: string[] | null
          id?: string
          participant_type?: string | null
          room_assignment?: string | null
          special_needs?: string | null
        }
        Update: {
          accommodation_id?: string | null
          booking_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          dietary_requirements?: string[] | null
          id?: string
          participant_type?: string | null
          room_assignment?: string | null
          special_needs?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_participants_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_agent_id: string | null
          booking_date: string | null
          confirmation_number: string
          created_at: string | null
          customer_id: string | null
          flight_info: Json | null
          group_name: string | null
          id: string
          invoice_notes: string | null
          number_of_participants: number
          paid_amount: number | null
          payment_status: string | null
          pickup_location: string | null
          room_preferences: string | null
          special_requests: string | null
          status: string | null
          total_amount: number
          tour_id: string | null
          updated_at: string | null
          user_id: string | null
          waiver_status: string | null
        }
        Insert: {
          booking_agent_id?: string | null
          booking_date?: string | null
          confirmation_number: string
          created_at?: string | null
          customer_id?: string | null
          flight_info?: Json | null
          group_name?: string | null
          id?: string
          invoice_notes?: string | null
          number_of_participants: number
          paid_amount?: number | null
          payment_status?: string | null
          pickup_location?: string | null
          room_preferences?: string | null
          special_requests?: string | null
          status?: string | null
          total_amount: number
          tour_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          waiver_status?: string | null
        }
        Update: {
          booking_agent_id?: string | null
          booking_date?: string | null
          confirmation_number?: string
          created_at?: string | null
          customer_id?: string | null
          flight_info?: Json | null
          group_name?: string | null
          id?: string
          invoice_notes?: string | null
          number_of_participants?: number
          paid_amount?: number | null
          payment_status?: string | null
          pickup_location?: string | null
          room_preferences?: string | null
          special_requests?: string | null
          status?: string | null
          total_amount?: number
          tour_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          waiver_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      customers: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          dietary_requirements: string[] | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          id: string
          last_name: string
          marketing_consent: boolean | null
          nationality: string | null
          passport_number: string | null
          phone: string | null
          special_needs: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          dietary_requirements?: string[] | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          id?: string
          last_name: string
          marketing_consent?: boolean | null
          nationality?: string | null
          passport_number?: string | null
          phone?: string | null
          special_needs?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          dietary_requirements?: string[] | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          id?: string
          last_name?: string
          marketing_consent?: boolean | null
          nationality?: string | null
          passport_number?: string | null
          phone?: string | null
          special_needs?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string | null
          currency: string | null
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          payment_processor: string | null
          status: string | null
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_processor?: string | null
          status?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_processor?: string | null
          status?: string | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      tours: {
        Row: {
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          duration_days: number
          end_date: string
          exclusions: string[] | null
          id: string
          images: string[] | null
          inclusions: string[] | null
          itinerary: Json | null
          max_capacity: number
          meeting_point: string | null
          name: string
          pickup_locations: string[] | null
          price_per_person: number
          start_date: string
          status: string | null
          tour_guide: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          duration_days: number
          end_date: string
          exclusions?: string[] | null
          id?: string
          images?: string[] | null
          inclusions?: string[] | null
          itinerary?: Json | null
          max_capacity: number
          meeting_point?: string | null
          name: string
          pickup_locations?: string[] | null
          price_per_person: number
          start_date: string
          status?: string | null
          tour_guide?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          duration_days?: number
          end_date?: string
          exclusions?: string[] | null
          id?: string
          images?: string[] | null
          inclusions?: string[] | null
          itinerary?: Json | null
          max_capacity?: number
          meeting_point?: string | null
          name?: string
          pickup_locations?: string[] | null
          price_per_person?: number
          start_date?: string
          status?: string | null
          tour_guide?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          department: string | null
          first_name: string | null
          id: string
          is_active: boolean | null
          last_name: string | null
          permissions: Json | null
          phone: string | null
          role: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          permissions?: Json | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          permissions?: Json | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_dashboard_metrics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
