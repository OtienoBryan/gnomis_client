import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
// MarkerF/InfoWindowF/PolylineF (function components) are required under React.StrictMode —
// the class-based Marker/InfoWindow/Polyline detach themselves from the map during
// StrictMode's double mount/unmount and never reappear.
import { GoogleMap, MarkerF, InfoWindowF, PolylineF, useJsApiLoader } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '../config/googleMaps';
import { ArrowLeft, RefreshCw } from 'lucide-react';

const MAP_CONTAINER_STYLE = { width: '100%', height: '85vh' };
const DEFAULT_CENTER = { lat: -1.286389, lng: 36.817223 };

const CURRENT_PIN_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 32 44">
    <path d="M16 0C7.7 0 1 6.7 1 15c0 11 15 29 15 29s15-18 15-29c0-8.3-6.7-15-15-15z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.5"/>
    <circle cx="16" cy="15" r="5.5" fill="#ffffff"/>
  </svg>`
)}`;

const START_PIN_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="36" viewBox="0 0 32 44">
    <path d="M16 0C7.7 0 1 6.7 1 15c0 11 15 29 15 29s15-18 15-29c0-8.3-6.7-15-15-15z" fill="#16a34a" stroke="#14532d" stroke-width="1.5"/>
    <circle cx="16" cy="15" r="5.5" fill="#ffffff"/>
  </svg>`
)}`;

interface UserWithLocation {
  user_id: number;
  role: string | null;
  latitude: number;
  longitude: number;
  recorded_at: string;
  user_name: string;
  point_count: number;
}

