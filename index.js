'use strict';

require("dotenv").config();
const { Client } = require("twitter-api-sdk");
const { EmbedBuilder, WebhookClient } = require("discord.js");

const contentMatch = /nerf(s)?|buff(s)?|change(s)?:?\n/gmi;
const contentNotMatch = /skin(s)?|model(s)?|chroma(s)?/gmi;
let lastTweetId;

exports.handler = async (event) => {
  // Instantiate Twitter client
  const webhookClient = new WebhookClient({ url: process.env.DISCORD_WEBHOOK_URL })
  const client = new Client(process.env.TWITTER_BEARER_TOKEN);

  // Get user data
  const userId = process.env.TWITTER_USER_ID;
  const user = await client.users.findUserById(userId, {
    "user.fields": [
      "profile_image_url",
      "username"
    ]
  });
  const userData = {
    ...user.data,
    profile_url: `https://twitter.com/${user.data.username}`,
    tweets_url: `https://twitter.com/${user.data.username}/status/`
  }

  // Get recent tweets
  const tweets = await client.tweets.usersIdTweets(userId, {
    "since_id": lastTweetId,
    "max_results": 100,
    "tweet.fields": [
      "text",
      "created_at"
    ],
    "expansions": [
      "in_reply_to_user_id",
      "referenced_tweets.id"
    ],
  });

  // Update last pulled tweet index for next query
  lastTweetId = tweets.data[0].id;

  // Filter recent tweets for relevant content
  const tweetsData = Array.from(tweets.data).reverse();
  const primaryFilter = tweetsData.filter(({ text, in_reply_to_user_id }) =>
    !in_reply_to_user_id && contentMatch.test(text) && !contentNotMatch.test(text))
  const secondaryFilter = tweetsData.filter(t => {
    const refs = t.referenced_tweets?.map(({ id }) => id);
    return primaryFilter.includes(t) || primaryFilter.find(({ id }) => refs?.includes(id));
  });

  // Function to create Discord embeds
  const createEmbed = (tweetData, userData) => {
    // Destructure variables
    const { text, id, created_at } = tweetData;
    const { username, profile_image_url, profile_url, tweets_url } = userData;
    const [champ, changes] = text.split(':');

    // Create embed from tweet data
    return new EmbedBuilder()
      .setColor('#c1d260')
      .setTitle(champ)
      .setURL(tweets_url + id)
      .setDescription(changes.trim().replaceAll('*', '\u2022'))
      .setAuthor({
        name: username,
        url: profile_url,
        iconURL: profile_image_url
      })
      .setFooter({
        text: 'Tweeted at ' + require("dayjs")(created_at).format('h:mm A'),
        iconURL: 'https://i0.wp.com/www.apacph.org/wp/wp-content/uploads/2014/03/Twitter-Logo-New-.png?fit=518%2C518&ssl=1'
      })
  }

  for await (const tweet of secondaryFilter) {
    try {
      await webhookClient.send({
        embeds: [createEmbed(tweet, userData)]
      })
    } catch (err) {
      console.error(err);
    }
  };
}

