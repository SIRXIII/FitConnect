import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ErrorState } from './ErrorState';

const wrap = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ErrorState', () => {
  it('renders title and message text', () => {
    wrap(<ErrorState title="Test Error" message="Something bad happened" />);
    expect(screen.getByText('Test Error')).toBeDefined();
    expect(screen.getByText('Something bad happened')).toBeDefined();
  });

  it('renders retry button when onRetry provided, clicking it calls the handler', () => {
    const handler = vi.fn();
    wrap(<ErrorState message="fail" onRetry={handler} />);
    const btn = screen.getByText('Try Again');
    expect(btn).toBeDefined();
    fireEvent.click(btn);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('renders back link when backTo provided with correct path and label', () => {
    wrap(
      <ErrorState
        message="fail"
        backTo={{ label: 'Go Home', path: '/home' }}
      />,
    );
    const link = screen.getByText('Go Home');
    expect(link).toBeDefined();
    expect(link.closest('a')?.getAttribute('href')).toBe('/home');
  });

  it('does NOT render retry button when onRetry is omitted', () => {
    wrap(<ErrorState message="fail" />);
    expect(screen.queryByText('Try Again')).toBeNull();
  });

  it('uses default title "Something went wrong" when title not provided', () => {
    wrap(<ErrorState message="fail" />);
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });
});
