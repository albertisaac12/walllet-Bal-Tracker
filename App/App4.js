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

// Handle Slack URL Verification One Time
app.post("/slack/events", async (req, res) => {
  const { type } = req.body;
  if (type === "url_verification") {
    console.log("Received URL Verification Request");
    return res.status(200).json({ challenge: req.body.challenge });
  }
  res.status(400).send("Invalid request");
});

app.post("/slack/balance", async (req, res) => {
  console.log("Request Body:", req.body);

  const { text, channel_id } = req.body; // `text` is the argument passed to the command

  if (!text) {
    console.log("No address or ID provided!");
    return res.status(200).json({
      response_type: "ephemeral",
      text: "❌ Please provide an Ethereum address or ID to check the balance.",
    });
  }

  let address = text.trim(); // Remove spaces

  // If input is not an Ethereum address, assume it's an ID and fetch the address
  if (!ethers.isAddress(address)) {
    console.log(`Fetching address for ID: ${address}`);
    const configData = JSON.parse(fs.readFileSync("./App/config.json"));
    console.log("This is the config data : ", configData);
    const idToAddressMapping = configData.idToAddress || {}; // ID to Address mapping
    const getAddressFromId = (id) => {
      return idToAddressMapping[id] || null;
    };
    address = getAddressFromId(address);

    if (!address) {
      return res.status(200).json({
        response_type: "ephemeral",
        text: `❌ No address found for ID *"${text}"*. Please provide a valid Ethereum address or ID.`,
      });
    }
  }

  try {
    console.log("Fetching balance for:", address);
    const provider = new ethers.AlchemyProvider(
      80002,
      process.env.BALLANCE_FETCHER_API
    );
    const balance = await provider.getBalance(address);
    const formattedBalance = ethers.formatEther(balance); // Convert from Wei to POL

    // Respond back to Slack
    return res.status(200).json({
      response_type: "ephemeral",
      text: `✅ The balance for address *${address}* is *${formattedBalance} POL*`,
    });
  } catch (error) {
    console.error("Error fetching balance:", error);

    return res.status(200).json({
      response_type: "ephemeral",
      text: "❌ Error fetching balance. Please try again later.",
    });
  }
});

// Update or delete config data
app.post("/slack/update", async (req, res) => {
  const { text, channel_id } = req.body;
  // console.log("This is the text : ", text);
  if (!text) {
    // console.log("here1");
    return res.status(200).json({
      response_type: "ephemeral",
      text: "❌ Invalid command! Usage: `/update <keyword> <params>`",
    });
  }

  const [action, keyword, param1, param2] = text.split(" ");

  // Ensure valid action
  if (!["delete", "add"].includes(action)) {
    return res.status(200).json({
      response_type: "ephemeral",
      text: "❌ Invalid command! Usage: `/update <action> <keyword> <params>` where action can be 'add' or 'delete'",
    });
  }

  if (!keyword || !param1) {
    return res.status(200).json({
      response_type: "ephemeral",
      text: "❌ Missing required parameters. Usage: `/update <action> <keyword> <param>`",
    });
  }

  // Load the current config
  let configData;
  try {
    configData = JSON.parse(fs.readFileSync("./App/config.json"));
  } catch (error) {
    console.error("Error reading config file:", error);
    return res.status(500).json({
      response_type: "ephemeral",
      text: "❌ There was an error reading the config file.",
    });
  }

  // Handle 'add' action
  if (action === "add") {
    if (keyword === "idToAddress") {
      if (configData.idToAddress[param1]) {
        return res.status(200).json({
          response_type: "ephemeral",
          text: `❌ The ID *${param1}* already exists in the config.`,
        });
      }
      if (!ethers.isAddress(param2)) {
        return res.status(200).json({
          response_type: "ephemeral",
          text: `❌ The ID *${param2}* is not a valid Ethereum Address`,
        });
      }
      configData.idToAddress[param1] = param2;
      fs.writeFileSync(
        "./App/config.json",
        JSON.stringify(configData, null, 2)
      );
      return res.status(200).json({
        response_type: "ephemeral",
        text: `✅ Successfully added ID *${param1}* with address *${param2}* to the config.`,
      });
    }

    if (keyword === "wallets") {
      if (configData.wallets.includes(param1)) {
        return res.status(200).json({
          response_type: "ephemeral",
          text: `❌ The wallet *${param1}* already exists in the config.`,
        });
      }
      if (!ethers.isAddress(param1)) {
        return res.status(200).json({
          response_type: "ephemeral",
          text: `❌ The Address *${param1}* is a invalid Ethereum Address`,
        });
      }
      configData.wallets.push(param1);
      fs.writeFileSync(
        "./App/config.json",
        JSON.stringify(configData, null, 2)
      );
      return res.status(200).json({
        response_type: "ephemeral",
        text: `✅ Successfully added wallet *${param1}* to the config.`,
      });
    }

    if (keyword === "channels") {
      if (configData.channels.includes(param1)) {
        return res.status(200).json({
          response_type: "ephemeral",
          text: `❌ The channel *${param1}* already exists in the config.`,
        });
      }
      configData.channels.push(param1);
      fs.writeFileSync(
        "./App/config.json",
        JSON.stringify(configData, null, 2)
      );
      return res.status(200).json({
        response_type: "ephemeral",
        text: `✅ Successfully added channel *${param1}* to the config.`,
      });
    }

    return res.status(200).json({
      response_type: "ephemeral",
      text: "❌ Invalid keyword! Valid keywords are: `idToAddress`, `wallets`, or `channels`.",
    });
  }

  // Handle 'delete' action
  if (action === "delete") {
    if (keyword === "idToAddress") {
      const id = param1;
      if (!configData.idToAddress[id]) {
        return res.status(200).json({
          response_type: "ephemeral",
          text: `❌ The ID *${id}* does not exist in the config. No changes made.`,
        });
      }
      delete configData.idToAddress[id];
      fs.writeFileSync(
        "./App/config.json",
        JSON.stringify(configData, null, 2)
      );
      return res.status(200).json({
        response_type: "ephemeral",
        text: `✅ Successfully deleted ID *${id}* from the config.`,
      });
    }

    if (keyword === "wallets") {
      const walletAddress = param1;
      if (!ethers.isAddress(param1)) {
        return res.status(200).json({
          response_type: "ephemeral",
          text: `❌ The wallet *${walletAddress}* is Not is a Valid Ethereum Address.`,
        });
      }
      const walletIndex = configData.wallets.indexOf(walletAddress);
      if (walletIndex === -1) {
        return res.status(200).json({
          response_type: "ephemeral",
          text: `❌ The wallet *${walletAddress}* does not exist in the config. No changes made.`,
        });
      }
      configData.wallets.splice(walletIndex, 1);
      fs.writeFileSync(
        "./App/config.json",
        JSON.stringify(configData, null, 2)
      );
      return res.status(200).json({
        response_type: "ephemeral",
        text: `✅ Successfully deleted wallet *${walletAddress}* from the config.`,
      });
    }

    if (keyword === "channels") {
      const channel = param1;
      const channelIndex = configData.channels.indexOf(channel);
      if (channelIndex === -1) {
        return res.status(200).json({
          response_type: "ephemeral",
          text: `❌ The channel *${channel}* does not exist in the config. No changes made.`,
        });
      }
      configData.channels.splice(channelIndex, 1);
      fs.writeFileSync(
        "./App/config.json",
        JSON.stringify(configData, null, 2)
      );
      return res.status(200).json({
        response_type: "ephemeral",
        text: `✅ Successfully deleted channel *${channel}* from the config.`,
      });
    }

    return res.status(200).json({
      response_type: "ephemeral",
      text: "❌ Invalid keyword! Valid keywords are: `idToAddress`, `wallets`, or `channels`.",
    });
  }

  // If action is invalid
  return res.status(200).json({
    response_type: "ephemeral",
    text: "❌ Invalid action! Valid actions are: `add`, `delete`.",
  });
});

