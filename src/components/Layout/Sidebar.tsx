import React, { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { XIcon, HomeIcon, UsersIcon, CogIcon, ShieldIcon, BoxIcon, ImageIcon, InfoIcon, GroupIcon, Tally4Icon, BellIcon, FileTextIcon, BarChart3, DollarSign, Clock, MapIcon, TrendingUp, ActivityIcon, ShoppingCartIcon, PackageIcon, MessageSquareIcon, PiggyBankIcon, Receipt, TruckIcon, AlertCircle as AlertCircleIcon, ClipboardList as ClipboardListIcon, CreditCard as CreditCardIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: HomeIcon,
    roles: ['admin', 'manager', 'accountant', 'user', 'stock', 'sales', 'hr', 'executive']
  },
  // Add Clients link here
  {
    name: 'Clients',
    href: '/clients-list',
    icon: UsersIcon,
    roles: ['admin', 'manager', 'accountant', 'user', 'sales', 'executive', 'finance']
  },
  {
    name: 'Guards List',
    href: '/dashboard/staff-list',
    icon: ImageIcon,
    roles: ['admin', 'manager', 'hr', 'executive']
  },
  // {
  //   name: 'Teams List',
  //   href: '/dashboard/teams-list',
  //   icon: GroupIcon
  // },
  {
    name: 'Vendors',
    href: '/suppliers',
    icon: UsersIcon,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
  {
    name: 'Drivers',
    href: '/riders',
    icon: UsersIcon,
    roles: ['admin', 'manager', 'accountant', 'finance']
  },
  {
    name: 'Vehicles',
    href: '/vehicles',
    icon: TruckIcon,
    roles: ['admin', 'manager', 'accountant', 'finance']
  },
  {
    name: 'Loading Sheet',
    href: '/loading-sheet',
    icon: TruckIcon,
    roles: ['admin', 'manager', 'executive', 'sales', 'stock', 'finance']
  },
  {
    name: 'Live Location',
    href: '/live-location',
    icon: MapIcon,
    roles: ['admin', 'manager', 'accountant', 'finance']
  },

  {
    name: 'Reports',
    href: '/dashboard/claims',
    icon: Tally4Icon,
    roles: ['admin', 'manager', 'accountant', 'user', 'executive']
  },
  {
    name: 'Notice Board',
    href: '/notices',
    icon: BellIcon,
    roles: ['admin', 'manager', 'accountant', 'user', 'stock', 'sales', 'hr', 'executive']
  },
  // {
  //   name: 'Reports',
  //   href: '/dashboard/reports',
  //   icon: BoxIcon
  // },
  {
    name: 'Settings',
    href: '/settings',
    icon: CogIcon,
    roles: ['admin', 'manager', 'executive', 'finance']
  },
  {
    name: 'Payables',
    href: '/payables',
    icon: BoxIcon,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
  {
    name: 'Supplier Payments',
    href: '/supplier-payments',
    icon: Receipt,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
{
    name: 'Supplier Invoices',
    href: '/supplier-invoices',
    icon: Receipt,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
  {
    name: 'Pending Payments',
    href: '/pending-payments',
    icon: Clock,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
  {
    name: 'Receivables',
    href: '/receivables',
    icon: FileTextIcon,
    roles: ['admin', 'manager', 'accountant', 'executive', 'sales', 'finance']
  },
  {
    name: 'Unconfirmed Payments',
    href: '/unconfirmed-payments',
    icon: Clock,
    roles: ['admin', 'manager', 'accountant', 'executive', 'sales']
  },
  {
    name: 'Assets',
    href: '/assets',
    icon: BoxIcon,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
  {
    name: 'Reports',
    href: '/reports/profit-loss',
    icon: BarChart3,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
  {
    name: 'Sales Report',
    href: '/reports/monthly-sales',
    icon: BarChart3,
    roles: ['admin', 'manager', 'accountant', 'executive', 'sales', 'finance']
  },
  {
    name: 'Client Sales Report',
    href: '/reports/client-sales',
    icon: UsersIcon,
    roles: ['admin', 'manager', 'accountant', 'executive', 'sales', 'finance']
  },
                {
                name: 'Master Sales',
                href: '/master-sales',
                icon: BarChart3,
                roles: ['admin', 'manager', 'accountant', 'sales', 'executive']
              },
              {
                name: 'Sales Rep Performance',
                href: '/sales-rep-performance',
                icon: TrendingUp,
                roles: ['admin', 'manager', 'accountant', 'sales', 'executive']
              },
              {
                name: 'Sales Rep Master Report',
                href: '/sales-rep-master-report',
                icon: UsersIcon,
                roles: ['admin', 'manager', 'accountant', 'sales', 'executive']
              },
              {
                name: 'Products Sale Report',
                href: '/products-sale-report',
                icon: BarChart3,
                roles: ['admin', 'manager', 'accountant', 'sales', 'executive']
              },
              {
                name: 'Journey Plans',
                href: '/dashboard/journey-plans',
                icon: MapIcon,
                roles: ['admin', 'manager', 'sales', 'executive']
              },
  {
    name: 'Activity',
    href: '/activity',
    icon: ActivityIcon,
    roles: ['admin', 'manager', 'sales', 'leader', 'executive']
  },
  {
    name: 'Route Compliance',
    href: '/dashboard/route-compliance',
    icon: MapIcon,
    roles: ['admin', 'manager', 'sales', 'executive']
  },
  {
    name: 'Balance Sheet',
    href: '/reports/balance-sheet',
    icon: BarChart3,
    roles: ['admin', 'manager', 'accountant', 'executive']
  },
  {
    name: 'Create Invoice',
    href: '/create-invoice',
    icon: FileTextIcon,
    roles: ['admin', 'manager', 'accountant', 'executive']
  },
  {
    name: 'Invoice List',
    href: '/invoice-list',
    icon: FileTextIcon,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
  {
    name: 'Create Credit Note',
    href: '/create-credit-note',
    icon: FileTextIcon,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
  {
    name: 'Credit Notes',
    href: '/credit-notes',
    icon: FileTextIcon,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
  {
    name: 'Add Asset',
    href: '/assets/add',
    icon: BoxIcon,
    roles: ['admin', 'manager', 'accountant', 'executive']
  },
  {
    name: 'Asset Depreciation',
    href: '/assets/depreciation',
    icon: BoxIcon,
    roles: ['admin', 'manager', 'accountant', 'executive']
  },
  {
    name: 'Depreciation Management',
    href: '/depreciation/manage',
    icon: BoxIcon,
    roles: ['admin', 'manager', 'accountant', 'executive']
  },
  {
    name: 'Equity Entries',
    href: '/equity/entries',
    icon: DollarSign,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
  {
    name: 'Add Expense',
    href: '/add-expense',
    icon: DollarSign,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
  {
    name: 'Department Expenses',
    href: '/department-expenses/upload',
    icon: DollarSign,
    roles: ['admin', 'manager', 'accountant', 'hr', 'executive']
  },
  {
    name: 'Expense Summary',
    href: '/expense-summary',
    icon: BarChart3,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
  {
    name: 'Pending Payments',
    href: '/pending-payments',
    icon: Clock,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
  {
    name: 'Inventory Dashboard',
    href: '/inventory-staff-dashboard',
    icon: BoxIcon,
    roles: ['admin']
  },
  {
    name: 'Raw Materials',
    href: '/raw-materials',
    icon: BoxIcon,
    roles: ['admin', 'manager', 'stock', 'accountant', 'sales', 'executive', 'finance']
  },
  {
    name: 'Raw Material Inventory',
    href: '/raw-materials-inventory',
    icon: BoxIcon,
    roles: ['admin', 'manager', 'stock', 'accountant', 'sales', 'executive', 'finance']
  },
  {
    name: 'Raw Material Requests',
    href: '/raw-material-requests',
    icon: BoxIcon,
    roles: ['admin', 'manager', 'stock', 'accountant', 'sales', 'executive', 'finance']
  },
  {
    name: 'Store Management',
    href: '/store-management',
    icon: BoxIcon,
    roles: ['admin', 'manager', 'sales', 'executive']
  },
  {
    name: 'Store Inventory',
    href: '/store-inventory',
    icon: BoxIcon,
    roles: ['admin', 'manager', 'stock', 'sales', 'executive', 'finance']
  },
  {
    name: 'Stock Alerts',
    href: '/below-target-stock',
    icon: BoxIcon,
    roles: ['admin', 'manager', 'stock', 'sales', 'executive', 'finance']
  },
  {
    name: 'Merchandise',
    href: '/merchandise',
    icon: BoxIcon,
    roles: ['admin']
  },
  {
    name: 'Stock Take',
    href: '/stock-take',
    icon: PackageIcon,
    roles: ['stock']
  },
  {
    name: 'Stock Transfer',
    href: '/stock-transfer',
    icon: PackageIcon,
    roles: ['stock']
  },
  {
    name: 'Faulty Products',
    href: '/faulty-products',
    icon: AlertCircleIcon,
    roles: ['stock']
  },
  {
    name: 'Credit Note Summary',
    href: '/credit-note-summary',
    icon: CreditCardIcon,
    roles: ['stock']
  },
  {
    name: 'Faulty Reports',
    href: '/faulty-reports',
    icon: FileTextIcon,
    roles: ['stock']
  },
  {
    name: 'Stock Movement',
    href: '/inventory-transactions',
    icon: ClipboardListIcon,
    roles: ['stock']
  },
  {
    name: 'Stock Take History',
    href: '/stock-take-history',
    icon: FileTextIcon,
    roles: ['stock']
  },
  {
    name: 'Transfer History',
    href: '/stock-transfer-history',
    icon: FileTextIcon,
    roles: ['stock']
  },
  {
    name: 'Product Performance',
    href: '/dashboard/reports/product-performance',
    icon: FileTextIcon,
    roles: ['stock']
  },
  {
    name: 'Purchases',
    href: '/purchase-orders',
    icon: ShoppingCartIcon,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
  {
    name: 'Create Order',
    href: '/financial/create-customer-order',
    icon: PackageIcon,
    roles: ['admin', 'manager', 'accountant', 'executive', 'sales', 'finance']
  },
  {
    name: 'Customer Orders',
    href: '/financial/customer-orders',
    icon: PackageIcon,
    roles: ['admin', 'manager', 'accountant', 'executive', 'sales', 'stock', 'finance']
  },
  {
    name: 'Journal Entry',
    href: '/add-journal-entry',
    icon: FileTextIcon,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  },
  {
    name: 'Products',
    href: '/products',
    icon: BoxIcon,
    roles: ['admin', 'manager', 'accountant', 'sales', 'executive', 'finance']
  },
  {
    name: 'Sales Orders',
    href: '/all-orders',
    icon: FileTextIcon,
    roles: ['admin', 'manager', 'accountant', 'sales', 'executive', 'finance']
  },
  {
    name: 'Cash & Equivalents',
    href: '/cash-equivalents',
    icon: PiggyBankIcon,
    roles: ['admin', 'manager', 'accountant', 'finance']
  },
  {
    name: 'Team Chat',
    href: '/instant-chat',
    icon: MessageSquareIcon,
    roles: ['admin', 'manager', 'accountant', 'executive', 'sales', 'stock', 'finance']
  },
  {
    name: 'Post Uplift Sale',
    href: '/financial/purchase-order',
    icon: TrendingUp,
    roles: ['admin', 'manager', 'accountant', 'executive', 'finance']
  }
];

const Sidebar: React.FC<SidebarProps> = ({
  sidebarOpen,
  setSidebarOpen
}) => {
  // Safely get location with fallback
  let location;
  try {
    location = useLocation();
  } catch (error) {
    console.error('Router context not available in Sidebar:', error);
    location = { pathname: '/' };
  }
  const { user } = useAuth();

  return (
    <>
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="fixed inset-0 flex z-40 md:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <div className="relative flex-1 flex flex-col max-w-xs w-full pt-5 pb-4 bg-blue-950">
              <Transition.Child
                as={Fragment}
                enter="ease-in-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in-out duration-300"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="absolute top-0 right-0 -mr-12 pt-2">
                  <button
                    type="button"
                    className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="sr-only">Close sidebar</span>
                    <XIcon className="h-6 w-6 text-white" aria-hidden="true" />
                  </button>
                </div>
              </Transition.Child>
              <div className="mt-5 flex-1 h-0 overflow-y-auto scrollbar-hide">
                <nav className="px-2 space-y-1">
                  {navigation
                    .filter(item => !item.roles || item.roles.includes(user?.role || ''))
                    .map(item => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`${
                          isActive ? 'bg-red-600 text-white' : 'text-gray-200 hover:bg-white/10 hover:text-white'
                        } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                      >
                        <Icon
                          className={`${
                            isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                          } mr-4 flex-shrink-0 h-4 w-4`}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
              </div>
              <div className="flex-shrink-0 flex border-t border-white/10 p-4">
                <div className="flex-shrink-0 w-full group block">
                  <div className="flex items-center">
                    <div>
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
                        <span className="text-xs font-medium text-red-600">
                          {user?.username?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-200 group-hover:text-white">
                        {user?.username}
                      </p>
                      <p className="text-[10px] font-medium text-gray-400 group-hover:text-gray-200">
                        {user?.role}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition.Child>
          <div className="flex-shrink-0 w-14" aria-hidden="true">
            {/* Force sidebar to shrink to fit close icon */}
          </div>
        </Dialog>
      </Transition.Root>
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-[104px]">
          <div className="flex flex-col h-0 flex-1">
            <div className="flex-1 flex flex-col overflow-y-auto scrollbar-hide bg-blue-950">
              <nav className="flex-1 px-2 py-3 space-y-1.5">
                {navigation
                  .filter(item => !item.roles || item.roles.includes(user?.role || ''))
                  .map(item => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      title={item.name}
                      className={`${
                        isActive
                          ? 'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-md'
                          : 'text-gray-300 hover:bg-white/10 hover:text-white'
                      } group flex flex-col items-center justify-center gap-1.5 px-1.5 py-3 rounded-xl text-center transition-colors`}
                    >
                      <Icon
                        className={`${
                          isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                        } flex-shrink-0 h-5 w-5`}
                        aria-hidden="true"
                      />
                      <span className="text-[10px] font-medium leading-tight break-words">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;