# Anime Music Quiz — Project Plan

A daily, browser-based game where players hear an anime song (OP/ED) and guess which
show it's from. Goal: score as many correct guesses as possible. Players pick a
difficulty tier; there is a shared daily set (same songs for everyone each day).

Status: **planning**. First build milestone is a working right/wrong guess loop.

---

## 1. Data sources

| API | Gives us | Notes |
|---|---|---|
| **AniList** (GraphQL, `https://graphql.anilist.co`) | Show metadata: titles (romaji/english/native), `popularity`, `favourites`, cover art, season/year, synonyms | Free, no auth for public queries. Rate limit ~90 req/min. `popularity` = # users with the show on a list — our main difficulty signal. |
| **AnimeThemes.moe** (REST, `https://api.animethemes.moe`) | The actual songs: OP/ED entries, song title, artist, and playable **audio + video** files, each linked to an AniList/MAL ID | Free, no auth. This is the media source. Provides `.ogg`/`.webm` files on `v.animethemes.moe` / `a.animethemes.moe`. |

**Critical data limitation (decided honestly):** AnimeThemes has **no per-song play/view
count**. There is no "how many people heard this song" number anywhere. So song-level
popularity cannot be measured directly — it must be *approximated* (see §4).

### How they join
AnimeThemes entries carry the show's AniList ID. So the pipeline is:
`AnimeThemes theme → AniList ID → AniList popularity/metadata`. We enrich every song
with its show's AniList stats and store the combined record.

---

## 2. Architecture (decided: lightweight backend)

