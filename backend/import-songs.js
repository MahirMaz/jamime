const db = require("./db");

async function getSongs() {
  console.log("fetching...");

  const response = await fetch(
    "https://api.animethemes.moe/anime?filter[name]=Shingeki%20no%20Kyojin&include=animethemes.song,animethemes.animethemeentries.videos",
    {
      headers: {
        "User-Agent": "Jamime/1.0",
        "Accept": "application/json"
      }
    }
  );

  console.log("status:", response.status);

  const data = await response.json();

  const anime = data.anime[0];
  const themes = anime.animethemes;

  const [rows] = await db.execute(
    "SELECT id FROM anime WHERE title_romaji = ?",
    [anime.name]
  );

  const animeId = rows[0].id;

  for (const theme of themes) {
    const video = theme.animethemeentries[0]?.videos[0];

    await db.execute(
      `INSERT INTO songs
      (anime_id, title, theme_type, theme_number, video_url)
      VALUES (?, ?, ?, ?, ?)`,
      [
        animeId,
        theme.song.title,
        theme.type,
        theme.sequence,
        video?.link || null
      ]
    );

    console.log("Inserted:", theme.song.title);
  }
}

getSongs();