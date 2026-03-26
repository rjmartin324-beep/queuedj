#!/usr/bin/env tsx
// ─── Wardrobe Seed Script ─────────────────────────────────────────────────────
// Inserts 6 placeholder wardrobe items (2 per slot) into Supabase.
// Run:  cd apps/avatar-portal && npm run seed
//
// Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const ITEMS = [
  // HEAD
  {
    slot: "head",
    name: "Party Crown",
    file_path: "placeholder/head_crown.glb",
    thumbnail_url: null,
    blueprint_url: null,
  },
  {
    slot: "head",
    name: "DJ Headphones",
    file_path: "placeholder/head_headphones.glb",
    thumbnail_url: null,
    blueprint_url: null,
  },

  // BODY
  {
    slot: "body",
    name: "Neon Jacket",
    file_path: "placeholder/body_neon_jacket.glb",
    thumbnail_url: null,
    blueprint_url: null,
  },
  {
    slot: "body",
    name: "Club Vest",
    file_path: "placeholder/body_club_vest.glb",
    thumbnail_url: null,
    blueprint_url: null,
  },

  // BOTTOM
  {
    slot: "bottom",
    name: "Cargo Shorts",
    file_path: "placeholder/bottom_cargo.glb",
    thumbnail_url: null,
    blueprint_url: null,
  },
  {
    slot: "bottom",
    name: "Joggers",
    file_path: "placeholder/bottom_joggers.glb",
    thumbnail_url: null,
    blueprint_url: null,
  },
];

async function seed() {
  console.log("🌱 Seeding wardrobe_items...");

  const { data, error } = await supabase
    .from("wardrobe_items")
    .upsert(ITEMS, { onConflict: "name" })
    .select();

  if (error) {
    console.error("❌ Seed failed:", error.message);
    process.exit(1);
  }

  console.log(`✅ Inserted ${data?.length ?? 0} items:`);
  data?.forEach((item: any) => console.log(`   [${item.slot.toUpperCase()}] ${item.name} — ${item.id}`));
  process.exit(0);
}

seed();
