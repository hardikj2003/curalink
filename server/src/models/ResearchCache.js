import mongoose from 'mongoose';
const researchCacheSchema = new mongoose.Schema({
  cacheKey: { type: String, unique: true, index: true },
  data: { type: Object, required: true },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
});
export default mongoose.model('ResearchCache', researchCacheSchema);