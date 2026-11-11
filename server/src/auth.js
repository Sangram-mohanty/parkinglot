import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from './config.js';
import { User } from './models.js';
import { ApiError, asyncHandler } from './errors.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Sign in to continue.');

  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: 'parking-lot-api' });
    const user = await User.findById(payload.sub).select('_id name email role');
    if (!user) throw new ApiError(401, 'This account is no longer available.');
    req.user = user;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Your session is invalid or has expired.');
  }
  next();
});

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role)) return next(new ApiError(403, 'You do not have permission to perform this action.'));
    next();
  };
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = z.object({
    email: z.string().email().max(254),
    password: z.string().min(1).max(128)
  }).parse(req.body);

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, 'Email or password is incorrect.');
  }

  res.json(createSession(user));
});

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().email().max(254),
    password: z.string().min(12).max(128)
  }).strict().parse(req.body);

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    role: 'OPERATOR'
  });
  res.status(201).json(createSession(user));
});

function createSession(user) {
  const token = jwt.sign(
    { sub: user.id, role: user.role },
    config.jwtSecret,
    { expiresIn: '8h', issuer: 'parking-lot-api' }
  );
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  };
}
