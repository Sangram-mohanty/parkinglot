# Parking Lot: Build-from-Scratch Note

Use this as a quick reference when starting a fresh parking-lot design. It captures the current requirements and a relational database layout; it is a starting schema, not a migration.

## Requirements at a glance

| Area | Requirement |
|---|---|
| Floors and capacity | Multiple floors; total capacity is 500 spots |
| Gates | One entry gate and one exit gate |
| Parking | Automatically assign a compatible, available spot |
| Vehicles | Two-, three-, four-, six-, and eight-wheelers |
| Spot maintenance | A spot, floor, or whole lot can be under maintenance |
| Billing | Hourly, weekly, monthly, and VIP rates; allow peak and weekend adjustments |
| Payments | Support multiple payment methods and retain payment attempts |
| Entry | Read the vehicle registration number automatically; issue a physical ticket |
| Displays | Show availability/status at the main gate and on floors |
| Operating hours | Open 24/7 |
| Exclusions | No EV, reservations, valet, attendants, analytics, or disability/reserved parking |
| Data retention | Keep operational data for one month, then archive or delete according to policy |

## Tables

Types below use PostgreSQL-style SQL. `PK` means primary key; `FK` means foreign key. Use a consistent time zone (preferably UTC in storage); use the lot's configured time zone when applying peak/weekend pricing.

| Table | Columns and constraints | Purpose |
|---|---|---|
| `parking_lot` | `lot_id` PK, `name`, `address`, `capacity` (default 500), `time_zone`, `is_open`, `under_maintenance` | Lot identity, operating state, and capacity |
| `parking_floor` | `floor_id` PK, `lot_id` FK, `floor_number`, `under_maintenance`; unique (`lot_id`, `floor_number`) | Floors belonging to a lot |
| `parking_spot` | `spot_id` PK, `floor_id` FK, `spot_number`, `size`, `under_maintenance`; unique (`floor_id`, `spot_number`) | Physical spots; availability comes from no active ticket |
| `vehicle` | `registration_number` PK, `vehicle_type`, `color`, `make`, `model` | Vehicle details read/confirmed at entry |
| `vehicle_pass` | `pass_id` PK, `registration_number` FK, `pass_type`, `starts_at`, `expires_at`, `is_active` | Time-bounded daily, weekly, monthly, or VIP pass |
| `parking_ticket` | `ticket_id` PK, `registration_number` FK, `spot_id` FK, `pass_id` FK nullable, `entry_at`, `exit_at` nullable, `amount_due` nullable, `status` | Physical ticket record and the vehicle's current/previous parking session |
| `payment` | `payment_id` PK, `ticket_id` FK, `amount`, `method`, `status`, `provider_reference` nullable, `created_at` | Payment attempt/history; keep failed attempts too |
| `parking_gate` | `gate_id` PK, `lot_id` FK, `gate_type`; unique (`lot_id`, `gate_type`) | One `ENTRY` and one `EXIT` gate per lot |
| `display` | `display_id` PK, `lot_id` FK, `floor_id` FK nullable, `gate_id` FK nullable, `display_type`, `is_active` | Main-gate or floor availability display |
| `rate_plan` | `rate_plan_id` PK, `lot_id` FK unique, hourly/daily/weekly/monthly/VIP rates, peak/weekend multipliers, peak start/end hour | Configurable billing; avoids hard-coding prices in checkout |

## Starter DDL

