import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  DashboardData,
  Lot,
  ParkingFloor,
  ParkingTicket,
  Payment,
  RatePlan,
  User,
  VehiclePass
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  dashboard() {
    return this.http.get<DashboardData>('/api/dashboard');
  }

  floors() {
    return this.http.get<{ floors: ParkingFloor[] }>('/api/floors');
  }

  tickets(status?: 'OPEN' | 'CLOSED') {
    const query = status ? `?status=${status}` : '';
    return this.http.get<{ tickets: ParkingTicket[] }>(`/api/tickets${query}`);
  }

  enter(input: {
    registrationNumber: string;
    vehicleType: string;
    color?: string;
    make?: string;
    model?: string;
  }) {
    return this.http.post<{ ticket: ParkingTicket }>('/api/tickets/entry', input);
  }

  exit(ticketId: string, method: 'CASH' | 'CARD' | 'UPI') {
    return this.http.post<{ ticket: { amountDue: number; exitAt: string } }>(
      `/api/tickets/${ticketId}/exit`,
      { method }
    );
  }

  rates() {
    return this.http.get<{ ratePlan: RatePlan }>('/api/rates');
  }

  saveRates(ratePlan: RatePlan) {
    const {
      currency,
      hourlyRate,
      dailyRate,
      weeklyRate,
      monthlyRate,
      vipHourlyRate,
      peakMultiplier,
      weekendMultiplier,
      peakStartHour,
      peakEndHour
    } = ratePlan;
    return this.http.put<{ ratePlan: RatePlan }>('/api/rates', {
      currency,
      hourlyRate,
      dailyRate,
      weeklyRate,
      monthlyRate,
      vipHourlyRate,
      peakMultiplier,
      weekendMultiplier,
      peakStartHour,
      peakEndHour
    });
  }

  payments() {
    return this.http.get<{ payments: Payment[] }>('/api/payments');
  }

  passes() {
    return this.http.get<{ passes: VehiclePass[] }>('/api/passes');
  }

  createPass(input: { registrationNumber: string; passType: string; startsAt: string; expiresAt: string }) {
    return this.http.post('/api/passes', input);
  }

  toggleLot(input: Pick<Lot, 'isOpen' | 'underMaintenance'>) {
    return this.http.patch<{ lot: Lot }>('/api/lot', input);
  }

  updateLot(input: Pick<Lot, 'name' | 'address' | 'timeZone'>) {
    return this.http.patch<{ lot: Lot }>('/api/lot', input);
  }

  createFloor(floorNumber: string) {
    return this.http.post('/api/floors', { floorNumber });
  }

  toggleFloorMaintenance(id: string, underMaintenance: boolean) {
    return this.http.patch(`/api/floors/${id}/maintenance`, { underMaintenance });
  }

  createSpot(input: { floorId: string; spotNumber: string; size: string }) {
    return this.http.post('/api/spots', input);
  }

  toggleSpotMaintenance(id: string, underMaintenance: boolean) {
    return this.http.patch(`/api/spots/${id}/maintenance`, { underMaintenance });
  }

  createUser(input: { name: string; email: string; password: string; role: string }) {
    return this.http.post<{ user: User }>('/api/users', input);
  }
}
