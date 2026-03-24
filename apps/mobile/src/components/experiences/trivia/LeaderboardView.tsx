import React, { useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerEntry {
  guestId: string;
  score: number;
  playerNum?: number;
  isMe?: boolean;
  displayName?: string;
}

interface NormalizedEntry {
  guestId: string;
  score: number;
  rank: number;
  isMe: boolean;
  displayName: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOLD   = "#FFD700";
const SILVER = "#C0C0C0";
const BRONZE = "#CD7F32";
const ACCENT = "#6c47ff";
const SCREEN_WIDTH = Dimensions.get("window").width;

// ─── Animated Score ───────────────────────────────────────────────────────────

function useCountUp(target: number, delay: number): Animated.Value {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.timing(anim, {
        toValue: target,
        duration: 900,
        useNativeDriver: false,
      }).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, delay]);
  return anim;
}

// ─── Podium Slot ──────────────────────────────────────────────────────────────

interface PodiumSlotProps {
  entry: NormalizedEntry;
  position: 1 | 2 | 3;
  enterAnim: Animated.Value;
}

function PodiumSlot({ entry, position, enterAnim }: PodiumSlotProps) {
  const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const podiumColors: Record<number, string> = { 1: GOLD, 2: SILVER, 3: BRONZE };
  const color = podiumColors[position];

  const blockHeights: Record<number, number> = { 1: 88, 2: 64, 3: 52 };
  const blockHeight = blockHeights[position];
  const isFirst = position === 1;

  const scoreAnim = useCountUp(entry.score, 400 + position * 100);

  const translateY = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 0],
  });
  const opacity = enterAnim;

  return (
    <Animated.View
      style={[
        styles.podiumSlot,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      {isFirst && (
        <Text style={styles.crownEmoji}>👑</Text>
      )}
      <Text style={styles.medalEmoji}>{medals[position]}</Text>
      <Text
        style={[
          styles.podiumName,
          { color: isFirst ? GOLD : color },
          isFirst && styles.podiumNameFirst,
        ]}
        numberOfLines={1}
      >
        {entry.displayName}
      </Text>

      <View
        style={[
          styles.podiumBlock,
          { height: blockHeight, borderColor: color },
          isFirst && styles.podiumBlockFirst,
        ]}
      >
        <LinearGradient
          colors={
            isFirst
              ? ["rgba(255,215,0,0.25)", "rgba(255,215,0,0.08)"]
              : ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)"]
          }
          style={StyleSheet.absoluteFill}
        />
        <AnimatedScoreText anim={scoreAnim} color={color} style={styles.podiumScore} />
      </View>
    </Animated.View>
  );
}

// ─── Animated Score Text ──────────────────────────────────────────────────────

function AnimatedScoreText({
  anim,
  color,
  style,
}: {
  anim: Animated.Value;
  color: string;
  style?: object;
}) {
  const [displayed, setDisplayed] = React.useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value }) => {
      setDisplayed(Math.round(value));
    });
    return () => anim.removeListener(id);
  }, [anim]);

  return (
    <Text style={[style, { color }]}>{displayed}</Text>
  );
}

// ─── Row Animation ────────────────────────────────────────────────────────────

interface ListRowProps {
  entry: NormalizedEntry;
  index: number;
}

