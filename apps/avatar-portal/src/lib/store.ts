import { create } from "zustand";
import type { EmoteType, WardrobeItem, EquippedItems, WardrobeSlot } from "@/types";
import type { User } from "@supabase/supabase-js";

// ─── Avatar Store ──────────────────────────────────────────────────────────────
// Single source of truth for everything in the avatar portal:
//   - current emote
//   - equipped wardrobe items (1 per slot)
//   - auth user

interface AvatarStore {
  // Auth
  user: User | null;
  setUser: (user: User | null) => void;

  // Emote
  currentEmote: EmoteType;
  setEmote: (emote: EmoteType) => void;

  // Wardrobe
  equippedItems: EquippedItems;
  equipItem:   (item: WardrobeItem) => void;
  unequipSlot: (slot: WardrobeSlot) => void;

  // UI
  wardrobeOpen:    boolean;
  toggleWardrobe:  () => void;
  activeTab:       WardrobeSlot;
  setActiveTab:    (tab: WardrobeSlot) => void;
}

export const useAvatarStore = create<AvatarStore>((set) => ({
  // Auth
  user: null,
  setUser: (user) => set({ user }),

  // Emote
  currentEmote: "Idle",
  setEmote: (emote) => set({ currentEmote: emote }),

  // Wardrobe
  equippedItems: { head: null, body: null, bottom: null },

  equipItem: (item) =>
    set((state) => ({
      equippedItems: { ...state.equippedItems, [item.slot]: item },
    })),

  unequipSlot: (slot) =>
    set((state) => ({
      equippedItems: { ...state.equippedItems, [slot]: null },
    })),

  // UI
  wardrobeOpen:   false,
  toggleWardrobe: () => set((s) => ({ wardrobeOpen: !s.wardrobeOpen })),
  activeTab:      "head",
  setActiveTab:   (tab) => set({ activeTab: tab }),
}));
