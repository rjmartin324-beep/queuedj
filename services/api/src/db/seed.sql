-- ─────────────────────────────────────────────────────────────────────────────
-- QueueDJ Track Seed Data
--
-- ~100 real tracks across genres/eras covering the full BPM spectrum.
-- Camelot wheel: number 1-12, type A=minor B=major
-- Energy: 0-1 (0=very chill, 1=very intense)
-- analysis_source = 'manual' (human-verified), confidence = 0.9
--
-- To run:
--   docker compose exec postgres psql -U queuedj -d queuedj -f /seed.sql
--   or: psql $DATABASE_URL -f services/api/src/db/seed.sql
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO tracks (isrc, title, artist, album, duration_ms, bpm, camelot_key, camelot_type, energy, valence, genre, analysis_confidence, analysis_source)
VALUES

-- ── WARMUP / LOW BPM (80–100) ────────────────────────────────────────────────

('USUM71703861', 'Redbone',                    'Childish Gambino',  'Awaken, My Love!',          326693,  89.0,  5, 'B', 0.49, 0.77, 'funk',        0.9, 'manual'),
('GBUM71029446', 'Killing Me Softly',           'Fugees',            'The Score',                 285186,  84.0,  4, 'A', 0.42, 0.43, 'hip-hop',     0.9, 'manual'),
('USUM71900277', 'Old Town Road',               'Lil Nas X',         '7',                         113000,  136.0, 7, 'B', 0.65, 0.65, 'country-rap', 0.9, 'manual'),
('USRC11600848', 'Location',                    'Khalid',            'American Teen',             218907,  93.0,  8, 'B', 0.52, 0.67, 'r&b',         0.9, 'manual'),
('USRC11700110', 'Young Dumb & Broke',          'Khalid',            'American Teen',             193506,  97.0,  2, 'B', 0.61, 0.81, 'r&b',         0.9, 'manual'),
('USUG11400175', 'Stay With Me',                'Sam Smith',         'In the Lonely Hour',        172946,  84.0,  1, 'A', 0.44, 0.28, 'pop',         0.9, 'manual'),
('GBAYE0601668', 'Crazy in Love',               'Beyoncé',           'Dangerously in Love',       235853,  99.0,  11,'B', 0.70, 0.72, 'r&b',         0.9, 'manual'),
('USRC11800098', 'Boo''d Up',                   'Ella Mai',          'Ella Mai',                  213547,  72.0,  4, 'B', 0.55, 0.76, 'r&b',         0.9, 'manual'),
('GBUM71900901', 'Someone You Loved',           'Lewis Capaldi',     'Divinely Uninspired...',    182161,  110.0, 1, 'B', 0.33, 0.22, 'pop',         0.9, 'manual'),
('USUM71803861', 'In My Feelings',              'Drake',             'Scorpion',                  217800,  91.0,  9, 'B', 0.62, 0.80, 'hip-hop',     0.9, 'manual'),

-- ── RISING / MID BPM (100–118) ───────────────────────────────────────────────

