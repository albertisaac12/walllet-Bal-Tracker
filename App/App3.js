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

/*app.post("/slack/alchemy", async (req, res) => {
  console.log(
    "Received request on /slack/alchemy:",
    req.body.event.activity[0]
  );

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
      console.log("here111");
      console.log("Here is the activity object :", activity);
      console.log(
        "answer to me : ",
        adminWallets.includes(activity.fromAddress)
      );
      if (adminWallets.includes(activity.fromAddress)) {
        console.log("here222");
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
*/

/*app.post("/slack/alchemy", async (req, res) => {
  console.log(
    "Received request on /slack/alchemy:",
    req.body.event.activity[0]
  );

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

    // Load or initialize the balance tracking data
    const balanceDataPath = "./App/balanceData.json";
    let balanceData = {};
    if (fs.existsSync(balanceDataPath)) {
      balanceData = JSON.parse(fs.readFileSync(balanceDataPath));
    } else {
      balanceData = { weeklyBalances: {}, monthlyBalances: {} };
    }

    // Loop through activities in the event and filter if `fromAddress` is in adminWallets
    for (let activity of req.body.event.activity) {
      console.log("here111");
      console.log("Here is the activity object :", activity);
      console.log(
        "answer to me : ",
        adminWallets.includes(activity.fromAddress)
      );

      if (adminWallets.includes(activity.fromAddress)) {
        const wallet = activity.fromAddress; // This is the wallet from the activity

        console.log(`Checking balance for wallet: ${wallet}`);

        try {
          // Fetch the balance for the wallet that triggered the activity
          const balance = await provider.getBalance(wallet);
          const balanceInMatic = parseFloat(ethers.formatEther(balance));

          console.log(`Wallet: ${wallet}, Balance: ${balanceInMatic} POL`);

          // Update weekly balance data
          const currentTime = new Date();
          const weekKey = `${currentTime.getFullYear()}-W${Math.ceil(
            (currentTime.getDate() - currentTime.getDay()) / 7
          )}`;
          const monthKey = `${currentTime.getFullYear()}-${
            currentTime.getMonth() + 1
          }`;

          if (!balanceData.weeklyBalances[wallet]) {
            balanceData.weeklyBalances[wallet] = { calls: 0, balances: [] };
          }
          if (!balanceData.monthlyBalances[wallet]) {
            balanceData.monthlyBalances[wallet] = { calls: 0, balances: [] };
          }

          // Increment the call count
          balanceData.weeklyBalances[wallet].calls += 1;
          balanceData.monthlyBalances[wallet].calls += 1;

          // Add the balance entry for the wallet (weekly and monthly)
          balanceData.weeklyBalances[wallet].balances.push({
            balance: balanceInMatic,
            timestamp: currentTime,
          });
          balanceData.monthlyBalances[wallet].balances.push({
            balance: balanceInMatic,
            timestamp: currentTime,
          });

          // Maintain only the last 7 days in weekly balance
          balanceData.weeklyBalances[wallet].balances =
            balanceData.weeklyBalances[wallet].balances.filter((entry) => {
              const entryDate = new Date(entry.timestamp);
              return currentTime - entryDate <= 7 * 24 * 60 * 60 * 1000; // Keep entries from the last 7 days
            });

          // Maintain only the last 30 days in monthly balance
          balanceData.monthlyBalances[wallet].balances =
            balanceData.monthlyBalances[wallet].balances.filter((entry) => {
              const entryDate = new Date(entry.timestamp);
              return currentTime - entryDate <= 30 * 24 * 60 * 60 * 1000; // Keep entries from the last 30 days
            });

          // Calculate the weekly average balance
          const weeklyBalances = balanceData.weeklyBalances[wallet].balances;
          const weeklyAverage =
            weeklyBalances.reduce((sum, entry) => sum + entry.balance, 0) /
            weeklyBalances.length;

          // Calculate the monthly average balance
          const monthlyBalances = balanceData.monthlyBalances[wallet].balances;
          const monthlyAverage =
            monthlyBalances.reduce((sum, entry) => sum + entry.balance, 0) /
            monthlyBalances.length;

          console.log(
            `Weekly average balance for wallet ${wallet}: ${weeklyAverage} POL`
          );
          console.log(
            `Monthly average balance for wallet ${wallet}: ${monthlyAverage} POL`
          );

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
                  text:
                    `⚠️ Alert: Wallet *${wallet}* balance is below 10 POL! Current balance: *${balanceInMatic} POL*\n` +
                    `Weekly Avg: *${weeklyAverage} POL*\n` +
                    `Monthly Avg: *${monthlyAverage} POL*\n` +
                    `Weekly calls: *${balanceData.weeklyBalances[wallet].calls}*`,
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

    // Save the updated balance data to the JSON file
    fs.writeFileSync(balanceDataPath, JSON.stringify(balanceData, null, 2));

    res.status(200).send("Request logged");
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Internal Server Error");
  }
});*/

