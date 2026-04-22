import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// GenericGameView
//
// Covers all 21 single-view standalone games. Reads state.guestView (game type)
// and state.guestViewData (current server state) to render appropriate UI.
// Interactive games send actions via sendAction.
// ─────────────────────────────────────────────────────────────────────────────

type GameMeta = { emoji: string; title: string; accent: string };

const GAME_META: Record<string, GameMeta> = {
  draw_it:            { emoji: "🎨", title: "Draw It", accent: "#ec4899" },
  would_you_rather:   { emoji: "🤔", title: "Would You Rather", accent: "#8b5cf6" },
  never_have_i_ever:  { emoji: "🤞", title: "Never Have I Ever", accent: "#06b6d4" },
  truth_or_dare:      { emoji: "🎯", title: "Truth or Dare", accent: "#ef4444" },
  two_truths_one_lie: { emoji: "🤥", title: "Two Truths & a Lie", accent: "#f59e0b" },
  rank_it:            { emoji: "📊", title: "Rank It", accent: "#3b82f6" },
  emoji_story:        { emoji: "📖", title: "Emoji Story", accent: "#f472b6" },
  celebrity_head:     { emoji: "⭐", title: "Celebrity Head", accent: "#eab308" },
  word_association:   { emoji: "💬", title: "Word Association", accent: "#22c55e" },
  who_knows_who:      { emoji: "🤝", title: "Who Knows Who", accent: "#6366f1" },
  fake_news:          { emoji: "📰", title: "Fake News", accent: "#dc2626" },
  pop_culture_quiz:   { emoji: "🎬", title: "Pop Culture Quiz", accent: "#f97316" },
  alibi:              { emoji: "🔍", title: "Alibi", accent: "#64748b" },
  mind_reading:       { emoji: "🔮", title: "Mind Reading", accent: "#7c3aed" },
  speed_round:        { emoji: "⚡", title: "Speed Round", accent: "#facc15" },
  mimic_me:           { emoji: "🎭", title: "Mimic Me", accent: "#ec4899" },
  chain_reaction:     { emoji: "⛓️", title: "Chain Reaction", accent: "#14b8a6" },
  party_dice:         { emoji: "🎲", title: "Party Dice", accent: "#f59e0b" },
  connections:        { emoji: "🔗", title: "Connections", accent: "#3b82f6" },
  lyrics_drop:        { emoji: "🎵", title: "Lyrics Drop", accent: "#a855f7" },
  musical_chairs:     { emoji: "🪑", title: "Musical Chairs", accent: "#f43f5e" },
  thumb_war:          { emoji: "👍", title: "Thumb War", accent: "#84cc16" },
};

