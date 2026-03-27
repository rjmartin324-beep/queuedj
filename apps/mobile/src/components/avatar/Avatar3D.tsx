import React, { Suspense, useEffect, useRef, useState } from "react";
import { View, PanResponder } from "react-native";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Asset } from "expo-asset";

export type EmotionId   = "neutral" | "happy" | "laugh" | "sad" | "angry" | "surprised" | "cry" | "love" | "cool" | "shocked" | "sleepy" | "confused" | "celebrate";
export type AnimStateId = "idle" | "bounceIdle" | "wave" | "celebrate" | "react_happy" | "react_laugh" | "react_sad" | "react_angry" | "react_surprised" | "react_cry" | "react_love" | "react_cool" | "react_shocked" | "react_sleepy" | "react_confused";

interface Props {
  size:        number;
  bodyColor?:  string;
  outfit?:     string;
  emotion?:    EmotionId;
  animState?:  AnimStateId;
  expression?: "happy" | "cool" | "party";
}

// ─── Resolve GLB asset to a real URI (works on web + native) ─────────────────

function useGLBUri() {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    const mod = require("../../../assets/avatar.glb");
    // On web, require() of a bundled asset already returns a URL string.
    // On native, it returns a numeric module ID — expo-asset resolves it.
    if (typeof mod === "string") {
      setUri(mod);
    } else {
      Asset.fromModule(mod)
        .downloadAsync()
        .then(a => setUri(a.localUri ?? a.uri ?? null))
        .catch(() => setUri(null));
    }
  }, []);

  return uri;
}

// ─── GLB Model (only rendered once we have a valid URI) ───────────────────────

function GLBLoader({ uri, rotY }: { uri: string; rotY: React.MutableRefObject<number> }) {
  const gltf     = useLoader(GLTFLoader, uri);
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  useEffect(() => {
    if (!gltf.scene) return;
    // Auto-center and normalise to ~1 unit tall
    const box    = new THREE.Box3().setFromObject(gltf.scene);
    const center = box.getCenter(new THREE.Vector3());
    const height = box.getSize(new THREE.Vector3()).y;
    gltf.scene.scale.setScalar(1.0 / (height || 1));
    // Shift down by half the normalised height so the model sits lower in frame
    gltf.scene.position.set(-center.x, -box.min.y / (height || 1) - 0.5, -center.z);
    // Play first animation if present
    if (gltf.animations.length > 0) {
      mixerRef.current = new THREE.AnimationMixer(gltf.scene);
      mixerRef.current.clipAction(gltf.animations[0]).play();
    }
  }, [gltf]);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y = rotY.current;
    mixerRef.current?.update(delta);
  });

  return (
    <group ref={groupRef}>
      <primitive object={gltf.scene} dispose={null} />
    </group>
  );
}

// ─── Scene — resolves URI then renders model or fallback ─────────────────────

function Scene({ rotY }: { rotY: React.MutableRefObject<number> }) {
  const uri = useGLBUri();
  return uri ? (
    <Suspense fallback={<FallbackBlob rotY={rotY} />}>
      <GLBLoader uri={uri} rotY={rotY} />
    </Suspense>
  ) : (
    <FallbackBlob rotY={rotY} />
  );
}

// ─── Fallback shown while GLB resolves / loads ────────────────────────────────

function FallbackBlob({ rotY }: { rotY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => { if (ref.current) ref.current.rotation.y = rotY.current; });
  return (
    <mesh ref={ref} position={[0, 0.5, 0]}>
      <sphereGeometry args={[0.4, 32, 32]} />
      <meshStandardMaterial color="#7c3aed" roughness={0.8} />
    </mesh>
  );
}


// ─── Main export ──────────────────────────────────────────────────────────────

export function Avatar3D({ size }: Props) {
  const rotY  = useRef(0.38);
  const lastX = useRef(0);

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant:  (e) => { lastX.current = e.nativeEvent.pageX; },
    onPanResponderMove:   (e) => {
      rotY.current += (e.nativeEvent.pageX - lastX.current) * 0.013;
      lastX.current = e.nativeEvent.pageX;
    },
    onPanResponderRelease: () => {},
  });

  return (
    <View style={{ width: size, height: size }} {...pan.panHandlers}>
      <Canvas
        camera={{ position: [0, 0.1, 2.8], fov: 40 }}
        style={{ width: size, height: size, background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(0x000000, 0);
          (camera as THREE.PerspectiveCamera).lookAt(0, 0.0, 0);
        }}
      >
        <ambientLight intensity={0.55} color="#cce4ff" />
        <hemisphereLight args={["#d8eeff", "#b8c8e8", 0.70]} />
        <directionalLight position={[2.2, 4.0, 3.5]} intensity={1.55} color="#ffffff" />
        <directionalLight position={[-2.8, 2.0, 1.2]} intensity={0.32} color="#c8dcff" />
        <pointLight position={[0, -0.5, 2.2]} intensity={0.15} color="#fde68a" />
        <Scene rotY={rotY} />
      </Canvas>
    </View>
  );
}
