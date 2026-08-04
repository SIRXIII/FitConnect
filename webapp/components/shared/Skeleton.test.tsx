import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SkeletonLine, SkeletonCircle, SkeletonRect } from './Skeleton';

describe('SkeletonLine', () => {
  it('renders div with animate-pulse class and default w-full', () => {
    const { container } = render(<SkeletonLine />);
    const el = container.firstElementChild!;
    expect(el.tagName).toBe('DIV');
    expect(el.className).toContain('animate-pulse');
    expect(el.className).toContain('w-full');
  });

  it('accepts custom width class', () => {
    const { container } = render(<SkeletonLine width="w-36" />);
    const el = container.firstElementChild!;
    expect(el.className).toContain('w-36');
    expect(el.className).not.toContain('w-full');
  });
});

describe('SkeletonCircle', () => {
  it('renders div with rounded-full and animate-pulse', () => {
    const { container } = render(<SkeletonCircle />);
    const el = container.firstElementChild!;
    expect(el.className).toContain('rounded-full');
    expect(el.className).toContain('animate-pulse');
  });
});

describe('SkeletonRect', () => {
  it('renders div with animate-pulse and accepts className', () => {
    const { container } = render(<SkeletonRect className="h-24 w-48" />);
    const el = container.firstElementChild!;
    expect(el.className).toContain('animate-pulse');
    expect(el.className).toContain('h-24');
    expect(el.className).toContain('w-48');
  });
});
