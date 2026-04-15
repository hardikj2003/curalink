import dotenv from "dotenv"
dotenv.config()
import express from "express"
import cors from "cors"
import connectDB from'./config/db.js'
import researchRoutes from './routes/research.js'
import axios from "axios"

const app = express();

// Middleware
app.use(cors({
  origin: [
    "https://curalink-frontend-j201.onrender.com", 
    "http://localhost:5173",                    
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
  credentials: true
}));
app.options('(.*)', cors());
app.use(express.json());

// Database
connectDB();

// Routes
app.get('/health', (req, res) => res.status(200).json({ status: 'healthy' }));
app.use('/api/research', researchRoutes);
app.get("/pubmed-test", researchRoutes);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Curalink Server active on port ${PORT}`);
});

server.keepAliveTimeout = 120000; // 120 seconds
server.headersTimeout = 125000;