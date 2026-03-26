"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAvatarStore } from "@/lib/store";
import type { WardrobeItem, WardrobeSlot } from "@/types";

const TABS: { slot: WardrobeSlot; label: string; emoji: string }[] = [
  { slot: "head",   label: "Head",   emoji: "🎩" },
  { slot: "body",   label: "Body",   emoji: "👕" },
  { slot: "bottom", label: "Bottom", emoji: "👖" },
];

// ─────────────────────────────────────────────────────────────────────────────
// WardrobePanel — collapsible right drawer
// Fetches wardrobe_items from Supabase, shows tab grid, saves outfit.
// ─────────────────────────────────────────────────────────────────────────────

export function WardrobePanel() {
  const { wardrobeOpen, activeTab, setActiveTab, equippedItems, equipItem, unequipSlot, user } =
    useAvatarStore();
  const [items, setItems]     = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const supabase = createClient();

  // Fetch all wardrobe items on mount
  useEffect(() => {
    async function fetchItems() {
      setLoading(true);
      const { data } = await supabase
        .from("wardrobe_items")
        .select("*")
        .order("created_at", { ascending: true });
      setItems((data as WardrobeItem[]) ?? []);
      setLoading(false);
    }
    fetchItems();
  }, []);

  // Load saved outfit when user logs in
  useEffect(() => {
    if (!user) return;
    async function loadOutfit() {
      const { data } = await supabase
        .from("user_avatars")
        .select("*, head:wardrobe_items!head_item_id(*), body:wardrobe_items!body_item_id(*), bottom:wardrobe_items!bottom_item_id(*)")
        .eq("user_id", user!.id)
        .single();

      if (!data) return;
      if (data.head)   equipItem(data.head   as WardrobeItem);
      if (data.body)   equipItem(data.body   as WardrobeItem);
      if (data.bottom) equipItem(data.bottom as WardrobeItem);
    }
    loadOutfit();
  }, [user]);

  // Save current outfit to Supabase
  async function saveOutfit() {
    if (!user) return;
    setSaving(true);
    await supabase.from("user_avatars").upsert({
      user_id:        user.id,
      head_item_id:   equippedItems.head?.id   ?? null,
      body_item_id:   equippedItems.body?.id   ?? null,
      bottom_item_id: equippedItems.bottom?.id ?? null,
      updated_at:     new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  }

  function downloadBlueprint(item: WardrobeItem) {
    if (!item.blueprint_url) {
      alert("No blueprint available for this item yet.");
      return;
    }
    const a = document.createElement("a");
    a.href = item.blueprint_url;
    a.download = `blueprint_${item.name.replace(/\s+/g, "_")}.png`;
    a.target = "_blank";
    a.click();
  }

  const tabItems = items.filter((i) => i.slot === activeTab);
  const activeEquipped = equippedItems[activeTab];

  if (!wardrobeOpen) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 z-10 w-72 sm:w-80 flex flex-col bg-[#0d0d0d]/95 backdrop-blur-md border-l border-[#1a1a1a] shadow-2xl">
      {/* Header */}
      <div className="px-4 pt-14 pb-3 border-b border-[#1a1a1a]">
        <h2 className="text-white font-bold text-base">Wardrobe</h2>
        <p className="text-[#555] text-xs mt-0.5">Tap to equip, long-press for blueprint</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1a1a1a]">
        {TABS.map(({ slot, label, emoji }) => (
          <button
            key={slot}
            onClick={() => setActiveTab(slot)}
            className={`
              flex-1 py-2.5 text-center text-xs font-semibold transition-colors
              ${activeTab === slot
                ? "text-[#6c47ff] border-b-2 border-[#6c47ff]"
                : "text-[#555] hover:text-[#888]"
              }
            `}
          >
            <span className="text-base block">{emoji}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Item grid */}
      <div className="flex-1 overflow-y-auto panel-scroll p-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-[#6c47ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tabItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#333] text-sm">No items yet</p>
            <p className="text-[#222] text-xs mt-1">Run the seed script to add samples</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {tabItems.map((item) => {
              const equipped = activeEquipped?.id === item.id;
              return (
                <div
                  key={item.id}
                  className={`
                    relative rounded-xl overflow-hidden border cursor-pointer
                    transition-all duration-150
                    ${equipped
                      ? "border-[#6c47ff] bg-[#6c47ff12] ring-1 ring-[#6c47ff44]"
                      : "border-[#1a1a1a] bg-[#111] hover:border-[#333]"
                    }
                  `}
                  onClick={() => equipped ? unequipSlot(item.slot) : equipItem(item)}
                >
                  {/* Thumbnail */}
                  <div className="aspect-square bg-[#0a0a0a] relative">
                    {item.thumbnail_url ? (
                      <Image
                        src={item.thumbnail_url}
                        alt={item.name}
                        fill
                        className="object-contain p-2"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-3xl">
                        {activeTab === "head" ? "🎩" : activeTab === "body" ? "👕" : "👖"}
                      </div>
                    )}
                    {equipped && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#6c47ff] flex items-center justify-center">
                        <span className="text-white text-[10px]">✓</span>
                      </div>
                    )}
                  </div>

                  {/* Label + Blueprint */}
                  <div className="px-2 py-1.5 flex items-center justify-between">
                    <span className="text-white text-xs font-medium truncate pr-1">{item.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadBlueprint(item); }}
                      className="text-[#555] hover:text-[#888] text-[10px] shrink-0"
                      title="Download UV blueprint"
                    >
                      📐
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save outfit */}
      {user && (
        <div className="px-3 pb-4 pt-2 border-t border-[#1a1a1a]">
          <button
            onClick={saveOutfit}
            disabled={saving}
            className={`
              w-full py-2.5 rounded-xl font-semibold text-sm transition-all
              ${savedMsg
                ? "bg-[#22c55e22] border border-[#22c55e55] text-[#22c55e]"
                : "bg-[#6c47ff] text-white hover:bg-[#7c57ff] disabled:opacity-50"
              }
            `}
          >
            {savedMsg ? "✓ Outfit saved" : saving ? "Saving…" : "Save outfit"}
          </button>
        </div>
      )}

      {/* Not signed in hint */}
      {!user && (
        <p className="text-center text-[#333] text-xs pb-4 px-4">
          Sign in to save your outfit
        </p>
      )}
    </div>
  );
}
