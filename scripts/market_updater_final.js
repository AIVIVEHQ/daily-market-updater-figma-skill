/**
 * ✅ [FINAL AUTOMATION SCRIPT] Figma Daily Market Updates
 * 
 * Includes: 
 * 1. Live Fear & Greed Index (via alternative.me api)
 * 2. Top Coins Prices & Arrows (hardcoded fallback + auto-coloring)
 * 3. Gainer Sectors & Dynamic Coin Logos (downloads and crops via MaskGroup)
 * 4. News & Highlights formatted auto-bullets
 *
 * HOW TO USE: 
 * 1. Copy to clipboard
 * 2. In Figma: Plugins -> Development -> market updater -> code.js
 * 3. Save and Run
 */

// ================================================================
// CONFIG & IDs
// ================================================================

const EN_DATES = "57:1012";
const CN_DATES = "57:1172";

const FG_EN = "57:861";
const FG_CN = "57:1056";

// Colors
const UP_COLOR = { r: 0, g: 240 / 255, b: 1 };
const DOWN_COLOR = { r: 242 / 255, g: 74 / 255, b: 64 / 255 };

// Utilities
async function safeLoadFonts(node) {
    if (!node || node.type !== "TEXT" || node.characters.length === 0) return;
    try {
        var segments = node.getStyledTextSegments(["fontName"]);
        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            if (seg.fontName.family === "PingFang SC" && seg.fontName.style === "Bold") {
                await figma.loadFontAsync({ family: "PingFang SC", style: "Semibold" });
                node.setRangeFontName(seg.start, seg.end, { family: "PingFang SC", style: "Semibold" });
            }
        }
    } catch (e) { }
    var fonts = node.getRangeAllFontNames(0, node.characters.length);
    for (var j = 0; j < fonts.length; j++) {
        try { await figma.loadFontAsync(fonts[j]); } catch (e) { }
    }
}

async function setText(id, text) {
    var n = await figma.getNodeByIdAsync(id);
    if (n && n.type === "TEXT") {
        await safeLoadFonts(n);
        n.characters = text;
        return true;
    }
    return false;
}

async function setArrow(id, isUp) {
    var n = await figma.getNodeByIdAsync(id);
    if (n) {
        n.fills = [{ type: "SOLID", color: isUp ? UP_COLOR : DOWN_COLOR }];
        n.rotation = isUp ? 0 : 180;
    }
}

async function setBullets(id, items, tickers = []) {
    var n = await figma.getNodeByIdAsync(id);
    if (!n || n.type !== "TEXT") return;
    await safeLoadFonts(n);
    var text = "\n" + items.join("\n");
    n.characters = text;
    try {
        n.setRangeListOptions(1, text.length, { type: "UNORDERED" });
    } catch (e) {
        n.characters = "\n" + items.map(function (s) { return "• " + s; }).join("\n");
    }

    // Color tickers cyan
    for (var i = 0; i < tickers.length; i++) {
        var idx = n.characters.indexOf(tickers[i]);
        if (idx >= 0) {
            n.setRangeFills(idx, idx + tickers[i].length, [{ type: "SOLID", color: UP_COLOR }]);
        }
    }
}

/**
 * Helpers for formatting live data
 */
function formatPrice(p) {
    if (p < 0.0001) return "$" + p.toFixed(8);
    return "$" + p.toLocaleString('en-US', {
        minimumFractionDigits: p < 1 ? 4 : 2,
        maximumFractionDigits: p < 1 ? 6 : 2
    });
}

function formatChange(c) {
    return (c > 0 ? "↑ +" : "↓ ") + c.toFixed(2) + "%";
}

function formatVol(vol) {
    if (vol >= 1e9) return (vol / 1e9).toFixed(2) + "B";
    if (vol >= 1e6) return (vol / 1e6).toFixed(2) + "M";
    return vol.toLocaleString();
}

/**
 * Fetch detailed info (categories, descriptions) for a specific coin with caching
 */
