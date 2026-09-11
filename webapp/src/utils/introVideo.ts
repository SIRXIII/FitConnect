export type IntroVideo = { kind: 'file' | 'embed' | 'link'; src: string };

const FILE_EXT = /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i;

/**
 * Classify a trainer intro_video_url so playback can render the right element.
 * `file`  → a direct media file (our uploaded intro.mp4, or any URL ending in a
 *           video extension) → play with <video>.
 * `embed` → a known social/watch page (YouTube / Vimeo / Instagram) → play in an
 *           <iframe> using the provider embed URL (returned in `src`).
 * `link`  → anything else → offer a "Watch intro" link to the raw URL.
 */
export function resolveIntroVideo(url: string | null | undefined): IntroVideo {
  const raw = (url ?? '').trim();
  if (!raw) return { kind: 'link', src: '' };

  // Must parse as an http(s) URL. `intro_video_url` is trainer-editable, so a
  // hostile value like `javascript:alert(1)` (or `javascript:x.mp4`, which the
  // FILE_EXT test would otherwise accept) must never reach an href/src. Gate
  // the scheme up front so no branch below can emit a non-http(s) `src`.
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { kind: 'link', src: '' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return { kind: 'link', src: '' };
  }

  if (FILE_EXT.test(raw) || raw.includes('/storage/v1/object/public/trainer-videos/')) {
    return { kind: 'file', src: raw };
  }

  const host = u.hostname.replace(/^www\./, '').toLowerCase();

  // YouTube
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    if (id) return { kind: 'embed', src: `https://www.youtube.com/embed/${id}` };
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const v = u.searchParams.get('v');
    if (v) return { kind: 'embed', src: `https://www.youtube.com/embed/${v}` };
    const shorts = u.pathname.match(/^\/shorts\/([^/]+)/);
    if (shorts) return { kind: 'embed', src: `https://www.youtube.com/embed/${shorts[1]}` };
    const embed = u.pathname.match(/^\/embed\/([^/]+)/);
    if (embed) return { kind: 'embed', src: `https://www.youtube.com/embed/${embed[1]}` };
  }

  // Vimeo
  if (host === 'player.vimeo.com') return { kind: 'embed', src: raw };
  if (host === 'vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) return { kind: 'embed', src: `https://player.vimeo.com/video/${id}` };
  }

  // Instagram (reel / p / tv)
  if (host === 'instagram.com') {
    const m = u.pathname.match(/^\/(reel|p|tv)\/([^/]+)/);
    if (m) return { kind: 'embed', src: `https://www.instagram.com/${m[1]}/${m[2]}/embed` };
  }

  return { kind: 'link', src: raw };
}
