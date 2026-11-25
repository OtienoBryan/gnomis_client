import { API_CONFIG } from '../config/api';
import { VEHICLE_MODELS } from '../constants/vehicleModels';

export interface VehicleModel {
  id: number;
  name: string;
  consumption: number | null;
  vehicle_count: number;
}

export const authHeaders = (json = false): HeadersInit => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

export const vehicleRequest = async (path: string, init?: RequestInit) => {
  const res = await fetch(API_CONFIG.getUrl(path), init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

// Models managed on the Vehicles page. Throws if the request fails.
export const fetchVehicleModelsStrict = async (): Promise<VehicleModel[]> => {
  const body = await vehicleRequest('/vehicles/models', { headers: authHeaders() });
  return (body.data || []).map((m: any) => ({
    ...m,
    consumption: m.consumption != null ? Number(m.consumption) : null,
  }));
};

// Same, but falls back to the built-in list (with placeholder ids) if the request fails,
// so a vehicle can still be added. Never use these placeholder rows for editing.
export const fetchVehicleModels = async (): Promise<VehicleModel[]> => {
  try {
    return await fetchVehicleModelsStrict();
  } catch {
    return VEHICLE_MODELS.map((name, i) => ({ id: -(i + 1), name, consumption: null, vehicle_count: 0 }));
  }
};
