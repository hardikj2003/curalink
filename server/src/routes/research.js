import express from "express";
import Research from "../models/Research.js";
import { getMedicalData } from "../services/retrievalService.js";
import { generateReasonedResponse } from "../services/aiService.js";
import { generateKey, getCache, setCache } from "../services/cacheService.js";

const router = express.Router();

router.post("/search", async (req, res) => {
  try {
    const { query, disease, location, patientName, sessionId } = req.body;

    // Ensure sessionId
    const activeSession = sessionId || `session_${Date.now()}`;

    // Cache key based on user input (ignores history for cache)
    const cacheKey = generateKey({ query, disease, location, patientName });
    const cachedResponse = getCache(cacheKey);
    if (cachedResponse) {
      console.log("⚡ Cache HIT");
      return res.json({
        success: true,
        data: cachedResponse,
        sessionId: activeSession,
        cached: true,
      });
    }

    // Fetch previous conversation (last 5 exchanges)
    const previousExchanges = await Research.find({ sessionId: activeSession })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Build conversation history array for LLM
    const conversationHistory = previousExchanges.reverse().map((entry) => ({
      query: entry.query,
      response: entry.response,
    }));

    // 1. Fetch deep research data (publications + trials)
    const rawData = await getMedicalData({ disease, query, location });

    // 2. Generate reasoned response with context awareness
    const structuredResponse = await generateReasonedResponse(
      { patientName, disease, query, location },
      conversationHistory,
    );

    // Cache the final response
    setCache(cacheKey, structuredResponse);

    // 3. Save to database (including sources)
    const logEntry = new Research({
      sessionId: activeSession,
      userContext: { patientName, disease, location },
      query,
      response: structuredResponse,
      sources: [...rawData.publications, ...rawData.trials].slice(0, 10),
    });
    await logEntry.save();

    res.json({
      success: true,
      data: structuredResponse,
      sessionId: activeSession,
      cached: false,
    });
  } catch (error) {
    console.error("❌ Route Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Test endpoint for PubMed (optional)
router.get("/pubmed-test", async (req, res) => {
  try {
    const axios = (await import("axios")).default;
    const r = await axios.get(
      "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
      {
        params: { db: "pubmed", term: "cancer", retmode: "json" },
      },
    );
    res.json(r.data);
  } catch (err) {
    res.json({ error: err.message });
  }
});

export default router;
