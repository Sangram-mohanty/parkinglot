import dotenv from 'dotenv';

dotenv.config();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to a value of at least 32 characters.');
}

const timeZone = process.env.LOT_TIME_ZONE ?? 'Asia/Kolkata';
try {
  new Intl.DateTimeFormat('en-US', { timeZone });
} catch {
  throw new Error('LOT_TIME_ZONE must be a valid IANA time zone.');
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/parking_lot',
  jwtSecret,
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:4200',
  timeZone
};
