import dynamic from "next/dynamic";
import { TopBar } from "@/components/TopBar";
import { EmoteBar } from "@/components/EmoteBar";
import { WardrobePanel } from "@/components/WardrobePanel";
import { AuthProvider } from "@/components/AuthProvider";

// AvatarCanvas uses Three.js / WebGL — must be client-only, no SSR
const AvatarCanvas = dynamic(
  () => import("@/components/AvatarCanvas").then((m) => m.AvatarCanvas),
  { ssr: false, loading: () => <AvatarLoadingScreen /> },
);

function AvatarLoadingScreen() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[#6c47ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#555] text-sm">Loading avatar…</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root page — full-screen avatar with overlaid controls
//
// Layout:
//   - AvatarCanvas:  fills entire screen (background)
//   - TopBar:        absolute top — logo + wardrobe toggle + auth
//   - WardrobePanel: absolute right — collapsible drawer
//   - EmoteBar:      absolute bottom — emote buttons
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <AuthProvider>
      <main className="relative w-screen h-screen overflow-hidden bg-[#0a0a0a]">

        {/* 3D Avatar — fills the screen */}
        <div className="absolute inset-0">
          <AvatarCanvas />
        </div>

        {/* Gradient vignette for readability */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)",
          }}
        />

        {/* UI overlays */}
        <TopBar />
        <WardrobePanel />

        {/* Emote bar — bottom center */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-safe">
          <div className="bg-[#0d0d0d]/80 backdrop-blur-sm border border-[#1a1a1a] rounded-2xl m-4">
            <EmoteBar />
          </div>
        </div>
      </main>
    </AuthProvider>
  );
}