app.post("/slack/alchemy", async (req, res) => {
  try {
    const provider = new ethers.AlchemyProvider(
      80002,
      process.env.BALLANCE_FETCHER_API
    );

    // Load wallets and channels from the config file
    const configData = JSON.parse(fs.readFileSync("./App/config.json"));
    const adminWallets = configData.wallets;
    const channelNames = configData.channels;

    console.log("Tracking wallets:", adminWallets);
    console.log("Posting alerts in channels:", channelNames);

    // Loop through activities in the event and filter if `fromAddress` is in adminWallets
    for (let activity of req.body.event.activity) {
      if (adminWallets.includes(activity.fromAddress)) {
        const wallet = activity.fromAddress; // This is the wallet from the activity

        console.log(`Checking balance for wallet: ${wallet}`);

        try {
          // Fetch the balance for the wallet that triggered the activity
          const balance = await provider.getBalance(wallet);
          const balanceInMatic = parseFloat(ethers.formatEther(balance));

          console.log(`Wallet: ${wallet}, Balance: ${balanceInMatic} POL`);

          // If balance is less than or equal to 10 POL, send alert to the relevant channels
          if (balanceInMatic <= 10) {
            // Fetch all Slack channels
            const response = await slackApp.client.conversations.list({
              types: "public_channel,private_channel",
            });

            // Filter channels based on names in config
            const matchedChannels = response.channels.filter((channel) =>
              channelNames.includes(channel.name)
            );

            if (matchedChannels.length > 0) {
              for (let channel of matchedChannels) {
                await slackApp.client.chat.postMessage({
                  channel: channel.id,
                  text: `⚠️ Alert: Wallet *${wallet}* balance is below 10 POL! Current balance: *${balanceInMatic} POL*`,
                });
                console.log(
                  `Message sent to ${channel.name} for wallet ${wallet}`
                );
              }
            } else {
              console.log("No matching Slack channels found.");
            }
          }
        } catch (walletError) {
          console.error(
            `Error fetching balance for wallet ${wallet}:`,
            walletError
          );
        }
      }
    }

    res.status(200).send("Request logged");
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Internal Server Error");
  }
});

slackApp.message(async ({ message, say, context }) => {
  const botUserId = context.botUserId; // Get the bot's user ID

  // Check if the message contains both "hello" and a mention of the bot
  if (
    message.text.toLowerCase().includes("hello") &&
    message.text.includes(`<@${botUserId}>`)
  ) {
    await say(
      `Hey there, I am dappunk's official Admin Wallet tracker. Nice to meet you, <@${message.user}>!`
    );

    // List the usage commands
    await say(
      `Here's how I can assist you:\n\n*Usage Commands:*\n` +
        "`/update add <keyword> <param>` - Add a wallet, ID, or channel to the config\n" +
        "`/update delete <keyword> <param>` - Delete a wallet, ID, or channel from the config\n" +
        "`/balance <id or address>` - Check the balance of a given Ethereum address\n" +
        "`NOTE: NEVER COPY THE WALLET ADDRESS DIRECTLY FROM METAMASK USE ANY OTHER EXPLORER`\n" +
        "Let me know what I can do for you! 😎"
    );
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await slackApp.start(); // Explicitly start the Bolt app
  console.log(`⚡️ Express Server with Slack Bolt is running on port ${PORT}`);
});
