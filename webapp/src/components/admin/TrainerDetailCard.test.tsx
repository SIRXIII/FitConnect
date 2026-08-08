import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  createSignedUrl: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    storage: { from: () => ({ createSignedUrl: mocks.createSignedUrl }) },
  },
}));
vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import TrainerDetailCard, {
  computeMissingTrainerFields,
  type PendingTrainer,
} from './TrainerDetailCard';

// Mirrors the live case that motivated this: certs claimed, no file attached.
const baseTrainer: PendingTrainer = {
  user_id: 'user-1',
  trainer_profile_id: 'tp-1',
  full_name: 'Example Trainer',
  avatar_url: null,
  phone: null,
  email: 'trainer@example.test',
  last_sign_in_at: null,
  approval_status: 'pending',
  created_at: '2026-01-01T00:00:00Z',
  bio: null,
  specialty: null,
  trainer_location: 'Inland Empire',
  profile_location: null,
  hourly_rate: 100,
  optimized_rate: 65,
  discount_percentage: 0,
  years_experience: null,
  expertise_tags: null,
  credential_score: null,
  intro_video_url: null,
  intro_video_thumbnail_url: null,
  certifications: null,
  certification_number: null,
  certification_url: null,
  gym_memberships: null,
  stripe_account_id: null,
  payouts_enabled: false,
  cert_documents: [
    {
      id: 'cert-1',
      cert_name: 'Example CPT',
      cert_code: 'EX-CPT',
      cert_number: null,
      status: 'pending',
      expiry_date: null,
      file_url: null,
      file_path: null,
      submitted_at: '2026-01-01T00:00:00Z',
    },
  ],
};

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.rpc.mockResolvedValue({ error: null });
});

describe('TrainerDetailCard cert review', () => {
  it('flags missing certification files when certs have no document', () => {
    expect(computeMissingTrainerFields(baseTrainer)).toContain('certification files');
  });

  it('disables Approve when the cert has no document', () => {
    render(<TrainerDetailCard trainer={baseTrainer} />);
    expect(screen.getByText('No document uploaded')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^approve$/i })).toHaveProperty('disabled', true);
  });

  it('prefills the request note, then calls admin_review_cert with needs_info', async () => {
    const onCertReviewed = vi.fn();
    render(<TrainerDetailCard trainer={baseTrainer} onCertReviewed={onCertReviewed} />);

    const requestBtn = screen.getByRole('button', { name: /request document/i });
    fireEvent.click(requestBtn); // first click fills the note
    fireEvent.click(requestBtn); // second click submits

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    const [fn, args] = mocks.rpc.mock.calls[0];
    expect(fn).toBe('admin_review_cert');
    expect(args.p_cert_id).toBe('cert-1');
    expect(args.p_decision).toBe('needs_info');
    expect(args.p_notes).toMatch(/upload a photo or PDF/i);
    await waitFor(() => expect(onCertReviewed).toHaveBeenCalled());
  });

  it('refuses to reject without a note', async () => {
    render(<TrainerDetailCard trainer={baseTrainer} />);
    fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('approves a cert that has a document', async () => {
    const withFile: PendingTrainer = {
      ...baseTrainer,
      cert_documents: [{ ...baseTrainer.cert_documents[0], file_path: 'user-1/EX-CPT-1.jpg' }],
    };
    render(<TrainerDetailCard trainer={withFile} />);

    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    expect(mocks.rpc.mock.calls[0][1].p_decision).toBe('approved');
  });
});
