import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useRoom } from "./useRoom";
import { haptic } from "./haptics";
import { socket } from "./ws";
import type { PlayMode, TriviaAnswer, TriviaDifficulty } from "./types";
import type { WsStatus } from "./ws";
import TriviaGame from "./screens/TriviaGame";
import WYRGame from "./screens/WYRGame";
import GuessimateGame from "./screens/GuessimateGame";
import BuzzerGame from "./screens/BuzzerGame";
import RankItGame from "./screens/RankItGame";
import ConnectionsGame from "./screens/ConnectionsGame";
import GeoGuesserGame from "./screens/GeoGuesserGame";
import TheDraftGame from "./screens/TheDraftGame";
import DrawGame from "./screens/DrawGame";
import WhalabroadGame from "./screens/WhalabroadGame";
import "./App.css";

// ─── Connection guard ─────────────────────────────────────────────────────────

function useWsStatus(): WsStatus {
  const [status, setStatus] = useState<WsStatus>(socket.status);
  useEffect(() => socket.onStatus(setStatus), []);
  return status;
}

function ConnectingScreen() {
  const [slow, setSlow] = useState(false);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setSlow(true), 4000);
    const t2 = setTimeout(() => setStuck(true), 30000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const isLocalhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  return (
    <div className="connect-screen">
      <div className="connect-spinner" />
      <p className="connect-label">Connecting to the Box…</p>
      {slow && !stuck && <p className="connect-hint">Taking longer than usual. Is the server running?</p>}
      {stuck && (
        <div className="connect-diagnostic">
          <p><strong>Can't reach the host.</strong></p>
          <p style={{ marginTop: 6 }}>
            Trying: <code>{typeof window !== "undefined" ? window.location.host : ""}</code>
          </p>
          {isLocalhost && (
            <p style={{ marginTop: 8, color: "#ffaaaa" }}>
              You opened this from <code>localhost</code> on this device. Phones can't reach localhost — open the host's network IP instead (something like <code>192.168.1.X:8080</code>).
            </p>
          )}
          {!isLocalhost && (
            <p style={{ marginTop: 8 }}>
              Check that the tablet's server is running, that you're on the same WiFi, and that the URL is right.
            </p>
          )}
          <button className="connect-retry-btn" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}
    </div>
  );
}

function DisconnectedScreen() {
  return (
    <div className="connect-screen">
      <div className="connect-icon">📡</div>
      <p className="connect-label">Lost connection</p>
      <p className="connect-hint">Reconnecting automatically…</p>
    </div>
  );
}

// ─── Hub ─────────────────────────────────────────────────────────────────────

type HubCard = "party" | "whalabroad" | "scores";

function Hub({ roomHook }: { roomHook: ReturnType<typeof useRoom> }) {
  const [activeCard, setActiveCard] = useState<HubCard | null>(() => {
    if (localStorage.getItem("pg_play_again") === "1") {
      localStorage.removeItem("pg_play_again");
      return "party";
    }
    if (new URLSearchParams(window.location.search).get("join")) return "party";
    return null;
  });
  const [closing, setClosing] = useState(false);

  function openCard(card: HubCard) {
    haptic.tap();
    setClosing(false);
    setActiveCard(card);
  }

  function closeCard() {
    haptic.tap();
    setClosing(true);
    setTimeout(() => { setActiveCard(null); setClosing(false); }, 200);
  }

  return (
    <div className="hub">
      <div className="hub-card hub-party" onClick={() => openCard("party")}>
        <div className="hub-card-body">
          <span className="hub-card-eyebrow">GAMES</span>
          <h1 className="hub-card-title">PARTY<br />ROOM</h1>
        </div>
        <div className="hub-card-glow party-glow" />
      </div>

      <div className="hub-card hub-retro" onClick={() => openCard("whalabroad")}>
        {/* Layered art: hero whale background + ship sprite cropped from
            the ship-red-sheet atlas + a wave gradient + a subtle moonlit
            tint, all behind the title. */}
        <div className="hub-retro-water" aria-hidden="true" />
        <img className="hub-retro-whale"
             src="/whalabroad/raw/whale-idle-surfaced.png"
             alt=""
             aria-hidden="true"
             loading="lazy" />
        <div className="hub-retro-ship" aria-hidden="true" />
        <div className="hub-retro-vignette" aria-hidden="true" />
        <div className="hub-card-body">
          <span className="hub-card-eyebrow">STRATEGY · ASYMMETRIC NAVAL</span>
          <h2 className="hub-card-title hub-retro-title">WHALA<br />BROAD</h2>
          <p className="hub-card-sub">🐋 vs ⛵⛵⛵ — frenemy, then race.</p>
        </div>
        <div className="hub-card-glow retro-glow" />
      </div>

      <div className="hub-card hub-scores" onClick={() => openCard("scores")}>
        <div className="hub-card-body">
          <span className="hub-card-eyebrow">ALL TIME</span>
          <h2 className="hub-card-title">SCORES</h2>
          <p className="hub-card-sub">Leaderboard + custom deck</p>
        </div>
        <div className="hub-card-glow scores-glow" />
      </div>

      {activeCard === "party" && (
        <div className={`hub-expanded hub-expanded-party ${closing ? "hub-closing" : ""}`}>
          <PartyRoomView roomHook={roomHook} onClose={closeCard} />
        </div>
      )}
      {activeCard === "whalabroad" && (
        <div className={`hub-expanded hub-expanded-retro ${closing ? "hub-closing" : ""}`}>
          <PartyRoomView roomHook={roomHook} onClose={closeCard} lockedExperience="whalabroad" />
        </div>
      )}
      {activeCard === "scores" && (
        <div className={`hub-expanded hub-expanded-scores ${closing ? "hub-closing" : ""}`}>
          <ScoresView onClose={closeCard} />
        </div>
      )}
      {!activeCard && (
        <div className="version-stamp">box · {__BUILD_TIME__.slice(0, 16).replace("T", " ")}</div>
      )}
    </div>
  );
}

// ─── Party Room ───────────────────────────────────────────────────────────────

const MODES: { id: PlayMode; label: string; desc: string; icon: string }[] = [
  { id: "host_tablet", label: "Tablet + Phones", desc: "Tablet shows the question, phones answer", icon: "📺" },
  { id: "phones_only", label: "Phone Host",      desc: "Host runs the game from their phone, tablet shows the lobby", icon: "📱" },
  { id: "pass_tablet", label: "Pass the Tablet", desc: "One device, take turns", icon: "🔄" },
];

interface Experience {
  id: string;
  label: string;
  desc: string;
  icon: string;
  summary: string;
  rules: string[];
  // Hidden experiences are NOT shown in the Party Room grid but ARE
  // listed here so PartyRoomView's pickedGame lookup works when entered
  // via a hub card (e.g. Whalabroad's top-level card).
  hidden?: boolean;
}

const EXPERIENCES: Experience[] = [
  {
    id: "trivia", label: "Trivia", icon: "🧠",
    desc: "2,869 Qs · 7 categories · 5-round tournament",
    summary: "Multiple-choice trivia. Tap your answer fast — speed earns bonus points.",
    rules: [
      "20s per question (15s in Hard / Sudden Death)",
      "Score = base (by difficulty) + speed bonus + streak bonus",
      "Tournament mode runs 5 rounds with different scoring",
      "Sudden Death: one wrong answer eliminates you",
    ],
  },
  {
    id: "wyr", label: "Would You Rather", icon: "⚡",
    desc: "417 dilemmas · bold vs safe",
    summary: "Two impossible choices. Pick the one most others won't.",
    rules: [
      "30 second timer per dilemma",
      "Voting with the majority = SAFE (50 pts)",
      "Voting with the minority = BOLD (150 pts)",
      "Ties split the room — everyone gets 75",
    ],
  },
  {
    id: "guesstimate", label: "Guesstimate", icon: "🎯",
    desc: "300+ Qs · how close can you get?",
    summary: "How tall? How many? Type your numeric guess — closest wins.",
    rules: [
      "Type a number; closer to the real answer = more points (max 1000)",
      "Score scales linearly with how close you are",
      "Everyone submits before the reveal",
      "20s per question",
    ],
  },
  {
    id: "buzzer", label: "Buzzer Round", icon: "🔔",
    desc: "First to buzz wins · 2,869 question pool",
    summary: "Question appears, hit BUZZ first to lock in the answer.",
    rules: [
      "Anyone can buzz; first to buzz answers",
      "Right answer = 1000 pts, wrong = -200 + locked out",
      "If everyone locks out, question is skipped",
      "Pulls from the same trivia bank as Trivia",
    ],
  },
  {
    id: "rankit", label: "Rank It", icon: "📊",
    desc: "100+ challenges · put it in order",
    summary: "Tap items in the right order — by population, height, year, whatever the prompt asks.",
    rules: [
      "Tap items in the order you think is correct",
      "Points awarded for each correct position",
      "All players submit, then reveal",
      "25s per challenge",
    ],
  },
  {
    id: "connections", label: "Connections", icon: "🔗",
    desc: "50+ puzzles · 4 groups of 4",
    summary: "16 tiles, 4 hidden categories. Find groups of 4 that belong together.",
    rules: [
      "Tap 4 tiles you think share a theme, then submit",
      "Correct group locks in, wrong = strike (4 strikes = out)",
      "Yellow=easy, Green=medium, Blue=hard, Purple=expert",
      "Score by group difficulty: 100 / 200 / 300 / 400",
    ],
  },
  {
    id: "geoguesser", label: "GeoGuesser", icon: "🌍",
    desc: "120 photos + clues · where in the world?",
    summary: "See a real photo of a landmark. Drop a pin on the world map.",
    rules: [
      "Tap the world map where you think the photo is",
      "Closer = more points (5000 max, scales by km distance)",
      "30s per photo",
      "8 photos per game, mixed difficulty",
    ],
  },
  {
    id: "thedraft", label: "The Draft", icon: "🃏",
    desc: "25 scenarios · hidden values",
    summary: "Pick from a list — but the value of each pick is hidden until everyone's done.",
    rules: [
      "Snake draft order, no time limit (talk it out)",
      "Each item has a hidden score (0–100)",
      "Highest combined picks wins",
      "24 different scenarios: heist crews, road trip songs, Avengers, etc.",
    ],
  },
  {
    id: "draw", label: "Draw It", icon: "✏️",
    desc: "1,200+ words · 4 difficulty tiers",
    summary: "One person draws on the tablet, everyone else guesses on their phones.",
    rules: [
      "60s timer per round; drawer can't write letters or numbers",
      "First to type the word correctly = 1000 pts",
      "Drawer also scores when their word is guessed",
      "Difficulty tiers from 'banana' to 'Justice' (Impossible)",
    ],
  },
  // Whalabroad is hidden from the party-room grid (it has its own top-level
  // hub card) but listed so PartyRoomView's pickedGame lookup resolves and
  // STEP 2 of the room-creation flow renders.
  {
    id: "whalabroad", label: "Whalabroad", icon: "🐋",
    desc: "1 whale vs 2-7 ships · asymmetric naval",
    summary: "One player is the white whale, the rest are whalers. Hunt or be hunted.",
    rules: [
      "Whalers hunt the whale together — but only one wins by towing the carcass to harbor",
      "Whale wins if every ship is sunk",
      "Hidden movement: the whale's exact position is fogged when underwater",
      "8-direction grid, octagonal board, turn-based",
      "Storm at turn 20 — outer ring becomes impassable",
    ],
    hidden: true,
  },
];

// ─── Mode Carousel — single-card carousel; reusable across all 9 games ──────

function ModeCarousel({ mode, setMode }: { mode: PlayMode; setMode: (m: PlayMode) => void }) {
  const idx = Math.max(0, MODES.findIndex(m => m.id === mode));
  const touchStartX = useRef<number | null>(null);

  function go(delta: number) {
    haptic.tap();
    const next = (idx + delta + MODES.length) % MODES.length;
    setMode(MODES[next].id);
  }
  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) go(dx > 0 ? -1 : 1);
    touchStartX.current = null;
  }

  const cur = MODES[idx];
  return (
    <div className="mode-carousel">
      <button className="mode-carousel-arrow" aria-label="Previous mode" onClick={() => go(-1)}>‹</button>
      <div className="mode-carousel-card"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        key={cur.id}>
        <span className="mode-carousel-icon">{cur.icon}</span>
        <span className="mode-carousel-label">{cur.label}</span>
        <span className="mode-carousel-desc">{cur.desc}</span>
      </div>
      <button className="mode-carousel-arrow" aria-label="Next mode" onClick={() => go(1)}>›</button>
      <div className="mode-carousel-dots">
        {MODES.map((m, i) => (
          <span key={m.id}
            className={`mode-carousel-dot ${i === idx ? "active" : ""}`}
            onClick={() => { haptic.tap(); setMode(m.id); }} />
        ))}
      </div>
    </div>
  );
}

