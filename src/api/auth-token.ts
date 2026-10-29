// The bearer fallback is a UI hint only; /auth/me remains authoritative.
export const authToken = {
  read(): string | null {
    try { return localStorage.getItem('auth_token') || null } catch { return null }
  },
  write(token: string): void {
    try { localStorage.setItem('auth_token', token) } catch { /* Cookie auth still works. */ }
  },
  clear(): void {
    try { localStorage.removeItem('auth_token') } catch { /* Storage may be unavailable. */ }
  },
}
