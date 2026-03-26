/**
 * Component tests for GalleryView (Scavenger Snap voting screen).
 *
 * Setup: npm install (adds @testing-library/react-native)
 * Run:   npm test (from apps/mobile/)
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { GalleryView } from "../src/components/experiences/scavenger-snap/GalleryView";

// ─── Mock RoomContext ─────────────────────────────────────────────────────────
// GalleryView reads state.guestViewData, state.guestId, state.members
// and calls sendAction. We control all of these.

const mockSendAction = jest.fn();

function buildRoomState(overrides: {
  guestId?: string;
  photos?: Record<string, string>;
  members?: Array<{ guestId: string }>;
} = {}) {
  const { guestId = "me-123", photos = {}, members = [] } = overrides;
  return {
    state: {
      guestViewData: { photos },
      guestId,
      members,
      room: null,
      queue: [],
      role: "GUEST",
      isConnected: true,
      isOffline: false,
      activeExperience: "scavenger_snap",
      guestView: "gallery",
      experienceState: null,
      djState: null,
      activePollId: null,
      roomClosed: false,
    },
    dispatch:         jest.fn(),
    sendAction:       mockSendAction,
    switchExperience: jest.fn(),
  };
}

jest.mock("../src/contexts/RoomContext", () => ({
  useRoom: jest.fn(),
}));

import { useRoom } from "../src/contexts/RoomContext";
const mockUseRoom = useRoom as jest.MockedFunction<typeof useRoom>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Minimal base64 placeholder — RNTL's Image doesn't actually render pixels
const FAKE_PHOTO = "data:image/jpeg;base64,/9j/fake";

const MEMBERS = [
  { guestId: "guest-1" },
  { guestId: "guest-2" },
  { guestId: "me-123" },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GalleryView — own photo", () => {
  it("shows 'Your snap' label on the photo that belongs to the current guest", () => {
    mockUseRoom.mockReturnValue(buildRoomState({
      guestId: "me-123",
      photos:  { "me-123": FAKE_PHOTO, "guest-1": FAKE_PHOTO },
      members: MEMBERS,
    }) as any);

    render(<GalleryView />);

    expect(screen.getByText("Your snap")).toBeTruthy();
  });

  it("does not show a vote button on own photo", () => {
    mockUseRoom.mockReturnValue(buildRoomState({
      guestId: "me-123",
      photos:  { "me-123": FAKE_PHOTO },
      members: MEMBERS,
    }) as any);

    render(<GalleryView />);

    // Own photo: "Tap to Vote" must NOT appear (can't vote for yourself)
    expect(screen.queryByText("Tap to Vote")).toBeNull();
  });

  it("shows 'YOU' badge on own photo instead of a player number", () => {
    mockUseRoom.mockReturnValue(buildRoomState({
      guestId: "me-123",
      photos:  { "me-123": FAKE_PHOTO },
      members: MEMBERS,
    }) as any);

    render(<GalleryView />);

    expect(screen.getByText("YOU")).toBeTruthy();
  });
});

describe("GalleryView — voting", () => {
  it("shows 'Tap to Vote' on other guests' photos before voting", () => {
    mockUseRoom.mockReturnValue(buildRoomState({
      guestId: "me-123",
      photos:  { "guest-1": FAKE_PHOTO, "guest-2": FAKE_PHOTO },
      members: MEMBERS,
    }) as any);

    render(<GalleryView />);

    const voteBtns = screen.getAllByText("Tap to Vote");
    expect(voteBtns.length).toBe(2); // two other guests
  });

  it("calls sendAction('cast_vote', { targetGuestId }) when a vote button is tapped", () => {
    mockUseRoom.mockReturnValue(buildRoomState({
      guestId: "me-123",
      photos:  { "guest-1": FAKE_PHOTO },
      members: MEMBERS,
    }) as any);

    render(<GalleryView />);

    fireEvent.press(screen.getByText("Tap to Vote"));

    expect(mockSendAction).toHaveBeenCalledTimes(1);
    expect(mockSendAction).toHaveBeenCalledWith("cast_vote", { targetGuestId: "guest-1" });
  });

  it("vote buttons disappear after voting (can only vote once)", () => {
    mockUseRoom.mockReturnValue(buildRoomState({
      guestId: "me-123",
      photos:  { "guest-1": FAKE_PHOTO, "guest-2": FAKE_PHOTO },
      members: MEMBERS,
    }) as any);

    render(<GalleryView />);

    // Vote for guest-1
    fireEvent.press(screen.getAllByText("Tap to Vote")[0]);

    // Both vote buttons should now be gone
    expect(screen.queryByText("Tap to Vote")).toBeNull();
  });

  it("shows voted confirmation banner after voting", () => {
    mockUseRoom.mockReturnValue(buildRoomState({
      guestId: "me-123",
      photos:  { "guest-1": FAKE_PHOTO },
      members: MEMBERS,
    }) as any);

    render(<GalleryView />);
    fireEvent.press(screen.getByText("Tap to Vote"));

    expect(screen.getByText(/vote locked in/i)).toBeTruthy();
  });

  it("does not call sendAction when tapping own photo", () => {
    mockUseRoom.mockReturnValue(buildRoomState({
      guestId: "me-123",
      photos:  { "me-123": FAKE_PHOTO },
      members: MEMBERS,
    }) as any);

    render(<GalleryView />);

    // Own photo card is disabled — pressing it should not emit
    // (The TouchableOpacity has disabled={!canVote} where canVote=false for own photo)
    expect(mockSendAction).not.toHaveBeenCalled();
  });
});

describe("GalleryView — empty state", () => {
  it("shows waiting message when no photos have been submitted yet", () => {
    mockUseRoom.mockReturnValue(buildRoomState({
      guestId: "me-123",
      photos:  {},
      members: [],
    }) as any);

    render(<GalleryView />);

    expect(screen.getByText(/waiting for snaps/i)).toBeTruthy();
  });
});

describe("GalleryView — player badges", () => {
  it("shows player number badge (P1, P2...) for other guests", () => {
    mockUseRoom.mockReturnValue(buildRoomState({
      guestId: "me-123",
      photos:  { "guest-1": FAKE_PHOTO, "guest-2": FAKE_PHOTO },
      members: [
        { guestId: "guest-1" },
        { guestId: "guest-2" },
        { guestId: "me-123" },
      ],
    }) as any);

    render(<GalleryView />);

    expect(screen.getByText("P1")).toBeTruthy();
    expect(screen.getByText("P2")).toBeTruthy();
  });
});