function PartyRoomView({ roomHook, onClose, lockedExperience }: { roomHook: ReturnType<typeof useRoom>; onClose: () => void; lockedExperience?: string }) {
  const { error, createRoom, joinRoom } = roomHook;
  const urlCode = new URLSearchParams(window.location.search).get("join") ?? "";
  const [tab, setTab] = useState<"host" | "join">(urlCode ? "join" : "host");
  const [displayName, setDisplayName] = useState(localStorage.getItem("pg_display_name") ?? "");
  const [mode, setMode] = useState<PlayMode>("host_tablet");
  // When opened from a hub card with a pre-locked experience (e.g. Whalabroad),
  // skip the game-pick step and go straight to mode + name.
  const [experience, setExperience] = useState<string | null>(lockedExperience ?? null);
  const [previewing, setPreviewing] = useState<Experience | null>(null);  // rules-modal target
  const [code, setCode] = useState(urlCode);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (error) setLoading(false); }, [error]);

  function saveName(v: string) {
    setDisplayName(v);
    localStorage.setItem("pg_display_name", v);
  }

  const pickedGame = experience ? EXPERIENCES.find(e => e.id === experience) : null;

  return (
    <div className="party-view">
      <button className="expanded-back" onClick={() => {
        // Locked experience (hub card entry point) — back goes straight to hub.
        if (lockedExperience) { onClose(); return; }
        if (experience) { setExperience(null); } else { onClose(); }
      }}>
        ← Back
      </button>

      <div className="party-tabs">
        <button className={`party-tab ${tab === "host" ? "active" : ""}`}
          onClick={() => { haptic.tap(); setTab("host"); if (!lockedExperience) setExperience(null); }}>
          Host a Game
        </button>
        <button className={`party-tab ${tab === "join" ? "active" : ""}`}
          onClick={() => { haptic.tap(); setTab("join"); }}>
          Join a Game
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {/* HOST · STEP 1 — pick a game */}
      {tab === "host" && !experience && (
        <div className="party-form">
          <div className="form-section-label">PICK A GAME</div>
          <div className="exp-grid exp-grid-color">
            {EXPERIENCES.filter(e => !e.hidden).map(e => (
              <button key={e.id}
                className={`exp-tile-color exp-color-${e.id}`}
                onClick={() => { haptic.tap(); setPreviewing(e); }}>
                <span className={`exp-label-color exp-title-${e.id}`}>{e.label}</span>
                <span className="exp-desc-color">{e.desc}</span>
                <span className="exp-card-glow" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RULES / SUMMARY MODAL */}
      {previewing && (
        <div className="rules-modal-backdrop" onClick={() => setPreviewing(null)}>
          <div className={`rules-modal exp-color-${previewing.id}`} onClick={e => e.stopPropagation()}>
            <span className="rules-modal-glow" />
            <div className={`rules-modal-title exp-title-${previewing.id}`}>{previewing.label}</div>
            <div className="rules-modal-summary">{previewing.summary}</div>
            <div className="rules-modal-rules-label">RULES</div>
            <ul className="rules-modal-rules">
              {previewing.rules.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <div className="rules-modal-actions">
              <button className="rules-modal-back" onClick={() => { haptic.tap(); setPreviewing(null); }}>
                Back
              </button>
              <button className="rules-modal-pick" onClick={() => { haptic.heavy(); setExperience(previewing.id); setPreviewing(null); }}>
                Pick this →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HOST · STEP 2 — pick mode + name + Let's Go */}
      {tab === "host" && experience && pickedGame && (
        <div className="party-form party-form-step2">
          <div className="picked-game-banner">
            <span className="picked-game-icon">{pickedGame.icon}</span>
            <div className="picked-game-text">
              <span className="picked-game-eyebrow">PLAYING</span>
              <span className="picked-game-label">{pickedGame.label}</span>
            </div>
            <button className="picked-game-change" onClick={() => { haptic.tap(); setExperience(null); }}>Change</button>
          </div>

          <div className="form-section-label">MODE</div>
          <ModeCarousel mode={mode} setMode={setMode} />

          <input className="name-input" placeholder="Your name"
            value={displayName} maxLength={20}
            onChange={e => saveName(e.target.value)} />

          <button className="lets-go-btn"
            disabled={!displayName.trim() || loading}
            onClick={() => { haptic.heavy(); setLoading(true); createRoom(displayName.trim(), mode, experience); }}>
            {loading ? "Starting…" : "Let's Go →"}
          </button>
        </div>
      )}

      {tab === "join" && (
        <div className="party-form">
          {urlCode && !displayName && (
            <p className="join-hint-qr">Enter your name to join room <strong>{urlCode}</strong></p>
          )}
          <input className="name-input" placeholder="Your name"
            value={displayName} maxLength={20}
            onChange={e => saveName(e.target.value)} />
          <input className="code-input" placeholder="ABCD"
            value={code} maxLength={4}
            onChange={e => setCode(e.target.value.toUpperCase())} />
          <button className="lets-go-btn"
            disabled={!displayName.trim() || code.length < 4 || loading}
            onClick={() => { haptic.heavy(); setLoading(true); joinRoom(code, displayName.trim()); }}>
            {loading ? "Joining…" : "Join →"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Scores View ──────────────────────────────────────────────────────────────

type ScoreRow = { guestId: string; displayName: string; totalScore: number; gamesPlayed: number; bestScore: number; totalCorrect: number };

function ScoresView({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"leaderboard" | "custom">("leaderboard");
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/scores")
      .then(r => r.json())
      .then(d => { setScores(d.scores ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="scores-view">
      <button className="expanded-back" onClick={onClose}>← Back</button>
      <div className="party-tabs">
        <button className={`party-tab ${tab === "leaderboard" ? "active" : ""}`}
          onClick={() => { haptic.tap(); setTab("leaderboard"); }}>Leaderboard</button>
        <button className={`party-tab ${tab === "custom" ? "active" : ""}`}
          onClick={() => { haptic.tap(); setTab("custom"); }}>Custom Deck</button>
      </div>
      {tab === "leaderboard" && (
        <div className="leaderboard">
          {loading && <p className="scores-empty">Loading…</p>}
          {!loading && scores.length === 0 && (
            <p className="scores-empty">No games recorded yet.<br />Play a round to see the leaderboard.</p>
          )}
          {scores.map((s, i) => (
            <div key={s.guestId} className="lb-row">
              <span className="lb-rank">#{i + 1}</span>
              <div className="lb-player">
                <span className="lb-name">{s.displayName}</span>
                <span className="lb-meta">{s.gamesPlayed} game{s.gamesPlayed !== 1 ? "s" : ""} · best {s.bestScore.toLocaleString()}</span>
              </div>
              <span className="lb-score">{s.totalScore.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {tab === "custom" && <CustomDeckBuilder />}
    </div>
  );
}

// ─── Custom Deck Builder ──────────────────────────────────────────────────────

const DIFFICULTY_OPTIONS: TriviaDifficulty[] = ["easy", "medium", "hard", "extreme"];

type GameType =
  | "trivia" | "wyr" | "buzzer" | "guesstimate"
  | "rankit" | "draw" | "geoguesser" | "connections" | "thedraft";

const GAME_OPTIONS: { id: GameType; label: string; icon: string; persist: "db" | "draft" }[] = [
  { id: "trivia",      label: "Trivia",            icon: "🧠", persist: "db"    },
  { id: "wyr",         label: "Would You Rather",  icon: "⚡", persist: "db"    },
  { id: "buzzer",      label: "Buzzer",            icon: "🔔", persist: "db"    },  // shares trivia bank
  { id: "guesstimate", label: "Guesstimate",       icon: "🎯", persist: "draft" },
  { id: "rankit",      label: "Rank It",           icon: "📊", persist: "draft" },
  { id: "draw",        label: "Draw It",           icon: "✏️", persist: "draft" },
  { id: "geoguesser",  label: "GeoGuesser (clue)", icon: "🌍", persist: "draft" },
  { id: "connections", label: "Connections",       icon: "🔗", persist: "draft" },
  { id: "thedraft",    label: "The Draft",         icon: "🃏", persist: "draft" },
];

function CustomDeckBuilder() {
  const [gameType, setGameType] = useState<GameType>("trivia");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Trivia / Buzzer fields
  const [question, setQuestion] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [c, setC] = useState("");
  const [d, setD] = useState("");
  const [correct, setCorrect] = useState<TriviaAnswer>("a");
  const [difficulty, setDifficulty] = useState<TriviaDifficulty>("medium");

  // WYR fields
  const [wyrA, setWyrA] = useState("");
  const [wyrB, setWyrB] = useState("");
  const [wyrCategory, setWyrCategory] = useState("Lifestyle");

  // Guesstimate fields
  const [guessQ, setGuessQ] = useState("");
  const [guessAnswer, setGuessAnswer] = useState("");
  const [guessUnit, setGuessUnit] = useState("");

  // Rank It fields
  const [rankQ, setRankQ] = useState("");
  const [rankItems, setRankItems] = useState<string[]>(["", "", "", ""]);

  // Draw It fields
  const [drawWord, setDrawWord] = useState("");
  const [drawTier, setDrawTier] = useState<"easy" | "medium" | "hard" | "impossible">("medium");

  // GeoGuesser-clue fields
  const [geoClues, setGeoClues] = useState<string[]>(["", "", ""]);
  const [geoChoices, setGeoChoices] = useState<string[]>(["", "", "", ""]);
  const [geoCorrect, setGeoCorrect] = useState("");

  // Connections fields (4 groups × 4 items)
  const [connGroups, setConnGroups] = useState<{ category: string; items: string[] }[]>([
    { category: "", items: ["", "", "", ""] },
    { category: "", items: ["", "", "", ""] },
    { category: "", items: ["", "", "", ""] },
    { category: "", items: ["", "", "", ""] },
  ]);

  // The Draft fields
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSubtitle, setDraftSubtitle] = useState("");
  const [draftItems, setDraftItems] = useState<string[]>(["", "", "", "", "", "", "", ""]);

  function reset() {
    setQuestion(""); setA(""); setB(""); setC(""); setD("");
    setWyrA(""); setWyrB("");
    setGuessQ(""); setGuessAnswer(""); setGuessUnit("");
    setRankQ(""); setRankItems(["", "", "", ""]);
    setDrawWord("");
    setGeoClues(["", "", ""]); setGeoChoices(["", "", "", ""]); setGeoCorrect("");
    setConnGroups([
      { category: "", items: ["", "", "", ""] },
      { category: "", items: ["", "", "", ""] },
      { category: "", items: ["", "", "", ""] },
      { category: "", items: ["", "", "", ""] },
    ]);
    setDraftTitle(""); setDraftSubtitle(""); setDraftItems(["", "", "", "", "", "", "", ""]);
  }

  async function postAndHandle(url: string, body: any) {
    setStatus("saving");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 201 || r.status === 204) {
        setStatus("saved");
        reset();
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  function save() {
    haptic.tap();
    switch (gameType) {
      case "trivia":
      case "buzzer": {
        if (!question.trim() || !a.trim() || !b.trim() || !c.trim() || !d.trim()) return;
        postAndHandle("/api/questions", { question, a, b, c, d, correct, difficulty });
        break;
      }
      case "wyr": {
        if (!wyrA.trim() || !wyrB.trim()) return;
        postAndHandle("/api/wyr-prompts", { optionA: wyrA, optionB: wyrB, category: wyrCategory });
        break;
      }
      case "guesstimate": {
        if (!guessQ.trim() || !guessAnswer.trim()) return;
        postAndHandle("/api/draft-content", {
          gameType, payload: { question: guessQ, answer: parseFloat(guessAnswer), unit: guessUnit },
        });
        break;
      }
      case "rankit": {
        if (!rankQ.trim() || rankItems.some(i => !i.trim())) return;
        postAndHandle("/api/draft-content", {
          gameType, payload: { q: rankQ, items: rankItems, correct: rankItems },
        });
        break;
      }
      case "draw": {
        if (!drawWord.trim()) return;
        postAndHandle("/api/draft-content", { gameType, payload: { word: drawWord, tier: drawTier } });
        break;
      }
      case "geoguesser": {
        if (!geoCorrect.trim() || geoClues.some(c => !c.trim()) || geoChoices.some(c => !c.trim())) return;
        if (!geoChoices.includes(geoCorrect)) return;
        postAndHandle("/api/draft-content", {
          gameType, payload: { clues: geoClues, choices: geoChoices, correct: geoCorrect },
        });
        break;
      }
      case "connections": {
        const valid = connGroups.every(g => g.category.trim() && g.items.every(i => i.trim()));
        if (!valid) return;
        postAndHandle("/api/draft-content", {
          gameType,
          payload: { groups: connGroups.map((g, i) => ({
            color: ["yellow", "green", "blue", "purple"][i],
            category: g.category,
            items: g.items,
          })) },
        });
        break;
      }
      case "thedraft": {
        if (!draftTitle.trim() || draftItems.some(i => !i.trim())) return;
        postAndHandle("/api/draft-content", {
          gameType, payload: { title: draftTitle, subtitle: draftSubtitle, items: draftItems },
        });
        break;
      }
    }
  }

  const currentGame = GAME_OPTIONS.find(g => g.id === gameType)!;
  const isDraft = currentGame.persist === "draft";

  return (
    <div className="custom-deck">
      {/* Game type dropdown */}
      <div className="custom-game-picker">
        <label className="custom-game-picker-label">GAME</label>
        <select className="custom-game-select"
          value={gameType}
          onChange={e => { haptic.tap(); setGameType(e.target.value as GameType); setStatus("idle"); }}>
          {GAME_OPTIONS.map(g => (
            <option key={g.id} value={g.id}>{g.icon}  {g.label}</option>
          ))}
        </select>
      </div>

      <p className="custom-deck-info">
        {gameType === "trivia" && "Trivia entries go into the Custom category and play in any Trivia round."}
        {gameType === "buzzer" && "Buzzer pulls from the Trivia bank — your question will appear in both."}
        {gameType === "wyr" && "Would You Rather prompts persist immediately to the WYR pool."}
        {isDraft && (
          <span style={{ display: "block", marginTop: 6, color: "var(--text-muted)" }}>
            ⓘ Saved as draft — captured to the server log so you can batch-import to seed JSON later.
          </span>
        )}
      </p>

      <div className="custom-form">
        {/* TRIVIA / BUZZER */}
        {(gameType === "trivia" || gameType === "buzzer") && (
          <>
            <textarea className="custom-question-input" placeholder="Question text"
              value={question} maxLength={300} rows={3}
              onChange={e => setQuestion(e.target.value)} />
            {(["a", "b", "c", "d"] as TriviaAnswer[]).map(key => (
              <div key={key} className="custom-answer-row">
                <button
                  className={`custom-correct-btn ${correct === key ? "correct-selected" : ""}`}
                  onClick={() => { haptic.tap(); setCorrect(key); }}
                  title="Mark as correct">
                  {key.toUpperCase()}
                </button>
                <input className="custom-answer-input" placeholder={`Option ${key.toUpperCase()}`}
                  value={key === "a" ? a : key === "b" ? b : key === "c" ? c : d}
                  maxLength={120}
                  onChange={e => {
                    const v = e.target.value;
                    if (key === "a") setA(v); else if (key === "b") setB(v);
                    else if (key === "c") setC(v); else setD(v);
                  }} />
              </div>
            ))}
            <div className="custom-difficulty-row">
              {DIFFICULTY_OPTIONS.map(diff => (
                <button key={diff}
                  className={`diff-chip ${difficulty === diff ? "diff-selected" : ""}`}
                  onClick={() => { haptic.tap(); setDifficulty(diff); }}>
                  {diff}
                </button>
              ))}
            </div>
          </>
        )}

        {/* WYR */}
        {gameType === "wyr" && (
          <>
            <input className="custom-answer-input" placeholder="Option A — would you rather…"
              value={wyrA} maxLength={120} onChange={e => setWyrA(e.target.value)} />
            <div className="custom-vs">vs</div>
            <input className="custom-answer-input" placeholder="Option B — or would you rather…"
              value={wyrB} maxLength={120} onChange={e => setWyrB(e.target.value)} />
            <input className="custom-answer-input" placeholder="Category (e.g. Food, Lifestyle, Money)"
              value={wyrCategory} maxLength={40} onChange={e => setWyrCategory(e.target.value)} />
          </>
        )}

        {/* GUESSTIMATE */}
        {gameType === "guesstimate" && (
          <>
            <textarea className="custom-question-input" placeholder="Question — the answer must be a number"
              value={guessQ} maxLength={300} rows={2}
              onChange={e => setGuessQ(e.target.value)} />
            <div className="custom-row-2">
              <input className="custom-answer-input" placeholder="Numeric answer"
                value={guessAnswer} maxLength={20} inputMode="numeric"
                onChange={e => setGuessAnswer(e.target.value)} />
              <input className="custom-answer-input" placeholder="Unit (m, ft, years, …)"
                value={guessUnit} maxLength={20}
                onChange={e => setGuessUnit(e.target.value)} />
            </div>
          </>
        )}

        {/* RANK IT */}
        {gameType === "rankit" && (
          <>
            <textarea className="custom-question-input" placeholder="Prompt — e.g. 'Rank by population'"
              value={rankQ} maxLength={200} rows={2}
              onChange={e => setRankQ(e.target.value)} />
            <p className="custom-hint">List items in <strong>correct order</strong> (top = #1):</p>
            {rankItems.map((it, i) => (
              <div key={i} className="custom-answer-row">
                <span className="custom-rank-num">{i + 1}</span>
                <input className="custom-answer-input" placeholder={`Item ${i + 1}`}
                  value={it} maxLength={80}
                  onChange={e => setRankItems(rs => rs.map((r, j) => j === i ? e.target.value : r))} />
              </div>
            ))}
          </>
        )}

        {/* DRAW IT */}
        {gameType === "draw" && (
          <>
            <input className="custom-answer-input" placeholder="Word to draw (e.g. 'lighthouse')"
              value={drawWord} maxLength={40}
              onChange={e => setDrawWord(e.target.value)} />
            <div className="custom-difficulty-row">
              {(["easy", "medium", "hard", "impossible"] as const).map(t => (
                <button key={t}
                  className={`diff-chip ${drawTier === t ? "diff-selected" : ""}`}
                  onClick={() => { haptic.tap(); setDrawTier(t); }}>
                  {t}
                </button>
              ))}
            </div>
          </>
        )}

        {/* GEOGUESSER (text-clue mode) */}
        {gameType === "geoguesser" && (
          <>
            <p className="custom-hint">Three clues, easiest last:</p>
            {geoClues.map((cl, i) => (
              <input key={i} className="custom-answer-input" placeholder={`Clue ${i + 1}`}
                value={cl} maxLength={140}
                onChange={e => setGeoClues(cs => cs.map((c, j) => j === i ? e.target.value : c))} />
            ))}
            <p className="custom-hint" style={{ marginTop: 10 }}>Four answer choices:</p>
            {geoChoices.map((ch, i) => (
              <input key={i} className="custom-answer-input" placeholder={`Choice ${i + 1}`}
                value={ch} maxLength={60}
                onChange={e => setGeoChoices(cs => cs.map((c, j) => j === i ? e.target.value : c))} />
            ))}
            <p className="custom-hint" style={{ marginTop: 10 }}>Correct choice (must match one above):</p>
            <input className="custom-answer-input" placeholder="Type the correct choice exactly"
              value={geoCorrect} maxLength={60}
              onChange={e => setGeoCorrect(e.target.value)} />
          </>
        )}

        {/* CONNECTIONS */}
        {gameType === "connections" && (
          <>
            <p className="custom-hint">4 categories × 4 items each. Color difficulty: yellow easy → purple expert.</p>
            {connGroups.map((g, gi) => {
              const color = ["yellow", "green", "blue", "purple"][gi];
              const tier = ["⭐ Easy", "🟢 Medium", "🔵 Hard", "🟣 Expert"][gi];
              return (
                <div key={gi} className="custom-conn-group">
                  <div className="custom-conn-tier">{tier}</div>
                  <input className="custom-answer-input" placeholder="Category (e.g. 'Things that are red')"
                    value={g.category} maxLength={80}
                    onChange={e => setConnGroups(gs => gs.map((x, j) => j === gi ? { ...x, category: e.target.value } : x))} />
                  <div className="custom-conn-items">
                    {g.items.map((it, ii) => (
                      <input key={ii} className="custom-answer-input" placeholder={`Item ${ii + 1}`}
                        value={it} maxLength={60}
                        onChange={e => setConnGroups(gs => gs.map((x, j) => j === gi ? { ...x, items: x.items.map((y, k) => k === ii ? e.target.value : y) } : x))} />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* THE DRAFT */}
        {gameType === "thedraft" && (
          <>
            <input className="custom-answer-input" placeholder="Scenario title (e.g. 'Draft Your Heist Crew')"
              value={draftTitle} maxLength={80}
              onChange={e => setDraftTitle(e.target.value)} />
            <input className="custom-answer-input" placeholder="Subtitle / pick rules"
              value={draftSubtitle} maxLength={140}
              onChange={e => setDraftSubtitle(e.target.value)} />
            <p className="custom-hint">8 items to draft from:</p>
            {draftItems.map((it, i) => (
              <input key={i} className="custom-answer-input" placeholder={`Item ${i + 1}`}
                value={it} maxLength={60}
                onChange={e => setDraftItems(ts => ts.map((x, j) => j === i ? e.target.value : x))} />
            ))}
          </>
        )}

        <button className="lets-go-btn" disabled={status === "saving"} onClick={save}>
          {status === "saving" ? "Saving…" : status === "saved" ? "✓ Saved!" : status === "error" ? "Error — try again" : (isDraft ? "Save Draft" : "Add")}
        </button>
      </div>
    </div>
  );
}

// ─── Waiting Room ─────────────────────────────────────────────────────────────

function WaitingRoom({ roomHook }: { roomHook: ReturnType<typeof useRoom> }) {
  const { room, you, members, guestId, error, startGame, kickGuest, transferToken } = roomHook;
  const [loading, setLoading] = useState(false);
  const [draftRounds, setDraftRounds] = useState(2);
  const isHost = you?.role === "host";

  useEffect(() => { if (error) setLoading(false); }, [error]);

  if (!room) return null;

  const expLabel = EXPERIENCES.find(e => e.id === room.experience)?.label ?? room.experience;
  const joinUrl = `http://${window.location.host}?join=${room.code}`;
  const takeoverUrl = transferToken
    ? `http://${window.location.host}?join=${room.code}&takeover=${transferToken}`
    : null;
  const hostIsLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const showTakeover = isHost && room.mode === "phones_only" && !!takeoverUrl;

  return (
    <div className="waiting-room">
      {showTakeover ? (
        <>
          <div className="waiting-qr-block waiting-takeover">
            <div className="waiting-takeover-eyebrow">PHONE HOST · STEP 1</div>
            <div className="waiting-takeover-title">SCAN TO TAKE CONTROL</div>
            <div className="waiting-qr-wrap">
              <QRCodeSVG value={takeoverUrl!} size={220} bgColor="transparent" fgColor="#F6C842" level="M" />
            </div>
            <div className="waiting-takeover-sub">Scan with the phone you'll host from. The tablet will then show the lobby for everyone else.</div>
          </div>

          <div className="waiting-qr-block waiting-secondary">
            <div className="waiting-qr-section-label">OR — JOIN AS A PLAYER</div>
            <div className="waiting-qr-wrap waiting-qr-wrap-small">
              <QRCodeSVG value={joinUrl} size={140} bgColor="transparent" fgColor="white" level="M" />
            </div>
            <div className="waiting-code">{room.code}</div>
          </div>
        </>
      ) : (
        <div className="waiting-qr-block">
          <div className="waiting-qr-wrap">
            <QRCodeSVG value={joinUrl} size={180} bgColor="transparent" fgColor="white" level="M" />
          </div>
          <div className="waiting-code">{room.code}</div>
          <div className="waiting-join-hint">Scan or go to <span className="waiting-url">{window.location.host}</span></div>
        </div>
      )}

      {hostIsLocalhost && (
        <div className="qr-localhost-warn">
          <strong>⚠ Localhost detected.</strong> Phones won't be able to scan this. Reload from the tablet's network IP (e.g. <code>192.168.1.X:8080</code>).
        </div>
      )}

      <div className="waiting-meta">
        <span className="room-exp-badge">{expLabel}</span>
        <span className="waiting-mode-badge">{MODES.find(m => m.id === room.mode)?.label ?? room.mode}</span>
      </div>

      <div className="member-list">
        <div className="member-list-header">Players ({members.length})</div>
        {members.map(m => (
          <div key={m.guestId} className={`member-row ${m.guestId === guestId ? "is-me" : ""}`}>
            <span className="member-name">{m.displayName}{m.role === "host" ? " ★" : ""}</span>
            {isHost && m.guestId !== guestId && (
              <button className="kick-btn" onClick={() => { haptic.tap(); kickGuest(m.guestId); }}>✕</button>
            )}
          </div>
        ))}
        {members.length === 0 && <p className="empty-hint">Waiting for guests…</p>}
      </div>

      {error && <p className="error">{error}</p>}

      {isHost && room.experience === "thedraft" && (
        <div className="draft-rounds-picker">
          <div className="draft-rounds-label">ROUNDS</div>
          <div className="draft-rounds-options">
            {[2, 3, 5].map(n => (
              <button key={n}
                className={`draft-rounds-option ${draftRounds === n ? "draft-rounds-active" : ""}`}
                onClick={() => { haptic.tap(); setDraftRounds(n); }}>
                {n}
              </button>
            ))}
          </div>
          <div className="draft-rounds-hint">Each player picks {draftRounds} time{draftRounds === 1 ? "" : "s"}</div>
        </div>
      )}

      {isHost && (
        <button className="start-btn"
          onClick={() => {
            haptic.heavy();
            setLoading(true);
            startGame(false, room.experience === "thedraft" ? draftRounds : undefined);
          }}
          disabled={members.length < 1 || loading}>
          {loading ? "Starting…" : "Start Game"}
        </button>
      )}
      {!isHost && <p className="waiting-hint">Waiting for the host to start…</p>}
    </div>
  );
}

// ─── Marquee View — tablet display in Mode 3 (Phone Host) after host transfer ─

function MarqueeView({ roomHook }: { roomHook: ReturnType<typeof useRoom> }) {
  const { room, members } = roomHook;
  if (!room) return null;
  const expLabel = EXPERIENCES.find(e => e.id === room.experience)?.label ?? room.experience;
  const joinUrl = `http://${window.location.host}?join=${room.code}`;
  const host = members.find(m => m.role === "host");

  return (
    <div className="marquee">
      <div className="marquee-eyebrow">PARTYGLUE BOX</div>
      <div className="marquee-title">{expLabel.toUpperCase()}</div>
      {host && <div className="marquee-host">Hosted by <strong>{host.displayName}</strong></div>}

      <div className="marquee-qr-block">
        <div className="marquee-qr-wrap">
          <QRCodeSVG value={joinUrl} size={260} bgColor="transparent" fgColor="white" level="M" />
        </div>
        <div className="marquee-code">{room.code}</div>
        <div className="marquee-hint">Scan to join · {window.location.host}</div>
      </div>

      <div className="marquee-players">
        <div className="marquee-players-label">PLAYERS · {members.length}</div>
        <div className="marquee-players-list">
          {members.map(m => (
            <div key={m.guestId} className="marquee-player-chip">
              {m.displayName}{m.role === "host" ? " ★" : ""}
            </div>
          ))}
        </div>
      </div>

      <div className="marquee-status">
        {room.phase === "lobby" && <span>Waiting on host to start…</span>}
        {room.phase === "playing" && <span>● GAME IN PROGRESS</span>}
        {room.phase === "results" && <span>GAME OVER</span>}
      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const wsStatus = useWsStatus();
  const roomHook = useRoom();
  const { room, you, guestId, gameState, isMarquee } = roomHook;

  if (wsStatus === "connecting") return <ConnectingScreen />;
  if (wsStatus === "disconnected") return <DisconnectedScreen />;

  // Mode 3 (Phone Host) — once this device handed off host, it stays in MarqueeView for
  // the rest of the session no matter what the room phase is.
  if (room && isMarquee) return <MarqueeView roomHook={roomHook} />;

  if (room && (room.phase === "playing" || room.phase === "results")) {
    if (!gameState && room.phase === "results") {
      return (
        <div className="game-loading">
          <p>Game over.</p>
          <button className="lets-go-btn" style={{ marginTop: 24 }}
            onClick={() => { localStorage.removeItem("pg_room"); window.location.reload(); }}>
            Return to Lobby
          </button>
        </div>
      );
    }

    const sharedProps = { guestId, roomId: room.id, isHost: you?.role === "host", displayName: you?.displayName ?? "", gameState };
    if (room.experience === "wyr")         return <WYRGame         {...sharedProps} roomMode={room.mode} />;
    if (room.experience === "guesstimate") return <GuessimateGame  {...sharedProps} />;
    if (room.experience === "buzzer")      return <BuzzerGame      {...sharedProps} />;
    if (room.experience === "rankit")      return <RankItGame      {...sharedProps} />;
    if (room.experience === "connections") return <ConnectionsGame {...sharedProps} />;
    if (room.experience === "geoguesser")  return <GeoGuesserGame  {...sharedProps} />;
    if (room.experience === "thedraft")    return <TheDraftGame    {...sharedProps} />;
    if (room.experience === "draw")        return <DrawGame        {...sharedProps} />;
    if (room.experience === "whalabroad")  return <WhalabroadGame  {...sharedProps} />;
    return <TriviaGame {...sharedProps} roomMode={room.mode} />;
  }

  if (room) return <WaitingRoom roomHook={roomHook} />;

  return <Hub roomHook={roomHook} />;
}
