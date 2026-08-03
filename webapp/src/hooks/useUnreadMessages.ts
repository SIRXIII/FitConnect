import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';

export function useUnreadMessages() {
  const { user } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!user) { setUnreadCount(0); return; }

    // Get conversation IDs for this user
    const { data: convos } = await supabase
      .from('conversations')
      .select('id')
      .or(`trainer_id.eq.${user.id},client_id.eq.${user.id}`);

    if (!convos?.length) { setUnreadCount(0); return; }

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)
      .neq('sender_id', user.id)
      .in('conversation_id', convos.map((c) => c.id));

    setUnreadCount(count ?? 0);
  }, [user]);

  useEffect(() => { fetchUnread(); }, [fetchUnread]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('unread-messages-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchUnread)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, fetchUnread)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchUnread]);

  return { unreadCount, refetch: fetchUnread };
}
