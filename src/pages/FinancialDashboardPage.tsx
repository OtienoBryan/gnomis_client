import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  DollarSignIcon,
  ShoppingCartIcon,
  UsersIcon,
  PackageIcon,
  AlertTriangleIcon,
  FileTextIcon,
  BuildingIcon,
  BarChart3Icon,
  BoxIcon,
  ClockIcon,
  SettingsIcon,
  CalculatorIcon,
  PiggyBankIcon,
  MessageSquareIcon,
  ReceiptIcon,
  CarIcon,
  MapPinIcon
} from 'lucide-react';
import { dashboardService } from '../services/financialService';
import { API_CONFIG } from '../config/api';
import type { DashboardStats } from '../types/financial';

type Accent = 'red' | 'purple' | 'yellow' | 'green' | 'cyan' | 'pink' | 'gray' | 'blue';

const ACCENT_CLASSES: Record<Accent, { iconBg: string; iconText: string; ring: string; cardBg: string }> = {
  red: { iconBg: 'bg-red-50', iconText: 'text-red-600', ring: 'group-hover:ring-red-100', cardBg: 'bg-red-50' },
  purple: { iconBg: 'bg-purple-50', iconText: 'text-purple-600', ring: 'group-hover:ring-purple-100', cardBg: 'bg-purple-50' },
  yellow: { iconBg: 'bg-amber-50', iconText: 'text-amber-600', ring: 'group-hover:ring-amber-100', cardBg: 'bg-amber-50' },
  green: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', ring: 'group-hover:ring-emerald-100', cardBg: 'bg-emerald-50' },
  cyan: { iconBg: 'bg-cyan-50', iconText: 'text-cyan-600', ring: 'group-hover:ring-cyan-100', cardBg: 'bg-cyan-50' },
  pink: { iconBg: 'bg-pink-50', iconText: 'text-pink-600', ring: 'group-hover:ring-pink-100', cardBg: 'bg-pink-50' },
  gray: { iconBg: 'bg-gray-100', iconText: 'text-gray-600', ring: 'group-hover:ring-gray-100', cardBg: 'bg-gray-50' },
  blue: { iconBg: 'bg-blue-50', iconText: 'text-blue-600', ring: 'group-hover:ring-blue-100', cardBg: 'bg-blue-50' }
};

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent: Accent;
  onClick?: () => void;
  trend?: 'up' | 'down';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, accent, onClick, trend }) => {
  const c = ACCENT_CLASSES[accent];
  return (
    <div
      className={`${c.cardBg} border border-gray-300 rounded-xl p-3 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`bg-white ${c.iconText} p-1.5 rounded-lg shadow-sm`}>
          {icon}
        </div>
        {trend && (
          trend === 'up'
            ? <TrendingUpIcon className="h-4 w-4 text-emerald-500" />
            : <TrendingDownIcon className="h-4 w-4 text-red-500" />
        )}
      </div>
      <p className="text-[11px] font-medium text-gray-500 mb-0.5">{title}</p>
      <p className="text-base font-bold text-gray-900 truncate">{value}</p>
    </div>
  );
};

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  accent: Accent;
  badge?: number;
}

const NavTile: React.FC<NavItem> = ({ to, label, icon, accent, badge }) => {
  const c = ACCENT_CLASSES[accent];
  return (
    <Link
      to={to}
      className="group relative w-32 min-h-[84px] bg-white border border-gray-200 rounded-xl px-2 py-3 flex flex-col items-center justify-center text-center gap-2 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-300"
    >
      <div className={`${c.iconBg} ${c.iconText} h-9 w-9 flex items-center justify-center rounded-xl ring-4 ring-transparent ${c.ring} transition-all`}>
        {icon}
      </div>
      <span className="text-[11px] font-medium text-gray-700 leading-tight">{label}</span>
      {!!badge && badge > 0 && (
        <span className="absolute -top-2 -right-2 inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 rounded-full text-[10px] font-semibold bg-red-500 text-white shadow">
          {badge}
        </span>
      )}
    </Link>
  );
};

const FinancialDashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [newOrdersCount, setNewOrdersCount] = useState<number>(0);
  const [newCreditNotesCount, setNewCreditNotesCount] = useState<number>(0);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState<number>(0);
  const [hasNewChat, setHasNewChat] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError(null);
    dashboardService.getStats()
      .then(res => {
        if (res.success && res.data) {
          setStats(res.data);
        } else {
          setError(res.error || 'Failed to load dashboard stats');
        }
      })
      .catch(() => setError('Failed to load dashboard stats'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Fetch count of new (my_status = 0) orders for badge on Customer Orders card
    const fetchNewOrders = async () => {
      try {
        const url = API_CONFIG.getUrl('/financial/sales-orders-all');
        const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        const data = await res.json();
        if (res.ok && data && data.success && Array.isArray(data.data)) {
          const count = data.data.filter((o: any) => String(o.my_status || '0') === '0').length;
          setNewOrdersCount(count);
        }
      } catch {}
    };
    
    // Fetch count of new (my_status = 0) credit notes for badge on Credit Notes card
    const fetchNewCreditNotes = async () => {
      try {
        const url = API_CONFIG.getUrl('/financial/credit-notes');
        const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        const data = await res.json();
        if (res.ok && data && data.success && Array.isArray(data.data)) {
          // Count credit notes with my_status = 0 (new/unprocessed)
          const count = data.data.filter((cn: any) => String(cn.my_status || '0') === '0').length;
          setNewCreditNotesCount(count);
        }
      } catch {}
    };
    
    const fetchChatLatest = async () => {
      try {
        const url = API_CONFIG.getUrl('/chat/latest');
        const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        const data = await res.json();
        if (res.ok && data && data.success) {
          const lastMessage = data.last_message_at ? new Date(data.last_message_at).getTime() : 0;
          const lastVisited = Number(localStorage.getItem('chat_last_visited_ts') || 0);
          setHasNewChat(lastMessage > lastVisited);
        }
      } catch {}
    };
    // Fetch count of pending expense payments for badge on Pending Payments card
    const fetchPendingPayments = async () => {
      try {
        const url = API_CONFIG.getUrl('/financial/expense-payments/pending');
        const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        const data = await res.json();
        if (res.ok && data && data.success && Array.isArray(data.data)) {
          setPendingPaymentsCount(data.data.length);
        }
      } catch {}
    };

    fetchNewOrders();
    fetchNewCreditNotes();
    fetchPendingPayments();
    fetchChatLatest();
  }, []);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const navSections: { title: string; items: NavItem[] }[] = [
    {
      title: 'Sales & Orders',
      items: [
        { to: '/financial/create-customer-order', label: 'Create Order', icon: <PackageIcon className="h-4 w-4" />, accent: 'green' },
        { to: '/financial/customer-orders', label: 'Customer Orders', icon: <PackageIcon className="h-4 w-4" />, accent: 'red', badge: newOrdersCount },
        { to: '/clients-list', label: 'Clients', icon: <UsersIcon className="h-4 w-4" />, accent: 'green' },
        { to: '/suppliers', label: 'Vendors', icon: <BuildingIcon className="h-4 w-4" />, accent: 'purple' },
        { to: '/riders', label: 'Drivers', icon: <UsersIcon className="h-4 w-4" />, accent: 'purple' },
        { to: '/vehicles', label: 'Vehicles', icon: <CarIcon className="h-4 w-4" />, accent: 'purple' },
        { to: '/loading-sheet', label: 'Loading Sheet', icon: <PackageIcon className="h-4 w-4" />, accent: 'red' },
        { to: '/live-location', label: 'Live Location', icon: <MapPinIcon className="h-4 w-4" />, accent: 'green' },
      ]
    },
    {
      title: 'Sales Team',
      items: [
        { to: '/sales-reps', label: 'Sales Reps', icon: <UsersIcon className="h-4 w-4" />, accent: 'purple' },
        { to: '/visits', label: 'Visits Report', icon: <MapPinIcon className="h-4 w-4" />, accent: 'green' },
        { to: '/sales-rep-working-days', label: 'Working Days', icon: <MapPinIcon className="h-4 w-4" />, accent: 'green' },
        { to: '/sales-rep-leaves', label: 'Sales Rep Leaves', icon: <MapPinIcon className="h-4 w-4" />, accent: 'green' },
        { to: '/overall-attendance', label: 'Visits Summary', icon: <MapPinIcon className="h-4 w-4" />, accent: 'blue' },
        { to: '/activity', label: 'Sales Rep Activity', icon: <MapPinIcon className="h-4 w-4" />, accent: 'blue' },
      ]
    },
    {
      title: 'Purchasing & Inventory',
      items: [
        { to: '/purchase-orders', label: 'Purchase Orders', icon: <ShoppingCartIcon className="h-4 w-4" />, accent: 'red' },
        { to: '/store-inventory', label: 'Store Inventory', icon: <PackageIcon className="h-4 w-4" />, accent: 'purple' },
        { to: '/products', label: 'Products', icon: <BoxIcon className="h-4 w-4" />, accent: 'red' },
        // { to: '/assets', label: 'Assets', icon: <BoxIcon className="h-4 w-4" />, accent: 'red' }
      ]
    },
    {
      title: 'Billing & Payments',
      items: [
        { to: '/invoice-list', label: 'Invoices', icon: <FileTextIcon className="h-4 w-4" />, accent: 'yellow' },
        // { to: '/create-credit-note', label: 'Create Credit Note', icon: <FileTextIcon className="h-4 w-4" />, accent: 'purple' },
        { to: '/credit-notes', label: 'Credit Notes', icon: <FileTextIcon className="h-4 w-4" />, accent: 'yellow', badge: newCreditNotesCount },
        { to: '/payables', label: 'Payables', icon: <DollarSignIcon className="h-4 w-4" />, accent: 'red' },
        { to: '/supplier-payments', label: 'Supplier Payments', icon: <ReceiptIcon className="h-4 w-4" />, accent: 'purple' },
        { to: '/receivables', label: 'Receivables', icon: <PiggyBankIcon className="h-4 w-4" />, accent: 'green' },
        { to: '/pending-payments', label: 'Pending Payments', icon: <ClockIcon className="h-4 w-4" />, accent: 'yellow', badge: pendingPaymentsCount }
      ]
    },
    {
      title: 'Accounting',
      items: [
        { to: '/add-journal-entry', label: 'Journal Entry', icon: <FileTextIcon className="h-4 w-4" />, accent: 'yellow' },
        { to: '/add-expense', label: 'Add Expense', icon: <DollarSignIcon className="h-4 w-4" />, accent: 'red' },
        { to: '/expense-summary', label: 'Expenses', icon: <DollarSignIcon className="h-4 w-4" />, accent: 'red' },
        { to: '/equity/entries', label: 'Equity Entries', icon: <CalculatorIcon className="h-4 w-4" />, accent: 'purple' },
        { to: '/cash-equivalents', label: 'Cash & Equivalents', icon: <PiggyBankIcon className="h-4 w-4" />, accent: 'cyan' }
      ]
    },
    {
      title: 'Reports & Tools',
      items: [
        { to: '/reports', label: 'Financial Reports', icon: <BarChart3Icon className="h-4 w-4" />, accent: 'green' },
        { to: '/reports/monthly-sales', label: 'Sales Report', icon: <BarChart3Icon className="h-4 w-4" />, accent: 'red' },
        { to: '/master-sales', label: 'Master Sales Report', icon: <BarChart3Icon className="h-4 w-4" />, accent: 'red' },
        { to: '/reports/client-sales', label: 'Client Sales Report', icon: <UsersIcon className="h-4 w-4" />, accent: 'purple' },
        { to: '/products-sale-report', label: 'Products Sale Report', icon: <BoxIcon className="h-4 w-4" />, accent: 'red' },
        { to: '/instant-chat', label: 'Team Chat', icon: <MessageSquareIcon className="h-4 w-4" />, accent: 'blue', badge: hasNewChat ? 1 : 0 },
        { to: '/settings', label: 'Settings', icon: <SettingsIcon className="h-4 w-4" />, accent: 'gray' }
      ]
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-600 border-t-transparent mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading financial dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangleIcon className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-600 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard
            title="Total Sales"
            value={stats ? formatCurrency(stats.totalSales) : 'Ksh 0.00'}
            icon={<DollarSignIcon className="h-5 w-5" />}
            accent="red"
            onClick={() => navigate('/reports')}
          />

          <StatCard
            title="Cost of Goods"
            value={stats ? formatCurrency(stats.totalCostOfGoods) : 'Ksh 0.00'}
            icon={<ShoppingCartIcon className="h-5 w-5" />}
            accent="purple"
            onClick={() => navigate('/reports/profit-loss')}
          />

          <StatCard
            title="Expenses"
            value={stats ? formatCurrency(stats.totalExpenses) : 'Ksh 0.00'}
            icon={<FileTextIcon className="h-5 w-5" />}
            accent="yellow"
            onClick={() => navigate('/expense-summary')}
          />

          <StatCard
            title="Gross Profit"
            value={stats ? formatCurrency(stats.grossProfit) : 'Ksh 0.00'}
            icon={<BarChart3Icon className="h-5 w-5" />}
            accent="green"
            trend={stats ? (stats.grossProfit >= 0 ? 'up' : 'down') : undefined}
            onClick={() => navigate('/reports/profit-loss')}
          />
        </div>

        {/* Grouped quick links */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
          {navSections.map((section, index) => (
            <div key={section.title} className={index > 0 ? 'mt-5 pt-5 border-t border-gray-200' : ''}>
              <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {section.title}
              </h2>
              <div className="flex flex-wrap gap-3.5">
                {section.items.map(item => (
                  <NavTile key={item.to + item.label} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FinancialDashboardPage;