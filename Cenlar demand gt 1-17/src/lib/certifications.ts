// Elite certification registry for FitRush admin approval
// Only NCCA-accredited or industry-equivalent certifications accepted

// ─── Typed registry (new schema) ────────────────────────────────────────────

export interface CertificationDefinition {
  code: string;
  name: string;
  issuer: string;
  tier: 'gold' | 'silver' | 'specialty';
  category: 'general' | 'strength' | 'yoga' | 'nutrition' | 'rehabilitation' | 'group';
  ncca_accredited: boolean;
  verification_url?: string;
}

export const ACCEPTED_CERTIFICATIONS: CertificationDefinition[] = [
  // ── Gold Tier — NCCA-accredited primary certifications ──────────────────
  {
    code: 'NASM-CPT',
    name: 'NASM Certified Personal Trainer',
    issuer: 'National Academy of Sports Medicine',
    tier: 'gold',
    category: 'general',
    ncca_accredited: true,
    verification_url: 'https://www.nasm.org/verify-credential',
  },
  {
    code: 'ACE-CPT',
    name: 'ACE Certified Personal Trainer',
    issuer: 'American Council on Exercise',
    tier: 'gold',
    category: 'general',
    ncca_accredited: true,
    verification_url: 'https://www.acefitness.org/verify',
  },
  {
    code: 'NSCA-CPT',
    name: 'NSCA Certified Personal Trainer',
    issuer: 'National Strength & Conditioning Association',
    tier: 'gold',
    category: 'general',
    ncca_accredited: true,
    verification_url: 'https://www.nsca.com/certification/verify-certification/',
  },
  {
    code: 'NSCA-CSCS',
    name: 'NSCA Certified Strength & Conditioning Specialist',
    issuer: 'National Strength & Conditioning Association',
    tier: 'gold',
    category: 'strength',
    ncca_accredited: true,
    verification_url: 'https://www.nsca.com/certification/verify-certification/',
  },
  {
    code: 'ACSM-CPT',
    name: 'ACSM Certified Personal Trainer',
    issuer: 'American College of Sports Medicine',
    tier: 'gold',
    category: 'general',
    ncca_accredited: true,
    verification_url: 'https://www.acsm.org/get-stay-certified/verify-certification',
  },
  {
    code: 'ACSM-EP',
    name: 'ACSM Certified Exercise Physiologist',
    issuer: 'American College of Sports Medicine',
    tier: 'gold',
    category: 'rehabilitation',
    ncca_accredited: true,
    verification_url: 'https://www.acsm.org/get-stay-certified/verify-certification',
  },
  {
    code: 'ISSA-CPT',
    name: 'ISSA Certified Personal Trainer (NCCA/NCCPT)',
    issuer: 'International Sports Sciences Association',
    tier: 'gold',
    category: 'general',
    ncca_accredited: true,
    verification_url: 'https://www.issaonline.com/verify',
  },
  {
    code: 'NCCPT-CPT',
    name: 'NCCPT Certified Personal Trainer',
    issuer: 'National Council for Certified Personal Trainers',
    tier: 'gold',
    category: 'general',
    ncca_accredited: true,
    verification_url: 'https://www.nccpt.com/verify',
  },
  {
    code: 'NETA-CPT',
    name: 'NETA Certified Personal Trainer',
    issuer: 'National Exercise Trainers Association',
    tier: 'gold',
    category: 'general',
    ncca_accredited: true,
    verification_url: 'https://www.neta-fit.com/verify',
  },
  {
    code: 'NCSF-CPT',
    name: 'NCSF Certified Personal Trainer',
    issuer: 'National Council on Strength & Fitness',
    tier: 'gold',
    category: 'general',
    ncca_accredited: true,
    verification_url: 'https://www.ncsf.org/certification/verify',
  },
  // ── Gold Tier — NCCA-accredited specialty/advanced ──────────────────────
  {
    code: 'NASM-CES',
    name: 'NASM Corrective Exercise Specialist',
    issuer: 'National Academy of Sports Medicine',
    tier: 'gold',
    category: 'rehabilitation',
    ncca_accredited: true,
    verification_url: 'https://www.nasm.org/verify-credential',
  },
  {
    code: 'NASM-PES',
    name: 'NASM Performance Enhancement Specialist',
    issuer: 'National Academy of Sports Medicine',
    tier: 'gold',
    category: 'strength',
    ncca_accredited: true,
    verification_url: 'https://www.nasm.org/verify-credential',
  },
  {
    code: 'ACE-MES',
    name: 'ACE Medical Exercise Specialist',
    issuer: 'American Council on Exercise',
    tier: 'gold',
    category: 'rehabilitation',
    ncca_accredited: true,
    verification_url: 'https://www.acefitness.org/verify',
  },

  // ── Silver Tier — Recognized, accepted with admin review ────────────────
  {
    code: 'ISSA-CPT-DEAC',
    name: 'ISSA Certified Personal Trainer (DEAC)',
    issuer: 'International Sports Sciences Association',
    tier: 'silver',
    category: 'general',
    ncca_accredited: false,
    verification_url: 'https://www.issaonline.com/verify',
  },
  {
    code: 'NESTA-PFT',
    name: 'NESTA Personal Fitness Trainer',
    issuer: 'National Exercise & Sports Trainers Association',
    tier: 'silver',
    category: 'general',
    ncca_accredited: false,
    verification_url: 'https://www.nestacertified.com/verify',
  },
  {
    code: 'AFAA-CPT',
    name: 'AFAA Certified Personal Trainer',
    issuer: 'Athletics & Fitness Association of America',
    tier: 'silver',
    category: 'general',
    ncca_accredited: false,
    verification_url: 'https://www.afaa.com/verify',
  },
  {
    code: 'IPTA-CPT',
    name: 'IPTA Certified Personal Trainer',
    issuer: 'International Personal Trainer Academy',
    tier: 'silver',
    category: 'general',
    ncca_accredited: false,
  },

  // ── Specialty Tier — Yoga (Yoga Alliance credentials) ───────────────────
  {
    code: 'RYT-200',
    name: 'Registered Yoga Teacher (200-Hour)',
    issuer: 'Yoga Alliance',
    tier: 'specialty',
    category: 'yoga',
    ncca_accredited: false,
    verification_url: 'https://www.yogaalliance.org/find_a_yoga_teacher',
  },
  {
    code: 'RYT-500',
    name: 'Registered Yoga Teacher (500-Hour)',
    issuer: 'Yoga Alliance',
    tier: 'specialty',
    category: 'yoga',
    ncca_accredited: false,
    verification_url: 'https://www.yogaalliance.org/find_a_yoga_teacher',
  },
  {
    code: 'E-RYT-200',
    name: 'Experienced Registered Yoga Teacher (200-Hour)',
    issuer: 'Yoga Alliance',
    tier: 'specialty',
    category: 'yoga',
    ncca_accredited: false,
    verification_url: 'https://www.yogaalliance.org/find_a_yoga_teacher',
  },
  {
    code: 'E-RYT-500',
    name: 'Experienced Registered Yoga Teacher (500-Hour)',
    issuer: 'Yoga Alliance',
    tier: 'specialty',
    category: 'yoga',
    ncca_accredited: false,
    verification_url: 'https://www.yogaalliance.org/find_a_yoga_teacher',
  },

  // ── Specialty Tier — Nutrition ───────────────────────────────────────────
  {
    code: 'NASM-CNC',
    name: 'NASM Certified Nutrition Coach',
    issuer: 'National Academy of Sports Medicine',
    tier: 'specialty',
    category: 'nutrition',
    ncca_accredited: false,
    verification_url: 'https://www.nasm.org/verify-credential',
  },
  {
    code: 'ACE-FNS',
    name: 'ACE Fitness Nutrition Specialist',
    issuer: 'American Council on Exercise',
    tier: 'specialty',
    category: 'nutrition',
    ncca_accredited: false,
    verification_url: 'https://www.acefitness.org/verify',
  },
  {
    code: 'PN-L1',
    name: 'Precision Nutrition Level 1 Coach',
    issuer: 'Precision Nutrition',
    tier: 'specialty',
    category: 'nutrition',
    ncca_accredited: false,
    verification_url: 'https://www.precisionnutrition.com/verify',
  },
  {
    code: 'PN-L2',
    name: 'Precision Nutrition Level 2 Master Coach',
    issuer: 'Precision Nutrition',
    tier: 'specialty',
    category: 'nutrition',
    ncca_accredited: false,
    verification_url: 'https://www.precisionnutrition.com/verify',
  },
  {
    code: 'ISSA-SN',
    name: 'ISSA Sports Nutrition Specialist',
    issuer: 'International Sports Sciences Association',
    tier: 'specialty',
    category: 'nutrition',
    ncca_accredited: false,
    verification_url: 'https://www.issaonline.com/verify',
  },

  // ── Specialty Tier — Group Fitness ───────────────────────────────────────
  {
    code: 'ACE-GFI',
    name: 'ACE Group Fitness Instructor',
    issuer: 'American Council on Exercise',
    tier: 'specialty',
    category: 'group',
    ncca_accredited: false,
    verification_url: 'https://www.acefitness.org/verify',
  },
  {
    code: 'AFAA-GFI',
    name: 'AFAA Group Fitness Instructor',
    issuer: 'Athletics & Fitness Association of America',
    tier: 'specialty',
    category: 'group',
    ncca_accredited: false,
    verification_url: 'https://www.afaa.com/verify',
  },

  // ── Specialty Tier — Strength / Performance ──────────────────────────────
  {
    code: 'CF-L1',
    name: 'CrossFit Level 1 Trainer',
    issuer: 'CrossFit',
    tier: 'specialty',
    category: 'strength',
    ncca_accredited: false,
    verification_url: 'https://www.crossfit.com/trainer-finder',
  },
  {
    code: 'CF-L2',
    name: 'CrossFit Level 2 Trainer',
    issuer: 'CrossFit',
    tier: 'specialty',
    category: 'strength',
    ncca_accredited: false,
    verification_url: 'https://www.crossfit.com/trainer-finder',
  },
  {
    code: 'NASM-WLS',
    name: 'NASM Weight Loss Specialist',
    issuer: 'National Academy of Sports Medicine',
    tier: 'specialty',
    category: 'general',
    ncca_accredited: false,
    verification_url: 'https://www.nasm.org/verify-credential',
  },
  {
    code: 'NASM-SFS',
    name: 'NASM Senior Fitness Specialist',
    issuer: 'National Academy of Sports Medicine',
    tier: 'specialty',
    category: 'general',
    ncca_accredited: false,
    verification_url: 'https://www.nasm.org/verify-credential',
  },
  {
    code: 'ACE-HC',
    name: 'ACE Health Coach',
    issuer: 'American Council on Exercise',
    tier: 'specialty',
    category: 'general',
    ncca_accredited: false,
    verification_url: 'https://www.acefitness.org/verify',
  },
  {
    code: 'CPR-AED',
    name: 'CPR/AED Certification',
    issuer: 'American Red Cross / American Heart Association',
    tier: 'specialty',
    category: 'general',
    ncca_accredited: false,
  },
];

