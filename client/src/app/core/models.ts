export type UserRole = 'ADMIN' | 'OPERATOR';
export type VehicleType = 'TWO_WHEELER' | 'THREE_WHEELER' | 'FOUR_WHEELER' | 'SIX_WHEELER' | 'EIGHT_WHEELER';
export type SpotSize = 'SMALL' | 'COMPACT' | 'MEDIUM' | 'BIG';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Lot {
  id: string;
  name: string;
  address: string;
  capacity: number;
  timeZone: string;
  entryGateName: string;
  exitGateName: string;
  isOpen: boolean;
  underMaintenance: boolean;
}

export interface DashboardData {
  lot: Lot;
  floors: number;
  spots: { available: number; occupied: number; maintenance: number };
  openTickets: number;
  closedTickets: number;
}

export interface ParkingSpot {
  id: string;
  spotNumber: string;
  size: SpotSize;
  underMaintenance: boolean;
  state: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  activeTicket: { registrationNumber: string; vehicleType: VehicleType; entryAt: string } | null;
}

export interface ParkingFloor {
  id: string;
  floorNumber: string;
  underMaintenance: boolean;
  spots: ParkingSpot[];
}

export interface ParkingTicket {
  _id: string;
  id?: string;
  registrationNumber: string;
  vehicleType: VehicleType;
  spot: { spotNumber: string; size: SpotSize; floor?: { floorNumber: string } };
  entryAt: string;
  exitAt: string | null;
  amountDue: number | null;
  status: 'OPEN' | 'CLOSED';
  pass?: { passType: string; expiresAt: string } | null;
}

export interface RatePlan {
  currency: string;
  hourlyRate: number;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  vipHourlyRate: number;
  peakMultiplier: number;
  weekendMultiplier: number;
  peakStartHour: number;
  peakEndHour: number;
}

export interface Payment {
  _id: string;
  amount: number;
  method: 'CASH' | 'CARD' | 'UPI';
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  createdAt: string;
  ticket: { registrationNumber: string; entryAt: string; exitAt: string } | null;
}

export interface VehiclePass {
  _id: string;
  passType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'VIP';
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  vehicle: { registrationNumber: string; vehicleType: VehicleType };
}
