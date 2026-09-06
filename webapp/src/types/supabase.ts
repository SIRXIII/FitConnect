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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_slots: {
        Row: {
          created_at: string
          deleted_at: string | null
          end_time: string
          group_rate: number | null
          id: string
          is_booked: boolean
          is_gcal_blocked: boolean
          is_trial_eligible: boolean
          max_capacity: number | null
          slot_type: string
          start_time: string
          trainer_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          end_time: string
          group_rate?: number | null
          id?: string
          is_booked?: boolean
          is_gcal_blocked?: boolean
          is_trial_eligible?: boolean
          max_capacity?: number | null
          slot_type?: string
          start_time: string
          trainer_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          end_time?: string
          group_rate?: number | null
          id?: string
          is_booked?: boolean
          is_gcal_blocked?: boolean
          is_trial_eligible?: boolean
          max_capacity?: number | null
          slot_type?: string
          start_time?: string
          trainer_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_requests: {
        Row: {
          accepted_at: string | null
          client_id: string
          created_at: string
          decline_reason: string | null
          declined_at: string | null
          id: string
          slot_id: string
          status: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          client_id: string
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          slot_id: string
          status?: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          client_id?: string
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          slot_id?: string
          status?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "availability_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancellation_reason: string | null
          cancelled_by: string | null
          checkin_end_nudge_sent_at: string | null
          checkin_start_nudge_sent_at: string | null
          client_id: string
          created_at: string
          gcal_event_id: string | null
          id: string
          is_comp: boolean
          notes: string | null
          payment_type: string
          platform_fee: number
          rate_charged: number
          reminder_sent_at: string | null
          slot_id: string
          status: Database["public"]["Enums"]["booking_status"]
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          trainer_id: string
          trainer_payout: number
          updated_at: string
          verification_method: string | null
          verification_overridden_at: string | null
          verification_overridden_by: string | null
          verification_status: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_by?: string | null
          checkin_end_nudge_sent_at?: string | null
          checkin_start_nudge_sent_at?: string | null
          client_id: string
          created_at?: string
          gcal_event_id?: string | null
          id?: string
          is_comp?: boolean
          notes?: string | null
          payment_type?: string
          platform_fee: number
          rate_charged: number
          reminder_sent_at?: string | null
          slot_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          trainer_id: string
          trainer_payout: number
          updated_at?: string
          verification_method?: string | null
          verification_overridden_at?: string | null
          verification_overridden_by?: string | null
          verification_status?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_by?: string | null
          checkin_end_nudge_sent_at?: string | null
          checkin_start_nudge_sent_at?: string | null
          client_id?: string
          created_at?: string
          gcal_event_id?: string | null
          id?: string
          is_comp?: boolean
          notes?: string | null
          payment_type?: string
          platform_fee?: number
          rate_charged?: number
          reminder_sent_at?: string | null
          slot_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          trainer_id?: string
          trainer_payout?: number
          updated_at?: string
          verification_method?: string | null
          verification_overridden_at?: string | null
          verification_overridden_by?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "availability_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_verification_overridden_by_fkey"
            columns: ["verification_overridden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_events: {
        Row: {
          abuse_flag: boolean
          actor_role: Database["public"]["Enums"]["actor_role"]
          booking_id: string | null
          cancelled_at: string
          created_at: string
          fee_outcome: Database["public"]["Enums"]["fee_outcome"] | null
          id: string
          reason: Database["public"]["Enums"]["cancellation_reason"]
          refund_amount: number | null
          signal_codes: string[]
        }
        Insert: {
          abuse_flag?: boolean
          actor_role: Database["public"]["Enums"]["actor_role"]
          booking_id?: string | null
          cancelled_at?: string
          created_at?: string
          fee_outcome?: Database["public"]["Enums"]["fee_outcome"] | null
          id?: string
          reason: Database["public"]["Enums"]["cancellation_reason"]
          refund_amount?: number | null
          signal_codes?: string[]
        }
        Update: {
          abuse_flag?: boolean
          actor_role?: Database["public"]["Enums"]["actor_role"]
          booking_id?: string | null
          cancelled_at?: string
          created_at?: string
          fee_outcome?: Database["public"]["Enums"]["fee_outcome"] | null
          id?: string
          reason?: Database["public"]["Enums"]["cancellation_reason"]
          refund_amount?: number | null
          signal_codes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      certification_catalog: {
        Row: {
          accreditation: string
          cert_code: string
          display_name: string
          is_active: boolean
          kind: string
          org: string
          sort_order: number
          tier: string
          verify_fields: string | null
          verify_url: string | null
        }
        Insert: {
          accreditation: string
          cert_code: string
          display_name: string
          is_active?: boolean
          kind: string
          org: string
          sort_order?: number
          tier: string
          verify_fields?: string | null
          verify_url?: string | null
        }
        Update: {
          accreditation?: string
          cert_code?: string
          display_name?: string
          is_active?: boolean
          kind?: string
          org?: string
          sort_order?: number
          tier?: string
          verify_fields?: string | null
          verify_url?: string | null
        }
        Relationships: []
      }
      client_errors: {
        Row: {
          app_version: string | null
          build_number: string | null
          context: Json | null
          created_at: string
          error: string
          id: string
          mode: string | null
          platform: string | null
          source: string | null
          stack: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          build_number?: string | null
          context?: Json | null
          created_at?: string
          error: string
          id?: string
          mode?: string | null
          platform?: string | null
          source?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          build_number?: string | null
          context?: Json | null
          created_at?: string
          error?: string
          id?: string
          mode?: string | null
          platform?: string | null
          source?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_notification_preferences: {
        Row: {
          area_label: string | null
          area_lat: number | null
          area_lng: number | null
          created_at: string
          id: string
          notif_enabled: boolean
          notif_radius_miles: number
          updated_at: string
          user_id: string
        }
        Insert: {
          area_label?: string | null
          area_lat?: number | null
          area_lng?: number | null
          created_at?: string
          id?: string
          notif_enabled?: boolean
          notif_radius_miles?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          area_label?: string | null
          area_lat?: number | null
          area_lng?: number | null
          created_at?: string
          id?: string
          notif_enabled?: boolean
          notif_radius_miles?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          age: number | null
          age_range: string | null
          bio: string | null
          body_type: string | null
          created_at: string
          fitness_goals: string[]
          fitness_level: string | null
          gender: string | null
          goals_ranked: Json
          health_conditions: Json
          health_notes: string | null
          height_ft: number | null
          height_in: number | null
          hourly_budget_max: number | null
          id: string
          intensity_preference: string | null
          preferred_session_length: number
          preferred_workout_locations: string[]
          stripe_customer_id: string | null
          stripe_payment_brand: string | null
          stripe_payment_last4: string | null
          stripe_payment_method_id: string | null
          training_frequency: string | null
          updated_at: string
          user_id: string
          weight_lbs: number | null
          workout_types: string[]
        }
        Insert: {
          age?: number | null
          age_range?: string | null
          bio?: string | null
          body_type?: string | null
          created_at?: string
          fitness_goals?: string[]
          fitness_level?: string | null
          gender?: string | null
          goals_ranked?: Json
          health_conditions?: Json
          health_notes?: string | null
          height_ft?: number | null
          height_in?: number | null
          hourly_budget_max?: number | null
          id?: string
          intensity_preference?: string | null
          preferred_session_length?: number
          preferred_workout_locations?: string[]
          stripe_customer_id?: string | null
          stripe_payment_brand?: string | null
          stripe_payment_last4?: string | null
          stripe_payment_method_id?: string | null
          training_frequency?: string | null
          updated_at?: string
          user_id: string
          weight_lbs?: number | null
          workout_types?: string[]
        }
        Update: {
          age?: number | null
          age_range?: string | null
          bio?: string | null
          body_type?: string | null
          created_at?: string
          fitness_goals?: string[]
          fitness_level?: string | null
          gender?: string | null
          goals_ranked?: Json
          health_conditions?: Json
          health_notes?: string | null
          height_ft?: number | null
          height_in?: number | null
          hourly_budget_max?: number | null
          id?: string
          intensity_preference?: string | null
          preferred_session_length?: number
          preferred_workout_locations?: string[]
          stripe_customer_id?: string | null
          stripe_payment_brand?: string | null
          stripe_payment_last4?: string | null
          stripe_payment_method_id?: string | null
          training_frequency?: string | null
          updated_at?: string
          user_id?: string
          weight_lbs?: number | null
          workout_types?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_session_credits: {
        Row: {
          booking_id: string | null
          client_id: string
          granted_at: string
          granted_by: string | null
          id: string
          notes: string | null
          outcome: string | null
          reason: string
          redeemed_at: string | null
          status: string
          trainer_id: string | null
        }
        Insert: {
          booking_id?: string | null
          client_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          reason?: string
          redeemed_at?: string | null
          status?: string
          trainer_id?: string | null
        }
        Update: {
          booking_id?: string | null
          client_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          reason?: string
          redeemed_at?: string | null
          status?: string
          trainer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_session_credits_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_session_credits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_session_credits_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_session_credits_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          client_id: string
          created_at: string
          id: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          intent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          intent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          intent?: string | null
        }
        Relationships: []
      }
      feature_interest: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_interest_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gcal_blocked_slots: {
        Row: {
          ends_at: string
          gcal_event_id: string
          gcal_summary: string | null
          id: string
          source_feed_id: string | null
          starts_at: string
          synced_at: string
          trainer_id: string
        }
        Insert: {
          ends_at: string
          gcal_event_id: string
          gcal_summary?: string | null
          id?: string
          source_feed_id?: string | null
          starts_at: string
          synced_at?: string
          trainer_id: string
        }
        Update: {
          ends_at?: string
          gcal_event_id?: string
          gcal_summary?: string | null
          id?: string
          source_feed_id?: string | null
          starts_at?: string
          synced_at?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gcal_blocked_slots_source_feed_id_fkey"
            columns: ["source_feed_id"]
            isOneToOne: false
            referencedRelation: "trainer_calendar_feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gcal_blocked_slots_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gcal_busy_slots: {
        Row: {
          all_day: boolean | null
          end_time: string | null
          gcal_event_id: string
          id: string
          is_fitrush: boolean | null
          start_time: string | null
          synced_at: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          all_day?: boolean | null
          end_time?: string | null
          gcal_event_id: string
          id?: string
          is_fitrush?: boolean | null
          start_time?: string | null
          synced_at?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          all_day?: boolean | null
          end_time?: string | null
          gcal_event_id?: string
          id?: string
          is_fitrush?: boolean | null
          start_time?: string | null
          synced_at?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      google_calendar_connections: {
        Row: {
          access_token: string
          connected_at: string
          created_at: string
          disconnected_reason: string | null
          expires_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          refresh_token: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          created_at?: string
          disconnected_reason?: string | null
          expires_at: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          refresh_token: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          created_at?: string
          disconnected_reason?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          refresh_token?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: true
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          expires_at: string
          refresh_token: string | null
          scope: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          expires_at: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          expires_at?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      message_flags: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          message_id: string | null
          original_excerpt: string | null
          reasons: string[]
          sender_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          original_excerpt?: string | null
          reasons?: string[]
          sender_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          original_excerpt?: string | null
          reasons?: string[]
          sender_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          // hand-narrowed to the pre-regeneration app contract (see W4 notes): DEFAULT now(), never written null
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          link?: string | null
          message: string
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          client_id: string | null
          created_at: string
          id: string
          is_comp: boolean
          payout_transaction_id: string | null
          platform_fee: number
          status: string
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          trainer_payout: number
          updated_at: string
        }
        Insert: {
          amount?: number
          booking_id: string
          client_id?: string | null
          created_at?: string
          id?: string
          is_comp?: boolean
          payout_transaction_id?: string | null
          platform_fee?: number
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          trainer_payout?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          client_id?: string | null
          created_at?: string
          id?: string
          is_comp?: boolean
          payout_transaction_id?: string | null
          platform_fee?: number
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          trainer_payout?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payout_transaction_id_fkey"
            columns: ["payout_transaction_id"]
            isOneToOne: false
            referencedRelation: "payout_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_transactions: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          initiated_by: string | null
          initiated_by_admin_id: string | null
          status: string
          stripe_transfer_id: string | null
          trainer_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          initiated_by?: string | null
          initiated_by_admin_id?: string | null
          status?: string
          stripe_transfer_id?: string | null
          trainer_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          initiated_by?: string | null
          initiated_by_admin_id?: string | null
          status?: string
          stripe_transfer_id?: string | null
          trainer_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_transactions_initiated_by_admin_id_fkey"
            columns: ["initiated_by_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_transactions_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      post_session_surveys: {
        Row: {
          booking_id: string
          client_id: string
          created_at: string
          dismissed: boolean
          id: string
          suggestion: string | null
          would_use_again: boolean | null
        }
        Insert: {
          booking_id: string
          client_id: string
          created_at?: string
          dismissed?: boolean
          id?: string
          suggestion?: string | null
          would_use_again?: boolean | null
        }
        Update: {
          booking_id?: string
          client_id?: string
          created_at?: string
          dismissed?: boolean
          id?: string
          suggestion?: string | null
          would_use_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "post_session_surveys_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_session_surveys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_workout_surveys: {
        Row: {
          booking_id: string
          created_at: string | null
          energy_level: string | null
          id: string
          rebook_likelihood: string | null
          suggestion: string | null
          trainer_match: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          energy_level?: string | null
          id?: string
          rebook_likelihood?: string | null
          suggestion?: string | null
          trainer_match?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          energy_level?: string | null
          id?: string
          rebook_likelihood?: string | null
          suggestion?: string | null
          trainer_match?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_workout_surveys_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_private_details: {
        Row: {
          phone: string | null
          // service-role-write-only (authenticated column grants exclude it)
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
        }
        // stripe_customer_id is intentionally absent from Insert/Update:
        // service-role-write-only (authenticated column grants exclude it)
        Insert: {
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_private_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          // hand-narrowed to the pre-regeneration app contract (see W4 notes): nullable live, treated as non-null app-wide
          full_name: string
          gym_memberships: string[]
          id: string
          is_suspended: boolean
          location: string | null
          onboarding_complete: boolean
          phone: string | null
          referral_code: string
          referral_discount_pending: boolean
          referral_discount_trainer_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          stripe_customer_id: string | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          gym_memberships?: string[]
          id: string
          is_suspended?: boolean
          location?: string | null
          onboarding_complete?: boolean
          phone?: string | null
          referral_code?: string
          referral_discount_pending?: boolean
          referral_discount_trainer_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          stripe_customer_id?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          gym_memberships?: string[]
          id?: string
          is_suspended?: boolean
          location?: string | null
          onboarding_complete?: boolean
          phone?: string | null
          referral_code?: string
          referral_discount_pending?: boolean
          referral_discount_trainer_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          stripe_customer_id?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referral_discount_trainer_id_fkey"
            columns: ["referral_discount_trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string | null
          created_at: string | null
          device_token: string | null
          endpoint: string
          id: string
          p256dh: string | null
          platform: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth_key?: string | null
          created_at?: string | null
          device_token?: string | null
          endpoint: string
          id?: string
          p256dh?: string | null
          platform?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string | null
          created_at?: string | null
          device_token?: string | null
          endpoint?: string
          id?: string
          p256dh?: string | null
          platform?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referred_role: string
          referrer_id: string
          reward_type: string | null
          rewarded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referred_role: string
          referrer_id: string
          reward_type?: string | null
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referred_role?: string
          referrer_id?: string
          reward_type?: string | null
          rewarded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          client_id: string
          comment: string | null
          created_at: string
          flagged_at: string | null
          id: string
          is_flagged: boolean
          is_hidden: boolean
          rating: number
          rating_communication: number | null
          rating_expertise: number | null
          rating_punctuality: number | null
          trainer_id: string
          trainer_response: string | null
          trainer_response_at: string | null
        }
        Insert: {
          booking_id: string
          client_id: string
          comment?: string | null
          created_at?: string
          flagged_at?: string | null
          id?: string
          is_flagged?: boolean
          is_hidden?: boolean
          rating: number
          rating_communication?: number | null
          rating_expertise?: number | null
          rating_punctuality?: number | null
          trainer_id: string
          trainer_response?: string | null
          trainer_response_at?: string | null
        }
        Update: {
          booking_id?: string
          client_id?: string
          comment?: string | null
          created_at?: string
          flagged_at?: string | null
          id?: string
          is_flagged?: boolean
          is_hidden?: boolean
          rating?: number
          rating_communication?: number | null
          rating_expertise?: number | null
          rating_punctuality?: number | null
          trainer_id?: string
          trainer_response?: string | null
          trainer_response_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_exercises: {
        Row: {
          exercise_key: string | null
          exercise_name: string
          id: string
          muscle_groups: string[] | null
          notes: string | null
          rest_seconds: number | null
          routine_id: string
          sort_order: number
          superset_group: number | null
          target_reps_max: number | null
          target_reps_min: number | null
          target_sets: number | null
        }
        Insert: {
          exercise_key?: string | null
          exercise_name: string
          id?: string
          muscle_groups?: string[] | null
          notes?: string | null
          rest_seconds?: number | null
          routine_id: string
          sort_order?: number
          superset_group?: number | null
          target_reps_max?: number | null
          target_reps_min?: number | null
          target_sets?: number | null
        }
        Update: {
          exercise_key?: string | null
          exercise_name?: string
          id?: string
          muscle_groups?: string[] | null
          notes?: string | null
          rest_seconds?: number | null
          routine_id?: string
          sort_order?: number
          superset_group?: number | null
          target_reps_max?: number | null
          target_reps_min?: number | null
          target_sets?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "routine_exercises_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "workout_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      session_checkins: {
        Row: {
          accuracy_m: number | null
          actor_role: Database["public"]["Enums"]["actor_role"]
          booking_id: string
          captured_at: string
          created_at: string
          distance_m: number | null
          geo_point: unknown
          id: string
          is_mocked: boolean | null
          latitude: number | null
          longitude: number | null
          method: string
          phase: string
          qr_token_id: string | null
          spoof_signals: Json
          submitted_at: string
        }
        Insert: {
          accuracy_m?: number | null
          actor_role: Database["public"]["Enums"]["actor_role"]
          booking_id: string
          captured_at: string
          created_at?: string
          distance_m?: number | null
          geo_point?: unknown
          id?: string
          is_mocked?: boolean | null
          latitude?: number | null
          longitude?: number | null
          method?: string
          phase: string
          qr_token_id?: string | null
          spoof_signals?: Json
          submitted_at?: string
        }
        Update: {
          accuracy_m?: number | null
          actor_role?: Database["public"]["Enums"]["actor_role"]
          booking_id?: string
          captured_at?: string
          created_at?: string
          distance_m?: number | null
          geo_point?: unknown
          id?: string
          is_mocked?: boolean | null
          latitude?: number | null
          longitude?: number | null
          method?: string
          phase?: string
          qr_token_id?: string | null
          spoof_signals?: Json
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_checkins_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      session_logs: {
        Row: {
          booking_id: string
          client_id: string
          created_at: string
          exercises: Json
          id: string
          notes: string | null
          trainer_id: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          client_id: string
          created_at?: string
          exercises?: Json
          id?: string
          notes?: string | null
          trainer_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          client_id?: string
          created_at?: string
          exercises?: Json
          id?: string
          notes?: string | null
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_notifications: {
        Row: {
          client_id: string
          created_at: string
          id: string
          notified_at: string | null
          trainer_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notified_at?: string | null
          trainer_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notified_at?: string | null
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_notifications_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          event_type: string
          id: string
          payload: Json | null
          processed_at: string
          stripe_event_id: string
          trainer_id: string
        }
        Insert: {
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string
          stripe_event_id: string
          trainer_id: string
        }
        Update: {
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string
          stripe_event_id?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      superfit_badges: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          created_at: string
          id: string
          is_active: boolean
          revoke_reason: string | null
          revoked_at: string | null
          trainer_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          revoke_reason?: string | null
          revoked_at?: string | null
          trainer_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          revoke_reason?: string | null
          revoked_at?: string | null
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "superfit_badges_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          created_at: string
          id: string
          message: string
          status: string
          type: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          status?: string
          type?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          status?: string
          type?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          description: string
          id: string
          priority: string
          related_booking_id: string | null
          related_user_id: string | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          category: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          related_booking_id?: string | null
          related_user_id?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          related_booking_id?: string | null
          related_user_id?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_related_booking_id_fkey"
            columns: ["related_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_calendar_feeds: {
        Row: {
          api_token: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          last_synced_at: string | null
          provider: string
          provider_ref: string | null
          sync_error: string | null
          sync_status: string
          trainer_id: string
          url: string
        }
        Insert: {
          api_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          last_synced_at?: string | null
          provider?: string
          provider_ref?: string | null
          sync_error?: string | null
          sync_status?: string
          trainer_id: string
          url: string
        }
        Update: {
          api_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          last_synced_at?: string | null
          provider?: string
          provider_ref?: string | null
          sync_error?: string | null
          sync_status?: string
          trainer_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_calendar_feeds_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_certifications: {
        Row: {
          admin_notes: string | null
          cert_code: string
          cert_name: string
          cert_number: string | null
          created_at: string | null
          expiry_date: string | null
          file_path: string | null
          file_url: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          submitted_at: string | null
          trainer_id: string
          verification_checked_at: string | null
          verification_notes: string | null
          verification_status: string
        }
        Insert: {
          admin_notes?: string | null
          cert_code: string
          cert_name: string
          cert_number?: string | null
          created_at?: string | null
          expiry_date?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_at?: string | null
          trainer_id: string
          verification_checked_at?: string | null
          verification_notes?: string | null
          verification_status?: string
        }
        Update: {
          admin_notes?: string | null
          cert_code?: string
          cert_name?: string
          cert_number?: string | null
          created_at?: string | null
          expiry_date?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_at?: string | null
          trainer_id?: string
          verification_checked_at?: string | null
          verification_notes?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_certifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_certifications_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_client_reviews: {
        Row: {
          booking_id: string
          client_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          trainer_id: string
        }
        Insert: {
          booking_id: string
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          trainer_id: string
        }
        Update: {
          booking_id?: string
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_client_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_client_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_client_reviews_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_exercise_sets: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          is_warmup: boolean
          reps: number | null
          rpe: number | null
          session_exercise_id: string
          set_number: number
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_warmup?: boolean
          reps?: number | null
          rpe?: number | null
          session_exercise_id: string
          set_number: number
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_warmup?: boolean
          reps?: number | null
          rpe?: number | null
          session_exercise_id?: string
          set_number?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trainer_exercise_sets_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "trainer_session_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_nominations: {
        Row: {
          city: string
          created_at: string
          first_name: string
          id: string
          ip_hash: string | null
          nominee_email: string | null
          nominee_name: string | null
          nominee_phone: string | null
          state: string
        }
        Insert: {
          city: string
          created_at?: string
          first_name: string
          id?: string
          ip_hash?: string | null
          nominee_email?: string | null
          nominee_name?: string | null
          nominee_phone?: string | null
          state: string
        }
        Update: {
          city?: string
          created_at?: string
          first_name?: string
          id?: string
          ip_hash?: string | null
          nominee_email?: string | null
          nominee_name?: string | null
          nominee_phone?: string | null
          state?: string
        }
        Relationships: []
      }
      trainer_private_details: {
        Row: {
          // hand-added: pending migration 20260905120000_live_repair_security_pricing (W1)
          calendar_export_token: string | null
          calendar_token_notice_acked_at: string | null
          calendar_token_rotated_at: string | null
          created_at: string
          phone: string | null
          photo_guidelines_acked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          // hand-added: pending migration 20260905120000_live_repair_security_pricing (W1)
          calendar_export_token?: string | null
          calendar_token_notice_acked_at?: string | null
          calendar_token_rotated_at?: string | null
          created_at?: string
          phone?: string | null
          photo_guidelines_acked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          // hand-added: pending migration 20260905120000_live_repair_security_pricing (W1)
          calendar_export_token?: string | null
          calendar_token_notice_acked_at?: string | null
          calendar_token_rotated_at?: string | null
          created_at?: string
          phone?: string | null
          photo_guidelines_acked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_private_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_profiles: {
        Row: {
          active_location_id: string | null
          approval_status: string
          availability_session_started_at: string | null
          availability_status: string
          bio: string | null
          booking_count: number
          // hand-narrowed to the pre-regeneration app contract (see W4 notes)
          booking_mode: "instant" | "request"
          buffer_minutes: number
          calendar_export_token: string | null
          cancel_at_period_end: boolean
          cancel_count: number
          certification_number: string | null
          certification_url: string | null
          certifications: string[] | null
          created_at: string
          credential_score: number
          credentials_verified_at: string | null
          current_period_end: string | null
          discount_percentage: number
          expertise_tags: string[]
          faqs: Json
          // hand-added: pending migration 20260905120000_live_repair_security_pricing (W1)
          founding_benefit_started_at: string | null
          gym_memberships: string[]
          hourly_rate: number
          id: string
          intro_video_thumbnail_url: string | null
          intro_video_url: string | null
          is_verified: boolean | null
          latitude: number | null
          location: string
          longitude: number | null
          optimized_rate: number
          payout_hold_reason: string | null
          payout_hold_set_at: string | null
          payout_hold_set_by: string | null
          payout_on_hold: boolean
          payouts_enabled: boolean
          profile_completeness: number
          rank_score: number
          // hand-narrowed to the pre-regeneration app contract (see W4 notes): DEFAULT 0, never written null
          rating: number
          // hand-narrowed to the pre-regeneration app contract (see W4 notes): DEFAULT 0, never written null
          review_count: number
          sleep_timer_expires_at: string | null
          slug: string | null
          social_links: Json | null
          specialties: string[]
          specialty: Database["public"]["Enums"]["trainer_specialty"]
          stripe_account_id: string | null
          stripe_customer_id: string | null
          stripe_details_submitted: boolean
          subscription_id: string | null
          subscription_interval: string | null
          subscription_status: string
          subscription_tier: string
          success_story: string | null
          tier_overridden_at: string | null
          tier_overridden_by: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
          verified: boolean
          verified_at: string | null
          verified_cert_count: number
          years_experience: number | null
        }
        Insert: {
          active_location_id?: string | null
          approval_status?: string
          availability_session_started_at?: string | null
          availability_status?: string
          bio?: string | null
          booking_count?: number
          // hand-narrowed to the pre-regeneration app contract (see W4 notes)
          booking_mode?: "instant" | "request"
          buffer_minutes?: number
          calendar_export_token?: string | null
          cancel_at_period_end?: boolean
          cancel_count?: number
          certification_number?: string | null
          certification_url?: string | null
          certifications?: string[] | null
          created_at?: string
          credential_score?: number
          credentials_verified_at?: string | null
          current_period_end?: string | null
          discount_percentage?: number
          expertise_tags?: string[]
          faqs?: Json
          // hand-added: pending migration 20260905120000_live_repair_security_pricing (W1)
          founding_benefit_started_at?: string | null
          gym_memberships?: string[]
          hourly_rate: number
          id?: string
          intro_video_thumbnail_url?: string | null
          intro_video_url?: string | null
          is_verified?: boolean | null
          latitude?: number | null
          location: string
          longitude?: number | null
          optimized_rate: number
          payout_hold_reason?: string | null
          payout_hold_set_at?: string | null
          payout_hold_set_by?: string | null
          payout_on_hold?: boolean
          payouts_enabled?: boolean
          profile_completeness?: number
          rank_score?: number
          rating?: number | null
          review_count?: number | null
          sleep_timer_expires_at?: string | null
          slug?: string | null
          social_links?: Json | null
          specialties?: string[]
          // hand-widened: forms write the first pick of `specialties`; the DB enum validates it
          specialty: string
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_details_submitted?: boolean
          subscription_id?: string | null
          subscription_interval?: string | null
          subscription_status?: string
          subscription_tier?: string
          success_story?: string | null
          tier_overridden_at?: string | null
          tier_overridden_by?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
          verified_at?: string | null
          verified_cert_count?: number
          years_experience?: number | null
        }
        Update: {
          active_location_id?: string | null
          approval_status?: string
          availability_session_started_at?: string | null
          availability_status?: string
          bio?: string | null
          booking_count?: number
          // hand-narrowed to the pre-regeneration app contract (see W4 notes)
          booking_mode?: "instant" | "request"
          buffer_minutes?: number
          calendar_export_token?: string | null
          cancel_at_period_end?: boolean
          cancel_count?: number
          certification_number?: string | null
          certification_url?: string | null
          certifications?: string[] | null
          created_at?: string
          credential_score?: number
          credentials_verified_at?: string | null
          current_period_end?: string | null
          discount_percentage?: number
          expertise_tags?: string[]
          faqs?: Json
          // hand-added: pending migration 20260905120000_live_repair_security_pricing (W1)
          founding_benefit_started_at?: string | null
          gym_memberships?: string[]
          hourly_rate?: number
          id?: string
          intro_video_thumbnail_url?: string | null
          intro_video_url?: string | null
          is_verified?: boolean | null
          latitude?: number | null
          location?: string
          longitude?: number | null
          optimized_rate?: number
          payout_hold_reason?: string | null
          payout_hold_set_at?: string | null
          payout_hold_set_by?: string | null
          payout_on_hold?: boolean
          payouts_enabled?: boolean
          profile_completeness?: number
          rank_score?: number
          rating?: number | null
          review_count?: number | null
          sleep_timer_expires_at?: string | null
          slug?: string | null
          social_links?: Json | null
          specialties?: string[]
          // hand-widened: forms write the first pick of `specialties`; the DB enum validates it
          specialty?: string
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_details_submitted?: boolean
          subscription_id?: string | null
          subscription_interval?: string | null
          subscription_status?: string
          subscription_tier?: string
          success_story?: string | null
          tier_overridden_at?: string | null
          tier_overridden_by?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
          verified_at?: string | null
          verified_cert_count?: number
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trainer_profiles_active_location_id_fkey"
            columns: ["active_location_id"]
            isOneToOne: false
            referencedRelation: "workout_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_profiles_payout_hold_set_by_fkey"
            columns: ["payout_hold_set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_profiles_tier_overridden_by_fkey"
            columns: ["tier_overridden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_session_exercises: {
        Row: {
          equipment_used: string[] | null
          exercise_key: string | null
          exercise_name: string
          id: string
          muscle_groups: string[] | null
          notes: string | null
          session_log_id: string
          sort_order: number
        }
        Insert: {
          equipment_used?: string[] | null
          exercise_key?: string | null
          exercise_name: string
          id?: string
          muscle_groups?: string[] | null
          notes?: string | null
          session_log_id: string
          sort_order?: number
        }
        Update: {
          equipment_used?: string[] | null
          exercise_key?: string | null
          exercise_name?: string
          id?: string
          muscle_groups?: string[] | null
          notes?: string | null
          session_log_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "trainer_session_exercises_session_log_id_fkey"
            columns: ["session_log_id"]
            isOneToOne: false
            referencedRelation: "trainer_session_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_session_logs: {
        Row: {
          booking_id: string | null
          client_id: string
          created_at: string
          duration_minutes: number | null
          id: string
          routine_id: string | null
          session_date: string
          session_notes: string | null
          trainer_id: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          client_id: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          routine_id?: string | null
          session_date?: string
          session_notes?: string | null
          trainer_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          client_id?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          routine_id?: string | null
          session_date?: string
          session_notes?: string | null
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_session_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_session_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_session_logs_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "workout_routines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_session_logs_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercises: {
        Row: {
          exercise_key: string | null
          exercise_name: string
          id: string
          log_id: string
          sets: Json
          sort_order: number
        }
        Insert: {
          exercise_key?: string | null
          exercise_name: string
          id?: string
          log_id: string
          sets?: Json
          sort_order?: number
        }
        Update: {
          exercise_key?: string | null
          exercise_name?: string
          id?: string
          log_id?: string
          sets?: Json
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_locations: {
        Row: {
          address: string
          created_at: string
          geo_point: unknown
          id: string
          latitude: number
          location_type: string
          longitude: number
          nickname: string | null
          trainer_id: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          geo_point?: unknown
          id?: string
          latitude: number
          location_type: string
          longitude: number
          nickname?: string | null
          trainer_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          geo_point?: unknown
          id?: string
          latitude?: number
          location_type?: string
          longitude?: number
          nickname?: string | null
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_locations_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          booking_id: string | null
          client_id: string
          created_at: string
          id: string
          logged_at: string
          notes: string | null
        }
        Insert: {
          booking_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          logged_at?: string
          notes?: string | null
        }
        Update: {
          booking_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          logged_at?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_routines: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          trainer_id: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          trainer_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_routines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_routines_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      certs_pending_verification: {
        Row: {
          cert_code: string | null
          cert_name: string | null
          cert_number: string | null
          expiry_date: string | null
          id: string | null
          trainer_id: string | null
          trainer_last_name: string | null
          trainer_name: string | null
          verify_fields: string | null
          verify_url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainer_certifications_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_review_stats: {
        Row: {
          avg_communication: number | null
          avg_expertise: number | null
          avg_overall: number | null
          avg_punctuality: number | null
          review_count: number | null
          trainer_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      // hand-added (not live yet): created by migration
      // 20260905120000_live_repair_security_pricing (W1). Drop this block once
      // `generate_typescript_types` emits them.
      accept_booking_request: {
        Args: { p_request_id: string }
        Returns: { booking_id: string } | { error: string }
      }
      decline_pending_booking: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      get_calendar_export_token: { Args: never; Returns: string }
      mark_booking_no_show: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      quote_booking_price: {
        Args: {
          p_apply_referral?: boolean
          p_client_id: string
          p_slot_id: string
        }
        Returns: {
          currency: string
          discount_pct: number
          fee_pct: number
          platform_fee: number
          rate_charged: number
          referral_discount: number
          total: number
          trainer_payout: number
        }[]
      }
      release_pending_booking: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      // end hand-added block
      admin_arrange_comp_booking: {
        Args: {
          p_credit_id: string
          p_rate: number
          p_slot_id: string
          p_trainer_id: string
        }
        Returns: string
      }
      admin_grant_comp_session: {
        Args: { p_client_id: string; p_notes?: string; p_reason?: string }
        Returns: string
      }
      admin_review_cert: {
        Args: { p_cert_id: string; p_decision: string; p_notes: string }
        Returns: undefined
      }
      admin_set_payout_hold: {
        Args: {
          p_hold: boolean
          p_reason?: string
          p_trainer_profile_id: string
        }
        Returns: undefined
      }
      apply_gcal_blocks: { Args: { p_trainer_id: string }; Returns: undefined }
      approve_trainer: { Args: { p_user_id: string }; Returns: undefined }
      auto_complete_past_bookings: { Args: never; Returns: number }
      autorevoke_superfit_badges: { Args: never; Returns: undefined }
      award_superfit_badge: { Args: { p_trainer_id: string }; Returns: Json }
      claim_signup_referral_discount: { Args: never; Returns: boolean }
      client_has_active_booking: {
        Args: { p_trainer_id: string }
        Returns: boolean
      }
      client_has_booking_with_trainer: {
        Args: { p_trainer_id: string }
        Returns: boolean
      }
      count_trainer_active_slots: {
        Args: { p_trainer_id: string }
        Returns: number
      }
      create_booking_atomic: {
        // hand-edited: migration W1 keeps the legacy signature but ignores the
        // money params and returns the server quote (or { error }).
        Args: {
          p_client_id: string
          p_notes?: string | null
          p_platform_fee: number
          p_rate_charged: number
          p_slot_id: string
          p_trainer_id: string
          p_trainer_payout: number
        }
        Returns:
          | {
              booking_id: string
              rate_charged: number
              platform_fee: number
              total: number
              trainer_payout: number
            }
          | { error: string }
      }
      expire_certifications: { Args: never; Returns: number }
      expire_stale_availability: { Args: never; Returns: undefined }
      get_admin_analytics: {
        Args: { p_bucket: string; p_end: string; p_start: string }
        Returns: Json
      }
      get_admin_attention: {
        Args: { p_end?: string; p_start?: string }
        Returns: Json
      }
      get_admin_client_detail: { Args: { p_user_id: string }; Returns: Json }
      get_admin_comp_owed: { Args: never; Returns: Json }
      get_admin_free_session_metrics:
        | { Args: never; Returns: Json }
        | { Args: { p_end?: string; p_start?: string }; Returns: Json }
      get_admin_open_slots: { Args: never; Returns: Json }
      get_admin_payout_balances: { Args: never; Returns: Json }
      get_admin_pending_certs: { Args: { p_status?: string }; Returns: Json }
      get_admin_pending_trainers: { Args: never; Returns: Json }
      get_admin_session_credits: { Args: never; Returns: Json }
      get_admin_trainer_detail: { Args: { p_user_id: string }; Returns: Json }
      get_admin_trainer_sessions: {
        Args: { p_from: string; p_to: string; p_trainer_profile_id: string }
        Returns: Json
      }
      get_admin_user_list: { Args: never; Returns: Json }
      get_referral_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          full_name: string
          rank: number
          referral_count: number
        }[]
      }
      get_slot_booking_count: { Args: { p_slot_id: string }; Returns: number }
      get_trainer_analytics: {
        Args: {
          p_bucket: string
          p_end: string
          p_start: string
          p_trainer_id: string
        }
        Returns: Json
      }
      get_trainer_earnings_summary: {
        Args: { p_end: string; p_start: string; p_trainer_id: string }
        Returns: Json
      }
      get_trainer_idle_heatmap: {
        Args: { p_end: string; p_start: string; p_trainer_id: string }
        Returns: {
          booked_count: number
          day_of_week: number
          hour: number
          total_count: number
        }[]
      }
      get_trainer_peak_hours: {
        Args: { p_end: string; p_start: string; p_trainer_id: string }
        Returns: {
          count: number
          day_of_week: number
          hour: number
        }[]
      }
      get_trainer_slot_utilization: {
        Args: { p_end: string; p_start: string; p_trainer_id: string }
        Returns: Json
      }
      get_trainer_suggested_rate: {
        Args: never
        Returns: {
          comparable_count: number
          current_rate: number
          fill_rate_pct: number
          show_suggestion: boolean
          suggested_rate: number
        }[]
      }
      get_trainer_weekly_missed_income: {
        Args: { p_week_end: string; p_week_start: string }
        Returns: {
          booked_slots: number
          idle_slots: number
          missed_income_cents: number
          top_opportunities: Json
          total_slots: number
        }[]
      }
      get_visible_slots: {
        Args: { p_trainer_id: string }
        Returns: {
          created_at: string
          deleted_at: string | null
          end_time: string
          group_rate: number | null
          id: string
          is_booked: boolean
          is_gcal_blocked: boolean
          is_trial_eligible: boolean
          max_capacity: number | null
          slot_type: string
          start_time: string
          trainer_id: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "availability_slots"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_group_slot_available: { Args: { p_slot_id: string }; Returns: boolean }
      list_flagged_cancellations: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          actor_role: string
          booking_id: string
          cancelled_at: string
          client_id: string
          created_at: string
          fee_outcome: string
          id: string
          reason: string
          refund_amount: number
          signal_codes: string[]
          trainer_id: string
        }[]
      }
      list_flagged_session_checkins: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          booking_id: string
          client_id: string
          last_activity_at: string
          phases: Json
          trainer_id: string
          verification_method: string
          verification_status: string
        }[]
      }
      list_trainer_calendar_feeds: {
        Args: { p_trainer_id: string }
        Returns: {
          block_count: number
          booked_conflict_count: number
          id: string
          is_active: boolean
          label: string
          last_synced_at: string
          provider: string
          sync_error: string
          sync_status: string
          trainer_id: string
          url: string
        }[]
      }
      nominate_trainer_submit: {
        Args: {
          p_city: string
          p_daily_cap?: number
          p_first_name: string
          p_ip_hash: string
          p_nominee_email: string
          p_nominee_name: string
          p_nominee_phone: string
          p_state: string
        }
        Returns: {
          city_count: number
          inserted: boolean
        }[]
      }
      promote_to_trainer: { Args: { p_location?: string }; Returns: undefined }
      recompute_credential_score: { Args: { p_tp: string }; Returns: number }
      redeem_trial_credit: {
        Args: { p_booking_id: string; p_credit_id: string; p_slot_id: string }
        Returns: Json
      }
      reject_trainer: { Args: { p_user_id: string }; Returns: undefined }
      reset_calendar_export_token: { Args: never; Returns: string }
      revoke_superfit_badge: {
        Args: { p_reason?: string; p_trainer_id: string }
        Returns: Json
      }
      send_booking_push: {
        Args: {
          p_body: string
          p_booking_id: string
          p_phase?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      send_booking_reminders: { Args: never; Returns: undefined }
      send_checkin_nudges: { Args: never; Returns: undefined }
      send_email_notification: {
        Args: {
          booking_id?: string
          email_type: string
          review_id?: string
          target_user_id?: string
        }
        Returns: undefined
      }
      trainers_in_view: {
        Args: {
          max_lat: number
          max_lng: number
          min_lat: number
          min_lng: number
        }
        Returns: {
          latitude: number
          location_type: string
          longitude: number
          nickname: string
          trainer_id: string
        }[]
      }
    }
    Enums: {
      actor_role: "client" | "trainer" | "admin"
      booking_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      cancellation_reason:
        | "client_request"
        | "trainer_request"
        | "no_show"
        | "schedule_conflict"
        | "other"
      fee_outcome: "retained" | "waived"
      trainer_specialty:
        | "strength_training"
        | "cardio_hiit"
        | "yoga_pilates"
        | "nutrition_coaching"
        | "injury_rehabilitation"
      user_role: "client" | "trainer" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      actor_role: ["client", "trainer", "admin"],
      booking_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      cancellation_reason: [
        "client_request",
        "trainer_request",
        "no_show",
        "schedule_conflict",
        "other",
      ],
      fee_outcome: ["retained", "waived"],
      trainer_specialty: [
        "strength_training",
        "cardio_hiit",
        "yoga_pilates",
        "nutrition_coaching",
        "injury_rehabilitation",
      ],
      user_role: ["client", "trainer", "admin"],
    },
  },
} as const
