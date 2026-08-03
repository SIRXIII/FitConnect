/**
 * Validates video duration. Returns error string or null if valid.
 * Requires a File object (not yet uploaded).
 */
export async function validateVideoDuration(file: File, maxSeconds = 30): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      if (video.duration > maxSeconds) {
        resolve(`Video must be ${maxSeconds} seconds or shorter (yours is ${Math.round(video.duration)}s)`);
      } else {
        resolve(null);
      }
    };
    video.onerror = () => resolve('Could not read video file');
    video.src = URL.createObjectURL(file);
  });
}

/**
 * Captures the first frame of a video file as a JPEG blob.
 * Returns a Blob suitable for upload.
 */
export async function captureVideoThumbnail(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.currentTime = 0.5; // half-second in for better frame
    video.onloadeddata = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = Math.round(640 * (video.videoHeight / video.videoWidth));
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context unavailable'));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(video.src);
        if (blob) resolve(blob);
        else reject(new Error('Thumbnail capture failed'));
      }, 'image/jpeg', 0.8);
    };
    video.onerror = () => reject(new Error('Video load error'));
    video.src = URL.createObjectURL(file);
  });
}
