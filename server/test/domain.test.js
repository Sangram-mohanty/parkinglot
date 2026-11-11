import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCharge, compatibleSpotSizes, getSpotState } from '../src/domain.js';

test('spot policy assigns the smallest compatible spot first', () => {
  assert.deepEqual(compatibleSpotSizes('TWO_WHEELER'), ['SMALL', 'COMPACT', 'MEDIUM', 'BIG']);
  assert.deepEqual(compatibleSpotSizes('FOUR_WHEELER'), ['MEDIUM', 'BIG']);
  assert.deepEqual(compatibleSpotSizes('EIGHT_WHEELER'), ['BIG']);
});

test('spot state incorporates lot, floor, and spot maintenance', () => {
  assert.equal(getSpotState({
    spot: { activeTicket: null, underMaintenance: false },
    floor: { underMaintenance: false },
    lot: { underMaintenance: false }
  }), 'AVAILABLE');
  assert.equal(getSpotState({
    spot: { activeTicket: 'ticket-id', underMaintenance: false },
    floor: { underMaintenance: false },
    lot: { underMaintenance: false }
  }), 'OCCUPIED');
  assert.equal(getSpotState({
    spot: { activeTicket: null, underMaintenance: false },
    floor: { underMaintenance: false },
    lot: { underMaintenance: true }
  }), 'MAINTENANCE');
});

test('charge rounds partial hours up and gives valid passes free parking', () => {
  const ratePlan = {
    hourlyRate: 20,
    dailyRate: 100,
    weeklyRate: 500,
    monthlyRate: 1500,
    peakMultiplier: 1,
    weekendMultiplier: 1,
    peakStartHour: 0,
    peakEndHour: 0
  };
  const entryAt = new Date('2025-01-06T09:00:00.000Z');
  assert.equal(calculateCharge({
    entryAt,
    exitAt: new Date('2025-01-06T10:01:00.000Z'),
    ratePlan,
    timeZone: 'UTC'
  }), 40);
  assert.equal(calculateCharge({
    entryAt,
    exitAt: new Date('2025-01-06T11:00:00.000Z'),
    ratePlan,
    timeZone: 'UTC',
    passType: 'MONTHLY'
  }), 0);
});

test('VIP parking uses its configured hourly rate', () => {
  const ratePlan = {
    hourlyRate: 20,
    dailyRate: 100,
    weeklyRate: 500,
    monthlyRate: 1500,
    vipHourlyRate: 10,
    peakMultiplier: 1,
    weekendMultiplier: 1,
    peakStartHour: 0,
    peakEndHour: 0
  };
  assert.equal(calculateCharge({
    entryAt: new Date('2025-01-06T09:00:00.000Z'),
    exitAt: new Date('2025-01-06T11:00:00.000Z'),
    ratePlan,
    timeZone: 'UTC',
    passType: 'VIP'
  }), 20);
});

test('peak and weekend multipliers use the lot local time zone', () => {
  const ratePlan = {
    hourlyRate: 10,
    dailyRate: 1000,
    weeklyRate: 5000,
    monthlyRate: 15000,
    vipHourlyRate: 5,
    peakMultiplier: 2,
    weekendMultiplier: 1.5,
    peakStartHour: 17,
    peakEndHour: 20
  };
  assert.equal(calculateCharge({
    entryAt: new Date('2025-01-03T16:00:00.000Z'),
    exitAt: new Date('2025-01-04T02:00:00.000Z'),
    ratePlan,
    timeZone: 'UTC'
  }), 140);
});

test('full weekly bundles are cheaper than hourly charges', () => {
  const ratePlan = {
    hourlyRate: 20,
    dailyRate: 100,
    weeklyRate: 500,
    monthlyRate: 1500,
    vipHourlyRate: 10,
    peakMultiplier: 1,
    weekendMultiplier: 1,
    peakStartHour: 0,
    peakEndHour: 0
  };
  assert.equal(calculateCharge({
    entryAt: new Date('2025-01-06T09:00:00.000Z'),
    exitAt: new Date('2025-01-13T09:00:00.000Z'),
    ratePlan,
    timeZone: 'UTC'
  }), 500);
});

test('pricing selects the cheaper bundle instead of blindly using the longest bundle', () => {
  const ratePlan = {
    hourlyRate: 20,
    dailyRate: 100,
    weeklyRate: 500,
    monthlyRate: 10000,
    vipHourlyRate: 10,
    peakMultiplier: 1,
    weekendMultiplier: 1,
    peakStartHour: 0,
    peakEndHour: 0
  };
  assert.equal(calculateCharge({
    entryAt: new Date('2025-01-06T09:00:00.000Z'),
    exitAt: new Date('2025-02-05T09:00:00.000Z'),
    ratePlan,
    timeZone: 'UTC'
  }), 2200);
});