/*app.post("/slack/alchemy", async (req, res) => {
  console.log(
    "Received request on /slack/alchemy:",
    req.body.event.activity[0]
  );
  // Function to read and parse JSON safely
  const readJsonFile = (filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        const rawData = fs.readFileSync(filePath, "utf-8");
        if (rawData.trim().length > 0) {
          return JSON.parse(rawData);
        } else {
          console.log(`${filePath} is empty. Initializing empty data.`);
          return {};
        }
      } else {
        console.log(`${filePath} does not exist. Initializing empty data.`);
        return {};
      }
    } catch (error) {
      console.error(`Error reading or parsing ${filePath}:`, error);
      return {};
    }
  };

  // Function to write data to a JSON file
  const writeJsonFile = (filePath, data) => {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Error writing to ${filePath}:`, error);
    }
  };
  try {
    const provider = new ethers.AlchemyProvider(
      80002,
      process.env.BALLANCE_FETCHER_API
    );

    const { activity } = req.body.event;

    // Read config.json for adminWallets
    const configDataPath = "./App/config.json";
    const configData = readJsonFile(configDataPath);
    const adminWallets = configData.wallets || [];
    // Loop through activities in the event and filter if `fromAddress` is in adminWallets
    for (let item of activity) {
      const fromAddress = item.fromAddress;

      if (adminWallets.includes(fromAddress)) {
        const wallet = fromAddress; // This is the wallet from the activity
        console.log(`Checking balance for wallet: ${wallet}`);

        try {
          // Fetch the balance for the wallet that triggered the activity
          const balance = await provider.getBalance(wallet);
          const balanceInMatic = parseFloat(ethers.formatEther(balance));

          console.log(`Wallet: ${wallet}, Balance: ${balanceInMatic} POL`);
          const balanceDataPath = "./App/balanceData.json";

          // Initialize balanceData object if the file doesn't exist or is empty
          let balanceData = readJsonFile(balanceDataPath);
          if (!balanceData.weeklyBalances) balanceData.weeklyBalances = {};
          if (!balanceData.monthlyBalances) balanceData.monthlyBalances = {};
          if (!balanceData.callCount) balanceData.callCount = 0; // Track the number of calls

          // Update weekly balance data
          const currentTime = new Date();
          const weekKey = `${currentTime.getFullYear()}-W${Math.ceil(
            (currentTime.getDate() - currentTime.getDay()) / 7
          )}`;
          const monthKey = `${currentTime.getFullYear()}-${
            currentTime.getMonth() + 1
          }`;

          // Initialize wallet if not already present in the data
          if (!balanceData.weeklyBalances[wallet]) {
            balanceData.weeklyBalances[wallet] = { calls: 0, balances: [] };
          }
          if (!balanceData.monthlyBalances[wallet]) {
            balanceData.monthlyBalances[wallet] = { calls: 0, balances: [] };
          }

          // Increment the call count for each wallet
          balanceData.weeklyBalances[wallet].calls += 1;
          balanceData.monthlyBalances[wallet].calls += 1;

          // Add the balance entry for the wallet (weekly and monthly)
          balanceData.weeklyBalances[wallet].balances.push({
            balance: balanceInMatic,
            timestamp: currentTime,
          });
          balanceData.monthlyBalances[wallet].balances.push({
            balance: balanceInMatic,
            timestamp: currentTime,
          });

          // Maintain only the last 7 days in weekly balance
          balanceData.weeklyBalances[wallet].balances =
            balanceData.weeklyBalances[wallet].balances.filter((entry) => {
              const entryDate = new Date(entry.timestamp);
              return currentTime - entryDate <= 7 * 24 * 60 * 60 * 1000; // Keep entries from the last 7 days
            });

          // Maintain only the last 30 days in monthly balance
          balanceData.monthlyBalances[wallet].balances =
            balanceData.monthlyBalances[wallet].balances.filter((entry) => {
              const entryDate = new Date(entry.timestamp);
              return currentTime - entryDate <= 30 * 24 * 60 * 60 * 1000; // Keep entries from the last 30 days
            });

          // Calculate the weekly average balance
          const weeklyBalances = balanceData.weeklyBalances[wallet].balances;
          const weeklyAverage =
            weeklyBalances.reduce((sum, entry) => sum + entry.balance, 0) /
            weeklyBalances.length;

          // Calculate the monthly average balance
          const monthlyBalances = balanceData.monthlyBalances[wallet].balances;
          const monthlyAverage =
            monthlyBalances.reduce((sum, entry) => sum + entry.balance, 0) /
            monthlyBalances.length;

          console.log(
            `Weekly average balance for wallet ${wallet}: ${weeklyAverage} POL`
          );
          console.log(
            `Monthly average balance for wallet ${wallet}: ${monthlyAverage} POL`
          );

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
                  text:
                    `⚠️ Alert: Wallet *${wallet}* balance is below 10 POL! Current balance: *${balanceInMatic} POL*\n` +
                    `Weekly Avg: *${weeklyAverage} POL*\n` +
                    `Monthly Avg: *${monthlyAverage} POL*\n` +
                    `Weekly calls: *${balanceData.weeklyBalances[wallet].calls}*`,
                });
                console.log(
                  `Message sent to ${channel.name} for wallet ${wallet}`
                );
              }
            } else {
              console.log("No matching Slack channels found.");
            }
          }

          // Update balanceData file with the new wallet's data
          writeJsonFile(balanceDataPath, balanceData);
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
*/

