import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock supabase to avoid real DB calls
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [] }),
            }),
          }),
        }),
      }),
    }),
  },
}));

import FeaturedTrainers from './FeaturedTrainers';

describe('FeaturedTrainers', () => {
  it('renders nothing while loading (trainers is null)', async () => {
    // Component initializes trainers as null — renders nothing until data resolves
    const { container } = render(
      <MemoryRouter><FeaturedTrainers /></MemoryRouter>
    );
    // On initial render (null state), component returns null
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no Elite trainers exist (SRCH-03)', async () => {
    // Supabase mock returns [] — after effect resolves, trainers = [] — renders null
    const { container } = render(
      <MemoryRouter><FeaturedTrainers /></MemoryRouter>
    );
    // Give async effect time to resolve
    await new Promise(r => setTimeout(r, 50));
    expect(container.firstChild).toBeNull();
  });
});
