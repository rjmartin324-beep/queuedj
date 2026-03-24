import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Polygon, Circle, Line, Text as SvgText, G } from "react-native-svg";

// ─────────────────────────────────────────────────────────────────────────────
// WorldMap — simplified equirectangular projection
// viewBox 360x180 where (0,0) = (-180°lng, 90°lat)
// ─────────────────────────────────────────────────────────────────────────────

export function lngLatToSvg(lng: number, lat: number) {
  return { x: lng + 180, y: 90 - lat };
}

export function svgToLngLat(svgX: number, svgY: number) {
  return { lng: svgX - 180, lat: 90 - svgY };
}

// Simplified continent polygons in SVG coordinates (lng+180, 90-lat)
const CONTINENTS = [
  {
    name: "North America",
    color: "#1e3a1e",
    points: "12,18 55,18 90,22 125,43 125,65 110,72 97,82 95,85 75,72 60,62 55,42 12,30",
  },
  {
    name: "South America",
    color: "#1e2e1e",
    points: "98,78 118,78 138,88 148,95 148,145 118,148 105,130 98,78",
  },
  {
    name: "Europe",
    color: "#1a2a3a",
    points: "170,20 215,20 225,32 215,55 207,53 198,55 190,48 178,48 170,44 170,20",
  },
  {
    name: "Africa",
    color: "#2a1a10",
    points: "163,53 233,53 240,65 245,80 235,125 220,128 190,128 165,125 158,90 163,53",
  },
  {
    name: "Asia",
    color: "#1a2040",
    points: "205,18 355,18 358,30 355,70 320,90 280,92 262,85 242,80 237,78 218,53 205,53 205,18",
  },
  {
    name: "Australia",
    color: "#2a1a20",
    points: "294,103 336,103 340,120 335,132 295,132 288,120 294,103",
  },
  {
    name: "New Zealand",
    color: "#1e2e2e",
    points: "348,120 355,118 356,130 350,135 346,132 348,120",
  },
  {
    name: "Greenland",
    color: "#1a2a3a",
    points: "140,12 165,10 170,18 160,28 140,28 135,22 140,12",
  },
  {
    name: "Antarctica",
    color: "#2a2a2a",
    points: "0,162 360,162 360,180 0,180",
  },
];

interface Pin {
  lat: number;
  lng: number;
  color: string;
  label?: string;
}

interface Props {
  pins?: Pin[];
  correctPin?: { lat: number; lng: number };
  onTap?: (lat: number, lng: number) => void;
  pendingPin?: { lat: number; lng: number } | null;
  width: number;
  height: number;
}

export function WorldMap({ pins = [], correctPin, onTap, pendingPin, width, height }: Props) {
  const scaleX = width / 360;
  const scaleY = height / 180;

  function handlePress(e: any) {
    if (!onTap) return;
    const { locationX, locationY } = e.nativeEvent;
    const svgX = locationX / scaleX;
    const svgY = locationY / scaleY;
    const { lng, lat } = svgToLngLat(svgX, svgY);
    onTap(Math.max(-90, Math.min(90, lat)), Math.max(-180, Math.min(180, lng)));
  }

  function pin(lat: number, lng: number, color: string, radius: number = 4, label?: string) {
    const { x, y } = lngLatToSvg(lng, lat);
    const sx = x * scaleX;
    const sy = y * scaleY;
    return (
      <G key={`${lat}-${lng}-${color}`}>
        <Circle cx={sx} cy={sy} r={radius + 2} fill="rgba(0,0,0,0.4)" />
        <Circle cx={sx} cy={sy} r={radius} fill={color} />
        {label && (
          <SvgText x={sx + radius + 2} y={sy + 4} fontSize={8} fill="#fff">{label}</SvgText>
        )}
      </G>
    );
  }

  function lineToCorrect(guess: Pin) {
    if (!correctPin) return null;
    const from = lngLatToSvg(guess.lng, guess.lat);
    const to   = lngLatToSvg(correctPin.lng, correctPin.lat);
    return (
      <Line
        key={`line-${guess.lat}-${guess.lng}`}
        x1={from.x * scaleX} y1={from.y * scaleY}
        x2={to.x   * scaleX} y2={to.y   * scaleY}
        stroke={guess.color} strokeWidth={1} strokeDasharray="3,2" opacity={0.6}
      />
    );
  }

  return (
    <View
      style={[styles.map, { width, height }]}
      onStartShouldSetResponder={() => !!onTap}
      onResponderGrant={handlePress}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Ocean */}
        <Polygon points={`0,0 ${width},0 ${width},${height} 0,${height}`} fill="#0a1a2a" />

        {/* Grid lines */}
        {[-60, -30, 0, 30, 60].map(lat => {
          const y = lngLatToSvg(0, lat).y * scaleY;
          return <Line key={lat} x1={0} y1={y} x2={width} y2={y} stroke="#ffffff08" strokeWidth={0.5} />;
        })}
        {[-120, -60, 0, 60, 120].map(lng => {
          const x = lngLatToSvg(lng, 0).x * scaleX;
          return <Line key={lng} x1={x} y1={0} x2={x} y2={height} stroke="#ffffff08" strokeWidth={0.5} />;
        })}

        {/* Continents */}
        {CONTINENTS.map(c => {
          const scaledPoints = c.points.split(" ").map(pt => {
            const [x, y] = pt.split(",").map(Number);
            return `${x * scaleX},${y * scaleY}`;
          }).join(" ");
          return (
            <Polygon key={c.name} points={scaledPoints} fill={c.color} stroke="#ffffff15" strokeWidth={0.5} />
          );
        })}

        {/* Dashed lines from guesses to correct pin */}
        {correctPin && pins.map(p => lineToCorrect(p))}

        {/* Guest guess pins */}
        {pins.map(p => pin(p.lat, p.lng, p.color, 5, p.label))}

        {/* Correct location pin (star shape via large circle + ring) */}
        {correctPin && (() => {
          const { x, y } = lngLatToSvg(correctPin.lng, correctPin.lat);
          return (
            <G>
              <Circle cx={x * scaleX} cy={y * scaleY} r={10} fill="none" stroke="#FFD700" strokeWidth={2} />
              <Circle cx={x * scaleX} cy={y * scaleY} r={5}  fill="#FFD700" />
            </G>
          );
        })()}

        {/* Pending pin (player's current guess before submit) */}
        {pendingPin && (() => {
          const { x, y } = lngLatToSvg(pendingPin.lng, pendingPin.lat);
          return (
            <G>
              <Circle cx={x * scaleX} cy={y * scaleY} r={8} fill="none" stroke="#6c47ff" strokeWidth={2} />
              <Circle cx={x * scaleX} cy={y * scaleY} r={4} fill="#6c47ff" />
            </G>
          );
        })()}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { backgroundColor: "#0a1a2a", overflow: "hidden" },
});
