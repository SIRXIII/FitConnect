-- Migration: 20260613140000_certification_catalog.sql
-- Creates the certification_catalog reference table, enables RLS, and seeds 22 rows.

CREATE TABLE IF NOT EXISTS public.certification_catalog (
  cert_code     text PRIMARY KEY,
  display_name  text NOT NULL,
  org           text NOT NULL,
  accreditation text NOT NULL CHECK (accreditation IN ('NCCA','DEAC','none','safety')),
  tier          text NOT NULL CHECK (tier IN ('gold','strong','acceptable','safety','other')),
  kind          text NOT NULL CHECK (kind IN ('cpt','advanced','specialty','nutrition','safety','other')),
  verify_url    text,
  verify_fields text,                 -- e.g. 'Last name + cert #'
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    int NOT NULL DEFAULT 100
);

ALTER TABLE public.certification_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog readable by authenticated" ON public.certification_catalog;
CREATE POLICY "catalog readable by authenticated" ON public.certification_catalog
  FOR SELECT TO authenticated USING (is_active);

INSERT INTO public.certification_catalog (cert_code,display_name,org,accreditation,tier,kind,verify_url,verify_fields,sort_order) VALUES
 ('ACE-CPT','ACE Certified Personal Trainer','American Council on Exercise','NCCA','gold','cpt','https://www.acefitness.org/why-ace/verify/','Last name + cert #',10),
 ('ACSM-CPT','ACSM Certified Personal Trainer','American College of Sports Medicine','NCCA','gold','cpt','https://www.usreps.org/Pages/verify.aspx','Last name + state',11),
 ('NSCA-CPT','NSCA Certified Personal Trainer','National Strength & Conditioning Assn','NCCA','gold','cpt','https://www.usreps.org/Pages/verify.aspx','Last name',12),
 ('NASM-CPT','NASM Certified Personal Trainer','National Academy of Sports Medicine','NCCA','gold','cpt','https://www.nasm.org/resources/validate-credentials','Name and/or NASM ID',13),
 ('CSCS','Certified Strength & Conditioning Specialist','NSCA','NCCA','gold','advanced','https://www.usreps.org/Pages/verify.aspx','Last name',14),
 ('ACSM-EP','ACSM Certified Exercise Physiologist','American College of Sports Medicine','NCCA','gold','advanced','https://www.usreps.org/Pages/verify.aspx','Last name',15),
 ('ACSM-CEP','ACSM Certified Clinical Exercise Physiologist','American College of Sports Medicine','NCCA','gold','advanced','https://www.usreps.org/Pages/verify.aspx','Last name',16),
 ('ISSA-CPT','ISSA Certified Personal Trainer','International Sports Sciences Assn','DEAC','strong','cpt','https://www.issaonline.com/verify','Last name + certificate #',20),
 ('NCCPT-CPT','NCCPT Certified Personal Trainer','NCCPT','NCCA','strong','cpt','https://www.usreps.org/Pages/verify.aspx','Last name',21),
 ('NCSF-CPT','NCSF Certified Personal Trainer','National Council on Strength & Fitness','NCCA','strong','cpt','https://www.ncsf.org/certification-exam/credential-verification.aspx','Last name + credential code',22),
 ('NESTA-PFT','NESTA Personal Fitness Trainer','National Exercise & Sports Trainers Assn','NCCA','strong','cpt','https://www.nestacertified.com','Name + cert ID',23),
 ('NETA-PT','NETA Personal Trainer','National Exercise Trainers Assn','NCCA','strong','cpt','https://www.netafit.org','Name + cert ID',24),
 ('WITS-CPT','W.I.T.S. Certified Personal Trainer','World Instructor Training Schools','NCCA','strong','cpt','https://www.witseducation.com','Name + cert ID',25),
 ('NASM-CES','NASM Corrective Exercise Specialist','NASM','none','strong','specialty','https://www.nasm.org/resources/validate-credentials','Name/NASM ID (needs base CPT)',26),
 ('NASM-PES','NASM Performance Enhancement Specialist','NASM','none','strong','specialty','https://www.nasm.org/resources/validate-credentials','Name/NASM ID (needs base CPT)',27),
 ('PN1','Precision Nutrition Level 1','Precision Nutrition','none','strong','nutrition','https://www.precisionnutrition.com','Verify with PN',28),
 ('ISSA-NUTR','ISSA Certified Nutritionist','International Sports Sciences Assn','DEAC','strong','nutrition','https://www.issaonline.com/verify','Last name + cert #',29),
 ('ACTION-CPT','ACTION Certified Personal Trainer','ACTION Certification','NCCA','acceptable','cpt','https://www.actioncertification.org','Name + cert ID',40),
 ('NASM-CNC','NASM Certified Nutrition Coach','NASM','none','acceptable','nutrition','https://www.nasm.org/resources/validate-credentials','Name/NASM ID',41),
 ('CPR-AHA','AHA Heartsaver CPR/AED/First Aid','American Heart Association','safety','safety','safety','https://ecards.heart.org/student/myecards','eCard code + name',50),
 ('CPR-ARC','Red Cross Adult First Aid/CPR/AED','American Red Cross','safety','safety','safety','https://www.redcross.org/take-a-class/digital-certificate','Digital cert ID',51),
 ('OTHER','Other (describe)','Self-reported','none','other','other',NULL,'Manual review',999)
ON CONFLICT (cert_code) DO NOTHING;

NOTIFY pgrst, 'reload schema';
