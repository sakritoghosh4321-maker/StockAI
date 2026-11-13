
const express = require("express");

const router = express.Router();

const DEMO_NEWS = [
  {
    id: "demo-1",
    title: "Indian markets remain closely watched as investors track economic developments",
    source: "StockAI Demo News",
    category: "Market",
    sentiment: "Neutral",
    sentimentScore: 0,
    time: "Demo data",
    url: null,
  },
];

const POSITIVE_WORDS = [
  "gain", "gains", "growth", "profit", "profits", "surge",
  "rally", "rise", "rises", "strong", "record", "beat",
  "wins", "win", "order", "orders", "contract", "approved",
  "approval", "upgrade", "bullish", "buyback", "dividend",
];

const NEGATIVE_WORDS = [
  "fall", "falls", "drop", "drops", "loss", "losses",
  "decline", "declines", "crash", "weak", "miss", "misses",
  "downgrade", "debt", "fraud", "probe", "penalty",
  "warning", "bearish", "selloff", "slump", "cuts",
];

function analyzeHeadline(title) {
  const text = String(title || "").toLowerCase();

  const positiveTerms = [
    "gain", "gains", "growth", "profit", "profits", "surge",
    "surges", "rally", "rallies", "rise", "rises", "strong",
    "record", "beat", "beats", "wins", "win", "order", "orders",
    "contract", "contracts", "approved", "approval", "upgrade",
    "upgrades", "bullish", "buyback", "dividend", "dividends"
  ];

  const negativeTerms = [
    "fall", "falls", "fell", "drop", "drops", "dropped",
    "loss", "losses", "decline", "declines", "declined",
    "crash", "weak", "weaken", "weakens", "miss", "misses",
    "missed", "downgrade", "downgrades", "debt", "fraud",
    "probe", "penalty", "warning", "bearish", "selloff",
    "slump", "slumps", "slumped", "slide", "slides", "slid",
    "plunge", "plunges", "plunged", "tumble", "tumbles",
    "tumbled", "sinks", "sank", "cuts", "cut"
  ];

  const words = text.match(/[a-z]+/g) || [];
  let positiveScore = 0;
  let negativeScore = 0;

  for (const word of words) {
    if (positiveTerms.includes(word)) positiveScore += 1;
    if (negativeTerms.includes(word)) negativeScore += 1;
  }

  // Explicit negative price movement should outweigh a positive business
  // development mentioned in the same headline.
  const negativePriceMovement =
    /\b(slides?|slid|falls?|fell|drops?|dropped|declines?|declined|plunges?|plunged|slumps?|slumped|tumbles?|tumbled|sinks?|sank|sell-?off|down)\b/i.test(text);

  let score = positiveScore - negativeScore;

  if (negativePriceMovement) {
    score = Math.min(score, -2);
  }

  const normalized = Math.max(-1, Math.min(1, score / 3));

  let sentiment = "Neutral";
  if (normalized > 0.15) sentiment = "Positive";
  if (normalized < -0.15) sentiment = "Negative";

  return {
    sentiment,
    sentimentScore: Number(normalized.toFixed(2))
  };
}

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(Number(n))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    )
    .trim();
}

function extractTag(xml, tag) {
  const match = xml.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i")
  );

  return match ? decodeXml(match[1]) : "";
}

function parseRss(xml) {
  const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];

  return items.map((item, index) => {
    const title = extractTag(item, "title");
    const sourceMatch = item.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i);
    const source = sourceMatch ? decodeXml(sourceMatch[1]) : "Google News";
    const link = extractTag(item, "link");
    const pubDate = extractTag(item, "pubDate");

    const sentiment = analyzeHeadline(title);

    return {
      id: `rss-${index}-${Buffer.from(title).toString("base64").slice(0, 16)}`,
      title,
      source,
      category: "Indian Market",
      ...sentiment,
      time: pubDate || "Publication time unavailable",
      url: /^https?:\/\//i.test(link) ? link : null,
    };
  }).filter(item => item.title);
}

async function getLiveNews(query = "Indian stock market") {
  const url = new URL("https://news.google.com/rss/search");

  url.searchParams.set("q", `${query} when:2d`);
  url.searchParams.set("hl", "en-IN");
  url.searchParams.set("gl", "IN");
  url.searchParams.set("ceid", "IN:en");

  const response = await fetch(url, {
    headers: { "User-Agent": "StockAI/1.0 financial-news-reader" },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`News provider returned HTTP ${response.status}`);
  }

  const xml = await response.text();

  if (!xml.includes("<rss") && !xml.includes("<feed")) {
    throw new Error("News provider returned an unexpected feed.");
  }

  return parseRss(xml).slice(0, 20);
}

async function sendNews(req, res) {
  try {
    const query = String(req.query.q || "Indian stock market")
      .trim()
      .slice(0, 100);

    const items = await getLiveNews(query);

    if (!items.length) {
      throw new Error("No headlines were returned.");
    }

    res.json({
      status: "success",
      dataStatus: "LIVE PROVIDER HEADLINES - BASIC ESTIMATED SENTIMENT",
      source: "Google News RSS",
      fetchedAt: new Date().toISOString(),
      total: items.length,
      news: items,
    });
  } catch (error) {
    res.status(200).json({
      status: "fallback",
      dataStatus: "DEMO DATA - LIVE NEWS UNAVAILABLE",
      message: error.message,
      total: DEMO_NEWS.length,
      news: DEMO_NEWS,
    });
  }
}

router.get("/", sendNews);

router.get("/sentiment", async (req, res) => {
  try {
    const query = String(req.query.q || "Indian stock market")
      .trim()
      .slice(0, 100);

    const news = await getLiveNews(query);

    if (!news.length) throw new Error("No headlines available.");

    const positive = news.filter(x => x.sentiment === "Positive").length;
    const neutral = news.filter(x => x.sentiment === "Neutral").length;
    const negative = news.filter(x => x.sentiment === "Negative").length;

    const averageScore = news.reduce(
      (sum, item) => sum + item.sentimentScore,
      0
    ) / news.length;

    const overallSentiment =
      averageScore > 0.15 ? "Positive" :
      averageScore < -0.15 ? "Negative" : "Neutral";

    res.json({
      status: "success",
      dataStatus: "LIVE PROVIDER HEADLINES - BASIC ESTIMATED SENTIMENT",
      source: "Google News RSS",
      fetchedAt: new Date().toISOString(),
      analysis: {
        overallSentiment,
        averageScore: Number(averageScore.toFixed(2)),
        totalNews: news.length,
        positive,
        neutral,
        negative,
      },
    });
  } catch (error) {
    res.status(200).json({
      status: "fallback",
      dataStatus: "DEMO DATA - LIVE NEWS UNAVAILABLE",
      message: error.message,
      analysis: {
        overallSentiment: "Neutral",
        averageScore: 0,
        totalNews: DEMO_NEWS.length,
        positive: 0,
        neutral: DEMO_NEWS.length,
        negative: 0,
      },
    });
  }
});

module.exports = router;


