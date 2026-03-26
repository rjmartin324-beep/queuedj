# QueueDJ Avatar Portal

3D avatar customization web app — Next.js 14 + Three.js/R3F + Supabase + Vercel.

---

## Wake-up checklist (5 minutes to live)

### 1. Create Supabase project
- Go to [supabase.com](https://supabase.com) → New project (free tier)
- In the SQL Editor, run this schema:

```sql
create table wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  slot text not null check (slot in ('head','body','bottom')),
  name text not null unique,
  file_path text not null,
  thumbnail_url text,
  blueprint_url text,
  created_at timestamptz default now()
);

create table user_avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  head_item_id uuid references wardrobe_items(id),
  body_item_id uuid references wardrobe_items(id),
  bottom_item_id uuid references wardrobe_items(id),
  updated_at timestamptz default now()
);

-- RLS policies
alter table wardrobe_items enable row level security;
create policy "Public read" on wardrobe_items for select using (true);

alter table user_avatars enable row level security;
create policy "Users read own" on user_avatars for select using (auth.uid() = user_id);
create policy "Users upsert own" on user_avatars for insert with check (auth.uid() = user_id);
create policy "Users update own" on user_avatars for update using (auth.uid() = user_id);
```

### 2. Create storage bucket
- Supabase Dashboard → Storage → New bucket
- Name: `wardrobe`
- Make it **public**

### 3. Add environment variables
```bash
cp .env.local.example .env.local
```
Fill in your Supabase URL and anon key (Settings → API).

### 4. Install and run
```bash
cd apps/avatar-portal
npm install
npm run dev
```
Open http://localhost:3002

### 5. Seed sample items
```bash
npm run seed
```

### 6. Deploy to Vercel
```bash
# Push to GitHub, then:
# vercel.com → Import project → add NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
# Vercel auto-deploys on every push
```

---

## Architecture

```
src/
  app/               Next.js App Router
    page.tsx         Full-screen avatar page
    auth/callback/   Magic link OAuth handler
  components/
    AvatarCanvas     Three.js/R3F 3D avatar + wardrobe attachment
    WardrobePanel    Collapsible right drawer — tabs, grid, save outfit
    EmoteBar         Bottom row of emote buttons
    TopBar           Logo, wardrobe toggle, auth
    AuthModal        Magic link sign-in modal
    AuthProvider     Supabase → Zustand auth sync
  lib/
    supabase/        Browser + server Supabase clients
    store.ts         Zustand store (emote, outfit, auth, UI)
  types/             Shared TypeScript interfaces
scripts/
  seed.ts            Insert 6 placeholder wardrobe items
```

## Adding a real avatar model

1. Export your character as `.glb` from Blender (Mixamo-rigged)
2. Replace `AVATAR_URL` in `AvatarCanvas.tsx` with your GLB URL
3. Update `SLOT_BONE` map with your model's exact bone names
4. Upload clothing items as GLBs to Supabase Storage `wardrobe/` bucket
5. Insert rows into `wardrobe_items` with `file_path` pointing to the storage URL

## Adding real wardrobe items

1. Model the clothing item in Blender (fitted to your avatar's skeleton)
2. Export as `.glb`
3. Upload to Supabase Storage: `wardrobe/items/{slug}.glb`
4. Generate UV blueprint PNG (1024×1024) → `wardrobe/blueprints/{item_id}.png`
5. Insert row:
```sql
insert into wardrobe_items (slot, name, file_path, thumbnail_url, blueprint_url)
values ('head', 'Party Crown', 'https://...supabase.co/storage/.../crown.glb', '...thumb.png', '...blueprint.png');
```

## Phase 3 Integration with QueueDJ

When a guest joins a QueueDJ room, their avatar outfit from this portal loads in the room's guest list view. Wardrobe unlocks (limited edition items) are rewarded when guests attend parties, spend vibe credits, or win trivia.
