export const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'

export class ApiError extends Error {
  public readonly status: number;
  public readonly details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    });

    if (!response.ok) {
      let payload: { message?: string | string[]; error?: string } | null = null;
      try {
        payload = await response.json();
      } catch (e) {
        // Fallback if not JSON
      }
      
      const message = Array.isArray(payload?.message)
        ? payload.message[0]
        : payload?.message ?? payload?.error ?? 'The request failed.';
        
      throw new ApiError(response.status, message, payload);
    }
    
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, error instanceof Error ? error.message : 'Network error occurred');
  }
}
