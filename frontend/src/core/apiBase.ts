export function getApiBaseUrl(): string {
  const envBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    // Default to the current host on backend port 8000 so LAN access works
    // without forcing users to edit environment variables.
    return `http://${window.location.hostname}:8000`;
  }

  return 'http://127.0.0.1:8000';
}
