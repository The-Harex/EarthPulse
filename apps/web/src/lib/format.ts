export function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const coordinate = (value: number, positive: string, negative: string) =>
  `${Math.abs(value).toFixed(3)}° ${value >= 0 ? positive : negative}`;

export const dateTime = (iso: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(iso));

export function timeRange(start: string, end?: string) {
  const now = Date.now();
  if (Date.parse(start) > now) return `Starts ${relativeTime(start).replace('ago', 'from now')}`;
  if (!end) return 'Active now';
  if (Date.parse(end) < now) return 'Expired';
  const minutes = Math.max(1, Math.round((Date.parse(end) - now) / 60_000));
  return minutes < 60 ? `Expires in ${minutes} min` : `Expires in ${Math.round(minutes / 60)} hr`;
}
