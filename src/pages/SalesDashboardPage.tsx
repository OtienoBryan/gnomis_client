import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Cell
} from 'recharts';
import { API_CONFIG } from '../config/api';
import {
  TrendingUpIcon, UsersIcon, ShoppingCartIcon,
  BarChart3Icon, CalendarIcon, MapPinIcon, FileTextIcon,
  X, ChevronRightIcon, ClipboardListIcon, ActivityIcon,
  CheckCircle2Icon, AlertCircleIcon, ArrowUpRightIcon, PiggyBankIcon,
} from 'lucide-react';

/* ──────────────────────────── StatCard ──────────────────────────── */
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  prefix?: string;
  suffix?: string;
  gradient: string;
  onClick?: () => void;
  subText?: string;
}

const StatCard: React.FC<StatCardProps> = memo(({
  title, value, icon, prefix = '', suffix = '', gradient, onClick, subText
}) => (
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
          <p className="text-lg sm:text-xl font-bold text-white leading-tight truncate">
            {prefix}{value}
          </p>
          {suffix && (
            <p className="text-[9px] sm:text-[10px] text-white/70 mt-0.5 line-clamp-1">{suffix}</p>
          )}
          {subText && (
            <p className="text-[9px] sm:text-[10px] text-white/60 mt-0.5 truncate">{subText}</p>
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
));
StatCard.displayName = 'StatCard';

/* ──────────────────────────── Skeleton ──────────────────────────── */
const SkeletonCard = memo(() => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 animate-pulse">
    <div className="h-3 bg-gray-200 rounded w-1/3 mb-4" />
    <div className="h-7 bg-gray-200 rounded w-1/2 mb-2" />
    <div className="h-3 bg-gray-200 rounded w-1/4" />
  </div>
));
SkeletonCard.displayName = 'SkeletonCard';

const SkeletonChart = memo(() => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 animate-pulse">
    <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
    <div className="h-56 bg-gray-100 rounded-xl" />
  </div>
));
SkeletonChart.displayName = 'SkeletonChart';

/* ──────────────────────────── Main Page ──────────────────────────── */
// Icon tile colours, keyed by the colour name used in navGroups (static classes so Tailwind keeps them)
const TILE_ACCENTS: Record<string, string> = {
  red: 'bg-red-50 text-red-600',
  gray: 'bg-gray-100 text-gray-600',
  lime: 'bg-lime-50 text-lime-600',
  green: 'bg-emerald-50 text-emerald-600',
  sky: 'bg-sky-50 text-sky-600',
  teal: 'bg-teal-50 text-teal-600',
  pink: 'bg-pink-50 text-pink-600',
  slate: 'bg-slate-100 text-slate-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  orange: 'bg-orange-50 text-orange-600',
  yellow: 'bg-yellow-50 text-yellow-600',
};

const SalesDashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [stats, setStats] = useState({
    totalSales: 0,
    outletsVisitedThisMonth: 0,
    totalOrders: 0,
    activeReps: 0,
    checkedInReps: 0,
    totalActiveReps: 0,
    activeTeamLeaders: 0,
    checkedInTeamLeaders: 0,
    avgPerformance: 0,
  });
  const [topProductsSold, setTopProductsSold] = useState<{ product_name: string; product_code: string; quantity: number; amount: number }[]>([]);
  const [topReps, setTopReps] = useState<{ name: string; overall: number }[]>([]);
  const [pendingLeavesCount, setPendingLeavesCount] = useState(0);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [pendingCollectionsCount, setPendingCollectionsCount] = useState(0);
  const [lowRawMaterialsCount, setLowRawMaterialsCount] = useState(0);
  const [belowTargetProductsCount, setBelowTargetProductsCount] = useState(0);
  const [outletsVisited, setOutletsVisited] = useState<{ month: string; outlets: number }[]>([]);
  const [ordersSummary, setOrdersSummary] = useState<{ month: string; quantity: number }[]>([]);


  // Checked-in Team Leaders modal
  const [activeLeadersModalOpen, setActiveLeadersModalOpen] = useState(false);
  const [activeTeamLeaders, setActiveTeamLeaders] = useState<Array<{
    id: number; name: string; email?: string;
    route_name?: string; region_name?: string; checkInTime?: string; checkoutTime?: string;
  }>>([]);
  const [loadingActiveLeaders, setLoadingActiveLeaders] = useState(false);

  const navigate = useNavigate();

  /* ── fetch helper ── */
  const fetchData = useCallback(async (endpoint: string, params?: any) => {
    const url = new URL(API_CONFIG.getUrl(endpoint), window.location.origin);
    if (params) Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
    const res = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, []);

  /* ── core data ── */
  const fetchCoreData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchData('/dashboard/sales-dashboard-data');
      if (result.success && result.data) {
        const d = result.data;
        setStats(d.stats);
        setTopProductsSold(d.topProductsSold || []);
        setTopReps(d.topReps || []);
        setPendingLeavesCount(d.pendingLeavesCount || 0);
        setNewOrdersCount(d.newOrdersCount || 0);
      }
    } catch (e: any) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  /* ── charts data ── */
  const fetchChartsData = useCallback(async () => {
    try {
      const [outletsResult, ordersSummaryResult] = await Promise.all([
        fetchData('/dashboard/outlets-visited'),
        fetchData('/dashboard/orders-summary')
      ]);
      if (outletsResult.success && outletsResult.data) {
        setOutletsVisited(outletsResult.data || []);
      }
      if (ordersSummaryResult.success && ordersSummaryResult.data) {
        setOrdersSummary(ordersSummaryResult.data || []);
      }
    } catch {
      // charts are non-critical
    } finally {
      setChartsLoading(false);
    }
  }, [fetchData]);

  useEffect(() => { fetchCoreData(); }, [fetchCoreData]);

  /* ── raw material badges: pending requests and raw materials at or below their alert qty ── */
  useEffect(() => {
    fetchData('/financial/raw-material-requests', { status: 'pending' })
      .then(res => setPendingRequestsCount(Array.isArray(res.data) ? res.data.length : 0))
      .catch(() => {});
    // Payment collections waiting for review
    fetchData('/financial/payment-collections', { status: 'Pending' })
      .then(res => setPendingCollectionsCount(Array.isArray(res.data) ? res.data.length : 0))
      .catch(() => {});
    // Products whose total stock (all stores) is below their target quantity
    fetchData('/financial/stores-inventory')
      .then(res => {
        const rows: { product_id: number; quantity: number; target_stock_qty?: number }[] = Array.isArray(res.data) ? res.data : [];
        const totals = new Map<number, { total: number; target: number }>();
        rows.forEach(r => {
          const t = totals.get(r.product_id) || { total: 0, target: Number(r.target_stock_qty) || 0 };
          t.total += Number(r.quantity) || 0;
          totals.set(r.product_id, t);
        });
        setBelowTargetProductsCount(Array.from(totals.values()).filter(t => t.target > 0 && t.total < t.target).length);
      })
      .catch(() => {});
    fetchData('/financial/raw-materials/inventory')
      .then(res => {
        const materials: { alert_qty: number; total: number }[] = res.data?.materials || [];
        setLowRawMaterialsCount(materials.filter(m => Number(m.alert_qty) > 0 && Number(m.total) <= Number(m.alert_qty)).length);
      })
      .catch(() => {});
  }, [fetchData]);
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(fetchChartsData, 100);
      return () => clearTimeout(t);
    }
  }, [loading, fetchChartsData]);

  const handleRefresh = useCallback(async () => {
    setChartsLoading(true);
    await fetchCoreData();
    await fetchChartsData();
  }, [fetchCoreData, fetchChartsData]);

  /* ── checked-in reps ── */
  const fetchActiveTeamLeaders = useCallback(async () => {
    setLoadingActiveLeaders(true);
    try {
      const result = await fetchData('/dashboard/checked-in-sales-reps', { role: 'leader' });
      if (result.success && result.data) {
        const leaders = Array.isArray(result.data) ? result.data : [];
        setActiveTeamLeaders(
          [...leaders].sort((a: any, b: any) =>
            new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
          )
        );
      } else {
        setActiveTeamLeaders([]);
      }
    } catch {
      setActiveTeamLeaders([]);
    } finally {
      setLoadingActiveLeaders(false);
    }
  }, [fetchData]);

  const openActiveLeadersModal = useCallback(() => {
    setActiveLeadersModalOpen(true);
    fetchActiveTeamLeaders();
  }, [fetchActiveTeamLeaders]);

  /* ── navigation ── */
  const navGroups = useMemo(() => [
    {
      label: 'People',
      items: [
        { to: '/sales-reps', label: 'Staff', icon: <UsersIcon className="h-4 w-4" />, color: 'bg-white text-red-700 border-gray-300 hover:bg-red-50' },
        { to: '/staff-location', label: 'Staff Location', icon: <MapPinIcon className="h-4 w-4" />, color: 'bg-white text-pink-700 border-gray-300 hover:bg-pink-50' },
        { to: '/petty-cash/balances', label: 'Staff Petty Cash', icon: <PiggyBankIcon className="h-4 w-4" />, color: 'bg-white text-green-700 border-gray-300 hover:bg-green-50' },
        { to: '/payment-collections', label: 'Payment Collections', icon: <FileTextIcon className="h-4 w-4" />, color: 'bg-white text-emerald-700 border-gray-300 hover:bg-emerald-50', badge: pendingCollectionsCount },
        { to: '/activity', label: 'Sales Rep Activity', icon: <ActivityIcon className="h-4 w-4" />, color: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50' },
        { to: '/dashboard/route-compliance', label: 'Sales Rep Compliance', icon: <CheckCircle2Icon className="h-4 w-4" />, color: 'bg-white text-lime-700 border-gray-300 hover:bg-lime-50' },
        { to: '/sales-rep-leaves', label: 'Sales Rep Leaves', icon: <CalendarIcon className="h-4 w-4" />, color: 'bg-white text-green-700 border-gray-300 hover:bg-green-50', badge: pendingLeavesCount },
        { to: '/sales-rep-working-days', label: 'Working Days', icon: <ClipboardListIcon className="h-4 w-4" />, color: 'bg-white text-sky-700 border-gray-300 hover:bg-sky-50' },
        { to: '/sales-rep-attendance', label: 'Sales Rep Attendance', icon: <BarChart3Icon className="h-4 w-4" />, color: 'bg-white text-teal-700 border-gray-300 hover:bg-teal-50' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { to: '/products', label: 'Products', icon: <ShoppingCartIcon className="h-4 w-4" />, color: 'bg-white text-red-700 border-gray-300 hover:bg-red-50' },
        { to: '/store-inventory', label: 'Products Inventory', icon: <ClipboardListIcon className="h-4 w-4" />, color: 'bg-white text-violet-700 border-gray-300 hover:bg-violet-50', badge: belowTargetProductsCount },
        { to: '/raw-materials-inventory', label: 'Raw Materials Inventory', icon: <ClipboardListIcon className="h-4 w-4" />, color: 'bg-white text-teal-700 border-gray-300 hover:bg-teal-50', badge: lowRawMaterialsCount },
        { to: '/raw-material-requests', label: 'Raw Material Requests', icon: <FileTextIcon className="h-4 w-4" />, color: 'bg-white text-amber-700 border-gray-300 hover:bg-amber-50', badge: pendingRequestsCount },
        { to: '/clients-list', label: 'Outlets', icon: <MapPinIcon className="h-4 w-4" />, color: 'bg-white text-pink-700 border-gray-300 hover:bg-pink-50' },
        { to: '/routes', label: 'Routes', icon: <MapPinIcon className="h-4 w-4" />, color: 'bg-white text-slate-700 border-gray-300 hover:bg-slate-50' },
        { to: '/dashboard/journey-plans', label: 'Route Plans', icon: <ActivityIcon className="h-4 w-4" />, color: 'bg-white text-amber-700 border-gray-300 hover:bg-amber-50' },
       ],
    },
    {
      label: 'Suppliers & Purchases',
      items: [
        { to: '/suppliers', label: 'Suppliers', icon: <UsersIcon className="h-4 w-4" />, color: 'bg-white text-amber-700 border-gray-300 hover:bg-amber-50' },
        { to: '/purchase-orders', label: 'Purchase Orders', icon: <ShoppingCartIcon className="h-4 w-4" />, color: 'bg-white text-red-700 border-gray-300 hover:bg-red-50' },
        { to: '/supplier-invoices', label: 'Supplier Invoices', icon: <FileTextIcon className="h-4 w-4" />, color: 'bg-white text-sky-700 border-gray-300 hover:bg-sky-50' },
        { to: '/supplier-payments', label: 'Supplier Payments', icon: <FileTextIcon className="h-4 w-4" />, color: 'bg-white text-green-700 border-gray-300 hover:bg-green-50' },
        { to: '/payables', label: 'Payables', icon: <ClipboardListIcon className="h-4 w-4" />, color: 'bg-white text-violet-700 border-gray-300 hover:bg-violet-50' },
      ],
    },
    {
      label: 'Reports & Analytics',
      items: [
        { to: '/raw-material-usage', label: 'Raw Materials Used', icon: <BarChart3Icon className="h-4 w-4" />, color: 'bg-white text-sky-700 border-gray-300 hover:bg-sky-50' },
        { to: '/produced-products', label: 'Produced Products', icon: <BarChart3Icon className="h-4 w-4" />, color: 'bg-white text-indigo-700 border-gray-300 hover:bg-indigo-50' },
        //{ to: '/shared-performance', label: 'Sales Rep Performance', icon: <TrendingUpIcon className="h-4 w-4" />, color: 'bg-white text-rose-700 border-gray-300 hover:bg-rose-50' },
        { to: '/overall-attendance', label: 'Sales Rep Attendance Report', icon: <BarChart3Icon className="h-4 w-4" />, color: 'bg-white text-violet-700 border-gray-300 hover:bg-violet-50' },
        //{ to: '/dashboard/reports/product-performance', label: 'Product Perf.', icon: <PieChartIcon className="h-4 w-4" />, color: 'bg-white text-cyan-700 border-gray-300 hover:bg-cyan-50' },
        { to: '/van-sales', label: 'Van Sales', icon: <ShoppingCartIcon className="h-4 w-4" />, color: 'bg-white text-green-700 border-gray-300 hover:bg-green-50' },
        { to: '/financial/customer-orders', label: 'Orders Report', icon: <FileTextIcon className="h-4 w-4" />, color: 'bg-white text-red-700 border-gray-300 hover:bg-red-50', badge: newOrdersCount },
        { to: '/notices', label: 'Notices', icon: <FileTextIcon className="h-4 w-4" />, color: 'bg-white text-yellow-700 border-gray-300 hover:bg-yellow-50' },
        { to: '/document-list', label: 'Documents', icon: <FileTextIcon className="h-4 w-4" />, color: 'bg-white text-amber-700 border-gray-300 hover:bg-amber-50' },
        { to: '/visits', label: 'Visit Reports', icon: <MapPinIcon className="h-4 w-4" />, color: 'bg-white text-teal-700 border-gray-300 hover:bg-teal-50' },
      ],
    },
  ], [pendingLeavesCount, newOrdersCount, pendingRequestsCount, lowRawMaterialsCount, belowTargetProductsCount, pendingCollectionsCount]);


  const checkedInPct = stats.totalActiveReps > 0
    ? ((stats.checkedInReps || 0) / stats.totalActiveReps * 100).toFixed(1)
    : '0.0';

  const checkedInLeadersPct = stats.activeTeamLeaders > 0
    ? ((stats.checkedInTeamLeaders || 0) / stats.activeTeamLeaders * 100).toFixed(1)
    : '0.0';

  /* ── loading / error ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
        <div className="w-full">
          <div className="h-8 bg-gray-200 rounded w-40 animate-pulse mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonChart key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl p-10 shadow-sm border border-gray-100">
          <AlertCircleIcon className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-1">Failed to load dashboard</h2>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={handleRefresh} className="px-5 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ──────────────────────────── RENDER ──────────────────────────── */
  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      {/* ── Top Banner ── */}
      {/* <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white px-4 lg:px-8 py-4">
        <div className="w-full flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">NKCC</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCwIcon className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div> */}

      <div className="w-full px-3 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-4 sm:space-y-5">

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <StatCard
            title="Outlets Visited"
            value={Number(stats.outletsVisitedThisMonth || 0).toLocaleString()}
            icon={<MapPinIcon className="h-4 w-4 text-white" />}
            gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
            onClick={() => navigate('/visits')}
            subText="This month"
          />
          <StatCard
            title="Active Team Leaders"
            value={`${stats.checkedInTeamLeaders || 0} / ${stats.activeTeamLeaders || 0}`}
            icon={<UsersIcon className="h-4 w-4 text-white" />}
            suffix={`${checkedInLeadersPct}% with active teams`}
            gradient="bg-gradient-to-br from-red-500 to-red-700"
            onClick={openActiveLeadersModal}
          />
          <StatCard
            title="Checked-In Sales Reps"
            value={`${stats.checkedInReps || 0} / ${stats.totalActiveReps || 0}`}
            icon={<UsersIcon className="h-4 w-4 text-white" />}
            suffix={`${checkedInPct}% of active Sales Reps`}
            gradient="bg-gradient-to-br from-purple-500 to-purple-700"
            onClick={() => navigate('/checked-in-sales-reps')}
          />
          <StatCard
            title="Avg Performance"
            value={`${stats.avgPerformance}%`}
            icon={<TrendingUpIcon className="h-5 w-5 text-white" />}
            gradient="bg-gradient-to-br from-orange-500 to-orange-700"
            onClick={() => navigate('/shared-performance')}
            subText="Overall score"
          />
        </div>

        {/* ── Quick Navigation ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
          {navGroups.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-5 pt-5 border-t border-gray-200' : ''}>
              <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">{group.label}</h2>
              <div className="flex flex-wrap gap-3.5">
                {group.items.map((item, idx) => {
                  const accent = TILE_ACCENTS[item.color.match(/text-(\w+)-700/)?.[1] || ''] || TILE_ACCENTS.gray;
                  return (
                    <Link
                      key={idx}
                      to={item.to}
                      className="group relative w-32 min-h-[84px] bg-white border border-gray-200 rounded-xl px-2 py-3 flex flex-col items-center justify-center text-center gap-2 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-300"
                    >
                      <div className={`${accent} h-9 w-9 flex items-center justify-center rounded-xl`}>
                        {item.icon}
                      </div>
                      <span className="text-[11px] font-medium text-gray-700 leading-tight">{item.label}</span>
                      {!!item.badge && item.badge > 0 && (
                        <span className="absolute -top-2 -right-2 inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 rounded-full text-[10px] font-semibold bg-red-500 text-white shadow">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts Row 1 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Product Sold Performance */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-2 sm:gap-0">
              <div className="flex-1">
                <h2 className="text-xs sm:text-sm font-bold text-gray-900">Product Sold Performance</h2>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Top 10 products by quantity sold this month</p>
              </div>
              <button
                onClick={() => navigate('/products-sale-report')}
                className="flex items-center gap-1 text-[10px] sm:text-xs font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition-colors self-start sm:self-auto"
              >
                Details <ChevronRightIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              </button>
            </div>
            {topProductsSold.length > 0 ? (
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
                <BarChart data={topProductsSold} margin={{ top: 8, right: 16, left: 0, bottom: isMobile ? 60 : 40 }}>
                  <defs>
                    <linearGradient id="productSoldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="product_name"
                    stroke="#9ca3af"
                    tick={{ fontSize: window.innerWidth < 640 ? 8 : 10 }}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    height={isMobile ? 70 : 50}
                  />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: window.innerWidth < 640 ? 9 : 11 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: any) => [v, 'Quantity Sold']}
                    labelFormatter={(label: any) => label}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                  />
                  <Bar dataKey="quantity" fill="url(#productSoldGradient)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex flex-col items-center justify-center text-gray-400">
                <BarChart3Icon className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-xs">No product sales data available</p>
              </div>
            )}
          </div>

          {/* Outlets Visited */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-2 sm:gap-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-xs sm:text-sm font-bold text-gray-900 truncate">Outlets Visited</h2>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 line-clamp-1">Unique outlets visited per month</p>
              </div>
              {outletsVisited.length > 0 && (
                <div className="text-left sm:text-right flex-shrink-0">
                  <p className="text-[10px] sm:text-xs font-semibold text-red-600">
                    {outletsVisited.reduce((sum, item) => sum + item.outlets, 0).toLocaleString()}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-gray-400">Total outlets</p>
                </div>
              )}
            </div>
            {chartsLoading ? (
              <div className="h-40 sm:h-52 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-2 border-red-500 border-t-transparent" />
              </div>
            ) : outletsVisited.length > 0 ? (
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
                <BarChart data={outletsVisited} margin={{ top: 12, right: 20, left: -10, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="#6b7280"
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    angle={-35}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v.toLocaleString()}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3">
                            <p className="text-xs font-semibold text-gray-600 mb-1">{payload[0].payload.month}</p>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                              <p className="text-sm font-bold text-gray-900">
                                {payload[0].value?.toLocaleString()} <span className="text-xs font-normal text-gray-500">outlets</span>
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="outlets"
                    fill="#10b981"
                    radius={[8, 8, 0, 0]}
                  >
                    {outletsVisited.map((entry: any, index: number) => {
                      const maxValue = Math.max(...outletsVisited.map((e: any) => e.outlets));
                      const isMax = entry.outlets === maxValue;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={isMax ? "#047857" : "#10b981"}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex flex-col items-center justify-center text-gray-400">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <MapPinIcon className="h-8 w-8 opacity-40" />
                </div>
                <p className="text-xs font-medium">No outlets visited data available</p>
                <p className="text-[10px] text-gray-400 mt-1">Data will appear here once visits are recorded</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Charts Row 2 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Orders Summary */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-2 sm:gap-0">
              <div className="flex items-center gap-2 flex-1">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#088F8F' }}>
                  <ShoppingCartIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-bold text-gray-900 truncate">Orders Summary</h2>
                  <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 line-clamp-1">Total quantity ordered per month</p>
                </div>
              </div>
              {ordersSummary.length > 0 && (
                <div className="text-left sm:text-right flex-shrink-0">
                  <p className="text-[10px] sm:text-xs font-semibold" style={{ color: '#088F8F' }}>
                    {ordersSummary.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-gray-400">Total quantity</p>
                </div>
              )}
            </div>
            {chartsLoading ? (
              <div className="h-40 sm:h-52 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-2 border-t-transparent" style={{ borderColor: '#088F8F' }} />
              </div>
            ) : ordersSummary.length > 0 ? (
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
                <BarChart data={ordersSummary} margin={{ top: 12, right: 20, left: -10, bottom: 8 }}>
                  <defs>
                    <filter id="ordersShadow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
                      <feOffset dx="0" dy="2" result="offsetblur" />
                      <feComponentTransfer>
                        <feFuncA type="linear" slope="0.3" />
                      </feComponentTransfer>
                      <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#6b7280" 
                    tick={{ fontSize: isMobile ? 8 : 10, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    angle={isMobile ? -45 : -35}
                    textAnchor="end"
                    height={isMobile ? 70 : 60}
                  />
                  <YAxis 
                    stroke="#6b7280" 
                    tick={{ fontSize: isMobile ? 8 : 10, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v.toLocaleString()}
                    width={isMobile ? 35 : 50}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3">
                            <p className="text-xs font-semibold text-gray-600 mb-1">{payload[0].payload.month}</p>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#088F8F' }}></div>
                              <p className="text-sm font-bold text-gray-900">
                                {payload[0].value?.toLocaleString()} <span className="text-xs font-normal text-gray-500">units</span>
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="quantity" 
                    fill="#088F8F" 
                    radius={[8, 8, 0, 0]}
                    filter="url(#ordersShadow)"
                  >
                    {ordersSummary.map((_: any, index: number) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill="#088F8F"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex flex-col items-center justify-center text-gray-400">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <ShoppingCartIcon className="h-8 w-8 opacity-40" />
                </div>
                <p className="text-xs font-medium">No orders summary data available</p>
                <p className="text-[10px] text-gray-400 mt-1">Data will appear here once orders are recorded</p>
              </div>
            )}
          </div>

          {/* Top 10 Sales Reps */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4 lg:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-2 sm:gap-0">
              <div className="flex-1">
                <h2 className="text-xs sm:text-sm font-bold text-gray-900">Top 10 Sales Reps</h2>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Overall performance score</p>
              </div>
              <button
                onClick={() => navigate('/shared-performance')}
                className="flex items-center gap-1 text-[10px] sm:text-xs font-medium text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition-colors self-start sm:self-auto"
              >
                Details <ChevronRightIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              </button>
            </div>
            {topReps.length > 0 ? (
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
                <BarChart data={topReps} layout="vertical" margin={{ top: 0, right: window.innerWidth < 640 ? 8 : 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis 
                    type="number" 
                    domain={[0, 100]} 
                    tickFormatter={v => `${v}%`} 
                    stroke="#9ca3af" 
                    tick={{ fontSize: window.innerWidth < 640 ? 9 : 11 }} 
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={isMobile ? 60 : 90}
                    stroke="#9ca3af" 
                    tick={{ fontSize: isMobile ? 8 : 10 }}
                  />
                  <Tooltip
                    formatter={(v: any) => [`${v}%`, 'Performance']}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: 12 }}
                  />
                  <Bar dataKey="overall" fill="#f59e0b" name="Overall %" radius={[0, 4, 4, 0]}>
                    {topReps.map((_: any, i: number) => (
                      <Cell key={i} fill={i < 3 ? '#f59e0b' : '#fbbf24'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex flex-col items-center justify-center text-gray-400">
                <BarChart3Icon className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-xs">No Sales Rep data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ──────────── Checked-In Team Leaders Modal ──────────── */}
      {activeLeadersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden" style={{ maxHeight: '95vh' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-red-600 to-red-600 flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <UsersIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs sm:text-sm font-bold text-white truncate">Checked-In Team Leaders</h2>
                  <p className="text-[9px] sm:text-[10px] text-red-200 truncate">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveLeadersModalOpen(false)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0 ml-2"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
              </button>
            </div>

            {/* Summary strip */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 bg-red-50 border-b border-red-100 flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="text-sm sm:text-base font-bold text-red-800 leading-none">{activeTeamLeaders.length}</span>
                <span className="text-[10px] sm:text-xs text-red-600">Team leaders checked in today</span>
                {stats.activeTeamLeaders > 0 && (
                  <span className="px-1.5 sm:px-2 py-0.5 bg-red-200 text-red-800 text-[9px] sm:text-[10px] font-bold rounded-full">
                    {checkedInLeadersPct}% with active teams
                  </span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-2 sm:p-0">
              {loadingActiveLeaders ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-500 border-t-transparent mb-4" />
                  <p className="text-xs sm:text-sm">Loading checked-in team leaders...</p>
                </div>
              ) : activeTeamLeaders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <AlertCircleIcon className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-xs sm:text-sm font-medium">No team leaders have checked in today</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        {['#', 'Name', 'Check-In', 'Check-Out', 'Time Spent', 'Route', 'Region'].map(h => (
                          <th key={h} className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activeTeamLeaders.map((leader, idx) => {
                        const checkInTime = leader.checkInTime
                          ? new Date(leader.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                          : '—';
                        const checkoutTime = leader.checkoutTime
                          ? new Date(leader.checkoutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                          : '—';

                        // Calculate time spent
                        let timeSpent = '—';
                        if (leader.checkInTime) {
                          const start = new Date(leader.checkInTime).getTime();
                          const end = leader.checkoutTime ? new Date(leader.checkoutTime).getTime() : Date.now();
                          if (!isNaN(start) && !isNaN(end) && end >= start) {
                            const diffMinutes = Math.round((end - start) / (1000 * 60));
                            const hours = Math.floor(diffMinutes / 60);
                            const mins = diffMinutes % 60;
                            timeSpent = `${hours}h ${mins}m`;
                          }
                        }

                        return (
                          <tr key={leader.id} className="hover:bg-gray-50">
                            <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">{idx + 1}</td>
                            <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs font-medium text-gray-800 whitespace-nowrap">
                              {leader.name}
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {checkInTime}
                              </span>
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs whitespace-nowrap">
                              {checkoutTime !== '—' ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                                  {checkoutTime}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-100">
                                  Ongoing
                                </span>
                              )}
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs text-gray-700 whitespace-nowrap">
                              {timeSpent}
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs text-gray-700 whitespace-nowrap">
                              {leader.route_name || '—'}
                            </td>
                            <td className="px-2 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs text-gray-700 whitespace-nowrap">
                              {leader.region_name || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SalesDashboardPage;
