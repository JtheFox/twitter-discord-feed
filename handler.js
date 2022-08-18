require("dotenv").config();
const { Client } = require("twitter-api-sdk");
const contentMatch = /nerf(s)?|buff(s)?|change(s)?/gmi;
const contentNotMatch = /skin(s)?|model(s)?|chroma(s)?/gmi;
const user1 = "3855898996"

exports.handler = async (event) => {
  const client = new Client(process.env.TWITTER_BEARER_TOKEN);
  const response = await client.tweets.usersIdTweets(user1, {
    "since_id": undefined,
    "max_results": 100,
    "tweet.fields": [
      "text"
    ],
    "expansions": [
      "in_reply_to_user_id",
      "referenced_tweets.id"
    ],
  });

  const { data } = response;
  const primaryFilter = data.filter(({ text, in_reply_to_user_id }) =>
    !in_reply_to_user_id && contentMatch.test(text) && !contentNotMatch.test(text))
  const secondaryFilter = data.filter(t => {
    const refs = t.referenced_tweets?.map(({ id }) => id);
    return primaryFilter.includes(t) || primaryFilter.find(({ id }) => refs?.includes(id));
  });

  console.log("response", JSON.stringify(secondaryFilter, null, 2));
}