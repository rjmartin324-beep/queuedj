"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  onClose: () => void;
}

export function AuthModal({ onClose }: Props) {
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const supabase = createClient();

  async function sendMagicLink() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-[#222] rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-1">Sign in</h2>
        <p className="text-[#666] text-sm mb-6">
          Save your avatar outfit across devices
        </p>

        {sent ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">📬</div>
            <p className="text-white font-semibold mb-1">Check your inbox</p>
            <p className="text-[#666] text-sm">
              We sent a magic link to <strong className="text-white">{email}</strong>
            </p>
          </div>
        ) : (
          <>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
              className="w-full bg-[#0a0a0a] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-[#555] text-sm mb-3 focus:outline-none focus:border-[#6c47ff]"
            />
            {error && (
              <p className="text-red-400 text-xs mb-3">{error}</p>
            )}
            <button
              onClick={sendMagicLink}
              disabled={loading || !email.trim()}
              className="w-full bg-[#6c47ff] text-white font-semibold py-3 rounded-xl disabled:opacity-40 hover:bg-[#7c57ff] transition-colors"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full mt-3 text-[#555] text-sm hover:text-[#888] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
