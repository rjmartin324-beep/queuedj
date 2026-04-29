import { useState, useEffect, useCallback } from "react";
import { socket } from "./ws";
import type { Room, Member, ServerMessage, TriviaAnswer } from "./types";
import { nanoid } from "nanoid";

function getOrCreateGuestId(): string {
  let id = localStorage.getItem("pg_guest_id");
  if (!id) {
    id = nanoid(10);
    localStorage.setItem("pg_guest_id", id);
  }
  return id;
}

export interface RoomState {
  guestId: string;
  room: Room | null;
  you: Member | null;
  members: Member[];
  error: string | null;
  gameState: unknown | null;
}

export function useRoom() {
  const [state, setState] = useState<RoomState>({
    guestId: getOrCreateGuestId(),
    room: null,
    you: null,
    members: [],
    error: null,
    gameState: null,
  });

  useEffect(() => {
    socket.connect();
    const unsub = socket.on(handleMessage);

    // On reconnect, auto-rejoin if we were in a room
    const unsubReconnect = socket.onReconnect(() => {
      const stored = localStorage.getItem("pg_room");
      if (stored) {
        const { code, displayName } = JSON.parse(stored);
        socket.send({ type: "room:join", guestId: getOrCreateGuestId(), displayName, code });
      }
    });

    return () => {
      unsub();
      unsubReconnect();
      socket.close();
    };
  }, []);

  function handleMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "room:created":
      case "room:joined":
        // Persist room info for reconnect
        localStorage.setItem("pg_room", JSON.stringify({
          code: msg.room.code,
          displayName: msg.you.displayName,
        }));
        setState(s => ({ ...s, room: msg.room, you: msg.you, members: msg.members, error: null }));
        break;
      case "room:error":
        setState(s => ({ ...s, error: msg.message }));
        break;
      case "room:member_joined":
        setState(s => ({ ...s, members: [...s.members.filter(m => m.guestId !== msg.member.guestId), msg.member] }));
        break;
      case "room:member_left":
        setState(s => ({ ...s, members: s.members.filter(m => m.guestId !== msg.guestId) }));
        break;
      case "room:members":
        setState(s => ({ ...s, members: msg.members }));
        break;
      case "room:phase_changed":
        setState(s => s.room ? { ...s, room: { ...s.room, phase: msg.phase } } : s);
        break;
      case "room:closed":
        localStorage.removeItem("pg_room");
        setState(s => ({ ...s, room: null, members: [], error: "The host ended the game." }));
        break;
      case "room:kicked":
        localStorage.removeItem("pg_room");
        setState(s => ({ ...s, room: null, members: [], error: "You were removed from the room." }));
        break;
      case "game:state":
        setState(s => ({ ...s, gameState: msg.state as any }));
        break;
    }
  }

  const createRoom = useCallback((displayName: string, mode: import("./types").PlayMode, experience: string) => {
    setState(s => ({ ...s, error: null }));
    socket.send({ type: "room:create", guestId: state.guestId, displayName, mode, experience });
  }, [state.guestId]);

  const joinRoom = useCallback((code: string, displayName: string) => {
    setState(s => ({ ...s, error: null }));
    socket.send({ type: "room:join", guestId: state.guestId, displayName, code: code.toUpperCase() });
  }, [state.guestId]);

  const startGame = useCallback((tournament = false) => {
    if (!state.room) return;
    socket.send({ type: "host:start", guestId: state.guestId, roomId: state.room.id, tournament });
  }, [state.guestId, state.room]);

  const kickGuest = useCallback((targetGuestId: string) => {
    if (!state.room) return;
    socket.send({ type: "host:kick", guestId: state.guestId, roomId: state.room.id, targetGuestId });
  }, [state.guestId, state.room]);

  const endRound = useCallback(() => {
    if (!state.room) return;
    socket.send({ type: "host:end_round", guestId: state.guestId, roomId: state.room.id });
  }, [state.guestId, state.room]);

  const sendAction = useCallback((action: string, payload: unknown) => {
    if (!state.room) return;
    socket.send({ type: "game:action", guestId: state.guestId, roomId: state.room.id, action, payload });
  }, [state.guestId, state.room]);

  const submitAnswer = useCallback((answer: TriviaAnswer) => {
    if (!state.room) return;
    socket.send({ type: "game:answer", guestId: state.guestId, roomId: state.room.id, answer } as any);
  }, [state.guestId, state.room]);

  const nextQuestion = useCallback(() => {
    if (!state.room) return;
    socket.send({ type: "host:next_question", guestId: state.guestId, roomId: state.room.id } as any);
  }, [state.guestId, state.room]);

  const pickCategory = useCallback((category: string) => {
    if (!state.room) return;
    socket.send({ type: "host:pick_category", guestId: state.guestId, roomId: state.room.id, category } as any);
  }, [state.guestId, state.room]);

  return {
    ...state,
    createRoom,
    joinRoom,
    startGame,
    kickGuest,
    endRound,
    sendAction,
    submitAnswer,
    nextQuestion,
    pickCategory,
  };
}
