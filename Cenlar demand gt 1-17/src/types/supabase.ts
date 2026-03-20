export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: 'trainer' | 'client' | 'admin' | null;
          full_name: string;
          avatar_url: string | null;
          phone: string | null;
          is_suspended: boolean;
          onboarding_complete: boolean;
          referral_code: string | null;
          referral_discount_pending: boolean;
          referral_discount_trainer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: 'trainer' | 'client' | 'admin' | null;
          full_name?: string;
          avatar_url?: string | null;
          phone?: string | null;
          is_suspended?: boolean;
          onboarding_complete?: boolean;
          referral_code?: string | null;
          referral_discount_pending?: boolean;
          referral_discount_trainer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: 'trainer' | 'client' | 'admin' | null;
          full_name?: string;
          avatar_url?: string | null;
          phone?: string | null;
          is_suspended?: boolean;
          onboarding_complete?: boolean;
          referral_code?: string | null;
          referral_discount_pending?: boolean;
          referral_discount_trainer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trainer_profiles: {
        Row: {
          id: string;
          user_id: string;
          specialty: string;
          bio: string | null;
          hourly_rate: number;
          optimized_rate: number;
          discount_percentage: number;
          location: string;
          latitude: number | null;
          longitude: number | null;
          certifications: string[];
          verified: boolean;
          rating: number;
          review_count: number;
          stripe_account_id: string | null;
          certification_number: string | null;
          certification_url: string | null;
          created_at: string;
          updated_at: string;
          stripe_customer_id: string | null;
          subscription_tier: 'free' | 'pro' | 'elite';
          subscription_status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | 'incomplete';
          subscription_id: string | null;
          subscription_interval: 'month' | 'year' | null;
          trial_ends_at: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          tier_overridden_by: string | null;
          tier_overridden_at: string | null;
          calendar_export_token: string | null;
          buffer_minutes: number;
          availability_status: 'offline' | 'live';
          booking_mode: 'instant' | 'request';
          sleep_timer_expires_at: string | null;
          availability_session_started_at: string | null;
          active_location_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          specialty?: string;
          bio?: string | null;
          hourly_rate?: number;
          optimized_rate?: number;
          discount_percentage?: number;
          location?: string;
          latitude?: number | null;
          longitude?: number | null;
          certifications?: string[];
          verified?: boolean;
          rating?: number;
          review_count?: number;
          stripe_account_id?: string | null;
          certification_number?: string | null;
          certification_url?: string | null;
          created_at?: string;
          updated_at?: string;
          stripe_customer_id?: string | null;
          subscription_tier?: 'free' | 'pro' | 'elite';
          subscription_status?: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | 'incomplete';
          subscription_id?: string | null;
          subscription_interval?: 'month' | 'year' | null;
          trial_ends_at?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          tier_overridden_by?: string | null;
          tier_overridden_at?: string | null;
          calendar_export_token?: string | null;
          buffer_minutes?: number;
          availability_status?: 'offline' | 'live';
          booking_mode?: 'instant' | 'request';
          sleep_timer_expires_at?: string | null;
          availability_session_started_at?: string | null;
          active_location_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          specialty?: string;
          bio?: string | null;
          hourly_rate?: number;
          optimized_rate?: number;
          discount_percentage?: number;
          location?: string;
          latitude?: number | null;
          longitude?: number | null;
          certifications?: string[];
          verified?: boolean;
          rating?: number;
          review_count?: number;
          stripe_account_id?: string | null;
          certification_number?: string | null;
          certification_url?: string | null;
          created_at?: string;
          updated_at?: string;
          stripe_customer_id?: string | null;
          subscription_tier?: 'free' | 'pro' | 'elite';
          subscription_status?: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | 'incomplete';
          subscription_id?: string | null;
          subscription_interval?: 'month' | 'year' | null;
          trial_ends_at?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          tier_overridden_by?: string | null;
          tier_overridden_at?: string | null;
          calendar_export_token?: string | null;
          buffer_minutes?: number;
          availability_status?: 'offline' | 'live';
          booking_mode?: 'instant' | 'request';
          sleep_timer_expires_at?: string | null;
          availability_session_started_at?: string | null;
          active_location_id?: string | null;
        };
        Relationships: [];
      };
      subscription_events: {
        Row: {
          id: string;
          trainer_id: string;
          stripe_event_id: string;
          event_type: string;
          payload: Json | null;
          processed_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          stripe_event_id: string;
          event_type: string;
          payload?: Json | null;
          processed_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          stripe_event_id?: string;
          event_type?: string;
          payload?: Json | null;
          processed_at?: string;
        };
        Relationships: [];
      };
      availability_slots: {
        Row: {
          id: string;
          trainer_id: string;
          start_time: string;
          end_time: string;
          is_booked: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          start_time: string;
          end_time: string;
          is_booked?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          start_time?: string;
          end_time?: string;
          is_booked?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          client_id: string;
          trainer_id: string;
          slot_id: string;
          status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
          rate_charged: number;
          platform_fee: number;
          trainer_payout: number;
          notes: string | null;
          cancellation_reason: string | null;
          cancelled_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          trainer_id: string;
          slot_id: string;
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
          rate_charged: number;
          platform_fee?: number;
          trainer_payout?: number;
          notes?: string | null;
          cancellation_reason?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          trainer_id?: string;
          slot_id?: string;
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
          rate_charged?: number;
          platform_fee?: number;
          trainer_payout?: number;
          notes?: string | null;
          cancellation_reason?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workout_locations: {
        Row: {
          id: string;
          trainer_id: string;
          nickname: string | null;
          address: string;
          latitude: number;
          longitude: number;
          location_type: 'gym' | 'park' | 'in-home';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          nickname?: string | null;
          address: string;
          latitude: number;
          longitude: number;
          location_type: 'gym' | 'park' | 'in-home';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          nickname?: string | null;
          address?: string;
          latitude?: number;
          longitude?: number;
          location_type?: 'gym' | 'park' | 'in-home';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      booking_requests: {
        Row: {
          id: string;
          trainer_id: string;
          client_id: string;
          slot_id: string;
          status: 'pending' | 'accepted' | 'declined';
          decline_reason: string | null;
          declined_at: string | null;
          accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          client_id: string;
          slot_id: string;
          status?: 'pending' | 'accepted' | 'declined';
          decline_reason?: string | null;
          declined_at?: string | null;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          client_id?: string;
          slot_id?: string;
          status?: 'pending' | 'accepted' | 'declined';
          decline_reason?: string | null;
          declined_at?: string | null;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          booking_id: string;
          client_id: string;
          trainer_id: string;
          rating: number;
          comment: string | null;
          rating_punctuality: number | null;
          rating_expertise: number | null;
          rating_communication: number | null;
          trainer_response: string | null;
          trainer_response_at: string | null;
          is_flagged: boolean;
          flagged_at: string | null;
          is_hidden: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          client_id: string;
          trainer_id: string;
          rating: number;
          comment?: string | null;
          rating_punctuality?: number | null;
          rating_expertise?: number | null;
          rating_communication?: number | null;
          trainer_response?: string | null;
          trainer_response_at?: string | null;
          is_flagged?: boolean;
          flagged_at?: string | null;
          is_hidden?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          client_id?: string;
          trainer_id?: string;
          rating?: number;
          comment?: string | null;
          rating_punctuality?: number | null;
          rating_expertise?: number | null;
          rating_communication?: number | null;
          trainer_response?: string | null;
          trainer_response_at?: string | null;
          is_flagged?: boolean;
          flagged_at?: string | null;
          is_hidden?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          link: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          link?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          message?: string;
          link?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          booking_id: string;
          stripe_payment_intent_id: string | null;
          amount: number;
          platform_fee: number;
          trainer_payout: number;
          currency: string;
          payment_method: 'card' | 'debit' | 'venmo' | 'zelle';
          status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          stripe_payment_intent_id?: string | null;
          amount: number;
          platform_fee?: number;
          trainer_payout?: number;
          currency?: string;
          payment_method?: 'card' | 'debit' | 'venmo' | 'zelle';
          status?: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          stripe_payment_intent_id?: string | null;
          amount?: number;
          platform_fee?: number;
          trainer_payout?: number;
          currency?: string;
          payment_method?: 'card' | 'debit' | 'venmo' | 'zelle';
          status?: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          trainer_id: string;
          client_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          client_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          read?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_booking_atomic: {
        Args: {
          p_slot_id: string;
          p_client_id: string;
          p_trainer_id: string;
          p_rate_charged: number;
          p_platform_fee: number;
          p_trainer_payout: number;
          p_notes?: string | null;
        };
        Returns: { booking_id: string } | { error: string };
      };
      get_referral_leaderboard: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_trainer_analytics: {
        Args: { p_trainer_id: string; p_start?: string; p_end?: string; p_bucket?: string; p_period?: string };
        Returns: Json;
      };
      get_trainer_peak_hours: {
        Args: { p_trainer_id: string; p_start?: string; p_end?: string; p_period?: string };
        Returns: Json;
      };
      get_admin_analytics: {
        Args: { p_period?: string };
        Returns: Json;
      };
      reset_calendar_export_token: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_visible_slots: {
        Args: { p_trainer_id: string };
        Returns: Json;
      };
      trainers_in_view: {
        Args: {
          min_lat: number;
          min_lng: number;
          max_lat: number;
          max_lng: number;
        };
        Returns: {
          trainer_id: string;
          latitude: number;
          longitude: number;
          location_type: string;
          nickname: string | null;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database['public']['Tables'] & Database['public']['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database['public']['Tables'] &
        Database['public']['Views'])
    ? (Database['public']['Tables'] &
        Database['public']['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;
