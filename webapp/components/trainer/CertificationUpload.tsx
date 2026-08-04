import { useState, useRef, useEffect } from 'react';
import { Upload, Check, AlertCircle, Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import {
  CERTIFICATION_TIERS,
  VERIFIABLE_CODES,
  type TrainerCertification,
} from '@/lib/certifications';

interface Props {
  trainerId: string;
  onCertUploaded?: () => void;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const StatusBadge: React.FC<{ status: TrainerCertification['status'] }> = ({ status }) => {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] font-semibold bg-green-50 text-green-700 border border-green-200">
        <Check size={10} strokeWidth={3} />
        Approved
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] font-semibold bg-red-50 text-red-700 border border-red-200">
        <X size={10} strokeWidth={3} />
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <Clock size={10} />
      Under Review
    </span>
  );
};

const CertificationUpload: React.FC<Props> = ({ trainerId, onCertUploaded }) => {
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedCode, setSelectedCode] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [certs, setCerts] = useState<TrainerCertification[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(true);

  const fetchCerts = async () => {
    setLoadingCerts(true);
    try {
      const { data, error } = await (supabase as any)
        .from('trainer_certifications')
        .select('*')
        .eq('trainer_id', trainerId)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      setCerts(data ?? []);
    } catch {
      // silently fail — table may not exist in local dev yet
    } finally {
      setLoadingCerts(false);
    }
  };

  useEffect(() => {
    if (trainerId) fetchCerts();
  }, [trainerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCertInfo = (() => {
    for (const tier of Object.values(CERTIFICATION_TIERS)) {
      const found = tier.certs.find(c => c.code === selectedCode);
      if (found) return found;
    }
    return null;
  })();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error('File too large — maximum 10 MB.');
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedCode || !selectedFile || !user) return;

    setUploading(true);
    try {
      // Upload file to trainer-certifications bucket
      const ext = selectedFile.name.split('.').pop() ?? 'pdf';
      const filePath = `${user.id}/${selectedCode}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('trainer-certifications')
        .upload(filePath, selectedFile, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('trainer-certifications')
        .getPublicUrl(filePath);

      // Insert record into trainer_certifications
      const { error: insertError } = await (supabase as any)
        .from('trainer_certifications')
        .insert({
          trainer_id: trainerId,
          cert_code: selectedCode,
          cert_name: selectedCertInfo?.name ?? selectedCode,
          file_url: publicUrl,
          expiry_date: expiryDate || null,
          status: 'pending',
        });

      if (insertError) throw insertError;

      toast.success('Certification submitted for review.');
      setSelectedCode('');
      setSelectedFile(null);
      setExpiryDate('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchCerts();
      onCertUploaded?.();
    } catch (err) {
      console.error('[CertificationUpload] upload error:', err);
      toast.error('Upload failed — please try again.');
    } finally {
      setUploading(false);
    }
  };

  const canSubmit = selectedCode && selectedFile && !uploading;

  return (
    <div className="space-y-8">
      {/* Upload form */}
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
            Select Certification *
          </label>
          <select
            value={selectedCode}
            onChange={e => setSelectedCode(e.target.value)}
            className="w-full border border-ink/15 bg-transparent px-4 py-3 text-sm font-light outline-none focus:border-ink/40 transition-colors appearance-none"
          >
            <option value="">— Choose a certification —</option>
            {Object.entries(CERTIFICATION_TIERS).map(([tierKey, tier]) => (
              <optgroup key={tierKey} label={tier.label}>
                {tier.certs.map(cert => (
                  <option key={cert.code} value={cert.code}>
                    {cert.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {selectedCertInfo && (
            <p className="text-[11px] text-ink/40 font-light">
              {selectedCertInfo.org}
              {VERIFIABLE_CODES.has(selectedCode) && (
                <span className="ml-2 text-green-600">Accepted for verification</span>
              )}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
            Certificate Document *
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full border border-dashed border-ink/20 hover:border-ink/40 px-6 py-5 flex flex-col items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Upload size={18} className="text-ink/30" strokeWidth={1.5} />
            {selectedFile ? (
              <span className="text-[11px] text-ink/70">{selectedFile.name}</span>
            ) : (
              <span className="text-[11px] text-ink/40 uppercase tracking-[0.15em]">
                PDF, JPG or PNG — max 10 MB
              </span>
            )}
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
            Expiry Date <span className="normal-case text-ink/30">(optional)</span>
          </label>
          <input
            type="date"
            value={expiryDate}
            onChange={e => setExpiryDate(e.target.value)}
            className="w-full border-b border-ink/20 bg-transparent pb-2 text-sm font-light outline-none focus:border-ink/60 transition-colors"
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={!canSubmit}
          className="w-full py-3 bg-ink text-white text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              Uploading…
            </>
          ) : (
            'Upload Certification'
          )}
        </button>
      </div>

      {/* Existing certifications */}
      {!loadingCerts && certs.length > 0 && (
        <div className="space-y-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-ink/40 font-medium">
            Your Certifications
          </p>
          <div className="space-y-3">
            {certs.map(cert => (
              <div key={cert.id} className="border border-ink/10 p-5 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-ink">{cert.cert_name}</p>
                    <p className="text-[10px] text-ink/40 uppercase tracking-[0.1em]">
                      {cert.cert_code}
                      {cert.expiry_date && ` · Expires ${new Date(cert.expiry_date).toLocaleDateString()}`}
                    </p>
                  </div>
                  <StatusBadge status={cert.status} />
                </div>
                {cert.status === 'rejected' && cert.admin_notes && (
                  <div className="flex gap-2 mt-2 p-3 bg-red-50 border border-red-100">
                    <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 font-light">{cert.admin_notes}</p>
                  </div>
                )}
                <a
                  href={cert.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] uppercase tracking-[0.15em] text-ink/40 hover:text-accent transition-colors"
                >
                  View Document
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificationUpload;
