import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import IntensitySlider from './IntensitySlider';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('IntensitySlider', () => {
  it('renders 3 intensity stops', () => {
    render(<IntensitySlider value={null} onChange={vi.fn()} />);
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Moderate')).toBeTruthy();
    expect(screen.getByText('Intense')).toBeTruthy();
  });

  it('calls onChange when a stop is clicked', () => {
    const onChange = vi.fn();
    render(<IntensitySlider value={null} onChange={onChange} />);
    fireEvent.click(screen.getByText('Moderate'));
    expect(onChange).toHaveBeenCalledWith('moderate');
  });

  it('highlights selected stop', () => {
    render(<IntensitySlider value="light" onChange={vi.fn()} />);
    // Light stop should have active styling (green color class)
    const lightBtn = screen.getByText('Light').closest('button');
    expect(lightBtn?.className).toMatch(/green/);
  });
});
