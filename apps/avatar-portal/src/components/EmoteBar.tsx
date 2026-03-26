"use client";

import { useAvatarStore } from "@/lib/store";
import type { EmoteType } from "@/types";

const EMOTES: { emote: EmoteType; label: string; emoji: string }[] = [
  { emote: "Wave",     label: "Wave",     emoji: "👋" },
  { emote: "Dance",    label: "Dance",    emoji: "💃" },
  { emote: "Jump",     label: "Jump",     emoji: "⬆️" },
  { emote: "ThumbsUp", label: "Hype",     emoji: "👍" },
];

export function EmoteBar() {
  const { currentEmote, setEmote } = useAvatarStore();

  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3">
      {EMOTES.map(({ emote, label, emoji }) => {
        const active = currentEmote === emote;
        return (
          <button
            key={emote}
            onClick={() => setEmote(emote)}
            className={`
              flex flex-col items-center gap-1 px-4 py-2 rounded-2xl
              border transition-all duration-150 select-none
              ${active
                ? "border-[#6c47ff] bg-[#6c47ff22] scale-105"
                : "border-[#222] bg-[#111] hover:border-[#6c47ff55] hover:bg-[#1a1a1a]"
              }
            `}
          >
            <span className="text-2xl leading-none">{emoji}</span>
            <span className={`text-[11px] font-semibold ${active ? "text-[#6c47ff]" : "text-[#666]"}`}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
