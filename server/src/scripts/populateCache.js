import mongoose from "mongoose";
import { fetchMedicalDataLive } from "../services/retrievalService.js"; // 👈 use live function
import ResearchCache from "../models/ResearchCache.js";
import dotenv from "dotenv";
dotenv.config();

const QUERIES = [
  { disease: "Parkinson's disease", query: "deep brain stimulation" },
  { disease: "lung cancer", query: "latest treatment" },
  { disease: "breast cancer", query: "HER2 positive" },
  { disease: "diabetes", query: "latest treatment" },
  { disease: "Alzheimer's", query: "early detection" },
];

async function populate() {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const q of QUERIES) {
    const cacheKey = `${q.disease}_${q.query}`
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");
    console.log(`Fetching real data for ${cacheKey}...`);
    const data = await fetchMedicalDataLive({
      disease: q.disease,
      query: q.query,
      location: "",
    });
    await ResearchCache.findOneAndUpdate(
      { cacheKey },
      {
        data: { publications: data.publications, trials: data.trials },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      { upsert: true },
    );
    console.log(
      `Cached ${data.publications.length} pubs, ${data.trials.length} trials`,
    );
  }
  await mongoose.disconnect();
  console.log("Cache population complete.");
}
populate();
