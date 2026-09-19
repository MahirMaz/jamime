require("dotenv").config();

const song = {
  title: "Cinderella",
  artist: "Cidergirl",
  anime: "Komi Can't Communicate",
  themeType: "OP",
  themeNumber: 1
};


function normalize(text) {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function isRejected(video) {
  const text = normalize(`${video.title} ${video.channel}`);

  const rejectedWords = [
    "cover",
    "reaction",
    "react",
    "mashup",
    "nightcore",
    "remix",
    "amv",
    "instrumental",
    "karaoke",
    "slowed",
    "live",
    "piano",
    "guitar",
    "fingerstyle",
    "tutorial",
    "sheet music",
    "english ver",
    "english version"
  ];

  return rejectedWords.some(word => text.includes(word));
}


function getTextScore(video) {
  const title = normalize(video.title);
  const channel = normalize(video.channel);

  const songTitle = normalize(song.title);
  const artist = normalize(song.artist);
  const anime = normalize(song.anime);

  let score = 0;

  // Exact-ish song title match
  if (title.includes(songTitle)) {
    score += 4;
  }

  // Artist appears in title or channel
  if (title.includes(artist) || channel.includes(artist)) {
    score += 3;
  }

  // Anime title appears
  if (title.includes(anime)) {
    score += 3;
  }

  // Opening information
  if (
    song.themeType === "OP" &&
    (
      title.includes("opening") ||
      title.includes(`op${song.themeNumber}`) ||
      title.includes(`op ${song.themeNumber}`)
    )
  ) {
    score += 2;
  }

  // Ending information
  if (
    song.themeType === "ED" &&
    (
      title.includes("ending") ||
      title.includes(`ed${song.themeNumber}`) ||
      title.includes(`ed ${song.themeNumber}`)
    )
  ) {
    score += 2;
  }

  return score;
}


function getRankScore(bestRank) {
  if (bestRank === 1) return 5;
  if (bestRank === 2) return 4;
  if (bestRank === 3) return 3;
  if (bestRank <= 5) return 2;

  return 1;
}


function getViewBonus(views) {
  if (views >= 100000000) return 5;
  if (views >= 50000000) return 4;
  if (views >= 10000000) return 3;
  if (views >= 1000000) return 2;
  if (views >= 100000) return 1;

  return 0;
}


async function youtubeSearch(query) {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(query)}&key=${process.env.YOUTUBE_API_KEY}`
  );

  const data = await response.json();

  return data.items || [];
}


async function testYoutube() {

  const queries = [
    `${song.title} ${song.artist}`,
    `${song.title} ${song.anime}`
  ];

  const candidateMap = new Map();

  // Run both searches
  for (const query of queries) {
    console.log(`Searching: ${query}`);

    const results = await youtubeSearch(query);

    results.forEach((item, index) => {
      const videoId = item.id.videoId;
      const rank = index + 1;

      if (!candidateMap.has(videoId)) {
        candidateMap.set(videoId, {
          videoId,
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          bestRank: rank,
          searchHits: 1
        });

      } else {
        const existing = candidateMap.get(videoId);

        // Remember the best position YouTube gave this video
        existing.bestRank = Math.min(
          existing.bestRank,
          rank
        );

        // Appearing in both searches is useful evidence
        existing.searchHits += 1;
      }
    });
  }


  const candidates = Array.from(candidateMap.values());

  if (candidates.length === 0) {
    console.log("\nNo YouTube results found.");
    return;
  }


  // Get view counts for every unique video
  const videoIds = candidates
    .map(video => video.videoId)
    .join(",");

  const statsResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${process.env.YOUTUBE_API_KEY}`
  );

  const statsData = await statsResponse.json();

  const viewsById = {};

  for (const video of statsData.items || []) {
    viewsById[video.id] =
      Number(video.statistics.viewCount || 0);
  }


  // Calculate confidence for each candidate
  for (const video of candidates) {

    video.views =
      viewsById[video.videoId] || 0;


    // Reject obvious alternate/wrong versions first
    if (isRejected(video)) {
      video.rejected = true;
      video.textScore = 0;
      video.matchScore = -1;
      continue;
    }

    video.rejected = false;


    const textScore =
      getTextScore(video);

    const rankScore =
      getRankScore(video.bestRank);

    const repeatedSearchBonus =
      video.searchHits > 1 ? 2 : 0;


    // Save these separately so we can inspect them
    video.textScore = textScore;

    video.matchScore =
      textScore +
      rankScore +
      repeatedSearchBonus;


    // Keeping this for debugging,
    // but views no longer decide whether a video is valid.
    video.viewBonus =
      getViewBonus(video.views);
  }


  /*
    A video must:

    1. Not be rejected
    2. Reach at least 4 total relevance points
    3. Also have at least one stronger piece of evidence:
       - appeared in both searches
       - ranked in YouTube's top 5
       - strong text match
  */

  const validCandidates = candidates.filter(
    video =>
      !video.rejected &&
      video.matchScore >= 4 &&
      (
        video.searchHits > 1 ||
        video.bestRank <= 5 ||
        video.textScore >= 4
      )
  );


  /*
    Once a video is considered a valid match,
    views determine which representative upload we use.
  */

  validCandidates.sort(
    (a, b) => b.views - a.views
  );


  console.log("\nVALID CANDIDATES:");

  for (const video of validCandidates) {
    console.log(video);
  }


  if (validCandidates.length === 0) {
    console.log(
      "\nNo confident YouTube match found."
    );
    return;
  }


  console.log("\nSELECTED VIDEO:");
  console.log(validCandidates[0]);
}


testYoutube();