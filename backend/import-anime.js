const db = require("./db");
const { calculateAnimeScore } = require("./scoring");

const ANIME_LIMIT = 50;

// Change this to:
// "auto"    = AniList first, MAL fallback
// "anilist" = only AniList
// "mal"     = only MAL
const SOURCE_MODE = "mal";


async function fetchFromAniList() {
  console.log("Trying AniList...");

  const query = `
    query {
      Page(page: 1, perPage: ${ANIME_LIMIT}) {
        media(
          type: ANIME,
          sort: POPULARITY_DESC,
          isAdult: false
        ) {
          id
          idMal
          title {
            english
            romaji
            native
          }
          seasonYear
          popularity
        }
      }
    }
  `;

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.log(`AniList unavailable: ${response.status}`);
    console.log(errorText);

    throw new Error("AniList unavailable");
  }

  const data = await response.json();

  return data.data.Page.media.map(anime => ({
    anilist_id: anime.id,
    mal_id: anime.idMal,
    title_english: anime.title.english,
    title_romaji: anime.title.romaji,
    title_native: anime.title.native,
    year: anime.seasonYear,
    popularity: anime.popularity
  }));
}


async function fetchFromMal() {
  console.log("Using official MAL API...");

  const response = await fetch(
    `https://api.myanimelist.net/v2/anime/ranking?ranking_type=all&limit=${ANIME_LIMIT}&fields=alternative_titles,start_date,num_list_users,num_scoring_users,mean`,
    {
      headers: {
        "X-MAL-CLIENT-ID": process.env.MAL_CLIENT_ID
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.log(`MAL unavailable: ${response.status}`);
    console.log(errorText);

    throw new Error("MAL unavailable");
  }

  const data = await response.json();

  return data.data.map(item => {
  const anime = item.node;

  const mappedAnime = {
    anilist_id: null,
    mal_id: anime.id,
    title_english: anime.alternative_titles?.en || null,
    title_romaji: anime.title,
    title_native: anime.alternative_titles?.ja || null,

    year: anime.start_date
      ? Number(anime.start_date.substring(0, 4))
      : null,

    mal_members: anime.num_list_users,
    mal_scoring_users: anime.num_scoring_users,
    mal_mean: anime.mean
  };

  mappedAnime.anime_score = calculateAnimeScore(mappedAnime);

  return mappedAnime;
});
}


async function saveAnime(animeList, source) {
  for (const anime of animeList) {

    const [existingRows] = await db.execute(
      `SELECT id
       FROM anime
       WHERE mal_id = ?
          OR (anilist_id IS NOT NULL AND anilist_id = ?)
       LIMIT 1`,
      [
        anime.mal_id,
        anime.anilist_id
      ]
    );

    if (existingRows.length > 0) {
      const jamimeId = existingRows[0].id;

      await db.execute(
        `UPDATE anime
         SET
           anilist_id = COALESCE(?, anilist_id),
           mal_id = COALESCE(?, mal_id),
           title_english = ?,
           title_romaji = ?,
           title_native = ?,
           year = ?,
           mal_members = ?,
           mal_scoring_users = ?,
           mal_mean = ?,
           anime_score = ?
         WHERE id = ?`,
        [
          anime.anilist_id,
          anime.mal_id,
          anime.title_english,
          anime.title_romaji,
          anime.title_native,
          anime.year,
          anime.mal_members,
          anime.mal_scoring_users,
          anime.mal_mean,
          anime.anime_score,
          jamimeId
        ]
      );

      console.log(
        `Updated: ${anime.title_romaji} | Score: ${anime.anime_score}/50`
      );

    } else {

      await db.execute(
        `INSERT INTO anime
        (
          anilist_id,
          mal_id,
          title_english,
          title_romaji,
          title_native,
          year,
          mal_members,
          mal_scoring_users,
          mal_mean,
          anime_score
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          anime.anilist_id,
          anime.mal_id,
          anime.title_english,
          anime.title_romaji,
          anime.title_native,
          anime.year,
          anime.mal_members,
          anime.mal_scoring_users,
          anime.mal_mean,
          anime.anime_score
        ]
      );

      console.log(
        `Inserted: ${anime.title_romaji} | Score: ${anime.anime_score}/50`
      );
    }
  }

  console.log(`Anime import finished using ${source}.`);
}


async function importAnime() {
  try {
    let animeList;
    let source;

    if (SOURCE_MODE === "mal") {
      animeList = await fetchFromMal();
      source = "MAL";
    }

    else if (SOURCE_MODE === "anilist") {
      animeList = await fetchFromAniList();
      source = "AniList";
    }

    else {
      try {
        animeList = await fetchFromAniList();
        source = "AniList";
      } catch {
        console.log("Falling back to MAL...");

        animeList = await fetchFromMal();
        source = "MAL";
      }
    }

    await saveAnime(animeList, source);

  } catch (error) {
    console.error("Anime import failed:", error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

importAnime();