export const CERTIFICATION_TIER_DESCRIPTIONS = {
  gold: 'NCCA-accredited primary certification — required for all trainers',
  silver: 'Recognized industry certification — accepted with review',
  specialty: 'Specialty add-on — enhances trainer profile but not standalone',
} as const;

// Helper to check if a certification code is accepted
export function isAcceptedCertification(code: string): boolean {
  return ACCEPTED_CERTIFICATIONS.some(c => c.code === code);
}

// Get certifications by category
export function getCertificationsByCategory(category: string): CertificationDefinition[] {
  return ACCEPTED_CERTIFICATIONS.filter(c => c.category === category);
}

// Get certifications by tier
export function getCertificationsByTier(tier: CertificationDefinition['tier']): CertificationDefinition[] {
  return ACCEPTED_CERTIFICATIONS.filter(c => c.tier === tier);
}

// Look up a single certification definition by code
export function getCertificationByCode(code: string): CertificationDefinition | undefined {
  return ACCEPTED_CERTIFICATIONS.find(c => c.code === code);
}

// ─── Legacy grouped structure (used by CertificationUpload and AdminDashboard) ─

export const CERTIFICATION_TIERS = {
  tier1_gold: {
    label: 'Gold Standard (NCCA Accredited)',
    description: 'Highest industry recognition — accepted at all major gym chains',
    certs: ACCEPTED_CERTIFICATIONS
      .filter(c => c.tier === 'gold')
      .map(c => ({ code: c.code, name: c.name, org: c.issuer })),
  },
  tier2_silver: {
    label: 'Recognized (DEAC/NBFE Accredited)',
    description: 'Accepted at most gyms — valid for FitRush with admin review',
    certs: ACCEPTED_CERTIFICATIONS
      .filter(c => c.tier === 'silver')
      .map(c => ({ code: c.code, name: c.name, org: c.issuer })),
  },
  tier3_specialty: {
    label: 'Specialty Certifications',
    description: 'Additional credentials that enhance a trainer profile',
    certs: ACCEPTED_CERTIFICATIONS
      .filter(c => c.tier === 'specialty')
      .map(c => ({ code: c.code, name: c.name, org: c.issuer })),
  },
};

// Flat list of all cert codes for dropdowns
export const ALL_CERTIFICATIONS = ACCEPTED_CERTIFICATIONS.map(c => ({
  code: c.code,
  name: c.name,
  org: c.issuer,
}));

// A trainer needs at least one Tier 1 (gold) OR Tier 2 (silver) cert to be verified
export const VERIFIABLE_CODES = new Set(
  ACCEPTED_CERTIFICATIONS
    .filter(c => c.tier === 'gold' || c.tier === 'silver')
    .map(c => c.code),
);

export type CertStatus = 'pending' | 'approved' | 'rejected';

export interface TrainerCertification {
  id: string;
  trainer_id: string;
  cert_code: string;
  cert_name: string;
  file_url: string;
  expiry_date: string | null;
  status: CertStatus;
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}
