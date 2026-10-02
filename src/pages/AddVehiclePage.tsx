import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_CONFIG } from '../config/api';
import { VEHICLE_MODELS } from '../constants/vehicleModels';

const inputClass =
  'block w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-50';
const labelClass = 'block text-[11px] font-medium text-gray-700 mb-1';

const AddVehiclePage: React.FC = () => {
  const navigate = useNavigate();
  const [registration, setRegistration] = useState('');
  const [model, setModel] = useState('');
  const [consumption, setConsumption] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const reg = registration.trim().toUpperCase();
    if (!reg) return setError('Enter the registration number');
    if (!model) return setError('Choose the vehicle model');

    try {
      setSaving(true);
      const res = await fetch(API_CONFIG.getUrl('/vehicles'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          registration_number: reg,
          model,
          consumption: consumption ? Number(consumption) : null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      navigate('/vehicles');
    } catch (err: any) {
      setError(err.message || 'Failed to add vehicle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-5">
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Add Vehicle</h1>
            <p className="text-xs text-gray-500 mt-0.5">Register a delivery vehicle by its registration number and model.</p>
          </div>
          <Link
            to="/vehicles"
            className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Vehicles
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-xl">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>
                Registration Number <span className="text-red-500">*</span>
              </label>
              <input
                className={`${inputClass} uppercase`}
                value={registration}
                onChange={e => setRegistration(e.target.value)}
                placeholder="e.g. KDA 123X"
                disabled={saving}
                autoFocus
              />
            </div>

            <div>
              <label className={labelClass}>
                Vehicle Model <span className="text-red-500">*</span>
              </label>
              <select className={inputClass} value={model} onChange={e => setModel(e.target.value)} disabled={saving}>
                <option value="">Select model</option>
                {VEHICLE_MODELS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Consumption (km/l)</label>
              <input
                className={inputClass}
                type="number"
                step="0.1"
                min="0"
                value={consumption}
                onChange={e => setConsumption(e.target.value)}
                placeholder="e.g. 8.5 (optional)"
                disabled={saving}
              />
            </div>
          </div>

          {error && <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>}

          <div className="mt-5 flex justify-end gap-2">
            <Link to="/vehicles" className="px-4 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddVehiclePage;
