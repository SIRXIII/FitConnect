// Shared types for trainer certification records.
// The accepted cert_code vocabulary lives in the certification_catalog DB table
// (see src/hooks/useCertificationCatalog.ts) — recompute_credential_score() joins
// trainer_certifications.cert_code against it, so any UI offering cert codes must
// read from that table, not a hardcoded list here.

export type CertStatus = 'pending' | 'approved' | 'rejected' | 'needs_info' | 'expired';

export interface TrainerCertification {
  id: string;
  trainer_id: string;
  cert_code: string;
  cert_name: string;
  cert_number?: string | null;
  file_url: string | null;
  file_path?: string | null;
  expiry_date: string | null;
  status: CertStatus;
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}
