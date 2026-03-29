// ─────────────────────────────────────────────────────────────────────────────
// authApi — thin fetch wrappers for the 5 auth endpoints
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export interface AccountDTO {
  id:          string;
  provider:    "apple" | "google";
  email:       string | null;
  displayName: string | null;
  createdAt:   string;
}

export interface AuthResponse {
  jwt:          string;
  guestId:      string;
  isNewAccount: boolean;
  account:      AccountDTO;
}

async function post<T>(path: string, body: unknown, jwt?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Auth error");
  return data as T;
}

async function get<T>(path: string, jwt: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Auth error");
  return data as T;
}

async function del(path: string, jwt: string): Promise<void> {
  await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${jwt}` },
  });
}

export const authApi = {
  signInApple: (identityToken: string, deviceGuestId: string, displayName?: string) =>
    post<AuthResponse>("/auth/apple", { identityToken, deviceGuestId, displayName }),

  signInGoogle: (idToken: string, deviceGuestId: string) =>
    post<AuthResponse>("/auth/google", { idToken, deviceGuestId }),

  me: (jwt: string) =>
    get<{ account: AccountDTO; guestId: string }>("/auth/me", jwt),

  link: (anonGuestId: string, jwt: string) =>
    post<{ merged: boolean }>("/auth/link", { anonGuestId }, jwt),

  signOut: (jwt: string) =>
    del("/auth/signout", jwt),
};
