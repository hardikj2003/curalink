import { pipeline } from "@xenova/transformers";

let embeddingPipeline = null;

// Lazy-load the model (all-MiniLM-L6-v2)
async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return embeddingPipeline;
}

export async function getEmbedding(text) {
  const pipe = await getEmbeddingPipeline();
  const result = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(result.data);
}

export function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}