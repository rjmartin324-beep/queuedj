import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const PUZZLES = [
  {
    title: "Types of music",
    groups: [
      { label: "Types of Music", color: "#fbbf24", items: ["Jazz", "Blues", "Funk", "Soul"] },
      { label: "Cooking methods", color: "#4ade80", items: ["Grill", "Steam", "Bake", "Fry"] },
      { label: "Dog breeds", color: "#60a5fa", items: ["Poodle", "Beagle", "Labrador", "Husky"] },
      { label: "Planets", color: "#f472b6", items: ["Mars", "Venus", "Saturn", "Jupiter"] },
    ],
  },
  {
    title: "Word connections",
    groups: [
      { label: "___ board", color: "#fbbf24", items: ["Key", "Snow", "Card", "Skate"] },
      { label: "Things in a kitchen", color: "#4ade80", items: ["Whisk", "Ladle", "Tongs", "Grater"] },
      { label: "Shades of blue", color: "#60a5fa", items: ["Cobalt", "Navy", "Teal", "Azure"] },
      { label: "Currencies", color: "#f472b6", items: ["Yen", "Euro", "Pound", "Peso"] },
    ],
  },
];

type Phase = "lobby" | "playing" | "results";

export default function ConnectionsScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }

  const [phase, setPhase] = useState<Phase>("lobby");
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [solved, setSolved] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState(0);
  const [mpSelected, setMpSelected] = useState<string[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  if (inRoom && mpState) {
    const mp = mpState;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ padding: 24 }}>
              <View style={{alignItems:"center",padding:24}}>
                <Text style={{fontSize:48}}>🏆</Text>
                <Text style={{color:"#fff",fontSize:24,fontWeight:"900",marginBottom:20}}>Final Scores</Text>
                {Object.entries(mp.scores||{}).sort(([,a],[,b])=>(b as number)-(a as number)).map(([gId,pts],i)=>(
                  <View key={gId} style={{flexDirection:"row",justifyContent:"space-between",width:"100%",marginBottom:8}}>
                    <Text style={{color:"#ccc",fontSize:16}}>{i+1}. {memberName(gId)}</Text>
                    <Text style={{color:"#a78bfa",fontSize:16,fontWeight:"700"}}>{pts as number} pts</Text>
                  </View>
                ))}
                <TouchableOpacity onPress={()=>router.back()} style={{marginTop:24,padding:12}}>
                  <Text style={{color:"#666"}}>← Back</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "playing") {
      const puzzle = mp.currentPuzzle;
      const allItems: string[] = puzzle ? puzzle.groups.flatMap((g: any) => g.items) : [];
      const mpSolved: string[] = mp.solved ?? [];
      const remaining = allItems.filter(item => !mpSolved.includes(item));
      const solvedGroups: any[] = puzzle ? puzzle.groups.filter((g: any) => mpSolved.includes(g.items[0])) : [];

      function mpToggle(item: string) {
        if (mpSolved.includes(item)) return;
        setMpSelected(sel => sel.includes(item) ? sel.filter(s => s !== item) : sel.length < 4 ? [...sel, item] : sel);
      }

      return (
        <LinearGradient colors={["#03001c","#1a1000"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topBar}>
              <Text style={s.prog}>Connections</Text>
              <Text style={s.scoreC}>{mp.scores?.[myGuestId ?? ""] ?? 0} pts</Text>
            </View>
            {solvedGroups.map((g: any) => (
              <View key={g.label} style={[s.solvedRow, { backgroundColor: g.color + "33", borderColor: g.color }]}>
                <Text style={[s.solvedLabel, { color: g.color }]}>{g.label}</Text>
                <Text style={s.solvedItems}>{g.items.join(" · ")}</Text>
              </View>
            ))}
            <View style={s.grid}>
              {remaining.map((item: string) => {
                const isSel = mpSelected.includes(item);
                return (
                  <TouchableOpacity key={item} onPress={() => mpToggle(item)} activeOpacity={0.8} style={[s.cell, isSel && s.cellSelected]}>
                    <LinearGradient colors={isSel ? ["#7209b7","#b5179e"] : ["#1a1a3a","#2a1a4a"]} style={s.cellInner}>
                      <Text style={s.cellText}>{item}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={s.actions}>
              <TouchableOpacity onPress={() => setMpSelected([])} style={s.clearBtn}><Text style={s.clearText}>Deselect</Text></TouchableOpacity>
              <TouchableOpacity
                onPress={() => { if (mpSelected.length === 4) { sendAction("submit_group", { items: mpSelected }); setMpSelected([]); } }}
                disabled={mpSelected.length !== 4}
                style={[s.submitBtn, mpSelected.length !== 4 && { opacity: 0.4 }]}
              >
                <LinearGradient colors={["#b5179e","#7209b7"]} style={s.submitBtnI}>
                  <Text style={s.submitBtnT}>Submit ({mpSelected.length}/4)</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }
  }

  function startGame() { setPhase("playing"); setPuzzleIdx(0); setSelected([]); setSolved([]); setMistakes(0); setScore(0); }

  function toggleItem(item: string) {
    if (solved.includes(item)) return;
    setSelected((sel) => sel.includes(item) ? sel.filter((s) => s !== item) : sel.length < 4 ? [...sel, item] : sel);
  }

  function submitGroup() {
    if (selected.length !== 4) return;
    const puzzle = PUZZLES[puzzleIdx];
    const match = puzzle.groups.find((g) =>
      selected.every((s) => g.items.includes(s)) && g.items.every((i) => selected.includes(i))
    );
    if (match) {
      setSolved((s) => [...s, ...match.items]);
      setSelected([]);
      setScore((sc) => sc + (4 - mistakes) * 100 + 200);
      if (solved.length + 4 >= puzzle.groups.length * 4) {
        if (puzzleIdx + 1 >= PUZZLES.length) setPhase("results");
        else { setPuzzleIdx((i) => i + 1); setSolved([]); setMistakes(0); setSelected([]); }
      }
    } else {
      setMistakes((m) => m + 1);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start();
      setSelected([]);
    }
  }

  const puzzle = PUZZLES[puzzleIdx];
  const allItems = puzzle?.groups.flatMap((g) => g.items).sort(() => (Math.random() > 0.5 ? 1 : -1)) ?? [];

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#1a1000"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🔗</Text>
          <Text style={s.title}>Connections</Text>
          <Text style={s.sub}>16 words — find the 4 groups of 4 that share a connection. Pick 4 and submit!</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>FIND CONNECTIONS</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <LinearGradient colors={["#03001c","#1a1000"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🔗</Text>
          <Text style={s.title}>Puzzle Solved!</Text>
          <Text style={s.bigScore}>{score}</Text>
          <Text style={s.label}>{mistakes} mistakes total</Text>
          <Text style={s.verdict}>{mistakes === 0 ? "🧠 Perfect!" : mistakes <= 3 ? "👍 Sharp!" : "💪 Finished it!"}</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>PLAY AGAIN</Text></LinearGradient></TouchableOpacity>
          <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}><Text style={s.homeBtnT}>Back to Home</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  return (
    <LinearGradient colors={["#03001c","#1a1000"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}>
          <Text style={s.prog}>Puzzle {puzzleIdx+1}/{PUZZLES.length}</Text>
          <Text style={s.mistakes}>❌ {mistakes} mistakes</Text>
          <Text style={s.scoreC}>{score} pts</Text>
        </View>
        {puzzle.groups.filter((g) => solved.includes(g.items[0])).map((g) => (
          <View key={g.label} style={[s.solvedRow, { backgroundColor: g.color + "33", borderColor: g.color }]}>
            <Text style={[s.solvedLabel, { color: g.color }]}>{g.label}</Text>
            <Text style={s.solvedItems}>{g.items.join(" · ")}</Text>
          </View>
        ))}
        <Animated.View style={[s.grid, { transform: [{ translateX: shakeAnim }] }]}>
          {puzzle.groups.flatMap((g) => g.items).filter((item) => !solved.includes(item)).sort(() => (Math.random() > 0.9 ? 1 : 0)).map((item) => {
            const isSelected = selected.includes(item);
            return (
              <TouchableOpacity key={item} onPress={() => toggleItem(item)} activeOpacity={0.8} style={[s.cell, isSelected && s.cellSelected]}>
                <LinearGradient colors={isSelected ? ["#7209b7","#b5179e"] : ["#1a1a3a","#2a1a4a"]} style={s.cellInner}>
                  <Text style={s.cellText}>{item}</Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
        <View style={s.actions}>
          <TouchableOpacity onPress={() => setSelected([])} style={s.clearBtn} activeOpacity={0.8}><Text style={s.clearText}>Deselect</Text></TouchableOpacity>
          <TouchableOpacity onPress={submitGroup} disabled={selected.length !== 4} style={[s.submitBtn, selected.length !== 4 && { opacity: 0.4 }]} activeOpacity={0.85}>
            <LinearGradient colors={["#b5179e","#7209b7"]} style={s.submitBtnI}><Text style={s.submitBtnT}>Submit ({selected.length}/4)</Text></LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex:{flex:1}, back:{padding:16,paddingTop:8}, backText:{color:"#a78bfa",fontSize:16,fontWeight:"700"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:24},
  title:{color:"#fff",fontSize:28,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:24},
  btn:{width:"100%",borderRadius:14,overflow:"hidden",marginBottom:12},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,marginBottom:12},
  verdict:{color:"#a78bfa",fontSize:16,fontWeight:"700",marginBottom:28},
  topBar:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:20,paddingVertical:12},
  prog:{color:"#888",fontWeight:"700"}, mistakes:{color:"#f87171",fontWeight:"800"}, scoreC:{color:"#a78bfa",fontWeight:"800"},
  solvedRow:{marginHorizontal:12,marginBottom:4,borderRadius:10,padding:10,borderWidth:1},
  solvedLabel:{fontSize:10,fontWeight:"900",letterSpacing:1,marginBottom:2},
  solvedItems:{color:"#fff",fontSize:13,fontWeight:"700"},
  grid:{flexDirection:"row",flexWrap:"wrap",paddingHorizontal:12,gap:6,flex:1,alignContent:"flex-start",paddingTop:8},
  cell:{width:"23%",borderRadius:10,overflow:"hidden"},
  cellSelected:{shadowColor:"#b5179e",shadowRadius:8,shadowOpacity:0.5,elevation:6},
  cellInner:{padding:12,alignItems:"center",minHeight:52,justifyContent:"center"},
  cellText:{color:"#fff",fontSize:13,fontWeight:"700",textAlign:"center"},
  actions:{flexDirection:"row",gap:10,padding:12,paddingBottom:20},
  clearBtn:{flex:1,backgroundColor:"#1a1a3a",borderRadius:12,padding:14,alignItems:"center"},
  clearText:{color:"#888",fontSize:14,fontWeight:"700"},
  submitBtn:{flex:2,borderRadius:12,overflow:"hidden"},
  submitBtnI:{padding:14,alignItems:"center"}, submitBtnT:{color:"#fff",fontSize:14,fontWeight:"900"},
});
