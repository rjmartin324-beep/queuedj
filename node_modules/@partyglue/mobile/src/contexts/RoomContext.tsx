import React, { createContext, useContext, useEffect, useReducer, useRef } from "react";
import type {
  Room, QueueItem, RoomMember, CrowdState,
  ExperienceType, GuestViewType, DJExperienceState,
} from "@partyglue/shared-types";
import { socketManager } from "../lib/socket";

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
  | { type: "SET_DJ_STATE"; djState: DJExperienceState }
  | { type: "SET_POLL"; pollId: string | null }
  | { type: "LEAVE_ROOM" };

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
    case "SET_DJ_STATE":
      return { ...state, djState: action.djState };
    case "SET_POLL":
      return { ...state, activePollId: action.pollId };
    case "LEAVE_ROOM":
      return { ...initialState };
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
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const socket = socketManager.get();
    if (!socket) return;

    // ─── State Snapshot (full resync on reconnect) ──────────────────────────
    socket.on("room:state_snapshot", (snapshot) => {
      dispatch({ type: "SET_ROOM", room: snapshot.room });
      dispatch({ type: "SET_QUEUE", queue: snapshot.queue });
      dispatch({ type: "SET_MEMBERS", members: snapshot.members });
    });

    // ─── Queue Updates ──────────────────────────────────────────────────────
    socket.on("queue:updated", (queue) => dispatch({ type: "SET_QUEUE", queue }));
    socket.on("queue:item_added" as any, (item: QueueItem) => dispatch({ type: "ADD_QUEUE_ITEM", item }));

    // ─── Members ────────────────────────────────────────────────────────────
    socket.on("room:member_joined", (member) => dispatch({ type: "MEMBER_JOINED", member }));
    socket.on("room:member_left", ({ guestId }) => dispatch({ type: "MEMBER_LEFT", guestId }));

    // ─── Crowd State ────────────────────────────────────────────────────────
    socket.on("room:crowd_state_changed", ({ crowdState }) => dispatch({ type: "SET_CROWD_STATE", crowdState }));

    // ─── Connection ─────────────────────────────────────────────────────────
    socket.on("connect",    () => dispatch({ type: "SET_CONNECTED", isConnected: true }));
    socket.on("disconnect", () => {
      dispatch({ type: "SET_CONNECTED", isConnected: false });
      dispatch({ type: "SET_OFFLINE", isOffline: true });
    });

    // ─── Experience System ───────────────────────────────────────────────────
    socket.on("experience:changed" as any, ({ experienceType, view }: any) => {
      dispatch({ type: "SET_EXPERIENCE", experience: experienceType, view: view.type, viewData: view.data });
    });

    socket.on("experience:state" as any, ({ experienceType, state: expState, view }: any) => {
      if (experienceType === "dj") {
        dispatch({ type: "SET_DJ_STATE", djState: expState });
      }
      if (view?.type) {
        dispatch({ type: "SET_EXPERIENCE", experience: experienceType, view: view.type, viewData: view.data, expState });
      }
    });

    // ─── Polls ───────────────────────────────────────────────────────────────
    socket.on("poll:started" as any, (poll: any) => dispatch({ type: "SET_POLL", pollId: poll.id }));
    socket.on("poll:result"  as any, ()           => dispatch({ type: "SET_POLL", pollId: null }));

    return () => { socket.removeAllListeners(); };
  }, [state.guestId]);

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
    const socket = socketManager.get();
    if (!socket || !state.room) return;
    socket.emit("experience:switch" as any, {
      roomId: state.room.id,
      toExperience,
    });
  }

  return (
    <RoomContext.Provider value={{ state, dispatch, sendAction, switchExperience }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used inside RoomProvider");
  return ctx;
}
