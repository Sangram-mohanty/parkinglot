# Parking Lot Management

An Angular and Express application for operating a multi-floor parking lot. It includes a MongoDB API, JWT sign-in, role-based access, automatic spot assignment, ticket entry and checkout, maintenance controls, passes, rates, payment records, and live availability summaries.

## Requirements

- Node.js 20.19+, 22.12+, or 24+
- MongoDB 7+ locally, in Docker, or through MongoDB Atlas

## Run locally (Windows PowerShell)

1. Start MongoDB. For a local MongoDB installation, make sure the service is running. If Docker is available, `docker compose up -d mongo` starts a local database.
2. Copy `server\.env.example` to `server\.env`. Set a private random `JWT_SECRET` of at least 32 characters and a strong `ADMIN_PASSWORD` of at least 12 characters. Configure `MONGODB_URI`, `ADMIN_EMAIL`, and `LOT_TIME_ZONE` as needed.
3. From the repository root, install packages and initialize the demo lot:

   ```powershell
   npm install
   npm run setup
   ```

   Setup creates the administrator if it does not exist, a 500-spot lot across 10 floors, and a default rate plan. Re-running it does not add duplicate floors or spots.
4. Start the API and Angular development server:

   ```powershell
   npm run dev
   ```

5. Open `http://localhost:4200` and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `server\.env`. The API health check is at `http://localhost:3000/api/health`.

The sample rate plan uses INR demo values (hourly 20, daily 100, weekly 500, monthly 1500, VIP hourly 10). Update the rates, lot address, time zone, currency, peak period, and multipliers in the admin screens before using the system operationally.

## Roles and workflow

- **Admin:** configure lot status, rates, floors and spots; manage spot/floor maintenance; create operator/admin accounts; issue vehicle passes.
- **Operator:** view the dashboard and floor displays; record vehicle entry and checkout; select CASH, CARD, or UPI; view tickets and payment history.
- **Signup:** public registration creates an Operator account only. New accounts cannot create or promote themselves to Admin; admin accounts must be created by an existing administrator or the setup command.
- Entry records the vehicle, assigns the smallest compatible available spot, and creates a ticket. The printed ticket view can be used as a physical ticket.
- Checkout records a payment attempt, calculates the charge using the lot time zone and peak/weekend adjustments, closes the ticket, and releases the spot. A valid daily/weekly/monthly pass covers parking; VIP passes use the VIP hourly rate.

Vehicle-to-spot sizing is centralized in `server/src/domain.js`: two-wheelers use SMALL or larger spots, three-wheelers COMPACT or larger, four-wheelers MEDIUM or BIG, and six/eight-wheelers BIG. Billing rounds partial hours up, applies peak/weekend multipliers in the lot time zone, and selects hourly charges or 24-hour, 7-day, and 30-day bundles.

## API outline

All endpoints other than health and login require `Authorization: Bearer <token>`:

- `POST /api/auth/login`, `POST /api/auth/signup`, `GET /api/auth/me`
- `GET /api/dashboard`, `GET /api/lot`, `PATCH /api/lot`, `GET /api/displays`
- `GET /api/floors`, `POST /api/floors`, `PATCH /api/floors/:id/maintenance`
- `POST /api/spots`, `PATCH /api/spots/:id/maintenance`
- `GET /api/tickets`, `POST /api/tickets/entry`, `POST /api/tickets/:id/exit`
- `GET /api/payments`, `GET /api/rates`, `PUT /api/rates`
- `GET /api/passes`, `POST /api/passes`, `POST /api/users` (admin only)

## Production integrations and operations

Payment methods currently record a successful local/demo payment; no card processor or UPI provider is connected. Registration numbers are entered and confirmed manually; camera/OCR and retry/review workflows need a hardware/provider integration. Closed tickets and payment attempts are moved to the `parking_archives` collection after 30 days; open sessions are never archived. Archive records are retained until your organization applies its legal/receipt-retention policy. Configure actual rates, payment failure handling, archive retention, and backup/restore procedures before go-live.
