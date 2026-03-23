import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import type { SupportTicket, SupportMessage, TicketStatus, TicketCategory, TicketPriority } from '@/types/support';

export function useSupportTickets(isAdmin = false) {
  const { user, profile } = useAuthStore();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('support_tickets')
        .select('*, user:profiles!support_tickets_user_id_fkey(full_name)')
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setTickets((data ?? []) as unknown as SupportTicket[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const createTicket = async (params: {
    category: TicketCategory;
    subject: string;
    description: string;
    related_booking_id?: string | null;
    related_user_id?: string | null;
  }): Promise<SupportTicket | null> => {
    if (!user) return null;

    const { data, error: insertError } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        category: params.category,
        subject: params.subject,
        description: params.description,
        related_booking_id: params.related_booking_id ?? null,
        related_user_id: params.related_user_id ?? null,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    await fetchTickets();
    return data as unknown as SupportTicket;
  };

  const sendMessage = async (ticketId: string, message: string): Promise<void> => {
    if (!user) return;

    const { error: insertError } = await supabase.from('support_messages').insert({
      ticket_id: ticketId,
      sender_id: user.id,
      is_admin: profile?.role === 'admin',
      message,
    });

    if (insertError) throw insertError;
  };

  const updateTicketStatus = async (
    ticketId: string,
    status: TicketStatus,
    adminNotes?: string
  ): Promise<void> => {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }

    if (adminNotes !== undefined) {
      updates.admin_notes = adminNotes;
    }

    const { error: updateError } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', ticketId);

    if (updateError) throw updateError;
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId ? { ...t, ...updates } as SupportTicket : t
      )
    );
  };

  const updateTicketPriority = async (
    ticketId: string,
    priority: TicketPriority
  ): Promise<void> => {
    const { error: updateError } = await supabase
      .from('support_tickets')
      .update({ priority, updated_at: new Date().toISOString() })
      .eq('id', ticketId);

    if (updateError) throw updateError;
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, priority } : t))
    );
  };

  return {
    tickets,
    loading,
    error,
    refetch: fetchTickets,
    createTicket,
    sendMessage,
    updateTicketStatus,
    updateTicketPriority,
  };
}

export function useTicketMessages(ticketId: string | null) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);

    const { data } = await supabase
      .from('support_messages')
      .select('*, sender:profiles!support_messages_sender_id_fkey(full_name)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    setMessages((data ?? []) as unknown as SupportMessage[]);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    fetchMessages();
    if (!ticketId || !user) return;

    const channel = supabase
      .channel(`ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          const newMsg = payload.new as SupportMessage;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, user, fetchMessages]);

  return { messages, loading, refetch: fetchMessages };
}
