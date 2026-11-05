export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) {
    return `${remainder}m`;
  }
  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
}

export function releaseYear(createdAt: string): string {
  const year = new Date(createdAt).getUTCFullYear();
  if (!Number.isFinite(year)) {
    return '';
  }

  return String(year);
}
