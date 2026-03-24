import React, { useRef, useMemo } from "react";
import { View, PanResponder } from "react-native";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

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

const mat = { roughness: 0.92, metalness: 0.0 } as const;
function M({ c }: { c: string }) {
  return <meshStandardMaterial color={c} roughness={mat.roughness} metalness={mat.metalness} />;
}

function CharacterMesh({ bodyColor, rotY }: { bodyColor: string; rotY: React.MutableRefObject<number> }) {
  const rootRef  = useRef<THREE.Group>(null);
  const bodyRef  = useRef<THREE.Group>(null);
  const armLRef  = useRef<THREE.Group>(null);
  const armRRef  = useRef<THREE.Group>(null);
  const footLRef = useRef<THREE.Group>(null);
  const footRRef = useRef<THREE.Group>(null);
  const tuftRef  = useRef<THREE.Group>(null);

  const bodyProfile = useMemo(() => [
    new THREE.Vector2(0.158, 0.095),  // base ring
    new THREE.Vector2(0.255, 0.124),  // flat bottom — spreads wide, barely rises
    new THREE.Vector2(0.355, 0.205),  // starts rising
    new THREE.Vector2(0.428, 0.292),  // building
    new THREE.Vector2(0.455, 0.380),  // approaching widest
    new THREE.Vector2(0.468, 0.455),  // WIDEST — near middle (42% of height)
    new THREE.Vector2(0.462, 0.535),  // plateau
    new THREE.Vector2(0.445, 0.618),  // very slow taper
    new THREE.Vector2(0.424, 0.702),  // upper belly — stays WIDE (91%)
    new THREE.Vector2(0.396, 0.788),  // shoulder — stays wide (85%)
    new THREE.Vector2(0.360, 0.868),  // upper dome (77%)
    new THREE.Vector2(0.310, 0.935),  // dome (66%)
    new THREE.Vector2(0.242, 0.988),  // crown
    new THREE.Vector2(0.146, 1.030),  // near apex
    new THREE.Vector2(0.000, 1.062),  // apex
  ], []);

  useFrame(() => {
    if (rootRef.current) rootRef.current.rotation.y = rotY.current;
  });

  return (
    <group ref={rootRef} name="Root">

      <group name="Body" ref={bodyRef}>
        <mesh position={[0, 0, 0.022]} scale={[1.0, 1.0, 0.82]}>
          <latheGeometry args={[bodyProfile, 80]} />
          <M c={bodyColor} />
        </mesh>
      </group>

      <group name="ArmL" ref={armLRef} position={[-0.448, 0.518, 0]} rotation={[0.05, 0.04, 0.24]}>
        <mesh>
          <capsuleGeometry args={[0.074, 0.088, 12, 20]} />
          <M c={bodyColor} />
        </mesh>
        <mesh position={[0, -0.116, 0]}>
          <sphereGeometry args={[0.078, 16, 16]} />
          <M c={bodyColor} />
        </mesh>
      </group>

      <group name="ArmR" ref={armRRef} position={[0.448, 0.518, 0]} rotation={[0.05, -0.04, -0.24]}>
        <mesh>
          <capsuleGeometry args={[0.074, 0.088, 12, 20]} />
          <M c={bodyColor} />
        </mesh>
        <mesh position={[0, -0.116, 0]}>
          <sphereGeometry args={[0.078, 16, 16]} />
          <M c={bodyColor} />
        </mesh>
      </group>

      <group name="FootL" ref={footLRef}>
        <mesh position={[-0.185, 0.090, 0.085]} scale={[0.265, 0.180, 0.325]}>
          <sphereGeometry args={[0.5, 24, 24]} />
          <M c={bodyColor} />
        </mesh>
      </group>

      <group name="FootR" ref={footRRef}>
        <mesh position={[0.185, 0.090, 0.085]} scale={[0.265, 0.180, 0.325]}>
          <sphereGeometry args={[0.5, 24, 24]} />
          <M c={bodyColor} />
        </mesh>
      </group>

      <group name="Tuft" ref={tuftRef}>
        <mesh position={[0, 1.080, -0.016]}>
          <sphereGeometry args={[0.044, 14, 14]} />
          <M c={bodyColor} />
        </mesh>
        {Array.from({ length: 5 }, (_, i) => {
          const angle = (i / 5) * Math.PI * 2;
          const x = Math.sin(angle) * 0.054;
          const z = Math.cos(angle) * 0.054 - 0.016;
          return (
            <mesh key={i} position={[x, 1.066, z]}>
              <sphereGeometry args={[0.034, 10, 10]} />
              <M c={bodyColor} />
            </mesh>
          );
        })}
      </group>

      {/* Ground platform rings — concentric floor glow */}
      <mesh position={[0, 0.053, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.24, 0.34, 80]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0.051, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.44, 80]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.35} />
      </mesh>
      <mesh position={[0, 0.049, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.48, 0.56, 80]} />
        <meshBasicMaterial color="#7c3aed" transparent opacity={0.20} />
      </mesh>
      <mesh position={[0, 0.047, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.60, 0.68, 80]} />
        <meshBasicMaterial color="#5b21b6" transparent opacity={0.12} />
      </mesh>
      <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 0.80, 80]} />
        <meshBasicMaterial color="#4c1d95" transparent opacity={0.06} />
      </mesh>
      {/* Floor fill glow */}
      <mesh position={[0, 0.044, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.26, 80]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.08} />
      </mesh>

    </group>
  );
}

export function Avatar3D({ size, bodyColor = "#7ec8e3" }: Props) {
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
        camera={{ position: [0, 0.55, 2.60], fov: 42 }}
        style={{ width: size, height: size, background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(0x000000, 0);
          (camera as THREE.PerspectiveCamera).lookAt(0, 0.52, 0);
        }}
      >
        <ambientLight intensity={0.50} color="#cce4ff" />
        <hemisphereLight args={["#d8eeff", "#b8c8e8", 0.70]} />
        <directionalLight position={[2.2, 4.0, 3.5]} intensity={1.55} color="#ffffff" />
        <directionalLight position={[-2.8, 2.0, 1.2]} intensity={0.32} color="#c8dcff" />
        <pointLight position={[0, -0.5, 2.2]} intensity={0.15} color="#fde68a" />
        <CharacterMesh bodyColor={bodyColor} rotY={rotY} />
      </Canvas>
    </View>
  );
}
