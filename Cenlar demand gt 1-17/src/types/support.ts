export type TicketCategory =
  | 'payment'
  | 'booking'
  | 'account'
  | 'technical'
  | 'dispute'
  | 'report_user'
  | 'other';

export type TicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_on_user'
  | 'resolved'
  | 'closed';

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SupportTicket {
  id: string;
  user_id: string;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  related_booking_id: string | null;
  related_user_id: string | null;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  user?: { full_name: string; email?: string } | null;
  messages?: SupportMessage[];
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  is_admin: boolean;
  message: string;
  created_at: string;
  // joined
  sender?: { full_name: string } | null;
}

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  payment: 'Payment',
  booking: 'Booking',
  account: 'Account',
  technical: 'Technical',
  dispute: 'Dispute',
  report_user: 'Report a User',
  other: 'Other',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_user: 'Waiting on You',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};
