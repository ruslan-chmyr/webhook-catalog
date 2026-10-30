import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from './useDebounce';

afterEach(() => {
  vi.useRealTimers();
});

function StringProbe({ value, delay }: { value: string; delay: number }) {
  const debounced = useDebounce(value, delay);
  return <p>{debounced}</p>;
}

function NumberProbe({ value, delay }: { value: number; delay: number }) {
  const debounced = useDebounce(value, delay);
  return <p>{debounced}</p>;
}

describe('useDebounce', () => {
  it('publishes the value after the delay', () => {
    vi.useFakeTimers();
    const view = render(<StringProbe value="a" delay={350} />);

    view.rerender(<StringProbe value="ab" delay={350} />);
    act(() => {
      vi.advanceTimersByTime(349);
    });
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.queryByText('ab')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('ab')).toBeInTheDocument();
  });

  it('cancels the previous timer when the value changes', () => {
    vi.useFakeTimers();
    const view = render(<StringProbe value="a" delay={350} />);

    view.rerender(<StringProbe value="ab" delay={350} />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    view.rerender(<StringProbe value="abc" delay={350} />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.queryByText('ab')).not.toBeInTheDocument();
    expect(screen.queryByText('abc')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByText('abc')).toBeInTheDocument();
  });

  it('cancels the timer on unmount', () => {
    vi.useFakeTimers();
    const view = render(<StringProbe value="a" delay={350} />);
    view.rerender(<StringProbe value="ab" delay={350} />);
    view.unmount();

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(350);
      });
    }).not.toThrow();
  });

  it('debounces non-string values', () => {
    vi.useFakeTimers();
    const view = render(<NumberProbe value={1} delay={100} />);

    view.rerender(<NumberProbe value={2} delay={100} />);
    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(screen.getByText('1')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
