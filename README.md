# Daily Market Updater for Figma

This AI Agent Skill automates the process of fetching daily cryptocurrency market data, researching top gainers, translating news, and generating a ready-to-use Figma Plugin script (`code.js`) to instantly update your daily market posters.

## Installation

1. Clone this repository into your AI Agent's skills directory (e.g., `~/.gemini/config/skills/daily-market-updater-figma-skill`).
2. Your AI assistant will now recognize the `@daily_market_updater_figma` command.

## Setup & Configuration

This tool requires API keys to fetch live news and market data.
1. Create a `.env` file in the root of this folder (or wherever your environment variables are managed).
2. Ensure you have your CryptoCompare and CoinGecko API keys available for the script inside `scripts/fetch_news_builder.js`.

## Usage

1. In your AI chat interface, simply mention `@daily_market_updater_figma`.
2. The AI will:
   - Run the data-fetching script.
   - Perform web research on today's top gainers.
   - Write professional market insights (English and Chinese).
   - Inject the data into the Figma plugin template.
   - Output a final `code.js` file in the `dist/` folder.
3. In Figma, go to **Plugins -> Development -> Import plugin from manifest...** and select the `manifest.json` from this repository.
4. Run the plugin in your Figma design file, and watch your poster update automatically!

## Requirements
- Node.js installed locally.
- A compatible AI Assistant (Antigravity / Gemini) capable of running terminal commands, searching the web, and manipulating file contents.