/*---------------------------------------------------------------------------------------------*/

/*app.post("/slack/alchemy", async (req, res) => {
  console.log(
    "Received request on /slack/alchemy:",
    req.body.event.activity[0]
  );

  // Function to read and parse JSON safely
  const readJsonFile = (filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        const rawData = fs.readFileSync(filePath, "utf-8");
        if (rawData.trim().length > 0) {
          return JSON.parse(rawData);
        } else {
          console.log(`${filePath} is empty. Initializing empty data.`);
          return {};
        }
      } else {
        console.log(`${filePath} does not exist. Initializing empty data.`);
        return {};
      }
    } catch (error) {
      console.error(`Error reading or parsing ${filePath}:`, error);
      return {};
    }
  };

  // Function to write data to a JSON file
  const writeJsonFile = (filePath, data) => {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Error writing to ${filePath}:`, error);
    }
  };

  try {
    const provider = new ethers.AlchemyProvider(
      80002,
      process.env.BALLANCE_FETCHER_API
    );

    const { activity } = req.body.event;

    // Read config.json for adminWallets
    const configDataPath = "./App/config.json";
    const configData = readJsonFile(configDataPath);
    const channelNames = configData.channels;
    const adminWallets = configData.wallets || [];

    // Set to track processed wallets to avoid duplicate alerts
    const processedWallets = new Set();

    // Loop through activities in the event and filter if `fromAddress` is in adminWallets
    for (let item of activity) {
      const fromAddress = item.fromAddress;

      if (adminWallets.includes(fromAddress)) {
        const wallet = fromAddress; // This is the wallet from the activity
        console.log(`Checking balance for wallet: ${wallet}`);

        try {
          // Fetch the balance for the wallet that triggered the activity
          const balance = await provider.getBalance(wallet);
          const balanceInMatic = parseFloat(ethers.formatEther(balance));

          console.log(`Wallet: ${wallet}, Balance: ${balanceInMatic} POL`);
          const balanceDataPath = "./App/balanceData.json";

          // Initialize balanceData object if the file doesn't exist or is empty
          let balanceData = readJsonFile(balanceDataPath);
          if (!balanceData.weeklyBalances) balanceData.weeklyBalances = {};
          if (!balanceData.monthlyBalances) balanceData.monthlyBalances = {};

          // Update weekly and monthly balance data
          const currentTime = new Date();
          const weekKey = `${currentTime.getFullYear()}-W${Math.ceil(
            (currentTime.getDate() - currentTime.getDay()) / 7
          )}`;
          const monthKey = `${currentTime.getFullYear()}-${
            currentTime.getMonth() + 1
          }`;

          // Initialize wallet if not already present in the data
          if (!balanceData.weeklyBalances[wallet]) {
            balanceData.weeklyBalances[wallet] = {
              totalBalanceSpent: 0,
              previousBalance: 0,
              calls: 0,
            };
          }
          if (!balanceData.monthlyBalances[wallet]) {
            balanceData.monthlyBalances[wallet] = {
              totalBalanceSpent: 0,
              previousBalance: 0,
              calls: 0,
            };
          }

          // Track the previous balance for calculation
          const oldWeeklyBalance =
            balanceData.weeklyBalances[wallet].previousBalance;
          const oldMonthlyBalance =
            balanceData.monthlyBalances[wallet].previousBalance;

          // Calculate how much balance was spent (difference between previous and current balance)
          const weeklyAmountSpent = oldWeeklyBalance - balanceInMatic;
          const monthlyAmountSpent = oldMonthlyBalance - balanceInMatic;

          // Update the call count for both weekly and monthly
          balanceData.weeklyBalances[wallet].calls += 1;
          balanceData.monthlyBalances[wallet].calls += 1;

          // Add the spent amount to the totals for weekly and monthly
          balanceData.weeklyBalances[wallet].totalBalanceSpent +=
            weeklyAmountSpent;
          balanceData.monthlyBalances[wallet].totalBalanceSpent +=
            monthlyAmountSpent;

          // Update the previous balance for future reference
          balanceData.weeklyBalances[wallet].previousBalance = balanceInMatic;
          balanceData.monthlyBalances[wallet].previousBalance = balanceInMatic;

          // Calculate the weekly and monthly average spent amount
          const weeklyAverage =
            balanceData.weeklyBalances[wallet].totalBalanceSpent /
            balanceData.weeklyBalances[wallet].calls;
          const monthlyAverage =
            balanceData.monthlyBalances[wallet].totalBalanceSpent /
            balanceData.monthlyBalances[wallet].calls;

          // Add avgBalance to weekly and monthly balances
          balanceData.weeklyBalances[wallet].avgBalance = weeklyAverage;
          balanceData.monthlyBalances[wallet].avgBalance = monthlyAverage;

          console.log(
            `Weekly average spent for wallet ${wallet}: ${weeklyAverage} POL`
          );
          console.log(
            `Monthly average spent for wallet ${wallet}: ${monthlyAverage} POL`
          );

          // If balance is less than or equal to 10 POL and wallet has not been processed, send alert
          if (balanceInMatic <= 10 && !processedWallets.has(wallet)) {
            // Mark wallet as processed to avoid duplicate alerts
            processedWallets.add(wallet);

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
                  text:
                    `⚠️ Alert: Wallet *${wallet}* balance is below 10 POL! Current balance: *${balanceInMatic} POL*\n` +
                    `Weekly Avg Spent: *${weeklyAverage} POL*\n` +
                    `Monthly Avg Spent: *${monthlyAverage} POL*\n` +
                    `Weekly calls: *${balanceData.weeklyBalances[wallet].calls}*\n` +
                    `Monthly calls: *${balanceData.monthlyBalances[wallet].calls}*`,
                });
                console.log(
                  `Message sent to ${channel.name} for wallet ${wallet}`
                );
              }
            } else {
              console.log("No matching Slack channels found.");
            }
          }

          // Update balanceData file with the new wallet's data
          writeJsonFile(balanceDataPath, balanceData);
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
*/

