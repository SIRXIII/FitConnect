export const CERTIFICATION_TIERS = {
  tier1_gold: {
    label: 'Gold Standard (NCCA Accredited)',
    description: 'Highest industry recognition — accepted at all major gym chains',
    certs: [
      { code: 'NASM-CPT', name: 'NASM Certified Personal Trainer', org: 'National Academy of Sports Medicine' },
      { code: 'ACE-CPT', name: 'ACE Certified Personal Trainer', org: 'American Council on Exercise' },
      { code: 'NSCA-CPT', name: 'NSCA Certified Personal Trainer', org: 'National Strength & Conditioning Association' },
      { code: 'NSCA-CSCS', name: 'NSCA Certified Strength & Conditioning Specialist', org: 'National Strength & Conditioning Association' },
      { code: 'ACSM-CPT', name: 'ACSM Certified Personal Trainer', org: 'American College of Sports Medicine' },
      { code: 'ACSM-EP', name: 'ACSM Certified Exercise Physiologist', org: 'American College of Sports Medicine' },
      { code: 'NCSF-CPT', name: 'NCSF Certified Personal Trainer', org: 'National Council on Strength & Fitness' },
      { code: 'ISSA-CPT', name: 'ISSA Certified Personal Trainer (NCCA)', org: 'International Sports Sciences Association' },
      { code: 'NCCPT-CPT', name: 'NCCPT Certified Personal Trainer', org: 'National Council for Certified Personal Trainers' },
      { code: 'NETA-CPT', name: 'NETA Certified Personal Trainer', org: 'National Exercise Trainers Association' },
      { code: 'NASM-CES', name: 'NASM Corrective Exercise Specialist', org: 'National Academy of Sports Medicine' },
      { code: 'NASM-PES', name: 'NASM Performance Enhancement Specialist', org: 'National Academy of Sports Medicine' },
    ],
  },
  tier2_silver: {
    label: 'Recognized (DEAC/NBFE Accredited)',
    description: 'Accepted at most gyms — valid for FitRush with admin review',
    certs: [
      { code: 'ISSA-CPT-DEAC', name: 'ISSA Certified Personal Trainer (DEAC)', org: 'International Sports Sciences Association' },
      { code: 'NESTA-PFT', name: 'NESTA Personal Fitness Trainer', org: 'National Exercise & Sports Trainers Association' },
      { code: 'IPTA-CPT', name: 'IPTA Certified Personal Trainer', org: 'International Personal Trainer Academy' },
      { code: 'AFAA-CPT', name: 'AFAA Certified Personal Trainer', org: 'Athletics & Fitness Association of America' },
    ],
  },
  tier3_specialty: {
    label: 'Specialty Certifications',
    description: 'Additional credentials that enhance a trainer profile',
    certs: [
      { code: 'ACE-GFI', name: 'ACE Group Fitness Instructor', org: 'American Council on Exercise' },
      { code: 'ACE-HC', name: 'ACE Health Coach', org: 'American Council on Exercise' },
      { code: 'NASM-WLS', name: 'NASM Weight Loss Specialist', org: 'National Academy of Sports Medicine' },
      { code: 'NASM-SFS', name: 'NASM Senior Fitness Specialist', org: 'National Academy of Sports Medicine' },
      { code: 'ISSA-SN', name: 'ISSA Sports Nutrition Specialist', org: 'International Sports Sciences Association' },
      { code: 'RYT-200', name: 'Registered Yoga Teacher (200hr)', org: 'Yoga Alliance' },
      { code: 'RYT-500', name: 'Registered Yoga Teacher (500hr)', org: 'Yoga Alliance' },
      { code: 'CF-L1', name: 'CrossFit Level 1', org: 'CrossFit' },
      { code: 'CF-L2', name: 'CrossFit Level 2', org: 'CrossFit' },
      { code: 'CPR-AED', name: 'CPR/AED Certification', org: 'American Red Cross / AHA' },
    ],
  },
};

// Flat list of all cert codes for dropdowns
export const ALL_CERTIFICATIONS = [
  ...CERTIFICATION_TIERS.tier1_gold.certs,
  ...CERTIFICATION_TIERS.tier2_silver.certs,
  ...CERTIFICATION_TIERS.tier3_specialty.certs,
];

// A trainer needs at least one Tier 1 OR Tier 2 cert to be verified
export const VERIFIABLE_CODES = new Set([
  ...CERTIFICATION_TIERS.tier1_gold.certs.map(c => c.code),
  ...CERTIFICATION_TIERS.tier2_silver.certs.map(c => c.code),
]);

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
