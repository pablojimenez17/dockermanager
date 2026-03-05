import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import containerRoutes from './routes/containerRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
<<<<<<< HEAD
import aiRoutes from './routes/aiRoutes.js';
import networkRoutes from './routes/networkRoutes.js';
=======
>>>>>>> 71fa28673cecb662531889aa67e855dbc321d0c8
import { setupSockets } from './websockets.js';
import { createServer } from 'http';

dotenv.config();

const app = express();
const server = createServer(app);

// Initialize WebSockets for real-time Terminal
setupSockets(server);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/containers', containerRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/networks', networkRoutes);

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dockermanager')
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Error connecting to MongoDB:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
