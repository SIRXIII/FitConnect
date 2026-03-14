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
          created_at: string;
          updated_at: string;
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
          created_at?: string;
          updated_at?: string;
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
          created_at?: string;
          updated_at?: string;
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
      [_ in never]: never;
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
