import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const EXAMPLE_ENTRIES = [
  { player: "Alex", item: "See the Northern Lights in Iceland" },
  { player: "Jordan", item: "Learn to play the guitar" },
  { player: "Sam", item: "Go skydiving over the Grand Canyon" },
  { player: "Riley", item: "Write a novel" },
];

type Phase = "lobby" | "submit" | "guess" | "reveal" | "results";

export default function BucketListScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }

  const [mpItem, setMpItem] = useState("");
  const [mpSubmitted, setMpSubmitted] = useState(false);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [myItem, setMyItem] = useState("");
  const [guessIdx, setGuessIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [log, setLog] = useState<boolean[]>([]);

  // ── Multiplayer block ──────────────────────────────────────────────────────
  if (inRoom && mpState) {
    const mp = mpState;
    const mpPhase: string = mp.phase ?? "waiting";

    if (mpPhase === "finished") {
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🏆</Text>
              <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900", marginBottom: 20 }}>Final Leaderboard</Text>
              {Object.entries(mpState.scores ?? {}).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([gid, pts], i) => (
                <View key={gid} style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 8 }}>
                  <Text style={{ color: "#ccc", fontSize: 16 }}>#{i + 1} {memberName(gid)}{gid === myGuestId ? " (you)" : ""}</Text>
                  <Text style={{ color: "#a78bfa", fontSize: 16, fontWeight: "700" }}>{pts as number} pts</Text>
                </View>
              ))}
              <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, padding: 12 }}>
                <Text style={{ color: "#666" }}>Back to Home</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "waiting") {
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.center}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>⏳</Text>
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center" }}>Waiting for game to start…</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "submitting") {
      return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
          <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
            <SafeAreaView style={s.flex}>
              <View style={s.center}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>✍️</Text>
                <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginBottom: 8 }}>Your Bucket List Item</Text>
                <Text style={{ color: "#888", fontSize: 13, marginBottom: 20, textAlign: "center" }}>Something you really want to do before you die</Text>
                <TextInput style={s.bigInput} value={mpItem} onChangeText={setMpItem} placeholder="e.g. Swim with whale sharks…" placeholderTextColor="#333" multiline autoFocus />
                {!mpSubmitted ? (
                  <TouchableOpacity style={s.btn} onPress={() => { if (mpItem.trim()) { setMpSubmitted(true); sendAction("submit_item", { text: mpItem.trim() }); } }}>
                    <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.btnI}><Text style={s.btnT}>SUBMIT ANONYMOUSLY →</Text></LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <Text style={{ color: "#888", fontSize: 15, textAlign: "center" }}>⏳ Waiting for others…</Text>
                )}
              </View>
            </SafeAreaView>
          </LinearGradient>
        </KeyboardAvoidingView>
      );
    }

    if (mpPhase === "guessing") {
      const members = state.members;
      const myVoteMp = mp.guesses?.[myGuestId ?? ""];
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topBar}><Text style={s.prog}>Item {(mp.itemIndex ?? 0) + 1}</Text><Text style={s.scoreC}>{mp.scores?.[myGuestId ?? ""] ?? 0} pts</Text></View>
            <View style={s.itemCard}><Text style={s.itemLabel}>BUCKET LIST ITEM</Text><Text style={s.itemText}>"{mp.currentItem}"</Text><Text style={s.itemQuestion}>Who wrote this?</Text></View>
            <View style={s.players}>
              {members.map((m) => (
                <TouchableOpacity key={m.guestId} onPress={() => { if (!myVoteMp) sendAction("guess", { authorId: m.guestId }); }} disabled={!!myVoteMp} activeOpacity={0.8} style={s.playerWrap}>
                  <LinearGradient colors={myVoteMp === m.guestId ? ["#7209b7","#b5179e"] : ["#1a1a3a","#2a1a4a"]} style={s.playerCard}>
                    <Text style={s.playerName}>{m.displayName}</Text>
                    {myVoteMp === m.guestId && <Text style={{ color: "#e879f9" }}>← Guessed</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
            {myVoteMp && <Text style={{ color: "#888", textAlign: "center", padding: 12 }}>⏳ Waiting for others…</Text>}
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "reveal") {
      const author = mp.author;
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: "#888", fontSize: 12, fontWeight: "900", letterSpacing: 2, marginBottom: 8 }}>WRITTEN BY</Text>
              <Text style={{ color: "#e879f9", fontSize: 28, fontWeight: "900", marginBottom: 8 }}>{author ? memberName(author) : "?"}</Text>
              <Text style={{ color: "#ccc", fontSize: 16, marginBottom: 20, textAlign: "center" }}>"{mp.currentItem}"</Text>
              {Object.entries(mp.scores ?? {}).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([gid, pts], i) => (
                <View key={gid} style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 8 }}>
                  <Text style={{ color: "#ccc", fontSize: 15 }}>#{i + 1} {memberName(gid)}</Text>
                  <Text style={{ color: "#a78bfa", fontSize: 15, fontWeight: "700" }}>{pts as number} pts</Text>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    return (
      <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={{ color: "#888", fontSize: 16 }}>Phase: {mpPhase}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }
  // ── End multiplayer block ──────────────────────────────────────────────────

  // Simulated answers: index of player who wrote each item (using example entries as "other players")
  const GUESSES = [1, 0, 3, 2]; // correct player indices for each item

  function startGame() { setPhase("submit"); setMyItem(""); setScore(0); setGuessIdx(0); setLog([]); setSelected(null); }
  function submitItem() {
    if (!myItem.trim()) return;
    setPhase("guess");
  }
  function guess(playerIdx: number) {
    if (selected !== null) return;
    setSelected(playerIdx);
    const correct = playerIdx === GUESSES[guessIdx];
    if (correct) setScore((s) => s + 300);
    setLog((l) => [...l, correct]);
    setTimeout(() => {
      if (guessIdx + 1 >= EXAMPLE_ENTRIES.length) setPhase("results");
      else { setGuessIdx((g) => g + 1); setSelected(null); }
    }, 1400);
  }

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#001a30"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🪣</Text>
          <Text style={s.title}>Bucket List</Text>
          <Text style={s.sub}>Everyone shares a bucket list item anonymously. Guess who wrote each one!</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>PLAY</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "submit") return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
      <LinearGradient colors={["#03001c","#001a30"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={{ fontSize: 64 }}>✍️</Text>
            <Text style={s.title}>Your Bucket List Item</Text>
            <Text style={s.sub}>Something you really want to do before you die</Text>
            <TextInput style={s.bigInput} value={myItem} onChangeText={setMyItem} placeholder="e.g. Swim with whale sharks…" placeholderTextColor="#333" multiline autoFocus />
            <TouchableOpacity style={s.btn} onPress={submitItem}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>SUBMIT ANONYMOUSLY →</Text></LinearGradient></TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );

  if (phase === "results") {
    const correct = log.filter(Boolean).length;
    return (
      <LinearGradient colors={["#03001c","#001a30"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={{ fontSize: 64 }}>🏆</Text>
            <Text style={s.title}>Final Score</Text>
            <Text style={s.bigScore}>{score}</Text>
            <Text style={s.label}>{correct}/{EXAMPLE_ENTRIES.length} correctly guessed</Text>
            <Text style={s.verdict}>{correct === EXAMPLE_ENTRIES.length ? "🧠 You know them all!" : correct >= 2 ? "👍 You listen!" : "🤷 Strangers at a party?"}</Text>
            <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>PLAY AGAIN</Text></LinearGradient></TouchableOpacity>
            <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}><Text style={s.homeBtnT}>Back to Home</Text></TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const item = EXAMPLE_ENTRIES[guessIdx];
  const correctPlayer = EXAMPLE_ENTRIES[GUESSES[guessIdx]];
  return (
    <LinearGradient colors={["#03001c","#001a30"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}><Text style={s.prog}>{guessIdx+1}/{EXAMPLE_ENTRIES.length}</Text><Text style={s.scoreC}>Score: {score}</Text></View>
        <View style={s.itemCard}><Text style={s.itemLabel}>BUCKET LIST ITEM</Text><Text style={s.itemText}>"{item.item}"</Text><Text style={s.itemQuestion}>Who wrote this?</Text></View>
        <View style={s.players}>
          {EXAMPLE_ENTRIES.map((p, i) => {
            const isSelected = selected === i;
            const isCorrect = i === GUESSES[guessIdx];
            let bg: string[] = ["#1a1a3a","#2a1a4a"];
            if (selected !== null) { if (isCorrect) bg = ["#166534","#16a34a"]; else if (isSelected) bg = ["#7f1d1d","#991b1b"]; }
            return (
              <TouchableOpacity key={i} onPress={() => guess(i)} disabled={selected !== null} activeOpacity={0.8} style={s.playerWrap}>
                <LinearGradient colors={bg as any} style={s.playerCard}>
                  <Text style={s.playerName}>{p.player}</Text>
                  {selected !== null && isCorrect && <Text style={{ color: "#4ade80" }}>✓</Text>}
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex:{flex:1}, back:{padding:16,paddingTop:8}, backText:{color:"#a78bfa",fontSize:16,fontWeight:"700"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:24},
  title:{color:"#fff",fontSize:28,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:20},
  btn:{width:"100%",borderRadius:14,overflow:"hidden",marginBottom:12},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12,alignItems:"center"}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,marginBottom:12},
  verdict:{color:"#a78bfa",fontSize:15,fontWeight:"700",marginBottom:28,textAlign:"center"},
  bigInput:{backgroundColor:"#1a1a3a",borderRadius:14,padding:16,color:"#fff",fontSize:16,width:"100%",minHeight:80,marginBottom:20},
  topBar:{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12},
  prog:{color:"#888",fontWeight:"700"}, scoreC:{color:"#a78bfa",fontWeight:"800"},
  itemCard:{margin:20,borderRadius:18,backgroundColor:"rgba(255,255,255,0.06)",padding:24},
  itemLabel:{color:"#555",fontSize:10,fontWeight:"900",letterSpacing:2,marginBottom:8},
  itemText:{color:"#fff",fontSize:20,fontWeight:"700",lineHeight:28,marginBottom:12},
  itemQuestion:{color:"#b5179e",fontSize:14,fontWeight:"700"},
  players:{paddingHorizontal:20,gap:10,flex:1,justifyContent:"center"},
  playerWrap:{borderRadius:14,overflow:"hidden"}, playerCard:{flexDirection:"row",justifyContent:"space-between",padding:16},
  playerName:{color:"#fff",fontSize:16,fontWeight:"700"},
});
