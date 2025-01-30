require("dotenv").config();
const { App } = require("@slack/bolt");
const express = require("express");
// const { ethers } = require("ethers");

const app = express(); // Create Express app
app.use(express.json()); // Middleware to parse JSON

// Initialize Slack Bolt App
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Handle Slack URL Verification
app.post("/slack/events", async (req, res) => {
  const { type } = req.body;
  //   console.log(type);
  if (type === "url_verification") {
    const challenge = req.body;
    console.log("Received URL Verification Request");
    return res.status(200).json({ challenge });
  }

  // if (type === "ADDRESS_ACTIVITY") {
  //   console.log("Received an Address Activity");
  //   // check for the balance
  //   const value = req.value;
  //   const parsedValue = ethers.parseEther(value);
  // }
  res.status(400).send("Invalid request");
});

// ⚡️ Handle Slack Messages
slackApp.message("hello", async ({ message, say }) => {
  await say(`Hey there <@${message.user}>!`);
});

// Start Server
const PORT = process.env.PORT || 3000;
(async () => {
  await slackApp.start(PORT);
  console.log(`⚡️ Bolt app is running on port ${PORT}`);
})();
