import { useState } from 'react';
import { toast } from 'sonner';
import { Calendar, Download, RefreshCw, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface CalendarExportCardProps {
  token: string;
  onTokenReset: (newToken: string) => void;
}

const CalendarExportCard: React.FC<CalendarExportCardProps> = ({ token, onTokenReset }) => {
  const [resetting, setResetting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const feedUrl = `${SUPABASE_URL}/functions/v1/calendar-export?token=${token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      toast.success('Calendar feed URL copied to clipboard');
    } catch {
      toast.error('Failed to copy URL');
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(feedUrl);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fitrush-schedule.ics';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Schedule downloaded');
    } catch {
      toast.error('Failed to download schedule');
    } finally {
      setDownloading(false);
    }
  };

  const handleReset = async () => {
    const confirmed = window.confirm(
      'This will invalidate any existing calendar subscriptions. Continue?'
    );
    if (!confirmed) return;

    setResetting(true);
    try {
      const { data, error } = await supabase.rpc('reset_calendar_export_token');
      if (error) throw error;
      const newToken = data as string;
      onTokenReset(newToken);
      toast.success('Calendar token reset. Update your calendar subscription with the new URL.');
    } catch {
      toast.error('Failed to reset calendar token');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="bg-white border border-ink/10 rounded-lg p-6 space-y-6">
      <h3 className="text-xl serif font-light italic text-ink">Calendar Export</h3>

      {/* Feed URL */}
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Feed URL</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-paper border border-ink/10 rounded px-4 py-2.5 text-sm text-ink/60 truncate font-mono">
            {feedUrl}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 border border-ink/20 px-4 py-2 text-[10px] uppercase tracking-[0.2em] font-medium transition-all duration-300 hover:bg-ink hover:text-paper whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Feed URL
          </button>
        </div>
        <p className="text-xs text-ink/40">
          Paste this URL into Google Calendar or Apple Calendar to subscribe to your schedule.
        </p>
      </div>

      {/* Download */}
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Download</p>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 border border-ink/20 px-4 py-2 text-[10px] uppercase tracking-[0.2em] font-medium transition-all duration-300 hover:bg-ink hover:text-paper disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          {downloading ? 'Downloading...' : 'Download .ics'}
        </button>
      </div>

      {/* Reset Token */}
      <div className="pt-4 border-t border-ink/10">
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-2 text-ink/40 text-[10px] uppercase tracking-[0.2em] font-medium transition-all duration-300 hover:text-ink disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
          {resetting ? 'Resetting...' : 'Reset Token'}
        </button>
      </div>
    </div>
  );
};

export default CalendarExportCard;
