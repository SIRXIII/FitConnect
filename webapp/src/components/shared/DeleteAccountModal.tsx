import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onClose: () => void;
}

const DeleteAccountModal: React.FC<Props> = ({ open, onClose }) => {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { signOut } = useAuthStore();
  const navigate = useNavigate();

  if (!open) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete account');
      }

      await signOut();
      navigate('/');
      toast.success('Your account has been deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  // Use the FitRush design: clean borders, ink/paper scheme, serif headings
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6" onClick={onClose}>
      <div className="bg-paper max-w-md w-full p-8 space-y-6 border border-red-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="text-xl serif font-light italic text-ink">Delete Your Account</h3>
            <p className="text-sm text-ink/50 leading-relaxed">
              This will permanently delete your account, profile, bookings, reviews, and all associated data. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
            Type DELETE to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="w-full border border-ink/20 px-4 py-3 text-sm bg-transparent focus:outline-none focus:border-red-300 placeholder:text-ink/15"
            disabled={deleting}
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-6 py-2.5 text-[10px] uppercase tracking-[0.2em] text-ink/40 border border-ink/10 hover:border-ink/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={confirmText !== 'DELETE' || deleting}
            className="px-6 py-2.5 text-[10px] uppercase tracking-[0.2em] bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {deleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountModal;
