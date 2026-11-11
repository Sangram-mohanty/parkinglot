import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { authenticate, login, signup } from './auth.js';
import { config } from './config.js';
import { errorHandler } from './errors.js';
import { apiRouter } from './routes.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '32kb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Try again later.' }
});
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many signup attempts. Try again later.' }
});
app.post('/api/auth/login', loginLimiter, login);
app.post('/api/auth/signup', signupLimiter, signup);
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role } });
});
app.use('/api', authenticate, apiRouter);
app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use(errorHandler);
