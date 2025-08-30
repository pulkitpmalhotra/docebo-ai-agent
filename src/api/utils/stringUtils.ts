export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, maxLength: number) {
  return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
}
