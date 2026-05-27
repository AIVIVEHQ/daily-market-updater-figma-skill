---
name: daily_market_updater_figma
description: 自动获取加密货币市场数据与新闻，结合AI分析，自动生成并部署Figma行情海报更新脚本。
---

# 步骤说明

当用户调用此 Workflow 时，请按照以下步骤自动化执行：

// turbo
1. **Fetch Latest News and Market Data**
   运行当前 Skill 目录下的 fetch 脚本，从 CryptoCompare 获取新闻，从 CoinGecko 获取市场数据。脚本会将数据保存到 `scripts/news_block_output.js`。
   `node scripts/fetch_news_builder.js`

2. **Agentic Research and Insight Generation**
   - 使用 `view_file` 工具读取新生成的 `scripts/news_block_output.js`。
   - **Translate News**: Extract the `enNews` array, and translate the 5 English news items into high-quality Chinese (`cnNews`).
   - **Generate Blue Chip Insights**: 为 BTC 和 ETH 编写简短、专业的英文和中文市场点评。
   - **Research & Generate Gainer Insights**: 从抓取的数据中识别涨幅前三的代币。**千万不要使用通用的模板描述。**你必须**在网上搜索**它们最新的项目信息、新闻或叙事，并用中英文为每个代币编写独特、专业、不重复的点评。

3. **Inject Data and Refine Script**
   - 使用 `multi_replace_file_content` 工具更新当前技能目录下的 `scripts/market_updater_final.js`。
   - **Data Injection**: 使用新生成的内容替换 `enNews`、`cnNews` 以及 `blueChipInsights`（BTC、ETH及3个涨幅最大的代币）中的相关对象。确保 `blueChipInsights` 中的代币符号与 `highlightTickers` 匹配。
   - **Sector Name Refinement**: 确保中文板块名称（在 `catMap` 和 `shortCatMapCn` 中）保持整洁，且**不要包含“板块”一词**（例如：使用“Meme”而不是“Meme板块”）。

// turbo
4. **Prepare output for Figma**
   将更新后的最终脚本复制为 `dist/code.js`，以供用户直接通过 manifest 导入使用。
   `cp scripts/market_updater_final.js dist/code.js`

5. **Notify User**
   通知用户 Figma 市场更新脚本已全面更新并准备就绪。说明涨幅点评是通过网络调研生成的，且板块名称已净化。提醒用户：“请在 Figma 中通过 Plugins -> Development -> Import plugin from manifest... 导入本文件夹中的 manifest.json 文件以运行插件。”
