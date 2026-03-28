import React, { createContext, useContext, useEffect, useReducer, useRef } from "react";
import { audioEngine } from "../lib/engines/audioEngineSingleton";
import type {
  Room, QueueItem, RoomMember, CrowdState,
  ExperienceType, GuestViewType, DJExperienceState, RoomEvent,
} from "@queuedj/shared-types";
import { socketManager } from "../lib/socket";
import { getIdentity } from "../lib/identity";

// ─────────────────────────────────────────────────────────────────────────────
// Room Context — single source of truth for all room state on the client
//
// Every screen reads from here. Nothing talks to the socket directly except
// this context. Keeps the component tree clean.
// ─────────────────────────────────────────────────────────────────────────────

interface RoomState {
  room: Room | null;
  queue: QueueItem[];
  members: Omit<RoomMember, "pushToken">[];
  guestId: string | null;
  role: "HOST" | "CO_HOST" | "GUEST" | null;
  isConnected: boolean;
  isOffline: boolean;
  activeExperience: ExperienceType;
  guestView: GuestViewType;
  guestViewData: unknown;       // Payload from GuestViewDescriptor.data
  experienceState: unknown;     // Full server-side experience state (for host controls)
  djState: DJExperienceState | null;
  activePollId: string | null;
  roomClosed: boolean;
  readyUp: { active: boolean; readyCount: number; totalCount: number; iHaveReadied: boolean };
}

type Action =
  | { type: "SET_ROOM"; room: Room }
  | { type: "SET_GUEST_ID"; guestId: string; role: "HOST" | "CO_HOST" | "GUEST" }
  | { type: "SET_QUEUE"; queue: QueueItem[] }
  | { type: "ADD_QUEUE_ITEM"; item: QueueItem }
  | { type: "SET_MEMBERS"; members: Omit<RoomMember, "pushToken">[] }
  | { type: "MEMBER_JOINED"; member: Omit<RoomMember, "pushToken"> }
  | { type: "MEMBER_LEFT"; guestId: string }
  | { type: "SET_CROWD_STATE"; crowdState: CrowdState }
  | { type: "SET_CONNECTED"; isConnected: boolean }
  | { type: "SET_OFFLINE"; isOffline: boolean }
  | { type: "SET_EXPERIENCE"; experience: ExperienceType; view: GuestViewType; viewData?: unknown; expState?: unknown }
  | { type: "UPDATE_EXPERIENCE_STATE"; viewData: unknown; expState?: unknown }
  | { type: "SET_DJ_STATE"; djState: DJExperienceState }
  | { type: "SET_POLL"; pollId: string | null }
  | { type: "SET_ROLE"; role: "HOST" | "CO_HOST" | "GUEST" }
  | { type: "ROOM_CLOSED" }
  | { type: "LEAVE_ROOM" }
  | { type: "SET_READY_UP"; active: boolean; readyCount: number; totalCount: number }
  | { type: "READY_COUNT_UPDATE"; readyCount: number; totalCount: number }
  | { type: "MARK_ME_READY" };

const initialState: RoomState = {
  room: null,
  queue: [],
  members: [],
  guestId: null,
  role: null,
  isConnected: false,
  isOffline: false,
  activeExperience: "dj",
  guestView: "dj_queue",
  guestViewData: null,
  experienceState: null,
  djState: null,
  activePollId: null,
  roomClosed: false,
  readyUp: { active: false, readyCount: 0, totalCount: 0, iHaveReadied: false },
};

