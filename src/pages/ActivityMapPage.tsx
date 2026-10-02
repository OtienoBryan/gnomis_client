import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
// MarkerF/InfoWindowF (function components) are required under React.StrictMode —
// the class-based Marker/InfoWindow detach themselves from the map during
// StrictMode's double mount/unmount and never reappear.
import { GoogleMap, MarkerF, InfoWindowF, useJsApiLoader } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '../config/googleMaps';
import { ArrowLeft } from 'lucide-react';

// Stable references — @react-google-maps/api re-initializes the map when these
// change identity, which can silently drop marker children if recreated on every render.
const MAP_CONTAINER_STYLE = { width: '100%', height: '85vh' };
const DEFAULT_CENTER = { lat: -1.286389, lng: 36.817223 };

// Inline SVG pin so markers don't depend on Google's externally hosted marker
// sprite (maps.gstatic.com), which can be blocked while map tiles still load.
const PIN_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">
    <path d="M16 0C7.7 0 1 6.7 1 15c0 11 15 29 15 29s15-18 15-29c0-8.3-6.7-15-15-15z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.5"/>
    <circle cx="16" cy="15" r="5.5" fill="#ffffff"/>
  </svg>`
)}`;

interface ActivityRow {
  id: number;
  date: string;
  time?: string;
  userId: number;
  clientId: number;
  status: number;
  checkInTime?: string | null;
  checkoutTime?: string | null;
  user_name?: string | null;
  client_name?: string | null;
  route_name?: string | null;
  region_name?: string | null;
  user_role?: string | null;
  sales_rep_country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl?: string | null;
}

const ActivityMapPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const status = searchParams.get('status') || '';
  const region = searchParams.get('region') || '';
  const routeFilter = searchParams.get('route') || '';
  const roleFilter = searchParams.get('role') || '';
  const search = searchParams.get('search') || '';

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<ActivityRow | null>(null);
  const [selectedRepId, setSelectedRepId] = useState<number | null>(null);

  const { isLoaded: isMapLoaded, loadError: mapLoadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: any = { limit: 1000 };
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        if (status) params.status = status;
        if (region) params.region = region;

        const res = await axios.get('/api/journey-plans', { params });
        const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setRows(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch activity');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate, status, region]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const regionTrimmed = region.trim().toLowerCase();
    const routeTrimmed = routeFilter.trim().toLowerCase();

    let base = rows;
    if (regionTrimmed) {
      base = base.filter(r => (r.region_name || '').toLowerCase().includes(regionTrimmed));
    }
    if (routeTrimmed) {
      base = base.filter(r => (r.route_name || '').toLowerCase().includes(routeTrimmed));
    }
    if (roleFilter === 'leader') {
      base = base.filter(r => (r.user_role || '').toLowerCase() === 'team leader');
    } else if (roleFilter === 'fmr') {
      base = base.filter(r => (r.user_role || '').toLowerCase() === 'sales rep');
    }

    if (!q) return base;
    return base.filter(r => {
      const user = (r.user_name || '').toLowerCase();
      const client = (r.client_name || '').toLowerCase();
      const route = (r.route_name || '').toLowerCase();
      return user.includes(q) || client.includes(q) || route.includes(q) || String(r.id).includes(q);
    });
  }, [rows, search, region, routeFilter, roleFilter]);

  const pointsWithLocation = useMemo(() => filtered.filter(r => r.latitude && r.longitude), [filtered]);

  // Unique sales reps among the points that have a location, for the side list.
  const salesReps = useMemo(() => {
    const byId = new Map<number, { userId: number; name: string; count: number; latest: ActivityRow }>();
    pointsWithLocation.forEach(r => {
      const existing = byId.get(r.userId);
      if (existing) {
        existing.count += 1;
        if (r.date > existing.latest.date) existing.latest = r;
      } else {
        byId.set(r.userId, { userId: r.userId, name: r.user_name || `User ${r.userId}`, count: 1, latest: r });
      }
    });
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [pointsWithLocation]);

  // Reset the selected rep if they're no longer in the current result set (filters/date changed).
  useEffect(() => {
    if (selectedRepId !== null && !salesReps.some(r => r.userId === selectedRepId)) {
      setSelectedRepId(null);
    }
  }, [salesReps, selectedRepId]);

  const visiblePoints = useMemo(() => {
    return selectedRepId !== null
      ? pointsWithLocation.filter(r => r.userId === selectedRepId)
      : pointsWithLocation;
  }, [pointsWithLocation, selectedRepId]);

  const mapCenter = useMemo(() => {
    const first = visiblePoints[0];
    return first ? { lat: Number(first.latitude), lng: Number(first.longitude) } : DEFAULT_CENTER;
  }, [visiblePoints]);

  const mapZoom = visiblePoints.length <= 2 ? 14 : 6;

  const handleSelectRep = (userId: number) => {
    setSelectedRepId(prev => (prev === userId ? null : userId));
    setSelectedPoint(null);
  };

  const pinIcon = useMemo(() => {
    if (!isMapLoaded || !window.google?.maps) return undefined;
    return {
      url: PIN_SVG,
      scaledSize: new window.google.maps.Size(32, 44),
      anchor: new window.google.maps.Point(16, 44),
    };
  }, [isMapLoaded]);

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
            <h1 className="text-sm font-bold text-gray-900">Sales Rep</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {loading
                ? 'Loading...'
                : selectedRepId !== null
                  ? `Showing ${visiblePoints.length} location${visiblePoints.length === 1 ? '' : 's'} for ${salesReps.find(r => r.userId === selectedRepId)?.name || 'selected rep'}`
                  : `Showing ${pointsWithLocation.length} of ${filtered.length} records with GPS coordinates`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-3">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-center">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        ) : mapLoadError ? (
          <div className="text-red-600 text-sm p-4">Error loading map</div>
        ) : loading || !isMapLoaded ? (
          <div className="flex items-center justify-center h-[80vh]">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-600 border-t-transparent"></div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Sales Reps list */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden lg:w-64 flex-shrink-0 flex flex-col" style={{ maxHeight: '85vh' }}>
              <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Sales Reps ({salesReps.length})</h2>
                {selectedRepId !== null && (
                  <button
                    onClick={() => { setSelectedRepId(null); setSelectedPoint(null); }}
                    className="text-[10px] font-medium text-red-600 hover:text-red-800"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1">
                {salesReps.length === 0 ? (
                  <p className="text-[10px] text-gray-500 px-3 py-4">No sales reps with GPS coordinates for this filter.</p>
                ) : (
                  salesReps.map(rep => (
                    <button
                      key={rep.userId}
                      onClick={() => handleSelectRep(rep.userId)}
                      className={`w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        selectedRepId === rep.userId ? 'bg-red-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-medium truncate ${selectedRepId === rep.userId ? 'text-red-700' : 'text-gray-900'}`}>
                          {rep.name}
                        </span>
                        <span className="text-[9px] font-semibold text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5 flex-shrink-0">
                          {rep.count}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Map */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden flex-1">
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={mapCenter}
                zoom={mapZoom}
              >
                {visiblePoints.map(r => {
                  const repName = r.user_name || `User ${r.userId}`;
                  return (
                    <MarkerF
                      key={r.id}
                      position={{ lat: Number(r.latitude), lng: Number(r.longitude) }}
                      title={repName}
                      icon={pinIcon}
                      onClick={() => setSelectedPoint(r)}
                    />
                  );
                })}

                {selectedPoint && selectedPoint.latitude && selectedPoint.longitude && (
                  <InfoWindowF
                    position={{ lat: Number(selectedPoint.latitude), lng: Number(selectedPoint.longitude) }}
                    onCloseClick={() => setSelectedPoint(null)}
                  >
                    <div>
                      <div className="font-semibold">{selectedPoint.user_name || `User ${selectedPoint.userId}`}</div>
                      {selectedPoint.client_name && <div>Client: {selectedPoint.client_name}</div>}
                      {selectedPoint.route_name && <div>Route: {selectedPoint.route_name}</div>}
                      {selectedPoint.checkInTime && (
                        <div>Check-in: {String(selectedPoint.checkInTime).replace('T', ' ').slice(0, 16)}</div>
                      )}
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

export default ActivityMapPage;
