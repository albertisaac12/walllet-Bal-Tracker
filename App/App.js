require("dotenv").config();
const { App, ExpressReceiver } = require("@slack/bolt");
const express = require("express");
const { ethers } = require("hardhat");
const fs = require("fs");

// Create ExpressReceiver to handle requests
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Initialize Slack Bolt App using the ExpressReceiver
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
});

// Get Express app from receiver
const app = receiver.app;

// Middleware to parse JSON (already handled by ExpressReceiver, but just in case)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Handle Slack URL Verification
app.post("/slack/events", async (req, res) => {
  const { type } = req.body;
  if (type === "url_verification") {
    console.log("Received URL Verification Request");
    return res.status(200).json({ challenge: req.body.challenge });
  }
  res.status(400).send("Invalid request");
});

// Custom Endpoint
/*app.post("/slack/alchemy", async (req, res) => {
  console.log("Received request on /slack/alchemy:", req.body.event.activity);
  const val = req.body.event.activity[0].value;

  if (val > 1) {
    try {
      // Fetch all channels using the Slack Web API
      const response = await slackApp.client.conversations.list({
        types: "public_channel,private_channel", // Include both public and private channels
      });

      // Find the channel dynamically (e.g., channel name 'all-me')
      const channelNames = process.env.CHANNEL_NAME.split(","); // Split string into an array

      const channel = response.channels.find((channel) =>
        channelNames.includes(channel.name)
      );

      if (channel) {
        // Send message to the dynamically found channel
        await slackApp.client.chat.postMessage({
          channel: channel.id, // Use the channel ID dynamically
          text: `Alert: A value greater than 1 was detected! The value is: ${val}`,
        });
        console.log(`Message sent to ${channel.name} channel`);
      } else {
        console.log("Channel not found");
      }
    } catch (error) {
      console.error("Error fetching channels or sending message:", error);
    }
  }

  res.status(200).send("Request logged");
});
*/

//custom Endpoint2
app.post("/slack/alchemy", async (req, res) => {
  console.log("Received request on /slack/alchemy:", req.body);

  try {
    let totalValue = 0;
    const admin = process.env.ADMIN_WALLET;

    // Loop through all activities
    const activities = req.body.event.activity;
    console.log(activities);
    for (let activity of activities) {
      if (activity.asset === "MATIC" && activity.fromAddress === admin) {
        totalValue += activity.value; // Add value only if asset is "POL"
      }
    }

    // Fetch the wallet balance from the provider
    const provider = new ethers.JsonRpcProvider(
      process.env.BALLANCE_FETCHER_API
    );
    // console.log(activities);
    console.log("Admin wallet is : ", admin);
    const balance = await provider.getBalance(admin);

    // Convert balance to MATIC (assuming balance is returned in Wei or another format)
    const balanceInMatic = parseFloat(ethers.formatEther(balance));

    console.log(`Current balance: ${balanceInMatic} POL`);
    console.log(`Total value of activities: ${totalValue} POL`);

    // Check if the total value of activities plus current balance is less than 10
    if (balanceInMatic <= 10) {
      // Fetch all channels using the Slack Web API
      const response = await slackApp.client.conversations.list({
        types: "public_channel,private_channel", // Include both public and private channels
      });

      // Find the channel dynamically (e.g., channel name 'all-me')
      const channelNames = process.env.CHANNEL_NAME.split(","); // Split string into an array

      const channel = response.channels.find((channel) =>
        channelNames.includes(channel.name)
      );

      if (channel) {
        // Send message to the dynamically found channel
        await slackApp.client.chat.postMessage({
          channel: channel.id, // Use the channel ID dynamically
          text: `Alert: Wallet balance is below 10 POL! Current balance: ${balanceInMatic} MATIC`,
        });
        console.log(`Message sent to ${channel.name} channel`);
      } else {
        console.log("Channel not found");
      }
    }

    res.status(200).send("Request logged");
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Internal Server Error");
  }
});

/* Balance Fetcher */
// Handle /balance command
app.post("/slack/balance", async (req, res) => {
  console.log("Request Body:", req.body); // Log the full request body
  const { text, channel_id } = req.body; // `text` is the user input (address), `channel_id` is the Slack channel where the command was invoked

  if (!text) {
    console.log("No address provided!"); // Log if no address is found
    return res.status(200).json({
      response_type: "ephemeral",
      text: "Please provide an address to check the balance.",
    });
  }

  if (!ethers.isAddress(text)) {
    console.log("Invalid Ethereum address provided!");
    return res.status(200).json({
      response_type: "ephemeral",
      text: "The provided address is not a valid Ethereum address. Please provide a valid address.",
    });
  }
  try {
    console.log("Address provided:", text); // Log the address being used
    // Fetch balance for the provided address
    const provider = new ethers.JsonRpcProvider(
      process.env.BALLANCE_FETCHER_API
    );
    const balance = await provider.getBalance(text); // `text` contains the address
    const formattedBalance = ethers.formatEther(ethers.toBigInt(balance)); // Store as BigInt if needed

    /* // Send the balance to the channel
    await slackApp.client.chat.postMessage({
      channel: channel_id,
      text: `The balance for address ${text} is: ${ethers.formatEther(
        formattedBalance
      )}`,
    });
    */

    // Respond back to the Slack command to acknowledge the request
    return res.status(200).json({
      response_type: "ephemeral",
      text: `The balance for address ${text} is: ${formattedBalance}`,
    });
  } catch (error) {
    console.error("Error fetching balance:", error);

    await slackApp.client.chat.postMessage({
      channel: channel_id,
      text: "There was an error fetching the balance. Please check the address and try again.",
    });

    return res.status(200).json({
      response_type: "ephemeral",
      text: "Error fetching balance.",
    });
  }
});

// Handle Slack Messages
slackApp.message("hello", async ({ message, say }) => {
  await say(
    `Hey there, I am dappunk's official Admin Wallet tracker, Nice to Meet you. <@${message.user}>!`
  );
});

// balance fetcher and updater
const fetchBalance = async () => {
  const provider = new ethers.JsonRpcProvider(process.env.BALLANCE_FETCHER_API);
  const wallet = process.env.ADMIN_WALLET; // Set your wallet address here
  try {
    const balance = await provider.getBalance(wallet);
    const balanceInMatic = ethers.formatEther(balance); // Convert balance to POL

    // Store the balance in balance.json
    const balanceData = { balance: balanceInMatic };
    fs.writeFileSync("balance.json", JSON.stringify(balanceData, null, 2));
    console.log(`Balance fetched and saved: ${balanceInMatic} MATIC`);
  } catch (error) {
    console.error("Error fetching balance:", error);
  }
};

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await slackApp.start(); // Explicitly start the Bolt app
  console.log(`⚡️ Express Server with Slack Bolt is running on port ${PORT}`);
  await fetchBalance();
});