function reducer(state: RoomState, action: Action): RoomState {
  switch (action.type) {
    case "SET_ROOM":
      return { ...state, room: action.room };
    case "SET_GUEST_ID":
      return { ...state, guestId: action.guestId, role: action.role };
    case "SET_QUEUE":
      return { ...state, queue: action.queue };
    case "ADD_QUEUE_ITEM":
      return { ...state, queue: [...state.queue, action.item].sort((a, b) => a.position - b.position) };
    case "SET_MEMBERS":
      return { ...state, members: action.members };
    case "MEMBER_JOINED":
      return { ...state, members: [...state.members.filter(m => m.guestId !== action.member.guestId), action.member] };
    case "MEMBER_LEFT":
      return { ...state, members: state.members.filter(m => m.guestId !== action.guestId) };
    case "SET_CROWD_STATE":
      return state.room ? { ...state, room: { ...state.room, crowdState: action.crowdState } } : state;
    case "SET_ROLE":
      return { ...state, role: action.role };
    case "SET_CONNECTED":
      return { ...state, isConnected: action.isConnected };
    case "SET_OFFLINE":
      return { ...state, isOffline: action.isOffline };
    case "SET_EXPERIENCE":
      return {
        ...state,
        activeExperience: action.experience,
        guestView: action.view,
        // Only overwrite guestViewData if the incoming event actually has data
        guestViewData: action.viewData !== undefined ? action.viewData : state.guestViewData,
        experienceState: action.expState ?? state.experienceState,
      };
    case "UPDATE_EXPERIENCE_STATE":
      // Used by experience:state_updated — updates data without changing the view type
      return {
        ...state,
        guestViewData: action.viewData,
        experienceState: action.expState ?? action.viewData,
      };
    case "SET_DJ_STATE":
      return { ...state, djState: action.djState };
    case "SET_POLL":
      return { ...state, activePollId: action.pollId };
    case "ROOM_CLOSED":
      return { ...state, roomClosed: true };
    case "LEAVE_ROOM":
      return { ...initialState };
    case "SET_READY_UP":
      return { ...state, readyUp: { active: action.active, readyCount: action.readyCount, totalCount: action.totalCount, iHaveReadied: false } };
    case "READY_COUNT_UPDATE":
      return { ...state, readyUp: { ...state.readyUp, readyCount: action.readyCount, totalCount: action.totalCount } };
    case "MARK_ME_READY":
      return { ...state, readyUp: { ...state.readyUp, iHaveReadied: true } };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface RoomContextValue {
  state: RoomState;
  dispatch: React.Dispatch<Action>;
  sendAction: (action: string, payload?: unknown) => void;
  switchExperience: (toExperience: ExperienceType) => void;
  sendReadyUp: () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ─── Load persistent guestId from identity store on mount ─────────────────
  useEffect(() => {
    getIdentity().then((identity) => {
      if (!state.guestId) {
        dispatch({ type: "SET_GUEST_ID", guestId: identity.guestId, role: "GUEST" });
      }
    }).catch(() => {
      // AsyncStorage unavailable — leave guestId as null until room join
    });
  }, []);

  useEffect(() => {
    const socket = socketManager.get();
    if (!socket) return;

    // Use named handler references so cleanup only removes RoomContext listeners,
    // leaving socket.ts bindCoreEvents handlers (connect/disconnect/queue:updated)
    // intact across re-runs. This also fixes the host bootstrap bug: the effect
    // re-fires when state.room?.id changes (i.e. after doCreateRoom dispatches
    // SET_ROOM), ensuring listeners are registered even when guestId didn't change.

    // ─── State Snapshot ──────────────────────────────────────────────────────
    const onStateSnapshot = (snapshot: any) => {
      dispatch({ type: "SET_ROOM", room: snapshot.room });
      dispatch({ type: "SET_QUEUE", queue: snapshot.queue });
      dispatch({ type: "SET_MEMBERS", members: snapshot.members });
    };

    // ─── Event Replay (reconnect, small gap) ─────────────────────────────────
    // Server replays stored events when the client missed < MAX_EVENT_REPLAY_COUNT.
    // Only queue and crowd-state events are stored server-side; apply them here
    // so the queue stays accurate without requesting a full snapshot.
    const onEventReplay = (events: RoomEvent[]) => {
      for (const event of events) {
        switch (event.type) {
          case "queue_item_added":
            dispatch({ type: "ADD_QUEUE_ITEM", item: event.payload as QueueItem });
            break;
          case "bathroom_toggle": {
            const { active } = event.payload as { active: boolean };
            dispatch({ type: "SET_CROWD_STATE", crowdState: (active ? "RECOVERY" : "RISING") as CrowdState });
            break;
          }
          // queue_reordered: full queue arrives on the next queue:updated — skip
        }
      }
    };

    // ─── Queue Updates ───────────────────────────────────────────────────────
    const onQueueUpdated   = (queue: QueueItem[]) => dispatch({ type: "SET_QUEUE", queue });
    const onItemAdded      = (item: QueueItem) => dispatch({ type: "ADD_QUEUE_ITEM", item });

    // ─── Members ─────────────────────────────────────────────────────────────
    const onMemberJoined   = (member: Omit<RoomMember, "pushToken">) => dispatch({ type: "MEMBER_JOINED", member });
    const onMemberLeft     = ({ guestId }: { guestId: string }) => dispatch({ type: "MEMBER_LEFT", guestId });
    const onMembersSync    = ({ members }: { members: Omit<RoomMember, "pushToken">[] }) => dispatch({ type: "SET_MEMBERS", members });

    // ─── Crowd State ──────────────────────────────────────────────────────────
    const onCrowdState     = ({ crowdState }: { crowdState: CrowdState }) => dispatch({ type: "SET_CROWD_STATE", crowdState });

    // ─── Connection ──────────────────────────────────────────────────────────
    const onConnect = () => {
      dispatch({ type: "SET_CONNECTED", isConnected: true });
      dispatch({ type: "SET_OFFLINE",   isOffline: false });
    };
    const onDisconnect = () => {
      dispatch({ type: "SET_CONNECTED", isConnected: false });
      dispatch({ type: "SET_OFFLINE",   isOffline: true });
    };

    // ─── Experience System ────────────────────────────────────────────────────
    const onExperienceChanged = ({ experienceType, view, awaitingReady, readyCount, readyTotalCount }: any) => {
      if (view?.type) {
        dispatch({ type: "SET_EXPERIENCE", experience: experienceType, view: view.type, viewData: view.data });
      }
      if (awaitingReady) {
        dispatch({ type: "SET_READY_UP", active: true, readyCount: readyCount ?? 0, totalCount: readyTotalCount ?? 0 });
      } else {
        dispatch({ type: "SET_READY_UP", active: false, readyCount: 0, totalCount: 0 });
      }
    };
    const onReadyUpdate = ({ readyCount, totalCount }: any) => {
      dispatch({ type: "READY_COUNT_UPDATE", readyCount, totalCount });
    };
    const onAllReady = () => {
      dispatch({ type: "SET_READY_UP", active: false, readyCount: 0, totalCount: 0 });
    };
    const onExperienceState = ({ experienceType, state: expState, view, awaitingReady, readyCount, readyTotalCount }: any) => {
      if (experienceType === "dj") {
        dispatch({ type: "SET_DJ_STATE", djState: expState });
      }
      if (view?.type) {
        dispatch({ type: "SET_EXPERIENCE", experience: experienceType, view: view.type, viewData: view.data, expState });
      }
      // Handle ready-up state from join-time snapshots (awaitingReady explicitly set)
      if (awaitingReady === true) {
        dispatch({ type: "SET_READY_UP", active: true, readyCount: readyCount ?? 0, totalCount: readyTotalCount ?? 0 });
      } else if (awaitingReady === false) {
        dispatch({ type: "SET_READY_UP", active: false, readyCount: 0, totalCount: 0 });
      }
      // If awaitingReady is undefined (normal in-game state pushes), don't touch readyUp —
      // only onAllReady dismisses the overlay.
    };
    const onExperienceStateUpdated = (payload: any) => {
      dispatch({ type: "UPDATE_EXPERIENCE_STATE", viewData: payload, expState: payload });
    };

    // ─── Deck Commands ────────────────────────────────────────────────────────
    const onDeckStateUpdated = (payload: any) => {
      const { deck, command, value } = payload;
      if (!deck) return;
      switch (command) {
        case "play":           audioEngine.play(deck).catch(() => {}); break;
        case "pause":          audioEngine.pause(deck).catch(() => {}); break;
        case "set_crossfader": if (typeof value === "number") audioEngine.setCrossfader(value); break;
        case "set_volume":     if (typeof value === "number") audioEngine.setVolume(deck, value); break;
        case "set_eq":
          if (value && typeof value === "object") {
            audioEngine.setEQ(deck, value.low ?? 1, value.mid ?? 1, value.high ?? 1);
          }
          break;
      }
    };

    // ─── Polls ────────────────────────────────────────────────────────────────
    const onPollStarted = (poll: any) => dispatch({ type: "SET_POLL", pollId: poll.id });
    const onPollResult  = ()           => dispatch({ type: "SET_POLL", pollId: null });

    // ─── Room Closed / Settings / Roles ──────────────────────────────────────
    const onRoomClosed = () => dispatch({ type: "ROOM_CLOSED" });
    const onSettingChanged = ({ key, value }: { key: string; value: unknown }) => {
      if (key === "bpm_override" && typeof value === "number") {
        dispatch({ type: "UPDATE_EXPERIENCE_STATE", viewData: { bpm_override: value }, expState: { bpm_override: value } });
      }
    };
    const onRolePromoted = ({ newRole }: { newRole: "CO_HOST" | "HOST" }) => dispatch({ type: "SET_ROLE", role: newRole });
    const onRoleDemoted  = () => dispatch({ type: "SET_ROLE", role: "GUEST" });

    socket.on("room:state_snapshot",      onStateSnapshot);
    socket.on("room:event_replay" as any, onEventReplay);
    socket.on("queue:updated",            onQueueUpdated as any);
    socket.on("queue:item_added" as any,  onItemAdded as any);
    socket.on("room:member_joined",       onMemberJoined as any);
    socket.on("room:member_left",         onMemberLeft as any);
    socket.on("room:members_sync" as any, onMembersSync as any);
    socket.on("room:crowd_state_changed", onCrowdState as any);
    socket.on("connect",                  onConnect);
    socket.on("disconnect",               onDisconnect);
    socket.on("experience:changed" as any,      onExperienceChanged);
    socket.on("experience:state" as any,        onExperienceState);
    socket.on("experience:state_updated" as any, onExperienceStateUpdated);
    socket.on("room:ready_update" as any,       onReadyUpdate);
    socket.on("room:all_ready" as any,          onAllReady);
    socket.on("deck:state_updated" as any,      onDeckStateUpdated);
    socket.on("poll:started" as any,            onPollStarted);
    socket.on("poll:result"  as any,            onPollResult);
    socket.on("room:closed" as any,             onRoomClosed);
    socket.on("room:setting_changed" as any,    onSettingChanged);
    socket.on("role:promoted" as any,           onRolePromoted);
    socket.on("role:demoted" as any,            onRoleDemoted);

    return () => {
      // Remove only RoomContext handlers — bindCoreEvents handlers stay intact
      socket.off("room:state_snapshot",      onStateSnapshot);
      socket.off("room:event_replay" as any, onEventReplay);
      socket.off("queue:updated",            onQueueUpdated as any);
      socket.off("queue:item_added" as any,  onItemAdded as any);
      socket.off("room:member_joined",       onMemberJoined as any);
      socket.off("room:member_left",         onMemberLeft as any);
      socket.off("room:members_sync" as any, onMembersSync as any);
      socket.off("room:crowd_state_changed", onCrowdState as any);
      socket.off("connect",                  onConnect);
      socket.off("disconnect",               onDisconnect);
      socket.off("experience:changed" as any,      onExperienceChanged);
      socket.off("experience:state" as any,        onExperienceState);
      socket.off("experience:state_updated" as any, onExperienceStateUpdated);
      socket.off("room:ready_update" as any,       onReadyUpdate);
      socket.off("room:all_ready" as any,          onAllReady);
      socket.off("deck:state_updated" as any,      onDeckStateUpdated);
      socket.off("poll:started" as any,            onPollStarted);
      socket.off("poll:result"  as any,            onPollResult);
      socket.off("room:closed" as any,             onRoomClosed);
      socket.off("room:setting_changed" as any,    onSettingChanged);
      socket.off("role:promoted" as any,           onRolePromoted);
      socket.off("role:demoted" as any,            onRoleDemoted);
    };
  // Re-run when guestId changes (guest joins with session ID) OR when a room
  // is first created (state.room?.id goes null → roomId), which handles the
  // host bootstrap case where guestId doesn't change.
  }, [state.guestId, state.room?.id]);

  function sendAction(action: string, payload?: unknown) {
    const socket = socketManager.get();
    if (!socket || !state.room) return;
    socket.emit("experience:action" as any, {
      roomId: state.room.id,
      guestId: state.guestId,
      action,
      payload,
    });
  }

  function switchExperience(toExperience: ExperienceType) {
    // Optimistic local update — controls switch immediately without waiting for server ack.
    // Server will confirm (or correct) via experience:changed.
    dispatch({ type: "SET_EXPERIENCE", experience: toExperience, view: state.guestView });
    const socket = socketManager.get();
    if (!socket || !state.room) return;
    socket.emit("experience:switch" as any, {
      roomId: state.room.id,
      toExperience,
    });
  }

  // After React commits with a room set (handlers now registered), request a
  // fresh state snapshot so events dropped during the join race are recovered.
  useEffect(() => {
    if (!state.room?.id) return;
    const socket = socketManager.get();
    if (!socket) return;
    socket.emit("room:request_sync" as any, { roomId: state.room.id });
  }, [state.room?.id]);

  function sendReadyUp() {
    const socket = socketManager.get();
    if (!socket || !state.room) return;
    socket.emit("room:ready_up" as any, { roomId: state.room.id });
    dispatch({ type: "MARK_ME_READY" });
  }

  return (
    <RoomContext.Provider value={{ state, dispatch, sendAction, switchExperience, sendReadyUp }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used inside RoomProvider");
  return ctx;
}
