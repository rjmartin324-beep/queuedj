import React, { createContext, useContext, useEffect, useReducer, useCallback } from "react";
import { Platform } from "react-native";
import { storage } from "../lib/storage";
import { getIdentity, setCanonicalGuestId } from "../lib/identity";
import { authApi, type AccountDTO } from "../lib/authApi";

// ─────────────────────────────────────────────────────────────────────────────
// AuthContext — sign in with Apple / Google, cross-device guestId sync
// ─────────────────────────────────────────────────────────────────────────────

const JWT_KEY = "queuedj:auth:jwt";

// ─── State ────────────────────────────────────────────────────────────────────

interface AuthState {
  account:   AccountDTO | null;
  jwt:       string | null;
  guestId:   string;
  isLoading: boolean;
  error:     string | null;
}

type AuthAction =
  | { type: "LOADED"; guestId: string }
  | { type: "SIGNED_IN"; account: AccountDTO; jwt: string; guestId: string }
  | { type: "SIGNED_OUT" }
  | { type: "SET_ERROR"; error: string }
  | { type: "CLEAR_ERROR" };

function reducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "LOADED":
      return { ...state, guestId: action.guestId, isLoading: false };
    case "SIGNED_IN":
      return { ...state, account: action.account, jwt: action.jwt, guestId: action.guestId, error: null, isLoading: false };
    case "SIGNED_OUT":
      return { ...state, account: null, jwt: null, error: null };
    case "SET_ERROR":
      return { ...state, error: action.error, isLoading: false };
    case "CLEAR_ERROR":
      return { ...state, error: null };
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  signInWithApple:  () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut:          () => Promise<void>;
  clearError:       () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    account:   null,
    jwt:       null,
    guestId:   "",
    isLoading: true,
    error:     null,
  });

  // On mount: restore session from MMKV
  useEffect(() => {
    (async () => {
      const identity = await getIdentity();
      const jwt = storage.getString(JWT_KEY) ?? null;

      if (!jwt) {
        dispatch({ type: "LOADED", guestId: identity.guestId });
        return;
      }

      // Validate saved JWT against server
      try {
        const { account, guestId } = await authApi.me(jwt);
        // Ensure canonical guestId is set locally
        if (guestId !== identity.guestId) {
          setCanonicalGuestId(guestId);
        }
        dispatch({ type: "SIGNED_IN", account, jwt, guestId });
      } catch {
        // JWT expired or revoked — clear it, fall back to anonymous
        storage.delete(JWT_KEY);
        dispatch({ type: "LOADED", guestId: identity.guestId });
      }
    })();
  }, []);

  const handleSignInResponse = useCallback(async (
    jwt: string,
    account: AccountDTO,
    serverGuestId: string,
    wasAnonymousGuestId: string,
  ) => {
    // Persist JWT
    storage.set(JWT_KEY, jwt);

    // If server returned a different canonical guestId (returning user, new device)
    // update local storage so socket connects with the right ID
    if (serverGuestId !== wasAnonymousGuestId) {
      setCanonicalGuestId(serverGuestId);
    }

    dispatch({ type: "SIGNED_IN", account, jwt, guestId: serverGuestId });
  }, []);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS === "web") {
      dispatch({ type: "SET_ERROR", error: "Sign in with Apple is not available on web" });
      return;
    }
    try {
      // Lazy-import to avoid loading the native module on web/Android
      const AppleAuth = await import("expo-apple-authentication");
      const isAvailable = await AppleAuth.isAvailableAsync();
      if (!isAvailable) {
        dispatch({ type: "SET_ERROR", error: "Sign in with Apple is not available on this device" });
        return;
      }

      const credential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });

      const identityToken = credential.identityToken;
      if (!identityToken) throw new Error("No identity token from Apple");

      const displayName = credential.fullName
        ? `${credential.fullName.givenName ?? ""} ${credential.fullName.familyName ?? ""}`.trim() || undefined
        : undefined;

      const identity = await getIdentity();
      const response = await authApi.signInApple(identityToken, identity.guestId, displayName);
      await handleSignInResponse(response.jwt, response.account, response.guestId, identity.guestId);
    } catch (err: any) {
      if (err?.code === "ERR_REQUEST_CANCELED") return; // user cancelled
      dispatch({ type: "SET_ERROR", error: err?.message ?? "Sign in with Apple failed" });
    }
  }, [handleSignInResponse]);

  const signInWithGoogle = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        // Use Google Identity Services (GIS) on web — no redirect URI needed,
        // delivers id_token directly via popup callback.
        const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
        if (!clientId) {
          dispatch({ type: "SET_ERROR", error: "Google sign-in is not configured" });
          return;
        }

        await new Promise<void>((resolve, reject) => {
          const initAndPrompt = () => {
            const g = (window as any).google;
            g.accounts.id.initialize({
              client_id: clientId,
              callback: async (response: { credential: string }) => {
                try {
                  const identity = await getIdentity();
                  const apiResponse = await authApi.signInGoogle(response.credential, identity.guestId);
                  await handleSignInResponse(apiResponse.jwt, apiResponse.account, apiResponse.guestId, identity.guestId);
                  resolve();
                } catch (err) {
                  reject(err);
                }
              },
              auto_select: false,
              cancel_on_tap_outside: true,
            });
            g.accounts.id.prompt((notification: any) => {
              if (notification.isNotDisplayed()) {
                reject(new Error("Google sign-in could not be displayed. Try a different browser or clear cookies."));
              } else if (notification.isSkippedMoment()) {
                reject(new Error("cancel"));
              }
            });
          };

          if ((window as any).google?.accounts) {
            initAndPrompt();
          } else {
            const script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.onload = initAndPrompt;
            script.onerror = () => reject(new Error("Failed to load Google sign-in"));
            document.head.appendChild(script);
          }
        });
        return;
      }

      // ── Native (iOS / Android) ───────────────────────────────────────────────
      const { makeRedirectUri } = await import("expo-auth-session");
      const redirectUri = makeRedirectUri({ scheme: "com.partyglue.app" });

      const clientId = Platform.select({
        ios:     process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      });

      if (!clientId) {
        dispatch({ type: "SET_ERROR", error: "Google sign-in is not configured" });
        return;
      }

      const { AuthRequest } = await import("expo-auth-session");
      const request = new AuthRequest({
        clientId,
        redirectUri,
        responseType: "id_token token",
        scopes:       ["openid", "profile", "email"],
        extraParams:  { nonce: Math.random().toString(36).slice(2) },
        usePKCE:      false,
      });

      const discovery = {
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenEndpoint:         "https://oauth2.googleapis.com/token",
      };

      const result = await request.promptAsync(discovery);
      if (result.type !== "success") return;

      const idToken = result.params.id_token;
      if (!idToken) throw new Error("No id_token from Google");

      const identity = await getIdentity();
      const response = await authApi.signInGoogle(idToken, identity.guestId);
      await handleSignInResponse(response.jwt, response.account, response.guestId, identity.guestId);
    } catch (err: any) {
      if (err?.message?.includes("cancel")) return;
      dispatch({ type: "SET_ERROR", error: err?.message ?? "Sign in with Google failed" });
    }
  }, [handleSignInResponse]);

  const signOut = useCallback(async () => {
    if (state.jwt) {
      await authApi.signOut(state.jwt).catch(() => {});
    }
    storage.delete(JWT_KEY);
    dispatch({ type: "SIGNED_OUT" });
  }, [state.jwt]);

  const clearError = useCallback(() => dispatch({ type: "CLEAR_ERROR" }), []);

  return (
    <AuthContext.Provider value={{
      ...state,
      signInWithApple,
      signInWithGoogle,
      signOut,
      clearError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
