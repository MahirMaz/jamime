require("dotenv").config();

async function testMal() {
  const response = await fetch(
    "https://api.myanimelist.net/v2/anime/ranking?ranking_type=all&limit=5&fields=alternative_titles,start_date,num_list_users,popularity",
    {
      headers: {
        "X-MAL-CLIENT-ID": process.env.MAL_CLIENT_ID
      }
    }
  );

  console.log("Status:", response.status);

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

testMal();