export function GenericGameView() {
  const { state, sendAction } = useRoom();
  const gameType = (state.guestView ?? "") as string;
  const data     = (state.guestViewData ?? {}) as any;
  const guestId  = state.guestId ?? "";

  const meta   = GAME_META[gameType] ?? { emoji: "🎮", title: gameType.replace(/_/g, " "), accent: "#c084fc" };
  const phase  = data.phase ?? "waiting";
  const round  = data.round ?? 0;
  const total  = data.totalRounds ?? 0;

  // ── Draw It ───────────────────────────────────────────────────────────────
  if (gameType === "draw_it") {
    return <DrawItView meta={meta} data={data} guestId={guestId} sendAction={sendAction} />;
  }

  // ── Would You Rather ──────────────────────────────────────────────────────
  if (gameType === "would_you_rather") {
    return <WouldYouRatherView meta={meta} data={data} guestId={guestId} sendAction={sendAction} />;
  }

  // ── Never Have I Ever ─────────────────────────────────────────────────────
  if (gameType === "never_have_i_ever") {
    return <NeverHaveIEverView meta={meta} data={data} guestId={guestId} sendAction={sendAction} />;
  }

  // ── Fake News ─────────────────────────────────────────────────────────────
  if (gameType === "fake_news") {
    return <FakeNewsView meta={meta} data={data} guestId={guestId} sendAction={sendAction} />;
  }

  // ── Who Knows Who ─────────────────────────────────────────────────────────
  if (gameType === "who_knows_who") {
    return <WhoKnowsWhoView meta={meta} data={data} guestId={guestId} sendAction={sendAction} />;
  }

  // ── Two Truths & a Lie ────────────────────────────────────────────────────
  if (gameType === "two_truths_one_lie") {
    return <TwoTruthsView meta={meta} data={data} guestId={guestId} sendAction={sendAction} />;
  }

  // ── Truth or Dare ─────────────────────────────────────────────────────────
  if (gameType === "truth_or_dare") {
    return <TruthOrDareView meta={meta} data={data} guestId={guestId} />;
  }

  // ── Celebrity Head ────────────────────────────────────────────────────────
  if (gameType === "celebrity_head") {
    return <CelebrityHeadView meta={meta} data={data} guestId={guestId} sendAction={sendAction} />;
  }

  // ── Connections ───────────────────────────────────────────────────────────
  if (gameType === "connections") {
    return <ConnectionsView meta={meta} data={data} guestId={guestId} sendAction={sendAction} />;
  }

  // ── Rank It ───────────────────────────────────────────────────────────────
  if (gameType === "rank_it") {
    return <RankItView meta={meta} data={data} guestId={guestId} sendAction={sendAction} />;
  }

  // ── Mimic Me ──────────────────────────────────────────────────────────────
  if (gameType === "mimic_me") {
    return <MimicMeView meta={meta} data={data} guestId={guestId} sendAction={sendAction} />;
  }

  // ── Pop Culture Quiz ──────────────────────────────────────────────────────
  if (gameType === "pop_culture_quiz") {
    return <PopCultureQuizView meta={meta} data={data} guestId={guestId} sendAction={sendAction} />;
  }

  // ── Default fallback — operable stub for unimplemented games ─────────────
  return <StubGameView meta={meta} data={data} guestId={guestId} sendAction={sendAction} round={round} total={total} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// StubGameView — operable fallback for stub games
// Shows phase, all state keys/values, "I'm Ready" + text submit
// ─────────────────────────────────────────────────────────────────────────────
function StubGameView({ meta, data, guestId, sendAction, round, total }: any) {
  const [text, setText] = useState("");
  const [readied, setReadied] = useState(false);

  const phase: string = data.phase ?? "waiting";
  const scores: Record<string, number> | undefined = data.scores;

  // Friendly title: replace underscores, title-case
  const friendlyTitle = meta.title !== meta.emoji
    ? meta.title
    : (meta.title as string).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

  // State entries for inspection (exclude large arrays to keep it readable)
  const stateEntries = Object.entries(data).filter(([k]) => k !== "scores");

  function handleReady() {
    setReadied(true);
    sendAction("ready");
  }

  function handleSubmit() {
    const t = text.trim();
    if (!t) return;
    sendAction("submit", { text: t });
    setText("");
  }

  return (
    <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: meta.accent + "33" }]}>
        <Text style={s.headerEmoji}>{meta.emoji}</Text>
        <Text style={[s.headerTitle, { color: meta.accent }]}>{friendlyTitle}</Text>
        {total > 0 && <Text style={s.roundPill}>Round {round} / {total}</Text>}
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {/* Phase chip */}
        <View style={[s.phaseChip, { borderColor: meta.accent + "55" }]}>
          <Text style={[s.phaseChipText, { color: meta.accent }]}>PHASE: {phase.toUpperCase()}</Text>
        </View>

        {/* State viewer */}
        <View style={s.stateBox}>
          <Text style={s.stateBoxTitle}>GAME STATE</Text>
          {stateEntries.map(([k, v]) => {
            const val = typeof v === "object" ? JSON.stringify(v).slice(0, 80) : String(v);
            return (
              <View key={k} style={s.stateRow}>
                <Text style={s.stateKey}>{k}</Text>
                <Text style={s.stateVal} numberOfLines={2}>{val}</Text>
              </View>
            );
          })}
        </View>

        {/* Scores if present */}
        {scores && Object.keys(scores).length > 0 && (
          <View style={s.stateBox}>
            <Text style={s.stateBoxTitle}>SCORES</Text>
            {Object.entries(scores)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([id, pts], i) => (
                <View key={id} style={s.stateRow}>
                  <Text style={s.stateKey}>#{i + 1} {id === guestId ? "You" : id.slice(0, 8)}</Text>
                  <Text style={[s.stateVal, { color: meta.accent }]}>{pts as number} pts</Text>
                </View>
              ))}
          </View>
        )}

        {/* I'm Ready */}
        {!readied ? (
          <TouchableOpacity
            style={[s.stubBtn, { borderColor: meta.accent + "66" }]}
            onPress={handleReady}
            activeOpacity={0.8}
          >
            <Text style={[s.stubBtnText, { color: meta.accent }]}>I'm Ready ✓</Text>
          </TouchableOpacity>
        ) : (
          <View style={[s.stubBtn, { borderColor: "#22c55e44" }]}>
            <Text style={{ color: "#22c55e", fontWeight: "700" }}>Ready! Waiting...</Text>
          </View>
        )}

        {/* Text input for games that need it */}
        <View style={s.stubInputRow}>
          <TextInput
            style={s.stubInput}
            placeholder="Submit an answer..."
            placeholderTextColor="#555"
            value={text}
            onChangeText={setText}
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[s.stubSendBtn, { backgroundColor: meta.accent + "33", borderColor: meta.accent + "55" }]}
            onPress={handleSubmit}
            disabled={!text.trim()}
            activeOpacity={0.8}
          >
            <Text style={[s.stubSendText, { color: meta.accent }]}>Send</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic card renderer for display-only games
