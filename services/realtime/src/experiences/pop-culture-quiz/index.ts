import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";

// ─────────────────────────────────────────────────────────────────────────────
// Pop Culture Quiz Experience
//
// Like trivia but focused on TV, Film, Music, and Social media categories.
// Host starts/reveals/advances. Guests answer within 12 seconds for speed bonus.
//
// Actions:
//   HOST:  start, reveal, next, end
//   GUEST: answer
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:pop_culture_quiz:${roomId}`;
const ANSWER_WINDOW_MS = 12_000; // 12s max for speed bonus

interface PopCultureQuestion {
  text: string;
  options: [string, string, string, string];
  correct: number; // 0-3
  category: "TV" | "Film" | "Music" | "Social";
}

interface PopCultureQuizState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentQ: (PopCultureQuestion & { index: number }) | null;
  answers: Record<string, number>; // guestId -> option index (server only)
  questionStartedAt: number;
  queue: number[];
}

const QUESTIONS: PopCultureQuestion[] = [
  {
    text: "Which show features a chemistry teacher who becomes a drug lord?",
    options: ["Ozark", "Breaking Bad", "Dexter", "Narcos"],
    correct: 1,
    category: "TV",
  },
  {
    text: "What year did the first iPhone launch?",
    options: ["2005", "2006", "2007", "2008"],
    correct: 2,
    category: "Social",
  },
  {
    text: "Which artist released the album 'Renaissance' in 2022?",
    options: ["Rihanna", "Adele", "Beyoncé", "Taylor Swift"],
    correct: 2,
    category: "Music",
  },
  {
    text: "In which film does a boy see dead people?",
    options: ["Poltergeist", "The Others", "The Sixth Sense", "Hereditary"],
    correct: 2,
    category: "Film",
  },
  {
    text: "What platform is known for short-form vertical videos with a 'For You' page?",
    options: ["Instagram", "Snapchat", "TikTok", "YouTube Shorts"],
    correct: 2,
    category: "Social",
  },
  {
    text: "Which band performed 'Mr. Brightside'?",
    options: ["The Strokes", "The Killers", "Arctic Monkeys", "Interpol"],
    correct: 1,
    category: "Music",
  },
  {
    text: "In 'Game of Thrones', what is the name of Jon Snow's direwolf?",
    options: ["Nymeria", "Ghost", "Grey Wind", "Lady"],
    correct: 1,
    category: "TV",
  },
  {
    text: "Which movie features the line 'I am Groot'?",
    options: ["Thor: Ragnarok", "Avengers: Infinity War", "Guardians of the Galaxy", "Black Panther"],
    correct: 2,
    category: "Film",
  },
  {
    text: "Which social media platform uses the term 'tweet'?",
    options: ["Facebook", "Twitter / X", "LinkedIn", "Reddit"],
    correct: 1,
    category: "Social",
  },
  {
    text: "Which artist's tour was called 'The Eras Tour'?",
    options: ["Billie Eilish", "Olivia Rodrigo", "Taylor Swift", "Doja Cat"],
    correct: 2,
    category: "Music",
  },
  // ── Added questions to reach 60 total ──────────────────────────────────────
  {
    text: "Which Netflix show features a group of kids in Hawkins, Indiana fighting supernatural forces?",
    options: ["The OA", "Dark", "Stranger Things", "Manifest"],
    correct: 2,
    category: "TV",
  },
  {
    text: "What was the highest-grossing film of 2019 worldwide?",
    options: ["The Lion King", "Avengers: Endgame", "Frozen 2", "Spider-Man: Far From Home"],
    correct: 1,
    category: "Film",
  },
  {
    text: "Which rapper released the album 'Certified Lover Boy' in 2021?",
    options: ["Kanye West", "Travis Scott", "Drake", "J. Cole"],
    correct: 2,
    category: "Music",
  },
  {
    text: "The 'Ice Bucket Challenge' viral moment raised awareness for which disease?",
    options: ["Multiple Sclerosis", "Parkinson's Disease", "ALS", "Muscular Dystrophy"],
    correct: 2,
    category: "Social",
  },
  {
    text: "Which HBO show follows the Roy family and their battle for control of a media empire?",
    options: ["Billions", "Succession", "Yellowstone", "The Crown"],
    correct: 1,
    category: "TV",
  },
  {
    text: "Cardi B and Megan Thee Stallion's 2020 hit was called what?",
    options: ["Up", "WAP", "Bodak Yellow", "Savage"],
    correct: 1,
    category: "Music",
  },
  {
    text: "Which film won the Oscar for Best Picture at the 2020 Academy Awards?",
    options: ["1917", "Joker", "Once Upon a Time in Hollywood", "Parasite"],
    correct: 3,
    category: "Film",
  },
  {
    text: "Which app exploded in popularity as a video-calling platform during the 2020 pandemic?",
    options: ["Skype", "Zoom", "Google Meet", "FaceTime"],
    correct: 1,
    category: "Social",
  },
  {
    text: "In 'Euphoria', what actress plays the lead character Rue?",
    options: ["Milly Alcock", "Hunter Schafer", "Zendaya", "Sydney Sweeney"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Which Billie Eilish song was the James Bond theme for 'No Time to Die'?",
    options: ["Ocean Eyes", "No Time to Die", "Happier Than Ever", "Bad Guy"],
    correct: 1,
    category: "Music",
  },
  {
    text: "The 'Distracted Boyfriend' meme format originated from a stock photo taken in which country?",
    options: ["Italy", "Spain", "Germany", "Portugal"],
    correct: 1,
    category: "Social",
  },
  {
    text: "Which Disney+ series follows the Mandalorian bounty hunter and 'Baby Yoda'?",
    options: ["Andor", "The Book of Boba Fett", "The Mandalorian", "Obi-Wan Kenobi"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Olivia Rodrigo's debut single 'drivers license' was released in what year?",
    options: ["2019", "2020", "2021", "2022"],
    correct: 2,
    category: "Music",
  },
  {
    text: "Which film stars Joaquin Phoenix as the iconic DC villain?",
    options: ["Batman", "Joker", "Venom", "The Dark Knight"],
    correct: 1,
    category: "Film",
  },
  {
    text: "Who won the 2023 Super Bowl MVP award?",
    options: ["Jalen Hurts", "Patrick Mahomes", "Travis Kelce", "Brock Purdy"],
    correct: 1,
    category: "Social",
  },
  {
    text: "Which Netflix series became a global sensation featuring a childhood game with deadly stakes?",
    options: ["Alice in Borderland", "Sweet Home", "Squid Game", "All of Us Are Dead"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Adele's album '30' was released in which year?",
    options: ["2019", "2020", "2021", "2022"],
    correct: 2,
    category: "Music",
  },
  {
    text: "Which Marvel film introduced the multiverse concept prominently to the MCU?",
    options: ["Doctor Strange", "Spider-Man: No Way Home", "Loki", "WandaVision"],
    correct: 1,
    category: "Film",
  },
  {
    text: "What viral 2020 TikTok trend involved people recreating professional scenes at home?",
    options: ["Renegade", "The Savage Challenge", "The Flip the Switch Challenge", "Cottagecore"],
    correct: 2,
    category: "Social",
  },
  {
    text: "In 'Ted Lasso', what sport does Ted coach?",
    options: ["Rugby", "Cricket", "Football (Soccer)", "American Football"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Which artist released 'Bad Guy', a Grammy-winning single, in 2019?",
    options: ["Lizzo", "Lorde", "Billie Eilish", "Halsey"],
    correct: 2,
    category: "Music",
  },
  {
    text: "In 'Avengers: Infinity War', which character says 'I am inevitable'?",
    options: ["Loki", "Thanos", "Ultron", "Red Skull"],
    correct: 1,
    category: "Film",
  },
  {
    text: "Which social platform introduced 'Stories' before all the others copied it?",
    options: ["Facebook", "Instagram", "Snapchat", "Twitter"],
    correct: 2,
    category: "Social",
  },
  {
    text: "Harry Styles' 2022 album was titled what?",
    options: ["Fine Line", "Harry's House", "One Direction", "Watermelon Sugar"],
    correct: 1,
    category: "Music",
  },
  {
    text: "Which 2018 film starring Lady Gaga and Bradley Cooper won the Oscar for Best Original Song?",
    options: ["A Star Is Born", "Bohemian Rhapsody", "Rocketman", "The Greatest Showman"],
    correct: 0,
    category: "Film",
  },
  {
    text: "The 'OK Boomer' phrase went viral in approximately which year?",
    options: ["2017", "2018", "2019", "2020"],
    correct: 2,
    category: "Social",
  },
  {
    text: "In 'The Last of Us' HBO series, who plays Joel?",
    options: ["Aaron Paul", "Pedro Pascal", "Oscar Isaac", "Jon Bernthal"],
    correct: 1,
    category: "TV",
  },
  {
    text: "SZA's critically acclaimed 2022 album was titled what?",
    options: ["Ctr", "Lemonade", "SOS", "Good Days"],
    correct: 2,
    category: "Music",
  },
  {
    text: "Which film's ending featured the line 'I am Iron Man' before a snap?",
    options: ["Iron Man 3", "Captain America: Civil War", "Avengers: Age of Ultron", "Avengers: Endgame"],
    correct: 3,
    category: "Film",
  },
  {
    text: "The 'Bernie Sanders mittens' meme originated from which event?",
    options: ["The 2020 election night", "The 2021 inauguration", "The 2021 Super Bowl", "A 2021 Senate vote"],
    correct: 1,
    category: "Social",
  },
  {
    text: "Which show on HBO tells the story of a toxic relationship between a detective and a con artist?",
    options: ["Sharp Objects", "Big Little Lies", "Killing Eve", "The Undoing"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Which artist performed the halftime show at the 2023 Super Bowl?",
    options: ["Beyoncé", "Rihanna", "Taylor Swift", "Shakira"],
    correct: 1,
    category: "Music",
  },
  {
    text: "The film 'Everything Everywhere All at Once' won how many Oscars at the 2023 ceremony?",
    options: ["4", "5", "6", "7"],
    correct: 3,
    category: "Film",
  },
  {
    text: "Which Twitter / X handle did Elon Musk famously buy for $44 billion?",
    options: ["@twitter", "@X", "@ElonMusk", "The whole platform"],
    correct: 3,
    category: "Social",
  },
  {
    text: "In 'White Lotus', Season 2 was set in which country?",
    options: ["Greece", "Thailand", "Italy", "Spain"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Morgan Wallen's 2023 album 'One Thing at a Time' set the record for most weeks at number one on which chart?",
    options: ["Hot 100", "Country Albums", "Billboard 200", "Top Country Songs"],
    correct: 1,
    category: "Music",
  },
  {
    text: "Which animated Pixar film features a young girl who turns into a giant red panda?",
    options: ["Soul", "Luca", "Turning Red", "Elemental"],
    correct: 2,
    category: "Film",
  },
  {
    text: "The 'Sea Shanty' trend on TikTok in early 2021 was started by which sea shanty?",
    options: ["Drunken Sailor", "Wellerman", "Barrett's Privateers", "Leave Her, Johnny"],
    correct: 1,
    category: "Social",
  },
  {
    text: "Which streaming show features a group of friends playing Dungeons & Dragons, inspiring the title?",
    options: ["The Witcher", "Arcane", "Stranger Things", "Dungeons & Dragons: Honor Among Thieves"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Kendrick Lamar's diss track targeting Drake in 2024 was called what?",
    options: ["Push Ups", "Euphoria", "Not Like Us", "Meet the Grahams"],
    correct: 2,
    category: "Music",
  },
  {
    text: "In the 2019 film 'Knives Out', who plays the detective Benoit Blanc?",
    options: ["Idris Elba", "Tom Hanks", "Daniel Craig", "Hugh Jackman"],
    correct: 2,
    category: "Film",
  },
  {
    text: "Which YouTuber sparked the 'Mr. Beast effect' with large-scale challenge and philanthropy videos?",
    options: ["PewDiePie", "MrBeast", "Logan Paul", "David Dobrik"],
    correct: 1,
    category: "Social",
  },
  {
    text: "Apple TV+'s 'Severance' is set primarily inside which type of workplace?",
    options: ["A tech startup", "A pharmaceutical company", "A data refinement company", "A government agency"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Which pop star released the record-breaking album 'Midnights' in 2022?",
    options: ["Dua Lipa", "Ariana Grande", "Taylor Swift", "Lizzo"],
    correct: 2,
    category: "Music",
  },
  {
    text: "The 2022 film 'Top Gun: Maverick' is the sequel to the 1986 original. How many years apart are they?",
    options: ["30 years", "34 years", "36 years", "40 years"],
    correct: 2,
    category: "Film",
  },
  {
    text: "Which celebrity's Super Bowl ad became one of the most talked-about moments of 2023?",
    options: ["Kim Kardashian for Skims", "Travis Scott for McDonald's", "Serena Williams for Nike", "Kevin Hart for Fanduel"],
    correct: 3,
    category: "Social",
  },
  {
    text: "In 'Beef' on Netflix, who plays the two lead characters caught in road rage?",
    options: ["Ali Wong & Steven Yeun", "Sandra Oh & Randall Park", "Awkwafina & Simu Liu", "Lucy Liu & Ken Jeong"],
    correct: 0,
    category: "TV",
  },
  {
    text: "Doja Cat's hit 'Say So' got a boost from going viral on which platform?",
    options: ["Instagram Reels", "YouTube", "TikTok", "Spotify"],
    correct: 2,
    category: "Music",
  },
  {
    text: "Which 2023 blockbuster had the promotional campaign 'She's everything. He's just Ken.'?",
    options: ["Mean Girls", "Legally Blonde reboot", "Barbie", "Legally Blonde 3"],
    correct: 2,
    category: "Film",
  },
  // ── added to reach 200 ───────────────────────────────────────────────────────
  // ── TV ───────────────────────────────────────────────────────────────────────
  { text: "In 'Abbott Elementary', what grade does Janine Teagues teach?", options: ["1st Grade", "2nd Grade", "3rd Grade", "4th Grade"], correct: 1, category: "TV" },
  { text: "Which streaming service produces 'The Crown'?", options: ["HBO", "Hulu", "Netflix", "Amazon Prime"], correct: 2, category: "TV" },
  { text: "In 'House of the Dragon', which family does the show follow?", options: ["Stark", "Lannister", "Targaryen", "Baratheon"], correct: 2, category: "TV" },
  { text: "Who plays Kendall Roy in 'Succession'?", options: ["Jeremy Strong", "Brian Cox", "Matthew Macfadyen", "Kieran Culkin"], correct: 0, category: "TV" },
  { text: "In 'The Bear', what city is the restaurant located in?", options: ["New York", "Chicago", "LA", "Boston"], correct: 1, category: "TV" },
  { text: "Who plays Wednesday Addams in the Netflix series 'Wednesday'?", options: ["Emma Myers", "Jenna Ortega", "Hunter Schafer", "Sophie Thatcher"], correct: 1, category: "TV" },
  { text: "In 'Peaky Blinders', who is the head of the Shelby family?", options: ["Arthur Shelby", "Tommy Shelby", "John Shelby", "Polly Gray"], correct: 1, category: "TV" },
  { text: "The TV show 'Fleabag' was created by and stars which actress?", options: ["Sharon Horgan", "Phoebe Waller-Bridge", "Daisy Haggard", "Rose Matafeo"], correct: 1, category: "TV" },
  { text: "Which HBO show follows a family at a luxury resort where guests keep dying?", options: ["Big Little Lies", "Sharp Objects", "The White Lotus", "Mare of Easttown"], correct: 2, category: "TV" },
  { text: "In 'Bridgerton', what is the name of the mysterious gossip columnist?", options: ["Queen Charlotte", "Lady Featherington", "Lady Whistledown", "Lady Danbury"], correct: 2, category: "TV" },
  { text: "In 'Only Murders in the Building', the three main characters bond over what?", options: ["True crime podcasts", "Their building's history", "A shared balcony", "A murder they committed"], correct: 0, category: "TV" },
  { text: "The series 'Andor' is a prequel to which Star Wars film?", options: ["A New Hope", "Rogue One", "The Force Awakens", "Return of the Jedi"], correct: 1, category: "TV" },
  { text: "Which show features a brilliant but antisocial doctor who solves medical mysteries?", options: ["Grey's Anatomy", "House M.D.", "The Good Doctor", "Scrubs"], correct: 1, category: "TV" },
  { text: "In 'The Boys', what is the name of the corporation that owns the superheroes?", options: ["Vought International", "Apex Corp", "Omni Consumer Products", "Samaritan Industries"], correct: 0, category: "TV" },
  { text: "Which sitcom is set in Pawnee, Indiana, and features a parks department?", options: ["Brooklyn Nine-Nine", "The Good Place", "Parks and Recreation", "Community"], correct: 2, category: "TV" },
  { text: "Who plays Daenerys Targaryen in 'Game of Thrones'?", options: ["Sophie Turner", "Emilia Clarke", "Natalie Dormer", "Lena Headey"], correct: 1, category: "TV" },
  { text: "Which show follows a group of women who get revenge on their husbands by becoming drug dealers?", options: ["Weeds", "Good Girls", "Dead to Me", "Big Little Lies"], correct: 1, category: "TV" },
  { text: "Which show features a crew of thieves in red jumpsuits pulling off elaborate heists?", options: ["Lupin", "Ozark", "Money Heist", "Hustle"], correct: 2, category: "TV" },
  { text: "Apple TV+'s 'Severance' is set primarily inside which type of workplace?", options: ["A tech startup", "A pharmaceutical company", "A data refinement company", "A government agency"], correct: 2, category: "TV" },
  { text: "In 'Beef' on Netflix, who plays the two lead characters caught in road rage?", options: ["Ali Wong & Steven Yeun", "Sandra Oh & Randall Park", "Awkwafina & Simu Liu", "Lucy Liu & Ken Jeong"], correct: 0, category: "TV" },
  { text: "In 'Yellowstone', John Dutton is played by which actor?", options: ["Harrison Ford", "Kevin Costner", "Tommy Lee Jones", "Sam Elliott"], correct: 1, category: "TV" },
  { text: "In 'Normal People', the two lead characters attend which Irish university?", options: ["UCD", "DCU", "Trinity College Dublin", "NUI Galway"], correct: 2, category: "TV" },
  { text: "Which show on HBO tells the story of a toxic relationship between a detective and a con artist?", options: ["Sharp Objects", "Big Little Lies", "Killing Eve", "The Undoing"], correct: 2, category: "TV" },
  { text: "In 'The Last of Us' HBO series, who plays Joel?", options: ["Aaron Paul", "Pedro Pascal", "Oscar Isaac", "Jon Bernthal"], correct: 1, category: "TV" },
  { text: "Which Netflix series became a global sensation featuring a childhood game with deadly stakes?", options: ["Alice in Borderland", "Sweet Home", "Squid Game", "All of Us Are Dead"], correct: 2, category: "TV" },
  // ── Film ─────────────────────────────────────────────────────────────────────
  { text: "In 'Oppenheimer', who played J. Robert Oppenheimer?", options: ["Matt Damon", "Cillian Murphy", "Tom Holland", "Paul Mescal"], correct: 1, category: "Film" },
  { text: "Which film features the line 'Life is like a box of chocolates'?", options: ["Big", "Cast Away", "Forrest Gump", "The Green Mile"], correct: 2, category: "Film" },
  { text: "Who directed 'Pulp Fiction'?", options: ["Martin Scorsese", "Quentin Tarantino", "David Fincher", "Joel Coen"], correct: 1, category: "Film" },
  { text: "In 'The Batman' (2022), who plays Bruce Wayne?", options: ["Christian Bale", "Ben Affleck", "Robert Pattinson", "Adam West"], correct: 2, category: "Film" },
  { text: "Which actress plays Mia in 'La La Land'?", options: ["Emma Watson", "Emma Stone", "Emma Roberts", "Emma Thompson"], correct: 1, category: "Film" },
  { text: "In 'Get Out', who plays the protagonist Chris Washington?", options: ["LaKeith Stanfield", "Daniel Kaluuya", "Winston Duke", "Aldis Hodge"], correct: 1, category: "Film" },
  { text: "In 'Dune' (2021), what is the precious substance everyone is fighting over?", options: ["Vibranium", "Unobtanium", "Spice", "Dilithium"], correct: 2, category: "Film" },
  { text: "Which actress starred in 'Black Swan' and won an Oscar for it?", options: ["Cate Blanchett", "Natalie Portman", "Olivia Colman", "Charlize Theron"], correct: 1, category: "Film" },
  { text: "In 'Whiplash', what instrument does the main character play?", options: ["Trumpet", "Violin", "Drums", "Piano"], correct: 2, category: "Film" },
  { text: "Which 2024 film by Denis Villeneuve is a sequel to his 2021 sci-fi epic?", options: ["Arrival 2", "Blade Runner 2099", "Dune: Part Two", "Annihilation Returns"], correct: 2, category: "Film" },
  { text: "The horror film 'Hereditary' was directed by which filmmaker?", options: ["Jordan Peele", "Ari Aster", "Mike Flanagan", "David Robert Mitchell"], correct: 1, category: "Film" },
  { text: "Which 2022 film starring Austin Butler was about a rock 'n' roll legend?", options: ["Bohemian Rhapsody", "Rocketman", "Elvis", "Weird: The Al Yankovic Story"], correct: 2, category: "Film" },
  { text: "Which film follows a group of teens at a deadly game show in South Korea? Wait — which FILM features the line 'I am inevitable'?", options: ["Iron Man 3", "Avengers: Age of Ultron", "Avengers: Infinity War", "Avengers: Endgame"], correct: 2, category: "Film" },
  { text: "In 'Mamma Mia!', which ABBA song does the cast perform on the rooftops?", options: ["Dancing Queen", "Waterloo", "Fernando", "Voulez-Vous"], correct: 0, category: "Film" },
  { text: "Who plays the villain Thanos in the Marvel Cinematic Universe?", options: ["Josh Brolin", "Dave Bautista", "Vin Diesel", "John Cena"], correct: 0, category: "Film" },
  { text: "Which 2019 Quentin Tarantino film is set in 1960s Hollywood?", options: ["The Hateful Eight", "Inglourious Basterds", "Once Upon a Time in Hollywood", "Django Unchained"], correct: 2, category: "Film" },
  { text: "In 'Grand Budapest Hotel', which director is known for symmetrical shots and pastel colours?", options: ["Tim Burton", "Wes Anderson", "Michel Gondry", "Spike Jonze"], correct: 1, category: "Film" },
  { text: "Which film features Tom Hanks stranded alone on a desert island?", options: ["Big", "The Terminal", "Cast Away", "Philadelphia"], correct: 2, category: "Film" },
  { text: "In 'Parasite', which country does the Kim family live in?", options: ["Japan", "China", "South Korea", "Vietnam"], correct: 2, category: "Film" },
  { text: "Which 2023 animated film features a spider-verse of alternate Spider-Men?", options: ["Spider-Man: Homecoming", "Spider-Man: Across the Spider-Verse", "Spider-Man: No Way Home", "Spider-Man: Into the Spider-Verse"], correct: 1, category: "Film" },
  { text: "The film 'Clueless' is loosely based on which classic novel?", options: ["Pride and Prejudice", "Sense and Sensibility", "Emma", "Northanger Abbey"], correct: 2, category: "Film" },
  { text: "In 'Interstellar', what planet does the crew visit that has massive waves?", options: ["Mann's Planet", "Miller's Planet", "Edmunds' Planet", "Cooper Station"], correct: 1, category: "Film" },
  // ── Music ────────────────────────────────────────────────────────────────────
  { text: "What is the name of Beyoncé's country-inspired 2024 album?", options: ["Cowboy Carter", "Texas Hold 'Em", "Act II", "Southern Roots"], correct: 0, category: "Music" },
  { text: "Which Sabrina Carpenter song became a massive hit in 2024?", options: ["Nonsense", "Feather", "Espresso", "Please Please Please"], correct: 2, category: "Music" },
  { text: "Who sang the hit 'As It Was' in 2022?", options: ["Ed Sheeran", "Harry Styles", "Niall Horan", "Louis Tomlinson"], correct: 1, category: "Music" },
  { text: "What is the name of Taylor Swift's 10th studio album?", options: ["Lover", "Folklore", "Evermore", "Midnights"], correct: 3, category: "Music" },
  { text: "Which band released the album 'AM' which features 'Do I Wanna Know?'?", options: ["The Strokes", "The Killers", "Arctic Monkeys", "Foals"], correct: 2, category: "Music" },
  { text: "Frank Ocean's 2016 visual album was titled what?", options: ["Nostalgia Ultra", "Blonde", "Channel Orange", "Endless"], correct: 1, category: "Music" },
  { text: "Chappell Roan's breakout hit in 2024 was called what?", options: ["Good Luck Babe!", "Pink Pony Club", "Red Wine Supernova", "Femininomenon"], correct: 0, category: "Music" },
  { text: "Bad Bunny is primarily known for singing in which language?", options: ["English", "Spanish", "Portuguese", "French"], correct: 1, category: "Music" },
  { text: "Which pop duo released 'Something Just Like This'?", options: ["Chainsmokers & Coldplay", "Kygo & Selena Gomez", "Disclosure & Lorde", "Marshmello & Anne-Marie"], correct: 0, category: "Music" },
  { text: "Olivia Rodrigo's album 'SOUR' was released in which year?", options: ["2019", "2020", "2021", "2022"], correct: 2, category: "Music" },
  { text: "Which artist is known as the 'King of Pop'?", options: ["Justin Bieber", "Michael Jackson", "Justin Timberlake", "Bruno Mars"], correct: 1, category: "Music" },
  { text: "Mitski's critically acclaimed 2022 album is titled what?", options: ["Be the Cowboy", "Puberty 2", "Laurel Hell", "Bury Me at Makeout Creek"], correct: 2, category: "Music" },
  { text: "Which Charli XCX album went viral in the summer of 2024?", options: ["Pop 2", "How I'm Feeling Now", "Brat", "Sucker"], correct: 2, category: "Music" },
  { text: "Silk Sonic is the duo formed by Bruno Mars and which other artist?", options: ["Childish Gambino", "Anderson .Paak", "Khalid", "H.E.R."], correct: 1, category: "Music" },
  { text: "Who sang 'Golden Hour', the Grammy-winning country-pop crossover hit?", options: ["Kacey Musgraves", "Lana Del Rey", "Brandi Carlile", "Maren Morris"], correct: 0, category: "Music" },
  { text: "What is the real name of rapper Cardi B?", options: ["Belcalis Almánzar", "Tamara Monét", "Katasha Carter", "Shanice Anderson"], correct: 0, category: "Music" },
  { text: "Which album by Lorde was released in 2017 and contained 'Green Light'?", options: ["Pure Heroine", "Solar Power", "Melodrama", "Team"], correct: 2, category: "Music" },
  { text: "The Weeknd's 'Blinding Lights' dominated the Billboard Hot 100 for which year?", options: ["2019", "2020", "2021", "2022"], correct: 1, category: "Music" },
  { text: "Which rapper released the album 'Certified Lover Boy' in 2021?", options: ["Kanye West", "Travis Scott", "Drake", "J. Cole"], correct: 2, category: "Music" },
  { text: "Which music festival takes place annually in the California desert in April?", options: ["Glastonbury", "Lollapalooza", "Coachella", "Burning Man"], correct: 2, category: "Music" },
  // ── Social ───────────────────────────────────────────────────────────────────
  { text: "Which platform is primarily associated with the 'Be Real' photo-sharing concept?", options: ["Locket", "BeReal", "Poparazzi", "Close Friends"], correct: 1, category: "Social" },
  { text: "In what year was Instagram launched?", options: ["2008", "2009", "2010", "2011"], correct: 2, category: "Social" },
  { text: "Which streaming platform launched in April 2020 and shut down six months later?", options: ["Quibi", "Vine", "Mixer", "Periscope"], correct: 0, category: "Social" },
  { text: "The viral 'Corn Kid' who said 'It's corn!' became famous on which platform?", options: ["Twitter", "YouTube", "Instagram", "TikTok"], correct: 3, category: "Social" },
  { text: "The 'Bottle Cap Challenge' went viral in 2019. What did participants do?", options: ["Balance a bottle on their head", "Kick a bottle cap off with a spinning kick", "Drink a full bottle in 10 seconds", "Catch a bottle cap in their mouth"], correct: 1, category: "Social" },
  { text: "Elon Musk rebranded Twitter to 'X' in which year?", options: ["2021", "2022", "2023", "2024"], correct: 2, category: "Social" },
  { text: "Which social media platform has a 'karma' points system?", options: ["Twitter", "Facebook", "Reddit", "LinkedIn"], correct: 2, category: "Social" },
  { text: "Wordle, the daily word game, was acquired by which publication?", options: ["The Guardian", "The New York Times", "BuzzFeed", "The Washington Post"], correct: 1, category: "Social" },
  { text: "What is the name of the viral AI chatbot released by OpenAI in late 2022?", options: ["Gemini", "Bard", "ChatGPT", "Claude"], correct: 2, category: "Social" },
  { text: "The phrase 'It's giving...' became a popular social media expression. What does it mean?", options: ["It's expensive", "It's giving off a vibe or energy", "It's going viral", "It's fake"], correct: 1, category: "Social" },
  { text: "Meta's VR headset product line is called what?", options: ["Oculus Quest", "Quest Pro", "Meta Vision", "Meta Quest"], correct: 3, category: "Social" },
  { text: "The 'Renegade' TikTok dance was created by which dancer?", options: ["Addison Rae", "Charli D'Amelio", "Jalaiah Harmon", "Avani Gregg"], correct: 2, category: "Social" },
  { text: "Which app uses the terms 'Streaks' and 'Snaps' as core features?", options: ["Instagram", "TikTok", "Snapchat", "WhatsApp"], correct: 2, category: "Social" },
  { text: "Which celebrity's Super Bowl ad became one of the most talked-about moments of 2023?", options: ["Kim Kardashian for Skims", "Travis Scott for McDonald's", "Serena Williams for Nike", "Kevin Hart for Fanduel"], correct: 3, category: "Social" },
  { text: "Doja Cat's hit 'Say So' got a boost from going viral on which platform?", options: ["Instagram Reels", "YouTube", "TikTok", "Spotify"], correct: 2, category: "Social" },
];

export class PopCultureQuizExperience implements ExperienceModule {
  readonly type = "pop_culture_quiz" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: PopCultureQuizState = {
      phase: "waiting",
      round: 0,
      totalRounds: 10,
      scores: {},
      currentQ: null,
      answers: {},
      questionStartedAt: 0,
      queue: shuffledIndices(QUESTIONS.length),
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    await redisClient.del(KEY(roomId));
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string;
    payload: unknown;
    roomId: string;
    guestId: string;
    role: "HOST" | "CO_HOST" | "GUEST";
    io: Server;
  }): Promise<void> {
    const p = payload as any;

    switch (action) {
      case "start":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._start(roomId, io);
        break;

      case "answer":
        await this._answer(roomId, guestId, p.index, io);
        break;

      case "reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._reveal(roomId, io);
        break;

      case "next":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._next(roomId, io);
        break;

      case "end":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this.onDeactivate(roomId);
        await redisClient.set(`room:${roomId}:experience`, "dj");
        io.to(roomId).emit("experience:changed" as any, {
          experienceType: "dj",
          view: { type: "dj_queue" },
          sequenceId: await getNextSequenceId(roomId),
        });
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    if (!state) return { type: "intermission" };
    return { type: "pop_culture_quiz" as any, data: this._safeState(state) };
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _start(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.round = 1;
    state.answers = {};
    state.questionStartedAt = Date.now();
    state.queue = shuffledIndices(QUESTIONS.length);
    state.currentQ = { ...QUESTIONS[state.queue[0]], index: 0 };
    state.phase = "question";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _answer(roomId: string, guestId: string, index: number, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "question") return;
    if (state.answers[guestId] !== undefined) return; // already answered
    if (typeof index !== "number" || index < 0 || index > 3) return;
    state.answers[guestId] = index;
    await this._save(roomId, state);
    // No broadcast — client shows local selection
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || !state.currentQ || state.phase !== "question") return;

    const correct = state.currentQ.correct;
    const now = Date.now();

    for (const [gId, chosen] of Object.entries(state.answers)) {
      if (chosen === correct) {
        const elapsed = Math.max(0, now - state.questionStartedAt);
        const speedBonus = Math.round(Math.max(0, (ANSWER_WINDOW_MS - elapsed) / ANSWER_WINDOW_MS) * 100);
        state.scores[gId] = (state.scores[gId] ?? 0) + 100 + speedBonus;
      }
    }

    state.phase = "reveal";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _next(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    const nextRound = state.round + 1;
    if (nextRound > state.totalRounds) {
      state.phase = "finished";
      state.currentQ = null;
      await this._save(roomId, state);
      await this._broadcast(roomId, state, io);
      return;
    }

    const nextIndex = (state.currentQ?.index ?? 0) + 1;
    const qIndex = state.queue[nextIndex % state.queue.length];
    state.round = nextRound;
    state.answers = {};
    state.questionStartedAt = Date.now();
    state.currentQ = { ...QUESTIONS[qIndex], index: nextIndex };
    state.phase = "question";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _broadcast(roomId: string, state: PopCultureQuizState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "pop_culture_quiz",
      state: this._safeState(state),
      view: { type: "pop_culture_quiz" as any, data: this._safeState(state) },
      sequenceId: seq,
    });
  }

  /** Strip answers before broadcasting so guests can't cheat */
  private _safeState(state: PopCultureQuizState): Omit<PopCultureQuizState, "answers"> {
    const { answers, ...safe } = state;
    // During question phase, also hide the correct answer
    if (state.phase === "question" && safe.currentQ) {
      const { correct, ...safeQ } = safe.currentQ;
      return { ...safe, currentQ: safeQ as any };
    }
    return safe;
  }

  private async _load(roomId: string): Promise<PopCultureQuizState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: PopCultureQuizState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}
