import React, { Suspense, useEffect, useRef } from "react";
import { View, PanResponder } from "react-native";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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

// ─── GLB Model ────────────────────────────────────────────────────────────────

const AVATAR_GLB = require("../../../assets/avatar.glb");

function GLBModel({ rotY }: { rotY: React.MutableRefObject<number> }) {
  const gltf     = useLoader(GLTFLoader, AVATAR_GLB);
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  // Auto-center and scale the model to fit the viewport
  useEffect(() => {
    if (!gltf.scene) return;
    const box    = new THREE.Box3().setFromObject(gltf.scene);
    const center = box.getCenter(new THREE.Vector3());
    const height = box.getSize(new THREE.Vector3()).y;
    // Shift model so base sits at y=0, centered on x/z
    gltf.scene.position.set(-center.x, -box.min.y, -center.z);
    // Normalise scale so the model is roughly 1 unit tall
    const scale = 1.0 / (height || 1);
    gltf.scene.scale.setScalar(scale);

    // Play first animation if any (idle)
    if (gltf.animations.length > 0) {
      mixerRef.current = new THREE.AnimationMixer(gltf.scene);
      const action = mixerRef.current.clipAction(gltf.animations[0]);
      action.play();
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

// ─── Fallback blob shown while GLB loads ──────────────────────────────────────

function FallbackMesh({ rotY }: { rotY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.y = rotY.current;
  });
  return (
    <mesh ref={ref} position={[0, 0.5, 0]}>
      <sphereGeometry args={[0.4, 32, 32]} />
      <meshStandardMaterial color="#7c3aed" roughness={0.8} metalness={0.1} />
    </mesh>
  );
}

// ─── Ground glow rings ────────────────────────────────────────────────────────

function GroundRings() {
  return (
    <>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.24, 0.34, 80]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.44, 80]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.35} />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.48, 0.80, 80]} />
        <meshBasicMaterial color="#7c3aed" transparent opacity={0.12} />
      </mesh>
      <mesh position={[0, -0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.26, 80]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.08} />
      </mesh>
    </>
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
        camera={{ position: [0, 0.6, 2.8], fov: 40 }}
        style={{ width: size, height: size, background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(0x000000, 0);
          (camera as THREE.PerspectiveCamera).lookAt(0, 0.5, 0);
        }}
      >
        <ambientLight intensity={0.55} color="#cce4ff" />
        <hemisphereLight args={["#d8eeff", "#b8c8e8", 0.70]} />
        <directionalLight position={[2.2, 4.0, 3.5]} intensity={1.55} color="#ffffff" />
        <directionalLight position={[-2.8, 2.0, 1.2]} intensity={0.32} color="#c8dcff" />
        <pointLight position={[0, -0.5, 2.2]} intensity={0.15} color="#fde68a" />
        <GroundRings />
        <Suspense fallback={<FallbackMesh rotY={rotY} />}>
          <GLBModel rotY={rotY} />
        </Suspense>
      </Canvas>
    </View>
  );
}