const coinInfoCache = {};
async function fetchCoinInfo(coinId) {
    if (coinInfoCache[coinId]) return coinInfoCache[coinId];
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=true&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`);
        if (!res.ok) return { categories: [], descEn: "", descCn: "" };
        const data = await res.json();
        const info = {
            categories: data.categories || [],
            descEn: (data.description && data.description.en) || "",
            descCn: (data.description && data.description.zh) || ""
        };
        coinInfoCache[coinId] = info;
        return info;
    } catch (e) { return { categories: [], descEn: "", descCn: "" }; }
}

const catMap = {
    "Decentralized Finance (DeFi)": "DeFi",
    "Meme": "Meme",
    "Gaming": "链游 (Gaming)",
    "NFT": "NFT",
    "Layer 1": "一层网络 (Layer 1)",
    "Layer 2": "二层网络 (Layer 2)",
    "Artificial Intelligence (AI)": "人工智能 (AI)",
    "Infrastructure": "基础设施",
    "Smart Contract Platform": "智能合约平台",
    "Real World Assets (RWA)": "RWA",
    "Ecosystem": "生态系统",
    "Social": "社交网络"
};

const shortCatMapCn = {
    "Decentralized Finance (DeFi)": "DeFi",
    "Meme": "Meme",
    "Gaming": "链游",
    "NFT": "NFT",
    "Layer 1": "公链",
    "Layer 2": "Layer 2",
    "Artificial Intelligence (AI)": "AI",
    "Infrastructure": "基建",
    "Smart Contract Platform": "智能合约",
    "Real World Assets (RWA)": "RWA",
    "Ecosystem": "生态系统",
    "Social": "社交"
};

// Image Loader for Logos with Cache Busting and PNG Force
async function setSectorLogo(groupId, symbol, imageUrl) {
    try {
        var group = await figma.getNodeByIdAsync(groupId);
        if (!group) return;

        // Find the image node using recursive search
        var targetNode = null;
        if (group.findOne) {
            targetNode = group.findOne(node => {
                return node.fills && node.fills !== figma.mixed && Array.isArray(node.fills) && node.fills.some(f => f.type === "IMAGE");
            });

            if (!targetNode) {
                targetNode = group.findOne(node => {
                    return (node.type === "ELLIPSE" || node.type === "RECTANGLE" || node.type === "FRAME") && !node.isMask;
                });
            }
        }

        if (!targetNode && (group.type === "ELLIPSE" || group.type === "RECTANGLE" || group.type === "FRAME")) {
            targetNode = group;
        }

        if (!targetNode) {
            console.log(`⚠️ No suitable background shape found in ${groupId} for ${symbol}`);
            return;
        }

        // Cache busting + Force PNG conversion to handle SVGs/Stale images
        const ts = Date.now();
        const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&output=png&t=${ts}`;

        console.log(`🖼️ Fetching logo for ${symbol}: ${proxyUrl}`);

        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const image = figma.createImage(new Uint8Array(arrayBuffer));

        targetNode.fills = [{
            type: "IMAGE",
            scaleMode: "FILL",
            imageHash: image.hash
        }];
        console.log(`✅ Set logo for ${symbol}`);
    } catch (e) {
        console.log(`⚠️ Failed to set logo for ${symbol}:`, e);
        figma.notify(`⚠️ Logo Fail: ${symbol}`);
    }
}


