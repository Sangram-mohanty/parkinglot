import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from './auth.js';
import { config } from './config.js';
import { compatibleSpotSizes, calculateCharge, getSpotState, vehicleTypes } from './domain.js';
import { ApiError, asyncHandler } from './errors.js';
import {
  ParkingFloor,
  ParkingDisplay,
  ParkingLot,
  ParkingSpot,
  ParkingTicket,
  Payment,
  RatePlan,
  User,
  Vehicle,
  VehiclePass
} from './models.js';
import bcrypt from 'bcryptjs';

export const apiRouter = Router();
const adminOnly = [requireRole('ADMIN')];
const staffOnly = [requireRole('ADMIN', 'OPERATOR')];
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid record identifier.');
const optionalText = (limit) => z.string().trim().max(limit).optional().or(z.literal(''));
const validTimeZone = z.string().trim().min(1).max(60).refine((value) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Use a valid IANA time zone.');
const getLot = async () => {
  const lot = await ParkingLot.findOne();
  if (!lot) throw new ApiError(503, 'Parking lot is not configured. Run the setup command.');
  return lot;
};

apiRouter.get('/dashboard', ...staffOnly, asyncHandler(async (_req, res) => {
  const lot = await getLot();
  const [floors, spots, openTickets, closedCount] = await Promise.all([
    ParkingFloor.countDocuments({ lot: lot._id }),
    ParkingSpot.find().populate({ path: 'floor', select: 'floorNumber underMaintenance lot' }).lean(),
    ParkingTicket.countDocuments({ status: 'OPEN' }),
    ParkingTicket.countDocuments({ status: 'CLOSED' })
  ]);
  const counts = { available: 0, occupied: 0, maintenance: 0 };
  for (const spot of spots) {
    const state = getSpotState({
      spot,
      floor: spot.floor ?? { underMaintenance: true },
      lot
    });
    if (state === 'AVAILABLE') counts.available += 1;
    else if (state === 'OCCUPIED') counts.occupied += 1;
    else counts.maintenance += 1;
  }
  res.json({
    lot: {
      id: lot.id,
      name: lot.name,
      address: lot.address,
      capacity: lot.capacity,
      timeZone: lot.timeZone,
      entryGateName: lot.entryGateName,
      exitGateName: lot.exitGateName,
      isOpen: lot.isOpen,
      underMaintenance: lot.underMaintenance
    },
    floors,
    spots: counts,
    openTickets,
    closedTickets: closedCount
  });
}));

apiRouter.get('/lot', ...staffOnly, asyncHandler(async (_req, res) => {
  const lot = await getLot();
  res.json({ lot });
}));

apiRouter.get('/displays', ...staffOnly, asyncHandler(async (_req, res) => {
  const lot = await getLot();
  const [mainDisplay, floorDisplays, floors] = await Promise.all([
    ParkingDisplay.findOne({ lot: lot._id, displayType: 'MAIN_GATE', isActive: true })
      .populate('gate', 'gateType name')
      .lean(),
    ParkingDisplay.find({ lot: lot._id, displayType: 'FLOOR', isActive: true }).lean(),
    ParkingFloor.find({ lot: lot._id }).lean()
  ]);
  const floorIds = floorDisplays.map((display) => display.floor);
  const spots = await ParkingSpot.find({ floor: { $in: floorIds } })
    .populate({ path: 'floor', select: 'floorNumber underMaintenance' })
    .lean();
  const countsByFloor = new Map(floorDisplays.map((display) => [display.floor.toString(), {
    displayId: display._id,
    floorNumber: floors.find((floor) => floor._id.equals(display.floor))?.floorNumber,
    available: 0,
    occupied: 0,
    maintenance: 0
  }]));
  const gateCounts = { available: 0, occupied: 0, maintenance: 0 };
  for (const spot of spots) {
    const floor = spot.floor;
    const state = getSpotState({ spot, floor, lot });
    const countKey = state === 'AVAILABLE' ? 'available' : state === 'OCCUPIED' ? 'occupied' : 'maintenance';
    const counts = countsByFloor.get(floor._id.toString());
    if (counts) counts[countKey] += 1;
    gateCounts[countKey] += 1;
  }
  res.json({
    mainGate: mainDisplay ? { ...mainDisplay, counts: gateCounts } : null,
    floors: [...countsByFloor.values()]
  });
}));

apiRouter.patch('/lot', ...adminOnly, asyncHandler(async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    address: z.string().trim().min(1).max(300).optional(),
    timeZone: validTimeZone.optional(),
    isOpen: z.boolean().optional(),
    underMaintenance: z.boolean().optional()
  }).strict().parse(req.body);
  const lot = await getLot();
  Object.assign(lot, input);
  await lot.save();
  res.json({ lot });
}));

