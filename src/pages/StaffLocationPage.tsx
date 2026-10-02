import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { GoogleMap, MarkerF, InfoWindowF, PolylineF, useJsApiLoader } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '../config/googleMaps';

interface StaffLocation {
  id: number;
  name: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
  status?: number;
  region?: string;
  route_name?: string;
  latitude: number | string;
  longitude: number | string;
  last_update?: string | null;
}

interface JourneyPoint {
  id: number;
  latitude: number | string;
  longitude: number | string;
  recorded_at: string;
}

interface Journey {
  user_name: string;
  date: string | null;
  points: JourneyPoint[];
}

const DEFAULT_CENTER = { lat: -1.286389, lng: 36.817223 }; // Nairobi
const MAP_STYLE = { width: '100%', height: '100%' };
const ONLINE_MINUTES = 15;

const toIso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const roleOf = (s: StaffLocation) => (s.role || 'sales rep').toLowerCase().trim();
const roleLabel = (role: string) => (role === 'team leader' ? 'Team Leader' : role === 'driver' ? 'Driver' : role === 'sales rep' ? 'Sales Rep' : role);
const minutesAgo = (iso?: string | null) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : null);

const ago = (iso?: string | null) => {
  const m = minutesAgo(iso);
  if (m === null) return 'Never';
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} d ago`;
};

const timeOnly = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

const StaffLocationPage: React.FC = () => {
  const [staff, setStaff] = useState<StaffLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [activeOnly, setActiveOnly] = useState(true);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [journeyMode, setJourneyMode] = useState(false);
  const [journeyDate, setJourneyDate] = useState(toIso(new Date()));
  const [journey, setJourney] = useState<Journey | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<JourneyPoint | null>(null);

  const { isLoaded: mapLoaded, loadError: mapError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const fetchStaff = useCallback(async () => {
    try {
      const res = await axios.get('/api/user-locations/staff');
      if (res.data?.success) {
        setStaff(res.data.data || []);
        setError(null);
        setLastRefreshed(new Date());
      } else {
        setError(res.data?.error || 'Failed to load staff locations');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load staff locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Keep the live positions fresh while looking at the overview
  useEffect(() => {
    if (journeyMode) return undefined;
    const t = setInterval(fetchStaff, 60000);
    return () => clearInterval(t);
  }, [journeyMode, fetchStaff]);

  const fetchJourney = useCallback(async (userId: number, date: string) => {
    setJourneyLoading(true);
    setJourneyError(null);
    try {
      const res = await axios.get(`/api/user-locations/journey/${userId}`, { params: { date } });
      if (res.data?.success) setJourney(res.data.data);
      else setJourneyError(res.data?.error || 'Failed to load journey');
    } catch (err: any) {
      setJourneyError(err.response?.data?.error || err.message || 'Failed to load journey');
    } finally {
      setJourneyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (journeyMode && selectedId !== null) fetchJourney(selectedId, journeyDate);
  }, [journeyMode, selectedId, journeyDate, fetchJourney]);

  const roles = useMemo(() => Array.from(new Set(staff.map(roleOf))).sort(), [staff]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter(s => {
      if (activeOnly && Number(s.status) !== 1) return false;
      if (roleFilter !== 'all' && roleOf(s) !== roleFilter) return false;
      if (!q) return true;
      return [s.name, s.route_name, s.region].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [staff, search, roleFilter, activeOnly]);

  const selected = staff.find(s => s.id === selectedId) || null;
  const journeyPath = useMemo(
    () => (journey?.points || []).map(p => ({ lat: Number(p.latitude), lng: Number(p.longitude) })),
    [journey]
  );

  const mapCenter = useMemo(() => {
    if (journeyMode && journeyPath.length > 0) return journeyPath[journeyPath.length - 1];
    if (selected) return { lat: Number(selected.latitude), lng: Number(selected.longitude) };
    if (visible.length > 0) return { lat: Number(visible[0].latitude), lng: Number(visible[0].longitude) };
    return DEFAULT_CENTER;
  }, [journeyMode, journeyPath, selected, visible]);

  const mapZoom = journeyMode ? 14 : selected ? 15 : 11;

  const dotIcon = (color: string, scale = 8) =>
    mapLoaded && window.google?.maps
      ? { path: window.google.maps.SymbolPath.CIRCLE, scale, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }
      : undefined;

  const openJourney = (id: number) => {
    setSelectedId(id);
    setJourney(null);
    setJourneyMode(true);
    setJourneyDate(toIso(new Date()));
    setSelectedPoint(null);
  };

  const backToAll = () => {
    setJourneyMode(false);
    setJourney(null);
    setSelectedPoint(null);
  };

  const onlineCount = visible.filter(s => (minutesAgo(s.last_update) ?? Infinity) <= ONLINE_MINUTES).length;
  const inputClass =
    'border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500';

  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-5">
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Staff Location</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Where your staff were last seen. Choose someone to view their journey for a day.
              {lastRefreshed && <span className="ml-2 text-gray-400">Updated {lastRefreshed.toLocaleTimeString()}</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchStaff();
              if (journeyMode && selectedId !== null) fetchJourney(selectedId, journeyDate);
            }}
            disabled={loading}
            className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs mb-4">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
          {/* Left panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:h-[calc(100vh-190px)] lg:min-h-[480px]">
            {journeyMode && selected ? (
              <div className="p-4 flex flex-col min-h-0 flex-1">
                <button type="button" onClick={backToAll} className="self-start text-xs font-medium text-red-600 hover:text-red-800 mb-3">
                  ← Back to all staff
                </button>
                <p className="text-sm font-bold text-gray-900">{selected.name}</p>
                <p className="text-xs text-gray-500 mb-3">
                  {roleLabel(roleOf(selected))}
                  {selected.route_name ? ` · ${selected.route_name}` : ''}
                </p>

                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Journey date</label>
                <input
                  type="date"
                  className={`${inputClass} mb-3`}
                  value={journeyDate}
                  max={toIso(new Date())}
                  onChange={e => e.target.value && setJourneyDate(e.target.value)}
                />

                {journeyError && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mb-3">{journeyError}</div>}

                {journeyLoading ? (
                  <div className="py-8 text-center">
                    <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-red-600 mx-auto"></div>
                  </div>
                ) : journey && journey.points.length > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                      <div className="rounded-lg bg-gray-50 border border-gray-100 py-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Points</p>
                        <p className="text-sm font-bold text-gray-900">{journey.points.length}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 border border-gray-100 py-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">First</p>
                        <p className="text-sm font-bold text-gray-900">{timeOnly(journey.points[0].recorded_at)}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 border border-gray-100 py-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Last</p>
                        <p className="text-sm font-bold text-gray-900">{timeOnly(journey.points[journey.points.length - 1].recorded_at)}</p>
                      </div>
                    </div>
                    <div className="overflow-y-auto min-h-0 flex-1 border border-gray-100 rounded-lg divide-y divide-gray-100">
                      {journey.points.map((p, i) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPoint(p)}
                          className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center justify-between"
                        >
                          <span className="text-xs text-gray-800">
                            {i === 0 ? 'Start' : i === journey.points.length - 1 ? 'Latest' : `#${i + 1}`}
                          </span>
                          <span className="text-xs text-gray-500">{timeOnly(p.recorded_at)}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-8">No location points recorded for this date.</p>
                )}
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-gray-100 space-y-2.5">
                  <input className={`${inputClass} w-full`} placeholder="Search name, route or region..." value={search} onChange={e => setSearch(e.target.value)} />
                  <div className="flex gap-2">
                    <select className={`${inputClass} flex-1`} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                      <option value="all">All roles</option>
                      {roles.map(r => (
                        <option key={r} value={r}>{roleLabel(r)}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
                      <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
                      Active only
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {visible.length} on the map · {onlineCount} seen in the last {ONLINE_MINUTES} min
                  </p>
                </div>

                <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
                  {loading && staff.length === 0 ? (
                    <div className="py-10 text-center">
                      <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-red-600 mx-auto"></div>
                    </div>
                  ) : visible.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-10 px-4">
                      {staff.length === 0 ? 'No staff have shared a location yet.' : 'No staff match your filters.'}
                    </p>
                  ) : (
                    visible.map(s => {
                      const online = (minutesAgo(s.last_update) ?? Infinity) <= ONLINE_MINUTES;
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            setSelectedId(s.id);
                            setSelectedPoint(null);
                          }}
                          className={`px-4 py-2.5 cursor-pointer hover:bg-gray-50 ${selectedId === s.id ? 'bg-red-50/60' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${online ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                              <span className="text-xs font-semibold text-gray-900 truncate">{s.name}</span>
                            </div>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">{ago(s.last_update)}</span>
                          </div>
                          <p className="text-[11px] text-gray-500 ml-4 truncate">
                            {roleLabel(roleOf(s))}
                            {s.route_name ? ` · ${s.route_name}` : ''}
                          </p>
                          {selectedId === s.id && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                openJourney(s.id);
                              }}
                              className="mt-2 ml-4 px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
                            >
                              View journey
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Map */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-[480px] lg:h-[calc(100vh-190px)] lg:min-h-[480px] relative">
            {mapError ? (
              <div className="h-full flex items-center justify-center text-xs text-red-600 px-6 text-center">Failed to load Google Maps.</div>
            ) : !mapLoaded ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              </div>
            ) : (
              <GoogleMap mapContainerStyle={MAP_STYLE} center={mapCenter} zoom={mapZoom}>
                {!journeyMode &&
                  visible.map(s => {
                    const online = (minutesAgo(s.last_update) ?? Infinity) <= ONLINE_MINUTES;
                    return (
                      <MarkerF
                        key={s.id}
                        position={{ lat: Number(s.latitude), lng: Number(s.longitude) }}
                        icon={dotIcon(online ? '#16a34a' : '#6b7280', selectedId === s.id ? 11 : 8)}
                        title={s.name}
                        onClick={() => {
                          setSelectedId(s.id);
                          setSelectedPoint(null);
                        }}
                      />
                    );
                  })}

                {!journeyMode && selected && (
                  <InfoWindowF
                    position={{ lat: Number(selected.latitude), lng: Number(selected.longitude) }}
                    onCloseClick={() => setSelectedId(null)}
                  >
                    <div className="text-xs space-y-0.5">
                      <div className="font-semibold">{selected.name}</div>
                      <div className="text-gray-500">{roleLabel(roleOf(selected))}</div>
                      <div>Last update: {selected.last_update ? new Date(selected.last_update).toLocaleString() : 'Never'}</div>
                      <button
                        type="button"
                        onClick={() => openJourney(selected.id)}
                        className="mt-1 px-2 py-1 rounded bg-blue-600 text-white text-[11px]"
                      >
                        View journey
                      </button>
                    </div>
                  </InfoWindowF>
                )}

                {journeyMode && journeyPath.length > 1 && (
                  <PolylineF path={journeyPath} options={{ strokeColor: '#2563eb', strokeOpacity: 0.85, strokeWeight: 3 }} />
                )}

                {journeyMode &&
                  journey?.points.map((p, i) => {
                    const first = i === 0;
                    const last = i === journey.points.length - 1;
                    return (
                      <MarkerF
                        key={p.id}
                        position={{ lat: Number(p.latitude), lng: Number(p.longitude) }}
                        icon={dotIcon(first ? '#16a34a' : last ? '#dc2626' : '#2563eb', first || last ? 9 : 5)}
                        title={`${first ? 'Start' : last ? 'Latest' : `#${i + 1}`} · ${timeOnly(p.recorded_at)}`}
                        onClick={() => setSelectedPoint(p)}
                      />
                    );
                  })}

                {journeyMode && selectedPoint && (
                  <InfoWindowF
                    position={{ lat: Number(selectedPoint.latitude), lng: Number(selectedPoint.longitude) }}
                    onCloseClick={() => setSelectedPoint(null)}
                  >
                    <div className="text-xs">
                      <div className="font-semibold">{selected?.name}</div>
                      <div>{new Date(selectedPoint.recorded_at).toLocaleString()}</div>
                      <div className="text-gray-500">
                        {Number(selectedPoint.latitude).toFixed(6)}, {Number(selectedPoint.longitude).toFixed(6)}
                      </div>
                    </div>
                  </InfoWindowF>
                )}
              </GoogleMap>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffLocationPage;
