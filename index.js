'use strict';

require("dotenv").config();
const axios = require('axios');
const { Client } = require("twitter-api-sdk");
const { EmbedBuilder, WebhookClient } = require("discord.js");
const dayjs = require("dayjs");

// Function to create Discord embeds
const createEmbed = (tweetData, userData) => {
  const mediaFilter = /https:\/\/t.co/g
  // Destructure variables
  const { id, created_at } = tweetData;
  const text = tweetData.text.split(mediaFilter)[0].replace(/&amp;/g, '&');
  const { username, profile_image_url, profile_url, tweets_url } = userData;
  const [champ, changes] = text.split(':');
  const changelist = changes?.trim().replaceAll('*', '\u2022');

  // Create embed from tweet data
  const changesEmbed = new EmbedBuilder()
    .setColor('#c1d260')
    .setTitle(champ)
    .setURL(tweets_url + id)
    .setAuthor({
      name: username,
      url: profile_url,
      iconURL: profile_image_url
    })
    .setFooter({
      text: 'Tweeted at ' + dayjs(created_at).format('h:mm A'),
      iconURL: 'https://i0.wp.com/www.apacph.org/wp/wp-content/uploads/2014/03/Twitter-Logo-New-.png?fit=518%2C518&ssl=1'
    })
  if (champ && changes) return changesEmbed.setTitle(champ).setDescription(changelist);
  else return changesEmbed.setTitle(text.trim());
}

exports.handler = async (event) => {
  // Log start of function
  console.log('Checking for new tweets');

  // Tweet filters
  const contentMatch = /nerf(s)?|buff(s)?|change(s)?.*\n/i;
  const contentNotMatch = /skin(s)?|model(s)?|chroma(s)?/i;

  // Instantiate Twitter client
  const webhookClient = new WebhookClient({ url: process.env.DISCORD_WEBHOOK_URL })
  const client = new Client(process.env.TWITTER_BEARER_TOKEN);

  // Get last tweet id
  const apiUrl = 'https://77ljoihrc2.execute-api.us-east-1.amazonaws.com/Prod/';
  const res = await axios.get(apiUrl + process.env.STORAGE_ID);
  const lastTweet = res.data.content;

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
    "since_id": lastTweet,
    "max_results": 100,
    "tweet.fields": [
      "text",
      "created_at"
    ],
    "expansions": [
      "in_reply_to_user_id",
      "referenced_tweets.id"
    ],
    "exclude": [
      "retweets"
    ]
  });

  // Update last pulled tweet index for next query if new tweets
  if (!tweets.data) {
    console.log('No new tweets since last check');
    process.exit(0);
  }

  const config = { headers: { 'Content-Type': 'text/plain' } };
  await axios.post(apiUrl + process.env.STORAGE_ID, tweets.data[0].id, config);

  // Filter recent tweets for relevant content
  console.log('Checking new tweets for relevant content');
  const tweetsData = Array.from(tweets.data).reverse();
  const filteredTweets = tweetsData.filter(({ text, in_reply_to_user_id }) => {
    const contentMatched = (contentMatch.test(text) && !contentNotMatch.test(text));
    return (!in_reply_to_user_id || in_reply_to_user_id === process.env.TWITTER_USER_ID) && contentMatched;
  });

  // Send to Discord webhook
  for await (const tweet of filteredTweets) {
    try {
      await webhookClient.send({
        embeds: [createEmbed(tweet, userData)]
      })
    } catch (err) {
      console.error(err);
    }
  }

  console.log(filteredTweets.length ? 'Posted new balance change tweet(s)!' : 'No relevant new tweets to post');
}

