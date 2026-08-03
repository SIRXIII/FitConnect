import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// certification_catalog is the source of truth for cert_code values — it's what
// recompute_credential_score() joins against. Any dropdown that writes cert_code
// must read from this table, not a hardcoded list, or approved certs silently
// score zero on a cert_code mismatch.
export interface CatalogCert {
  cert_code: string;
  display_name: string;
  org: string;
  accreditation: 'NCCA' | 'DEAC' | 'none' | 'safety';
  tier: 'gold' | 'strong' | 'acceptable' | 'safety' | 'other';
  kind: 'cpt' | 'advanced' | 'specialty' | 'nutrition' | 'safety' | 'other';
  verify_url: string | null;
  verify_fields: string | null;
  sort_order: number;
}

export interface CatalogGroup {
  kind: CatalogCert['kind'];
  label: string;
  certs: CatalogCert[];
}

const KIND_LABELS: Record<CatalogCert['kind'], string> = {
  cpt: 'Personal Trainer Certifications',
  advanced: 'Advanced / Specialist Certifications',
  specialty: 'Specialty Certifications',
  nutrition: 'Nutrition Certifications',
  safety: 'Safety (CPR/AED)',
  other: 'Other',
};

const KIND_ORDER: CatalogCert['kind'][] = ['cpt', 'advanced', 'specialty', 'nutrition', 'safety', 'other'];

export function useCertificationCatalog() {
  const [catalog, setCatalog] = useState<CatalogCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await (supabase as any)
        .from('certification_catalog')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (fetchError) throw fetchError;
      setCatalog((data ?? []) as CatalogCert[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load certifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const groups: CatalogGroup[] = KIND_ORDER
    .map(kind => ({
      kind,
      label: KIND_LABELS[kind],
      certs: catalog.filter(c => c.kind === kind),
    }))
    .filter(group => group.certs.length > 0);

  return { catalog, groups, loading, error, refetch: fetchCatalog };
}