apiRouter.get('/floors', ...staffOnly, asyncHandler(async (_req, res) => {
  const lot = await getLot();
  const floors = await ParkingFloor.find({ lot: lot._id }).sort({ floorNumber: 1 }).lean();
  const floorIds = floors.map((floor) => floor._id);
  const spots = await ParkingSpot.find({ floor: { $in: floorIds } })
    .populate({ path: 'activeTicket', select: 'registrationNumber vehicleType entryAt' })
    .sort({ spotNumber: 1 })
    .lean();
  const grouped = new Map(floors.map((floor) => [floor._id.toString(), []]));
  for (const spot of spots) {
    const floor = floors.find((item) => item._id.equals(spot.floor));
    grouped.get(spot.floor.toString()).push({
      id: spot._id,
      spotNumber: spot.spotNumber,
      size: spot.size,
      underMaintenance: spot.underMaintenance,
      state: getSpotState({ spot, floor, lot }),
      activeTicket: spot.activeTicket
    });
  }
  res.json({
    floors: floors.map((floor) => ({
      id: floor._id,
      floorNumber: floor.floorNumber,
      underMaintenance: floor.underMaintenance,
      spots: grouped.get(floor._id.toString())
    }))
  });
}));

apiRouter.post('/floors', ...adminOnly, asyncHandler(async (req, res) => {
  const { floorNumber } = z.object({ floorNumber: z.string().trim().min(1).max(20) }).parse(req.body);
  const lot = await getLot();
  const floor = await ParkingFloor.create({ lot: lot._id, floorNumber });
  res.status(201).json({ floor });
}));

apiRouter.patch('/floors/:id/maintenance', ...adminOnly, asyncHandler(async (req, res) => {
  const id = objectId.parse(req.params.id);
  const { underMaintenance } = z.object({ underMaintenance: z.boolean() }).parse(req.body);
  const floor = await ParkingFloor.findOneAndUpdate(
    { _id: id, lot: (await getLot())._id },
    { underMaintenance },
    { new: true }
  );
  if (!floor) throw new ApiError(404, 'Floor not found.');
  res.json({ floor });
}));

apiRouter.post('/spots', ...adminOnly, asyncHandler(async (req, res) => {
  const { floorId, spotNumber, size } = z.object({
    floorId: objectId,
    spotNumber: z.string().trim().min(1).max(30),
    size: z.enum(['SMALL', 'COMPACT', 'MEDIUM', 'BIG'])
  }).parse(req.body);
  const lot = await getLot();
  const floor = await ParkingFloor.findOne({ _id: floorId, lot: lot._id });
  if (!floor) throw new ApiError(404, 'Floor not found.');
  const floorIds = await ParkingFloor.find({ lot: lot._id }).distinct('_id');
  if (await ParkingSpot.countDocuments({ floor: { $in: floorIds } }) >= lot.capacity) {
    throw new ApiError(409, 'The lot is already at its configured capacity.');
  }
  const spot = await ParkingSpot.create({ floor: floor._id, spotNumber, size });
  res.status(201).json({ spot });
}));

apiRouter.patch('/spots/:id/maintenance', ...adminOnly, asyncHandler(async (req, res) => {
  const id = objectId.parse(req.params.id);
  const { underMaintenance } = z.object({ underMaintenance: z.boolean() }).parse(req.body);
  const spot = await ParkingSpot.findById(id);
  if (!spot) throw new ApiError(404, 'Spot not found.');
  if (underMaintenance && spot.activeTicket) throw new ApiError(409, 'An occupied spot cannot be put under maintenance.');
  spot.underMaintenance = underMaintenance;
  await spot.save();
  res.json({ spot });
}));