```sql
CREATE TABLE parking_lot (
  lot_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  address VARCHAR(300) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 500 CHECK (capacity > 0),
  time_zone VARCHAR(60) NOT NULL DEFAULT 'UTC',
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  under_maintenance BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE parking_floor (
  floor_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lot_id BIGINT NOT NULL REFERENCES parking_lot(lot_id),
  floor_number VARCHAR(20) NOT NULL,
  under_maintenance BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (lot_id, floor_number)
);

CREATE TABLE parking_spot (
  spot_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  floor_id BIGINT NOT NULL REFERENCES parking_floor(floor_id),
  spot_number VARCHAR(30) NOT NULL,
  size VARCHAR(10) NOT NULL CHECK (size IN ('SMALL', 'COMPACT', 'MEDIUM', 'BIG')),
  under_maintenance BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (floor_id, spot_number)
);

CREATE TABLE vehicle (
  registration_number VARCHAR(30) PRIMARY KEY,
  vehicle_type VARCHAR(20) NOT NULL CHECK (
    vehicle_type IN ('TWO_WHEELER', 'THREE_WHEELER', 'FOUR_WHEELER', 'SIX_WHEELER', 'EIGHT_WHEELER')
  ),
  color VARCHAR(40),
  make VARCHAR(60),
  model VARCHAR(60)
);

CREATE TABLE vehicle_pass (
  pass_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  registration_number VARCHAR(30) NOT NULL REFERENCES vehicle(registration_number),
  pass_type VARCHAR(10) NOT NULL CHECK (pass_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'VIP')),
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (expires_at > starts_at)
);

CREATE TABLE parking_ticket (
  ticket_id VARCHAR(80) PRIMARY KEY,
  registration_number VARCHAR(30) NOT NULL REFERENCES vehicle(registration_number),
  spot_id BIGINT NOT NULL REFERENCES parking_spot(spot_id),
  pass_id BIGINT REFERENCES vehicle_pass(pass_id),
  entry_at TIMESTAMPTZ NOT NULL,
  exit_at TIMESTAMPTZ,
  amount_due NUMERIC(10, 2),
  status VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  CHECK (amount_due IS NULL OR amount_due >= 0),
  CHECK (exit_at IS NULL OR exit_at >= entry_at),
  CHECK ((status = 'OPEN' AND exit_at IS NULL) OR (status = 'CLOSED' AND exit_at IS NOT NULL))
);

CREATE TABLE payment (
  payment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id VARCHAR(80) NOT NULL REFERENCES parking_ticket(ticket_id),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  method VARCHAR(10) NOT NULL CHECK (method IN ('CASH', 'CARD', 'UPI')),
  status VARCHAR(10) NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
  provider_reference VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE parking_gate (
  gate_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lot_id BIGINT NOT NULL REFERENCES parking_lot(lot_id),
  gate_type VARCHAR(5) NOT NULL CHECK (gate_type IN ('ENTRY', 'EXIT')),
  UNIQUE (lot_id, gate_type)
);

CREATE TABLE display (
  display_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lot_id BIGINT NOT NULL REFERENCES parking_lot(lot_id),
  floor_id BIGINT REFERENCES parking_floor(floor_id),
  gate_id BIGINT REFERENCES parking_gate(gate_id),
  display_type VARCHAR(10) NOT NULL CHECK (display_type IN ('MAIN_GATE', 'FLOOR')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (
    (display_type = 'MAIN_GATE' AND gate_id IS NOT NULL AND floor_id IS NULL) OR
    (display_type = 'FLOOR' AND floor_id IS NOT NULL AND gate_id IS NULL)
  )
);

CREATE TABLE rate_plan (
  rate_plan_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lot_id BIGINT NOT NULL UNIQUE REFERENCES parking_lot(lot_id),
  hourly_rate NUMERIC(10, 2) NOT NULL CHECK (hourly_rate >= 0),
  daily_rate NUMERIC(10, 2) NOT NULL CHECK (daily_rate >= 0),
  weekly_rate NUMERIC(10, 2) NOT NULL CHECK (weekly_rate >= 0),
  monthly_rate NUMERIC(10, 2) NOT NULL CHECK (monthly_rate >= 0),
  vip_hourly_rate NUMERIC(10, 2) NOT NULL CHECK (vip_hourly_rate >= 0),
  peak_multiplier NUMERIC(6, 3) NOT NULL DEFAULT 1 CHECK (peak_multiplier >= 0),
  weekend_multiplier NUMERIC(6, 3) NOT NULL DEFAULT 1 CHECK (weekend_multiplier >= 0),
  peak_start_hour SMALLINT NOT NULL DEFAULT 17 CHECK (peak_start_hour BETWEEN 0 AND 23),
  peak_end_hour SMALLINT NOT NULL DEFAULT 20 CHECK (peak_end_hour BETWEEN 1 AND 24),
  CHECK (peak_end_hour > peak_start_hour)
);

CREATE UNIQUE INDEX one_open_ticket_per_spot
  ON parking_ticket (spot_id)
  WHERE status = 'OPEN';

CREATE INDEX open_tickets_by_vehicle
  ON parking_ticket (registration_number)
  WHERE status = 'OPEN';

CREATE INDEX payments_by_ticket_and_time
  ON payment (ticket_id, created_at DESC);
```

## Relationships and rules

```text
ParkingLot 1 ── * ParkingFloor 1 ── * ParkingSpot
ParkingLot 1 ── 2 ParkingGate (one ENTRY, one EXIT)
ParkingLot 1 ── * Display; a display belongs to the main gate or a floor
Vehicle 1 ── * ParkingTicket * ── 1 ParkingSpot
Vehicle 1 ── * VehiclePass; ParkingTicket may record the pass used
ParkingTicket 1 ── * Payment (including failed attempts)
ParkingLot 1 ── 1 RatePlan
```

- A spot is available when it is not under maintenance, its floor and lot are operational, and it has no `OPEN` ticket.
- Check the vehicle type against the spot size before creating a ticket. Keep this mapping in one assignment policy.
- Entry flow: read/confirm registration → find a compatible spot → create an `OPEN` ticket → issue the physical ticket → refresh displays.
- Exit flow: calculate the configured charge → record a successful payment → close the ticket and release the spot → refresh displays. A failed payment must leave the ticket open and the spot occupied.
- Calculate peak/weekend rates using the parking lot's time zone. The example DDL provides configurable rates; confirm actual prices and rounding rules before launch.
- Recompute display counts from spots and open tickets, or cache them with a reliable refresh strategy; do not treat display text as the source of truth.
- The registration reader (camera/OCR) and payment provider are integrations, not database tables. Provide a manual review/retry path if registration reading fails.
- Enforce the one-month retention requirement with a scheduled archive/deletion policy. Keep only the data needed for operations, receipts, and legal requirements.

## Design checklist

- [ ] Confirm currency, actual rates, pass rules, peak hours, weekend definition, and rounding policy.
- [ ] Confirm which vehicle types fit each spot size and how oversized vehicles use multiple spots, if at all.
- [ ] Keep spot assignment, pricing, payment gateway, registration reading, and displays replaceable behind interfaces.
- [ ] Make entry and payment operations safe to retry; prevent duplicate open tickets or duplicate successful charges.
- [ ] Keep the configured capacity consistent with the number of usable spots across floors.
