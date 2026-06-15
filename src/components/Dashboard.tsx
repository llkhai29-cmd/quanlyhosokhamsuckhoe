/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckupRecord, CATEGORIES, AgeGroup, CategoryInfo } from '../types';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  AreaChart, 
  Area,
  ReferenceLine
} from 'recharts';
import { LayoutDashboard, TrendingUp, Users, Calendar, Landmark, Percent, BarChart3, CheckSquare, Square, SlidersHorizontal, Search, Edit2, Target, Baby, GraduationCap, Briefcase, Heart } from 'lucide-react';

interface DashboardProps {
  records: CheckupRecord[];
  facilityTargets?: Record<string, number>;
  onUpdateTarget?: (facilityName: string, targetValue: number) => void;
}

export default function Dashboard({ 
  records, 
  facilityTargets = {}, 
  onUpdateTarget 
}: DashboardProps) {
  const [filterFacility, setFilterFacility] = useState<string>('all');
  const [filterManagedArea, setFilterManagedArea] = useState<string>('all');
  const [timeMode, setTimeMode] = useState<'all' | 'month' | 'quarter' | 'preset'>('all');
  const [selectedMonthStr, setSelectedMonthStr] = useState<string>('all');
  const [selectedQuarterStr, setSelectedQuarterStr] = useState<string>('all');
  const [selectedYearStr, setSelectedYearStr] = useState<string>('all');
  const [presetRange, setPresetRange] = useState<'last_7_days' | 'this_month' | 'last_month'>('this_month');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');

  // Minimalist / Clean view-state toggles
  const [showAdvancedTimeMode, setShowAdvancedTimeMode] = useState<boolean>(false);
  const [activeChartTab, setActiveChartTab] = useState<'demographics' | 'comparison' | 'trend' | 'all'>('demographics');

  // Inline targets editing state
  const [editingFacility, setEditingFacility] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  const startEditing = (facilityName: string, currentValue: number) => {
    setEditingFacility(facilityName);
    setEditingValue(currentValue > 0 ? String(currentValue) : '');
  };

  const saveTarget = (facilityName: string) => {
    const val = parseInt(editingValue, 10);
    const finalValue = isNaN(val) || val < 0 ? 0 : val;
    if (onUpdateTarget) {
      onUpdateTarget(facilityName, finalValue);
    }
    setEditingFacility(null);
  };

  const handleTargetKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, facilityName: string) => {
    if (e.key === 'Enter') {
      saveTarget(facilityName);
    } else if (e.key === 'Escape') {
      setEditingFacility(null);
    }
  };

  // List of unique facilities for filter dropdown
  const facilitiesList = useMemo(() => {
    const list = new Set(records.map((r) => r.facility).filter(Boolean));
    return ['all', ...Array.from(list)];
  }, [records]);

  // List of unique managed areas for filter dropdown
  const managedAreasList = useMemo(() => {
    const list = new Set(records.map((r) => r.managedArea).filter(Boolean));
    return ['all', ...Array.from(list)];
  }, [records]);

  // List of unique years from records for high-fidelity filtering
  const yearsList = useMemo(() => {
    const list = new Set(records.map(r => {
      const d = r.date ? new Date(r.date) : null;
      const year = d && !isNaN(d.getTime()) ? d.getFullYear() : null;
      return year;
    }).filter(Boolean) as number[]);
    return Array.from(list).sort((a, b) => b - a);
  }, [records]);

  // Unified health indicator for time ranges
  const isRecordInTimeRange = (rDate: string) => {
    if (!rDate) return false;
    const recordDate = new Date(rDate);
    if (isNaN(recordDate.getTime())) return false;
    
    const recYear = recordDate.getFullYear();
    const recMonth = recordDate.getMonth(); // 0-11
    
    // Year constraint (if any year is explicitly set)
    if (selectedYearStr !== 'all' && String(recYear) !== selectedYearStr) {
      return false;
    }

    if (timeMode === 'preset') {
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - recordDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (presetRange === 'last_7_days' && diffDays > 7) return false;
      
      if (presetRange === 'this_month') {
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        if (recMonth !== currentMonth || recYear !== currentYear) return false;
      }

      if (presetRange === 'last_month') {
        const prevMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
        const prevYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
        if (recMonth !== prevMonth || recYear !== prevYear) return false;
      }
    } else if (timeMode === 'month') {
      if (selectedMonthStr !== 'all') {
        const targetMonth = parseInt(selectedMonthStr, 10); // 0-11
        if (recMonth !== targetMonth) return false;
      }
    } else if (timeMode === 'quarter') {
      if (selectedQuarterStr !== 'all') {
        const quarter = parseInt(selectedQuarterStr, 10); // 1, 2, 3, 4
        const recQuarter = Math.floor(recMonth / 3) + 1; // 1-4
        if (recQuarter !== quarter) return false;
      }
    }

    return true;
  };

  // Filtered records based on controls
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Facility filter
      if (filterFacility !== 'all' && r.facility !== filterFacility) return false;

      // Managed Area filter
      if (filterManagedArea !== 'all' && r.managedArea !== filterManagedArea) return false;

      // Time filter
      return isRecordInTimeRange(r.date);
    });
  }, [records, filterFacility, filterManagedArea, timeMode, selectedMonthStr, selectedQuarterStr, selectedYearStr, presetRange]);

  // Calculations for KPI Cards
  const stats = useMemo(() => {
    let total = 0;
    let under6 = 0;
    let from6to18 = 0;
    let from18to60 = 0;
    let above60 = 0;

    filteredRecords.forEach((r) => {
      total += r.quantity;
      const cat = CATEGORIES[r.category];
      if (cat.parentGroup === '0_6') under6 += r.quantity;
      else if (cat.parentGroup === '6_18') from6to18 += r.quantity;
      else if (cat.parentGroup === '18_60') from18to60 += r.quantity;
      else if (cat.parentGroup === '60_plus') above60 += r.quantity;
    });

    return { total, under6, from6to18, from18to60, above60 };
  }, [filteredRecords]);

  // Donut chart of major age categories
  const pieChartData = useMemo(() => {
    return [
      { name: 'Dưới 6 tuổi', value: stats.under6, color: '#3b82f6' },
      { name: 'Từ 6 đến dưới 18 tuổi', value: stats.from6to18, color: '#06b6d4' },
      { name: 'Từ 18 đến dưới 60 tuổi', value: stats.from18to60, color: '#10b981' },
      { name: 'Từ 60 tuổi trở lên', value: stats.above60, color: '#ec4899' },
    ].filter((item) => item.value > 0);
  }, [stats]);

  // 18-60 subdivisions Bar Chart
  const subdivs18to60Data = useMemo(() => {
    let community = 0;
    let worker = 0;
    let officer = 0;

    filteredRecords.forEach((r) => {
      if (r.category === 'from_18_to_60_community') community += r.quantity;
      if (r.category === 'from_18_to_60_worker') worker += r.quantity;
      if (r.category === 'from_18_to_60_officer') officer += r.quantity;
    });

    return [
      { name: 'Cộng đồng', value: community, color: CATEGORIES.from_18_to_60_community.color },
      { name: 'NLĐ (Quần chúng/DN)', value: worker, color: CATEGORIES.from_18_to_60_worker.color },
      { name: 'Công chức vc / Cán bộ', value: officer, color: CATEGORIES.from_18_to_60_officer.color },
    ];
  }, [filteredRecords]);

  // Trend Chart data (Chronologically grouped)
  const trendData = useMemo(() => {
    const datesMap: Record<string, number> = {};
    
    // Group records by Date
    filteredRecords.forEach((r) => {
      datesMap[r.date] = (datesMap[r.date] || 0) + r.quantity;
    });

    // Convert map to sorted list
    return Object.keys(datesMap)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((dateStr) => {
        const formattedDate = new Date(dateStr).toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
        });
        return {
          date: formattedDate,
          'Số hồ sơ': datesMap[dateStr],
        };
      });
  }, [filteredRecords]);

  // List of unique facilities (excluding empty ones)
  const uniqueFacilitiesOnly = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.facility))).filter(Boolean);
  }, [records]);

  // Local state for selected facilities in the comparison chart
  const [selectedComparisonFacilities, setSelectedComparisonFacilities] = useState<string[]>([]);

  // Keep state in sync when facilities list changes
  useEffect(() => {
    setSelectedComparisonFacilities((prev) => {
      if (prev.length === 0) {
        return uniqueFacilitiesOnly;
      }
      // Keep only valid facilities and add any new ones
      const validPrev = prev.filter((f) => uniqueFacilitiesOnly.includes(f));
      const newFacs = uniqueFacilitiesOnly.filter((f) => !prev.includes(f));
      return [...validPrev, ...newFacs];
    });
  }, [uniqueFacilitiesOnly]);

  // Comparison view mode: 'stacked' | 'grouped'
  const [compareMode, setCompareMode] = useState<'stacked' | 'grouped'>('stacked');

  // Handle checking/unchecking single facility
  const toggleComparisonFacility = (facility: string) => {
    setSelectedComparisonFacilities((prev) =>
      prev.includes(facility)
        ? prev.filter((f) => f !== facility)
        : [...prev, facility]
    );
  };

  // Select/deselect actions
  const selectAllFacilities = () => setSelectedComparisonFacilities(uniqueFacilitiesOnly);
  const deselectAllFacilities = () => setSelectedComparisonFacilities([]);

  // Calculate comparison data
  const comparisonData = useMemo(() => {
    return selectedComparisonFacilities.map((facility) => {
      // Filter records for this facility and within date/time ranges
      const facRecords = records.filter((r) => {
        if (r.facility !== facility) return false;
        return isRecordInTimeRange(r.date);
      });

      let under6 = 0;
      let from6to18 = 0;
      let from18to60 = 0;
      let above60 = 0;
      let total = 0;

      facRecords.forEach((r) => {
        total += r.quantity;
        const cat = CATEGORIES[r.category];
        if (cat.parentGroup === '0_6') under6 += r.quantity;
        else if (cat.parentGroup === '6_18') from6to18 += r.quantity;
        else if (cat.parentGroup === '18_60') from18to60 += r.quantity;
        else if (cat.parentGroup === '60_plus') above60 += r.quantity;
      });

      return {
        facility,
        'Dưới 6 tuổi': under6,
        'Từ 6-18 tuổi': from6to18,
        'Từ 18-60 tuổi': from18to60,
        'Từ 60 tuổi trở lên': above60,
        'Tổng cộng': total,
      };
    }).sort((a, b) => b['Tổng cộng'] - a['Tổng cộng']);
  }, [records, selectedComparisonFacilities, timeMode, selectedMonthStr, selectedQuarterStr, selectedYearStr, presetRange]);

  // Aggregate statistics for all facilities based on current active filters
  const facilityTableData = useMemo(() => {
    const facilityMap: Record<string, {
      facility: string;
      under6: number;
      from6to18: number;
      from18to60: number;
      above60: number;
      total: number;
    }> = {};

    filteredRecords.forEach((r) => {
      if (!r.facility) return;
      
      if (!facilityMap[r.facility]) {
        facilityMap[r.facility] = {
          facility: r.facility,
          under6: 0,
          from6to18: 0,
          from18to60: 0,
          above60: 0,
          total: 0,
        };
      }

      const item = facilityMap[r.facility];
      item.total += r.quantity;
      
      const cat = CATEGORIES[r.category];
      if (cat.parentGroup === '0_6') item.under6 += r.quantity;
      else if (cat.parentGroup === '6_18') item.from6to18 += r.quantity;
      else if (cat.parentGroup === '18_60') item.from18to60 += r.quantity;
      else if (cat.parentGroup === '60_plus') item.above60 += r.quantity;
    });

    return Object.values(facilityMap).sort((a, b) => b.total - a.total);
  }, [filteredRecords]);

  const totalAllFacilities = useMemo(() => {
    return facilityTableData.reduce((sum, item) => sum + item.total, 0);
  }, [facilityTableData]);

  // Filtered rows for the facility stats table
  const searchedTableData = useMemo(() => {
    return facilityTableData.filter(item => 
      item.facility.toLowerCase().includes(tableSearchQuery.toLowerCase().trim())
    );
  }, [facilityTableData, tableSearchQuery]);

  // Sum of targets set for active/filtered facilities
  const activeTargetSum = useMemo(() => {
    if (filterFacility !== 'all') {
      return facilityTargets[filterFacility] || 0;
    }
    const uniqueFacs = Array.from(new Set(records.map(r => r.facility).filter(Boolean)));
    return uniqueFacs.reduce((sum, f) => sum + (facilityTargets[f] || 0), 0);
  }, [records, facilityTargets, filterFacility]);

  // Completion rate comparison data for selected facilities
  const completionRateData = useMemo(() => {
    return selectedComparisonFacilities.map((facility) => {
      const found = facilityTableData.find(item => item.facility === facility);
      const total = found ? found.total : 0;
      const target = facilityTargets[facility] || 0;
      const percent = target > 0 ? parseFloat(((total / target) * 100).toFixed(1)) : 0;
      
      return {
        facility,
        'Tỷ lệ hoàn thành (%)': percent,
        'Tổng hồ sơ': total,
        'Chỉ tiêu': target,
      };
    }).sort((a, b) => b['Tỷ lệ hoàn thành (%)'] - a['Tỷ lệ hoàn thành (%)']);
  }, [facilityTableData, selectedComparisonFacilities, facilityTargets]);

  // Detailed age category table data
  const ageCategoryTableData = useMemo(() => {
    // Initialize map
    const categoryTotals: Record<AgeGroup, {
      category: AgeGroup;
      name: string;
      parentGroup: string;
      parentGroupName: string;
      subName?: string;
      color: string;
      total: number;
      percentage: number;
    }> = {} as any;

    // Fill categories
    (Object.keys(CATEGORIES) as AgeGroup[]).forEach((key) => {
      const cat = CATEGORIES[key];
      categoryTotals[key] = {
        category: key,
        name: cat.name,
        parentGroup: cat.parentGroup,
        parentGroupName: cat.parentGroupName,
        subName: cat.subName,
        color: cat.color,
        total: 0,
        percentage: 0,
      };
    });

    // Populate with record quantities
    filteredRecords.forEach((r) => {
      if (categoryTotals[r.category]) {
        categoryTotals[r.category].total += r.quantity;
      }
    });

    const totalQuantity = Object.values(categoryTotals).reduce((sum, item) => sum + item.total, 0);

    // Calculate percentage
    return (Object.values(categoryTotals) as any[]).map((item) => ({
      ...item,
      percentage: totalQuantity > 0 ? (item.total / totalQuantity) * 100 : 0
    }));
  }, [filteredRecords]);

  if (records.length === 0) {
    return (
      <div id="dashboard-empty-state" className="bg-white rounded-2xl border border-slate-150 p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
        <div className="p-4 rounded-full bg-slate-50 text-slate-400 mb-4">
          <LayoutDashboard className="w-12 h-12 stroke-1" />
        </div>
        <h3 className="font-semibold text-slate-800 text-lg mb-1">Chưa có số liệu phân tích</h3>
        <p className="text-slate-500 text-sm max-w-sm">
          Nhập bản ghi số lượng đầu tiên bên cạnh để hiển thị trực quan các biểu đồ phân phối định kỳ theo thời gian thực.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Area */}
      <div id="dashboard-filters" className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden divide-y divide-slate-100/70">
        
        {/* Filter Header and General Geographical Scope */}
        <div className="p-4 bg-slate-50/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-sm">Bảng Điều Khiển Bộ Lọc Báo Cáo</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Tùy biến chỉ số so sánh, kho dữ liệu và tiến trình thống kê</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Facility Filter */}
            <div className="flex flex-col gap-1 flex-1 min-w-[140px] sm:flex-none">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Cơ sở tổ chức khám</label>
              <select
                id="filter-facility-select"
                value={filterFacility}
                onChange={(e) => setFilterFacility(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-auto sm:min-w-[180px] cursor-pointer"
              >
                <option value="all">Tất cả cơ sở khám ({facilitiesList.length - 1})</option>
                {facilitiesList.filter(f => f !== 'all').map((fac) => (
                  <option key={fac} value={fac}>{fac}</option>
                ))}
              </select>
            </div>

            {/* Managed Area Filter */}
            <div className="flex flex-col gap-1 flex-1 min-w-[140px] sm:flex-none">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Địa bàn hành chính quản lý</label>
              <select
                id="filter-managed-area-select"
                value={filterManagedArea}
                onChange={(e) => setFilterManagedArea(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-auto sm:min-w-[160px] cursor-pointer"
              >
                <option value="all">Tất cả địa bàn ({managedAreasList.length - 1})</option>
                {managedAreasList.filter(m => m !== 'all').map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            {/* Year Filter */}
            <div className="flex flex-col gap-1 w-full sm:w-28 flex-none">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Năm thực hiện</label>
              <select
                id="filter-year-select"
                value={selectedYearStr}
                onChange={(e) => setSelectedYearStr(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer w-full"
              >
                <option value="all">Tất cả năm</option>
                {yearsList.map((yr) => (
                  <option key={yr} value={String(yr)}>Năm {yr}</option>
                ))}
              </select>
            </div>

            {/* Advanced Time Toggle Column */}
            <div className="flex flex-col gap-1 w-full sm:w-auto flex-none">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block sm:opacity-0">Lọc nâng cao</label>
              <button
                type="button"
                onClick={() => setShowAdvancedTimeMode(!showAdvancedTimeMode)}
                className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer h-[34px] md:h-[38px] ${
                  showAdvancedTimeMode
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-2 ring-indigo-500/10'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Lọc thời gian chi tiết</span>
                {timeMode !== 'all' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0"></span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Filter Row 2: Advanced Time Filtering */}
        <AnimatePresence initial={false}>
          {showAdvancedTimeMode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden bg-white"
            >
              <div className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t border-slate-100">
                {/* Tab Modes */}
                <div className="flex flex-col gap-1.5 w-full md:w-auto">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chế độ phân lọc thời gian</span>
                  <div className="flex bg-slate-100/70 p-1 rounded-xl border border-slate-200/40 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={() => setTimeMode('all')}
                      className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        timeMode === 'all'
                          ? 'bg-white text-slate-900 shadow-xs border border-slate-200/20 font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Toàn bộ
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeMode('month')}
                      className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        timeMode === 'month'
                          ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/20 font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Theo Tháng
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeMode('quarter')}
                      className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        timeMode === 'quarter'
                          ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/20 font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Theo Quý
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeMode('preset')}
                      className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        timeMode === 'preset'
                          ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/20 font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Khoảng nhanh
                    </button>
                  </div>
                </div>

                {/* Target inputs according to active Tab Mode */}
                <div className="w-full md:w-auto flex-1 flex justify-start md:justify-end items-end">
                  {timeMode === 'all' && (
                    <div className="text-[11px] text-slate-400 italic">
                      Đang hiển thị toàn bộ thời gian của năm đã chọn.
                    </div>
                  )}

                  {timeMode === 'month' && (
                    <div className="flex flex-col gap-1 w-full md:w-auto md:max-w-xs">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chọn tháng cụ thể</label>
                      <div className="flex flex-wrap gap-1.5">
                        <select
                          id="month-time-select"
                          value={selectedMonthStr}
                          onChange={(e) => setSelectedMonthStr(e.target.value)}
                          className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center cursor-pointer min-w-[150px] w-full md:w-auto"
                        >
                          <option value="all">Tất cả các tháng (Tháng 1 - 12)</option>
                          <option value="0">Tháng 01</option>
                          <option value="1">Tháng 02</option>
                          <option value="2">Tháng 03</option>
                          <option value="3">Tháng 04</option>
                          <option value="4">Tháng 05</option>
                          <option value="5">Tháng 06</option>
                          <option value="6">Tháng 07</option>
                          <option value="7">Tháng 08</option>
                          <option value="8">Tháng 09</option>
                          <option value="9">Tháng 10</option>
                          <option value="10">Tháng 11</option>
                          <option value="11">Tháng 12</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {timeMode === 'quarter' && (
                    <div className="flex flex-col gap-1.5 w-full md:w-auto">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chọn Quý thống kê</label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {['all', '1', '2', '3', '4'].map((qVal) => {
                          const isSelected = selectedQuarterStr === qVal;
                          let label = '';
                          if (qVal === 'all') label = 'Tất cả quý';
                          else if (qVal === '1') label = 'Quý I (T1-3)';
                          else if (qVal === '2') label = 'Quý II (T4-6)';
                          else if (qVal === '3') label = 'Quý III (T7-9)';
                          else if (qVal === '4') label = 'Quý IV (T10-12)';
                          
                          return (
                            <button
                              key={qVal}
                              type="button"
                              onClick={() => setSelectedQuarterStr(qVal)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs font-bold'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {timeMode === 'preset' && (
                    <div className="flex flex-col gap-1 w-full md:w-64">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lọc nhanh theo chu kỳ</label>
                      <select
                        id="preset-time-select"
                        value={presetRange}
                        onChange={(e) => setPresetRange(e.target.value as any)}
                        className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer w-full"
                      >
                        <option value="last_7_days">7 ngày vừa qua</option>
                        <option value="this_month">Tháng này (Hiện tại)</option>
                        <option value="last_month">Tháng trước</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* KPI Cards Area */}
      <div id="dashboard-kpis" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Card */}
        <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-[0_8px_30px_rgb(15,23,42,0.08)] hover:shadow-[0_15px_35px_rgb(15,23,42,0.18)] hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[125px]">
          <div>
            <p className="text-[10px] uppercase font-semibold text-slate-300 tracking-wider">Tổng cộng hồ sơ</p>
            <p className="text-2xl font-bold font-mono mt-1.5">{stats.total.toLocaleString('vi-VN')}</p>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Toàn hệ thống</p>
          <div className="absolute right-3.5 top-3.5 p-1.5 bg-white/10 rounded-lg text-white">
            <Users className="w-4 h-4" />
          </div>
        </div>

        {/* 0-6 Group Card */}
        <div className="bg-white rounded-2xl border border-slate-100/70 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.025)] hover:shadow-[0_15px_35px_rgba(30,41,59,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between min-h-[125px]">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">0 - dưới 6 tuổi</span>
              <p className="text-xl font-bold font-mono text-slate-800 leading-none">{stats.under6.toLocaleString('vi-VN')}</p>
            </div>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-500 shadow-sm shadow-blue-100/50">
              <Baby className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-50">
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-50 text-blue-600 font-semibold text-[9px] scale-90 font-sans">%</div>
            <span className="font-medium text-slate-600">Tỷ lệ: {stats.total > 0 ? ((stats.under6 / stats.total) * 100).toFixed(1) : 0}%</span>
          </div>
        </div>

        {/* 6-18 Group Card */}
        <div className="bg-white rounded-2xl border border-slate-100/70 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.025)] hover:shadow-[0_15px_35px_rgba(30,41,59,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between min-h-[125px]">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">6 - dưới 18 tuổi</span>
              <p className="text-xl font-bold font-mono text-slate-800 leading-none">{stats.from6to18.toLocaleString('vi-VN')}</p>
            </div>
            <div className="p-2 rounded-xl bg-cyan-50 text-cyan-500 shadow-sm shadow-cyan-100/50">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-50">
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-cyan-50 text-cyan-600 font-semibold text-[9px] scale-90 font-sans">%</div>
            <span className="font-medium text-slate-600">Tỷ lệ: {stats.total > 0 ? ((stats.from6to18 / stats.total) * 100).toFixed(1) : 0}%</span>
          </div>
        </div>

        {/* 18-60 workforce Card */}
        <div className="bg-white rounded-2xl border border-slate-100/70 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.025)] hover:shadow-[0_15px_35px_rgba(30,41,59,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between min-h-[125px]">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">18 - dưới 60 tuổi</span>
              <p className="text-xl font-bold font-mono text-slate-800 leading-none">{stats.from18to60.toLocaleString('vi-VN')}</p>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-500 shadow-sm shadow-emerald-100/50">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-50">
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 font-semibold text-[9px] scale-90 font-sans">%</div>
            <span className="font-medium text-slate-600">Tỷ lệ: {stats.total > 0 ? ((stats.from18to60 / stats.total) * 100).toFixed(1) : 0}%</span>
          </div>
        </div>

        {/* Seniors Group Card */}
        <div className="bg-white rounded-2xl border border-slate-100/70 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.025)] hover:shadow-[0_15px_35px_rgba(30,41,59,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between min-h-[125px]">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Từ 60 tuổi trở lên</span>
              <p className="text-xl font-bold font-mono text-slate-800 leading-none">{stats.above60.toLocaleString('vi-VN')}</p>
            </div>
            <div className="p-2 rounded-xl bg-pink-50 text-pink-500 shadow-sm shadow-pink-100/50">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-50">
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-pink-50 text-pink-600 font-semibold text-[9px] scale-90 font-sans">%</div>
            <span className="font-medium text-slate-600">Tỷ lệ: {stats.total > 0 ? ((stats.above60 / stats.total) * 100).toFixed(1) : 0}%</span>
          </div>
        </div>
      </div>

      {/* Layout Tab Switcher for Clean/Minimalist Dashboard */}
      <div className="bg-white border border-slate-200/60 p-2 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs select-none">
        <div className="flex items-center gap-2 px-2">
          <LayoutDashboard className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="text-xs font-bold text-slate-800">Biểu đồ trực quan (Chế độ xem tối giản)</span>
        </div>
        <div className="flex flex-wrap items-center bg-slate-50 p-1 rounded-xl border border-slate-200/60 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setActiveChartTab('demographics')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
              activeChartTab === 'demographics'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/20 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>Cơ cấu Nhóm tuổi</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('comparison')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
              activeChartTab === 'comparison'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/20 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>So sánh Cơ sở</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('trend')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
              activeChartTab === 'trend'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/20 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>Tiến độ ngày</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('all')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
              activeChartTab === 'all'
                ? 'bg-indigo-600 text-white shadow-sm border border-indigo-700 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Tất cả biểu đồ</span>
          </button>
        </div>
      </div>

      {/* Section: Facility Comparison Card */}
      {(activeChartTab === 'comparison' || activeChartTab === 'all') && (
        <div id="facility-comparison-card" className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900">Đối chiếu Chỉ số & Hiệu suất giữa các Cơ sở Y tế</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">So sánh trực quan cơ cấu đối tượng và tỷ lệ phần trăm hoàn thành chỉ tiêu đề ra giữa các địa bàn cơ sở.</p>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100 shrink-0">
              <button
                id="compare-mode-stacked"
                onClick={() => setCompareMode('stacked')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  compareMode === 'stacked'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Cột chồng (Tỷ trọng)
              </button>
              <button
                id="compare-mode-grouped"
                onClick={() => setCompareMode('grouped')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  compareMode === 'grouped'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Cột nhóm (Chỉ số rời)
              </button>
            </div>
          </div>

          {/* Facility Selector Panel */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span>Cơ sở y tế đối chiếu ({selectedComparisonFacilities.length}/{uniqueFacilitiesOnly.length}):</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  id="btn-select-all-comp"
                  onClick={selectAllFacilities}
                  className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors hover:underline focus:outline-none"
                >
                  Chọn tất cả
                </button>
                <span className="text-slate-300">|</span>
                <button
                  id="btn-deselect-all-comp"
                  onClick={deselectAllFacilities}
                  className="text-slate-500 hover:text-slate-700 font-medium transition-colors hover:underline focus:outline-none"
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 max-h-[110px] overflow-y-auto">
              {uniqueFacilitiesOnly.length === 0 ? (
                <span className="text-xs text-slate-400">Chưa ghi nhận cơ sở nào. Vui lòng nhập hồ sơ để kích hoạt.</span>
              ) : (
                uniqueFacilitiesOnly.map((facility) => {
                  const isSelected = selectedComparisonFacilities.includes(facility);
                  return (
                    <button
                      key={facility}
                      id={`checkbox-comp-${facility}`}
                      onClick={() => toggleComparisonFacility(facility)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all border font-medium cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span>{facility}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Dynamic Charts Grid */}
          <div className="grid grid-cols-1 gap-6 pt-2">
            
            {/* Chart Left: Demographic Grouping Structure */}
            <div className="bg-slate-50/20 p-4 rounded-xl border border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>Cơ cấu Đối tượng & Nhóm tuổi</span>
              </h4>
              <div className="h-[280px]">
                {selectedComparisonFacilities.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <p className="text-slate-400 text-xs">Chưa chọn cơ sở để hiển thị biểu đồ</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={comparisonData}
                      margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="facility" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', borderColor: '#f1f5f9', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                        formatter={(value, name) => [`${value.toLocaleString('vi-VN')} hồ sơ`, name]}
                      />
                      <Legend
                        verticalAlign="top"
                        height={32}
                        iconType="circle"
                        iconSize={6}
                        wrapperStyle={{ fontSize: '10px', paddingBottom: '8px' }}
                      />
                      <Bar
                        dataKey="Dưới 6 tuổi"
                        stackId={compareMode === 'stacked' ? 'a' : undefined}
                        fill="#3b82f6"
                        radius={compareMode === 'stacked' ? [0, 0, 0, 0] : [3, 3, 0, 0]}
                        barSize={compareMode === 'stacked' ? 36 : 8}
                      />
                      <Bar
                        dataKey="Từ 6-18 tuổi"
                        stackId={compareMode === 'stacked' ? 'a' : undefined}
                        fill="#06b6d4"
                        radius={compareMode === 'stacked' ? [0, 0, 0, 0] : [3, 3, 0, 0]}
                        barSize={compareMode === 'stacked' ? 36 : 8}
                      />
                      <Bar
                        dataKey="Từ 18-60 tuổi"
                        stackId={compareMode === 'stacked' ? 'a' : undefined}
                        fill="#10b981"
                        radius={compareMode === 'stacked' ? [0, 0, 0, 0] : [3, 3, 0, 0]}
                        barSize={compareMode === 'stacked' ? 36 : 8}
                      />
                      <Bar
                        dataKey="Từ 60 tuổi trở lên"
                        stackId={compareMode === 'stacked' ? 'a' : undefined}
                        fill="#ec4899"
                        radius={compareMode === 'stacked' ? [3, 3, 0, 0] : [3, 3, 0, 0]}
                        barSize={compareMode === 'stacked' ? 36 : 8}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Section: Facility Statistical Summary Table */}
      <div id="facility-summary-table-card" className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-900">Bảng Tổng hợp Số liệu & Hiệu suất theo Cơ sở</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Thống kê chi tiết tổng lượng hồ sơ thu nhận thực tế và cơ cấu của từng đơn vị cơ sở khám sức khỏe.
            </p>
          </div>
          
          {/* Table Search */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm nhanh tên cơ sở..."
              value={tableSearchQuery}
              onChange={(e) => setTableSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {searchedTableData.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-150">
            Không tìm thấy cơ sở y tế nào phù hợp với từ khóa "{tableSearchQuery}".
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[9px] select-none">
                <tr>
                  <th className="px-4 py-3 text-center w-12">Hạng</th>
                  <th className="px-4 py-3">Cơ sở y tế</th>
                  <th className="px-4 py-3 text-right">Dưới 6 tuổi</th>
                  <th className="px-4 py-3 text-right">Từ 6-18 tuổi</th>
                  <th className="px-4 py-3 text-right">Từ 18-60 tuổi</th>
                  <th className="px-4 py-3 text-right">Trên 60 tuổi</th>
                  <th className="px-4 py-3 text-right font-bold w-24">Tổng cộng</th>
                  <th className="px-4 py-3 text-center w-28">Chỉ tiêu</th>
                  <th className="px-4 py-3 text-center w-28">Tỷ lệ Đạt</th>
                  <th className="px-4 py-3 text-center w-24">% Đóng góp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {searchedTableData.map((item, index) => {
                  const contributionPercent = totalAllFacilities > 0 
                    ? ((item.total / totalAllFacilities) * 100) 
                    : 0;
                  
                  const targetValue = facilityTargets[item.facility] || 0;
                  // Áp dụng công thức: tỷ lệ = số lượng hồ sơ / số lượng chỉ tiêu
                  const rawAchRate = targetValue > 0 ? (item.total / targetValue) * 100 : 0;
                  const isEditing = editingFacility === item.facility;
                  
                  return (
                    <tr key={item.facility} className="hover:bg-slate-50/50 transition-colors group">
                      {/* Rank badge */}
                      <td className="px-4 py-3.5 text-center">
                        {index === 0 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
                            1
                          </span>
                        ) : index === 1 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                            2
                          </span>
                        ) : index === 2 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-50 text-orange-700 font-bold border border-orange-200">
                            3
                          </span>
                        ) : (
                          <span className="font-mono text-slate-400">{index + 1}</span>
                        )}
                      </td>
                      
                      {/* Facility info */}
                      <td className="px-4 py-3.5 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-xs">{item.facility}</span>
                        </div>
                      </td>
                      
                      {/* Sub-groups */}
                      <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                        {item.under6.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                        {item.from6to18.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                        {item.from18to60.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                        {item.above60.toLocaleString('vi-VN')}
                      </td>
                      
                      {/* Total sum */}
                      <td className="px-4 py-3.5 text-right font-bold text-slate-900 font-mono">
                        {item.total.toLocaleString('vi-VN')}
                      </td>
                      
                      {/* Targets (Chỉ tiêu) */}
                      <td className="px-4 py-3.5 text-center font-mono">
                        {isEditing ? (
                          <div className="flex items-center justify-center">
                            <input
                              type="number"
                              min="0"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => saveTarget(item.facility)}
                              onKeyDown={(e) => handleTargetKeyDown(e, item.facility)}
                              className="w-20 px-1.5 py-1 text-center bg-white border border-indigo-300 rounded text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-none text-slate-800 font-bold font-mono"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditing(item.facility, targetValue)}
                            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all text-slate-600 hover:text-indigo-600 font-medium cursor-pointer w-full text-center"
                            title="Đặt / sửa Chỉ tiêu"
                          >
                            <Target className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs font-semibold">{targetValue > 0 ? targetValue.toLocaleString('vi-VN') : 'Đặt...'}</span>
                            <Edit2 className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 shrink-0 select-none transition-opacity" />
                          </button>
                        )}
                      </td>

                      {/* Achievement rate (Tỷ lệ Đạt) */}
                      <td className="px-4 py-3.5 font-mono text-center">
                        {targetValue > 0 ? (
                          <div className="flex flex-col items-center gap-1 select-none">
                            <span className={`font-bold text-[10.5px] ${rawAchRate >= 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                              {rawAchRate.toFixed(1)}%
                            </span>
                            <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-1.5 rounded-full transition-all duration-500 ${rawAchRate >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                style={{ width: `${Math.min(100, rawAchRate)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>

                      {/* Contribution percentage progress bar */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-center gap-1 select-none">
                          <span className="font-semibold text-slate-700 font-mono text-[10px]">{contributionPercent.toFixed(1)}%</span>
                          <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                            <div 
                              className="bg-indigo-600 h-1 rounded-full transition-all duration-500" 
                              style={{ width: `${contributionPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section: Age Group & Category Statistical Summary Table */}
      <div id="age-category-summary-table-card" className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-900">Bảng Tổng hợp Số liệu chi tiết theo Từng Nhóm tuổi và  Danh mục đối tượng</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Phân bổ tổng số lượng hồ sơ sức khoẻ theo các nhóm đối tượng (Từ Trẻ em dưới 6 tuổi, lứa tuổi Học sinh, các Phân loại Lao động 18-60 đến Người cao tuổi trên 60).
          </p>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[9px] select-none">
              <tr>
                <th className="px-4 py-3 w-16 text-center">Màu sắc</th>
                <th className="px-4 py-3">Danh mục đối tượng</th>
                <th className="px-4 py-3">Nhóm Tổ (Nhóm chung)</th>
                <th className="px-4 py-3 text-right">Tổng số hồ sơ</th>
                <th className="px-4 py-3 text-center w-40">Tỷ lệ cơ cấu</th>
                <th className="px-4 py-3">Mô tả chi tiết phân nhóm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {ageCategoryTableData.map((item) => {
                return (
                  <tr key={item.category} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-3.5 text-center">
                      <span 
                        className="inline-block w-3.5 h-3.5 rounded-full border border-white shadow-xs" 
                        style={{ backgroundColor: item.color }}
                      />
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {item.name}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50/50 text-indigo-700">
                        {item.parentGroupName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold font-mono text-slate-900">
                      {item.total.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex flex-col items-center gap-1 select-none">
                        <span className="font-bold text-[10px] text-slate-700 font-mono">
                          {item.percentage.toFixed(1)}%
                        </span>
                        <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="h-1.5 rounded-full transition-all duration-500" 
                            style={{ 
                              width: `${item.percentage}%`,
                              backgroundColor: item.color
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 max-w-xs truncate" title={item.subName || item.name}>
                      {item.subName || 'Độ tuổi đặc thù không phân nhóm nhỏ'}
                    </td>
                  </tr>
                );
              })}
              {/* Total Row */}
              <tr className="bg-slate-50/30 font-bold divide-y divide-slate-100">
                <td className="px-4 py-3.5 text-center">
                  <span className="font-mono text-[10px] text-slate-400">∑</span>
                </td>
                <td className="px-4 py-3.5 font-bold text-slate-900">
                  TỔNG CỘNG TẤT CẢ DANH MỤC
                </td>
                <td className="px-4 py-3.5"></td>
                <td className="px-4 py-3.5 text-right font-black font-mono text-indigo-600 text-[13px]">
                  {stats.total.toLocaleString('vi-VN')}
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span className="font-bold text-slate-700 font-mono text-[11px]">
                    100.0%
                  </span>
                </td>
                <td className="px-4 py-3.5 text-slate-400 font-normal">
                  Toàn bộ hồ sơ phân lọc theo bộ lọc hiện tại
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Charts Row */}
      {(activeChartTab === 'demographics' || activeChartTab === 'all') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left: Pie chart major distribution */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4.5 h-4.5 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-900">Phân phối Hồ sơ theo Nhóm độ tuổi</h3>
            </div>
            <div className="h-[280px]">
              {pieChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Không lọc được dữ liệu nào
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => `${value.toLocaleString('vi-VN')} hồ sơ`} 
                      contentStyle={{ borderRadius: '12px', borderColor: '#f1f5f9', fontSize: '11px' }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Right: Subdivision breakout for workforce (18-60) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-900">Cơ cấu Nhóm 18 đến dưới 60 tuổi (Chi tiết)</h3>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-medium">
                3 nhóm đối tượng
              </span>
            </div>
            <div className="h-[280px]">
              {subdivs18to60Data.every(item => item.value === 0) ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs text-center px-4">
                  Chưa có số liệu nhập cho nhóm độ tuổi lao động (18-60 tuổi). Hãy nhập bản ghi các phân ngành này để xem.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={subdivs18to60Data}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <Tooltip 
                      formatter={(value) => `${value.toLocaleString('vi-VN')} hồ sơ`}
                      contentStyle={{ borderRadius: '12px', borderColor: '#f1f5f9', fontSize: '11px' }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                      {subdivs18to60Data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Trend Row */}
      {(activeChartTab === 'trend' || activeChartTab === 'all') && (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4.5 h-4.5 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-900">Tiến độ thu nhận số liệu theo Ngày</h3>
          </div>
          <div className="h-[220px]">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Chưa có đủ số liệu ngày khám để biểu diễn tiến trình
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorQuantity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip 
                    formatter={(value) => `${value.toLocaleString('vi-VN')} hồ sơ`} 
                    contentStyle={{ borderRadius: '12px', borderColor: '#f1f5f9', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="Số hồ sơ" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorQuantity)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