apiRouter.get('/tickets', ...staffOnly, asyncHandler(async (req, res) => {
  const status = req.query.status;
  if (status && !['OPEN', 'CLOSED'].includes(status)) throw new ApiError(400, 'Status must be OPEN or CLOSED.');
  const filter = status ? { status } : {};
  const tickets = await ParkingTicket.find(filter)
    .populate({ path: 'spot', select: 'spotNumber size', populate: { path: 'floor', select: 'floorNumber' } })
    .populate({ path: 'pass', select: 'passType expiresAt' })
    .sort({ entryAt: -1 })
    .limit(200)
    .lean();
  res.json({ tickets });
}));

apiRouter.post('/tickets/entry', ...staffOnly, asyncHandler(async (req, res) => {
  const input = z.object({
    registrationNumber: z.string().trim().min(2).max(30),
    vehicleType: z.enum(vehicleTypes),
    color: optionalText(40),
    make: optionalText(60),
    model: optionalText(60)
  }).parse(req.body);
  const registrationNumber = input.registrationNumber.toUpperCase();
  if (!/^[A-Z0-9 -]+$/.test(registrationNumber)) throw new ApiError(400, 'Registration number contains unsupported characters.');

  const lot = await getLot();
  if (!lot.isOpen || lot.underMaintenance) throw new ApiError(409, 'The parking lot is currently not accepting vehicles.');
  if (await ParkingTicket.exists({ registrationNumber, status: 'OPEN' })) {
    throw new ApiError(409, 'This vehicle already has an open parking ticket.');
  }

  const vehicle = await Vehicle.findOneAndUpdate(
    { registrationNumber },
    {
      $set: { vehicleType: input.vehicleType },
      $setOnInsert: {
        registrationNumber,
        ...(input.color ? { color: input.color } : {}),
        ...(input.make ? { make: input.make } : {}),
        ...(input.model ? { model: input.model } : {})
      }
    },
    { new: true, upsert: true, runValidators: true }
  );
  const now = new Date();
  const pass = await VehiclePass.findOne({
    vehicle: vehicle._id,
    isActive: true,
    startsAt: { $lte: now },
    expiresAt: { $gt: now }
  }).sort({ expiresAt: -1 });
  const floorIds = await ParkingFloor.find({ lot: lot._id, underMaintenance: false }).distinct('_id');
  const spotSizes = compatibleSpotSizes(input.vehicleType);
  const candidates = await ParkingSpot.find({
    floor: { $in: floorIds },
    underMaintenance: false,
    activeTicket: null,
    size: { $in: spotSizes }
  }).populate({ path: 'floor', select: 'underMaintenance lot' })
    .sort({ size: 1, spotNumber: 1 });
  const available = candidates
    .filter((spot) => spot.floor && !spot.floor.underMaintenance && spot.floor.lot.equals(lot._id))
    .sort((left, right) => spotSizes.indexOf(left.size) - spotSizes.indexOf(right.size))[0];
  if (!available) throw new ApiError(409, 'No compatible parking spots are currently available.');

  const ticket = new ParkingTicket({
    registrationNumber,
    vehicle: vehicle._id,
    vehicleType: input.vehicleType,
    spot: available._id,
    pass: pass?._id ?? null,
    entryAt: now
  });
  await ticket.save();
  let reservation;
  try {
    reservation = await ParkingSpot.updateOne(
      { _id: available._id, activeTicket: null, underMaintenance: false },
      { $set: { activeTicket: ticket._id } }
    );
  } catch (error) {
    await ParkingTicket.deleteOne({ _id: ticket._id });
    throw error;
  }
  if (reservation.modifiedCount !== 1) {
    await ParkingTicket.deleteOne({ _id: ticket._id });
    throw new ApiError(409, 'That spot was just assigned to another vehicle. Please retry entry.');
  }
  await ticket.populate({ path: 'spot', select: 'spotNumber size', populate: { path: 'floor', select: 'floorNumber' } });
  res.status(201).json({ ticket });
}));

