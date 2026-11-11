import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import {
  DashboardData,
  ParkingFloor,
  ParkingTicket,
  Payment,
  RatePlan,
  User,
  VehiclePass,
  VehicleType
} from '../core/models';

type ViewName = 'overview' | 'floors' | 'entry' | 'tickets' | 'rates' | 'passes' | 'payments' | 'settings';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  user: User | null = this.auth.currentUser;
  data: DashboardData | null = null;
  floors: ParkingFloor[] = [];
  tickets: ParkingTicket[] = [];
  payments: Payment[] = [];
  passes: VehiclePass[] = [];
  view: ViewName = 'overview';
  rates: RatePlan = {
    currency: 'INR',
    hourlyRate: 20,
    dailyRate: 100,
    weeklyRate: 500,
    monthlyRate: 1500,
    vipHourlyRate: 10,
    peakMultiplier: 1.25,
    weekendMultiplier: 1.1,
    peakStartHour: 17,
    peakEndHour: 20
  };
  registrationNumber = '';
  vehicleType: VehicleType = 'FOUR_WHEELER';
  vehicleColor = '';
  vehicleMake = '';
  vehicleModel = '';
  paymentMethod: 'CASH' | 'CARD' | 'UPI' = 'CASH';
  selectedTicket: ParkingTicket | null = null;
  printedTicket: ParkingTicket | null = null;
  passRegistration = '';
  passType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'VIP' = 'MONTHLY';
  passStartsAt = this.localDateTime(new Date());
  passExpiresAt = this.localDateTime(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  floorNumber = '';
  spotFloorId = '';
  spotNumber = '';
  spotSize: 'SMALL' | 'COMPACT' | 'MEDIUM' | 'BIG' = 'SMALL';
  lotName = '';
  lotAddress = '';
  timeZone = '';
  staffName = '';
  staffEmail = '';
  staffPassword = '';
  staffRole: 'ADMIN' | 'OPERATOR' = 'OPERATOR';
  message = '';
  error = '';
  busy = false;

  readonly vehicleTypes: { value: VehicleType; label: string }[] = [
    { value: 'TWO_WHEELER', label: 'Two-wheeler' },
    { value: 'THREE_WHEELER', label: 'Three-wheeler' },
    { value: 'FOUR_WHEELER', label: 'Four-wheeler' },
    { value: 'SIX_WHEELER', label: 'Six-wheeler' },
    { value: 'EIGHT_WHEELER', label: 'Eight-wheeler' }
  ];
  readonly viewNames: { value: ViewName; label: string; icon: string }[] = [
    { value: 'overview', label: 'Overview', icon: '⌂' },
    { value: 'floors', label: 'Floor displays', icon: '▦' },
    { value: 'entry', label: 'Vehicle entry', icon: '＋' },
    { value: 'tickets', label: 'Tickets', icon: '▤' },
    { value: 'passes', label: 'Vehicle passes', icon: '◇' },
    { value: 'payments', label: 'Payments', icon: '＄' },
    { value: 'rates', label: 'Rates', icon: '％' },
    { value: 'settings', label: 'Lot settings', icon: '⚙' }
  ];

  get isAdmin(): boolean {
    return this.user?.role === 'ADMIN';
  }

  saveLotDetails(): void {
    this.runAction(this.api.updateLot({
      name: this.lotName,
      address: this.lotAddress,
      timeZone: this.timeZone
    }), ({ lot }) => {
      if (this.data) this.data = { ...this.data, lot };
      this.message = 'Lot details saved.';
      this.refresh();
    });
  }

  get visibleViews(): typeof this.viewNames {
    return this.isAdmin ? this.viewNames : this.viewNames.filter(({ value }) => value !== 'rates' && value !== 'settings');
  }

  get currentViewTitle(): string {
    return this.viewNames.find(({ value }) => value === this.view)?.label ?? 'Overview';
  }

  get firstName(): string {
    return this.user?.name.split(' ')[0] ?? '';
  }

  get openTickets(): ParkingTicket[] {
    return this.tickets.filter((ticket) => ticket.status === 'OPEN');
  }

  availableCount(floor: ParkingFloor): number {
    return floor.spots.filter((spot) => spot.state === 'AVAILABLE').length;
  }

  occupiedCount(floor: ParkingFloor): number {
    return floor.spots.filter((spot) => spot.state === 'OCCUPIED').length;
  }

  maintenanceCount(floor: ParkingFloor): number {
    return floor.spots.filter((spot) => spot.state === 'MAINTENANCE').length;
  }

  isPassCurrent(pass: VehiclePass): boolean {
    return pass.isActive && new Date(pass.expiresAt).getTime() > Date.now();
  }

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.error = '';
    this.api.dashboard().subscribe({
      next: (data) => {
        this.data = data;
        this.lotName = data.lot.name;
        this.lotAddress = data.lot.address;
        this.timeZone = data.lot.timeZone;
      },
      error: (error) => this.showError(error)
    });
    this.api.floors().subscribe({
      next: ({ floors }) => {
        this.floors = floors;
        if (!this.spotFloorId && floors.length) this.spotFloorId = floors[0].id;
      },
      error: (error) => this.showError(error)
    });
    this.api.tickets().subscribe({ next: ({ tickets }) => this.tickets = tickets, error: (error) => this.showError(error) });
    this.api.payments().subscribe({ next: ({ payments }) => this.payments = payments, error: (error) => this.showError(error) });
    this.api.passes().subscribe({ next: ({ passes }) => this.passes = passes, error: (error) => this.showError(error) });
    this.api.rates().subscribe({ next: ({ ratePlan }) => this.rates = ratePlan, error: (error) => this.showError(error) });
  }

  setView(view: ViewName): void {
    this.view = view;
    this.message = '';
    this.error = '';
  }

  signOut(): void {
    this.auth.signOut();
    void this.router.navigate(['/login']);
  }

  enterVehicle(): void {
    this.runAction(this.api.enter({
      registrationNumber: this.registrationNumber,
      vehicleType: this.vehicleType,
      color: this.vehicleColor,
      make: this.vehicleMake,
      model: this.vehicleModel
    }), ({ ticket }) => {
      this.registrationNumber = '';
      this.vehicleColor = '';
      this.vehicleMake = '';
      this.vehicleModel = '';
      this.printedTicket = ticket;
      this.message = 'Vehicle checked in and spot assigned.';
      this.refresh();
    });
  }

  checkout(): void {
    if (!this.selectedTicket) return;
    const selectedTicket = this.selectedTicket;
    const ticketId = selectedTicket._id || selectedTicket.id;
    if (!ticketId) {
      this.error = 'Ticket identifier is missing. Refresh the ticket list and try again.';
      return;
    }
    this.runAction(this.api.exit(ticketId, this.paymentMethod), ({ ticket }) => {
      this.message = `Checkout complete. Amount paid: ${this.formatMoney(ticket.amountDue)}.`;
      this.printedTicket = {
        ...selectedTicket,
        ...ticket,
        _id: selectedTicket._id,
        status: 'CLOSED'
      };
      this.selectedTicket = null;
      this.refresh();
    });
  }

  saveRates(): void {
    this.runAction(this.api.saveRates(this.rates), ({ ratePlan }) => {
      this.rates = ratePlan;
      this.message = 'Rate plan saved.';
    });
  }

  toggleLot(key: 'isOpen' | 'underMaintenance', value: boolean): void {
    if (!this.data) return;
    const next = { isOpen: this.data.lot.isOpen, underMaintenance: this.data.lot.underMaintenance, [key]: value };
    this.runAction(this.api.toggleLot(next), ({ lot }) => {
      this.data = { ...this.data!, lot };
      this.message = 'Lot status updated.';
      this.refresh();
    });
  }

  toggleFloor(floor: ParkingFloor): void {
    this.runAction(this.api.toggleFloorMaintenance(floor.id, !floor.underMaintenance), () => {
      this.message = `Floor ${floor.floorNumber} maintenance status updated.`;
      this.refresh();
    });
  }

  toggleSpot(floor: ParkingFloor, spotId: string, currentlyUnderMaintenance: boolean): void {
    this.runAction(this.api.toggleSpotMaintenance(spotId, !currentlyUnderMaintenance), () => {
      this.message = `Floor ${floor.floorNumber} spot maintenance status updated.`;
      this.refresh();
    });
  }

  addFloor(): void {
    this.runAction(this.api.createFloor(this.floorNumber), () => {
      this.floorNumber = '';
      this.message = 'Floor added.';
      this.refresh();
    });
  }

  addSpot(): void {
    this.runAction(this.api.createSpot({
      floorId: this.spotFloorId,
      spotNumber: this.spotNumber,
      size: this.spotSize
    }), () => {
      this.spotNumber = '';
      this.message = 'Spot added.';
      this.refresh();
    });
  }

  addPass(): void {
    this.runAction(this.api.createPass({
      registrationNumber: this.passRegistration,
      passType: this.passType,
      startsAt: new Date(this.passStartsAt).toISOString(),
      expiresAt: new Date(this.passExpiresAt).toISOString()
    }), () => {
      this.passRegistration = '';
      this.message = 'Vehicle pass issued.';
      this.refresh();
    });
  }

  addStaff(): void {
    this.runAction(this.api.createUser({
      name: this.staffName,
      email: this.staffEmail,
      password: this.staffPassword,
      role: this.staffRole
    }), () => {
      this.staffName = '';
      this.staffEmail = '';
      this.staffPassword = '';
      this.message = 'Staff account created.';
    });
  }

  printReceipt(ticket: ParkingTicket): void {
    this.printedTicket = ticket;
    window.print();
  }

  printCurrentTicket(): void {
    if (this.printedTicket) this.printReceipt(this.printedTicket);
  }

  formatMoney(amount: number | null): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: this.rates.currency || 'INR',
      maximumFractionDigits: 2
    }).format(amount ?? 0);
  }

  private runAction<T>(request: import('rxjs').Observable<T>, onSuccess: (value: T) => void): void {
    this.error = '';
    this.message = '';
    this.busy = true;
    request.subscribe({
      next: onSuccess,
      error: (error: HttpErrorResponse) => this.showError(error),
      complete: () => this.busy = false
    });
  }

  private showError(error: HttpErrorResponse): void {
    this.error = error.error?.message ?? 'Something went wrong. Please try again.';
    this.busy = false;
  }

  private localDateTime(date: Date): string {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 16);
  }
}
