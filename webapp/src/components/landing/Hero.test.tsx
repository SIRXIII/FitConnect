import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Hero from './Hero';

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
}));

describe('Hero', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the headline and value proposition', () => {
    render(<Hero />);
    expect(screen.getByText(/Book Elite Trainers/)).toBeTruthy();
    expect(screen.getByText(/Certified trainers with open availability/)).toBeTruthy();
  });

  it('offers the App Store badge as the primary call to action', () => {
    render(<Hero />);
    const link = screen.getByRole('link', { name: 'Download FitRush on the App Store' });
    expect(link.getAttribute('href')).toBe(
      'https://apps.apple.com/us/app/fitrush-personal-trainer/id6766015234'
    );
  });

  it('scrolls to the search section when Browse Trainers is clicked', () => {
    const scrollIntoView = vi.fn();
    vi.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView,
    } as unknown as HTMLElement);

    render(<Hero />);
    fireEvent.click(screen.getByText('Browse Trainers'));

    expect(document.getElementById).toHaveBeenCalledWith('search');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('no longer renders the retired early-access waitlist', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<Hero />);

    expect(screen.queryByPlaceholderText('Enter your email')).toBeNull();
    expect(screen.queryByText('Get Early Access')).toBeNull();
    expect(screen.queryByText("I'm looking for a trainer")).toBeNull();
    expect(document.querySelector('form')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