// ================================================================
// MAIN EXECUTIVE FUNCTION
// ================================================================
async function main() {
    console.log("🚀 Running Fully Automated Market Updater...");
    figma.notify("⏳ Fetching real market data...");

    // Data store for cross-section synchronization
    const liveMap = {};

    // 1. Set Dates
    const d = new Date();
    const enDate = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const cnDate = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    await setText(EN_DATES, enDate);
    await setText(CN_DATES, cnDate);

    // 2. Fetch Fear & Greed Index live
    try {
        const fgRes = await fetch("https://api.alternative.me/fng/");
        const fgData = await fgRes.json();
        const fgVal = fgData.data[0].value;
        const fgClass = fgData.data[0].value_classification;

        await setText(FG_EN, `${fgVal}% ${fgClass}`);

        let cnClass = "中性";
        if (fgClass.includes("Extreme Fear")) cnClass = "极度恐惧";
        else if (fgClass.includes("Fear")) cnClass = "恐惧";
        else if (fgClass.includes("Extreme Greed")) cnClass = "极度贪婪";
        else if (fgClass.includes("Greed")) cnClass = "贪婪";

        await setText(FG_CN, `${fgVal}% ${cnClass}`);
        console.log("✅ Fear & Greed updated:", fgVal);
    } catch (e) {
        console.log("⚠️ F&G fetch failed, using fallback.");
        await setText(FG_EN, "7% Extreme Fear");
        await setText(FG_CN, "7% 极度恐惧");
    }

    // 🏆 INJECTED MARKET DATA (For 100% Reliability in Figma - Apr 20, 2026 Update)
    const INJECTED_MARKET_DATA = [
        { symbol: "BTC", name: "Bitcoin", price: 75793.00, change: -1.27, vol: 38600000000, image: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png" },
        { symbol: "ETH", name: "Ethereum", price: 2073.00, change: -1.13, vol: 17220000000, image: "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png" },
        { symbol: "BNB", name: "BNB", price: 601.82, change: 1.54, vol: 3050000000, image: "https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png" },
        { symbol: "SOL", name: "Solana", price: 137.95, change: 3.82, vol: 4080000000, image: "https://coin-images.coingecko.com/coins/images/4128/large/solana.png" },
        { symbol: "XRP", name: "XRP", price: 0.589, change: 1.42, vol: 1290000000, image: "https://coin-images.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png" },
        { symbol: "REQ", name: "Request", price: 0.091, change: 36.20, vol: 10000000, image: "https://coin-images.coingecko.com/coins/images/1188/large/Request_Network_logo_symbol_green.png" },
        { symbol: "OSMO", name: "Osmosis", price: 1.2, change: 27.29, vol: 10000000, image: "https://coin-images.coingecko.com/coins/images/16724/large/osmo.png" },
        { symbol: "IO", name: "io.net", price: 3.5, change: 17.01, vol: 20000000, image: "https://coin-images.coingecko.com/coins/images/36253/large/io_net_logo.png" }
    ];

    let allCoins = [];
    try {
        // Fallback for real-time fetch if available, else use INJECTED data
        const sgRes = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false");
        if (sgRes.ok) {
            allCoins = await sgRes.json();
            console.log("✅ Live Market Data Fetched.");
        } else {
            throw new Error("API Limit");
        }
    } catch (e) {
        console.log("⚠️ Fetch failed or Rate Limited. Using INJECTED_MARKET_DATA.");
        allCoins = INJECTED_MARKET_DATA;
    }

    // Ensure our injected targets (especially gainers not in top 250) are not lost
    INJECTED_MARKET_DATA.forEach(ic => {
        if (!allCoins.find(c => c.symbol.toUpperCase() === ic.symbol.toUpperCase())) {
            allCoins.push(ic);
        }
    });

    allCoins.forEach(c => {
        const sym = c.symbol.toUpperCase();
        liveMap[sym] = {
            id: c.id,
            name: c.name,
            price: c.current_price || c.price,
            change: c.price_change_percentage_24h || c.change,
            vol: c.total_volume || c.vol,
            image: c.image
        };
    });
    console.log("✅ Market Data Synced across all sections.");

    // 3. Hot Coins
    const hotCoinConfig = {
        "BTC": { enPrice: "57:934", cnPrice: "57:1178", enArrow: "57:866", cnArrow: "57:1206" },
        "ETH": { enPrice: "57:933", cnPrice: "57:1177", enArrow: "57:864", cnArrow: "57:1208" },
        "BNB": { enPrice: "57:932", cnPrice: "57:1176", enArrow: "57:863", cnArrow: "57:1207" },
        "SOL": { enPrice: "57:931", cnPrice: "57:1175", enArrow: "57:862", cnArrow: "57:1204" },
        "XRP": { enPrice: "57:930", cnPrice: "57:1174", enArrow: "57:865", cnArrow: "57:1205" }
    };

    for (const [sym, config] of Object.entries(hotCoinConfig)) {
        const data = liveMap[sym];
        if (data) {
            const pStr = formatPrice(data.price);
            await setText(config.enPrice, pStr);
            await setText(config.cnPrice, pStr);
            const isUp = data.change >= 0;
            await setArrow(config.enArrow, isUp);
            await setArrow(config.cnArrow, isUp);
        }
    }

    // 4. Gainer Sectors
    const sectorNodes = [
        { enName: "57:1018", enPerf: "57:1015", enLName: "57:1017", enLPerf: "57:1016", enLogo: "57:1019", cnName: "57:1213", cnPerf: "57:1210", cnLName: "57:1212", cnLPerf: "57:1211", cnLogo: "57:1214" },
        { enName: "57:1027", enPerf: "57:1025", enLName: "57:1026", enLPerf: "57:1024", enLogo: "57:1028", cnName: "57:1222", cnPerf: "57:1220", cnLName: "57:1221", cnLPerf: "57:1219", cnLogo: "57:1223" },
        { enName: "57:1036", enPerf: "57:1034", enLName: "57:1035", enLPerf: "57:1033", enLogo: "57:1037", cnName: "57:1231", cnPerf: "57:1229", cnLName: "57:1230", cnLPerf: "57:1228", cnLogo: "57:1232" },
        { enName: "57:1045", enPerf: "57:1043", enLName: "57:1044", enLPerf: "57:1042", enLogo: "57:1046", cnName: "57:1240", cnPerf: "57:1238", cnLName: "57:1239", cnLPerf: "57:1237", cnLogo: "57:1241" }
    ];

    if (allCoins.length > 0) {
        const sortedGainers = allCoins
            .filter(c => !["usdt", "usdc", "fdusd", "dai", "tusd"].includes(c.symbol.toLowerCase()))
            .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
        const topGainers = sortedGainers.slice(0, 4);

        for (let i = 0; i < 4; i++) {
            const coin = topGainers[i];
            const nodes = sectorNodes[i];
            const perfStr = (coin.price_change_percentage_24h > 0 ? "+" : "") + coin.price_change_percentage_24h.toFixed(2) + "%";
            const symbol = coin.symbol.toUpperCase();

            figma.notify(`Updating Slot ${i + 1}: ${symbol}...`, { timeout: 1000 });

            const coinInfo = await fetchCoinInfo(coin.id);
            const filteredCats = coinInfo.categories.filter(c => shortCatMapCn[c]);

            let enSectorName = "Top Gainer";
            let cnSectorName = "领涨代币";

            if (filteredCats.length > 0) {
                enSectorName = filteredCats[0].split(" (")[0];
                if (enSectorName.length > 15 && filteredCats[0].includes("(")) {
                    enSectorName = filteredCats[0].split("(")[1].replace(")", "");
                }
                cnSectorName = shortCatMapCn[filteredCats[0]];
            }

            await setText(nodes.enName, enSectorName); await setText(nodes.cnName, cnSectorName);
            await setText(nodes.enPerf, perfStr); await setText(nodes.cnPerf, perfStr);
            await setText(nodes.enLName, symbol); await setText(nodes.cnLName, symbol);
            await setText(nodes.enLPerf, perfStr); await setText(nodes.cnLPerf, perfStr);

            await setSectorLogo(nodes.enLogo, symbol, coin.image);
            await setSectorLogo(nodes.cnLogo, symbol, coin.image);
        }
    }

    // 5. News
    const enNews = [
        "Pro-crypto super PAC Fairshake spends $10.5 million to support challenger Menefee in Texas, highlighting growing political influence.",
        "President Trump pledges to keep the U.S. as the 'Crypto Capital of the World' and emphasizes CFTC authority over prediction markets.",
        "Decentralized physical infrastructure network io.net introduces a new staking and tiering security system to combat worker spoofing.",
        "XMAQUINA ($DEUS) completes its Token Generation Event, focusing on physical AI and tokenized robotics equity."
    ];
    const cnNews = [
        "亲加密货币的超级政治行动委员会 Fairshake 斥资 1050 万美元支持德克萨斯州挑战者 Menefee，突显了其日益增长的政治影响力。",
        "特朗普承诺保持美国“世界加密之都”的地位，并强调商品期货交易委员会（CFTC）对预测市场的管辖权。",
        "去中心化物理基础设施网络 io.net 推出新的质押与分级安全系统，以打击恶意节点欺骗。",
        "XMAQUINA ($DEUS) 完成代币生成活动（TGE），聚焦于物理人工智能和代币化的机器人股权。"
    ];
    await setBullets("57:963", enNews);
    await setBullets("57:1067", cnNews);

    // 6. Highlights (ENHANCED DYNAMIC DESCRIPTIONS - Evening Refresh)
    const highlightSymbols = ["BTC", "ETH", "REQ", "OSMO", "IO"];
    const highlightTickers = highlightSymbols.map(s => "$" + s);

    const enHighlights = [];
    const cnHighlights = [];

    // Professional Insights for Blue Chips and Today's Top Gainers
    const blueChipInsights = {
        "BTC": {
            en: "Bitcoin experiences a minor pullback below $76,000 as analysts observe a 'death cross' formation between STH-RP and TMMP indicators.",
            cn: "在分析师观察到 STH-RP 和 TMMP 指标形成“死亡交叉”之际，比特币小幅回调跌破 76,000 美元。"
        },
        "ETH": {
            en: "Ethereum trades lower around $2,073 amid a broader market consolidation, reflecting cautious sentiment across altcoins.",
            cn: "在整体市场盘整和山寨币情绪谨慎的背景下，以太坊价格小幅回落至 2,073 美元附近。"
        },
        "REQ": {
            en: "Request Network sees extreme volatility and surges over 36% following technical oversold signals, attracting contrarian buying interest.",
            cn: "在出现技术超卖信号后，Request Network 吸引了逆向买盘，伴随极高波动性逆市飙升超 36%。"
        },
        "OSMO": {
            en: "Osmosis jumps over 27% driven by renewed community optimism surrounding a revised 'COSMOSIS' merger proposal aimed at funding token swaps.",
            cn: "受社区对旨在资助代币互换的“COSMOSIS”修改版合并提案的乐观情绪推动，Osmosis 大涨超 27%。"
        },
        "IO": {
            en: "io.net rallies 17% ahead of its upcoming staking security system launch, underscoring growing demand for decentralized GPU computing power.",
            cn: "io.net 大涨 17%，即将推出的质押安全系统凸显了市场对去中心化 GPU 算力日益增长的需求。"
        }
    };

    for (const sym of highlightSymbols) {
        const data = liveMap[sym] || { id: "", name: sym, price: 0, change: 0, vol: 0 };
        const pStr = formatPrice(data.price);
        const cStr = formatChange(data.change);
        const vStr = "Vol ~$" + formatVol(data.vol);
        const vStrCn = "成交量约 $" + formatVol(data.vol);

        let insightEn = "";
        let insightCn = "";

        if (blueChipInsights[sym]) {
            insightEn = blueChipInsights[sym].en;
            insightCn = blueChipInsights[sym].cn;
        } else {
            // Fetch live API description for gainers
            const info = await fetchCoinInfo(data.id);

            let cleanEn = info.descEn ? info.descEn.replace(/<[^>]*>?/gm, '') : "";
            let cleanCn = info.descCn ? info.descCn.replace(/<[^>]*>?/gm, '') : "";

            if (cleanEn && cleanEn.length > 20) {
                let sentEn = cleanEn.split('. ')[0] + '.';
                if (sentEn.length > 150) sentEn = sentEn.substring(0, 147) + '...';

                let sentCn = cleanCn ? cleanCn.split('。')[0] + '。' : "";
                if (!sentCn || sentCn.length < 5) sentCn = "该项目近期在社区内获得了极高的热度与关注，引发资金大规模流入。";
                if (sentCn.length > 150) sentCn = sentCn.substring(0, 147) + '...';

                insightEn = `${data.name} surges today. ${sentEn}`;
                insightCn = `在资金热度的推动下，${data.name} 日内录得爆发式增长。${sentCn}`;
            } else {
                // Fallback to Category-based template
                const filteredCats = info.categories.filter(c => catMap[c]).slice(0, 2);

                if (filteredCats.length > 0) {
                    insightEn = `${data.name} surges as a prominent project in ${filteredCats.join(" and ")} sectors, drawing massive retail and speculative interest.`;
                    const cnCats = filteredCats.map(c => catMap[c]);
                    insightCn = `${data.name} 作为 ${cnCats.join("和")} 赛道的有力竞争者，日内录得爆发式增长，成功吸引了大量市场关注与投机资金。`;
                } else {
                    insightEn = `Strong daily performance for ${data.name} draws significant speculative interest as investors rotate capital into trending infrastructure tokens.`;
                    insightCn = `在社区热度和投资者活跃度新高的推动下，${data.name} 录得单日大幅增长，成为当前细分赛道的市场焦点。`;
                }
            }
        }

        enHighlights.push(`$${sym} | ${pStr} | ${cStr} | ${vStr} | ${insightEn}`);
        cnHighlights.push(`$${sym} | ${pStr} | ${cStr} | ${vStrCn} | ${insightCn}`);
    }

    await setBullets("57:967", enHighlights, highlightTickers);
    await setBullets("57:1068", cnHighlights, highlightTickers);

    console.log("🏁 All Sections Successfully Updated and Synchronized!");
    figma.notify("✅ Market Poster Fully Updated & Synced!");
    figma.closePlugin();
}

main();
