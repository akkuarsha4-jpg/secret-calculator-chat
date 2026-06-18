import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import contactRoutes from './routes/contacts.js';
import messageRoutes from './routes/messages.js';
import uploadRoutes from './routes/uploads.js';
import { registerSocketHandlers } from './socket/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const clientOrigins = [
  ...(process.env.CLIENT_ORIGIN || '').split(','),
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]
  .map(origin => origin.trim())
  .filter(Boolean)
  .filter((origin, index, list) => list.indexOf(origin) === index);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false
}));
app.use(cors({ origin: clientOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.set("trust proxy", true);
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true }));

app.get('/api/health', (_, res) => res.json({ ok: true, name: 'Secret Calculator Chat' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/uploads', uploadRoutes);

const io = new Server(server, {
  cors: { origin: clientOrigins, credentials: true }
});
registerSocketHandlers(io);

const port = process.env.PORT || 5000;
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/secret-calculator-chat');
server.listen(port, () => console.log(`Secret Calculator Chat API running on ${port}`));
