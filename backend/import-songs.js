const db = require("./db");

const ANIMETHEMES_URL = "https://api.animethemes.moe/anime";
const INCLUDE =
  "animethemes.song.artists,animethemes.animethemeentries.videos.audio";

async function fetchThemes(anime) {
  // First try the reliable AniList ID connection.
  const idParams = new URLSearchParams({
    "filter[external_id]": anime.anilist_id,
    "filter[has]": "resources",
    "filter[site]": "AniList",
    include: INCLUDE
  });

  let response = await fetch(`${ANIMETHEMES_URL}?${idParams}`, {
    headers: {
      "User-Agent": "Jamime/1.0",
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`AnimeThemes returned status ${response.status}`);
  }

  let data = await response.json();

  // If AnimeThemes has no AniList ID match, try the romaji title instead.
  if (!data.anime?.length) {
    console.log(`No ID match for ${anime.title_romaji}; trying its title...`);

    const titleParams = new URLSearchParams({
      "filter[name]": anime.title_romaji,
      include: INCLUDE
    });

    response = await fetch(`${ANIMETHEMES_URL}?${titleParams}`, {
      headers: {
        "User-Agent": "Jamime/1.0",
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`AnimeThemes returned status ${response.status}`);
    }

    data = await response.json();
  }

  return data.anime?.[0]?.animethemes || [];
}

async function importSongs() {
  try {
    const [animeList] = await db.execute(
      "SELECT id, anilist_id, title_romaji FROM anime"
    );

    if (animeList.length === 0) {
      throw new Error("The anime table is empty. Run npm run import:anime first.");
    }

    for (const anime of animeList) {
      console.log(`Fetching songs for ${anime.title_romaji}...`);
      const themes = await fetchThemes(anime);

      for (const theme of themes) {
        const video = theme.animethemeentries?.[0]?.videos?.[0];
        const artist = theme.song?.artists
          ?.map((item) => item.name)
          .join(", ") || null;

        await db.execute(
          `INSERT INTO songs
            (anime_id, animethemes_id, title, artist, theme_type, theme_number, video_url, audio_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
            anime_id = VALUES(anime_id),
            title = VALUES(title),
            artist = VALUES(artist),
            theme_type = VALUES(theme_type),
            theme_number = VALUES(theme_number),
            video_url = VALUES(video_url),
            audio_url = VALUES(audio_url)`,
          [
            anime.id,
            theme.id,
            theme.song?.title || null,
            artist,
            theme.type,
            theme.sequence,
            video?.link || null,
            video?.audio?.link || null
          ]
        );

        console.log("Imported:", theme.song?.title || theme.slug);
      }
    }

    console.log("Song import finished.");
  } catch (error) {
    console.error("Song import failed:", error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

importSongs();
