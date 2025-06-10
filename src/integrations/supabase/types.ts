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
      activities: {
        Row: {
          activity_date: string | null
          activity_status: Database["public"]["Enums"]["activity_status"] | null
          collection_location: string | null
          collection_time: string | null
          created_at: string | null
          dropoff_location: string | null
          end_time: string | null
          guide_email: string | null
          guide_name: string | null
          guide_phone: string | null
          hospitality_inclusions: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          operations_notes: string | null
          pickup_location: string | null
          pickup_location_transport: string | null
          pickup_time: string | null
          spots_available: number | null
          spots_booked: number | null
          spots_remaining: number | null
          start_time: string | null
          tour_id: string | null
          transport_company: string | null
          transport_contact_name: string | null
          transport_email: string | null
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
          collection_location?: string | null
          collection_time?: string | null
          created_at?: string | null
          dropoff_location?: string | null
          end_time?: string | null
          guide_email?: string | null
          guide_name?: string | null
          guide_phone?: string | null
          hospitality_inclusions?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          operations_notes?: string | null
          pickup_location?: string | null
          pickup_location_transport?: string | null
          pickup_time?: string | null
          spots_available?: number | null
          spots_booked?: number | null
          spots_remaining?: number | null
          start_time?: string | null
          tour_id?: string | null
          transport_company?: string | null
          transport_contact_name?: string | null
          transport_email?: string | null
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
          collection_location?: string | null
          collection_time?: string | null
          created_at?: string | null
          dropoff_location?: string | null
          end_time?: string | null
          guide_email?: string | null
          guide_name?: string | null
          guide_phone?: string | null
          hospitality_inclusions?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          operations_notes?: string | null
          pickup_location?: string | null
          pickup_location_transport?: string | null
          pickup_time?: string | null
          spots_available?: number | null
          spots_booked?: number | null
          spots_remaining?: number | null
          start_time?: string | null
          tour_id?: string | null
          transport_company?: string | null
          transport_contact_name?: string | null
          transport_email?: string | null
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
      bookings: {
        Row: {
          accommodation_required: boolean | null
          booking_agent: string | null
          check_in_date: string | null
          check_out_date: string | null
          created_at: string | null
          extra_requests: string | null
          group_name: string | null
          id: string
          invoice_notes: string | null
          lead_passenger_id: string | null
          passenger_2_name: string | null
          passenger_3_name: string | null
          passenger_count: number
          status: Database["public"]["Enums"]["booking_status"] | null
          total_nights: number | null
          tour_id: string | null
          updated_at: string | null
        }
        Insert: {
          accommodation_required?: boolean | null
          booking_agent?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string | null
          extra_requests?: string | null
          group_name?: string | null
          id?: string
          invoice_notes?: string | null
          lead_passenger_id?: string | null
          passenger_2_name?: string | null
          passenger_3_name?: string | null
          passenger_count?: number
          status?: Database["public"]["Enums"]["booking_status"] | null
          total_nights?: number | null
          tour_id?: string | null
          updated_at?: string | null
        }
        Update: {
          accommodation_required?: boolean | null
          booking_agent?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          created_at?: string | null
          extra_requests?: string | null
          group_name?: string | null
          id?: string
          invoice_notes?: string | null
          lead_passenger_id?: string | null
          passenger_2_name?: string | null
          passenger_3_name?: string | null
          passenger_count?: number
          status?: Database["public"]["Enums"]["booking_status"] | null
          total_nights?: number | null
          tour_id?: string | null
          updated_at?: string | null
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
            foreignKeyName: "bookings_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sync_log: {
        Row: {
          contact_id: string | null
          created_at: string | null
          crm_contact_id: string | null
          error_message: string | null
          id: string
          sync_action: string | null
          sync_status: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          crm_contact_id?: string | null
          error_message?: string | null
          id?: string
          sync_action?: string | null
          sync_status?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          crm_contact_id?: string | null
          error_message?: string | null
          id?: string
          sync_action?: string | null
          sync_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_sync_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          crm_id: string | null
          dietary_requirements: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          last_synced_at: string | null
          notes: string | null
          phone: string | null
          spouse_name: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          crm_id?: string | null
          dietary_requirements?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          last_synced_at?: string | null
          notes?: string | null
          phone?: string | null
          spouse_name?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          crm_id?: string | null
          dietary_requirements?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          last_synced_at?: string | null
          notes?: string | null
          phone?: string | null
          spouse_name?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contract_url: string | null
          created_at: string | null
          default_check_in: string | null
          default_check_out: string | null
          default_room_type: string | null
          extra_night_price: number | null
          id: string
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
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_url?: string | null
          created_at?: string | null
          default_check_in?: string | null
          default_check_out?: string | null
          default_room_type?: string | null
          extra_night_price?: number | null
          id?: string
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
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_url?: string | null
          created_at?: string | null
          default_check_in?: string | null
          default_check_out?: string | null
          default_room_type?: string | null
          extra_night_price?: number | null
          id?: string
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
      tours: {
        Row: {
          capacity: number | null
          created_at: string | null
          days: number
          deposit_required: number | null
          end_date: string
          exclusions: string | null
          final_payment_date: string | null
          id: string
          inclusions: string | null
          instalment_details: string | null
          location: string | null
          name: string
          nights: number
          notes: string | null
          pickup_point: string | null
          price_double: number | null
          price_single: number | null
          price_twin: number | null
          start_date: string
          status: Database["public"]["Enums"]["tour_status"] | null
          updated_at: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          days: number
          deposit_required?: number | null
          end_date: string
          exclusions?: string | null
          final_payment_date?: string | null
          id?: string
          inclusions?: string | null
          instalment_details?: string | null
          location?: string | null
          name: string
          nights: number
          notes?: string | null
          pickup_point?: string | null
          price_double?: number | null
          price_single?: number | null
          price_twin?: number | null
          start_date: string
          status?: Database["public"]["Enums"]["tour_status"] | null
          updated_at?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          days?: number
          deposit_required?: number | null
          end_date?: string
          exclusions?: string | null
          final_payment_date?: string | null
          id?: string
          inclusions?: string | null
          instalment_details?: string | null
          location?: string | null
          name?: string
          nights?: number
          notes?: string | null
          pickup_point?: string | null
          price_double?: number | null
          price_single?: number | null
          price_twin?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["tour_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_nights: {
        Args: { check_in: string; check_out: string }
        Returns: number
      }
    }
    Enums: {
      activity_status:
        | "pending"
        | "booked"
        | "paid_deposit"
        | "fully_paid"
        | "confirmed"
      bedding_type: "single" | "double" | "twin"
      booking_status:
        | "pending"
        | "invoiced"
        | "deposited"
        | "paid"
        | "cancelled"
      hotel_booking_status: "enquiry_sent" | "booked" | "pending"
      tour_status: "pending" | "available" | "closed" | "sold_out" | "past"
      transport_status:
        | "pending"
        | "booked"
        | "paid_deposit"
        | "fully_paid"
        | "confirmed"
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
    Enums: {
      activity_status: [
        "pending",
        "booked",
        "paid_deposit",
        "fully_paid",
        "confirmed",
      ],
      bedding_type: ["single", "double", "twin"],
      booking_status: ["pending", "invoiced", "deposited", "paid", "cancelled"],
      hotel_booking_status: ["enquiry_sent", "booked", "pending"],
      tour_status: ["pending", "available", "closed", "sold_out", "past"],
      transport_status: [
        "pending",
        "booked",
        "paid_deposit",
        "fully_paid",
        "confirmed",
      ],
    },
  },
} as const
