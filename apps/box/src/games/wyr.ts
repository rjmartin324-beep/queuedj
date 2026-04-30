import { nanoid } from "nanoid";
import type { WYRGameState, WYRScore, WYRVote, WYRPrompt, PlayMode } from "../types";
import * as db from "../db";

const QUESTIONS_PER_GAME = 15;

const sessions = new Map<string, WYRGameState>();
const sessionPrompts = new Map<string, WYRPrompt[]>();

function buildScores(guestIds: string[], displayNames: Record<string, string>): WYRScore[] {
  return guestIds.map(guestId => ({
    guestId,
    displayName: displayNames[guestId] ?? guestId,
    score: 0,
    bold: 0,
    safe: 0,
  }));
}

export function startGame(
  roomId: string,
  mode: PlayMode,
  members: Array<{ guestId: string; displayName: string }>
): WYRGameState {
  const sessionId = nanoid(12);
  db.createSession(sessionId, roomId, "wyr");

  const prompts = db.drawWYRPrompts(QUESTIONS_PER_GAME);
  sessionPrompts.set(roomId, prompts);

  const passOrder = members.map(m => m.guestId);
  const displayNames: Record<string, string> = {};
  for (const m of members) displayNames[m.guestId] = m.displayName;

  const state: WYRGameState = {
    sessionId,
    questionIndex: 0,
    totalQuestions: QUESTIONS_PER_GAME,
    phase: "countdown",
    prompt: null,
    votes: {},
    scores: buildScores(passOrder, displayNames),
    mode,
    passOrder,
    passIndex: 0,
  };

  sessions.set(roomId, state);
  return state;
}

export function getState(roomId: string): WYRGameState | null {
  return sessions.get(roomId) ?? null;
}

export function showPrompt(roomId: string): WYRGameState | null {
  const state = sessions.get(roomId);
  if (!state) return null;

  const prompts = sessionPrompts.get(roomId);
  const prompt = prompts?.[state.questionIndex] ?? null;
  if (!prompt) return null;

  state.phase = "question";
  state.prompt = prompt;
  state.votes = {};

  if (state.mode === "pass_tablet") {
    state.passIndex = 0;
  }

  return state;
}

export function submitVote(
  roomId: string,
  guestId: string,
  vote: WYRVote
): { state: WYRGameState; allVoted: boolean } | null {
  const state = sessions.get(roomId);
  if (!state || state.phase !== "question") return null;
  if (state.votes[guestId]) return { state, allVoted: false };

  state.votes[guestId] = vote;
  const activePlayers = state.scores.map(s => s.guestId);
  const allVoted = activePlayers.every(id => state.votes[id]);

  return { state, allVoted };
}

export function revealVotes(roomId: string): WYRGameState | null {
  const state = sessions.get(roomId);
  if (!state) return null;

  state.phase = "reveal";

  const aVoters = Object.values(state.votes).filter(v => v === "a").length;
  const bVoters = Object.values(state.votes).filter(v => v === "b").length;
  const total = aVoters + bVoters;
  if (total === 0) return state;

  const majorityVote: WYRVote = aVoters >= bVoters ? "a" : "b";
  const isTie = aVoters === bVoters;

  for (const score of state.scores) {
    const vote = state.votes[score.guestId];
    if (!vote) continue;
    if (isTie) {
      score.score += 75;
    } else if (vote === majorityVote) {
      score.safe++;
      score.score += 50;
    } else {
      score.bold++;
      score.score += 150;
    }
  }

  state.scores.sort((a, b) => b.score - a.score);
  return state;
}

export function advance(roomId: string): { state: WYRGameState; done: boolean } | null {
  const state = sessions.get(roomId);
  if (!state) return null;

  state.questionIndex++;
  const done = state.questionIndex >= state.totalQuestions;

  if (done) {
    state.phase = "game_over";
    db.persistScores(
      state.sessionId,
      state.scores.map(s => ({
        guestId: s.guestId,
        displayName: s.displayName,
        score: s.score,
        correct: s.bold,
        wrong: s.safe,
      }))
    );
    // Keep session in memory until room closes so reconnecting players see final state.
    // cleanup() handles deletion.
    return { state, done: true };
  }

  state.phase = "countdown";
  state.prompt = null;
  return { state, done: false };
}

export function nextPassTurn(roomId: string): WYRGameState | null {
  const state = sessions.get(roomId);
  if (!state || state.mode !== "pass_tablet") return null;
  state.passIndex = (state.passIndex + 1) % state.passOrder.length;
  return state;
}

export function cleanup(roomId: string): void {
  const state = sessions.get(roomId);
  if (state) {
    try {
      db.persistScores(state.sessionId, state.scores.map(s => ({
        guestId: s.guestId, displayName: s.displayName, score: s.score, correct: s.bold, wrong: s.safe,
      })));
    } catch {}
  }
  sessions.delete(roomId);
  sessionPrompts.delete(roomId);
}
