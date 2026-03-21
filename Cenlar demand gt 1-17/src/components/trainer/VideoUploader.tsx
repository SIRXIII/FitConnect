import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { validateVideoDuration, captureVideoThumbnail } from '@/utils/videoUtils';

interface VideoUploaderProps {
  userId: string;
  existingVideoUrl?: string;
  existingThumbnailUrl?: string;
  onUploadComplete: (videoUrl: string, thumbnailUrl: string) => void;
}

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

const VideoUploader: React.FC<VideoUploaderProps> = ({
  userId,
  existingVideoUrl,
  existingThumbnailUrl,
  onUploadComplete,
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [localThumb, setLocalThumb] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setError(null);

    // Size check
    if (file.size > MAX_SIZE_BYTES) {
      setError('Video must be 50MB or smaller.');
      return;
    }

    // Duration check
    const durationError = await validateVideoDuration(file, 30);
    if (durationError) {
      setError(durationError);
      return;
    }

    // Capture thumbnail for local preview
    let thumbBlob: Blob;
    try {
      thumbBlob = await captureVideoThumbnail(file);
      const thumbUrl = URL.createObjectURL(thumbBlob);
      setLocalThumb(thumbUrl);
    } catch {
      setError('Could not extract thumbnail from video.');
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      // Upload thumbnail
      const { error: thumbError } = await supabase.storage
        .from('trainer-videos')
        .upload(`${userId}/thumb.jpg`, thumbBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (thumbError) throw thumbError;
      setProgress(30);

      // Upload video
      const { error: videoError } = await supabase.storage
        .from('trainer-videos')
        .upload(`${userId}/intro.mp4`, file, { upsert: true });

      if (videoError) throw videoError;
      setProgress(80);

      // Get public URLs
      const { data: videoData } = supabase.storage
        .from('trainer-videos')
        .getPublicUrl(`${userId}/intro.mp4`);

      const { data: thumbData } = supabase.storage
        .from('trainer-videos')
        .getPublicUrl(`${userId}/thumb.jpg`);

      const videoUrl = videoData.publicUrl;
      const thumbUrl = thumbData.publicUrl;

      // Save to trainer_profiles
      const { error: updateError } = await supabase
        .from('trainer_profiles')
        .update({
          intro_video_url: videoUrl,
          intro_video_thumbnail_url: thumbUrl,
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      setProgress(100);
      toast.success('Intro video uploaded.');
      onUploadComplete(videoUrl, thumbUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleRemove = async () => {
    try {
      await supabase.storage
        .from('trainer-videos')
        .remove([`${userId}/intro.mp4`, `${userId}/thumb.jpg`]);

      await supabase
        .from('trainer_profiles')
        .update({ intro_video_url: null, intro_video_thumbnail_url: null })
        .eq('user_id', userId);

      setLocalThumb(null);
      toast.success('Intro video removed.');
      onUploadComplete('', '');
    } catch {
      toast.error('Could not remove video. Please try again.');
    }
  };

  const displayThumb = localThumb || existingThumbnailUrl;
  const hasVideo = !!(existingVideoUrl || localThumb);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-[0.2em] text-ink/40 font-medium">Intro Video</h3>
        {hasVideo && !uploading && (
          <button
            onClick={handleRemove}
            className="text-[10px] uppercase tracking-[0.15em] text-red-500/70 hover:text-red-600 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {hasVideo ? (
        <div className="space-y-3">
          {displayThumb && (
            <div className="relative aspect-video max-w-sm overflow-hidden rounded-lg bg-ink/5">
              <img
                src={displayThumb}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-ink/60 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
                  </svg>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="border border-[#C5A059]/40 px-5 py-2 text-[10px] uppercase tracking-[0.2em] text-[#C5A059] hover:bg-[#C5A059]/10 transition-all duration-300 disabled:opacity-50"
          >
            Replace Video
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full border border-dashed border-[#C5A059]/50 hover:border-[#C5A059] p-8 flex flex-col items-center gap-3 transition-all duration-300 group disabled:opacity-50"
        >
          <svg className="w-8 h-8 text-[#C5A059]/50 group-hover:text-[#C5A059] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/50 group-hover:text-ink transition-colors">Upload Intro Video</p>
            <p className="text-[10px] text-ink/30 mt-1">MP4, WebM, or MOV — max 30 sec, 50MB</p>
          </div>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = '';
        }}
      />

      {uploading && (
        <div className="space-y-2">
          <div className="w-full bg-ink/5 rounded-full h-1">
            <div
              className="bg-[#C5A059] h-1 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40">Uploading...</p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 font-light">{error}</p>
      )}
    </div>
  );
};

export default VideoUploader;
