import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";
import { HostActionButton } from "../HostActionButton";
import { TriviaQuestionView } from "../../experiences/trivia/TriviaQuestionView";
import { TriviaWaitingView }  from "../../experiences/trivia/TriviaWaitingView";
import { LeaderboardView }    from "../../experiences/trivia/LeaderboardView";

// ─────────────────────────────────────────────────────────────────────────────
// Question banks
// ─────────────────────────────────────────────────────────────────────────────

type QType = "direct" | "close_call" | "detail" | "trick";

interface Q {
  id: string;
  category: string;
  type: QType;
  text: string;
  options: string[];
  answer: number;
}

// ── STANDARD BANK (60 questions — mixed, fun, party-style) ───────────────────

const STANDARD_BANK: Q[] = [
  // Music
  { id: "m1",  type: "direct",     category: "Music",        text: "Which band released the iconic album 'Abbey Road'?",                       options: ["The Rolling Stones","The Beatles","Led Zeppelin","Pink Floyd"],          answer: 1 },
  { id: "m2",  type: "direct",     category: "Music",        text: "Which singer is known as the 'Queen of Pop'?",                             options: ["Beyoncé","Rihanna","Madonna","Lady Gaga"],                               answer: 2 },
  { id: "m3",  type: "close_call", category: "Music",        text: "How many strings does a standard guitar have?",                           options: ["4","5","6","7"],                                                         answer: 2 },
  { id: "m4",  type: "direct",     category: "Music",        text: "Which singer's real name is Stefani Germanotta?",                         options: ["Katy Perry","Lady Gaga","Adele","Billie Eilish"],                        answer: 1 },
  { id: "m5",  type: "direct",     category: "Music",        text: "What is the best-selling album of all time worldwide?",                   options: ["Thriller","Back in Black","The Dark Side of the Moon","Hotel California"], answer: 0 },
  { id: "m6",  type: "detail",     category: "Music",        text: "Which instrument does Yo-Yo Ma play?",                                   options: ["Violin","Cello","Viola","Double Bass"],                                  answer: 1 },

  // Pop Culture
  { id: "p1",  type: "direct",     category: "Pop Culture",  text: "What streaming service produced 'Stranger Things'?",                     options: ["HBO","Amazon Prime","Disney+","Netflix"],                                answer: 3 },
  { id: "p2",  type: "direct",     category: "Pop Culture",  text: "What year was the first iPhone released?",                               options: ["2005","2006","2007","2008"],                                             answer: 2 },
  { id: "p3",  type: "detail",     category: "Pop Culture",  text: "Which film won the Academy Award for Best Picture in 1994?",             options: ["Pulp Fiction","Forrest Gump","The Shawshank Redemption","Speed"],        answer: 1 },
  { id: "p4",  type: "trick",      category: "Pop Culture",  text: "How many 'Rocky' films did Sylvester Stallone direct himself?",          options: ["1","2","3","4"],                                                         answer: 2 },
  { id: "p5",  type: "direct",     category: "Pop Culture",  text: "Which TV show is set in the fictional city of Pawnee, Indiana?",         options: ["The Office","Parks and Recreation","Community","30 Rock"],               answer: 1 },

  // Harry Potter
  { id: "hp1", type: "direct",     category: "Harry Potter", text: "What is the name of Harry Potter's owl?",                               options: ["Errol","Pigwidgeon","Crookshanks","Hedwig"],                             answer: 3 },
  { id: "hp2", type: "direct",     category: "Harry Potter", text: "Which house does Harry Potter belong to at Hogwarts?",                  options: ["Hufflepuff","Ravenclaw","Slytherin","Gryffindor"],                       answer: 3 },
  { id: "hp3", type: "close_call", category: "Harry Potter", text: "What is the core of Harry Potter's wand?",                             options: ["Dragon heartstring","Unicorn hair","Veela hair","Phoenix feather"],       answer: 3 },
  { id: "hp4", type: "detail",     category: "Harry Potter", text: "In which vault at Gringotts is the Philosopher's Stone originally kept?", options: ["Vault 512","Vault 713","Vault 687","Vault 1023"],                       answer: 1 },
  { id: "hp5", type: "direct",     category: "Harry Potter", text: "What is the incantation for the Patronus Charm?",                      options: ["Expecto Patronum","Expelliarmus","Patronus Charm","Protego"],             answer: 0 },
  { id: "hp6", type: "close_call", category: "Harry Potter", text: "What does the spell 'Alohomora' do?",                                  options: ["Levitates objects","Unlocks doors","Creates fire","Silences sounds"],     answer: 1 },
  { id: "hp7", type: "detail",     category: "Harry Potter", text: "How many Horcruxes did Voldemort create intentionally?",               options: ["5","6","7","8"],                                                         answer: 1 },

  // Lord of the Rings
  { id: "lt1", type: "direct",     category: "LOTR",         text: "What is the name of Gandalf the Grey's horse?",                        options: ["Shadowfax","Hasufel","Arod","Bill"],                                     answer: 0 },
  { id: "lt2", type: "direct",     category: "LOTR",         text: "What creature is Gollum?",                                            options: ["Hobbit","Elf","Stoor Hobbit","Dwarf"],                                   answer: 2 },
  { id: "lt3", type: "close_call", category: "LOTR",         text: "In what fictional land was the One Ring forged?",                     options: ["The Shire","Rivendell","Mordor","Rohan"],                                answer: 2 },
  { id: "lt4", type: "detail",     category: "LOTR",         text: "How many members are in the Fellowship of the Ring?",                 options: ["7","8","9","10"],                                                        answer: 2 },
  { id: "lt5", type: "direct",     category: "LOTR",         text: "Who wrote 'The Lord of the Rings'?",                                  options: ["C.S. Lewis","J.R.R. Tolkien","George R.R. Martin","Terry Pratchett"],    answer: 1 },
  { id: "lt6", type: "trick",      category: "LOTR",         text: "What is the elvish name for the One Ring's inscription language?",    options: ["Quenya","Sindarin","Tengwar","Black Speech"],                            answer: 3 },

  // Dune
  { id: "du1", type: "direct",     category: "Dune",         text: "What is the valuable substance that makes space travel possible in Dune?", options: ["Spice Melange","Dilithium","Dark Matter","Solaris"],               answer: 0 },
  { id: "du2", type: "direct",     category: "Dune",         text: "What is the desert planet in Dune called?",                          options: ["Caladan","Giedi Prime","Geidi","Arrakis"],                               answer: 3 },
  { id: "du3", type: "close_call", category: "Dune",         text: "Who is the main protagonist of the original Dune novel?",            options: ["Duncan Idaho","Gurney Halleck","Paul Atreides","Leto Atreides"],          answer: 2 },
  { id: "du4", type: "detail",     category: "Dune",         text: "What are the giant sandworms of Arrakis called by the Fremen?",       options: ["Shai-Hulud","Sandstrider","Wormrider","Rakis"],                          answer: 0 },
  { id: "du5", type: "direct",     category: "Dune",         text: "Who wrote the novel 'Dune'?",                                         options: ["Isaac Asimov","Arthur C. Clarke","Frank Herbert","Philip K. Dick"],      answer: 2 },

  // Science
  { id: "s1",  type: "close_call", category: "Science",      text: "What is the chemical symbol for gold?",                              options: ["Gd","Go","Au","Ag"],                                                     answer: 2 },
  { id: "s2",  type: "close_call", category: "Science",      text: "How many bones are in the adult human body?",                        options: ["196","206","216","226"],                                                 answer: 1 },
  { id: "s3",  type: "direct",     category: "Science",      text: "What gas do plants absorb to perform photosynthesis?",               options: ["Oxygen","Nitrogen","Hydrogen","Carbon Dioxide"],                         answer: 3 },
  { id: "s4",  type: "detail",     category: "Science",      text: "What is the hardest natural substance on Earth?",                    options: ["Gold","Iron","Diamond","Quartz"],                                        answer: 2 },
  { id: "s5",  type: "direct",     category: "Science",      text: "Which planet has the Great Red Spot storm?",                         options: ["Saturn","Neptune","Uranus","Jupiter"],                                   answer: 3 },
  { id: "s6",  type: "close_call", category: "Science",      text: "Which element has the chemical symbol 'Fe'?",                       options: ["Fluorine","Iron","Francium","Fermium"],                                  answer: 1 },
  { id: "s7",  type: "detail",     category: "Science",      text: "Which planet has the most confirmed moons in our solar system?",     options: ["Jupiter","Mars","Uranus","Saturn"],                                      answer: 3 },
  { id: "s8",  type: "direct",     category: "Science",      text: "What is the speed of light approximately?",                         options: ["100,000 km/s","200,000 km/s","300,000 km/s","400,000 km/s"],            answer: 2 },
  { id: "s9",  type: "trick",      category: "Science",      text: "What is the closest star to Earth?",                                options: ["Alpha Centauri","Proxima Centauri","Sirius","The Sun"],                   answer: 3 },
  { id: "s10", type: "detail",     category: "Science",      text: "What is the powerhouse of the cell?",                               options: ["Nucleus","Ribosome","Mitochondria","Golgi Apparatus"],                   answer: 2 },

  // Geography
  { id: "g1",  type: "direct",     category: "Geography",    text: "What is the capital of Australia?",                                  options: ["Sydney","Melbourne","Brisbane","Canberra"],                              answer: 3 },
  { id: "g2",  type: "direct",     category: "Geography",    text: "Which is the world's largest ocean?",                               options: ["Atlantic","Indian","Arctic","Pacific"],                                  answer: 3 },
  { id: "g3",  type: "close_call", category: "Geography",    text: "Which river is the longest in the world?",                          options: ["Amazon","Mississippi","Nile","Yangtze"],                                answer: 2 },
  { id: "g4",  type: "detail",     category: "Geography",    text: "Which country has the most time zones?",                            options: ["Russia","USA","China","France"],                                         answer: 3 },
  { id: "g5",  type: "direct",     category: "Geography",    text: "What is the capital of Canada?",                                    options: ["Toronto","Vancouver","Ottawa","Montreal"],                               answer: 2 },
  { id: "g6",  type: "direct",     category: "Geography",    text: "Which country contains the most of the Amazon rainforest?",         options: ["Colombia","Peru","Venezuela","Brazil"],                                  answer: 3 },
  { id: "g7",  type: "close_call", category: "Geography",    text: "What is the capital of Australia's state of Victoria?",             options: ["Sydney","Melbourne","Adelaide","Perth"],                                 answer: 1 },
  { id: "g8",  type: "detail",     category: "Geography",    text: "How many countries share a border with Germany?",                   options: ["7","8","9","10"],                                                        answer: 2 },

  // History
  { id: "h1",  type: "direct",     category: "History",      text: "In what year did World War II end?",                                options: ["1943","1944","1945","1946"],                                             answer: 2 },
  { id: "h2",  type: "direct",     category: "History",      text: "Who was the first person to walk on the Moon?",                     options: ["Buzz Aldrin","Yuri Gagarin","Neil Armstrong","John Glenn"],              answer: 2 },
  { id: "h3",  type: "detail",     category: "History",      text: "Who was the U.S. president during the Louisiana Purchase?",         options: ["George Washington","John Adams","Thomas Jefferson","James Madison"],     answer: 2 },
  { id: "h4",  type: "close_call", category: "History",      text: "In which year did the Berlin Wall fall?",                           options: ["1987","1988","1989","1990"],                                             answer: 2 },
  { id: "h5",  type: "direct",     category: "History",      text: "Which ancient wonder was located in Alexandria, Egypt?",            options: ["Hanging Gardens","Colossus of Rhodes","The Great Lighthouse","Pyramids"], answer: 2 },
  { id: "h6",  type: "close_call", category: "History",      text: "In which year was the Declaration of Independence signed?",         options: ["1774","1775","1776","1777"],                                             answer: 2 },
  { id: "h7",  type: "detail",     category: "History",      text: "Which empire was the largest in history by land area?",            options: ["Roman Empire","British Empire","Mongol Empire","Ottoman Empire"],         answer: 2 },

  // Sports
  { id: "sp1", type: "direct",     category: "Sports",       text: "Which country has won the most FIFA World Cups?",                   options: ["Germany","Argentina","Italy","Brazil"],                                  answer: 3 },
  { id: "sp2", type: "direct",     category: "Sports",       text: "What sport is played at Wimbledon?",                               options: ["Golf","Cricket","Tennis","Polo"],                                        answer: 2 },
  { id: "sp3", type: "close_call", category: "Sports",       text: "How many players are on a basketball team on the court at once?",  options: ["4","5","6","7"],                                                         answer: 1 },
  { id: "sp4", type: "trick",      category: "Sports",       text: "In a standard marathon, which distance is correct?",               options: ["26.1 miles","26.2 miles","26.3 miles","26.4 miles"],                     answer: 1 },

  // Food
  { id: "f1",  type: "direct",     category: "Food",         text: "Which country is the original home of pizza?",                     options: ["France","Greece","Italy","Spain"],                                       answer: 2 },
  { id: "f2",  type: "direct",     category: "Food",         text: "What is the main ingredient in guacamole?",                        options: ["Tomato","Avocado","Jalapeño","Lime"],                                    answer: 1 },

  // General
  { id: "q1",  type: "direct",     category: "General",      text: "How many sides does a hexagon have?",                              options: ["5","6","7","8"],                                                         answer: 1 },
  { id: "q2",  type: "close_call", category: "General",      text: "What is the square root of 144?",                                  options: ["10","11","12","13"],                                                     answer: 2 },
  { id: "q3",  type: "direct",     category: "General",      text: "Which planet is known as the 'Red Planet'?",                       options: ["Venus","Jupiter","Saturn","Mars"],                                       answer: 3 },
  { id: "q4",  type: "trick",      category: "General",      text: "Which of these is NOT a prime number?",                            options: ["2","3","5","9"],                                                         answer: 3 },
];

