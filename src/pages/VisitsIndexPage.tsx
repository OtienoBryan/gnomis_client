import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Eye, 
  MessageSquare, 
  Package,
  FileText,
  Calendar,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Target,
  MapPin,
  BarChart3,
  Layout,
  Search,
  Megaphone,
  RotateCcw
} from 'lucide-react';

interface VisitLink {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  iconBg: string;
  iconText: string;
  features: string[];
  // hidden cards stay defined here but are not shown (flip to false to bring one back)
  hidden?: boolean;
}

const VisitsIndexPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const allVisits: VisitLink[] = [
    {
      id: 'my-visibility',
      title: 'My Visibility',
      description: 'View your own visibility reports and visit records from your sales activities. Track product placement and visibility metrics.',
      path: '/my-visibility',
      icon: <Eye className="w-4 h-4" />,
      iconBg: 'bg-purple-50',
      iconText: 'text-purple-600',
      features: [
        'Personal visibility reports',
        'Visit date tracking',
        'Product placement metrics',
        'Image uploads and comments',
        'Date range filtering'
      ]
    },
    {
      id: 'feedback-reports',
      title: 'Feedback Reports',
      description: 'View detailed feedback reports and client insights from visits. Understand client needs and preferences.',
      path: '/feedback-reports',
      icon: <MessageSquare className="w-4 h-4" />,
      iconBg: 'bg-green-50',
      iconText: 'text-green-600',
      features: [
        'Client feedback collection',
        'Visit comments and notes',
        'Sales rep performance',
        'Date and outlet filtering',
        'Search functionality',
        'Report export'
      ]
    },
    {
      id: 'availability-reports',
      title: 'Availability Reports',
      description: 'Track product availability and inventory status from visit reports. Monitor stock levels across outlets.',
      path: '/availability-reports',
      icon: <Package className="w-4 h-4" />,
      iconBg: 'bg-orange-50',
      iconText: 'text-orange-600',
      features: [
        'Product availability tracking',
        'Quantity reporting',
        'Category-based filtering',
        'Country and outlet filters',
        'Date range selection',
        'CSV export support'
      ]
    },
    {
      id: 'short-expiry-report',
      title: 'Short Expiry Report',
      description: 'View products with short expiry dates from visit reports. Monitor batch numbers and expiry tracking.',
      path: '/short-expiry-report',
      icon: <Calendar className="w-4 h-4" />,
      iconBg: 'bg-red-50',
      iconText: 'text-red-600',
      features: [
        'Expiry date tracking',
        'Batch number monitoring',
        'Product quantity reporting',
        'Outlet and sales rep filters',
        'Date range selection',
        'CSV export support'
      ]
    },
    {
      id: 'returns',
      title: 'Returns',
      description: 'Review products returned from outlets, with return reasons, item details and photos.',
      path: '/returns',
      icon: <RotateCcw className="w-4 h-4" />,
      iconBg: 'bg-orange-50',
      iconText: 'text-orange-600',
      features: [
        'Returned items and quantities',
        'Return reasons',
        'Return photo preview',
        'Region and outlet account filters',
        'Date range selection',
        'Search by SO number and client'
      ]
    },
    {
      id: 'price-compliance-report',
      hidden: true,
      title: 'Price Compliance Report',
      description: 'Monitor pricing compliance, RRP vs shelf price, and promotional pricing across outlets.',
      path: '/price-compliance-report',
      icon: <DollarSign className="w-4 h-4" />,
      iconBg: 'bg-emerald-50',
      iconText: 'text-emerald-600',
      features: [
        'RRP vs shelf price comparison',
        'Price correctness tracking',
        'Promotion flag visibility',
        'Outlet and sales rep filters',
        'Date range selection',
        'CSV export support'
      ]
    },
    {
      id: 'sos-report',
      title: 'SOS Report',
      description: 'Analyze Share of Shelf (SOS) performance by outlet, brand, and rep to track execution against targets.',
      path: '/sos-report',
      icon: <Target className="w-4 h-4" />,
      iconBg: 'bg-red-50',
      iconText: 'text-red-700',
      features: [
        'Brand vs total facings per outlet',
        'SOS% calculation and comparison',
        'Outlet target tracking',
        'Outlet and rep filters',
        'Date range selection',
        'CSV export support'
      ]
    },
    {
      id: 'planogram-compliance-report',
      title: 'Planogram Compliance Report',
      description: 'Compare planogram compliance targets with actual quantities from ProductReport to track execution against targets.',
      path: '/planogram-compliance-report',
      icon: <Layout className="w-4 h-4" />,
      iconBg: 'bg-green-50',
      iconText: 'text-green-700',
      features: [
        'Target vs actual quantity comparison',
        'Product-level compliance tracking',
        'Outlet account filtering',
        'Date range selection',
        'Report count and last report date',
        'CSV export support'
      ]
    },
    {
      id: 'competitor-activity-report',
      title: 'Competitor Activity Report',
      description: 'View competitor activity and market intelligence from visit reports. Track competing products and mechanisms.',
      path: '/competitor-activity-report',
      icon: <TrendingUp className="w-4 h-4" />,
      iconBg: 'bg-red-50',
      iconText: 'text-red-600',
      features: [
        'Competitor product tracking',
        'Market mechanism analysis',
        'Product comparison',
        'Outlet and merchandiser filters',
        'Date range selection',
        'CSV export support'
      ]
    },
    {
      id: 'promotions-report',
      hidden: true,
      title: 'Promotions Report',
      description: 'Track promotion activations such as Price off, Sampling, and BOGO from field visits.',
      path: '/promotions-report',
      icon: <Megaphone className="w-4 h-4" />,
      iconBg: 'bg-pink-50',
      iconText: 'text-pink-600',
      features: [
        'Promotion activity tracking',
        'Activation type filtering',
        'Qty before and after comparison',
        'Sales rep and outlet filters',
        'Date range selection',
        'Search by product and comments'
      ]
    },
    {
      id: 'outlet-visits',
      title: 'Outlet Visits',
      description: 'View how many visits have been made to each outlet over the selected period.',
      path: '/dashboard/reports/outlet-visits',
      icon: <MapPin className="w-4 h-4" />,
      iconBg: 'bg-lime-50',
      iconText: 'text-lime-700',
      features: [
        'Total visits per outlet',
        'Year and date range filters',
        'Outlet account filter',
        'Lightweight tabular view'
      ]
    },
    {
      id: 'outlet-visits-summary',
      title: 'Outlet Visits Summary',
      description: 'View monthly visit summaries by outlet with aggregated visit counts across months.',
      path: '/dashboard/reports/outlet-visits-summary',
      icon: <BarChart3 className="w-4 h-4" />,
      iconBg: 'bg-teal-50',
      iconText: 'text-teal-700',
      features: [
        'Monthly visit breakdown',
        'Year and date range filters',
        'Outlet account filter',
        'Full-width detailed view'
      ]
    },
    {
      id: 'outlet-coverage',
      title: 'Outlet Coverage',
      description: 'View weekly outlet coverage by sales representative. Track expected vs actual coverage for weeks 1-5.',
      path: '/outlet-coverage',
      icon: <TrendingUp className="w-4 h-4" />,
      iconBg: 'bg-red-50',
      iconText: 'text-red-700',
      features: [
        'Weekly coverage tracking',
        'Expected vs actual comparison',
        'Sales rep performance',
        'Month and year filters',
        'CSV export support'
      ]
    }
  ];

  const visits = allVisits.filter((visit) => !visit.hidden);

  const handleVisitClick = (path: string) => {
    navigate(path);
  };

  const handleViewClick = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    navigate(path);
  };

  const filteredVisits = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return visits;
    return visits.filter((visit) => {
      return (
        visit.title.toLowerCase().includes(q) ||
        visit.description.toLowerCase().includes(q) ||
        visit.features.some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [searchTerm, visits]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mx-auto px-4 py-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-sm font-bold text-gray-900">Visits Reports</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">Choose a report to analyze field execution and outlet activity</p>
          </div>
          <button
            onClick={() => navigate('/sales-dashboard')}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-xs font-semibold flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Total Reports</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{visits.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Matching Reports</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{filteredVisits.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Quick Search</p>
            <div className="relative mt-1">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reports..."
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>
        </div>

        {/* Visits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredVisits.map((visit) => (
            <div
              key={visit.id}
              onClick={() => handleVisitClick(visit.path)}
              className="group bg-white rounded-md border-2 border-gray-300 overflow-hidden hover:shadow-md hover:border-gray-400 transition-all duration-150 cursor-pointer"
            >
              {/* Header */}
              <div className="px-3 py-2.5 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`${visit.iconBg} ${visit.iconText} rounded-md p-1.5 flex-shrink-0`}>
                    {visit.icon}
                  </div>
                  <h3 className="text-gray-900 font-semibold text-xs leading-tight truncate">
                    {visit.title}
                  </h3>
                </div>
                <button
                  onClick={(e) => handleViewClick(e, visit.path)}
                  className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-medium rounded-md transition-colors flex-shrink-0"
                >
                  View
                </button>
              </div>

              {/* Card Content */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium bg-gray-100 text-gray-700">
                    {visit.features.length} features
                  </span>
                  <span className="text-[9px] text-gray-400 group-hover:text-gray-500 transition-colors">
                    {visit.id.replace(/-/g, ' ')}
                  </span>
                </div>
                <p className="text-gray-600 text-[11px] mb-2.5 leading-relaxed line-clamp-3 min-h-[42px]">
                  {visit.description}
                </p>

                {/* Key Features */}
                <div className="mb-2.5">
                  <ul className="space-y-1">
                    {visit.features.slice(0, 4).map((feature, index) => (
                      <li key={index} className="text-[11px] text-gray-700 flex items-start">
                        <span className="text-red-500 mr-1.5 mt-[1px]">•</span>
                        <span className="line-clamp-1">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* View Full Report Link */}
                <div
                  onClick={(e) => handleViewClick(e, visit.path)}
                  className="inline-flex items-center gap-1.5 text-red-700 bg-white border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors"
                >
                  <ArrowRight className="w-3 h-3" />
                  <span>View Full Report</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredVisits.length === 0 && (
          <div className="mt-3 bg-white border border-gray-200 rounded-md p-8 text-center">
            <p className="text-xs font-medium text-gray-900">No reports matched your search.</p>
            <p className="text-[10px] text-gray-500 mt-1">Try a different keyword like availability, visits, or summary.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitsIndexPage;
