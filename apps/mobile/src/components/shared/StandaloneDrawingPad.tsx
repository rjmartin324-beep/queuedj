import React, { useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, PanResponder,
  GestureResponderEvent,
} from "react-native";
import Svg, { Path } from "react-native-svg";

export interface DrawPath {
  d: string;
  color: string;
  strokeWidth: number;
}

interface Props {
  prompt: string;
  onDone: (paths: DrawPath[]) => void;
  accentColor?: string;
}

const COLORS = ["#ffffff", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#000000"];
const WIDTHS = [2, 5, 10, 18];

function pts2d(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
  return d;
}

export function StandaloneDrawingPad({ prompt, onDone, accentColor = "#c084fc" }: Props) {
  const [paths, setPaths]       = useState<DrawPath[]>([]);
  const [curD, setCurD]         = useState("");
  const [color, setColor]       = useState(COLORS[0]);
  const [width, setWidth]       = useState(WIDTHS[1]);
  const colorRef                = useRef(color);
  const widthRef                = useRef(width);
  const ptsRef                  = useRef<[number, number][]>([]);

  function pick(c: string)  { setColor(c);  colorRef.current = c; }
  function pickW(w: number) { setWidth(w);  widthRef.current = w; }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        ptsRef.current = [[locationX, locationY]];
        setCurD(pts2d([[locationX, locationY]]));
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        ptsRef.current.push([locationX, locationY]);
        setCurD(pts2d(ptsRef.current));
      },
      onPanResponderRelease: () => {
        if (ptsRef.current.length < 2) { setCurD(""); return; }
        const newPath: DrawPath = { d: pts2d(ptsRef.current), color: colorRef.current, strokeWidth: widthRef.current };
        setPaths(p => [...p, newPath]);
        ptsRef.current = [];
        setCurD("");
      },
    })
  ).current;

  return (
    <View style={s.container}>
      {/* Prompt */}
      <View style={[s.promptBar, { borderColor: accentColor + "44" }]}>
        <Text style={s.promptLabel}>DRAW THIS</Text>
        <Text style={[s.promptText, { color: accentColor }]}>{prompt}</Text>
      </View>

      {/* Canvas */}
      <View style={s.canvas} {...pan.panHandlers}>
        <Svg width="100%" height="100%">
          {paths.map((p, i) => (
            <Path key={i} d={p.d} stroke={p.color} strokeWidth={p.strokeWidth}
              fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {curD ? (
            <Path d={curD} stroke={colorRef.current} strokeWidth={widthRef.current}
              fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </Svg>
      </View>

      {/* Colour picker */}
      <View style={s.colorRow}>
        {COLORS.map(c => (
          <TouchableOpacity
            key={c} onPress={() => pick(c)}
            style={[s.colorBtn, { backgroundColor: c }, color === c && { borderColor: "#fff", borderWidth: 2.5 }]}
          />
        ))}
      </View>

      {/* Width + actions */}
      <View style={s.toolRow}>
        {WIDTHS.map(w => (
          <TouchableOpacity key={w} onPress={() => pickW(w)}
            style={[s.widthBtn, width === w && { borderColor: accentColor }]}>
            <View style={[s.dot, { width: w * 1.6, height: w * 1.6, borderRadius: w }]} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.textBtn} onPress={() => setPaths(p => p.slice(0, -1))}>
          <Text style={s.textBtnText}>Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.textBtn} onPress={() => setPaths([])}>
          <Text style={s.textBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Done button */}
      <TouchableOpacity
        style={[s.doneBtn, { backgroundColor: accentColor }]}
        onPress={() => onDone(paths)}
      >
        <Text style={s.doneBtnText}>Done Drawing  →</Text>
      </TouchableOpacity>
    </View>
  );
}

// Render saved paths read-only (for the guesser to see)
export function DrawingDisplay({ paths, style }: { paths: DrawPath[]; style?: object }) {
  return (
    <View style={[s.display, style]}>
      <Svg width="100%" height="100%">
        {paths.map((p, i) => (
          <Path key={i} d={p.d} stroke={p.color} strokeWidth={p.strokeWidth}
            fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1 },
  promptBar:  { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, backgroundColor: "rgba(255,255,255,0.04)" },
  promptLabel:{ color: "#666", fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 2 },
  promptText: { fontSize: 18, fontWeight: "900" },
  canvas:     { flex: 1, backgroundColor: "#1a1a2e", margin: 10, borderRadius: 16, overflow: "hidden" },
  display:    { backgroundColor: "#1a1a2e", borderRadius: 16, overflow: "hidden" },
  colorRow:   { flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 8 },
  colorBtn:   { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: "transparent" },
  toolRow:    { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingBottom: 8 },
  widthBtn:   { width: 36, height: 36, borderRadius: 8, backgroundColor: "#222", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#333" },
  dot:        { backgroundColor: "#fff" },
  textBtn:    { backgroundColor: "#2a2a2a", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  textBtnText:{ color: "#fff", fontSize: 13 },
  doneBtn:    { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 16, alignItems: "center" },
  doneBtnText:{ color: "#fff", fontSize: 16, fontWeight: "900" },
});
