export const vehicleTypes = [
  'TWO_WHEELER',
  'THREE_WHEELER',
  'FOUR_WHEELER',
  'SIX_WHEELER',
  'EIGHT_WHEELER'
];

const spotRank = { SMALL: 0, COMPACT: 1, MEDIUM: 2, BIG: 3 };
const minimumSpot = {
  TWO_WHEELER: 'SMALL',
  THREE_WHEELER: 'COMPACT',
  FOUR_WHEELER: 'MEDIUM',
  SIX_WHEELER: 'BIG',
  EIGHT_WHEELER: 'BIG'
};

export function compatibleSpotSizes(vehicleType) {
  const minimum = minimumSpot[vehicleType];
  if (!minimum) return [];
  return Object.keys(spotRank).filter((size) => spotRank[size] >= spotRank[minimum]);
}

function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function calculateCharge({ entryAt, exitAt, ratePlan, timeZone, passType = null }) {
  if (passType && passType !== 'VIP') return 0;
  const hourlyRate = passType === 'VIP' ? ratePlan.vipHourlyRate : ratePlan.hourlyRate;
  const elapsedHours = Math.max(1, Math.ceil((exitAt.getTime() - entryAt.getTime()) / 3_600_000));
  const hourlyCharges = [];
  for (let hour = 0; hour < elapsedHours; hour += 1) {
    const instant = new Date(entryAt.getTime() + hour * 3_600_000);
    const local = localParts(instant, timeZone);
    let multiplier = 1;
    if (local.weekday === 'Sat' || local.weekday === 'Sun') multiplier *= ratePlan.weekendMultiplier;
    const localHour = Number(local.hour);
    if (ratePlan.peakStartHour < ratePlan.peakEndHour
      ? localHour >= ratePlan.peakStartHour && localHour < ratePlan.peakEndHour
      : localHour >= ratePlan.peakStartHour || localHour < ratePlan.peakEndHour) {
      multiplier *= ratePlan.peakMultiplier;
    }
    hourlyCharges.push(hourlyRate * multiplier);
  }

  if (passType === 'VIP') return roundMoney(sum(hourlyCharges));
  const bundles = [
    [30 * 24, ratePlan.monthlyRate],
    [7 * 24, ratePlan.weeklyRate],
    [24, ratePlan.dailyRate]
  ];
  const prefix = [0];
  for (const charge of hourlyCharges) prefix.push(prefix[prefix.length - 1] + charge);
  const best = Array(elapsedHours + 1).fill(Number.POSITIVE_INFINITY);
  best[0] = 0;
  for (let hours = 1; hours <= elapsedHours; hours += 1) {
    best[hours] = best[hours - 1] + hourlyCharges[hours - 1];
    for (const [bundleHours, bundlePrice] of bundles) {
      if (hours < bundleHours) continue;
      const hourlyTotal = prefix[hours] - prefix[hours - bundleHours];
      const averageMultiplier = hourlyRate > 0 ? hourlyTotal / (hourlyRate * bundleHours) : 1;
      const bundleTotal = Math.min(hourlyTotal, bundlePrice * averageMultiplier);
      best[hours] = Math.min(best[hours], best[hours - bundleHours] + bundleTotal);
    }
  }
  return roundMoney(best[elapsedHours]);
}

export function getSpotState({ spot, floor, lot }) {
  if (lot.underMaintenance || floor.underMaintenance || spot.underMaintenance) return 'MAINTENANCE';
  return spot.activeTicket ? 'OCCUPIED' : 'AVAILABLE';
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}
