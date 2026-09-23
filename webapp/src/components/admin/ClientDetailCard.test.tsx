import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ClientDetailCard, { type AdminClientDetail } from './ClientDetailCard';

const baseClient: AdminClientDetail = {
  user_id: 'client-1',
  full_name: 'Example Client',
  avatar_url: null,
  phone: null,
  is_suspended: false,
  created_at: '2026-01-01T00:00:00Z',
  email: 'client@example.test',
  last_sign_in_at: null,
  total_bookings: 2,
  completed_count: 1,
  cancelled_count: 0,
  no_show_count: 0,
  total_spend: 120,
  location: 'Chicago IL',
  onboarding_complete: true,
  bio: 'Building a consistent strength routine.',
  fitness_level: 'beginner',
  training_frequency: '3-4',
  fitness_goals: ['muscle_gain', 'general_fitness'],
  workout_types: ['strength_training', 'yoga'],
  recent_bookings: [],
  reviews: [],
};

describe('ClientDetailCard profile details', () => {
  it('shows the client location and onboarding status prominently', () => {
    render(<ClientDetailCard client={baseClient} />);

    expect(screen.getByTestId('client-location').textContent).toContain('Chicago IL');
    expect(screen.getByTestId('client-onboarding-status').textContent).toContain('Onboarding complete');
  });

  it('renders useful non-medical profile and training preferences', () => {
    render(<ClientDetailCard client={baseClient} />);

    expect(screen.getByText('Building a consistent strength routine.')).toBeTruthy();
    expect(screen.getByText('Beginner')).toBeTruthy();
    expect(screen.getByText('3-4x/week')).toBeTruthy();
    expect(screen.getByText('Build Muscle')).toBeTruthy();
    expect(screen.getByText('Strength Training')).toBeTruthy();
  });

  it('does not expose medical notes from an extended payload', () => {
    const payload = {
      ...baseClient,
      health_notes: 'Private medical detail',
    } as AdminClientDetail;

    render(<ClientDetailCard client={payload} />);

    expect(screen.queryByText('Private medical detail')).toBeNull();
    expect(screen.queryByText('Health Notes')).toBeNull();
  });

  it('uses clear fallbacks when optional profile fields are unavailable', () => {
    render(
      <ClientDetailCard
        client={{
          ...baseClient,
          location: null,
          onboarding_complete: false,
          bio: null,
          fitness_level: null,
          training_frequency: null,
          fitness_goals: [],
          workout_types: [],
        }}
      />,
    );

    expect(screen.getByTestId('client-location').textContent).toContain('Service area not provided');
    expect(screen.getByTestId('client-onboarding-status').textContent).toContain('Onboarding incomplete');
    expect(screen.getAllByText('Not provided').length).toBeGreaterThanOrEqual(4);
  });
});
