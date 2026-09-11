-- Raise trainer intro-video upload ceiling to 300MB (was 50MB).
UPDATE storage.buckets SET file_size_limit = 314572800 WHERE id = 'trainer-videos';
