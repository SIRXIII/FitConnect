import { describe, it, expect } from 'vitest';
import { resolveIntroVideo } from './introVideo';

describe('resolveIntroVideo', () => {
  it('classifies an Instagram reel URL as embed', () => {
    expect(
      resolveIntroVideo('https://www.instagram.com/reel/DcyuVoyhEiD/?igsi=NTc4MTIwNjQ2YQ==')
    ).toEqual({ kind: 'embed', src: 'https://www.instagram.com/reel/DcyuVoyhEiD/embed' });
  });

  it('classifies a Supabase trainer-videos storage URL as file', () => {
    expect(
      resolveIntroVideo(
        'https://qecwxvvlpvrnrqyrdxrj.supabase.co/storage/v1/object/public/trainer-videos/abc/intro.mp4'
      ).kind
    ).toBe('file');
  });

  it('classifies a direct .webm URL as file', () => {
    expect(resolveIntroVideo('https://cdn.example.com/foo.webm').kind).toBe('file');
  });

  it('classifies a youtu.be short link as embed', () => {
    expect(resolveIntroVideo('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      kind: 'embed',
      src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    });
  });

  it('classifies a youtube.com watch URL as embed', () => {
    const result = resolveIntroVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result.kind).toBe('embed');
    expect(result.src).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('classifies a vimeo.com URL as embed', () => {
    expect(resolveIntroVideo('https://vimeo.com/123456789')).toEqual({
      kind: 'embed',
      src: 'https://player.vimeo.com/video/123456789',
    });
  });

  it('classifies an unknown page URL as link', () => {
    expect(resolveIntroVideo('https://example.com/some-page').kind).toBe('link');
  });

  it('classifies empty and null as link', () => {
    expect(resolveIntroVideo('').kind).toBe('link');
    expect(resolveIntroVideo(null).kind).toBe('link');
  });

  it('never emits a non-http(s) src (XSS guard)', () => {
    // javascript: URL must not reach an <a href>
    expect(resolveIntroVideo('javascript:alert(1)')).toEqual({ kind: 'link', src: '' });
    // javascript: that ends in .mp4 must not slip into the file (<video src>) branch
    expect(resolveIntroVideo('javascript:alert(1)//x.mp4')).toEqual({ kind: 'link', src: '' });
    // data: URL blocked too
    expect(resolveIntroVideo('data:text/html,<script>alert(1)</script>')).toEqual({
      kind: 'link',
      src: '',
    });
  });
});
