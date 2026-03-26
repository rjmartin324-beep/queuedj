"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAvatarStore } from "@/lib/store";
import { AuthModal } from "./AuthModal";

export function TopBar() {
  const { user, setUser, wardrobeOpen, toggleWardrobe } = useAvatarStore();
  const [showAuth, setShowAuth]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setMenuOpen(false);
  }

  return (
    <>
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 pointer-events-none">
        {/* Logo */}
        <div className="pointer-events-auto">
          <span className="text-white font-black text-lg tracking-tight">
            Party<span className="text-[#6c47ff]">Glue</span>
            <span className="text-[#666] font-normal text-sm ml-1">Avatar</span>
          </span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Wardrobe toggle */}
          <button
            onClick={toggleWardrobe}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all
              ${wardrobeOpen
                ? "border-[#6c47ff] bg-[#6c47ff22] text-[#6c47ff]"
                : "border-[#222] bg-[#111]/80 text-white hover:border-[#333]"
              }
            `}
          >
            <span>👕</span>
            <span className="hidden sm:inline">Wardrobe</span>
          </button>

          {/* Auth */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-9 h-9 rounded-full bg-[#6c47ff] flex items-center justify-center text-white font-bold text-sm"
              >
                {user.email?.[0]?.toUpperCase() ?? "?"}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-11 bg-[#111] border border-[#222] rounded-xl shadow-2xl p-2 min-w-[160px] z-50">
                  <p className="text-[#666] text-xs px-3 py-1 truncate">{user.email}</p>
                  <hr className="border-[#222] my-1" />
                  <button
                    onClick={signOut}
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[#1a1a1a] rounded-lg"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="px-3 py-2 rounded-xl border border-[#222] bg-[#111]/80 text-white text-sm font-semibold hover:border-[#333] transition-all"
            >
              Sign in
            </button>
          )}
        </div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
