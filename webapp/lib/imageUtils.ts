export function optimizedUrl(url: string, width: number = 800): string {
  if (url.includes('unsplash.com')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}w=${width}&q=80&auto=format`;
  }
  return url;
}

export const IMAGE_ATTRS = {
  loading: 'lazy' as const,
  decoding: 'async' as const,
};
