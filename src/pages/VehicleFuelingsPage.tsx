import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { authHeaders, vehicleRequest } from '../services/vehicleModels';
import {
  type Fueling, ymd, num, money, fmtDateTime, distance, efficiency, STATUS_STYLE, statusLabel, photoList, withPreviousOdo,
} from '../services/fuelings';


const inputClass =
  'py-1.5 px-2 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-red-500';

const VehicleFuelingsPage: React.FC = () => {
  // Opened from a vehicle (?vehicle_id=..&reg=..): filtered to that vehicle, across all dates.
  // Otherwise defaults to the current month.
  const [params] = useSearchParams();
  const linkedVehicleId = params.get('vehicle_id') || '';
  const linkedVehicleReg = params.get('reg') || '';
  const now = new Date();
  const [start, setStart] = useState(linkedVehicleId ? '' : ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [end, setEnd] = useState(linkedVehicleId ? '' : ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [vehicleId, setVehicleId] = useState(linkedVehicleId);
  const [driverId, setDriverId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Fueling[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Fueling | null>(null);
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null);
  const pageSize = 15;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (start) qs.set('start', start);
      if (end) qs.set('end', end);
      const body = await vehicleRequest(`/vehicles/fuelings?${qs}`, { headers: authHeaders() });
      setRows(withPreviousOdo((body.data || []) as Fueling[]));
      setPage(1);
    } catch (err: any) {
      setError(err.message || 'Failed to load fuelings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  const vehicles = useMemo(() => {
    const m = new Map<number, string>();
    rows.forEach((r) => m.set(r.vehicle_id, r.registration_number || `Vehicle #${r.vehicle_id}`));
    // Keep the linked vehicle selectable even when it has no fuelings yet
    if (linkedVehicleId && !m.has(Number(linkedVehicleId))) {
      m.set(Number(linkedVehicleId), linkedVehicleReg || `Vehicle #${linkedVehicleId}`);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, linkedVehicleId, linkedVehicleReg]);

  const drivers = useMemo(() => {
    const m = new Map<number, string>();
    rows.forEach((r) => m.set(r.driver_id, r.driver_name || `Driver #${r.driver_id}`));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (vehicleId && String(r.vehicle_id) !== vehicleId) return false;
      if (driverId && String(r.driver_id) !== driverId) return false;
      if (status && r.status !== status) return false;
      if (!q) return true;
      return [r.registration_number, r.vehicle_model, r.driver_name].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [rows, vehicleId, driverId, status, search]);

  // Totals, plus a per-vehicle breakdown
  const { stats, byVehicle } = useMemo(() => {
    type Agg = { label: string; model: string | null; count: number; litres: number; cost: number; km: number; effKm: number; effLitres: number };
    const groups = new Map<number, Agg>();
    const total = { count: 0, litres: 0, cost: 0, km: 0, effKm: 0, effLitres: 0 };

    for (const r of filtered) {
      const g =
        groups.get(r.vehicle_id) ||
        { label: r.registration_number || `Vehicle #${r.vehicle_id}`, model: r.vehicle_model, count: 0, litres: 0, cost: 0, km: 0, effKm: 0, effLitres: 0 };
      const litres = num(r.litres) || 0;
      const cost = num(r.total_cost) || 0;
      const d = distance(r);
      const eff = efficiency(r);
      for (const t of [g, total]) {
        t.count += 1;
        t.litres += litres;
        t.cost += cost;
        if (d != null && d > 0) t.km += d;
        if (eff != null) {
          t.effKm += d!;
          t.effLitres += litres;
        }
      }
      groups.set(r.vehicle_id, g);
    }
    return {
      stats: { ...total, avgEff: total.effLitres > 0 ? total.effKm / total.effLitres : null },
      byVehicle: [...groups.values()]
        .map((g) => ({ ...g, avgEff: g.effLitres > 0 ? g.effKm / g.effLitres : null }))
        .sort((a, b) => b.cost - a.cost),
    };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportCsv = () => {
    const header = [
      'Date', 'Vehicle', 'Model', 'Driver', 'Status', 'Odometer', 'Previous odometer', 'Km since last fueling',
      'Litres', 'Price per litre', 'Total cost', 'km/l', 'Completed at',
    ];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = filtered.map((r) =>
      [
        r.created_at, r.registration_number, r.vehicle_model, r.driver_name, r.status, r.odo_reading, r.prev_odo_reading,
        distance(r), num(r.litres), num(r.price_per_litre), num(r.total_cost),
        efficiency(r) != null ? efficiency(r)!.toFixed(2) : '', r.completed_at,
      ].map(esc).join(',')
    );
    const blob = new Blob([[header.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vehicle-fuelings-${start}-to-${end}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportPdf = async () => {
    // Logo, as a data URL so it can be embedded
    let logo: string | null = null;
    let logoRatio = 1;
    try {
      const blob = await (await fetch('/logo.jpg')).blob();
      logo = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = logo!;
      });
      if (img.width && img.height) logoRatio = img.width / img.height;
    } catch {
      logo = null; // still produce the report without the logo
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;

    // Top left: logo. Top right: company details.
    const logoH = 22;
    if (logo) doc.addImage(logo, 'JPEG', margin, 8, logoH * logoRatio, logoH);
    doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(30);
    doc.text('GNOMIS QUALITY PRODUCTS', pageW - margin, 14, { align: 'right' });
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90);
    doc.text('P.O Box 15470, Nairobi Kenya', pageW - margin, 19.5, { align: 'right' });
    doc.text('Pin P051904794X', pageW - margin, 24, { align: 'right' });

    doc.setDrawColor(200).line(margin, 33, pageW - margin, 33);

    // Title and report details
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(30);
    doc.text('Vehicle Fueling Report', margin, 41);

    const vehicleLabel = vehicleId ? vehicles.find(([id]) => String(id) === vehicleId)?.[1] || vehicleId : 'All vehicles';
    const driverLabel = driverId ? drivers.find(([id]) => String(id) === driverId)?.[1] || driverId : 'All drivers';
    const period = start || end ? `${start || 'start'} to ${end || 'today'}` : 'All dates';
    const details: [string, string][] = [
      ['Period', period],
      ['Vehicle', vehicleLabel],
      ['Driver', driverLabel],
      ['Status', status ? statusLabel(status) : 'All statuses'],
      ['Generated', new Date().toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })],
    ];
    doc.setFontSize(9);
    details.forEach(([k, v], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = margin + col * 90;
      const y = 48 + row * 6;
      doc.setFont('helvetica', 'bold').setTextColor(90).text(`${k}:`, x, y);
      doc.setFont('helvetica', 'normal').setTextColor(30).text(String(v), x + 22, y);
    });

    // Summary line
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(30);
    doc.text(
      `Fuelings: ${stats.count}     Litres: ${stats.litres.toLocaleString('en-KE', { maximumFractionDigits: 1 })}     ` +
        `Total cost: KES ${money(stats.cost)}     Distance: ${stats.km.toLocaleString()} km     ` +
        `Avg efficiency: ${stats.avgEff != null ? stats.avgEff.toFixed(1) + ' km/l' : '—'}`,
      margin,
      63
    );

    autoTable(doc, {
      startY: 67,
      margin: { left: margin, right: margin, bottom: 14 },
      head: [['Date', 'Vehicle', 'Driver', 'Status', 'Odometer', 'Km Since Last', 'Litres', 'Price / L', 'Total Cost', 'km/l']],
      body: filtered.map((f) => {
        const d = distance(f);
        const eff = efficiency(f);
        return [
          fmtDateTime(f.created_at),
          `${f.registration_number || `#${f.vehicle_id}`}${f.vehicle_model ? ` (${f.vehicle_model})` : ''}`,
          f.driver_name || `#${f.driver_id}`,
          statusLabel(f.status),
          f.odo_reading != null ? f.odo_reading.toLocaleString() : '—',
          d != null ? d.toLocaleString() : '—',
          num(f.litres) != null ? num(f.litres)!.toFixed(1) : '—',
          money(f.price_per_litre),
          money(f.total_cost),
          eff != null ? eff.toFixed(1) : '—',
        ];
      }),
      foot: [[
        'Total', '', '', '', '', stats.km.toLocaleString(),
        stats.litres.toLocaleString('en-KE', { maximumFractionDigits: 1 }), '', money(stats.cost),
        stats.avgEff != null ? stats.avgEff.toFixed(1) : '—',
      ]],
      showFoot: 'lastPage',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [220, 38, 38], textColor: 255 },
      footStyles: { fillColor: [243, 244, 246], textColor: 30, fontStyle: 'bold' },
      columnStyles: {
        4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' },
        7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' },
      },
    });

    // Page numbers
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(130);
      doc.text(`Page ${i} of ${pages}`, pageW - margin, pageH - 6, { align: 'right' });
      doc.text('Vehicle Fueling Report', margin, pageH - 6);
    }

    doc.save(`vehicle-fuelings-${start || 'all'}-to-${end || 'all'}.pdf`);
  };

  const th = 'px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mx-auto px-4 py-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-sm font-bold text-gray-900">Vehicle Fueling</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">Fuel top-ups recorded by drivers, with gauge, pump and odometer photos</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/vehicles"
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-xs font-semibold shadow-sm"
            >
              Vehicles
            </Link>
            <button
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              onClick={exportPdf}
              disabled={filtered.length === 0}
              className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              Export PDF
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-1">From</label>
            <input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-1">To</label>
            <input type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-1">Vehicle</label>
            <select className={inputClass} value={vehicleId} onChange={(e) => { setVehicleId(e.target.value); setPage(1); }}>
              <option value="">All vehicles</option>
              {vehicles.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-1">Driver</label>
            <select className={inputClass} value={driverId} onChange={(e) => { setDriverId(e.target.value); setPage(1); }}>
              <option value="">All drivers</option>
              {drivers.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-1">Status</label>
            <select className={inputClass} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-medium text-gray-600 mb-1">Search</label>
            <input
              className={`${inputClass} w-full`}
              placeholder="Vehicle, model or driver..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          {[
            { label: 'Fuelings', value: stats.count.toLocaleString() },
            { label: 'Total Litres', value: stats.litres.toLocaleString('en-KE', { maximumFractionDigits: 1 }) },
            { label: 'Total Cost (KES)', value: money(stats.cost) },
            { label: 'Distance Covered (km)', value: stats.km.toLocaleString() },
            { label: 'Avg Efficiency (km/l)', value: stats.avgEff != null ? stats.avgEff.toFixed(1) : '—' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-md p-3">
              <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">{s.label}</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* By vehicle */}
        {!loading && !error && byVehicle.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-md mb-3 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100">
              <h2 className="text-[11px] font-semibold text-gray-700">By Vehicle</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Vehicle', 'Fuelings', 'Litres', 'Total Cost', 'Distance (km)', 'Avg km/l'].map((h) => (
                      <th key={h} className={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {byVehicle.map((g) => (
                    <tr key={g.label}>
                      <td className="px-3 py-1.5 text-xs text-gray-900">
                        <span className="font-medium">{g.label}</span>
                        {g.model && <span className="text-[10px] text-gray-500"> · {g.model}</span>}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-700">{g.count}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-700">{g.litres.toLocaleString('en-KE', { maximumFractionDigits: 1 })}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-700">{money(g.cost)}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-700">{g.km.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-700">{g.avgEff != null ? g.avgEff.toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Fuelings table */}
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
                    {['Date', 'Vehicle', 'Driver', 'Status', 'Odometer', 'Km Since Last', 'Litres', 'Price / L', 'Total Cost', 'km/l', 'Photos', ''].map((h, i) => (
                      <th key={i} className={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-3 py-8 text-center text-xs text-gray-500">No fuelings found</td>
                    </tr>
                  ) : (
                    paged.map((f) => {
                      const d = distance(f);
                      const eff = efficiency(f);
                      return (
                        <tr key={f.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{fmtDateTime(f.created_at)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            <p className="font-medium text-gray-900">{f.registration_number || `#${f.vehicle_id}`}</p>
                            {f.vehicle_model && <p className="text-[10px] text-gray-500">{f.vehicle_model}</p>}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{f.driver_name || `#${f.driver_id}`}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLE[f.status] || 'bg-gray-100 text-gray-600'}`}>
                              {statusLabel(f.status)}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{f.odo_reading != null ? f.odo_reading.toLocaleString() : '—'}</td>
                          <td className={`px-3 py-2 whitespace-nowrap text-xs ${d != null && d < 0 ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                            {d != null ? d.toLocaleString() : '—'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{num(f.litres) != null ? num(f.litres)!.toFixed(1) : '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{money(f.price_per_litre)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">{money(f.total_cost)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{eff != null ? eff.toFixed(1) : '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex gap-1">
                              {photoList(f).map((p) =>
                                p.url ? (
                                  <button
                                    key={p.label}
                                    title={p.label}
                                    onClick={() => setZoom({ url: p.url!, label: `${p.label} · ${f.registration_number || ''}` })}
                                    className="w-8 h-8 rounded overflow-hidden border border-gray-200 bg-gray-100 hover:ring-2 hover:ring-red-500"
                                  >
                                    <img src={p.url} alt={p.label} loading="lazy" className="w-full h-full object-cover" />
                                  </button>
                                ) : (
                                  <div key={p.label} title={`${p.label}: no photo`} className="w-8 h-8 rounded border border-dashed border-gray-300" />
                                )
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            <button
                              onClick={() => setSelected(f)}
                              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-[9px] font-semibold"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
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

        <p className="text-[10px] text-gray-400 mt-2">
          Km since last = odometer minus the same vehicle's previous fueling reading. km/l = those km divided by the litres fueled now,
          so it is only accurate when the tank is filled up each time. A vehicle's first fueling has no previous reading to compare with.
        </p>
      </div>

      {selected && <FuelingDetailModal fueling={selected} onClose={() => setSelected(null)} onZoom={setZoom} />}

      {zoom && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 p-4" onClick={() => setZoom(null)}>
          <p className="text-white text-xs mb-2">{zoom.label}</p>
          <img src={zoom.url} alt={zoom.label} className="max-h-[85vh] max-w-full rounded-md" />
          <a
            href={zoom.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-white/80 hover:text-white text-[10px] underline mt-2"
          >
            Open original
          </a>
        </div>
      )}
    </div>
  );
};

// ---- Details ----
const FuelingDetailModal: React.FC<{
  fueling: Fueling;
  onClose: () => void;
  onZoom: (z: { url: string; label: string }) => void;
}> = ({ fueling: f, onClose, onZoom }) => {
  const d = distance(f);
  const eff = efficiency(f);

  const facts: [string, string][] = [
    ['Vehicle', `${f.registration_number || `#${f.vehicle_id}`}${f.vehicle_model ? ` · ${f.vehicle_model}` : ''}`],
    ['Driver', f.driver_name || `#${f.driver_id}`],
    ['Status', `${statusLabel(f.status)} (step ${f.step} of 4)`],
    ['Started', fmtDateTime(f.created_at)],
    ['Completed', fmtDateTime(f.completed_at)],
    ['Odometer', f.odo_reading != null ? `${f.odo_reading.toLocaleString()} km` : '—'],
    ['Previous odometer', f.prev_odo_reading != null ? `${f.prev_odo_reading.toLocaleString()} km` : 'None (first fueling)'],
    ['Km since last fueling', d != null ? `${d.toLocaleString()} km` : '—'],
    ['Litres', num(f.litres) != null ? `${num(f.litres)!.toFixed(2)} L` : '—'],
    ['Price per litre', money(f.price_per_litre)],
    ['Total cost', `KES ${money(f.total_cost)}`],
    ['Efficiency', eff != null ? `${eff.toFixed(1)} km/l` : '—'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Fueling #{f.id}</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Recorded {fmtDateTime(f.created_at)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <div className="p-4 overflow-y-auto">
          {d != null && d < 0 && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700">
              This odometer reading is lower than the previous fueling's. Check the odometer photo.
            </div>
          )}
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 mb-4">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">{k}</dt>
                <dd className="text-xs text-gray-900 mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>

          <h3 className="text-[11px] font-semibold text-gray-700 mb-2">Photos</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {photoList(f).map((p, i) => (
              <div key={p.label}>
                <p className="text-[10px] font-medium text-gray-600 mb-1">
                  {i + 1}. {p.label}
                </p>
                {p.url ? (
                  <button
                    onClick={() => onZoom({ url: p.url!, label: p.label })}
                    className="block w-full aspect-square rounded-md overflow-hidden border border-gray-200 bg-gray-100 hover:ring-2 hover:ring-red-500"
                  >
                    <img src={p.url} alt={p.label} loading="lazy" className="w-full h-full object-cover" />
                  </button>
                ) : (
                  <div className="w-full aspect-square rounded-md border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400">
                    No photo
                  </div>
                )}
                {p.at && p.url && <p className="text-[9px] text-gray-400 mt-0.5">{fmtDateTime(p.at)}</p>}
              </div>
            ))}
          </div>
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

export default VehicleFuelingsPage;