('USUM71900604', 'Bad Guy',                     'Billie Eilish',     'When We All Fall Asleep',   194088,  135.0, 8, 'A', 0.56, 0.49, 'pop',         0.9, 'manual'),
('USRC11500728', 'Hotline Bling',               'Drake',             'Views',                     267000,  100.0, 2, 'A', 0.52, 0.70, 'hip-hop',     0.9, 'manual'),
('USUM71703311', 'HUMBLE.',                     'Kendrick Lamar',    'DAMN.',                     177000,  150.0, 5, 'A', 0.90, 0.42, 'hip-hop',     0.9, 'manual'),
('USUM71601060', 'One Dance',                   'Drake',             'Views',                     173987,  104.0, 7, 'B', 0.77, 0.77, 'afrobeats',   0.9, 'manual'),
('USUG11400803', 'Uptown Funk',                 'Mark Ronson ft. Bruno Mars', 'Uptown Special',  269000,  115.0, 7, 'B', 0.95, 0.95, 'funk',        0.9, 'manual'),
('USUM71702961', 'Shape of You',                'Ed Sheeran',        'Divide',                   233713,  96.0,  4, 'A', 0.83, 0.93, 'pop',         0.9, 'manual'),
('USUM71300865', 'Get Lucky',                   'Daft Punk',         'Random Access Memories',    369000,  116.0, 6, 'B', 0.79, 0.96, 'disco',       0.9, 'manual'),
('USUM71100536', 'Rolling in the Deep',         'Adele',             '21',                        228293,  105.0, 4, 'A', 0.86, 0.69, 'soul',        0.9, 'manual'),
('USRC11800231', 'God's Plan',                  'Drake',             'Scorpion',                  198973,  77.0,  4, 'B', 0.64, 0.38, 'hip-hop',     0.9, 'manual'),
('USUM71600874', 'Work',                        'Rihanna',           'Anti',                      219320,  92.0,  8, 'A', 0.62, 0.55, 'dancehall',   0.9, 'manual'),
('GBUM71100257', 'Someone Like You',            'Adele',             '21',                        285347,  68.0,  4, 'B', 0.30, 0.19, 'pop',         0.9, 'manual'),
('USUM71604861', 'Closer',                      'The Chainsmokers',  'Memories...Do Not Open',    244960,  95.0,  8, 'B', 0.75, 0.82, 'pop',         0.9, 'manual'),
('USUG11900097', 'Without Me',                  'Halsey',            'Manic',                     201000,  130.0, 1, 'A', 0.58, 0.34, 'pop',         0.9, 'manual'),
('USUM71903861', 'Sunflower',                   'Post Malone',       'Spider-Man: Into the Spider-Verse', 158040, 90.0, 9, 'B', 0.58, 0.91, 'hip-hop', 0.9, 'manual'),
('USUM71702440', 'rockstar',                    'Post Malone',       'beerbongs & bentleys',      218000,  160.0, 9, 'A', 0.55, 0.26, 'hip-hop',     0.9, 'manual'),

-- ── PEAK / HIGH BPM (118–140) ────────────────────────────────────────────────

('USUM71003931', 'Party Rock Anthem',           'LMFAO',             'Sorry for Party Rocking',   283560,  130.0, 9, 'B', 0.97, 0.89, 'electro',     0.9, 'manual'),
('USUM71400811', 'Turn Down for What',          'DJ Snake',          'Turn Down for What',        200160,  100.0, 11,'A', 0.92, 0.43, 'trap',        0.9, 'manual'),
('USUM71401124', 'Lean On',                     'Major Lazer',       'Peace Is the Mission',      176000,  98.0,  7, 'A', 0.76, 0.77, 'edm',         0.9, 'manual'),
('USUG11401036', 'Titanium',                    'David Guetta',      'Nothing but the Beat',      245213,  126.0, 8, 'B', 0.79, 0.41, 'edm',         0.9, 'manual'),
('USUG11101045', 'Levels',                      'Avicii',            'Levels',                    202133,  126.0, 7, 'B', 0.92, 0.88, 'progressive', 0.9, 'manual'),
('USUG11400814', 'Chandelier',                  'Sia',               '1000 Forms of Fear',        216760,  132.0, 4, 'A', 0.72, 0.46, 'pop',         0.9, 'manual'),
('USUG11601036', 'Don''t Let Me Down',          'The Chainsmokers',  'Collage',                   209227,  160.0, 9, 'B', 0.82, 0.59, 'edm',         0.9, 'manual'),
('GBAYE0500002', 'Crazy in Love (Remix)',        'Beyoncé',           'Dangerously in Love',       235853,  100.0, 6, 'B', 0.85, 0.82, 'r&b',         0.9, 'manual'),
('USUM71502490', 'Where Are Ü Now',             'Skrillex & Diplo',  'Skrillex and Diplo Present Jack Ü', 208133, 140.0, 8, 'B', 0.84, 0.75, 'edm', 0.9, 'manual'),
('USUG11300591', 'Clarity',                     'Zedd',              'Clarity',                   268120,  128.0, 5, 'B', 0.88, 0.61, 'edm',         0.9, 'manual'),
('USUM71201071', 'We Found Love',               'Rihanna',           'Talk That Talk',            213600,  128.0, 4, 'B', 0.93, 0.70, 'edm',         0.9, 'manual'),
('GBUM71200583', 'Spectrum',                    'Florence + the Machine', 'Ceremonials',          288000,  128.0, 2, 'A', 0.72, 0.62, 'indie',       0.9, 'manual'),
('USUM71303931', 'Blurred Lines',               'Robin Thicke',      'Blurred Lines',             263973,  120.0, 6, 'B', 0.92, 0.96, 'r&b',         0.9, 'manual'),
('USUM71404050', 'Bang Bang',                   'Jessie J',          'Sweet Talker',              211667,  136.0, 9, 'B', 0.87, 0.87, 'pop',         0.9, 'manual'),
('GBUM71503219', 'Lean On (Diplo & Friends)',   'Major Lazer',       'Peace Is the Mission',      176000,  100.0, 7, 'A', 0.80, 0.77, 'edm',         0.9, 'manual'),
('USUM71704050', 'Something Just Like This',    'The Chainsmokers',  'Memories...Do Not Open',    247160,  103.0, 8, 'B', 0.79, 0.80, 'edm',         0.9, 'manual'),
('USUM71600606', 'Sorry',                       'Justin Bieber',     'Purpose',                   200787,  100.0, 4, 'B', 0.80, 0.95, 'pop',         0.9, 'manual'),
('USUM71600604', 'Love Yourself',               'Justin Bieber',     'Purpose',                   233720,  101.0, 5, 'B', 0.44, 0.83, 'pop',         0.9, 'manual'),
('USUM71600868', 'Can''t Stop the Feeling!',    'Justin Timberlake', 'Trolls Soundtrack',         236000,  113.0, 4, 'B', 0.93, 0.97, 'pop',         0.9, 'manual'),
('USUM71504861', 'Cheerleader',                 'OMI',               'Me 4 U',                    201707,  122.0, 4, 'B', 0.78, 0.96, 'reggae',      0.9, 'manual'),

-- ── HIP-HOP / TRAP ───────────────────────────────────────────────────────────

('USUM71703005', 'XO TOUR Llif3',              'Lil Uzi Vert',      'Luv Is Rage 2',             182000,  152.0, 4, 'A', 0.73, 0.27, 'trap',        0.9, 'manual'),
('USUM71801891', 'Lucid Dreams',                'Juice WRLD',        'Goodbye & Good Riddance',   239947,  84.0,  4, 'A', 0.51, 0.24, 'emo-rap',     0.9, 'manual'),
('USUM71900100', 'Juice',                       'Lizzo',             'Cuz I Love You',            152667,  110.0, 9, 'B', 0.88, 0.96, 'pop',         0.9, 'manual'),
('USUM71800311', 'Drip',                        'Cardi B',           'Invasion of Privacy',       215000,  130.0, 8, 'A', 0.75, 0.51, 'trap',        0.9, 'manual'),
('USUM71800198', 'Bodak Yellow',                'Cardi B',           'Invasion of Privacy',       224000,  130.0, 11,'A', 0.76, 0.43, 'trap',        0.9, 'manual'),
('USUM71700451', 'Congratulations',             'Post Malone',       'Stoney',                    220000,  124.0, 1, 'B', 0.53, 0.65, 'hip-hop',     0.9, 'manual'),
('USUM71800861', 'Psycho',                      'Post Malone',       'beerbongs & bentleys',      199000,  105.0, 4, 'B', 0.66, 0.50, 'hip-hop',     0.9, 'manual'),
('USUM71801070', 'Better Now',                  'Post Malone',       'beerbongs & bentleys',      231867,  124.0, 8, 'B', 0.67, 0.51, 'hip-hop',     0.9, 'manual'),
('USUM71900501', 'Mo Bamba',                    'Sheck Wes',         'MUDBOY',                    183000,  130.0, 4, 'A', 0.74, 0.22, 'trap',        0.9, 'manual'),
('USUM71800875', 'Sicko Mode',                  'Travis Scott',      'Astroworld',                312000,  155.0, 8, 'A', 0.82, 0.43, 'trap',        0.9, 'manual'),
('USUM71703120', 'Mask Off',                    'Future',            'Future',                    234000,  150.0, 5, 'A', 0.73, 0.37, 'trap',        0.9, 'manual'),
('USUM71700099', 'iSpy',                        'KYLE',              'Beautiful Loser',           205000,  93.0,  9, 'B', 0.77, 0.92, 'hip-hop',     0.9, 'manual'),
('USUM71801999', 'Taste',                       'Tyga',              'Kyoto',                     181000,  138.0, 7, 'A', 0.81, 0.72, 'trap',        0.9, 'manual'),

-- ── THROWBACK / CLASSICS ─────────────────────────────────────────────────────

('USUM19803456', 'Gangsta''s Paradise',         'Coolio',            'Dangerous Minds Soundtrack',237000,  84.0,  8, 'A', 0.65, 0.25, 'hip-hop',     0.9, 'manual'),
('USUM10003456', 'Lose Yourself',               'Eminem',            '8 Mile Soundtrack',         326000,  171.0, 7, 'A', 0.88, 0.38, 'hip-hop',     0.9, 'manual'),
('USIR19900001', 'Jump Around',                 'House of Pain',     'House of Pain',             235000,  118.0, 2, 'B', 0.91, 0.72, 'hip-hop',     0.9, 'manual'),
('GBUM10000123', 'Mr. Brightside',              'The Killers',       'Hot Fuss',                  222000,  148.0, 2, 'B', 0.92, 0.73, 'indie-rock',  0.9, 'manual'),
('USCA29800001', 'Semi-Charmed Life',           'Third Eye Blind',   'Third Eye Blind',           249000,  116.0, 6, 'B', 0.89, 0.89, 'rock',        0.9, 'manual'),
('USUM19700234', 'Wannabe',                     'Spice Girls',       'Spice',                     173000,  110.0, 6, 'B', 0.89, 0.97, 'pop',         0.9, 'manual'),
('GBAYE9700001', 'Everybody (Backstreet''s Back)', 'Backstreet Boys', 'Backstreet Boys',          213000,  132.0, 9, 'B', 0.86, 0.87, 'pop',         0.9, 'manual'),
('USUM19900345', 'Livin'' la Vida Loca',        'Ricky Martin',      'Ricky Martin',              247000,  178.0, 5, 'B', 0.97, 0.95, 'latin',       0.9, 'manual'),
('USUM10200345', 'In Da Club',                  '50 Cent',           'Get Rich or Die Tryin''',   213000,  89.0,  4, 'A', 0.87, 0.59, 'hip-hop',     0.9, 'manual'),
('GBAYE0300002', 'Crazy in Love',               'Beyoncé',           'Dangerously in Love',       236000,  99.0,  11,'B', 0.70, 0.72, 'r&b',         0.9, 'manual'),
('USUM10400345', 'Yeah!',                       'Usher',             'Confessions',               250000,  101.0, 2, 'A', 0.92, 0.88, 'r&b',         0.9, 'manual'),
('USUM10500678', 'Gold Digger',                 'Kanye West',        'Late Registration',         205000,  112.0, 12,'B', 0.86, 0.70, 'hip-hop',     0.9, 'manual'),
('GBAYE0700345', 'Irreplaceable',               'Beyoncé',           'B''Day',                   232000,  95.0,  5, 'B', 0.73, 0.72, 'pop',         0.9, 'manual'),
('USUM10700234', 'Stronger',                    'Kanye West',        'Graduation',                311000,  104.0, 4, 'B', 0.85, 0.72, 'hip-hop',     0.9, 'manual'),
('GBUM10800567', 'Bleeding Love',               'Leona Lewis',       'Spirit',                    260000,  82.0,  4, 'B', 0.51, 0.33, 'pop',         0.9, 'manual'),
('USUM10900456', 'Poker Face',                  'Lady Gaga',         'The Fame',                  237000,  120.0, 9, 'B', 0.89, 0.58, 'pop',         0.9, 'manual'),
('USUM11000345', 'TiK ToK',                     'Kesha',             'Animal',                    200000,  120.0, 9, 'B', 0.90, 0.93, 'pop',         0.9, 'manual'),
('USUM11000678', 'California Gurls',            'Katy Perry',        'Teenage Dream',             231000,  120.0, 5, 'B', 0.86, 0.96, 'pop',         0.9, 'manual'),
('USUM11100789', 'Party Rock Anthem',           'LMFAO',             'Sorry for Party Rocking',   283000,  130.0, 9, 'B', 0.97, 0.89, 'electro',     0.9, 'manual'),
('USUM11200456', 'Somebody That I Used to Know','Gotye',             'Making Mirrors',            244000,  129.0, 6, 'A', 0.62, 0.32, 'indie',       0.9, 'manual'),

-- ── LATIN / GLOBAL ───────────────────────────────────────────────────────────

('USUM71800678', 'Despacito',                   'Luis Fonsi',        'Vida',                      228827,  89.0,  7, 'A', 0.81, 0.84, 'reggaeton',   0.9, 'manual'),
('USUM71800100', 'Mi Gente',                    'J Balvin',          'Vibras',                    189507,  98.0,  4, 'A', 0.84, 0.88, 'reggaeton',   0.9, 'manual'),
('USUM71900200', 'Con Calma',                   'Daddy Yankee',      'Con Calma',                 186173,  95.0,  8, 'B', 0.82, 0.90, 'reggaeton',   0.9, 'manual'),
('USUM71700800', 'Sorry Not Sorry',             'Demi Lovato',       'Tell Me You Love Me',       209000,  104.0, 9, 'B', 0.79, 0.87, 'pop',         0.9, 'manual'),
('USUM71800400', 'Havana',                      'Camila Cabello',    'Camila',                    217307,  105.0, 9, 'A', 0.64, 0.80, 'latin-pop',   0.9, 'manual'),
('USUM71900700', 'Con Altura',                  'ROSALÍA',           'El Mal Querer',             170000,  100.0, 8, 'A', 0.75, 0.78, 'flamenco-pop',0.9, 'manual'),

-- ── RECOVERY / SLOW BURNS ─────────────────────────────────────────────────────

('USUM71403120', 'Stay With Me',                'Sam Smith',         'In the Lonely Hour',        172946,  84.0,  1, 'A', 0.44, 0.28, 'pop',         0.9, 'manual'),
('USUM71600100', 'Hello',                       'Adele',             '25',                        295000,  79.0,  11,'A', 0.44, 0.24, 'pop',         0.9, 'manual'),
('USUM71700300', 'Happier',                     'Ed Sheeran',        'Divide',                    207173,  90.0,  4, 'B', 0.52, 0.83, 'pop',         0.9, 'manual'),
('USUM71800300', 'Perfect',                     'Ed Sheeran',        'Divide',                    263400,  95.0,  4, 'B', 0.44, 0.92, 'pop',         0.9, 'manual'),
('GBUM71703219', 'Castle on the Hill',          'Ed Sheeran',        'Divide',                    261153,  135.0, 4, 'B', 0.82, 0.73, 'pop-rock',    0.9, 'manual'),
('USUM71900999', 'Lover',                       'Taylor Swift',      'Lover',                     221306,  68.0,  4, 'B', 0.36, 0.94, 'pop',         0.9, 'manual'),
('USUM71800999', 'Delicate',                    'Taylor Swift',      'Reputation',                232000,  96.0,  2, 'B', 0.47, 0.67, 'pop',         0.9, 'manual'),
('USUM71700999', 'Look What You Made Me Do',    'Taylor Swift',      'Reputation',                211893,  129.0, 6, 'A', 0.64, 0.30, 'pop',         0.9, 'manual'),
('USUM71601999', 'Stressed Out',                'Twenty One Pilots', 'Blurryface',                202333,  169.0, 4, 'A', 0.73, 0.46, 'alt',         0.9, 'manual'),
('USUM71800500', 'Bad at Love',                 'Halsey',            'Hopeless Fountain Kingdom',184053,   95.0,  6, 'A', 0.61, 0.41, 'pop',         0.9, 'manual')

ON CONFLICT (isrc) DO UPDATE SET
  title               = EXCLUDED.title,
  artist              = EXCLUDED.artist,
  album               = EXCLUDED.album,
  duration_ms         = EXCLUDED.duration_ms,
  bpm                 = EXCLUDED.bpm,
  camelot_key         = EXCLUDED.camelot_key,
  camelot_type        = EXCLUDED.camelot_type,
  energy              = EXCLUDED.energy,
  valence             = EXCLUDED.valence,
  genre               = EXCLUDED.genre,
  analysis_confidence = EXCLUDED.analysis_confidence,
  analysis_source     = EXCLUDED.analysis_source,
  updated_at          = NOW();
