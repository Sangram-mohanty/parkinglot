import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'OPERATOR'], default: 'OPERATOR', required: true }
}, { timestamps: true });

const lotSchema = new Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  capacity: { type: Number, required: true, min: 1, default: 500 },
  timeZone: { type: String, required: true, default: 'Asia/Kolkata' },
  isOpen: { type: Boolean, default: true },
  underMaintenance: { type: Boolean, default: false },
  entryGateName: { type: String, default: 'Entry gate' },
  exitGateName: { type: String, default: 'Exit gate' }
}, { timestamps: true });

const gateSchema = new Schema({
  lot: { type: Schema.Types.ObjectId, ref: 'ParkingLot', required: true, index: true },
  gateType: { type: String, enum: ['ENTRY', 'EXIT'], required: true },
  name: { type: String, required: true, trim: true }
}, { timestamps: true });
gateSchema.index({ lot: 1, gateType: 1 }, { unique: true });

const floorSchema = new Schema({
  lot: { type: Schema.Types.ObjectId, ref: 'ParkingLot', required: true, index: true },
  floorNumber: { type: String, required: true, trim: true },
  underMaintenance: { type: Boolean, default: false }
}, { timestamps: true });
floorSchema.index({ lot: 1, floorNumber: 1 }, { unique: true });

const spotSchema = new Schema({
  floor: { type: Schema.Types.ObjectId, ref: 'ParkingFloor', required: true, index: true },
  spotNumber: { type: String, required: true, trim: true },
  size: { type: String, enum: ['SMALL', 'COMPACT', 'MEDIUM', 'BIG'], required: true },
  underMaintenance: { type: Boolean, default: false },
  activeTicket: { type: Schema.Types.ObjectId, ref: 'ParkingTicket', default: null }
}, { timestamps: true });
spotSchema.index({ floor: 1, spotNumber: 1 }, { unique: true });
spotSchema.index({ activeTicket: 1 }, {
  unique: true,
  partialFilterExpression: { activeTicket: { $type: 'objectId' } }
});

const displaySchema = new Schema({
  lot: { type: Schema.Types.ObjectId, ref: 'ParkingLot', required: true, index: true },
  floor: { type: Schema.Types.ObjectId, ref: 'ParkingFloor', default: null },
  gate: { type: Schema.Types.ObjectId, ref: 'ParkingGate', default: null },
  displayType: { type: String, enum: ['MAIN_GATE', 'FLOOR'], required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
displaySchema.index({ lot: 1, displayType: 1 }, {
  unique: true,
  partialFilterExpression: { displayType: 'MAIN_GATE' }
});
displaySchema.index({ lot: 1, floor: 1 }, {
  unique: true,
  partialFilterExpression: { displayType: 'FLOOR' }
});

const vehicleSchema = new Schema({
  registrationNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
  vehicleType: {
    type: String,
    enum: ['TWO_WHEELER', 'THREE_WHEELER', 'FOUR_WHEELER', 'SIX_WHEELER', 'EIGHT_WHEELER'],
    required: true
  },
  color: { type: String, trim: true, maxlength: 40 },
  make: { type: String, trim: true, maxlength: 60 },
  model: { type: String, trim: true, maxlength: 60 }
}, { timestamps: true });

const passSchema = new Schema({
  vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
  passType: { type: String, enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'VIP'], required: true },
  startsAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
passSchema.index({ vehicle: 1, startsAt: 1, expiresAt: 1 });

const ticketSchema = new Schema({
  registrationNumber: { type: String, required: true, uppercase: true, trim: true },
  vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  vehicleType: {
    type: String,
    enum: ['TWO_WHEELER', 'THREE_WHEELER', 'FOUR_WHEELER', 'SIX_WHEELER', 'EIGHT_WHEELER'],
    required: true
  },
  spot: { type: Schema.Types.ObjectId, ref: 'ParkingSpot', required: true },
  pass: { type: Schema.Types.ObjectId, ref: 'VehiclePass', default: null },
  entryAt: { type: Date, required: true, default: Date.now },
  exitAt: { type: Date, default: null },
  amountDue: { type: Number, min: 0, default: null },
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN', required: true }
}, { timestamps: true });
ticketSchema.index({ registrationNumber: 1 }, {
  unique: true,
  partialFilterExpression: { status: 'OPEN' }
});
ticketSchema.index({ spot: 1 }, {
  unique: true,
  partialFilterExpression: { status: 'OPEN' }
});

const paymentSchema = new Schema({
  ticket: { type: Schema.Types.ObjectId, ref: 'ParkingTicket', required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, enum: ['CASH', 'CARD', 'UPI'], required: true },
  status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED'], required: true },
  providerReference: { type: String, default: null }
}, { timestamps: true });

const archiveSchema = new Schema({
  sourceTicketId: { type: Schema.Types.ObjectId, required: true, unique: true },
  ticket: { type: Schema.Types.Mixed, required: true },
  payments: { type: [Schema.Types.Mixed], default: [] },
  archivedAt: { type: Date, required: true, default: Date.now }
}, { timestamps: true });

const ratePlanSchema = new Schema({
  lot: { type: Schema.Types.ObjectId, ref: 'ParkingLot', required: true, unique: true },
  currency: { type: String, default: 'INR', uppercase: true, minlength: 3, maxlength: 3 },
  hourlyRate: { type: Number, required: true, min: 0, default: 20 },
  dailyRate: { type: Number, required: true, min: 0, default: 100 },
  weeklyRate: { type: Number, required: true, min: 0, default: 500 },
  monthlyRate: { type: Number, required: true, min: 0, default: 1500 },
  vipHourlyRate: { type: Number, required: true, min: 0, default: 10 },
  peakMultiplier: { type: Number, min: 0, default: 1.25 },
  weekendMultiplier: { type: Number, min: 0, default: 1.1 },
  peakStartHour: { type: Number, min: 0, max: 23, default: 17 },
  peakEndHour: { type: Number, min: 1, max: 24, default: 20 }
}, { timestamps: true });

export const User = model('User', userSchema);
export const ParkingLot = model('ParkingLot', lotSchema);
export const ParkingGate = model('ParkingGate', gateSchema);
export const ParkingDisplay = model('ParkingDisplay', displaySchema);
export const ParkingFloor = model('ParkingFloor', floorSchema);
export const ParkingSpot = model('ParkingSpot', spotSchema);
export const Vehicle = model('Vehicle', vehicleSchema);
export const VehiclePass = model('VehiclePass', passSchema);
export const ParkingTicket = model('ParkingTicket', ticketSchema);
export const Payment = model('Payment', paymentSchema);
export const ParkingArchive = model('ParkingArchive', archiveSchema);
export const RatePlan = model('RatePlan', ratePlanSchema);
