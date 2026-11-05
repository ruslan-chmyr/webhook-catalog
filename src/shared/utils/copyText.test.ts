import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './copyText';

const originalClipboard = navigator.clipboard;

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: originalClipboard,
  });
  vi.restoreAllMocks();
});

describe('copyText', () => {
  it('copies with the clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await expect(copyText('https://www.imdb.com/find/?q=Citizen%20Kane')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://www.imdb.com/find/?q=Citizen%20Kane');
  });

  it('falls back to a textarea when the clipboard API fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    await expect(copyText('https://example.com/full-link')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});
