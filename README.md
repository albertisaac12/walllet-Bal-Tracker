# Wallet Tracker

## Overview
This is a Slack bot built using [Slack Bolt](https://slack.dev/bolt-js/) and [Hardhat](https://hardhat.org/) that tracks Ethereum wallet balances and provides alerts when an admin wallet's balance falls below 10 POL. The bot also allows users to manage wallet addresses, channels, and ID-to-address mappings via Slack commands.

## Features
- Tracks multiple wallet addresses and alerts Slack channels when their balance is below 10 POL.
- Allows users to check the balance of an Ethereum wallet via Slack commands.
- Supports adding and deleting wallets, channels, and ID-to-address mappings dynamically.
- Listens for Slack messages and provides usage instructions when mentioned.

## Installation

### Prerequisites
- Node.js (>= v16)
- npm or yarn
- A Slack workspace and a bot token
- An Alchemy API key

### Setup
1. Clone the repository:
   ```sh
   git clone https://github.com/your-repo/slack-wallet-tracker.git
   cd slack-wallet-tracker
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Create a `.env` file in the root directory and add the following:
   ```env
   SLACK_SIGNING_SECRET=your_slack_signing_secret
   SLACK_BOT_TOKEN=your_slack_bot_token
   BALLANCE_FETCHER_API=your_alchemy_api_key
   PORT=3000
   ```
4. Create a `config.json` file inside the `App/` directory:
   ```json
   {
     "wallets": [],
     "channels": [],
     "idToAddress": {}
   }
   ```
5. Start the server:
   ```sh
   node index.js
   ```

## Slack Commands

| Command | Description |
|---------|-------------|
| `/balance <id or address>` | Check the balance of a wallet |
| `/update add idToAddress <ID> <Ethereum Address>` | Add an ID-to-address mapping |
| `/update delete idToAddress <ID>` | Remove an ID-to-address mapping |
| `/update add wallets <Ethereum Address>` | Add a wallet address to track |
| `/update delete wallets <Ethereum Address>` | Remove a tracked wallet |
| `/update add channels <Slack Channel Name>` | Add a Slack channel for alerts |
| `/update delete channels <Slack Channel Name>` | Remove a Slack channel |

## How It Works
- The bot listens for activities related to tracked wallets and fetches their balance.
- If the balance is below 10 POL, it sends an alert to configured Slack channels.
- Users can dynamically update the list of tracked wallets and alert channels.
- The bot also responds to messages containing "hello" if mentioned in Slack.

## Troubleshooting
- Ensure that the Slack bot token and signing secret are correctly set in `.env`.
- Check that the `config.json` file exists and has valid JSON syntax.
- Verify that the Alchemy API key is correct and has the necessary permissions.
- Please use App4.js

## License
This project is open-source and available under the MIT License.

