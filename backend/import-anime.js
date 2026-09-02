const db = require("./db");

const query = `
query {
  Page(page: 1, perPage: 5) {
    media(type: ANIME, sort: POPULARITY_DESC) {
      id
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

async function getAnime() {
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: query
    })
  });

  const data = await response.json();

  const animeList = data.data.Page.media;

for (const anime of animeList) {
  await db.execute(
    `INSERT INTO anime
    (anilist_id, title_english, title_romaji, title_native, year, popularity)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      anime.id,
      anime.title.english,
      anime.title.romaji,
      anime.title.native,
      anime.seasonYear,
      anime.popularity
    ]
  );

  console.log("Inserted:", anime.title.english);
}
}

getAnime();