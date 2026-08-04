export interface GcalConnection {
  id: string;
  trainer_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  is_active: boolean;
  disconnected_reason: string | null;
  connected_at: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GcalBlockedSlot {
  id: string;
  trainer_id: string;
  gcal_event_id: string;
  gcal_summary: string | null;
  starts_at: string;
  ends_at: string;
  synced_at: string;
}
