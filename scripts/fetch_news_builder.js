const fs = require('fs');

// Fetch latest English news from CryptoCompare
async function fetchCryptoNews() {
    try {
        const res = await fetch("https://min-api.cryptocompare.com/data/v2/news/?lang=EN");
        const data = await res.json();
        if (data.Response === "Error" || !Array.isArray(data.Data)) {
            throw new Error("API returned error: " + data.Message);
        }
        // Return top 4-5 news items with title and body for better context
        return data.Data.slice(0, 5).map(item => `${item.title} - ${item.body}`);
    } catch (e) {
        console.error("Failed to fetch news:", e.message);
        return [
            "News item 1 placeholder",
            "News item 2 placeholder",
            "News item 3 placeholder",
            "News item 4 placeholder"
        ];
    }
}

// Fetch Top 2 (BTC, ETH) and Top 3 Gainers
async function fetchMarketData() {
    try {
        const res = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=1000&page=1&sparkline=false");
        let allCoins = await res.json();

        if (!Array.isArray(allCoins)) {
            throw new Error("API returned non-array: " + JSON.stringify(allCoins));
        }

        // Top 2 Blue Chips
        const btc = allCoins.find(c => c.symbol.toLowerCase() === 'btc');
        const eth = allCoins.find(c => c.symbol.toLowerCase() === 'eth');

        // Filter stablecoins
        const nonStables = allCoins.filter(c => !["usdt", "usdc", "fdusd", "dai", "tusd", "wbtc", "steth"].includes(c.symbol.toLowerCase()));

        // Find top 3 gainers excluding BTC/ETH
        const gainers = nonStables
            .filter(c => c.symbol.toLowerCase() !== 'btc' && c.symbol.toLowerCase() !== 'eth')
            .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
            .slice(0, 3);

        return { btc, eth, gainers };
    } catch (e) {
        console.error("Failed to fetch market data:", e.message);
        return null;
    }
}

// Format English highlight string
function formatHighlightEN(coin) {
    const isUp = coin.price_change_percentage_24h >= 0;
    const arrow = isUp ? "↑" : "↓";
    const change = (isUp ? "+" : "") + coin.price_change_percentage_24h.toFixed(2) + "%";

    let priceStr;
    if (coin.current_price < 0.01) priceStr = "$" + coin.current_price.toFixed(6);
    else if (coin.current_price < 1) priceStr = "$" + coin.current_price.toFixed(4);
    else priceStr = "$" + coin.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const vol = (coin.total_volume / 1e9).toFixed(2) + "B";

    return `$${coin.symbol.toUpperCase()} | ${priceStr} | ${arrow} ${change} | Vol ~\$${vol} | [Please enter brief ${coin.name} news/insight here]`;
}

// Format Chinese highlight string
function formatHighlightCN(coin) {
    const isUp = coin.price_change_percentage_24h >= 0;
    const arrow = isUp ? "↑" : "↓";
    const change = (isUp ? "+" : "") + coin.price_change_percentage_24h.toFixed(2) + "%";

    let priceStr;
    if (coin.current_price < 0.01) priceStr = "$" + coin.current_price.toFixed(6);
    else if (coin.current_price < 1) priceStr = "$" + coin.current_price.toFixed(4);
    else priceStr = "$" + coin.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const vol = (coin.total_volume / 1e9).toFixed(2) + "B";

    return `$${coin.symbol.toUpperCase()} | ${priceStr} | ${arrow} ${change} | 成交量约 \$${vol} | [请在此输入 ${coin.name} 的简短点评或新闻]`;
}

async function main() {
    console.log("Fetching live news and market data...");

    const newsTitles = await fetchCryptoNews();
    const market = await fetchMarketData();

    if (!market) {
        console.log("Could not generate output due to market data failure.");
        return;
    }

    const enNewsStr = newsTitles.map(t => `        "${t.replace(/"/g, '\\"')}"`).join(',\n');
    const cnNewsStr = newsTitles.map(t => `        "[等待翻译] ${t.replace(/"/g, '\\"')}"`).join(',\n');

    const topCoins = [market.btc, market.eth, ...market.gainers];
    const tickers = topCoins.map(c => `"$${c.symbol.toUpperCase()}"`).join(', ');

    const enHighlightsStr = topCoins.map(c => `        "${formatHighlightEN(c)}"`).join(',\n');
    const cnHighlightsStr = topCoins.map(c => `        "${formatHighlightCN(c)}"`).join(',\n');

    const output = `
    // 5. News
    const enNews = [
${enNewsStr}
    ];
    const cnNews = [
${cnNewsStr}
    ];

    // 6. Highlights (Top 2 Blue Chips + Top 3 Gainers)
    const highlightTickers = [${tickers}];

    const enHighlights = [
${enHighlightsStr}
    ];

    const cnHighlights = [
${cnHighlightsStr}
    ];
`;

    fs.writeFileSync('news_block_output.js', output);
    console.log("\\n========================================================");
    console.log("✅ Successfully generated formatting!");
    console.log("File saved to: news_block_output.js");
    console.log("You can copy the contents of that file and paste it into the Figma plugin code.");
    console.log("========================================================\\n");
    console.log(output);
}

main();
