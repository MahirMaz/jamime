function scoreMembers(members) {
  if (members >= 1000000) return 15;
  if (members >= 850000) return 14;
  if (members >= 700000) return 13;
  if (members >= 500000) return 12;
  if (members >= 300000) return 9;
  if (members >= 50000) return 6;
  return 0;
}


function scoreScoringUsers(users) {
  if (users >= 900000) return 15;
  if (users >= 700000) return 12;
  if (users >= 400000) return 9;
  if (users >= 150000) return 6;
  if (users >= 50000) return 3;
  return 0;
}


function scoreRating(rating) {
  if (rating >= 8.0) return 5;
  if (rating >= 7.5) return 4;
  if (rating >= 7.0) return 3;
  if (rating >= 6.5) return 2;
  if (rating >= 6.0) return 1;
  return 0;
}


function scoreAge(year) {
  if (!year) return 0;

  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  if (age <= 1) return 15;
  if (age === 2) return 13;
  if (age === 3) return 11;
  if (age === 4) return 9;
  if (age === 5) return 8;

  if (year >= 2010) return 6;

  return 3;
}


function calculateAnimeScore(anime) {
  return (
    scoreMembers(anime.mal_members) +
    scoreScoringUsers(anime.mal_scoring_users) +
    scoreRating(anime.mal_mean) +
    scoreAge(anime.year)
  );
}


function scoreYoutubeViews(views) {
  // null means we didn't find a reliable YouTube match.
  if (views === null || views === undefined) return null;

  if (views >= 100000000) return 50;
  if (views >= 50000000) return 45;
  if (views >= 20000000) return 40;
  if (views >= 10000000) return 35;
  if (views >= 5000000) return 30;
  if (views >= 2000000) return 25;
  if (views >= 1000000) return 20;
  if (views >= 500000) return 15;
  if (views >= 100000) return 10;
  if (views >= 25000) return 5;

  return 2;
}


module.exports = {
  scoreMembers,
  scoreScoringUsers,
  scoreRating,
  scoreAge,
  calculateAnimeScore,
  scoreYoutubeViews
};