function ListRow({ entry, index }: ListRowProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scoreAnim = useCountUp(entry.score, 300 + index * 80);

  useEffect(() => {
    const delay = index * 60;
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.listRow,
        entry.isMe && styles.listRowMe,
        {
          opacity: opacityAnim,
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      {entry.isMe && (
        <LinearGradient
          colors={["rgba(108,71,255,0.18)", "rgba(108,71,255,0.06)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
        />
      )}

      {/* Rank badge */}
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{entry.rank}</Text>
      </View>

      {/* Name */}
      <Text
        style={[styles.listName, entry.isMe && styles.listNameMe]}
        numberOfLines={1}
      >
        {entry.displayName}
      </Text>

      {/* Points badge */}
      <View style={[styles.pointsBadge, entry.isMe && styles.pointsBadgeMe]}>
        <AnimatedScoreText anim={scoreAnim} color={entry.isMe ? "#fff" : ACCENT} style={styles.pointsBadgeInner} />
      </View>

      {/* Score */}
      <View style={styles.scoreBlock}>
        <AnimatedScoreText
          anim={scoreAnim}
          color={entry.isMe ? GOLD : "#e0e0e0"}
          style={styles.listScore}
        />
        <Text style={styles.ptsLabel}>pts</Text>
      </View>
    </Animated.View>
  );
}

// ─── Podium Row ───────────────────────────────────────────────────────────────

interface PodiumRowProps {
  top3: NormalizedEntry[];
  enterAnim: Animated.Value;
}

function PodiumRow({ top3, enterAnim }: PodiumRowProps) {
  const second = top3.find((e) => e.rank === 2);
  const first  = top3.find((e) => e.rank === 1);
  const third  = top3.find((e) => e.rank === 3);

  return (
    <View style={styles.podiumRow}>
      {second ? (
        <PodiumSlot entry={second} position={2} enterAnim={enterAnim} />
      ) : (
        <View style={styles.podiumPlaceholder} />
      )}
      {first ? (
        <PodiumSlot entry={first} position={1} enterAnim={enterAnim} />
      ) : (
        <View style={styles.podiumPlaceholder} />
      )}
      {third ? (
        <PodiumSlot entry={third} position={3} enterAnim={enterAnim} />
      ) : (
        <View style={styles.podiumPlaceholder} />
      )}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LeaderboardView() {
  const { state } = useRoom();

  const rawData = state.guestViewData as
    | PlayerEntry[]
    | Record<string, number>
    | null
    | undefined;

  // Normalize both formats
  const sorted: NormalizedEntry[] = useMemo(() => {
    let entries: PlayerEntry[] = [];

    if (Array.isArray(rawData)) {
      entries = rawData;
    } else if (rawData && typeof rawData === "object") {
      entries = Object.entries(rawData).map(([guestId, score], i) => ({
        guestId,
        score: score as number,
        playerNum: i + 1,
        isMe: false,
      }));
    }

    return entries
      .sort((a, b) => b.score - a.score)
      .map((e, i) => {
        const isMe = e.isMe === true || e.guestId === state.guestId;
        return {
          guestId: e.guestId,
          score: e.score,
          rank: i + 1,
          isMe,
          displayName: isMe
            ? "You"
            : e.displayName
            ? e.displayName
            : e.playerNum != null
            ? `Player ${e.playerNum}`
            : `Player ${i + 1}`,
        };
      });
  }, [rawData, state.guestId]);

  const top3   = sorted.filter((e) => e.rank <= 3);
  const rest   = sorted.filter((e) => e.rank > 3);

  // Podium entrance animation
  const podiumAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(podiumAnim, {
      toValue: 1,
      duration: 600,
      delay: 100,
      useNativeDriver: true,
    }).start();
  }, []);

  // Round/Final metadata (optional, from state)
  const roundNum   = (state as any).currentRound as number | undefined;
  const totalRounds = (state as any).totalRounds as number | undefined;
  const isFinal    = roundNum != null && totalRounds != null && roundNum >= totalRounds;
  const pillLabel  = isFinal
    ? "FINAL"
    : roundNum != null && totalRounds != null
    ? `ROUND ${roundNum} / ${totalRounds}`
    : "RESULTS";

  return (
    <LinearGradient
      colors={["#0c0620", "#1a0840", "#0c0620"]}
      locations={[0, 0.5, 1]}
      style={styles.root}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏆 LEADERBOARD</Text>
        <View style={[styles.pill, isFinal && styles.pillFinal]}>
          <Text style={[styles.pillText, isFinal && styles.pillTextFinal]}>
            {pillLabel}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <LinearGradient
        colors={["transparent", ACCENT, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.divider}
      />

      {/* Podium */}
      {top3.length > 0 && (
        <PodiumRow top3={top3} enterAnim={podiumAnim} />
      )}

      {/* Rest of the list */}
      {rest.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>— RANKINGS —</Text>
          <FlatList
            data={rest}
            keyExtractor={(item) => item.guestId}
            renderItem={({ item, index }) => (
              <ListRow entry={item} index={index} />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      {sorted.length === 0 && (
        <Text style={styles.empty}>No scores yet</Text>
      )}
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 20,
  },

  // Header
  header: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 12,
    gap: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 2,
    textShadowColor: ACCENT,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  pill: {
    backgroundColor: "rgba(108,71,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(108,71,255,0.55)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  pillFinal: {
    backgroundColor: "rgba(255,215,0,0.15)",
    borderColor: "rgba(255,215,0,0.5)",
  },
  pillText: {
    color: "#a78bfa",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  pillTextFinal: {
    color: GOLD,
  },

  // Divider
  divider: {
    height: 1,
    marginHorizontal: 24,
    marginBottom: 20,
  },

  // Podium
  podiumRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    marginBottom: 28,
    gap: 8,
  },
  podiumSlot: {
    flex: 1,
    alignItems: "center",
    maxWidth: 120,
  },
  podiumPlaceholder: {
    flex: 1,
    maxWidth: 120,
  },
  crownEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  medalEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  podiumName: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  podiumNameFirst: {
    fontSize: 14,
    textShadowColor: "rgba(255,215,0,0.7)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  podiumBlock: {
    width: "100%",
    borderWidth: 1.5,
    borderRadius: 10,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  podiumBlockFirst: {
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 12,
  },
  podiumScore: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  // Section label
  sectionLabel: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 12,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 10,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
    gap: 10,
  },
  listRowMe: {
    borderColor: ACCENT,
    borderWidth: 1.5,
  },

  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "800",
  },

  listName: {
    flex: 1,
    color: "#e0e0e0",
    fontSize: 15,
    fontWeight: "600",
  },
  listNameMe: {
    color: "#ffffff",
    fontWeight: "800",
  },

  pointsBadge: {
    backgroundColor: "rgba(108,71,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(108,71,255,0.35)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
  },
  pointsBadgeMe: {
    backgroundColor: "rgba(108,71,255,0.35)",
    borderColor: ACCENT,
  },
  pointsBadgeText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: "700",
  },
  pointsBadgeTextMe: {
    color: "#ffffff",
  },
  pointsBadgeInner: {
    fontSize: 11,
    fontWeight: "700",
  },

  scoreBlock: {
    alignItems: "flex-end",
    minWidth: 60,
  },
  listScore: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  ptsLabel: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: -2,
  },

  // Empty
  empty: {
    color: "rgba(255,255,255,0.25)",
    textAlign: "center",
    fontSize: 16,
    marginTop: 80,
    fontStyle: "italic",
  },
});