apiRouter.post('/tickets/:id/exit', ...staffOnly, asyncHandler(async (req, res) => {
  const id = objectId.parse(req.params.id);
  const { method } = z.object({ method: z.enum(['CASH', 'CARD', 'UPI']) }).parse(req.body);
  const ticket = await ParkingTicket.findOne({ _id: id, status: 'OPEN' }).populate('pass');
  if (!ticket) throw new ApiError(404, 'Open parking ticket not found.');
  const lot = await getLot();
  const ratePlan = await RatePlan.findOne({ lot: lot._id });
  if (!ratePlan) throw new ApiError(503, 'Parking rates are not configured.');
  const exitAt = new Date();
  const passType = ticket.pass?.isActive && ticket.pass.expiresAt > exitAt ? ticket.pass.passType : null;
  const amount = calculateCharge({
    entryAt: ticket.entryAt,
    exitAt,
    ratePlan,
    timeZone: lot.timeZone || config.timeZone,
    passType
  });
  const payment = await Payment.create({
    ticket: ticket._id,
    amount,
    method,
    status: 'SUCCESS',
    providerReference: null
  });
  const closed = await ParkingTicket.updateOne(
    { _id: ticket._id, status: 'OPEN' },
    { $set: { status: 'CLOSED', exitAt, amountDue: amount } }
  );
  if (closed.modifiedCount !== 1) {
    await Payment.deleteOne({ _id: payment._id });
    throw new ApiError(409, 'This ticket has already been checked out.');
  }
  const released = await ParkingSpot.updateOne(
    { _id: ticket.spot, activeTicket: ticket._id },
    { $set: { activeTicket: null } }
  );
  if (released.modifiedCount !== 1) {
    throw new ApiError(500, 'Ticket was closed, but its spot could not be released. Contact an administrator.');
  }
  res.json({ ticket: { id: ticket.id, amountDue: amount, exitAt }, payment });
}));

apiRouter.get('/payments', ...staffOnly, asyncHandler(async (_req, res) => {
  const payments = await Payment.find()
    .populate({ path: 'ticket', select: 'registrationNumber entryAt exitAt' })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json({ payments });
}));

apiRouter.get('/rates', ...staffOnly, asyncHandler(async (_req, res) => {
  const lot = await getLot();
  const ratePlan = await RatePlan.findOne({ lot: lot._id }).lean();
  if (!ratePlan) throw new ApiError(503, 'Parking rates are not configured.');
  res.json({ ratePlan });
}));

apiRouter.put('/rates', ...adminOnly, asyncHandler(async (req, res) => {
  const input = z.object({
    currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
    hourlyRate: z.number().min(0),
    dailyRate: z.number().min(0),
    weeklyRate: z.number().min(0),
    monthlyRate: z.number().min(0),
    vipHourlyRate: z.number().min(0),
    peakMultiplier: z.number().min(0),
    weekendMultiplier: z.number().min(0),
    peakStartHour: z.number().int().min(0).max(23),
    peakEndHour: z.number().int().min(0).max(24)
  }).strict().parse(req.body);
  if (input.peakStartHour === input.peakEndHour) throw new ApiError(400, 'Peak start and end hours must differ.');
  const lot = await getLot();
  const ratePlan = await RatePlan.findOneAndUpdate(
    { lot: lot._id },
    { $set: input, $setOnInsert: { lot: lot._id } },
    { new: true, upsert: true, runValidators: true }
  );
  res.json({ ratePlan });
}));

apiRouter.get('/passes', ...staffOnly, asyncHandler(async (_req, res) => {
  const passes = await VehiclePass.find().populate('vehicle', 'registrationNumber vehicleType').sort({ expiresAt: -1 }).limit(200);
  res.json({ passes });
}));

apiRouter.post('/passes', ...adminOnly, asyncHandler(async (req, res) => {
  const input = z.object({
    registrationNumber: z.string().trim().min(2).max(30),
    passType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'VIP']),
    startsAt: z.coerce.date(),
    expiresAt: z.coerce.date()
  }).parse(req.body);
  if (input.expiresAt <= input.startsAt) throw new ApiError(400, 'Pass expiry must be after its start date.');
  const vehicle = await Vehicle.findOne({ registrationNumber: input.registrationNumber.toUpperCase() });
  if (!vehicle) throw new ApiError(404, 'Register this vehicle with an entry ticket before adding a pass.');
  const pass = await VehiclePass.create({ ...input, vehicle: vehicle._id, isActive: true });
  res.status(201).json({ pass });
}));

apiRouter.post('/users', ...adminOnly, asyncHandler(async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().email().max(254),
    password: z.string().min(12).max(128),
    role: z.enum(['ADMIN', 'OPERATOR'])
  }).parse(req.body);
  const user = await User.create({
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: await bcrypt.hash(input.password, 12),
    role: input.role
  });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));
