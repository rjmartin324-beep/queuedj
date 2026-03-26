export type WardrobeSlot = "head" | "body" | "bottom";

export type EmoteType = "Idle" | "Wave" | "Dance" | "Jump" | "ThumbsUp";

export interface WardrobeItem {
  id: string;
  slot: WardrobeSlot;
  name: string;
  file_path: string;
  thumbnail_url: string | null;
  blueprint_url: string | null;
  created_at: string;
}

export interface UserAvatar {
  id: string;
  user_id: string;
  head_item_id: string | null;
  body_item_id: string | null;
  bottom_item_id: string | null;
  updated_at: string;
}

export interface EquippedItems {
  head:   WardrobeItem | null;
  body:   WardrobeItem | null;
  bottom: WardrobeItem | null;
}
