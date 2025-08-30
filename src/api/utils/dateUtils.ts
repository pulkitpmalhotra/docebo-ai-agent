export function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

export function parseDate(dateString: string) {
  return new Date(dateString);
}
