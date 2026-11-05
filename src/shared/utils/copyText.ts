export async function copyText(value: string): Promise<boolean> {
  const clipboardResult = copyWithClipboard(value);
  if (copyWithTextarea(value)) {
    return true;
  }

  return clipboardResult;
}

async function copyWithClipboard(value: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.clipboard?.writeText !== 'function') {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function copyWithTextarea(value: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '0';
  area.style.opacity = '0';
  document.body.append(area);
  area.focus();
  area.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    area.remove();
  }

  return copied;
}