// ── COMPETITIVE BANK (50 questions — strict balance, no joke answers) ─────────

const COMPETITIVE_BANK: Q[] = [
  // DIRECT KNOWLEDGE ≈ 50%
  { id: "c_d1",  type: "direct",     category: "Geography",    text: "What is the capital of Italy?",                                            options: ["Milan","Rome","Venice","Naples"],                                        answer: 1 },
  { id: "c_d2",  type: "direct",     category: "Science",      text: "Which gas makes up the majority of Earth's atmosphere?",                   options: ["Oxygen","Carbon Dioxide","Argon","Nitrogen"],                            answer: 3 },
  { id: "c_d3",  type: "direct",     category: "History",      text: "Which country gifted the Statue of Liberty to the United States?",         options: ["England","Germany","France","Spain"],                                    answer: 2 },
  { id: "c_d4",  type: "direct",     category: "Science",      text: "What is the chemical formula for water?",                                  options: ["HO","H2O","H3O","H2O2"],                                                answer: 1 },
  { id: "c_d5",  type: "direct",     category: "Geography",    text: "What is the largest continent by land area?",                             options: ["Africa","North America","Antarctica","Asia"],                            answer: 3 },
  { id: "c_d6",  type: "direct",     category: "History",      text: "In what year did the Titanic sink?",                                       options: ["1908","1910","1912","1914"],                                             answer: 2 },
  { id: "c_d7",  type: "direct",     category: "Geography",    text: "What is the capital of Japan?",                                           options: ["Kyoto","Osaka","Hiroshima","Tokyo"],                                     answer: 3 },
  { id: "c_d8",  type: "direct",     category: "Science",      text: "What is the closest planet to the Sun?",                                  options: ["Venus","Earth","Mercury","Mars"],                                        answer: 2 },
  { id: "c_d9",  type: "direct",     category: "History",      text: "Who was the first President of the United States?",                       options: ["John Adams","Benjamin Franklin","Thomas Jefferson","George Washington"],  answer: 3 },
  { id: "c_d10", type: "direct",     category: "Harry Potter", text: "What is the name of Harry Potter's owl?",                               options: ["Errol","Pigwidgeon","Crookshanks","Hedwig"],                             answer: 3 },
  { id: "c_d11", type: "direct",     category: "Harry Potter", text: "Which house does Harry Potter belong to at Hogwarts?",                  options: ["Hufflepuff","Ravenclaw","Slytherin","Gryffindor"],                       answer: 3 },
  { id: "c_d12", type: "direct",     category: "LOTR",         text: "Who wrote 'The Lord of the Rings'?",                                  options: ["C.S. Lewis","J.R.R. Tolkien","George R.R. Martin","Terry Pratchett"],    answer: 1 },
  { id: "c_d13", type: "direct",     category: "Dune",         text: "Who wrote the novel 'Dune'?",                                         options: ["Isaac Asimov","Arthur C. Clarke","Frank Herbert","Philip K. Dick"],      answer: 2 },
  { id: "c_d14", type: "direct",     category: "Dune",         text: "What is the desert planet in Dune called?",                          options: ["Caladan","Giedi Prime","Kaitain","Arrakis"],                             answer: 3 },
  { id: "c_d15", type: "direct",     category: "Science",      text: "Which planet has the Great Red Spot storm?",                         options: ["Saturn","Neptune","Uranus","Jupiter"],                                   answer: 3 },
  { id: "c_d16", type: "direct",     category: "Geography",    text: "What is the capital of Canada?",                                    options: ["Toronto","Vancouver","Ottawa","Montreal"],                               answer: 2 },
  { id: "c_d17", type: "direct",     category: "History",      text: "In what year did World War I begin?",                               options: ["1912","1913","1914","1915"],                                             answer: 2 },
  { id: "c_d18", type: "direct",     category: "Harry Potter", text: "What is the incantation for the Patronus Charm?",                  options: ["Expecto Patronum","Expelliarmus","Lumos","Protego"],                     answer: 0 },
  { id: "c_d19", type: "direct",     category: "LOTR",         text: "What is the name of Gandalf's horse?",                            options: ["Shadowfax","Hasufel","Arod","Roheryn"],                                  answer: 0 },
  { id: "c_d20", type: "direct",     category: "Geography",    text: "Which country contains the most of the Amazon rainforest?",         options: ["Colombia","Peru","Venezuela","Brazil"],                                  answer: 3 },
  { id: "c_d21", type: "direct",     category: "Science",      text: "What is the powerhouse of the cell?",                               options: ["Nucleus","Ribosome","Mitochondria","Golgi Apparatus"],                   answer: 2 },
  { id: "c_d22", type: "direct",     category: "History",      text: "Which empire was ruled by Julius Caesar?",                         options: ["Greek","Roman","Ottoman","Persian"],                                     answer: 1 },
  { id: "c_d23", type: "direct",     category: "Dune",         text: "What is the valuable substance that makes space travel possible in Dune?", options: ["Spice Melange","Dilithium","Dark Matter","Solaris"],             answer: 0 },

  // CLOSE CALLS ≈ 25%
  { id: "c_cc1", type: "close_call", category: "Science",      text: "Which element has the chemical symbol 'Fe'?",                             options: ["Fluorine","Iron","Francium","Fermium"],                                  answer: 1 },
  { id: "c_cc2", type: "close_call", category: "Geography",    text: "Which river is the longest in the world?",                               options: ["Amazon","Congo","Nile","Mississippi"],                                   answer: 2 },
  { id: "c_cc3", type: "close_call", category: "History",      text: "In what year was the Declaration of Independence signed?",                options: ["1774","1775","1776","1777"],                                             answer: 2 },
  { id: "c_cc4", type: "close_call", category: "Science",      text: "How many bones are in the adult human body?",                            options: ["196","206","216","226"],                                                 answer: 1 },
  { id: "c_cc5", type: "close_call", category: "Harry Potter", text: "What is the core of Harry Potter's wand?",                             options: ["Dragon heartstring","Unicorn hair","Veela hair","Phoenix feather"],       answer: 3 },
  { id: "c_cc6", type: "close_call", category: "LOTR",         text: "How many members are in the Fellowship of the Ring?",                 options: ["7","8","9","10"],                                                        answer: 2 },
  { id: "c_cc7", type: "close_call", category: "Science",      text: "Approximately how fast does light travel per second?",                   options: ["100,000 km/s","200,000 km/s","300,000 km/s","400,000 km/s"],            answer: 2 },
  { id: "c_cc8", type: "close_call", category: "History",      text: "In which year did the Berlin Wall fall?",                           options: ["1987","1988","1989","1990"],                                             answer: 2 },
  { id: "c_cc9", type: "close_call", category: "Dune",         text: "Who is the main protagonist of the original Dune novel?",            options: ["Duncan Idaho","Gurney Halleck","Paul Atreides","Leto Atreides"],          answer: 2 },
  { id: "c_cc10",type: "close_call", category: "Harry Potter", text: "What does the spell 'Alohomora' do?",                                  options: ["Levitates objects","Unlocks doors","Creates fire","Silences sounds"],     answer: 1 },
  { id: "c_cc11",type: "close_call", category: "Geography",    text: "How many countries share a border with Germany?",                   options: ["7","8","9","10"],                                                        answer: 2 },
  { id: "c_cc12",type: "close_call", category: "History",      text: "What year did the Roman Empire officially fall?",                   options: ["400","410","476","500"],                                                 answer: 2 },

  // DETAIL TRIVIA ≈ 15%
  { id: "c_dt1", type: "detail",     category: "Science",      text: "What is the hardest natural substance found on Earth?",                  options: ["Gold","Iron","Quartz","Diamond"],                                        answer: 3 },
  { id: "c_dt2", type: "detail",     category: "History",      text: "Who was the U.S. president during the Louisiana Purchase in 1803?",      options: ["George Washington","John Adams","Thomas Jefferson","James Madison"],     answer: 2 },
  { id: "c_dt3", type: "detail",     category: "Science",      text: "Which planet has the most confirmed moons in our solar system?",         options: ["Jupiter","Mars","Neptune","Saturn"],                                     answer: 3 },
  { id: "c_dt4", type: "detail",     category: "Harry Potter", text: "In which vault at Gringotts was the Philosopher's Stone originally kept?", options: ["Vault 512","Vault 713","Vault 687","Vault 1023"],                      answer: 1 },
  { id: "c_dt5", type: "detail",     category: "History",      text: "Which empire was the largest in history by land area?",                  options: ["Roman Empire","British Empire","Mongol Empire","Ottoman Empire"],        answer: 2 },
  { id: "c_dt6", type: "detail",     category: "Harry Potter", text: "How many Horcruxes did Voldemort create intentionally?",               options: ["5","6","7","8"],                                                         answer: 1 },
  { id: "c_dt7", type: "detail",     category: "Dune",         text: "What are the giant sandworms of Arrakis called by the Fremen?",       options: ["Shai-Hulud","Sandstrider","Wormrider","Rakis"],                          answer: 0 },

  // TRICK / MISDIRECTION ≈ 10%
  { id: "c_tr1", type: "trick",      category: "General",      text: "Which of these is NOT a prime number?",                                  options: ["2","3","5","9"],                                                         answer: 3 },
  { id: "c_tr2", type: "trick",      category: "General",      text: "How many months in the year have exactly 28 days?",                      options: ["1","2","3","12"],                                                        answer: 3 },
  { id: "c_tr3", type: "trick",      category: "Science",      text: "What is the closest star to Earth?",                                options: ["Alpha Centauri","Proxima Centauri","Sirius","The Sun"],                   answer: 3 },
  { id: "c_tr4", type: "trick",      category: "LOTR",         text: "What language is the inscription on the One Ring written in?",    options: ["Quenya","Sindarin","Tengwar","Black Speech"],                            answer: 3 },
  { id: "c_tr5", type: "trick",      category: "History",      text: "Great Wall of China — is it actually visible from space with the naked eye?", options: ["Yes","No — it's too narrow","Only from low orbit","Only at dawn"],  answer: 1 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCompetitiveRound(bank: Q[]): Q[] {
  const pick = (type: QType, n: number) =>
    shuffled(bank.filter(q => q.type === type)).slice(0, n);
  return shuffled([
    ...pick("direct",     3),
    ...pick("close_call", 1),
    ...pick("detail",     1),
  ]);
}

function makeQuestion(q: Q) {
  return {
    id: q.id,
    text: q.text,
    category: q.category,
    type: q.type,
    timeLimitSeconds: q.type === "trick" ? 25 : q.type === "detail" ? 22 : 20,
    options: q.options.map((text, i) => ({ id: `${q.id}_${i}`, text })),
    correctOptionId: `${q.id}_${q.answer}`,
  };
}

const TYPE_META: Record<QType, { label: string; color: string; emoji: string }> = {
  direct:     { label: "DIRECT",     color: "#22c55e", emoji: "📚" },
  close_call: { label: "CLOSE CALL", color: "#f59e0b", emoji: "🧩" },
  detail:     { label: "DETAIL",     color: "#3b82f6", emoji: "🔍" },
  trick:      { label: "TRICK",      color: "#ef4444", emoji: "⚡" },
};

// ─── Fake AI players to make leaderboard interesting ─────────────────────────
const AI_PLAYERS = [
  { id: "ai_becca", name: "Becca", skill: 0.88 },
  { id: "ai_tim",   name: "Tim",   skill: 0.74 },
  { id: "ai_mazsle",name: "Mazsle",skill: 0.62 },
  { id: "ai_banks", name: "Banks", skill: 0.50 },
  { id: "ai_mel",   name: "Mel",   skill: 0.80 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mode definitions
// ─────────────────────────────────────────────────────────────────────────────

type TriviaMode = "standard" | "competitive" | "server";

const MODES: { id: TriviaMode; label: string; subtitle: string; emoji: string; rounds: number }[] = [
  { id: "standard",    label: "Standard",    subtitle: "10 rounds · Mixed categories",  emoji: "🎮", rounds: 10 },
  { id: "competitive", label: "Competitive", subtitle: "5 rounds · Balanced difficulty", emoji: "🏆", rounds: 5  },
  { id: "server",      label: "Live Server", subtitle: "Real-time · All phones",         emoji: "🌐", rounds: 0  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Local game state
// ─────────────────────────────────────────────────────────────────────────────

type LocalPhase = "idle" | "waiting" | "question" | "reveal" | "mid_leaderboard" | "final_leaderboard";

interface LocalState {
  phase: LocalPhase;
  questions: ReturnType<typeof makeQuestion>[];
  idx: number;
  scores: Record<string, number>;
  selected: string | null;
}

const IDLE_STATE: LocalState = {
  phase: "idle", questions: [], idx: 0,
  scores: {}, selected: null,
};

const MOCK_GUEST = "host-player";
const LETTERS = ["A", "B", "C", "D"];
const ACCENT = "#6c47ff";

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface ViewModeProps {
  viewMode: "player" | "host";
  onViewModeChange: (mode: "player" | "host") => void;
}

export function TriviaControls({ viewMode, onViewModeChange: setViewMode }: ViewModeProps) {
  const { state, sendAction, dispatch } = useRoom();
  const serverState = state.experienceState as any;
  const serverPhase = serverState?.phase as string | undefined;
  const serverQuestion = serverState?.currentQuestion;

  const [mode, setMode] = useState<TriviaMode>("standard");
  const [local, setLocal] = useState<LocalState>(IDLE_STATE);
  const [serverSelected, setServerSelected] = useState<string | null>(null);

  const isLocal = local.phase !== "idle";

  // Always-fresh ref so the auto-advance timeout never reads stale state
  const localRef = React.useRef(local);
  localRef.current = local;

  // ── Auto-advance: question → reveal when the timer runs out ──────────────
  React.useEffect(() => {
    if (local.phase !== "question") return;
    const q = local.questions[local.idx];
    const ms = ((q?.timeLimitSeconds ?? 20) + 0.8) * 1000;
    const tid = setTimeout(() => {
      const cur = localRef.current;
      if (cur.phase !== "question") return;
      const curQ = cur.questions[cur.idx];
      if (!curQ) return;
      const correct = cur.selected === curQ.correctOptionId;
      const bonus = curQ.type === "close_call" ? 20 : curQ.type === "detail" ? 30 : curQ.type === "trick" ? 50 : 0;
      const newScores: Record<string, number> = {
        ...cur.scores,
        [MOCK_GUEST]: (cur.scores[MOCK_GUEST] ?? 0) + (correct ? 100 + bonus : 0),
      };
      AI_PLAYERS.forEach(ai => {
        const aiCorrect = Math.random() < ai.skill;
        newScores[ai.id] = (cur.scores[ai.id] ?? 0) + (aiCorrect ? 100 + bonus : 0);
      });
      dispatch({
        type: "SET_EXPERIENCE", experience: "trivia",
        view: "trivia_result",
        viewData: { currentQuestion: curQ },
        expState: { phase: "reveal", roundNumber: cur.idx + 1, totalRounds: cur.questions.length, scores: newScores },
      });
      setLocal(prev => ({ ...prev, phase: "reveal", scores: newScores }));
    }, ms);
    return () => clearTimeout(tid);
  }, [local.phase, local.idx]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => { setServerSelected(null); }, [serverQuestion?.id]);

  // ── Start offline game ────────────────────────────────────────────────────

  function startOfflineGame() {
    const bank = mode === "competitive" ? COMPETITIVE_BANK : STANDARD_BANK;
    const totalRounds = mode === "competitive" ? 5 : 10;
    const questions = mode === "competitive"
      ? buildCompetitiveRound(bank).map(makeQuestion)
      : shuffled(bank).slice(0, totalRounds).map(makeQuestion);

    // Init scores: host + AI players
    const initScores: Record<string, number> = { [MOCK_GUEST]: 0 };
    AI_PLAYERS.forEach(p => { initScores[p.id] = 0; });

    setLocal({ phase: "waiting", questions, idx: 0, scores: initScores, selected: null });
    setViewMode("player");

    if (!state.guestId) dispatch({ type: "SET_GUEST_ID", guestId: MOCK_GUEST, role: "HOST" });

    dispatch({
      type: "SET_EXPERIENCE", experience: "trivia",
      view: "trivia_waiting",
      viewData: { playerCount: AI_PLAYERS.length + 1 },
      expState: { phase: "waiting", playerCount: AI_PLAYERS.length + 1 },
    });

    setTimeout(() => pushQuestion(questions, 0, initScores), 1000);
  }

  function pushQuestion(questions: typeof local.questions, idx: number, scores: Record<string, number>) {
    const q = questions[idx];
    if (!q) return;
    dispatch({
      type: "SET_EXPERIENCE", experience: "trivia",
      view: "trivia_question",
      viewData: q,
      expState: {
        phase: "question",
        roundNumber: idx + 1,
        totalRounds: questions.length,
        scores,
      },
    });
    setLocal(prev => ({ ...prev, phase: "question", idx, selected: null, scores }));
  }

  function localReveal() {
    const q = local.questions[local.idx];
    if (!q) return;

    // Award host points
    const correct = local.selected === q.correctOptionId;
    const bonus = q.type === "close_call" ? 20 : q.type === "detail" ? 30 : q.type === "trick" ? 50 : 0;
    const earned = correct ? 100 + bonus : 0;

    // Award random AI points (based on skill)
    const newScores: Record<string, number> = { ...local.scores, [MOCK_GUEST]: (local.scores[MOCK_GUEST] ?? 0) + earned };
    AI_PLAYERS.forEach(ai => {
      const aiCorrect = Math.random() < ai.skill;
      const aiBonus = aiCorrect ? bonus : 0;
      const aiEarned = aiCorrect ? 100 + aiBonus : 0;
      newScores[ai.id] = (local.scores[ai.id] ?? 0) + aiEarned;
    });

    dispatch({
      type: "SET_EXPERIENCE", experience: "trivia",
      view: "trivia_result",
      viewData: { currentQuestion: q },
      expState: {
        phase: "reveal",
        roundNumber: local.idx + 1,
        totalRounds: local.questions.length,
        scores: newScores,
      },
    });
    setLocal(prev => ({ ...prev, phase: "reveal", scores: newScores }));
  }

  function showMidLeaderboard() {
    const lbData = buildLbData(local.scores);
    dispatch({
      type: "SET_EXPERIENCE", experience: "trivia",
      view: "leaderboard",
      viewData: lbData,
      expState: {
        phase: "leaderboard",
        roundNumber: local.idx + 1,
        totalRounds: local.questions.length,
        scores: local.scores,
      },
    });
    const isLast = local.idx + 1 >= local.questions.length;
    setLocal(prev => ({ ...prev, phase: isLast ? "final_leaderboard" : "mid_leaderboard" }));
  }

  function localNext() {
    const nextIdx = local.idx + 1;
    pushQuestion(local.questions, nextIdx, local.scores);
  }

  function stopLocal() {
    setLocal(IDLE_STATE);
    setViewMode("player");
    dispatch({ type: "SET_EXPERIENCE", experience: "trivia", view: "intermission" as any });
  }

  function localSelectAnswer(optionId: string) {
    if (local.selected || local.phase !== "question") return;
    setLocal(prev => ({ ...prev, selected: optionId }));
  }

  // Build leaderboard array from scores
  function buildLbData(scores: Record<string, number>) {
    const all = [
      { guestId: MOCK_GUEST, score: scores[MOCK_GUEST] ?? 0, playerNum: 1, isMe: true },
      ...AI_PLAYERS.map((ai, i) => ({ guestId: ai.id, score: scores[ai.id] ?? 0, playerNum: i + 2, isMe: false, displayName: ai.name })),
    ];
    return all.sort((a, b) => b.score - a.score);
  }

  // ── Server mode ───────────────────────────────────────────────────────────

  function submitServerAnswer(optionId: string) {
    if (serverSelected || serverPhase !== "question") return;
    setServerSelected(optionId);
    sendAction("submit_answer", { optionId });
  }

  const isServerReveal = serverPhase === "reveal" || serverPhase === "leaderboard" || serverPhase === "finished";
  const serverCorrectId = isServerReveal ? serverQuestion?.correctOptionId : null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — Active local game
  // ─────────────────────────────────────────────────────────────────────────

  if (isLocal) {
    const q = local.questions[local.idx];
    const isReveal = local.phase === "reveal";
    const isMidLb  = local.phase === "mid_leaderboard";
    const isFinalLb = local.phase === "final_leaderboard";
    const score = local.scores[MOCK_GUEST] ?? 0;
    const typeMeta = q ? TYPE_META[q.type as QType] : null;
    const modeMeta = MODES.find(m => m.id === mode)!;
    const maxBonus = q?.type === "trick" ? 50 : q?.type === "detail" ? 30 : q?.type === "close_call" ? 20 : 0;

    // ── Player view (guest screen mirror) ─────────────────────────────────
    if (viewMode === "player" && local.phase !== "idle") {
      return (
        <View style={{ flex: 1, minHeight: 500 }}>
          {(local.phase === "waiting") && <TriviaWaitingView />}
          {(local.phase === "question") && <TriviaQuestionView />}
          {(local.phase === "reveal")   && <TriviaQuestionView showResult />}
          {(local.phase === "mid_leaderboard" || local.phase === "final_leaderboard") && <LeaderboardView />}
        </View>
      );
    }

    // ── Host controls view ─────────────────────────────────────────────────
    return (
      <ScrollView contentContainerStyle={localStyles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#1a0840", "#2a1060"]} style={localStyles.header}>
          <View style={localStyles.headerLeft}>
            <View style={localStyles.modePill}>
              <Text style={localStyles.modePillText}>{modeMeta.emoji}  {modeMeta.label.toUpperCase()}</Text>
            </View>
            <Text style={localStyles.headerRound}>
              {(isMidLb || isFinalLb) ? "Leaderboard" :
               `Q ${local.idx + 1} / ${local.questions.length}`}
            </Text>
          </View>
          <View style={localStyles.right}>
            <View style={localStyles.scoreChip}>
              <Text style={localStyles.scoreEmoji}>⭐</Text>
              <Text style={localStyles.scoreVal}>{score}</Text>
            </View>
            <TouchableOpacity style={localStyles.playerViewBtn} onPress={() => setViewMode("player")}>
              <Text style={localStyles.playerViewBtnText}>👁  Player View</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Question card */}
        {q && !isMidLb && !isFinalLb && (
          <View style={localStyles.questionCard}>
            {typeMeta && (
              <View style={[localStyles.typeBadge, { borderColor: typeMeta.color + "55", backgroundColor: typeMeta.color + "18" }]}>
                <Text style={[localStyles.typeBadgeText, { color: typeMeta.color }]}>
                  {typeMeta.emoji}  {typeMeta.label}
                </Text>
                {maxBonus > 0 && (
                  <Text style={[localStyles.bonusBadge, { color: typeMeta.color }]}>+{maxBonus} bonus</Text>
                )}
              </View>
            )}

            <View style={localStyles.catRow}>
              <View style={localStyles.catPill}>
                <Text style={localStyles.catText}>{q.category.toUpperCase()}</Text>
              </View>
              {local.selected && !isReveal && (
                <Text style={localStyles.lockedLabel}>⏳ Locked</Text>
              )}
            </View>

            <Text style={localStyles.questionText}>{q.text}</Text>

            <View style={localStyles.optionsGrid}>
              {q.options.map((opt, i) => {
                const isCorrect = isReveal && opt.id === q.correctOptionId;
                const isWrong   = isReveal && opt.id === local.selected && local.selected !== q.correctOptionId;
                const isSel     = local.selected === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      localStyles.option,
                      isSel && !isReveal && localStyles.optionSelected,
                      isCorrect && localStyles.optionCorrect,
                      isWrong   && localStyles.optionWrong,
                    ]}
                    onPress={() => localSelectAnswer(opt.id)}
                    disabled={!!local.selected || isReveal}
                    activeOpacity={0.75}
                  >
                    <View style={localStyles.optLetter}>
                      <Text style={localStyles.optLetterText}>{LETTERS[i]}</Text>
                    </View>
                    <Text style={localStyles.optText} numberOfLines={2}>{opt.text}</Text>
                    {isCorrect && <Text style={localStyles.optMark}>✓</Text>}
                    {isWrong   && <Text style={[localStyles.optMark, { color: "#f87171" }]}>✗</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            {isReveal && local.selected && (
              <LinearGradient
                colors={local.selected === q.correctOptionId
                  ? ["rgba(34,197,94,0.2)","rgba(34,197,94,0.05)"]
                  : ["rgba(239,68,68,0.2)","rgba(239,68,68,0.05)"]}
                style={localStyles.resultPill}
              >
                <Text style={[localStyles.resultText, local.selected !== q.correctOptionId && { color: "#f87171" }]}>
                  {local.selected === q.correctOptionId
                    ? `✓  Correct! +${100 + maxBonus} pts`
                    : "✗  Wrong — 0 pts"}
                </Text>
              </LinearGradient>
            )}
          </View>
        )}

        {/* Leaderboard mini */}
        {(isMidLb || isFinalLb) && (
          <View style={localStyles.lbMini}>
            <Text style={localStyles.lbMiniTitle}>
              {isFinalLb ? "🏆  Final Standings" : `📊  After Round ${local.idx + 1}`}
            </Text>
            {buildLbData(local.scores).map((e, i) => (
              <View key={e.guestId} style={[localStyles.lbRow, e.isMe && localStyles.lbRowMe]}>
                <Text style={[localStyles.lbRank, i === 0 && { color: "#FFD700" }]}>#{i + 1}</Text>
                <Text style={[localStyles.lbName, e.isMe && { color: "#c4b5fd" }]}>
                  {e.isMe ? "You" : (e as any).displayName ?? `Player ${e.playerNum}`}
                </Text>
                <Text style={[localStyles.lbScore, e.isMe && { color: ACCENT }]}>{e.score} pts</Text>
              </View>
            ))}
          </View>
        )}

        {/* Controls */}
        <View style={localStyles.controls}>
          {local.phase === "question" && (
            <HostActionButton label="⏭  Reveal Answer" onPress={localReveal} />
          )}
          {local.phase === "reveal" && (
            <HostActionButton label="📊  Show Scores" onPress={showMidLeaderboard} />
          )}
          {local.phase === "mid_leaderboard" && (
            <HostActionButton label={`▶  Next Question (${local.idx + 2}/${local.questions.length})`} onPress={localNext} />
          )}
          {local.phase === "final_leaderboard" && (
            <HostActionButton label="🔄  Play Again" onPress={startOfflineGame} />
          )}
          <TouchableOpacity style={localStyles.stopBtn} onPress={stopLocal}>
            <Text style={localStyles.stopBtnText}>⏹  Stop Game</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — Mode picker (idle)
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

      <View style={styles.modeSection}>
        <Text style={styles.modeSectionLabel}>SELECT GAME MODE</Text>
        <View style={styles.modeGrid}>
          {MODES.map(m => {
            const active = mode === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.modeCard, active && styles.modeCardActive]}
                onPress={() => setMode(m.id)}
                activeOpacity={0.75}
              >
                {active && (
                  <LinearGradient
                    colors={["rgba(108,71,255,0.25)","rgba(108,71,255,0.08)"]}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Text style={styles.modeCardEmoji}>{m.emoji}</Text>
                <Text style={[styles.modeCardLabel, active && styles.modeCardLabelActive]}>{m.label}</Text>
                <Text style={styles.modeCardSub}>{m.subtitle}</Text>
                {m.id === "competitive" && (
                  <View style={styles.modeTag}>
                    <Text style={styles.modeTagText}>BALANCED</Text>
                  </View>
                )}
                {active && <View style={styles.modeCheck}><Text style={styles.modeCheckText}>✓</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Competitive breakdown */}
      {mode === "competitive" && (
        <View style={styles.breakdown}>
          <Text style={styles.breakdownTitle}>Question Mix — 5 Rounds</Text>
          {(["direct","close_call","detail","trick"] as QType[]).map(type => {
            const meta = TYPE_META[type];
            const pct  = type === "direct" ? "50%" : type === "close_call" ? "25%" : type === "detail" ? "15%" : "10%";
            const desc = type === "direct" ? "Factual, clear-cut knowledge" : type === "close_call" ? "Similar options — harder to guess" : type === "detail" ? "Deeper knowledge required" : "Mentally tricky questions";
            const bonus = type === "close_call" ? "+20 pts" : type === "detail" ? "+30 pts" : type === "trick" ? "+50 pts" : "";
            return (
              <View key={type} style={styles.breakdownRow}>
                <Text style={styles.breakdownEmoji}>{meta.emoji}</Text>
                <View style={styles.breakdownInfo}>
                  <Text style={[styles.breakdownLabel, { color: meta.color }]}>{meta.label} {bonus ? <Text style={styles.bonusLabel}>{bonus}</Text> : null}</Text>
                  <Text style={styles.breakdownDesc}>{desc}</Text>
                </View>
                <Text style={[styles.breakdownPct, { color: meta.color }]}>{pct}</Text>
              </View>
            );
          })}
        </View>
      )}

      {mode === "standard" && (
        <View style={styles.breakdown}>
          <Text style={styles.breakdownTitle}>Standard — 10 Rounds</Text>
          <Text style={styles.breakdownDesc}>60-question bank · 10 random questions per game · Covers Music, Movies, Harry Potter, LOTR, Dune, Science, Geography, History, Sports, Food · 100 pts per correct answer</Text>
        </View>
      )}

      {/* Launch */}
      <View style={styles.actions}>
        {mode !== "server" ? (
          <TouchableOpacity onPress={startOfflineGame} activeOpacity={0.85}>
            <LinearGradient colors={["#4c1d95","#6c47ff"]} style={styles.launchBtn}>
              <Text style={styles.launchEmoji}>{MODES.find(m => m.id === mode)!.emoji}</Text>
              <View>
                <Text style={styles.launchLabel}>Start {MODES.find(m => m.id === mode)!.label}</Text>
                <Text style={styles.launchSub}>Leaderboard between rounds · {mode === "competitive" ? "5" : "10"} questions</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.serverControls}>
            <View style={styles.phaseRow}>
              <View style={[styles.phaseDot, serverPhase === "question" && styles.phaseDotActive]} />
              <Text style={styles.phaseLabel}>
                {serverPhase === "waiting" || !serverPhase ? "Waiting to start" :
                 serverPhase === "question" ? `Round ${serverState?.roundNumber} of ${serverState?.totalRounds}` :
                 serverPhase === "reveal" ? "Answer Revealed" :
                 serverPhase === "leaderboard" ? "Leaderboard" :
                 serverPhase === "finished" ? "Game Over" : serverPhase}
              </Text>
            </View>
            {serverQuestion && (
              <View style={styles.questionBox}>
                <Text style={styles.catLabel}>{serverQuestion.category?.toUpperCase()}</Text>
                <Text style={styles.questionText}>{serverQuestion.text}</Text>
                <View style={styles.options}>
                  {serverQuestion.options?.map((opt: any) => {
                    const isCorrect = !!serverCorrectId && opt.id === serverCorrectId;
                    const isWrong   = !!serverCorrectId && opt.id === serverSelected && serverSelected !== serverCorrectId;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.option, serverSelected === opt.id && !isServerReveal && styles.optionSelected, isCorrect && styles.optionCorrect, isWrong && styles.optionWrong]}
                        onPress={() => submitServerAnswer(opt.id)}
                        disabled={!!serverSelected || isServerReveal}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.optionText}>{isCorrect ? "✓  " : isWrong ? "✗  " : "    "}{opt.text}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {serverSelected && serverPhase === "question" && <Text style={styles.lockedText}>⏳  Locked in</Text>}
              </View>
            )}
            {(!serverPhase || serverPhase === "waiting") && <HostActionButton label="▶  Start Round" onPress={() => sendAction("start_round")} />}
            {serverPhase === "leaderboard" && <HostActionButton label={`▶  Next Question (${(serverState?.roundNumber ?? 1)}/${serverState?.totalRounds ?? 10})`} onPress={() => sendAction("next_question")} />}
            {serverPhase === "question" && <><HostActionButton label="⏭  Reveal Answer" onPress={() => sendAction("reveal_answer")} variant="secondary" /><HostActionButton label="🔄  Resume (if stuck)" onPress={() => sendAction("resume")} variant="secondary" /><HostActionButton label="⏹  End Game" onPress={() => sendAction("end_trivia")} variant="secondary" /></>}
            {serverPhase === "reveal"   && <><HostActionButton label="▶  Next Question" onPress={() => sendAction("next_question")} /><HostActionButton label="🏆  Show Leaderboard" onPress={() => sendAction("show_leaderboard")} variant="secondary" /><HostActionButton label="⏹  End Game" onPress={() => sendAction("end_trivia")} variant="secondary" /></>}
            {serverPhase === "finished" && <HostActionButton label="🔄  Play Again" onPress={() => sendAction("start_round")} />}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Local game styles ────────────────────────────────────────────────────────

const localStyles = StyleSheet.create({
  container:    { gap: 14, paddingBottom: 20 },

  header:       { borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  headerLeft:   { gap: 6 },
  right:        { alignItems: "flex-end", gap: 8 },
  modePill:     { alignSelf: "flex-start", backgroundColor: "rgba(108,71,255,0.25)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: ACCENT + "55" },
  modePillText: { color: "#c4b5fd", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  headerRound:  { color: "#fff", fontSize: 20, fontWeight: "900" },
  scoreChip:    { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(99,102,241,0.25)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)" },
  scoreEmoji:   { fontSize: 14 },
  scoreVal:     { color: "#fff", fontWeight: "900", fontSize: 16 },
  playerViewBtn:{ backgroundColor: "#1a1040", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: ACCENT + "44" },
  playerViewBtnText: { color: "#8b5cf6", fontSize: 11, fontWeight: "700" },

  questionCard: { backgroundColor: "#111", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#222", gap: 10 },
  typeBadge:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "flex-start", borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, gap: 8 },
  typeBadgeText:{ fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  bonusBadge:   { fontSize: 10, fontWeight: "700" },
  catRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catPill:      { backgroundColor: "#1a1040", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#2a1870" },
  catText:      { color: ACCENT, fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  lockedLabel:  { color: "#555", fontSize: 11, fontStyle: "italic" },
  questionText: { color: "#fff", fontSize: 15, fontWeight: "700", lineHeight: 22 },

  optionsGrid:  { gap: 7 },
  option:       { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#1a1a1a", borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: "#2a2a2a" },
  optionSelected:{ borderColor: ACCENT, backgroundColor: "#1a1040" },
  optionCorrect: { borderColor: "#4ade80", backgroundColor: "#0a2a15" },
  optionWrong:   { borderColor: "#f87171", backgroundColor: "#2a0a0a" },
  optLetter:    { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  optLetterText:{ color: "#fff", fontWeight: "900", fontSize: 12 },
  optText:      { color: "#fff", fontSize: 14, fontWeight: "600", flex: 1 },
  optMark:      { fontSize: 18, color: "#4ade80" },
  resultPill:   { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  resultText:   { color: "#4ade80", fontSize: 14, fontWeight: "800", textAlign: "center" },

  lbMini:       { backgroundColor: "#111", borderRadius: 14, borderWidth: 1, borderColor: "#222", padding: 14, gap: 8 },
  lbMiniTitle:  { color: "#fff", fontSize: 15, fontWeight: "900", marginBottom: 4 },
  lbRow:        { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  lbRowMe:      { backgroundColor: "rgba(108,71,255,0.1)", borderRadius: 8, paddingHorizontal: 8 },
  lbRank:       { color: "#555", fontSize: 14, fontWeight: "800", minWidth: 32 },
  lbName:       { flex: 1, color: "#ccc", fontSize: 14, fontWeight: "600" },
  lbScore:      { color: "#888", fontSize: 16, fontWeight: "900" },

  controls:     { gap: 8, borderTopWidth: 1, borderTopColor: "#1a1a1a", paddingTop: 12, marginTop: 4 },
  stopBtn:      { alignItems: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "#1e1e1e" },
  stopBtnText:  { color: "#444", fontSize: 13, fontWeight: "700" },
});

// ─── Mode picker styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { gap: 16, paddingBottom: 20 },
  modeSection:    { gap: 10 },
  modeSectionLabel: { color: "#444", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  modeGrid:       { gap: 8 },
  modeCard:       { borderRadius: 14, borderWidth: 1.5, borderColor: "#222", padding: 14, overflow: "hidden", position: "relative", backgroundColor: "#111" },
  modeCardActive: { borderColor: ACCENT },
  modeCardEmoji:  { fontSize: 22, marginBottom: 6 },
  modeCardLabel:  { color: "#888", fontSize: 16, fontWeight: "800", marginBottom: 2 },
  modeCardLabelActive: { color: "#fff" },
  modeCardSub:    { color: "#444", fontSize: 11 },
  modeTag:        { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(108,71,255,0.2)", borderRadius: 6, borderWidth: 1, borderColor: ACCENT + "55", paddingHorizontal: 8, paddingVertical: 3 },
  modeTagText:    { color: ACCENT, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  modeCheck:      { position: "absolute", bottom: 12, right: 14, width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" },
  modeCheckText:  { color: "#fff", fontSize: 12, fontWeight: "900" },

  breakdown:      { backgroundColor: "#0d0d0d", borderRadius: 14, borderWidth: 1, borderColor: "#1e1e1e", padding: 14, gap: 10 },
  breakdownTitle: { color: "#fff", fontSize: 13, fontWeight: "800", marginBottom: 2 },
  breakdownRow:   { flexDirection: "row", alignItems: "center", gap: 10 },
  breakdownEmoji: { fontSize: 16, width: 22 },
  breakdownInfo:  { flex: 1 },
  breakdownLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  bonusLabel:     { color: "#888", fontWeight: "600", fontSize: 10 },
  breakdownDesc:  { color: "#444", fontSize: 11, marginTop: 1 },
  breakdownPct:   { fontSize: 14, fontWeight: "900", minWidth: 36, textAlign: "right" },

  actions:        { gap: 8 },
  launchBtn:      { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16 },
  launchEmoji:    { fontSize: 28 },
  launchLabel:    { color: "#fff", fontSize: 16, fontWeight: "800" },
  launchSub:      { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 },

  serverControls: { gap: 8 },
  phaseRow:       { flexDirection: "row", alignItems: "center", gap: 8 },
  phaseDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: "#333" },
  phaseDotActive: { backgroundColor: "#22c55e" },
  phaseLabel:     { color: ACCENT, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  questionBox:    { backgroundColor: "#111", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#222", gap: 10 },
  catLabel:       { color: ACCENT, fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  questionText:   { color: "#fff", fontSize: 15, fontWeight: "700", lineHeight: 22 },
  options:        { gap: 6 },
  option:         { backgroundColor: "#1a1a1a", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#2a2a2a" },
  optionSelected: { borderColor: ACCENT, backgroundColor: "#1a1040" },
  optionCorrect:  { borderColor: "#4ade80", backgroundColor: "#0a2a15" },
  optionWrong:    { borderColor: "#f87171", backgroundColor: "#2a0a0a" },
  optionText:     { color: "#fff", fontSize: 14 },
  lockedText:     { color: "#555", fontSize: 12, textAlign: "center", fontStyle: "italic" },
});
