import { describe, it, expect } from 'vitest';
import { optimizedUrl } from './imageUtils';

describe('optimizedUrl', () => {
  it('adds w= and q=80 and auto=format to Unsplash URLs', () => {
    const url = 'https://images.unsplash.com/photo-123';
    const result = optimizedUrl(url);
    expect(result).toContain('w=800');
    expect(result).toContain('q=80');
    expect(result).toContain('auto=format');
  });

  it('preserves non-Unsplash URLs unchanged', () => {
    const url = 'https://example.com/image.jpg';
    expect(optimizedUrl(url)).toBe(url);
  });

  it('handles Unsplash URLs that already have query params (uses & not ?)', () => {
    const url = 'https://images.unsplash.com/photo-123?ixlib=rb-4.0.3';
    const result = optimizedUrl(url);
    expect(result).toContain('?ixlib=rb-4.0.3&w=');
    expect(result).not.toContain('??');
  });

  it('uses custom width when provided', () => {
    const url = 'https://images.unsplash.com/photo-123';
    const result = optimizedUrl(url, 400);
    expect(result).toContain('w=400');
  });

  it('defaults to w=800', () => {
    const url = 'https://images.unsplash.com/photo-123';
    const result = optimizedUrl(url);
    expect(result).toContain('w=800');
  });
});
