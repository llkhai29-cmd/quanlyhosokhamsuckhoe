/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
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
  Area 
} from 'recharts';
import { LayoutDashboard, TrendingUp, Users, Calendar, Landmark, Percent, BarChart3, CheckSquare, Square, SlidersHorizontal } from 'lucide-react';

interface DashboardProps {
  records: CheckupRecord[];
}

export default function Dashboard({ records }: DashboardProps) {
  const [filterFacility, setFilterFacility] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'all' | 'last_7_days' | 'this_month' | 'last_month'>('all');

  // List of unique facilities for filter dropdown
  const facilitiesList = useMemo(() => {
    const list = new Set(records.map((r) => r.facility));
    return ['all', ...Array.from(list)];
  }, [records]);

  // Filtered records based on controls
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Facility filter
      if (filterFacility !== 'all' && r.facility !== filterFacility) return false;

      // Time range filter
      if (timeRange !== 'all') {
        const recordDate = new Date(r.date);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - recordDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (timeRange === 'last_7_days' && diffDays > 7) return false;
        
        if (timeRange === 'this_month') {
          const currentMonth = today.getMonth();
          const currentYear = today.getFullYear();
          if (recordDate.getMonth() !== currentMonth || recordDate.getFullYear() !== currentYear) return false;
        }

        if (timeRange === 'last_month') {
          const prevMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
          const prevYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
          if (recordDate.getMonth() !== prevMonth || recordDate.getFullYear() !== prevYear) return false;
        }
      }
      return true;
    });
  }, [records, filterFacility, timeRange]);

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

        if (timeRange !== 'all') {
          const recordDate = new Date(r.date);
          const today = new Date();
          const diffTime = Math.abs(today.getTime() - recordDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (timeRange === 'last_7_days' && diffDays > 7) return false;

          if (timeRange === 'this_month') {
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            if (recordDate.getMonth() !== currentMonth || recordDate.getFullYear() !== currentYear) return false;
          }

          if (timeRange === 'last_month') {
            const prevMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
            const prevYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
            if (recordDate.getMonth() !== prevMonth || recordDate.getFullYear() !== prevYear) return false;
          }
        }
        return true;
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
  }, [records, selectedComparisonFacilities, timeRange]);

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
      <div id="dashboard-filters" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-slate-700" />
          <span className="font-semibold text-slate-800 text-sm">Bộ lọc phân tích</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Facility Filter */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <span className="text-xs text-slate-500 whitespace-nowrap">Địa bàn:</span>
            <select
              id="filter-facility-select"
              value={filterFacility}
              onChange={(e) => setFilterFacility(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all min-w-[140px]"
            >
              <option value="all">Tất cả các cơ sở ({records.length})</option>
              {facilitiesList.filter(f => f !== 'all').map((fac) => (
                <option key={fac} value={fac}>{fac}</option>
              ))}
            </select>
          </div>

          {/* Time Filter */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <span className="text-xs text-slate-500 whitespace-nowrap">Thời gian:</span>
            <select
              id="filter-time-select"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              <option value="all">Toàn bộ thời gian</option>
              <option value="last_7_days">7 ngày vừa qua</option>
              <option value="this_month">Tháng này</option>
              <option value="last_month">Tháng trước</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Area */}
      <div id="dashboard-kpis" className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Card */}
        <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <p className="text-[10px] uppercase font-semibold text-slate-300 tracking-wider">Tổng cộng hồ sơ</p>
          <p className="text-2xl font-bold font-mono mt-1">{stats.total.toLocaleString('vi-VN')}</p>
          <p className="text-[10px] text-slate-400 mt-2">Toàn hệ thống</p>
          <div className="absolute right-3 bottom-3 opacity-15">
            <Users className="w-10 h-10" />
          </div>
        </div>

        {/* 0-6 Group Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">0 - dưới 6 tuổi</span>
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-800">{stats.under6.toLocaleString('vi-VN')}</p>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-2">
            <Percent className="w-3 h-3 text-slate-400" />
            <span>Tỷ lệ: {stats.total > 0 ? ((stats.under6 / stats.total) * 100).toFixed(1) : 0}%</span>
          </div>
        </div>

        {/* 6-18 Group Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">6 - dưới 18 tuổi</span>
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-800">{stats.from6to18.toLocaleString('vi-VN')}</p>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-2">
            <Percent className="w-3 h-3 text-slate-500" />
            <span>Tỷ lệ: {stats.total > 0 ? ((stats.from6to18 / stats.total) * 100).toFixed(1) : 0}%</span>
          </div>
        </div>

        {/* 18-60 workforce Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">18 - dưới 60 tuổi</span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-800">{stats.from18to60.toLocaleString('vi-VN')}</p>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-2">
            <Percent className="w-3 h-3 text-emerald-500" />
            <span>Tỷ lệ: {stats.total > 0 ? ((stats.from18to60 / stats.total) * 100).toFixed(1) : 0}%</span>
          </div>
        </div>

        {/* Seniors Group Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Từ 60 tuổi trở lên</span>
            <div className="w-2.5 h-2.5 rounded-full bg-pink-500" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-800">{stats.above60.toLocaleString('vi-VN')}</p>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-2">
            <Percent className="w-3 h-3 text-pink-500" />
            <span>Tỷ lệ: {stats.total > 0 ? ((stats.above60 / stats.total) * 100).toFixed(1) : 0}%</span>
          </div>
        </div>
      </div>

      {/* Section: Facility Comparison Bar Chart */}
      <div id="facility-comparison-card" className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-900">So sánh Số liệu hồ sơ giữa các Cơ sở Y tế</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">So sánh trực quan tỷ trọng nhóm tuổi chỉ định khám sức khỏe định kỳ giữa các địa bàn cơ sở.</p>
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

        {/* Chart Window */}
        <div className="h-[320px] pt-2">
          {selectedComparisonFacilities.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-6">
              <div className="p-3 bg-slate-50 rounded-full text-slate-400 mb-2">
                <BarChart3 className="w-8 h-8 stroke-1" />
              </div>
              <p className="text-slate-600 text-xs font-semibold">Không có cơ sở nào được chọn để đối sánh</p>
              <p className="text-slate-400 text-[10px] mt-1 max-w-xs">Chọn một hoặc nhiều cơ sở y tế ở bảng bộ lọc phía trên để hiển thị biểu đồ đối chiếu.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonData}
                margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="facility" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', borderColor: '#f1f5f9', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                  formatter={(value, name) => [`${value.toLocaleString('vi-VN')} hồ sơ`, name]}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                />
                <Bar
                  dataKey="Dưới 6 tuổi"
                  stackId={compareMode === 'stacked' ? 'a' : undefined}
                  fill="#3b82f6"
                  radius={compareMode === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                  barSize={compareMode === 'stacked' ? 44 : 10}
                />
                <Bar
                  dataKey="Từ 6-18 tuổi"
                  stackId={compareMode === 'stacked' ? 'a' : undefined}
                  fill="#06b6d4"
                  radius={compareMode === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                  barSize={compareMode === 'stacked' ? 44 : 10}
                />
                <Bar
                  dataKey="Từ 18-60 tuổi"
                  stackId={compareMode === 'stacked' ? 'a' : undefined}
                  fill="#10b981"
                  radius={compareMode === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                  barSize={compareMode === 'stacked' ? 44 : 10}
                />
                <Bar
                  dataKey="Từ 60 tuổi trở lên"
                  stackId={compareMode === 'stacked' ? 'a' : undefined}
                  fill="#ec4899"
                  radius={compareMode === 'stacked' ? [4, 4, 0, 0] : [4, 4, 0, 0]}
                  barSize={compareMode === 'stacked' ? 44 : 10}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Main Charts Row */}
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

      {/* Trend Row */}
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
    </div>
  );
}