// Utility function to read and parse JSON safely
const readJsonFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const rawData = fs.readFileSync(filePath, "utf-8");
      return rawData.trim().length > 0 ? JSON.parse(rawData) : {};
    }
    return {};
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return {};
  }
};

// Utility function to write JSON data to a file
const writeJsonFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
  }
};

app.post("/slack/alchemy", async (req, res) => {
  try {
    const provider = new ethers.AlchemyProvider(
      80002,
      process.env.BALLANCE_FETCHER_API
    );

    const { activity } = req.body.event;
    console.log("Processing activity: ", activity);

    // Read config.json for adminWallets and channels
    const configDataPath = "./App/config.json";
    const configData = readJsonFile(configDataPath);
    const channelNames = configData.channels || [];
    const adminWallets = new Set(configData.wallets || []);

    // Fetch Slack channels once per request
    const response = await slackApp.client.conversations.list({
      types: "public_channel,private_channel",
    });

    // Filter Slack channels based on config file
    const matchedChannels = response.channels.filter((channel) =>
      channelNames.includes(channel.name)
    );

    if (matchedChannels.length === 0) {
      console.log("No matching Slack channels found.");
    }

    // **Track processed wallets & sent alerts per request**
    const processedWallets = new Set();
    const sentChannelIds = new Set();

    for (let item of activity) {
      const fromAddress = item.fromAddress.toLowerCase();
      const toAddress = item.toAddress?.toLowerCase() || "";

      // **Ignore if BOTH fromAddress & toAddress are admin wallets (internal transfers)**
      if (adminWallets.has(fromAddress) && adminWallets.has(toAddress)) {
        // console.log(
        //   `Skipping internal transfer from ${fromAddress} to ${toAddress}`
        // );
        const balance = await provider.getBalance(fromAddress);
        const balanceInMatic = parseFloat(ethers.formatEther(balance));
        if (balanceInMatic <= 10) {
          await slackApp.client.chat.postMessage({
            channel: channel.id,
            text: `⚠️ Alert: Wallet *${fromAddress}* balance is below 10 POL! Current balance: *${balanceInMatic} POL*\n`,
          });
        }
        continue;
      }

      // **Proceed only if the sender is an admin wallet**
      if (!adminWallets.has(fromAddress)) continue;

      console.log(`Checking balance for wallet: ${fromAddress}`);

      try {
        const balance = await provider.getBalance(fromAddress);
        const balanceInMatic = parseFloat(ethers.formatEther(balance));

        console.log(`Wallet: ${fromAddress}, Balance: ${balanceInMatic} POL`);
        const balanceDataPath = "./App/balanceData.json";

        let balanceData = readJsonFile(balanceDataPath);
        balanceData.weeklyBalances = balanceData.weeklyBalances || {};
        balanceData.monthlyBalances = balanceData.monthlyBalances || {};

        const currentTime = new Date();
        const weekKey = `${currentTime.getFullYear()}-W${Math.ceil(
          (currentTime.getDate() - currentTime.getDay()) / 7
        )}`;
        const monthKey = `${currentTime.getFullYear()}-${
          currentTime.getMonth() + 1
        }`;

        // Initialize wallet balances if missing
        balanceData.weeklyBalances[fromAddress] = balanceData.weeklyBalances[
          fromAddress
        ] || {
          totalBalanceSpent: 0,
          previousBalance: balanceInMatic,
          calls: 0,
        };

        balanceData.monthlyBalances[fromAddress] = balanceData.monthlyBalances[
          fromAddress
        ] || {
          totalBalanceSpent: 0,
          previousBalance: balanceInMatic,
          calls: 0,
        };

        // **Calculate spent balance**
        const oldWeeklyBalance =
          balanceData.weeklyBalances[fromAddress].previousBalance;
        const oldMonthlyBalance =
          balanceData.monthlyBalances[fromAddress].previousBalance;

        const weeklyAmountSpent = oldWeeklyBalance - balanceInMatic;
        const monthlyAmountSpent = oldMonthlyBalance - balanceInMatic;

        balanceData.weeklyBalances[fromAddress].calls += 1;
        balanceData.monthlyBalances[fromAddress].calls += 1;

        balanceData.weeklyBalances[fromAddress].totalBalanceSpent +=
          weeklyAmountSpent;
        balanceData.monthlyBalances[fromAddress].totalBalanceSpent +=
          monthlyAmountSpent;

        balanceData.weeklyBalances[fromAddress].previousBalance =
          balanceInMatic;
        balanceData.monthlyBalances[fromAddress].previousBalance =
          balanceInMatic;

        // **Calculate averages**
        const weeklyAverage =
          balanceData.weeklyBalances[fromAddress].totalBalanceSpent /
          balanceData.weeklyBalances[fromAddress].calls;
        const monthlyAverage =
          balanceData.monthlyBalances[fromAddress].totalBalanceSpent /
          balanceData.monthlyBalances[fromAddress].calls;

        balanceData.weeklyBalances[fromAddress].avgBalance = weeklyAverage;
        balanceData.monthlyBalances[fromAddress].avgBalance = monthlyAverage;

        console.log(
          `Weekly Avg Spent for ${fromAddress}: ${weeklyAverage} POL`
        );
        console.log(
          `Monthly Avg Spent for ${fromAddress}: ${monthlyAverage} POL`
        );

        // **Send alert if balance is below 10 POL**
        if (balanceInMatic <= 10 && !processedWallets.has(fromAddress)) {
          processedWallets.add(fromAddress);

          for (let channel of matchedChannels) {
            if (!sentChannelIds.has(channel.id)) {
              console.log(`Sending alert to: ${channel.name} (${channel.id})`);

              await slackApp.client.chat.postMessage({
                channel: channel.id,
                text:
                  `⚠️ Alert: Wallet *${fromAddress}* balance is below 10 POL! Current balance: *${balanceInMatic} POL*\n` +
                  `Weekly Avg Spent: *${weeklyAverage} POL*\n` +
                  `Monthly Avg Spent: *${monthlyAverage} POL*\n` +
                  `Weekly calls: *${balanceData.weeklyBalances[fromAddress].calls}*\n` +
                  `Monthly calls: *${balanceData.monthlyBalances[fromAddress].calls}*`,
              });

              sentChannelIds.add(channel.id);
            } else {
              console.log(`Skipping duplicate alert for ${channel.name}`);
            }
          }
        }

        // **Update balance data file**
        writeJsonFile(balanceDataPath, balanceData);
      } catch (walletError) {
        console.error(
          `Error fetching balance for wallet ${fromAddress}:`,
          walletError
        );
      }
    }

    res.status(200).send("Request logged");
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Internal Server Error");
  }
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

const initializeWalletBalances = async () => {
  console.log("Initializing wallet balances...");
  const configDataPath = "./App/config.json";
  const balanceDataPath = "./App/balanceData.json";
  const configData = readJsonFile(configDataPath);
  const adminWallets = configData.wallets || [];

  if (adminWallets.length === 0) {
    console.log("No wallets found in config.json.");
    return;
  }

  let balanceData = readJsonFile(balanceDataPath);
  balanceData.weeklyBalances = balanceData.weeklyBalances || {};
  balanceData.monthlyBalances = balanceData.monthlyBalances || {};
  const provider = new ethers.AlchemyProvider(
    80002,
    process.env.BALLANCE_FETCHER_API
  );
  for (const wallet of adminWallets) {
    try {
      const balance = await provider.getBalance(wallet);
      const balanceInMatic = parseFloat(ethers.formatEther(balance));

      console.log(`Wallet: ${wallet}, Balance: ${balanceInMatic} POL`);

      balanceData.weeklyBalances[wallet] = {
        previousBalance: balanceInMatic,
        totalBalanceSpent: 0,
        calls: 0,
        avgBalance: 0,
      };

      balanceData.monthlyBalances[wallet] = {
        previousBalance: balanceInMatic,
        totalBalanceSpent: 0,
        calls: 0,
        avgBalance: 0,
      };
    } catch (error) {
      console.error(`Error fetching balance for ${wallet}:`, error);
    }
  }

  writeJsonFile(balanceDataPath, balanceData);
  console.log("Wallet balances initialized.");
};

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await slackApp.start(); // Explicitly start the Bolt app
  initializeWalletBalances();
  console.log(`⚡️ Express Server with Slack Bolt is running on port ${PORT}`);
});
