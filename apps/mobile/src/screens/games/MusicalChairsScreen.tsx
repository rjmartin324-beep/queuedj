import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";
import { PostGameCard } from "../../components/shared/PostGameCard";

// Digital musical chairs: tap your seat when music "stops"
type Phase = "lobby" | "round" | "stopped" | "eliminated" | "results";

export default function MusicalChairsScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const startedInRoom = useRef(!!state.room);
  const inRoom = startedInRoom.current && !!state.room;
  const mpState = inRoom ? (state.guestViewData as any) : null;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [mpTapped, setMpTapped] = useState(false);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [players, setPlayers] = useState(4);
  const [round, setRound] = useState(1);
  const [seats, setSeats] = useState(3);
  const [tapped, setTapped] = useState(false);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [musicDuration, setMusicDuration] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation|null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(() => {
    return () => {
      pulseRef.current?.stop();
      clearTimeout(stopTimerRef.current!);
    };
  }, []);

  if (inRoom && mpState) {
    const mp = mpState;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{fontSize:48,marginBottom:12}}>🪑</Text>
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
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "music_playing") {
      return (
        <LinearGradient colors={["#03001c","#001020"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12}}>
              <Text style={{color:"#888",fontWeight:"700"}}>Round {mp.round}</Text>
              <Text style={{color:"#a78bfa",fontWeight:"800"}}>{mp.scores?.[myGuestId??""]} pts</Text>
            </View>
            <View style={{flex:1,alignItems:"center",justifyContent:"center"}}>
              <Text style={{fontSize:72}}>🎵</Text>
              <Text style={{color:"#fff",fontSize:24,fontWeight:"900",marginTop:16}}>Music is playing…</Text>
              <Text style={{color:"#888",fontSize:15,marginTop:8}}>Get ready to grab a seat!</Text>
              <Text style={{color:"#555",fontSize:13,marginTop:4}}>{mp.seats} seats · {mp.playerCount} players</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "scramble") {
      return (
        <LinearGradient colors={["#03001c","#001020"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flex:1,alignItems:"center",justifyContent:"center"}}>
              <Text style={{fontSize:72}}>🛑</Text>
              <Text style={{color:"#fff",fontSize:24,fontWeight:"900",marginTop:16}}>MUSIC STOPPED!</Text>
              <Text style={{color:"#dc2626",fontSize:18,fontWeight:"900",marginTop:8}}>TAP YOUR SEAT NOW!</Text>
            </View>
            <View style={{flexDirection:"row",justifyContent:"center",flexWrap:"wrap",gap:16,paddingHorizontal:20,paddingBottom:40}}>
              {Array.from({length: mp.seats??1}).map((_,i)=>(
                <TouchableOpacity key={i} onPress={()=>{if(!mpTapped){setMpTapped(true);sendAction("tap_seat",{});}}} disabled={mpTapped} style={{width:80,height:80,backgroundColor:mpTapped&&i===0?"rgba(22,163,74,0.3)":"#1a1a3a",borderRadius:16,alignItems:"center",justifyContent:"center",borderWidth:mpTapped&&i===0?2:0,borderColor:"#16a34a"}} activeOpacity={0.7}>
                  <Text style={{fontSize:40}}>🪑</Text>
                </TouchableOpacity>
              ))}
            </View>
            {mpTapped && <Text style={{color:"#4ade80",fontSize:18,fontWeight:"900",textAlign:"center",paddingBottom:16}}>✓ Seat secured!</Text>}
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "elimination") {
      return (
        <LinearGradient colors={["#03001c","#001020"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{color:"#fff",fontSize:22,fontWeight:"900",marginBottom:16}}>Eliminated!</Text>
              {mp.eliminated && (
                <Text style={{color:"#f87171",fontSize:16,marginBottom:16}}>{memberName(mp.eliminated)} is out!</Text>
              )}
              {Object.entries(mp.scores||{}).sort(([,a],[,b])=>(b as number)-(a as number)).map(([gId,pts],i)=>(
                <View key={gId} style={{flexDirection:"row",justifyContent:"space-between",width:"100%",marginBottom:8}}>
                  <Text style={{color:"#ccc",fontSize:15}}>{i+1}. {memberName(gId)}</Text>
                  <Text style={{color:"#a78bfa",fontSize:15,fontWeight:"700"}}>{pts as number} pts</Text>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    return (
      <LinearGradient colors={["#03001c","#001020"]} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <View style={{flex:1,alignItems:"center",justifyContent:"center"}}>
            <Text style={{color:"#888",fontSize:16}}>Waiting…</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const ALL_PLAYERS = ["You", "Alex", "Jordan", "Sam", "Riley", "Casey"];

  function startGame() {
    setPhase("round");
    setRound(1);
    setSeats(3);
    setPlayers(4);
    setTapped(false);
    setEliminated([]);
    setScore(0);
    startMusic(4, 3, 1);
  }

  function startMusic(pCount: number, sCount: number, r: number) {
    setPhase("round");
    setTapped(false);
    const dur = 3000 + Math.random() * 4000;
    setMusicDuration(Math.round(dur / 1000));

    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 300, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ])
    );
    pulseRef.current.start();

    stopTimerRef.current = setTimeout(() => {
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
      setPhase("stopped");
    }, dur);
  }

  function tapSeat() {
    if (tapped || phase !== "stopped") return;
    setTapped(true);
    setScore((s) => s + 500);
    setTimeout(() => nextRound(true), 1000);
  }

  function nextRound(survived: boolean) {
    const newSeats = seats - 1;
    const newPlayers = players - 1;
    if (!survived || newSeats <= 0 || newPlayers <= 1) {
      setPhase("results");
      return;
    }
    setSeats(newSeats);
    setPlayers(newPlayers);
    const r = round + 1;
    setRound(r);
    setEliminated((e) => [...e, ALL_PLAYERS[ALL_PLAYERS.length - e.length - 1] ?? "Player"]);
    startMusic(newPlayers, newSeats, r);
  }

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#001020"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🪑🎵</Text>
          <Text style={s.title}>Musical Chairs</Text>
          <Text style={s.sub}>Music plays, music stops — tap your seat before the others! Last one standing wins.</Text>
          <View style={s.rules}>{["Music plays for random duration","When it stops: TAP FAST!","Slowest player is eliminated","500 pts per round survived"].map((r,i)=><Text key={i} style={s.rule}>• {r}</Text>)}</View>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>START GAME</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <PostGameCard
      score={score}
      maxScore={500}
      gameEmoji="🪑"
      gameTitle="Musical Chairs"
      onPlayAgain={startGame}
    />
  );

  const musicPlaying = phase === "round";
  return (
    <LinearGradient colors={["#03001c","#001020"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}>
          <Text style={s.prog}>Round {round}</Text>
          <Text style={s.seatsInfo}>{seats} seats · {players} players</Text>
          <Text style={s.scoreC}>{score} pts</Text>
        </View>

        <View style={s.statusSection}>
          {musicPlaying ? (
            <>
              <Animated.Text style={[s.musicEmoji, { transform: [{ scale: pulseAnim }] }]}>🎵</Animated.Text>
              <Text style={s.statusText}>Music is playing…</Text>
              <Text style={s.statusSub}>Get ready to grab a seat!</Text>
            </>
          ) : (
            <>
              <Text style={s.stopEmoji}>🛑</Text>
              <Text style={s.statusText}>MUSIC STOPPED!</Text>
              <Text style={[s.statusSub, { color: "#dc2626" }]}>TAP YOUR SEAT NOW!</Text>
            </>
          )}
        </View>

        <View style={s.seatsRow}>
          {Array.from({ length: seats }).map((_, i) => (
            <Animated.View key={i} style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                onPress={tapSeat}
                disabled={musicPlaying || tapped}
                style={[s.seatBtn, tapped && i === 0 && s.seatTapped]}
                activeOpacity={0.7}
              >
                <Text style={s.seatEmoji}>🪑</Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        {tapped && <Text style={s.tappedText}>✓ Seat secured! +500 pts</Text>}
        {phase === "stopped" && !tapped && (
          <Text style={s.tapHint}>👆 TAP A CHAIR!</Text>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex:{flex:1}, back:{padding:16,paddingTop:8}, backText:{color:"#a78bfa",fontSize:16,fontWeight:"700"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:24},
  title:{color:"#fff",fontSize:28,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:20},
  rules:{backgroundColor:"rgba(255,255,255,0.06)",borderRadius:14,padding:14,width:"100%",marginBottom:28},
  rule:{color:"#ccc",fontSize:13,marginBottom:5},
  btn:{width:"100%",borderRadius:14,overflow:"hidden",marginBottom:12},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,marginBottom:12},
  elimText:{color:"#888",fontSize:13,marginBottom:24,textAlign:"center"},
  topBar:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:20,paddingVertical:12},
  prog:{color:"#888",fontWeight:"700"}, seatsInfo:{color:"#fff",fontWeight:"800"}, scoreC:{color:"#a78bfa",fontWeight:"800"},
  statusSection:{flex:1,alignItems:"center",justifyContent:"center"},
  musicEmoji:{fontSize:72},
  stopEmoji:{fontSize:72},
  statusText:{color:"#fff",fontSize:24,fontWeight:"900",marginTop:16},
  statusSub:{color:"#888",fontSize:15,marginTop:8},
  seatsRow:{flexDirection:"row",justifyContent:"center",flexWrap:"wrap",gap:16,paddingHorizontal:20,paddingBottom:20},
  seatBtn:{width:80,height:80,backgroundColor:"#1a1a3a",borderRadius:16,alignItems:"center",justifyContent:"center"},
  seatTapped:{backgroundColor:"rgba(22,163,74,0.3)",borderWidth:2,borderColor:"#16a34a"},
  seatEmoji:{fontSize:40},
  tappedText:{color:"#4ade80",fontSize:18,fontWeight:"900",textAlign:"center",paddingBottom:16},
  tapHint:{color:"#dc2626",fontSize:20,fontWeight:"900",textAlign:"center",paddingBottom:16},
});
