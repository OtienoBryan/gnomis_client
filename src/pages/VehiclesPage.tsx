import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeaders, fetchVehicleModels, fetchVehicleModelsStrict, vehicleRequest as request, type VehicleModel } from '../services/vehicleModels';

interface AssignedDriver {
  id: number;
  name: string;
  contact: string | null;
  assigned_at: string;
}

interface Vehicle {
  id: number;
  registration_number: string;
  model: string;
  consumption: number | null;
  status: number | null;
  created_at: string;
  drivers: AssignedDriver[];
}

interface Driver {
  id: number;
  name: string;
  contact: string | null;
  status: number | null;
  vehicle_id: number | null;
  vehicle_registration_number: string | null;
}

// A vehicle with no status recorded is treated as active
const isActive = (v: Vehicle) => v.status == null || Number(v.status) === 1;

const inputClass =
  'block w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500';

const VehiclesPage: React.FC = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [assignFor, setAssignFor] = useState<Vehicle | null>(null);
  const [editFor, setEditFor] = useState<Vehicle | null>(null);
  const [showModels, setShowModels] = useState(false);
  const [models, setModels] = useState<VehicleModel[]>([]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, d] = await Promise.all([
        request('/vehicles', { headers: authHeaders() }),
        request('/vehicles/drivers', { headers: authHeaders() }),
      ]);
      setVehicles(v.data || []);
      setDrivers(d.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch vehicles');
    } finally {
      setLoading(false);
    }
  };

  const loadModels = () => fetchVehicleModels().then(setModels);

  useEffect(() => {
    fetchAll();
    loadModels();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (statusFilter === 'active' && !isActive(v)) return false;
      if (statusFilter === 'inactive' && isActive(v)) return false;
      if (!q) return true;
      return [v.registration_number, v.model, ...v.drivers.map((d) => d.name)].some((val) =>
        String(val || '').toLowerCase().includes(q)
      );
    });
  }, [vehicles, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const stats = useMemo(
    () => ({
      total: vehicles.length,
      active: vehicles.filter(isActive).length,
      withoutDriver: vehicles.filter((v) => v.drivers.length === 0).length,
      unassignedDrivers: drivers.filter((d) => !d.vehicle_id).length,
    }),
    [vehicles, drivers]
  );

  const handleDelete = async (vehicle: Vehicle) => {
    if (!confirm(`Delete vehicle ${vehicle.registration_number}? Its driver assignments will be removed.`)) return;
    try {
      await request(`/vehicles/${vehicle.id}`, { method: 'DELETE', headers: authHeaders() });
      fetchAll();
    } catch (err: any) {
      alert('Failed to delete vehicle: ' + err.message);
    }
  };

  const toggleStatus = async (vehicle: Vehicle) => {
    try {
      await request(`/vehicles/${vehicle.id}/status`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify({ status: isActive(vehicle) ? 0 : 1 }),
      });
      fetchAll();
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const unassign = async (vehicle: Vehicle, driver: AssignedDriver) => {
    if (!confirm(`Remove ${driver.name} from ${vehicle.registration_number}?`)) return;
    try {
      await request(`/vehicles/${vehicle.id}/drivers/${driver.id}`, { method: 'DELETE', headers: authHeaders() });
      fetchAll();
    } catch (err: any) {
      alert('Failed to unassign driver: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mx-auto px-4 py-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-sm font-bold text-gray-900">Vehicles Management</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">Manage delivery vehicles and assign drivers to them</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <input
                type="text"
                placeholder="Search vehicle, model or driver..."
                value={search}
                onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                className="pl-7 pr-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-red-500 w-60"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔎</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setPage(1); setStatusFilter(e.target.value as any); }}
              className="py-1.5 px-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-xs font-semibold shadow-sm"
              onClick={() => setShowModels(true)}
            >
              Manage Models
            </button>
            <button
              className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-semibold shadow-sm"
              onClick={() => navigate('/vehicles/new')}
            >
              + Add Vehicle
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {[
            { label: 'Total Vehicles', value: stats.total },
            { label: 'Active Vehicles', value: stats.active },
            { label: 'Vehicles Without Driver', value: stats.withoutDriver },
            { label: 'Unassigned Drivers', value: stats.unassignedDrivers },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-md p-3">
              <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">{s.label}</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs text-red-600">{error}</div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Registration Number', 'Model', 'Consumption (km/l)', 'Status', 'Assigned Driver', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className={`px-3 py-2 text-[9px] font-semibold text-gray-500 uppercase tracking-wider ${h === 'Actions' ? 'text-center' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-xs text-gray-500">No vehicles found</td>
                    </tr>
                  ) : (
                    paged.map((vehicle) => (
                      <tr key={vehicle.id} className="hover:bg-gray-50 align-top">
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">{vehicle.registration_number}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{vehicle.model}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                          {vehicle.consumption != null ? Number(vehicle.consumption).toFixed(1) : 'N/A'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          <button
                            onClick={() => toggleStatus(vehicle)}
                            title="Click to change status"
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              isActive(vehicle) ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {isActive(vehicle) ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {vehicle.drivers.length === 0 ? (
                            <span className="text-[10px] text-amber-600 font-medium">No driver assigned</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {vehicle.drivers.map((d) => (
                                <span
                                  key={d.id}
                                  className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium"
                                  title={d.contact || undefined}
                                >
                                  {d.name}
                                  <button
                                    onClick={() => unassign(vehicle, d)}
                                    className="w-3.5 h-3.5 rounded-full hover:bg-blue-200 leading-none"
                                    title="Unassign driver"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-center">
                          <div className="inline-flex gap-1">
                            <button
                              className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-[9px] font-semibold"
                              onClick={() => setAssignFor(vehicle)}
                            >
                              {vehicle.drivers.length ? 'Change Driver' : 'Assign Driver'}
                            </button>
                            <button
                              className="px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-[9px] font-semibold"
                              onClick={() =>
                                navigate(`/vehicle-fuelings?vehicle_id=${vehicle.id}&reg=${encodeURIComponent(vehicle.registration_number)}`)
                              }
                            >
                              Fuelings
                            </button>
                            <button
                              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-[9px] font-semibold"
                              onClick={() => setEditFor(vehicle)}
                            >
                              Edit
                            </button>
                            <button
                              className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-[9px] font-semibold"
                              onClick={() => handleDelete(vehicle)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200">
              <div className="text-[10px] text-gray-500">
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  className="px-2.5 py-1 border border-gray-300 rounded text-[10px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Prev
                </button>
                <span className="text-[10px] text-gray-600">Page {currentPage} / {totalPages}</span>
                <button
                  className="px-2.5 py-1 border border-gray-300 rounded text-[10px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {assignFor && (
        <AssignDriversModal
          vehicle={assignFor}
          drivers={drivers}
          onClose={() => setAssignFor(null)}
          onSaved={() => { setAssignFor(null); fetchAll(); }}
        />
      )}
      {showModels && (
        <ManageModelsModal
          onClose={() => { setShowModels(false); fetchAll(); }}
          onChanged={loadModels}
        />
      )}
      {editFor && (
        <EditVehicleModal
          vehicle={editFor}
          models={models}
          onClose={() => setEditFor(null)}
          onSaved={() => { setEditFor(null); fetchAll(); }}
        />
      )}
    </div>
  );
};

// ---- Assign drivers ----
const AssignDriversModal: React.FC<{
  vehicle: Vehicle;
  drivers: Driver[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ vehicle, drivers, onClose, onSaved }) => {
  const [selected, setSelected] = useState<number | null>(vehicle.drivers[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drivers.filter((d) => !q || [d.name, d.contact].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [drivers, search]);

  // The chosen driver, if currently on a different vehicle, will be moved
  const moving = drivers.filter((d) => d.id === selected && d.vehicle_id && d.vehicle_id !== vehicle.id);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await request(`/vehicles/${vehicle.id}/drivers`, {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify({ driver_ids: selected != null ? [selected] : [] }),
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to assign drivers');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-bold text-gray-900">Assign Driver</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {vehicle.registration_number} · {vehicle.model} — choose one driver for this vehicle
          </p>
        </div>

        <div className="px-4 pt-3">
          <input
            className={inputClass}
            placeholder="Search drivers by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="px-4 py-2 overflow-y-auto flex-1">
          {drivers.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">
              No drivers found. Add drivers on the Drivers page first.
            </p>
          ) : list.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">No drivers match your search</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              <li>
                <label className="flex items-center gap-2 py-2 cursor-pointer">
                  <input
                    type="radio"
                    name="driver"
                    className="h-3.5 w-3.5 text-red-600 border-gray-300 focus:ring-red-500"
                    checked={selected === null}
                    onChange={() => setSelected(null)}
                  />
                  <span className="text-xs text-gray-600 italic">No driver</span>
                </label>
              </li>
              {list.map((d) => {
                const elsewhere = d.vehicle_id && d.vehicle_id !== vehicle.id;
                return (
                  <li key={d.id}>
                    <label className="flex items-center gap-2 py-2 cursor-pointer">
                      <input
                        type="radio"
                        name="driver"
                        className="h-3.5 w-3.5 text-red-600 border-gray-300 focus:ring-red-500"
                        checked={selected === d.id}
                        onChange={() => setSelected(d.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{d.name}</p>
                        <p className="text-[10px] text-gray-500">{d.contact || 'No phone'}</p>
                      </div>
                      {elsewhere ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium whitespace-nowrap">
                          On {d.vehicle_registration_number}
                        </span>
                      ) : !d.vehicle_id ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">Unassigned</span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {moving.length > 0 && (
          <div className="mx-4 mb-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-[10px] text-amber-800">
            {moving.map((d) => `${d.name} (${d.vehicle_registration_number})`).join(', ')} will be moved to {vehicle.registration_number}. A driver can only be on one vehicle.
          </div>
        )}
        {error && <div className="mx-4 mb-2 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700">{error}</div>}

        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <span className="text-[10px] text-gray-500">
            {selected != null ? drivers.find((d) => d.id === selected)?.name : 'No driver'}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Assignment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---- Manage models ----
const ManageModelsModal: React.FC<{ onClose: () => void; onChanged: () => void }> = ({ onClose, onChanged }) => {
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [newConsumption, setNewConsumption] = useState('');
  const [editing, setEditing] = useState<VehicleModel | null>(null);
  const [editName, setEditName] = useState('');
  const [editConsumption, setEditConsumption] = useState('');
  const [applyToVehicles, setApplyToVehicles] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setModels(await fetchVehicleModelsStrict());
    } catch (err: any) {
      setModels([]);
      setError(
        `Could not load models (${err.message}). If you just updated, restart the server and refresh the page.`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return setError('Enter the model name');
    run(async () => {
      await request('/vehicles/models', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ name: newName, consumption: newConsumption }),
      });
      setNewName('');
      setNewConsumption('');
    });
  };

  const startEdit = (m: VehicleModel) => {
    setEditing(m);
    setEditName(m.name);
    setEditConsumption(m.consumption != null ? String(m.consumption) : '');
    setApplyToVehicles(false);
    setError(null);
  };

  const saveEdit = () => {
    if (!editing) return;
    if (!editName.trim()) return setError('Enter the model name');
    run(async () => {
      await request(`/vehicles/models/${editing.id}`, {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify({ name: editName, consumption: editConsumption, apply_to_vehicles: applyToVehicles }),
      });
      setEditing(null);
    });
  };

  const remove = (m: VehicleModel) => {
    if (!confirm(`Delete the model "${m.name}"?`)) return;
    run(async () => {
      await request(`/vehicles/models/${m.id}`, { method: 'DELETE', headers: authHeaders() });
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Manage Vehicle Models</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Each model has a standard fuel consumption (km/l) that is filled in when you add a vehicle of that model.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <form onSubmit={add} className="px-4 py-3 border-b border-gray-100 flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-medium text-gray-700 mb-1">Model name</label>
            <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Isuzu NMR" />
          </div>
          <div className="w-32">
            <label className="block text-[10px] font-medium text-gray-700 mb-1">Consumption (km/l)</label>
            <input
              className={inputClass}
              type="number"
              step="0.1"
              min="0"
              value={newConsumption}
              onChange={(e) => setNewConsumption(e.target.value)}
              placeholder="e.g. 8.5"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            Add Model
          </button>
        </form>

        {error && <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700">{error}</div>}

        <div className="px-4 py-2 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-xs text-gray-500 py-6 text-center">Loading...</p>
          ) : models.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">No models yet</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="py-1.5 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Model</th>
                  <th className="py-1.5 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Consumption (km/l)</th>
                  <th className="py-1.5 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Vehicles</th>
                  <th className="py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {models.map((m) =>
                  editing?.id === m.id ? (
                    <tr key={m.id} className="bg-gray-50 align-top">
                      <td className="py-2 pr-2" colSpan={3}>
                        <div className="flex gap-2 flex-wrap">
                          <input className={`${inputClass} flex-1 min-w-[140px]`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                          <input
                            className={`${inputClass} w-28`}
                            type="number"
                            step="0.1"
                            min="0"
                            value={editConsumption}
                            onChange={(e) => setEditConsumption(e.target.value)}
                            placeholder="km/l"
                          />
                        </div>
                        {m.vehicle_count > 0 && (
                          <label className="flex items-center gap-1.5 mt-1.5 text-[10px] text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              className="h-3 w-3 text-red-600 border-gray-300 rounded focus:ring-red-500"
                              checked={applyToVehicles}
                              onChange={(e) => setApplyToVehicles(e.target.checked)}
                            />
                            Also update consumption on the {m.vehicle_count} vehicle{m.vehicle_count === 1 ? '' : 's'} of this model
                          </label>
                        )}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button onClick={saveEdit} disabled={busy} className="px-2 py-1 bg-red-600 text-white rounded text-[9px] font-semibold hover:bg-red-700 disabled:opacity-50">Save</button>
                        <button onClick={() => setEditing(null)} className="ml-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-[9px] font-semibold hover:bg-gray-200">Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={m.id}>
                      <td className="py-2 text-xs font-medium text-gray-900">{m.name}</td>
                      <td className="py-2 text-xs text-gray-700">{m.consumption != null ? m.consumption.toFixed(1) : 'N/A'}</td>
                      <td className="py-2 text-xs text-gray-700">{m.vehicle_count}</td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button onClick={() => startEdit(m)} className="px-2 py-1 bg-blue-600 text-white rounded text-[9px] font-semibold hover:bg-blue-700">Edit</button>
                        <button onClick={() => remove(m)} disabled={busy} className="ml-1 px-2 py-1 bg-gray-600 text-white rounded text-[9px] font-semibold hover:bg-gray-700 disabled:opacity-50">Delete</button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ---- Edit vehicle ----
const EditVehicleModal: React.FC<{ vehicle: Vehicle; models: VehicleModel[]; onClose: () => void; onSaved: () => void }> = ({
  vehicle,
  models: modelList,
  onClose,
  onSaved,
}) => {
  const [registration, setRegistration] = useState(vehicle.registration_number);
  const [model, setModel] = useState(vehicle.model);
  const [consumption, setConsumption] = useState(vehicle.consumption != null ? String(vehicle.consumption) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a model that isn't in the preset list selectable
  const names = modelList.map((m) => m.name);
  const models = names.includes(vehicle.model) ? names : [vehicle.model, ...names];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const reg = registration.trim().toUpperCase();
    if (!reg) return setError('Enter the registration number');
    if (!model) return setError('Choose the vehicle model');
    setSaving(true);
    setError(null);
    try {
      await request(`/vehicles/${vehicle.id}`, {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify({ registration_number: reg, model, consumption: consumption ? Number(consumption) : null }),
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to update vehicle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={save} className="bg-white rounded-lg shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-bold text-gray-900">Edit Vehicle</h2>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-1">Registration Number *</label>
            <input className={`${inputClass} uppercase`} value={registration} onChange={(e) => setRegistration(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-1">Vehicle Model *</label>
            <select
              className={inputClass}
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                const m = modelList.find((x) => x.name === e.target.value);
                if (m?.consumption != null) setConsumption(String(m.consumption));
              }}
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-1">Consumption (km/l)</label>
            <input
              className={inputClass}
              type="number"
              step="0.1"
              min="0"
              value={consumption}
              onChange={(e) => setConsumption(e.target.value)}
            />
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700">{error}</div>}
        </div>
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VehiclesPage;
