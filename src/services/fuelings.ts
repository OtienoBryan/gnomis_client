// Shared helpers for vehicle fueling records (vehicle_fuelings)

export interface Fueling {
  id: number;
  vehicle_id: number;
  driver_id: number;
  step: number;
  status: string;
  gauge_before_photo: string | null;
  pump_photo: string | null;
  pump_at: string | null;
  odo_reading: number | null;
  odo_photo: string | null;
  gauge_after_photo: string | null;
  after_at: string | null;
  price_per_litre: string | number | null;
  litres: string | number | null;
  total_cost: string | number | null;
  completed_at: string | null;
  created_at: string;
  registration_number: string | null;
  vehicle_model: string | null;
  driver_name: string | null;
  prev_odo_reading: number | null;
}

// Local-time YYYY-MM-DD (toISOString would shift the day in UTC+3)
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const num = (v: string | number | null | undefined) => (v == null || v === '' ? null : Number(v));
export const money = (v: string | number | null | undefined) =>
  num(v) == null ? '—' : num(v)!.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtDateTime = (v: string | null) => (v ? v.replace('T', ' ').slice(0, 16) : '—');

// Km driven since this vehicle's previous fueling (odometer now minus odometer at the previous fueling).
// Null for a vehicle's first fueling, since there is nothing to compare with.
export const distance = (f: Fueling) =>
  f.odo_reading != null && f.prev_odo_reading != null ? f.odo_reading - f.prev_odo_reading : null;

// km per litre: distance since the last fueling divided by the litres put in now
export const efficiency = (f: Fueling) => {
  const d = distance(f);
  const l = num(f.litres);
  return d != null && d > 0 && l && l > 0 ? d / l : null;
};

export const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  in_progress: 'bg-amber-100 text-amber-700',
};
export const statusLabel = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

// The four photos a driver takes, in the order of the fueling steps
export const photoList = (f: Fueling) => [
  { label: 'Fuel gauge (before)', url: f.gauge_before_photo, at: f.created_at },
  { label: 'Pump', url: f.pump_photo, at: f.pump_at },
  { label: 'Odometer', url: f.odo_photo, at: f.after_at },
  { label: 'Fuel gauge (after)', url: f.gauge_after_photo, at: f.after_at },
];

// The server supplies each row's previous odometer reading. If it doesn't (older server still running),
// fall back to the previous fueling of the same vehicle among the rows given.
export const withPreviousOdo = (data: Fueling[]): Fueling[] => {
  const ordered = [...data].sort((a, b) => a.id - b.id);
  const lastOdo = new Map<number, number>();
  const prevById = new Map<number, number | null>();
  for (const r of ordered) {
    prevById.set(r.id, lastOdo.get(r.vehicle_id) ?? null);
    if (r.odo_reading != null) lastOdo.set(r.vehicle_id, r.odo_reading);
  }
  return data.map((r) => ({
    ...r,
    prev_odo_reading: r.prev_odo_reading !== undefined ? r.prev_odo_reading : prevById.get(r.id) ?? null,
  }));
};
