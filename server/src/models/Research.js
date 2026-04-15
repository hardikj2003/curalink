const mongoose = require('mongoose');

const ResearchSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  role: { type: String, default: 'assistant' },
  userContext: {
    patientName: String,
    disease: String,
    location: String,
  },
  query: String,
  response: String,
  sources: Array,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Research', ResearchSchema, 'research_logs');