We are building **shared-daily + heading toward a leaderboard**, which cannot be done
by browsers alone (browsers can't agree on one daily set or share scores). So:

```
                 ┌────────────────────────┐
   Player's      │   Static frontend      │   React + Vite, hosted free
   browser  ───► │   (Vercel/Netlify)     │   (Vercel/Netlify)
                 └───────────┬────────────┘
                             │ HTTPS (JSON)
                             ▼
                 ┌────────────────────────┐
                 │   Backend API          │   Node (Express/Fastify) or
                 │   - serves daily set   │   Python (FastAPI)
                 │   - records scores     │
                 │   - caches song DB     │
                 └───────────┬────────────┘
                             │
                 ┌───────────┴────────────┐
                 │   Database (Postgres)  │   songs, daily_sets, scores
                 └────────────────────────┘
                             ▲
                 ┌───────────┴────────────┐
                 │   Ingest job (cron)    │   pulls AnimeThemes + AniList,
                 │                        │   builds/refreshes song DB,
                 │                        │   picks tomorrow's daily set
                 └────────────────────────┘
```

**Why the backend earns its place here (not over-engineering):**
- It builds one canonical daily set so every player gets identical songs.
- It caches the song database so we don't hammer AniList/AnimeThemes on every page load
  (and stay under their rate limits).
- It's the only place a leaderboard/streak/account can live.
- The frontend never talks to AniList/AnimeThemes directly at play time — it just asks
  our backend "give me today's set for difficulty X."

**Cost:** all free-tier friendly — static host (Vercel) + a small backend + free Postgres
(Supabase/Neon/Railway).

---

## 3. Data model (first pass)

```
song
  id                (pk)
  animethemes_id
  anilist_id
  show_title_romaji
  show_title_english
  show_synonyms      (json, for accepting alt guesses)
  song_title
  artist
  theme_type         (OP / ED)
  theme_sequence     (1, 2, ...)   -- OP1, ED2, etc.
  audio_url
  video_url
  anilist_popularity (int)
  anilist_favourites (int)
  difficulty_tier    (easy | medium | hard)  -- computed, see §4
  answer_show_id     -- the AniList show that counts as "correct"

daily_set
  date               (pk, e.g. 2026-08-29)
  difficulty_tier
  song_ids           (json ordered list)

score
  id
  date
  difficulty_tier
  player_id          -- anon id (localStorage) at first, real accounts later
  correct_count
  total
  created_at
```

---

## 4. Difficulty algorithm (the honest version)

We have **one real signal** (show popularity) and **one approximated signal**
(song recognizability). Combine them into a single 0–100 difficulty score, then bucket.

**Show-popularity signal (real):**
- Use AniList `popularity`. Rank all shows, take a percentile (0–100). High percentile =
  well-known show = easier.

**Song-recognizability signal (approximated — no real data exists):**
- `theme_type`: OP tends to be more recognizable than ED → OP gets an easiness bonus.
- `theme_sequence`: OP1/ED1 more iconic than OP5/ED7 → lower sequence = easier.
- (Optional later) a manual "iconic" flag for a hand-curated set of famous songs.

**Combine:**
```
difficulty_score = w1 * show_popularity_percentile
                 + w2 * song_recognizability_score
```
Start with `w1 = 0.7, w2 = 0.3` (show popularity dominates because it's the trustworthy
signal), then tune by feel.

**Bucket:**
- easy   = top third (most popular/recognizable)
- medium = middle third
- hard   = bottom third

> Note to self: we are NOT claiming real "song viewership" — that data doesn't exist.
> The approximation is a deliberate, documented choice. If a better signal appears
> (e.g. Spotify/YouTube counts via another API), it slots into w2.

---

## 5. The core play loop (MVP — build this first)

The whole first milestone is **right vs. wrong**. Scoring points, streaks, and
leaderboards come after this works.

1. Frontend requests `GET /daily?difficulty=medium` → backend returns today's ordered
   song list (audio/video URLs + the accepted answer set, WITHOUT revealing the title).
2. For each song:
   - Play a short clip of the audio (e.g. first 20s, or a random window).
   - Show a text input with **autocomplete over anime titles**.
   - Player submits a guess.
   - **Match logic:** compare guess against `show_title_romaji`, `english`, and
     `synonyms` (normalized: lowercase, strip punctuation/spacing). Right or wrong.
   - Reveal the correct show + song title + artist.
3. After N songs: show a summary (X / N correct). Store an anon score locally + POST to
   backend.

### Answer-matching is the trickiest UX bit
Free-text "guess the anime" is unforgiving (typos, romaji vs english). Recommended:
**autocomplete/dropdown selection** — player picks a real show from a searchable list, so
the answer is an ID, not a fuzzy string. This kills the typo problem and matches how
AMQ-style games actually work. Free-text fuzzy matching can be a later "hard mode."

---

## 6. Tech stack (proposed)

- **Frontend:** React + Vite + TypeScript. Plain audio via `<audio>`. Autocomplete via a
  local title index served by the backend.
- **Backend:** Node + Fastify + TypeScript (or FastAPI if you prefer Python).
- **DB:** Postgres (Supabase or Neon free tier).
- **Ingest job:** a script run on a schedule (cron / Vercel cron / GitHub Action).
- **Hosting:** Vercel (frontend) + Railway/Render/Fly (backend) — all free tier to start.

---

## 7. Milestones

- **M0 — API spike:** fetch a handful of real AnimeThemes themes + their AniList stats,
  confirm the join works and audio URLs play. (Design against real data.)
- **M1 — Core loop, local:** hardcoded small song list → play clip → guess (autocomplete)
  → right/wrong → reveal → summary. No backend yet. **This is the "right/wrong" focus.**
- **M2 — Backend + DB:** ingest job builds the song DB, computes difficulty tiers, serves
  `/daily`. Frontend switches from hardcoded list to the API.
- **M3 — Shared daily:** cron picks the daily set per tier; everyone gets the same songs.
- **M4 — Scoring & leaderboard:** points system, streaks, anon → real accounts, board.

---

## 8. Open questions / to decide later

- Clip length and start point (fixed intro vs random window — random is harder/fairer).
- Points formula (speed bonus? partial credit for right franchise wrong season?).
- How many songs per daily run (5? 10?).
- Video or audio-only for the clip (video may leak visual hints — audio-only is purer).
- Content scope: all anime, or filter to a size (e.g. shows above some popularity floor)
  so "hard" isn't unguessably obscure.
- Legal/ToS: confirm AnimeThemes usage terms for embedding their media.
