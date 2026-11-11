import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from './config.js';
import {
  ParkingDisplay,
  ParkingFloor,
  ParkingGate,
  ParkingLot,
  ParkingSpot,
  RatePlan,
  User
} from './models.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12) {
  throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters in server/.env before setup.');
}

await mongoose.connect(config.mongoUri);
try {
  await User.updateOne(
    { email },
    {
      $setOnInsert: {
        name: 'Parking Administrator',
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: 'ADMIN'
      }
    },
    { upsert: true }
  );

  let lot = await ParkingLot.findOne();
  if (!lot) {
    lot = await ParkingLot.create({
      name: 'City Parking',
      address: 'Update this address in lot settings.',
      capacity: 500,
      timeZone: config.timeZone
    });
  }
  await RatePlan.updateOne({ lot: lot._id }, { $setOnInsert: { lot: lot._id } }, { upsert: true });
  const [entryGate, exitGate] = await Promise.all([
    ParkingGate.findOneAndUpdate(
      { lot: lot._id, gateType: 'ENTRY' },
      { $setOnInsert: { name: lot.entryGateName } },
      { new: true, upsert: true }
    ),
    ParkingGate.findOneAndUpdate(
      { lot: lot._id, gateType: 'EXIT' },
      { $setOnInsert: { name: lot.exitGateName } },
      { new: true, upsert: true }
    )
  ]);
  await ParkingDisplay.updateOne(
    { lot: lot._id, displayType: 'MAIN_GATE' },
    { $setOnInsert: { gate: entryGate._id, floor: null, isActive: true } },
    { upsert: true }
  );

  if (await ParkingFloor.countDocuments({ lot: lot._id }) === 0) {
    for (let floorIndex = 1; floorIndex <= 10; floorIndex += 1) {
      const floor = await ParkingFloor.create({ lot: lot._id, floorNumber: String(floorIndex) });
      const spots = Array.from({ length: 50 }, (_value, index) => {
        const size = index < 10 ? 'SMALL' : index < 20 ? 'COMPACT' : index < 35 ? 'MEDIUM' : 'BIG';
        return {
          floor: floor._id,
          spotNumber: `${floorIndex}-${String(index + 1).padStart(3, '0')}`,
          size
        };
      });
      await ParkingSpot.insertMany(spots);
    }
  }

  const floors = await ParkingFloor.find({ lot: lot._id });
  await ParkingDisplay.bulkWrite(floors.map((floor) => ({
    updateOne: {
      filter: { lot: lot._id, displayType: 'FLOOR', floor: floor._id },
      update: { $setOnInsert: { gate: null, isActive: true } },
      upsert: true
    }
  })));

  console.log(`Setup complete. Admin account: ${email}`);
} finally {
  await mongoose.disconnect();
}
