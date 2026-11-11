import { ParkingArchive, ParkingTicket, Payment } from './models.js';

const retentionMs = 30 * 24 * 60 * 60 * 1000;
const batchSize = 100;

export async function archiveExpiredTickets(now = new Date()) {
  const cutoff = new Date(now.getTime() - retentionMs);
  let archivedCount = 0;

  while (archivedCount < 1000) {
    const tickets = await ParkingTicket.find({
      status: 'CLOSED',
      exitAt: { $lt: cutoff }
    })
      .sort({ exitAt: 1 })
      .limit(batchSize)
      .populate('vehicle')
      .populate({ path: 'spot', populate: { path: 'floor' } })
      .populate('pass')
      .lean();
    if (!tickets.length) break;

    for (const ticket of tickets) {
      const payments = await Payment.find({ ticket: ticket._id }).lean();
      await ParkingArchive.updateOne(
        { sourceTicketId: ticket._id },
        { $setOnInsert: { ticket, payments, archivedAt: now } },
        { upsert: true }
      );
      await Payment.deleteMany({ ticket: ticket._id });
      await ParkingTicket.deleteOne({ _id: ticket._id, status: 'CLOSED' });
      archivedCount += 1;
    }

    if (tickets.length < batchSize) break;
  }

  return archivedCount;
}
