import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { salesService, SalesRep } from '../services/salesService';
import { saveAs } from 'file-saver';
import { useAuth } from '../contexts/AuthContext';
import { API_CONFIG } from '../config/api';
import {
  Calendar,
  Paperclip,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Inbox,
  Users
} from 'lucide-react';

// Configure axios to include auth token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

interface Leave {
  id: number;
  userId: number;
  userName?: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  attachment?: string;
  attachment_url?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

type StatusTone = 'gray' | 'amber' | 'blue' | 'green' | 'red';

const TONES: Record<StatusTone, { tile: string; ring: string; icon: string; badge: string; dot: string }> = {
  gray: { tile: 'bg-gray-100', ring: 'ring-gray-900', icon: 'text-gray-600', badge: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  amber: { tile: 'bg-amber-50', ring: 'ring-amber-500', icon: 'text-amber-600', badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  blue: { tile: 'bg-blue-50', ring: 'ring-blue-500', icon: 'text-blue-600', badge: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  green: { tile: 'bg-emerald-50', ring: 'ring-emerald-500', icon: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  red: { tile: 'bg-red-50', ring: 'ring-red-500', icon: 'text-red-600', badge: 'bg-red-50 text-red-700', dot: 'bg-red-500' }
};

const STATUS_META: Record<number, { label: string; tone: StatusTone }> = {
  0: { label: 'Pending', tone: 'amber' },
  7: { label: 'Approved by TL', tone: 'blue' },
  1: { label: 'Approved', tone: 'green' },
  2: { label: 'Declined', tone: 'red' }
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const attachmentOf = (leave: Leave) => leave.attachment || leave.attachment_url || '';
const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);

const inputClass =
  'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition';

const SalesRepLeavesPage: React.FC = () => {
  const { user } = useAuth();
  const isTeamLeaderUser = user?.role === 'leader' || user?.role === 'team_leader';
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasonLeave, setReasonLeave] = useState<Leave | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('0');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [actingId, setActingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchSalesReps = async () => {
      try {
        // If user is a leader, filter by leader_id
        if (isTeamLeaderUser && user?.id) {
          const response = await axios.get(`${API_CONFIG.getUrl('/sales-reps')}?status=1&leader_id=${user.id}`);
          const data = response.data;
          setSalesReps(data.success ? data.data : (Array.isArray(data) ? data : []));
        } else {
          const reps = await salesService.getAllSalesReps();
          setSalesReps(reps);
        }
      } catch (error) {
        console.error('Failed to fetch sales reps:', error);
        setSalesReps([]);
      }
    };
    fetchSalesReps();
  }, [isTeamLeaderUser, user?.id]);

  const leavesUrl = () =>
    isTeamLeaderUser && user?.id
      ? `${API_CONFIG.getUrl('/sales-rep-leaves/sales-rep-leaves')}?team_leader_id=${user.id}`
      : API_CONFIG.getUrl('/sales-rep-leaves/sales-rep-leaves');

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios
      .get(leavesUrl())
      .then(res => setLeaves(res.data))
      .catch(err => setError(err.message || 'Failed to fetch leaves'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeamLeaderUser, user?.id]);

  const repName = (leave: Leave) => {
    const rep = salesReps.find(r => r.id === leave.userId);
    return rep ? rep.name : (leave.userName || `User ${leave.userId}`);
  };

  // Leaves visible to this user, before the status/date/rep/search filters
  const visibleLeaves = useMemo(
    () =>
      leaves.filter(leave => {
        // If user is a leader, only show leaves for assigned sales reps
        if (isTeamLeaderUser && user?.id) {
          return salesReps.some(r => r.id === leave.userId);
        }
        return true;
      }),
    [leaves, salesReps, isTeamLeaderUser, user?.id]
  );

  const filteredLeaves = visibleLeaves.filter(leave => {
    const statusMatch = !statusFilter || Number(leave.status) === Number(statusFilter);
    let dateMatch = true;
    if (startDateFilter) {
      dateMatch = dateMatch && new Date(leave.startDate) >= new Date(startDateFilter);
    }
    if (endDateFilter) {
      dateMatch = dateMatch && new Date(leave.endDate) <= new Date(endDateFilter);
    }
    const repMatch = !selectedRep || String(leave.userId) === selectedRep;
    const q = search.trim().toLowerCase();
    const searchMatch =
      !q ||
      repName(leave).toLowerCase().includes(q) ||
      (leave.leaveType || '').toLowerCase().includes(q) ||
      (leave.reason || '').toLowerCase().includes(q);
    return statusMatch && dateMatch && repMatch && searchMatch;
  });

  const countByStatus = (status: number) =>
    visibleLeaves.filter(l => Number(l.status) === status).length;

  const handleUpdateStatus = async (leaveId: number, newStatus: number) => {
    try {
      setActingId(leaveId);
      const statusToSend = isTeamLeaderUser && newStatus === 1 ? 7 : newStatus;
      const response = await axios.patch(API_CONFIG.getUrl(`/sales-rep-leaves/${leaveId}/status`), { status: statusToSend });
      if (response.data.success) {
        // Refresh leaves data to get updated status
        const leavesResponse = await axios.get(leavesUrl());
        setLeaves(leavesResponse.data);
      } else {
        alert('Failed to update status');
      }
    } catch (err: any) {
      console.error('Error updating leave status:', err);
      alert(err.response?.data?.error || err.message || 'Failed to update status');
    } finally {
      setActingId(null);
    }
  };

  const hasActiveFilters = !!(selectedRep || startDateFilter || endDateFilter || search);

  const resetFilters = () => {
    setSelectedRep('');
    setStartDateFilter('');
    setEndDateFilter('');
    setSearch('');
    setCurrentPage(1);
  };

  const exportToCSV = () => {
    const headers = [
      'FMR',
      'Leave Type',
      'Start Date',
      'End Date',
      'Reason',
      'Attachment',
      'Status'
    ];
    const rows = filteredLeaves.map(leave => [
      (salesReps.find(rep => String(rep.id) === String(leave.userId))?.name) || '',
      leave.leaveType,
      leave.startDate,
      leave.endDate,
      leave.reason,
      attachmentOf(leave),
      (Number(leave.status) === 1) ? 'Approved' : (Number(leave.status) === 7) ? 'Approved by Team Leader' : (Number(leave.status) === 2) ? 'Declined' : 'Pending'
    ]);
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => '"' + String(field).replace(/"/g, '""') + '"').join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'sales_rep_leaves.csv');
  };

  const getStatusBadge = (status: string | number) => {
    const meta = STATUS_META[Number(status)] || STATUS_META[0];
    const tone = TONES[meta.tone];
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone.badge}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
        {meta.label}
      </span>
    );
  };

  const calculateLeaveDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredLeaves.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeaves = filteredLeaves.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const tiles: { key: string; label: string; value: number; tone: StatusTone; icon: React.ReactNode }[] = [
    { key: '', label: 'All leaves', value: visibleLeaves.length, tone: 'gray', icon: <Users className="h-4 w-4" /> },
    { key: '0', label: 'Pending', value: countByStatus(0), tone: 'amber', icon: <Clock className="h-4 w-4" /> },
    { key: '7', label: 'Approved by TL', value: countByStatus(7), tone: 'blue', icon: <CheckCircle className="h-4 w-4" /> },
    { key: '1', label: 'Approved', value: countByStatus(1), tone: 'green', icon: <CheckCircle className="h-4 w-4" /> },
    { key: '2', label: 'Declined', value: countByStatus(2), tone: 'red', icon: <XCircle className="h-4 w-4" /> }
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Sales Rep Leaves</h1>
            <p className="mt-1 text-sm text-gray-500">Review and action leave requests from your field team.</p>
          </div>
          <button
            onClick={exportToCSV}
            disabled={filteredLeaves.length === 0}
            className="inline-flex h-9 items-center gap-2 self-start rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {/* Status tiles (act as filters) */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {tiles.map(t => {
            const tone = TONES[t.tone];
            const active = statusFilter === t.key;
            return (
              <button
                key={t.label}
                onClick={() => {
                  setStatusFilter(t.key);
                  setCurrentPage(1);
                }}
                aria-pressed={active}
                className={`flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3.5 text-left shadow-sm transition hover:shadow-md ${
                  active ? `ring-2 ring-offset-1 ${tone.ring}` : ''
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.tile} ${tone.icon}`}>
                  {t.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-2xl font-semibold leading-none text-gray-900">{t.value}</span>
                  <span className="mt-1 block truncate text-xs text-gray-500">{t.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-gray-100 p-3 lg:flex-row lg:items-center">
            <div className="relative flex-1 lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search name, type or reason"
                className={`${inputClass} w-full pl-9`}
              />
            </div>
            <select
              value={selectedRep}
              onChange={e => {
                setSelectedRep(e.target.value);
                setCurrentPage(1);
              }}
              className={`${inputClass} lg:w-48`}
              aria-label="Filter by FMR"
            >
              <option value="">All FMRs</option>
              {salesReps.map(rep => (
                <option key={rep.id} value={String(rep.id)}>
                  {rep.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDateFilter}
                onChange={e => {
                  setStartDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={inputClass}
                aria-label="Leave starts on or after"
              />
              <ArrowRight className="h-4 w-4 shrink-0 text-gray-300" />
              <input
                type="date"
                value={endDateFilter}
                onChange={e => {
                  setEndDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={inputClass}
                aria-label="Leave ends on or before"
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>

          {loading ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 px-4 py-4">
                  <div className="h-9 w-9 rounded-full bg-gray-100" />
                  <div className="h-3 w-32 rounded bg-gray-100" />
                  <div className="h-3 w-20 rounded bg-gray-100" />
                  <div className="ml-auto h-3 w-40 rounded bg-gray-100" />
                </div>
              ))}
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <Inbox className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-medium text-gray-900">No leaves found</h3>
              <p className="mt-1 text-sm text-gray-500">Try a different status or clear your filters.</p>
              {(hasActiveFilters || statusFilter) && (
                <button
                  onClick={() => {
                    resetFilters();
                    setStatusFilter('');
                  }}
                  className="mt-4 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  Show all leaves
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">FMR</th>
                      <th className="px-4 py-3">Leave</th>
                      <th className="px-4 py-3">Dates</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Image</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedLeaves.map(leave => {
                      const name = repName(leave);
                      const duration = calculateLeaveDuration(leave.startDate, leave.endDate);
                      const leaveStatusNum = Number(leave.status);
                      // Pending leaves can be actioned by any role (sales included);
                      // sales can also give the final decision on leaves a team leader already approved
                      const canActOnLeave =
                        leaveStatusNum === 0 || (user?.role === 'sales' && leaveStatusNum === 7);
                      const busy = actingId === leave.id;

                      return (
                        <tr key={leave.id} className="transition-colors hover:bg-gray-50/70">
                          {/* FMR */}
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <span className="text-sm font-medium text-gray-900">{name}</span>
                          </td>

                          {/* Leave type + duration */}
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <div className="text-sm text-gray-900">{leave.leaveType}</div>
                            <div className="text-xs text-gray-500">
                              {duration} day{duration !== 1 ? 's' : ''}
                            </div>
                          </td>

                          {/* Dates */}
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                              <Calendar className="h-3.5 w-3.5 text-gray-400" />
                              {formatDate(leave.startDate)}
                              <ArrowRight className="h-3 w-3 text-gray-300" />
                              {formatDate(leave.endDate)}
                            </div>
                          </td>

                          {/* Reason + attachment */}
                          <td className="max-w-xs px-4 py-3.5">
                            <button
                              onClick={() => setReasonLeave(leave)}
                              className="block max-w-full truncate text-left text-sm text-gray-600 hover:text-gray-900"
                              title="View full reason"
                            >
                              {leave.reason || '—'}
                            </button>
                          </td>

                          {/* Image */}
                          <td className="whitespace-nowrap px-4 py-3.5">
                            {attachmentOf(leave) ? (
                              <a
                                href={attachmentOf(leave)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open attachment"
                                className="block h-12 w-12 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 transition hover:shadow-md"
                              >
                                {isImageUrl(attachmentOf(leave)) ? (
                                  <img
                                    src={attachmentOf(leave)}
                                    alt={`${name} attachment`}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-gray-400">
                                    <Paperclip className="h-4 w-4" />
                                  </span>
                                )}
                              </a>
                            ) : (
                              <span className="text-sm text-gray-300">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="whitespace-nowrap px-4 py-3.5">{getStatusBadge(leave.status)}</td>

                          {/* Actions */}
                          <td className="whitespace-nowrap px-4 py-3.5 text-right">
                            {canActOnLeave && (
                              <div className="inline-flex gap-2">
                                <button
                                  disabled={busy}
                                  onClick={() => handleUpdateStatus(leave.id, 1)}
                                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Approve
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() => handleUpdateStatus(leave.id, 2)}
                                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Decline
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row">
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span>
                    {startIndex + 1}–{Math.min(endIndex, filteredLeaves.length)} of {filteredLeaves.length}
                  </span>
                  <select
                    value={itemsPerPage}
                    onChange={e => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    aria-label="Rows per page"
                  >
                    {[5, 10, 25, 50, 100].map(n => (
                      <option key={n} value={n}>
                        {n} / page
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-3 text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Reason Modal */}
        {reasonLeave && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm"
            onClick={() => setReasonLeave(null)}
          >
            <div
              className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{repName(reasonLeave)}</h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {reasonLeave.leaveType} · {formatDate(reasonLeave.startDate)} – {formatDate(reasonLeave.endDate)}
                  </p>
                </div>
                <button
                  onClick={() => setReasonLeave(null)}
                  className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mb-3">{getStatusBadge(reasonLeave.status)}</div>
              <div className="rounded-lg bg-gray-50 p-3.5">
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
                  {reasonLeave.reason || 'No reason provided.'}
                </p>
              </div>
              {attachmentOf(reasonLeave) && (
                <a
                  href={attachmentOf(reasonLeave)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  <Paperclip className="h-4 w-4" />
                  Open attachment
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesRepLeavesPage;