// ─────────────────────────────────────────────────────────────────────────────
function GameCard({ data, meta, guestId, sendAction }: any) {
  const phase = data.phase ?? "waiting";

  if (phase === "waiting") {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>{meta.emoji}</Text>
        <Text style={[s.title, { color: meta.accent }]}>{meta.title}</Text>
        <Text style={s.sub}>Waiting for the host to begin…</Text>
      </View>
    );
  }

  if (phase === "finished") {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>🏁</Text>
        <Text style={s.title}>Game Over!</Text>
        <Text style={s.sub}>Thanks for playing {meta.title}</Text>
      </View>
    );
  }

  // Try to extract a prompt/card from common field names
  const prompt =
    data.currentPrompt ?? data.currentChallenge ?? data.currentWord ??
    data.currentAction ?? data.prompt ?? data.card ?? null;

  // Specific per-game logic for display-only games
  // truth_or_dare
  if (data.currentType !== undefined) {
    const isDare    = data.currentType === "dare";
    const typeColor = isDare ? "#ef4444" : "#3b82f6";
    return (
      <View style={s.center}>
        <View style={[s.typeChip, { backgroundColor: typeColor + "22", borderColor: typeColor }]}>
          <Text style={[s.typeChipText, { color: typeColor }]}>
            {isDare ? "DARE" : "TRUTH"}
          </Text>
        </View>
        {data.currentPlayer && (
          <Text style={s.playerLabel}>{data.currentPlayer}'s turn</Text>
        )}
        {data.currentChallenge ? (
          <View style={s.card}>
            <Text style={s.cardText}>{data.currentChallenge}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  // emoji_story
  if (data.chain !== undefined) {
    return (
      <View style={s.center}>
        <Text style={[s.title, { color: meta.accent, marginBottom: 16 }]}>Story so far:</Text>
        <View style={s.card}>
          <Text style={{ fontSize: 32, textAlign: "center", lineHeight: 48 }}>
            {(data.chain as string[]).join(" ")}
          </Text>
        </View>
        {phase === "playing" && (
          <Text style={s.sub}>Watch the host screen to add your emoji!</Text>
        )}
      </View>
    );
  }

  // word_association
  if (data.words !== undefined || data.lastWord !== undefined) {
    const words = data.words as string[] ?? [data.lastWord];
    return (
      <View style={s.center}>
        <Text style={[s.title, { color: meta.accent, marginBottom: 8 }]}>Last word:</Text>
        <View style={s.card}>
          <Text style={[s.cardText, { fontSize: 32 }]}>{words[words.length - 1]}</Text>
        </View>
        {words.length > 1 && (
          <Text style={s.sub}>Chain: {words.slice(-4).join(" → ")}</Text>
        )}
      </View>
    );
  }

  // chain_reaction
  if (data.currentItem !== undefined || data.currentCategory !== undefined) {
    return (
      <View style={s.center}>
        {data.currentCategory && (
          <Text style={s.sub}>{data.currentCategory}</Text>
        )}
        {data.currentItem && (
          <View style={s.card}>
            <Text style={s.cardText}>{data.currentItem}</Text>
          </View>
        )}
      </View>
    );
  }

  // party_dice / musical_chairs / thumb_war
  if (prompt) {
    return (
      <View style={s.center}>
        <View style={s.card}>
          <Text style={s.cardText}>{prompt}</Text>
        </View>
      </View>
    );
  }

  // mind_reading / alibi / speed_round / lyrics_drop
  return (
    <View style={s.center}>
      <Text style={{ fontSize: 48, marginBottom: 12 }}>{meta.emoji}</Text>
      <Text style={[s.title, { color: meta.accent }]}>{meta.title}</Text>
      <Text style={s.sub}>Phase: {phase}</Text>
      {data.currentQuestion && (
        <View style={s.card}>
          <Text style={s.cardText}>{data.currentQuestion}</Text>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw It
// ─────────────────────────────────────────────────────────────────────────────
function DrawItView({ meta, data, guestId, sendAction }: any) {
  const [guess, setGuess] = useState("");
  const phase = data.phase ?? "waiting";
  const isDrawer = data.currentDrawer === guestId;
  const correctGuessers: string[] = data.correctGuessers ?? [];
  const alreadyGuessed = correctGuessers.includes(guestId);

  if (phase === "waiting") return <WaitingCard meta={meta} />;
  if (phase === "finished") return <FinishedCard meta={meta} />;

  return (
    <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
      <View style={[s.header, { borderBottomColor: meta.accent + "33" }]}>
        <Text style={s.headerEmoji}>{meta.emoji}</Text>
        <Text style={[s.headerTitle, { color: meta.accent }]}>{meta.title}</Text>
        <Text style={s.roundPill}>Round {data.round} / {data.totalRounds}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {phase === "drawing" && isDrawer && (
          <>
            <Text style={s.eyebrow}>YOUR WORD TO DRAW</Text>
            <View style={[s.card, { borderColor: meta.accent + "66" }]}>
              <Text style={[s.cardText, { fontSize: 28, textAlign: "center", color: meta.accent }]}>
                {data.currentPrompt}
              </Text>
            </View>
            <Text style={s.sub}>Draw this on paper or a whiteboard — others are guessing!</Text>
            <Text style={s.sub}>{data.correctGuessers?.length ?? 0} correct so far</Text>
          </>
        )}

        {phase === "drawing" && !isDrawer && !alreadyGuessed && (
          <>
            <Text style={s.eyebrow}>GUESS THE DRAWING</Text>
            <View style={s.rowButtons}>
              <View style={[s.halfBtn, { flex: 1, borderColor: meta.accent + "44" }]}>
                <TextInput
                  style={[s.cardText, { width: "100%", color: "#e5e7eb" }]}
                  placeholder="Type your guess..."
                  placeholderTextColor="#555"
                  value={guess}
                  onChangeText={setGuess}
                  onSubmitEditing={() => {
                    if (guess.trim()) {
                      sendAction("guess", { text: guess.trim() });
                      setGuess("");
                    }
                  }}
                  returnKeyType="send"
                  autoCapitalize="none"
                />
              </View>
            </View>
            <Text style={s.sub}>{data.correctGuessers?.length ?? 0} correct so far</Text>
          </>
        )}

        {phase === "drawing" && !isDrawer && alreadyGuessed && (
          <View style={s.center}>
            <Text style={{ fontSize: 48 }}>✅</Text>
            <Text style={[s.title, { color: "#22c55e" }]}>Correct!</Text>
            <Text style={s.sub}>Waiting for others…</Text>
          </View>
        )}

        {phase === "reveal" && (
          <>
            <Text style={s.eyebrow}>THE WORD WAS</Text>
            <View style={[s.card, { borderColor: meta.accent + "66" }]}>
              <Text style={[s.cardText, { fontSize: 28, textAlign: "center", color: meta.accent }]}>
                {data.currentPrompt}
              </Text>
            </View>
            <Text style={s.sub}>{data.correctGuessers?.length ?? 0} / {(data.guesses ? Object.keys(data.guesses).length : 0)} guessed correctly</Text>
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Would You Rather
// ─────────────────────────────────────────────────────────────────────────────
function WouldYouRatherView({ meta, data, guestId, sendAction }: any) {
  const [voted, setVoted] = useState<"a" | "b" | null>(null);
  const phase = data.phase ?? "waiting";

  function vote(choice: "a" | "b") {
    setVoted(choice);
    sendAction("vote", { choice });
  }

  if (phase === "waiting") return <WaitingCard meta={meta} />;
  if (phase === "finished") return <FinishedCard meta={meta} />;

  return (
    <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
      <View style={[s.header, { borderBottomColor: meta.accent + "33" }]}>
        <Text style={s.headerEmoji}>{meta.emoji}</Text>
        <Text style={[s.headerTitle, { color: meta.accent }]}>{meta.title}</Text>
        <Text style={s.roundPill}>Round {data.round} / {data.totalRounds}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.eyebrow}>WOULD YOU RATHER…</Text>

        {phase === "question" && data.currentQ ? (
          <>
            <TouchableOpacity
              style={[s.choiceBtn, voted === "a" && { borderColor: meta.accent, backgroundColor: meta.accent + "22" }]}
              onPress={() => vote("a")}
            >
              <Text style={s.choiceLabel}>A</Text>
              <Text style={s.choiceText}>{data.currentQ.a}</Text>
              {voted === "a" && <Text style={[s.votedBadge, { color: meta.accent }]}>✓ Your vote</Text>}
            </TouchableOpacity>
            <Text style={s.orText}>— OR —</Text>
            <TouchableOpacity
              style={[s.choiceBtn, voted === "b" && { borderColor: meta.accent, backgroundColor: meta.accent + "22" }]}
              onPress={() => vote("b")}
            >
              <Text style={s.choiceLabel}>B</Text>
              <Text style={s.choiceText}>{data.currentQ.b}</Text>
              {voted === "b" && <Text style={[s.votedBadge, { color: meta.accent }]}>✓ Your vote</Text>}
            </TouchableOpacity>
            {voted && <Text style={s.sub}>Waiting for others… ({data.aCount + data.bCount} voted)</Text>}
          </>
        ) : null}

        {phase === "reveal" && data.currentQ ? (
          <>
            <View style={s.card}>
              <Text style={s.cardText}>{data.currentQ.a}</Text>
              <View style={s.countBar}>
                <View style={[s.countFill, { flex: data.aCount || 1, backgroundColor: meta.accent }]} />
                <View style={[s.countFill, { flex: data.bCount || 1, backgroundColor: "#555" }]} />
              </View>
              <Text style={s.countLabel}>{data.aCount} vs {data.bCount}</Text>
              <Text style={s.cardText}>{data.currentQ.b}</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Never Have I Ever
// ─────────────────────────────────────────────────────────────────────────────
function NeverHaveIEverView({ meta, data, guestId, sendAction }: any) {
  const [responded, setResponded] = useState(false);
  const phase = data.phase ?? "waiting";

  function respond(choice: "have" | "never") {
    setResponded(true);
    sendAction("respond", { response: choice });
  }

  if (phase === "waiting") return <WaitingCard meta={meta} />;
  if (phase === "finished") return <FinishedCard meta={meta} />;

  return (
    <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
      <View style={[s.header, { borderBottomColor: meta.accent + "33" }]}>
        <Text style={s.headerEmoji}>{meta.emoji}</Text>
        <Text style={[s.headerTitle, { color: meta.accent }]}>{meta.title}</Text>
        <Text style={s.roundPill}>Round {data.round} / {data.totalRounds}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.eyebrow}>NEVER HAVE I EVER…</Text>
        {data.currentPrompt ? (
          <View style={s.card}>
            <Text style={s.cardText}>{data.currentPrompt}</Text>
          </View>
        ) : null}

        {phase === "question" && !responded ? (
          <View style={s.rowButtons}>
            <TouchableOpacity style={[s.halfBtn, { borderColor: "#ef4444" }]} onPress={() => respond("have")}>
              <Text style={{ fontSize: 32 }}>🤚</Text>
              <Text style={[s.halfBtnText, { color: "#ef4444" }]}>I Have!</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.halfBtn, { borderColor: "#22c55e" }]} onPress={() => respond("never")}>
              <Text style={{ fontSize: 32 }}>✋</Text>
              <Text style={[s.halfBtnText, { color: "#22c55e" }]}>Never!</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {(responded || phase === "reveal") && (
          <Text style={s.sub}>
            {data.haveCount ?? 0} have • {data.neverCount ?? 0} never
          </Text>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fake News
// ─────────────────────────────────────────────────────────────────────────────
function FakeNewsView({ meta, data, guestId, sendAction }: any) {
  const [voted, setVoted] = useState<"real" | "fake" | null>(null);
  const phase = data.phase ?? "waiting";

  function vote(choice: "real" | "fake") {
    setVoted(choice);
    sendAction("vote", { choice });
  }

  if (phase === "waiting") return <WaitingCard meta={meta} />;
  if (phase === "finished") return <FinishedCard meta={meta} />;

  return (
    <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
      <View style={[s.header, { borderBottomColor: "#dc262633" }]}>
        <Text style={s.headerEmoji}>{meta.emoji}</Text>
        <Text style={[s.headerTitle, { color: "#dc2626" }]}>{meta.title}</Text>
        <Text style={s.roundPill}>Round {data.round} / {data.totalRounds}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {data.currentHeadline ? (
          <>
            <Text style={s.eyebrow}>IS THIS HEADLINE…</Text>
            <View style={s.card}>
              <Text style={s.cardText}>{data.currentHeadline.text ?? data.currentHeadline}</Text>
            </View>
          </>
        ) : null}

        {phase === "question" ? (
          <View style={s.rowButtons}>
            <TouchableOpacity
              style={[s.halfBtn, { borderColor: "#22c55e" }, voted === "real" && { backgroundColor: "#22c55e22" }]}
              onPress={() => vote("real")}
            >
              <Text style={{ fontSize: 32 }}>✅</Text>
              <Text style={[s.halfBtnText, { color: "#22c55e" }]}>Real</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.halfBtn, { borderColor: "#ef4444" }, voted === "fake" && { backgroundColor: "#ef444422" }]}
              onPress={() => vote("fake")}
            >
              <Text style={{ fontSize: 32 }}>❌</Text>
              <Text style={[s.halfBtnText, { color: "#ef4444" }]}>Fake</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {phase === "reveal" && (
          <View style={s.card}>
            <Text style={s.eyebrow}>ANSWER</Text>
            <Text style={[s.cardText, { color: data.currentHeadline?.isReal ? "#22c55e" : "#ef4444", fontSize: 24 }]}>
              {data.currentHeadline?.isReal ? "✅ REAL" : "❌ FAKE"}
            </Text>
            {voted && (
              <Text style={s.sub}>
                You voted {voted} — {voted === (data.currentHeadline?.isReal ? "real" : "fake") ? "Correct! 🎉" : "Wrong 😬"}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Who Knows Who
// ─────────────────────────────────────────────────────────────────────────────
function WhoKnowsWhoView({ meta, data, guestId, sendAction }: any) {
  const [voted, setVoted] = useState<string | null>(null);
  const phase = data.phase ?? "waiting";

  function vote(targetId: string) {
    setVoted(targetId);
    sendAction("vote", { targetId });
  }

  if (phase === "waiting") return <WaitingCard meta={meta} />;
  if (phase === "finished") return <FinishedCard meta={meta} />;

  const options: string[] = data.currentQ?.options ?? data.guestIds ?? [];

  return (
    <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
      <View style={[s.header, { borderBottomColor: meta.accent + "33" }]}>
        <Text style={s.headerEmoji}>{meta.emoji}</Text>
        <Text style={[s.headerTitle, { color: meta.accent }]}>{meta.title}</Text>
        <Text style={s.roundPill}>Round {data.round} / {data.totalRounds}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {data.currentQ?.text ? (
          <View style={s.card}>
            <Text style={s.cardText}>{data.currentQ.text}</Text>
          </View>
        ) : null}

        {phase === "question" && options.map((opt: string) => (
          <TouchableOpacity
            key={opt}
            style={[s.optionBtn, voted === opt && { borderColor: meta.accent, backgroundColor: meta.accent + "22" }]}
            onPress={() => vote(opt)}
            disabled={!!voted}
          >
            <Text style={s.optionText}>{opt}</Text>
            {voted === opt && <Text style={{ color: meta.accent }}>✓</Text>}
          </TouchableOpacity>
        ))}

        {phase === "reveal" && (
          <View style={s.card}>
            <Text style={s.eyebrow}>ANSWER</Text>
            <Text style={[s.cardText, { color: meta.accent }]}>{data.correctAnswer ?? "…"}</Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Two Truths & a Lie
// ─────────────────────────────────────────────────────────────────────────────
function TwoTruthsView({ meta, data, guestId, sendAction }: any) {
  const [voted, setVoted] = useState<number | null>(null);
  const phase = data.phase ?? "waiting";
  const isSubmitter = data.currentSubmitter === guestId;

  function vote(index: number) {
    setVoted(index);
    sendAction("vote", { lieIndex: index });
  }

  if (phase === "waiting") return <WaitingCard meta={meta} />;
  if (phase === "finished") return <FinishedCard meta={meta} />;

  return (
    <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
      <View style={[s.header, { borderBottomColor: meta.accent + "33" }]}>
        <Text style={s.headerEmoji}>{meta.emoji}</Text>
        <Text style={[s.headerTitle, { color: meta.accent }]}>{meta.title}</Text>
        <Text style={s.roundPill}>Round {data.round} / {data.totalRounds}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>

        {phase === "submitting" && (
          <View style={s.center}>
            {isSubmitter ? (
              <>
                <Text style={s.eyebrow}>YOUR TURN</Text>
                <Text style={s.sub}>Tell the host your 2 truths and 1 lie!</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 48 }}>🤔</Text>
                <Text style={s.sub}>{data.currentSubmitter} is thinking of their 2 truths and 1 lie…</Text>
              </>
            )}
          </View>
        )}

        {phase === "voting" && data.facts ? (
          <>
            <Text style={s.eyebrow}>WHICH IS THE LIE?</Text>
            {(data.facts as string[]).map((fact: string, i: number) => (
              <TouchableOpacity
                key={i}
                style={[s.optionBtn, voted === i && { borderColor: "#ef4444", backgroundColor: "#ef444422" }]}
                onPress={() => vote(i)}
                disabled={!!voted || isSubmitter}
              >
                <Text style={s.optionText}>{fact}</Text>
                {voted === i && <Text style={{ color: "#ef4444" }}>LIE?</Text>}
              </TouchableOpacity>
            ))}
            {isSubmitter && <Text style={s.sub}>Wait while others vote…</Text>}
          </>
        ) : null}

        {phase === "reveal" && data.facts ? (
          <>
            <Text style={s.eyebrow}>THE LIE WAS…</Text>
            {(data.facts as string[]).map((fact: string, i: number) => (
              <View key={i} style={[
                s.optionBtn,
                data.lieIndex === i
                  ? { borderColor: "#ef4444", backgroundColor: "#ef444422" }
                  : { borderColor: "#22c55e22" },
              ]}>
                <Text style={s.optionText}>{fact}</Text>
                <Text style={{ color: data.lieIndex === i ? "#ef4444" : "#22c55e" }}>
                  {data.lieIndex === i ? "LIE 🤥" : "TRUTH ✓"}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Truth or Dare
// ─────────────────────────────────────────────────────────────────────────────
function TruthOrDareView({ meta, data, guestId }: any) {
  const phase = data.phase ?? "waiting";
  const isDare = data.currentType === "dare";
  const typeColor = isDare ? "#ef4444" : "#3b82f6";
  const isMyTurn = data.currentPlayer === guestId;

  if (phase === "waiting") return <WaitingCard meta={meta} />;
  if (phase === "finished") return <FinishedCard meta={meta} />;

  return (
    <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
      <View style={[s.header, { borderBottomColor: "#ef444433" }]}>
        <Text style={s.headerEmoji}>{meta.emoji}</Text>
        <Text style={[s.headerTitle, { color: "#ef4444" }]}>{meta.title}</Text>
        <Text style={s.roundPill}>Round {data.round} / {data.totalRounds}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {phase === "spinning" && (
          <View style={s.center}>
            <Text style={{ fontSize: 64 }}>🎡</Text>
            <Text style={s.sub}>Spinning the bottle…</Text>
          </View>
        )}
        {phase === "playing" && (
          <>
            <View style={[s.typeChip, { backgroundColor: typeColor + "22", borderColor: typeColor, alignSelf: "center", marginBottom: 16 }]}>
              <Text style={[s.typeChipText, { color: typeColor }]}>{isDare ? "DARE" : "TRUTH"}</Text>
            </View>
            {data.currentPlayer && (
              <Text style={[s.eyebrow, { textAlign: "center", marginBottom: 8 }]}>
                {isMyTurn ? "YOUR TURN!" : `${data.currentPlayer}'s turn`}
              </Text>
            )}
            {data.currentChallenge && (
              <View style={s.card}>
                <Text style={s.cardText}>{data.currentChallenge}</Text>
              </View>
            )}
            {isMyTurn && (
              <Text style={[s.sub, { color: typeColor, textAlign: "center" }]}>
                {isDare ? "Complete the dare or use a pass!" : "Answer honestly or use a pass!"}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Celebrity Head
// ─────────────────────────────────────────────────────────────────────────────
function CelebrityHeadView({ meta, data, guestId, sendAction }: any) {
  const phase = data.phase ?? "waiting";
  const isMyTurn = data.currentGuestId === guestId;

  if (phase === "waiting") return <WaitingCard meta={meta} />;
  if (phase === "finished") return <FinishedCard meta={meta} />;

  return (
    <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
      <View style={[s.header, { borderBottomColor: meta.accent + "33" }]}>
        <Text style={s.headerEmoji}>{meta.emoji}</Text>
        <Text style={[s.headerTitle, { color: meta.accent }]}>{meta.title}</Text>
        <Text style={s.roundPill}>Round {data.round} / {data.totalRounds}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {isMyTurn ? (
          <>
            <Text style={s.eyebrow}>YOUR TURN — ASK YES/NO QUESTIONS!</Text>
            <View style={s.card}>
              <Text style={s.cardText}>You have a celebrity on your head.</Text>
              <Text style={s.sub}>Ask questions to figure out who you are!</Text>
            </View>
            <Text style={s.sub}>Questions asked: {data.questionsAsked ?? 0}</Text>
          </>
        ) : (
          <>
            <Text style={s.eyebrow}>THEY ARE…</Text>
            <View style={[s.card, { backgroundColor: meta.accent + "22", borderColor: meta.accent }]}>
              <Text style={[s.cardText, { color: meta.accent, fontSize: 28 }]}>
                {data.celebrity ?? "??"}
              </Text>
            </View>
            <Text style={s.sub}>Answer their yes/no questions!</Text>
          </>
        )}

        {phase === "reveal" && (
          <View style={s.card}>
            <Text style={s.eyebrow}>REVEAL</Text>
            <Text style={[s.cardText, { color: meta.accent }]}>{data.celebrity}</Text>
            <Text style={s.sub}>{data.gotIt ? "They got it! 🎉" : "They didn't get it 😅"}</Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Connections
// ─────────────────────────────────────────────────────────────────────────────
function ConnectionsView({ meta, data, guestId, sendAction }: any) {
  const [selected, setSelected] = useState<string[]>([]);
  const phase = data.phase ?? "waiting";
  const puzzle = data.puzzle ?? {};
  const words: string[] = puzzle.words ?? [];

  function toggle(word: string) {
    setSelected(prev =>
      prev.includes(word) ? prev.filter(w => w !== word) : prev.length < 4 ? [...prev, word] : prev
    );
  }

  function submitGroup() {
    if (selected.length !== 4) return;
    sendAction("guess", { words: selected });
    setSelected([]);
  }

  if (phase === "waiting") return <WaitingCard meta={meta} />;
  if (phase === "finished") return <FinishedCard meta={meta} />;

  const lastResult = data.lastResult;

  return (
    <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
      <View style={[s.header, { borderBottomColor: meta.accent + "33" }]}>
        <Text style={s.headerEmoji}>{meta.emoji}</Text>
        <Text style={[s.headerTitle, { color: meta.accent }]}>{meta.title}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.eyebrow}>GROUP 4 WORDS THAT BELONG TOGETHER</Text>

        {lastResult && (
          <View style={[s.card, { borderColor: lastResult.correct ? "#22c55e44" : "#ef444444", marginBottom: 8 }]}>
            <Text style={{ color: lastResult.correct ? "#22c55e" : "#ef4444", fontWeight: "700", textAlign: "center" }}>
              {lastResult.correct ? `✓ ${lastResult.group} — Correct!` : "✗ Try again!"}
            </Text>
          </View>
        )}

        <View style={s.wordsGrid}>
          {words.map((word: string) => (
            <TouchableOpacity
              key={word}
              style={[s.wordBtn, selected.includes(word) && { backgroundColor: meta.accent + "33", borderColor: meta.accent }]}
              onPress={() => toggle(word)}
            >
              <Text style={s.wordText}>{word}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selected.length === 4 ? (
          <TouchableOpacity style={[s.submitBtn, { backgroundColor: meta.accent }]} onPress={submitGroup}>
            <Text style={s.submitBtnText}>Submit Group</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[s.sub, { textAlign: "center" }]}>Select 4 words ({selected.length}/4)</Text>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rank It
// ─────────────────────────────────────────────────────────────────────────────
function RankItView({ meta, data, guestId, sendAction }: any) {
  const phase = data.phase ?? "waiting";
  const challenge = data.currentChallenge;
  const [order, setOrder] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // Reset on new round
  React.useEffect(() => {
    if (challenge?.items) {
      setOrder(challenge.items.map((_: any, i: number) => i));
      setSubmitted(false);
    }
  }, [challenge?.prompt]);

  function moveUp(i: number) {
    if (i === 0) return;
    const next = [...order];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setOrder(next);
  }

  function submit() {
    setSubmitted(true);
    sendAction("rank", { ranking: order });
  }

  if (phase === "waiting") return <WaitingCard meta={meta} />;
  if (phase === "finished") return <FinishedCard meta={meta} />;

  return (
    <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
      <View style={[s.header, { borderBottomColor: meta.accent + "33" }]}>
        <Text style={s.headerEmoji}>{meta.emoji}</Text>
        <Text style={[s.headerTitle, { color: meta.accent }]}>{meta.title}</Text>
        <Text style={s.roundPill}>Round {data.round} / {data.totalRounds}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {phase === "ranking" && challenge ? (
          <>
            <Text style={s.eyebrow}>RANK THESE…</Text>
            <Text style={[s.sub, { marginBottom: 16 }]}>{challenge.prompt}</Text>
            {order.map((itemIdx: number, rank: number) => (
              <TouchableOpacity
                key={itemIdx}
                style={[s.optionBtn, { flexDirection: "row", alignItems: "center" }]}
                onPress={() => moveUp(rank)}
                disabled={submitted}
              >
                <Text style={[s.choiceLabel, { marginRight: 12 }]}>{rank + 1}</Text>
                <Text style={[s.optionText, { flex: 1 }]}>{challenge.items[itemIdx]}</Text>
                {rank > 0 && !submitted && <Text style={{ color: meta.accent }}>↑</Text>}
              </TouchableOpacity>
            ))}
            {!submitted ? (
              <TouchableOpacity style={[s.submitBtn, { backgroundColor: meta.accent }]} onPress={submit}>
                <Text style={s.submitBtnText}>Submit Ranking</Text>
              </TouchableOpacity>
            ) : (
              <Text style={s.sub}>Submitted! Waiting for reveal…</Text>
            )}
          </>
        ) : null}

        {phase === "reveal" && challenge ? (
          <>
            <Text style={s.eyebrow}>CORRECT ORDER</Text>
            {challenge.correctOrder.map((itemIdx: number, rank: number) => (
              <View key={itemIdx} style={[s.optionBtn, { borderColor: "#22c55e44" }]}>
                <Text style={s.choiceLabel}>{rank + 1}</Text>
                <Text style={[s.optionText, { flex: 1 }]}>{challenge.items[itemIdx]}</Text>
                <Text style={{ color: "#22c55e" }}>✓</Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mimic Me
// ─────────────────────────────────────────────────────────────────────────────
function MimicMeView({ meta, data, guestId, sendAction }: any) {
  const [rated, setRated] = useState(false);
  const phase = data.phase ?? "waiting";
  const isPerformer = data.currentPerformer === guestId;

  function rate(score: number) {
    setRated(true);
    sendAction("rate", { score });
  }

  if (phase === "waiting") return <WaitingCard meta={meta} />;
  if (phase === "finished") return <FinishedCard meta={meta} />;

  return (
    <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
      <View style={[s.header, { borderBottomColor: meta.accent + "33" }]}>
        <Text style={s.headerEmoji}>{meta.emoji}</Text>
        <Text style={[s.headerTitle, { color: meta.accent }]}>{meta.title}</Text>
        <Text style={s.roundPill}>Round {data.round} / {data.totalRounds}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {data.action ? (
          <View style={s.card}>
            <Text style={{ fontSize: 64, textAlign: "center" }}>{data.action.emoji}</Text>
            <Text style={s.cardText}>{data.action.instruction}</Text>
          </View>
        ) : null}

        {phase === "studying" && (
          <Text style={s.sub}>Study the action — then mimic it!</Text>
        )}

        {phase === "performing" && (
          isPerformer ? (
            <View style={[s.card, { borderColor: meta.accent }]}>
              <Text style={[s.eyebrow, { color: meta.accent }]}>YOUR TURN — DO THE ACTION!</Text>
              <Text style={s.sub}>Others are watching and will rate you.</Text>
            </View>
          ) : (
            <Text style={s.sub}>Watch {data.currentPerformer} do the action!</Text>
          )
        )}

        {phase === "rating" && !isPerformer && !rated && (
          <>
            <Text style={s.eyebrow}>RATE THE PERFORMANCE</Text>
            <View style={s.rowButtons}>
              {[0, 100, 200, 300].map(score => (
                <TouchableOpacity key={score} style={[s.rateBtn, { borderColor: meta.accent }]} onPress={() => rate(score)}>
                  <Text style={[s.rateBtnText, { color: meta.accent }]}>{score}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {rated && <Text style={s.sub}>Rating submitted! Waiting for others…</Text>}
        {phase === "rating" && isPerformer && <Text style={s.sub}>Waiting for ratings…</Text>}
      </ScrollView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pop Culture Quiz
// ─────────────────────────────────────────────────────────────────────────────
function PopCultureQuizView({ meta, data, guestId, sendAction }: any) {
  const [voted, setVoted] = useState<string | null>(null);
  const phase = data.phase ?? "waiting";

  function vote(choice: string) {
    setVoted(choice);
    sendAction("answer", { answer: choice });
  }

  if (phase === "waiting") return <WaitingCard meta={meta} />;
  if (phase === "finished") return <FinishedCard meta={meta} />;

  const q = data.currentQuestion ?? data.question;

  return (
    <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
      <View style={[s.header, { borderBottomColor: meta.accent + "33" }]}>
        <Text style={s.headerEmoji}>{meta.emoji}</Text>
        <Text style={[s.headerTitle, { color: meta.accent }]}>{meta.title}</Text>
        <Text style={s.roundPill}>Round {data.round} / {data.totalRounds}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {q?.text && (
          <View style={s.card}>
            <Text style={s.cardText}>{q.text}</Text>
          </View>
        )}
        {phase === "question" && q?.options?.map((opt: string) => (
          <TouchableOpacity
            key={opt}
            style={[s.optionBtn, voted === opt && { borderColor: meta.accent, backgroundColor: meta.accent + "22" }]}
            onPress={() => vote(opt)}
            disabled={!!voted}
          >
            <Text style={s.optionText}>{opt}</Text>
            {voted === opt && <Text style={{ color: meta.accent }}>✓</Text>}
          </TouchableOpacity>
        ))}
        {phase === "reveal" && q?.correctAnswer && (
          <View style={[s.card, { borderColor: "#22c55e44" }]}>
            <Text style={s.eyebrow}>CORRECT ANSWER</Text>
            <Text style={[s.cardText, { color: "#22c55e" }]}>{q.correctAnswer}</Text>
            {voted && (
              <Text style={s.sub}>
                {voted === q.correctAnswer ? "You got it! +pts" : `You said: ${voted}`}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function WaitingCard({ meta }: { meta: GameMeta }) {
  return (
    <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
      <View style={s.center}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>{meta.emoji}</Text>
        <Text style={[s.title, { color: meta.accent }]}>{meta.title}</Text>
        <Text style={s.sub}>Waiting for the host to begin…</Text>
      </View>
    </LinearGradient>
  );
}

function FinishedCard({ meta }: { meta: GameMeta }) {
  return (
    <LinearGradient colors={["#0e0024", "#08081a"]} style={s.flex}>
      <View style={s.center}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>🏁</Text>
        <Text style={s.title}>Game Over!</Text>
        <Text style={s.sub}>Thanks for playing {meta.title}!</Text>
      </View>
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  flex:        { flex: 1 },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  body:        { padding: 16, gap: 12 },

  header:      { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerEmoji: { fontSize: 20 },
  headerTitle: { fontSize: 16, fontWeight: "900", flex: 1 },
  roundPill:   { color: "#888", fontSize: 12, fontWeight: "700" },

  title:       { fontSize: 26, fontWeight: "900", color: "#fff", textAlign: "center", marginBottom: 8 },
  sub:         { color: "#888", fontSize: 14, textAlign: "center" },
  eyebrow:     { color: "#666", fontSize: 11, fontWeight: "800", letterSpacing: 2, textAlign: "center" },

  card:        { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", gap: 8 },
  cardText:    { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },

  typeChip:    { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  typeChipText:{ fontSize: 16, fontWeight: "900", letterSpacing: 2 },
  playerLabel: { color: "#888", fontSize: 14, textAlign: "center" },

  choiceBtn:   { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.1)", padding: 16, gap: 4 },
  choiceLabel: { color: "#666", fontSize: 13, fontWeight: "800" },
  choiceText:  { color: "#fff", fontSize: 16, fontWeight: "700" },
  votedBadge:  { fontSize: 12, fontWeight: "800" },

  orText:      { color: "#555", textAlign: "center", fontWeight: "700" },

  countBar:    { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", marginVertical: 8 },
  countFill:   { height: 8 },
  countLabel:  { color: "#888", fontSize: 12, textAlign: "center" },

  rowButtons:  { flexDirection: "row", gap: 12 },
  halfBtn:     { flex: 1, borderRadius: 14, borderWidth: 1.5, padding: 20, alignItems: "center", gap: 8 },
  halfBtnText: { fontSize: 15, fontWeight: "900" },

  optionBtn:   { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", padding: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  optionText:  { color: "#fff", fontSize: 16, fontWeight: "600", flex: 1 },

  wordsGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  wordBtn:     { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", paddingHorizontal: 16, paddingVertical: 12, minWidth: "44%" },
  wordText:    { color: "#fff", fontSize: 14, fontWeight: "700", textAlign: "center" },

  submitBtn:   { borderRadius: 14, padding: 18, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  rateBtn:     { flex: 1, borderRadius: 12, borderWidth: 1.5, padding: 16, alignItems: "center" },
  rateBtnText: { fontSize: 18, fontWeight: "900" },

  // Stub game styles
  phaseChip:     { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start" },
  phaseChipText: { fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  stateBox:      { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 12, gap: 6 },
  stateBoxTitle: { color: "#555", fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 4 },
  stateRow:      { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  stateKey:      { color: "#6b7280", fontSize: 12, fontWeight: "700", minWidth: 90 },
  stateVal:      { flex: 1, color: "#9ca3af", fontSize: 12 },
  stubBtn:       { borderRadius: 12, borderWidth: 1.5, padding: 16, alignItems: "center" },
  stubBtnText:   { fontSize: 16, fontWeight: "900" },
  stubInputRow:  { flexDirection: "row", gap: 8 },
  stubInput: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14, paddingVertical: 12,
    color: "#fff", fontSize: 14,
  },
  stubSendBtn:  { borderRadius: 10, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  stubSendText: { fontSize: 14, fontWeight: "900" },
});
