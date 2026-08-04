import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ClientSummaryCard from './ClientSummaryCard';

describe('ClientSummaryCard', () => {
  it('returns null when data is null', () => {
    const { container } = render(<ClientSummaryCard data={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders fitness level badge', () => {
    render(<ClientSummaryCard data={{
      fitness_level: 'beginner',
      primary_goal: null,
      health_conditions: [],
      intensity_preference: null,
    }} />);
    expect(screen.getByText(/beginner/i)).toBeTruthy();
  });

  it('renders health condition badges', () => {
    render(<ClientSummaryCard data={{
      fitness_level: null,
      primary_goal: null,
      health_conditions: ['back_pain', 'asthma'],
      intensity_preference: null,
    }} />);
    // Should render health warning indicators
    const alerts = document.querySelectorAll('[data-testid="health-badge"]');
    expect(alerts.length).toBeGreaterThanOrEqual(2);
  });
});
