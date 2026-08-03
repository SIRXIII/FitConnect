-- file_url becomes nullable: private storage uses file_path; file_url kept for legacy only.
ALTER TABLE public.trainer_certifications ALTER COLUMN file_url DROP NOT NULL;
NOTIFY pgrst, 'reload schema';