interface JourneyPoint {
  id: number;
  user_id: number;
  role: string | null;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

interface JourneyData {
  user_id: number;
  user_name: string;
  date: string | null;
  points: JourneyPoint[];
  current: JourneyPoint | null;
}

const REFRESH_INTERVAL_MS = 30000;

const UserLocationsPage: React.FC = () => {
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserWithLocation[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedPoint, setSelectedPoint] = useState<JourneyPoint | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const { isLoaded: isMapLoaded, loadError: mapLoadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await axios.get('/api/user-locations/users');
      const data = res.data?.data || [];
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch user locations');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchJourney = useCallback(async (userId: number, date?: string) => {
    setJourneyLoading(true);
    try {
      const params: any = {};
      if (date) params.date = date;
      const res = await axios.get(`/api/user-locations/journey/${userId}`, { params });
      const data: JourneyData = res.data?.data;
      setJourney(data);
      if (data?.date && !date) setSelectedDate(data.date);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch journey');
    } finally {
      setJourneyLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (selectedUserId !== null) {
      setSelectedPoint(null);
      fetchJourney(selectedUserId, selectedDate || undefined);
    } else {
      setJourney(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  // Live refresh of the selected user's journey/current location.
  useEffect(() => {
    if (selectedUserId === null) return;
    const interval = setInterval(() => {
      fetchJourney(selectedUserId, selectedDate || undefined);
      fetchUsers();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [selectedUserId, selectedDate, fetchJourney, fetchUsers]);

  const handleSelectUser = (userId: number) => {
    setSelectedUserId(prev => (prev === userId ? null : userId));
    setSelectedDate('');
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    if (selectedUserId !== null) fetchJourney(selectedUserId, date || undefined);
  };

  const handleManualRefresh = () => {
    fetchUsers();
    if (selectedUserId !== null) fetchJourney(selectedUserId, selectedDate || undefined);
  };

  const pathCoords = useMemo(
    () => (journey?.points || []).map(p => ({ lat: Number(p.latitude), lng: Number(p.longitude) })),
    [journey]
  );

  const mapCenter = useMemo(() => {
    if (journey?.current) return { lat: Number(journey.current.latitude), lng: Number(journey.current.longitude) };
    if (users.length > 0) return { lat: Number(users[0].latitude), lng: Number(users[0].longitude) };
    return DEFAULT_CENTER;
  }, [journey, users]);

  const mapZoom = journey?.points && journey.points.length > 1 ? 14 : 15;

  const currentPinIcon = useMemo(() => {
    if (!isMapLoaded || !window.google?.maps) return undefined;
    return {
      url: CURRENT_PIN_SVG,
      scaledSize: new window.google.maps.Size(34, 46),
      anchor: new window.google.maps.Point(17, 46),
    };
  }, [isMapLoaded]);

  const startPinIcon = useMemo(() => {
    if (!isMapLoaded || !window.google?.maps) return undefined;
    return {
      url: START_PIN_SVG,
      scaledSize: new window.google.maps.Size(26, 36),
      anchor: new window.google.maps.Point(13, 36),
    };
  }, [isMapLoaded]);

  const waypointIcon = useMemo(() => {
    if (!isMapLoaded || !window.google?.maps) return undefined;
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 5,
      fillColor: '#2563eb',
      fillOpacity: 1,
      strokeColor: '#1e3a8a',
      strokeWeight: 1.5,
    };
  }, [isMapLoaded]);

  const formatTime = (iso: string) => String(iso).replace('T', ' ').slice(0, 19);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-gray-900">Live Location</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {usersLoading
                ? 'Loading...'
                : `${users.length} user${users.length === 1 ? '' : 's'} with recorded location`}
              {lastRefreshed && ` · Updated ${lastRefreshed.toLocaleTimeString()}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedUserId !== null && (
            <input
              type="date"
              value={selectedDate}
              onChange={e => handleDateChange(e.target.value)}
              className="text-[10px] border border-gray-300 rounded-md px-2 py-1.5"
            />
          )}
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-1 text-[10px] font-medium border border-gray-300 rounded-md px-2 py-1.5 text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 p-3">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-center">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        ) : mapLoadError ? (
          <div className="text-red-600 text-sm p-4">Error loading map</div>
        ) : usersLoading || !isMapLoaded ? (
          <div className="flex items-center justify-center h-[80vh]">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-600 border-t-transparent"></div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Users list */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden lg:w-72 flex-shrink-0 flex flex-col" style={{ maxHeight: '85vh' }}>
              <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Users ({users.length})</h2>
                {selectedUserId !== null && (
                  <button
                    onClick={() => setSelectedUserId(null)}
                    className="text-[10px] font-medium text-red-600 hover:text-red-800"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1">
                {users.length === 0 ? (
                  <p className="text-[10px] text-gray-500 px-3 py-4">No location data recorded yet.</p>
                ) : (
                  users.map(u => (
                    <button
                      key={u.user_id}
                      onClick={() => handleSelectUser(u.user_id)}
                      className={`w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        selectedUserId === u.user_id ? 'bg-red-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-medium truncate ${selectedUserId === u.user_id ? 'text-red-700' : 'text-gray-900'}`}>
                          {u.user_name}
                        </span>
                        {u.role && (
                          <span className="text-[9px] font-semibold text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5 flex-shrink-0 capitalize">
                            {u.role}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-gray-400 mt-0.5">
                        {u.point_count} point{u.point_count === 1 ? '' : 's'} · {formatTime(u.recorded_at)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Map */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden flex-1 relative">
              {journeyLoading && (
                <div className="absolute top-2 right-2 z-10 bg-white border border-gray-200 rounded-md px-2 py-1 text-[9px] text-gray-500 shadow-sm">
                  Refreshing...
                </div>
              )}
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={mapCenter}
                zoom={mapZoom}
              >
                {journey && pathCoords.length > 1 && (
                  <PolylineF
                    path={pathCoords}
                    options={{
                      strokeColor: '#2563eb',
                      strokeOpacity: 0.8,
                      strokeWeight: 3,
                    }}
                  />
                )}

                {journey?.points.map((p, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === journey.points.length - 1;
                  if (isLast) return null; // current point rendered separately below
                  return (
                    <MarkerF
                      key={p.id}
                      position={{ lat: Number(p.latitude), lng: Number(p.longitude) }}
                      icon={isFirst ? startPinIcon : waypointIcon}
                      title={isFirst ? `Start · ${formatTime(p.recorded_at)}` : formatTime(p.recorded_at)}
                      onClick={() => setSelectedPoint(p)}
                    />
                  );
                })}

                {journey?.current && (
                  <MarkerF
                    position={{ lat: Number(journey.current.latitude), lng: Number(journey.current.longitude) }}
                    icon={currentPinIcon}
                    title={`Current · ${formatTime(journey.current.recorded_at)}`}
                    onClick={() => setSelectedPoint(journey.current)}
                  />
                )}

                {!journey && users.map(u => (
                  <MarkerF
                    key={u.user_id}
                    position={{ lat: Number(u.latitude), lng: Number(u.longitude) }}
                    icon={currentPinIcon}
                    title={`${u.user_name} · ${formatTime(u.recorded_at)}`}
                    onClick={() => handleSelectUser(u.user_id)}
                  />
                ))}

                {selectedPoint && (
                  <InfoWindowF
                    position={{ lat: Number(selectedPoint.latitude), lng: Number(selectedPoint.longitude) }}
                    onCloseClick={() => setSelectedPoint(null)}
                  >
                    <div className="text-xs">
                      <div className="font-semibold">{journey?.user_name}</div>
                      <div>{formatTime(selectedPoint.recorded_at)}</div>
                      <div className="text-gray-500">
                        {Number(selectedPoint.latitude).toFixed(6)}, {Number(selectedPoint.longitude).toFixed(6)}
                      </div>
                    </div>
                  </InfoWindowF>
                )}
              </GoogleMap>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserLocationsPage;
