// Set VITE_API_URL (e.g. http://localhost:8787) to talk to a backend API.
// Leave empty for fully local mode.
export const API_URL: string = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');
