import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  parseISO,
  addMonths,
  subMonths,
} from 'date-fns';
import { API_CONFIG } from '../config/api';
import {
  UsersIcon,
  FileTextIcon,
  AlertTriangleIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessageCircleIcon,
  ClockIcon,
  UserCheckIcon,
  UserXIcon,
  BuildingIcon,
  BriefcaseIcon,
  PlusIcon,
  Trash2Icon,
  ArrowUpRightIcon,
  PercentIcon,
  InboxIcon
} from 'lucide-react';
import io from 'socket.io-client';

const SOCKET_URL = API_CONFIG.getSocketUrl();

type Tone = 'red' | 'green' | 'amber' | 'blue' | 'purple' | 'cyan' | 'pink' | 'slate' | 'teal' | 'orange';

const TONES: Record<Tone, { chip: string; bar: string }> = {
  red: { chip: 'bg-red-50 text-red-600', bar: 'bg-red-500' },
  green: { chip: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
  amber: { chip: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500' },
  blue: { chip: 'bg-blue-50 text-blue-600', bar: 'bg-blue-500' },
  purple: { chip: 'bg-purple-50 text-purple-600', bar: 'bg-purple-500' },
  cyan: { chip: 'bg-cyan-50 text-cyan-600', bar: 'bg-cyan-500' },
  pink: { chip: 'bg-pink-50 text-pink-600', bar: 'bg-pink-500' },
  slate: { chip: 'bg-slate-100 text-slate-600', bar: 'bg-slate-500' },
  teal: { chip: 'bg-teal-50 text-teal-600', bar: 'bg-teal-500' },
  orange: { chip: 'bg-orange-50 text-orange-600', bar: 'bg-orange-500' }
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  subText?: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, gradient, subText, onClick }) => (
  <div
    className={`relative overflow-hidden rounded-xl sm:rounded-2xl shadow-md cursor-pointer group transition-all duration-200 active:scale-95 sm:hover:-translate-y-1 sm:hover:shadow-xl ${gradient}`}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
  >
    {/* Background decoration */}
    <div className="absolute -right-3 -top-3 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white opacity-10" />
    <div className="absolute -right-1 -bottom-4 w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-white opacity-5" />

    <div className="relative p-2.5 sm:p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-1">
          <p className="text-[9px] sm:text-[10px] font-semibold text-white/80 uppercase tracking-widest mb-0.5 truncate">
            {title}
          </p>
          <p className="text-lg sm:text-xl font-bold text-white leading-tight truncate">{value}</p>
          {subText && (
            <p className="text-[9px] sm:text-[10px] text-white/70 mt-0.5 line-clamp-1">{subText}</p>
          )}
        </div>
        <div className="flex-shrink-0 ml-1 sm:ml-2">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
            {icon}
          </div>
        </div>
      </div>
      {onClick && (
        <div className="flex items-center mt-1.5 sm:mt-2 text-white/70 group-hover:text-white transition-colors">
          <span className="text-[8px] sm:text-[9px] font-medium">View details</span>
          <ArrowUpRightIcon className="h-2 w-2 sm:h-2.5 sm:w-2.5 ml-0.5" />
        </div>
      )}
    </div>
  </div>
);

const HrDashboardPage: React.FC = () => {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiringContracts, setExpiringContracts] = useState<any[]>([]);
  const [hasNewChatMessage, setHasNewChatMessage] = useState(() => {
    return localStorage.getItem('hasNewChatMessage') === 'true';
  });
  const navigate = useNavigate();
  const location = useLocation();
  const socketRef = React.useRef<any>(null);

  // Calendar/task state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tasks, setTasks] = useState<{ [date: string]: { id: number; text: string }[] }>({});
  const [newTask, setNewTask] = useState('');

  // Calendar grid logic
  const monthKey = format(currentMonth, 'yyyy-MM');
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const weekStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarRows: Date[][] = [];
  let day = weekStart;
  while (day <= weekEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    calendarRows.push(week);
  }

  // Custom fetch function to avoid axios
  const fetchData = async (endpoint: string) => {
    const url = API_CONFIG.getUrl(endpoint);
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const [attendanceData, staffData, contractsData] = await Promise.all([
          fetchData('/attendance/today'),
          fetchData('/staff'),
          fetchData('/staff/contracts/expiring')
        ]);
        setAttendance(attendanceData);
        setStaff(staffData);
        setExpiringContracts(contractsData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  // Listen for new chat messages
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    socket.on('newMessage', () => {
      if (location.pathname !== '/chat-room') {
        setHasNewChatMessage(true);
        localStorage.setItem('hasNewChatMessage', 'true');
      }
    });
    return () => { socket.disconnect(); };
  }, [location.pathname]);

  // Clear notification when visiting chat room
  useEffect(() => {
    if (location.pathname === '/chat-room') {
      setHasNewChatMessage(false);
      localStorage.setItem('hasNewChatMessage', 'false');
    }
  }, [location.pathname]);

  // Fetch tasks for the current month (keyed on the month string so it only runs when the month changes)
  const fetchTasks = useCallback(async () => {
    try {
      const data = await fetchData(`/calendar-tasks?month=${monthKey}`);
      const grouped: { [date: string]: { id: number; text: string }[] } = {};
      for (const t of data) {
        const dateKey = t.date.slice(0, 10);
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push({ id: t.id, text: t.title });
      }
      setTasks(grouped);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  }, [monthKey]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const checkedIn = useMemo(() => attendance.filter(a => a.checkin_time), [attendance]);
  const checkedInCount = checkedIn.length;
  const totalCount = staff.length;
  const attendancePercentage = totalCount > 0 ? Math.round((checkedInCount / totalCount) * 100) : 0;
  const absentCount = Math.max(0, totalCount - checkedInCount);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const navigationItems: { to: string; label: string; icon: React.ReactNode; tone: Tone }[] = [
    { to: '/dashboard/staff-list', label: 'Staff List', icon: <UsersIcon className="h-4 w-4" />, tone: 'red' },
    { to: '/document-list', label: 'Documents', icon: <FileTextIcon className="h-4 w-4" />, tone: 'green' },
    { to: '/dashboard/expiring-contracts', label: 'Expiring Contracts', icon: <AlertTriangleIcon className="h-4 w-4" />, tone: 'amber' },
    { to: '/dashboard/employee-leaves', label: 'Employee Leaves', icon: <CalendarIcon className="h-4 w-4" />, tone: 'purple' },
    { to: '/dashboard/leave-report', label: 'Leave Report', icon: <FileTextIcon className="h-4 w-4" />, tone: 'blue' },
    { to: '/employee-working-hours', label: 'Attendance History', icon: <ClockIcon className="h-4 w-4" />, tone: 'green' },
    { to: '/employee-working-days', label: 'Working Days', icon: <CalendarIcon className="h-4 w-4" />, tone: 'amber' },
    { to: '/public-holidays', label: 'Public Holidays', icon: <CalendarIcon className="h-4 w-4" />, tone: 'orange' },
    { to: '/out-of-office-requests', label: 'Out of Office', icon: <UserXIcon className="h-4 w-4" />, tone: 'pink' },
    { to: '/sales-reps', label: 'Sales Reps', icon: <BuildingIcon className="h-4 w-4" />, tone: 'cyan' },
    { to: '/department-expenses/upload', label: 'Dept Expenses', icon: <BriefcaseIcon className="h-4 w-4" />, tone: 'slate' },
    { to: '/instant-chat', label: 'Chat Room', icon: <MessageCircleIcon className="h-4 w-4" />, tone: 'teal' }
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const formatHours = (checkin: Date, checkout: Date | null) => {
    const end = checkout || new Date();
    const diffMs = Math.max(0, end.getTime() - checkin.getTime());
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs / (1000 * 60)) % 60);
    return `${hours}h ${mins}m`;
  };

  const selectedTasks = tasks[selectedDate] ?? [];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">{greeting}</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-gray-900">HR Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Employees, attendance and HR operations at a glance.</p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm sm:self-auto">
            <CalendarIcon className="h-4 w-4 text-gray-400" />
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </div>
        </div>

        {/* Stat cards */}
        <div className="mb-5 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <StatCard
            title="Total Employees"
            value={loading ? '–' : totalCount}
            icon={<UsersIcon className="h-4 w-4 text-white" />}
            gradient="bg-gradient-to-br from-red-500 to-red-700"
            subText="Active staff records"
            onClick={() => navigate('/dashboard/staff-list')}
          />
          <StatCard
            title="Present Today"
            value={loading ? '–' : `${checkedInCount} / ${totalCount}`}
            icon={<UserCheckIcon className="h-4 w-4 text-white" />}
            gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
            subText="Checked in so far"
            onClick={() => navigate('/attendance-history')}
          />
          <StatCard
            title="Attendance Rate"
            value={loading ? '–' : `${attendancePercentage}%`}
            icon={<PercentIcon className="h-4 w-4 text-white" />}
            gradient="bg-gradient-to-br from-purple-500 to-purple-700"
            subText="Of all employees"
            onClick={() => navigate('/attendance-history')}
          />
          <StatCard
            title="Expiring Contracts"
            value={loading ? '–' : expiringContracts.length}
            icon={<AlertTriangleIcon className="h-4 w-4 text-white" />}
            gradient="bg-gradient-to-br from-amber-500 to-amber-700"
            subText={expiringContracts.length > 0 ? 'Needs your attention' : 'Nothing expiring soon'}
            onClick={() => navigate('/dashboard/expiring-contracts')}
          />
        </div>

        {/* Quick links */}
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Quick links</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {navigationItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-gray-300 hover:shadow-md"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONES[item.tone].chip}`}>
                  {item.icon}
                </span>
                <span className="text-sm font-medium leading-tight text-gray-700 group-hover:text-gray-900">{item.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Main content */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Attendance */}
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:col-span-2">
            <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Today's attendance</h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {loading
                    ? 'Loading…'
                    : `${checkedInCount} checked in · ${absentCount} not yet in`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-medium text-white transition hover:bg-red-700"
                  onClick={() => navigate('/attendance-history')}
                >
                  History
                </button>
                <button
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                  onClick={() => navigate('/employee-working-hours')}
                >
                  <ClockIcon className="h-3.5 w-3.5" />
                  Working hours
                </button>
                <button
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                  onClick={() => navigate('/employee-working-days')}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Working days
                </button>
              </div>
            </div>

            {loading ? (
              <div className="divide-y divide-gray-100">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex animate-pulse items-center gap-4 px-4 py-4">
                    <div className="h-3 w-32 rounded bg-gray-100" />
                    <div className="h-3 w-20 rounded bg-gray-100" />
                    <div className="ml-auto h-3 w-40 rounded bg-gray-100" />
                  </div>
                ))}
              </div>
            ) : checkedIn.length === 0 ? (
              <div className="px-4 py-14 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <InboxIcon className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-900">No check-ins yet</h3>
                <p className="mt-1 text-sm text-gray-500">Check-ins recorded today will appear here.</p>
              </div>
            ) : (
              <div className="max-h-[480px] overflow-auto">
                <table className="min-w-full">
                  <thead className="sticky top-0 bg-gray-50/90 backdrop-blur">
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Check-in</th>
                      <th className="px-4 py-3">Check-out</th>
                      <th className="px-4 py-3">Hours</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {checkedIn.map(a => {
                      const checkin = new Date(a.checkin_time);
                      const checkout = a.checkout_time ? new Date(a.checkout_time) : null;
                      const time = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <tr key={a.id} className="transition-colors hover:bg-gray-50/70">
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{a.name || a.staff_id}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{a.department || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{time(checkin)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{checkout ? time(checkout) : '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{formatHours(checkin, checkout)}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {checkout ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                Checked out
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Present
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Calendar & tasks */}
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h2 className="text-base font-semibold text-gray-900">Calendar & tasks</h2>
              <button
                onClick={() => navigate('/chat-room')}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50"
                aria-label="Open chat room"
              >
                <MessageCircleIcon className="h-4 w-4" />
                {hasNewChatMessage && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>
            </div>

            <div className="p-4">
              {/* Month header */}
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">{format(currentMonth, 'MMMM yyyy')}</h3>
                <div className="flex gap-1">
                  <button
                    onClick={handlePrevMonth}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
                    aria-label="Previous month"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
                    aria-label="Next month"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Calendar grid */}
              <div className="mb-4">
                <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-gray-400">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <div key={i} className="flex h-6 items-center justify-center">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarRows.flat().map((date, idx) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const hasTasks = (tasks[dateStr]?.length ?? 0) > 0;
                    const isSelected = selectedDate === dateStr;
                    const isCurrentMonth = isSameMonth(date, monthStart);
                    const isToday = isSameDay(date, new Date());

                    return (
                      <button
                        key={dateStr + idx}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`relative flex h-9 items-center justify-center rounded-lg text-sm transition
                          ${isSelected
                            ? 'bg-red-600 font-semibold text-white shadow-sm'
                            : isToday
                              ? 'bg-red-50 font-semibold text-red-700 hover:bg-red-100'
                              : isCurrentMonth
                                ? 'text-gray-700 hover:bg-gray-100'
                                : 'text-gray-300 hover:bg-gray-50'}`}
                      >
                        {date.getDate()}
                        {hasTasks && (
                          <span
                            className={`absolute bottom-1 h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-red-500'}`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected date tasks */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="mb-3 text-sm font-medium text-gray-800">
                  {format(parseISO(selectedDate), 'EEEE, MMMM d')}
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}
                  </span>
                </h3>

                <form
                  className="mb-3 flex gap-2"
                  onSubmit={async e => {
                    e.preventDefault();
                    if (!newTask.trim()) return;
                    try {
                      const response = await fetch(API_CONFIG.getUrl('/calendar-tasks'), {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${localStorage.getItem('token')}`
                        },
                        body: JSON.stringify({ date: selectedDate, title: newTask })
                      });
                      if (response.ok) {
                        fetchTasks();
                        setNewTask('');
                      }
                    } catch (error) {
                      console.error('Error adding task:', error);
                    }
                  }}
                >
                  <input
                    type="text"
                    className="h-9 flex-1 rounded-lg border border-gray-200 px-3 text-sm placeholder-gray-400 transition focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    placeholder="Add a task…"
                    value={newTask}
                    onChange={e => setNewTask(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center gap-1 rounded-lg bg-red-600 px-3 text-sm font-medium text-white transition hover:bg-red-700"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add
                  </button>
                </form>

                <div className="max-h-44 space-y-1.5 overflow-y-auto">
                  {selectedTasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 py-5 text-center text-sm text-gray-400">
                      Nothing scheduled for this day.
                    </div>
                  ) : (
                    selectedTasks.map(task => (
                      <div
                        key={task.id}
                        className="group flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 transition hover:bg-gray-100"
                      >
                        <span className="text-sm text-gray-700">{task.text}</span>
                        <button
                          className="rounded p-1 text-gray-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                          aria-label="Delete task"
                          onClick={async () => {
                            try {
                              const response = await fetch(API_CONFIG.getUrl(`/calendar-tasks/${task.id}`), {
                                method: 'DELETE',
                                headers: {
                                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                                }
                              });
                              if (response.ok) {
                                fetchTasks();
                              }
                            } catch (error) {
                              console.error('Error deleting task:', error);
                            }
                          }}
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HrDashboardPage;
