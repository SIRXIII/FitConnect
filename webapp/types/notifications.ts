export interface ClientNotificationPreferences {
  id: string;
  user_id: string;
  notif_enabled: boolean;
  area_label: string | null;
  area_lat: number | null;
  area_lng: number | null;
  notif_radius_miles: number;
  created_at: string;
  updated_at: string;
}
