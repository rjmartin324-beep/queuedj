"use client";

import { Suspense, useEffect, useRef, useState, Component, ReactNode } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) return <div style={{ color: "red", padding: 20 }}>GLB Error: {this.state.error}</div>;
    return this.props.children;
  }
}
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { useAvatarStore } from "@/lib/store";
import type { EmoteType, WardrobeItem } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Blue Fluffball avatar — Mixamo-rigged GLB
// Animations exported from Mixamo (clip name matches selected animation)
// ─────────────────────────────────────────────────────────────────────────────
const AVATAR_URL = "/blue_fluff.glb";

// Preload so switching tabs doesn't stall
useGLTF.preload(AVATAR_URL);

// ─── Bone name lookup per wardrobe slot ───────────────────────────────────────
// These are the bone names in the RobotExpressive placeholder.
// When you swap to a Mixamo character, update these to match your rig's bone names.
const SLOT_BONE: Record<"head" | "body" | "bottom", string[]> = {
  head:   ["mixamorigHead", "Head", "head", "Bip01_Head"],
  body:   ["mixamorigSpine2", "mixamorigSpine1", "Spine2", "spine_02"],
  bottom: ["mixamorigHips", "Hips", "hips", "pelvis"],
};

function findBone(skeleton: THREE.Skeleton, candidates: string[]): THREE.Bone | null {
  for (const name of candidates) {
    const bone = skeleton.getBoneByName(name);
    if (bone) return bone;
  }
  return null;
}

// ─── Wardrobe Item Mesh ───────────────────────────────────────────────────────
// Loads a GLB and attaches it to the correct bone of the avatar skeleton.
// Uses a dummy cube as placeholder when file_path is a placeholder path.
function WardrobeItemMesh({
  item,
  skeleton,
}: {
  item: WardrobeItem;
  skeleton: THREE.Skeleton | null;
}) {
  const isPlaceholder = item.file_path.startsWith("placeholder/");
  const bone = skeleton ? findBone(skeleton, SLOT_BONE[item.slot]) : null;

  // Placeholder: colored box on the target bone
  if (isPlaceholder || !item.file_path.startsWith("http")) {
    if (!bone) return null;
    const color = item.slot === "head" ? "#6c47ff" : item.slot === "body" ? "#06b6d4" : "#f59e0b";
    const offset: [number, number, number] =
      item.slot === "head"   ? [0, 0.18, 0]  :
      item.slot === "body"   ? [0, 0, 0]     :
      /* bottom */             [0, -0.1, 0];

    return (
      <group>
        <primitive object={bone}>
          <mesh position={offset}>
            <boxGeometry args={[0.25, 0.12, 0.25]} />
            <meshStandardMaterial color={color} transparent opacity={0.8} />
          </mesh>
        </primitive>
      </group>
    );
  }

  // Real GLB: loaded and bone-attached
  return <RealItemMesh url={item.file_path} slot={item.slot} bone={bone} />;
}

function RealItemMesh({
  url, slot, bone,
}: {
  url: string;
  slot: "head" | "body" | "bottom";
  bone: THREE.Bone | null;
}) {
  const { scene } = useGLTF(url);
  const cloned = scene.clone(true);

  if (!bone) return null;

  return (
    <primitive object={bone}>
      <primitive object={cloned} />
    </primitive>
  );
}

// ─── Avatar Model ─────────────────────────────────────────────────────────────
function AvatarModel() {
  const { scene, animations } = useGLTF(AVATAR_URL);
  const groupRef  = useRef<THREE.Group>(null!);
  const { actions, mixer } = useAnimations(animations, groupRef);
  const { currentEmote, equippedItems } = useAvatarStore();
  const prevEmoteRef = useRef<EmoteType>("Idle");
  const [skeleton, setSkeleton] = useState<THREE.Skeleton | null>(null);


  // Extract skeleton from the loaded model (first SkinnedMesh found)
  useEffect(() => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh && obj.skeleton) {
        setSkeleton(obj.skeleton);
      }
    });
  }, [scene]);

  // Start idle on mount
  useEffect(() => {
    const idle = actions["Breathing Idle"] ?? actions["mixamo.com"] ?? actions[Object.keys(actions)[0]];
    if (idle) idle.reset().play();
  }, [actions]);

  // Crossfade to new emote
  useEffect(() => {
    if (!mixer || !actions) return;
    const prev = actions[prevEmoteRef.current];
    const next = actions[currentEmote];
    if (!next) return;

    if (prev && prev !== next) {
      next.reset().fadeIn(0.35).play();
      prev.fadeOut(0.35);
    } else {
      next.reset().play();
    }
    prevEmoteRef.current = currentEmote;

    // One-shot emotes: return to Idle when done
    const oneShot: EmoteType[] = ["Wave", "Jump", "ThumbsUp"];
    if (oneShot.includes(currentEmote)) {
      const duration = next.getClip().duration * 1000;
      const t = setTimeout(() => {
        useAvatarStore.getState().setEmote("Idle");
      }, duration - 350);
      return () => clearTimeout(t);
    }
  }, [currentEmote, actions, mixer]);

  useFrame(() => {});

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={1} position={[0, -0.5, 0]} />

      {/* Equipped wardrobe items — bone-attached */}
      {equippedItems.head   && <WardrobeItemMesh item={equippedItems.head}   skeleton={skeleton} />}
      {equippedItems.body   && <WardrobeItemMesh item={equippedItems.body}   skeleton={skeleton} />}
      {equippedItems.bottom && <WardrobeItemMesh item={equippedItems.bottom} skeleton={skeleton} />}
    </group>
  );
}

// ─── Loading Fallback ─────────────────────────────────────────────────────────
function AvatarFallback() {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color="#6c47ff" wireframe />
    </mesh>
  );
}

// ─── Main Canvas ──────────────────────────────────────────────────────────────
export function AvatarCanvas() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        shadows
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-3, 3, -3]} intensity={0.4} color="#6c47ff" />

        {/* Avatar */}
        <ErrorBoundary>
        <Suspense fallback={<AvatarFallback />}>
          <AvatarModel />
          <ContactShadows
            position={[0, -1.4, 0]}
            opacity={0.4}
            scale={4}
            blur={2}
            far={4}
          />
          <Environment preset="city" />
        </Suspense>
        </ErrorBoundary>
      </Canvas>
    </div>
  );
}
