import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const mockIsNativeiOS = vi.fn(() => false);
vi.mock('@/lib/platform', () => ({
  isNativeiOS: () => mockIsNativeiOS(),
}));

import AppStoreBadge from './AppStoreBadge';

const APP_STORE_URL =
  'https://apps.apple.com/us/app/fitrush-personal-trainer/id6766015234';

describe('AppStoreBadge', () => {
  beforeEach(() => {
    cleanup();
    mockIsNativeiOS.mockReturnValue(false);
  });

  it('links directly to the FitRush App Store listing in a new tab', () => {
    render(<AppStoreBadge />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe(APP_STORE_URL);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('serves the vendored official badge with reserved dimensions', () => {
    render(<AppStoreBadge />);
    const img = screen.getByAltText('Download FitRush on the App Store');
    expect(img.getAttribute('src')).toBe('/assets/download-on-the-app-store.svg');
    // width/height reserve space so the badge cannot cause layout shift
    expect(img.getAttribute('width')).toBe('144');
    expect(img.getAttribute('height')).toBe('48');
  });

  it('exposes exactly one accessible name (alt only, no competing aria-label)', () => {
    render(<AppStoreBadge />);
    expect(screen.getByRole('link').hasAttribute('aria-label')).toBe(false);
    expect(screen.getAllByAltText('Download FitRush on the App Store')).toHaveLength(1);
  });

  it('renders nothing inside the native iOS shell', () => {
    mockIsNativeiOS.mockReturnValue(true);
    const { container } = render(<AppStoreBadge />);
    expect(container.innerHTML).toBe('');
  });

  it('merges a caller-supplied className onto the link', () => {
    render(<AppStoreBadge className="pt-4" />);
    expect(screen.getByRole('link').className).toContain('pt-4');
  });
});
