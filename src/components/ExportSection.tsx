/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { CheckupRecord, CATEGORIES } from '../types';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet, Calendar, CalendarDays, Filter } from 'lucide-react';

interface ExportSectionProps {
  records: CheckupRecord[];
}

export default function ExportSection({ records }: ExportSectionProps) {
  const [reportMonth, setReportMonth] = useState<string>(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${yyyy}-${mm}`; // YYYY-MM
  });
  const [reportFacility, setReportFacility] = useState<string>('all');

  // List of facilities for selection dropdown
  const facilities = useMemo(() => {
    const list = new Set(records.map((r) => r.facility));
    return ['all', ...Array.from(list)];
  }, [records]);

  // Compute reports datasets
  const reportData = useMemo(() => {
    const [year, month] = reportMonth.split('-');
    
    // Filter records by Month-Year and Facility
    const filtered = records.filter((r) => {
      const rDate = new Date(r.date);
      const yearMatches = rDate.getFullYear() === parseInt(year, 10);
      const monthMatches = (rDate.getMonth() + 1) === parseInt(month, 10);
      const facilityMatches = reportFacility === 'all' || r.facility === reportFacility;
      
      return yearMatches && monthMatches && facilityMatches;
    });

    let under_6 = 0;
    let from_6_to_18 = 0;
    let from_18_to_60_community = 0;
    let from_18_to_60_worker = 0;
    let from_18_to_60_officer = 0;
    let above_60 = 0;

    filtered.forEach((r) => {
      if (r.category === 'under_6') under_6 += r.quantity;
      if (r.category === 'from_6_to_18') from_6_to_18 += r.quantity;
      if (r.category === 'from_18_to_60_community') from_18_to_60_community += r.quantity;
      if (r.category === 'from_18_to_60_worker') from_18_to_60_worker += r.quantity;
      if (r.category === 'from_18_to_60_officer') from_18_to_60_officer += r.quantity;
      if (r.category === 'above_60') above_60 += r.quantity;
    });

    const total = under_6 + from_6_to_18 + from_18_to_60_community + from_18_to_60_worker + from_18_to_60_officer + above_60;

    return {
      filteredRecordsCount: filtered.length,
      under_6,
      from_6_to_18,
      from_18_to_60_community,
      from_18_to_60_worker,
      from_18_to_60_officer,
      above_60,
      total,
    };
  }, [records, reportMonth, reportFacility]);

  // Handle excel build & download triggers
  const handleExportExcel = () => {
    const [year, month] = reportMonth.split('-');
    
    // Format descriptive array rows for SheetJS
    const excelBody = [
      ['BÁO CÁO THỐNG KÊ SỐ LƯỢNG HỒ SƠ KHÁM SỨC KHỎE ĐỊNH KỲ'],
      [`Kỳ báo cáo: Tháng ${month}/${year}`],
      [`Đơn vị báo cáo: ${reportFacility === 'all' ? 'Tất cả cơ sở khám bệnh' : reportFacility}`],
      [`Thời gian kết xuất: ${new Date().toLocaleString('vi-VN')}`],
      [], // blank line
      ['STT', 'Mã Nhóm', 'Nhóm đối tượng độ tuổi', 'Phân loại chi tiết', 'Nhóm độ tuổi gốc', 'Số lượng hồ sơ', 'Tỷ lệ %'],
      [
        '1', 
        'under_6', 
        CATEGORIES.under_6.name, 
        '-', 
        CATEGORIES.under_6.parentGroupName, 
        reportData.under_6, 
        reportData.total > 0 ? (reportData.under_6 / reportData.total) : 0
      ],
      [
        '2', 
        'from_6_to_18', 
        CATEGORIES.from_6_to_18.name, 
        '-', 
        CATEGORIES.from_6_to_18.parentGroupName, 
        reportData.from_6_to_18, 
        reportData.total > 0 ? (reportData.from_6_to_18 / reportData.total) : 0
      ],
      [
        '3', 
        'from_18_to_60_community', 
        '18 đến dưới 60 tuổi', 
        'Cộng đồng', 
        CATEGORIES.from_18_to_60_community.parentGroupName, 
        reportData.from_18_to_60_community, 
        reportData.total > 0 ? (reportData.from_18_to_60_community / reportData.total) : 0
      ],
      [
        '4', 
        'from_18_to_60_worker', 
        '18 đến dưới 60 tuổi', 
        'Người lao động tại công ty, doanh nghiệp', 
        CATEGORIES.from_18_to_60_worker.parentGroupName, 
        reportData.from_18_to_60_worker, 
        reportData.total > 0 ? (reportData.from_18_to_60_worker / reportData.total) : 0
      ],
      [
        '5', 
        'from_18_to_60_officer', 
        '18 đến dưới 60 tuổi', 
        'Cán bộ viên chức công chức', 
        CATEGORIES.from_18_to_60_officer.parentGroupName, 
        reportData.from_18_to_60_officer, 
        reportData.total > 0 ? (reportData.from_18_to_60_officer / reportData.total) : 0
      ],
      [
        '6', 
        'above_60', 
        CATEGORIES.above_60.name, 
        '-', 
        CATEGORIES.above_60.parentGroupName, 
        reportData.above_60, 
        reportData.total > 0 ? (reportData.above_60 / reportData.total) : 0
      ],
      [
        '-', 
        'TOTAL', 
        'TỔNG CỘNG', 
        '-', 
        '-', 
        reportData.total, 
        reportData.total > 0 ? 1 : 0
      ],
    ];

    // Create Excel Workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelBody);

    // Apply metadata configs and percentage layout formats
    ws['!cols'] = [
      { wch: 6 },  // STT
      { wch: 15 }, // Mã Nhóm
      { wch: 25 }, // Nhóm đối tượng
      { wch: 40 }, // Phân loại chi tiết
      { wch: 25 }, // Nhóm độ tuổi gốc
      { wch: 18 }, // Số lượng
      { wch: 12 }, // Tỷ lệ
    ];

    // Read cell reference keys and apply formats if matched
    const percentageCells = ['G7', 'G8', 'G9', 'G10', 'G11', 'G12', 'G13'];
    percentageCells.forEach((cellRef) => {
      if (ws[cellRef]) {
        ws[cellRef].t = 'n'; // Numeric format
        ws[cellRef].z = '0.0%'; // Pattern percentage
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, `Báo cáo Tháng ${month}`);
    
    // Write out the file with descriptive filename
    const filename = `Bao_cao_Ho_so_Kham_suc_khoe_T${month}_${year}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <div id="export-card" className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-lg text-slate-900">Xuất báo cáo Excel định kỳ</h2>
          <p className="text-xs text-slate-500">Tạo bảng biểu báo cáo hoàn chỉnh phục vụ lưu trữ hoặc in ấn</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Controls Column */}
        <div className="md:col-span-1 space-y-4 p-5 rounded-xl bg-slate-50 border border-slate-100 h-fit">
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            Cấu hình báo cáo
          </h3>
          
          {/* Calendar Select Month */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
              Chọn tháng báo cáo
            </label>
            <input
              id="report-month-picker"
              type="month"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Select facility */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Chọn cơ sở y tế
            </label>
            <select
              id="report-facility-select"
              value={reportFacility}
              onChange={(e) => setReportFacility(e.target.value)}
              className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Tất cả các cơ sở hành chính</option>
              {facilities.filter(f => f !== 'all').map((fac) => (
                <option key={fac} value={fac}>{fac}</option>
              ))}
            </select>
          </div>

          <button
            id="btn-export-excel-action"
            onClick={handleExportExcel}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-500 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
          >
            <Download className="w-4 h-4" />
            Tải tệp Excel báo cáo (.xlsx)
          </button>
        </div>

        {/* Live Preview Column */}
        <div className="md:col-span-2 border border-slate-100 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">
                Bản xem trước dữ liệu báo cáo tháng {reportMonth.split('-')[1]}/{reportMonth.split('-')[0]}
              </p>
              <p className="text-[10px] text-slate-400">
                Lọc dựa trên {reportData.filteredRecordsCount} bản ghi thực tế đã lưu
              </p>
            </div>
            <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium font-mono">
              Tổng số hồ sơ: {reportData.total.toLocaleString('vi-VN')}
            </span>
          </div>

          {/* Structured table preview */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase">
                  <th className="py-2">Nhóm đối tượng độ tuổi</th>
                  <th className="py-2">Phân loại chi tiết</th>
                  <th className="py-2 text-right">Số lượng hồ sơ</th>
                  <th className="py-2 text-right">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {/* 1. Under 6 */}
                <tr>
                  <td className="py-2.5 font-medium text-slate-800">{CATEGORIES.under_6.name}</td>
                  <td className="py-2.5 text-slate-400">-</td>
                  <td className="py-2.5 text-right font-bold text-slate-950 font-mono">{reportData.under_6.toLocaleString('vi-VN')}</td>
                  <td className="py-2.5 text-right text-slate-500 font-mono">
                    {reportData.total > 0 ? ((reportData.under_6 / reportData.total) * 100).toFixed(1) : 0}%
                  </td>
                </tr>

                {/* 2. 6-18 */}
                <tr>
                  <td className="py-2.5 font-medium text-slate-800">{CATEGORIES.from_6_to_18.name}</td>
                  <td className="py-2.5 text-slate-400">-</td>
                  <td className="py-2.5 text-right font-bold text-slate-950 font-mono">{reportData.from_6_to_18.toLocaleString('vi-VN')}</td>
                  <td className="py-2.5 text-right text-slate-500 font-mono">
                    {reportData.total > 0 ? ((reportData.from_6_to_18 / reportData.total) * 100).toFixed(1) : 0}%
                  </td>
                </tr>

                {/* 3. 18-60 Community */}
                <tr>
                  <td className="py-2.5 font-medium text-slate-800">18 tuổi đến liền dưới 60 tuổi</td>
                  <td className="py-2.5 text-slate-600 font-medium">Cộng đồng</td>
                  <td className="py-2.5 text-right font-bold text-slate-950 font-mono">{reportData.from_18_to_60_community.toLocaleString('vi-VN')}</td>
                  <td className="py-2.5 text-right text-slate-500 font-mono">
                    {reportData.total > 0 ? ((reportData.from_18_to_60_community / reportData.total) * 100).toFixed(1) : 0}%
                  </td>
                </tr>

                {/* 4. 18-60 Worker */}
                <tr>
                  <td className="py-2.5 font-medium text-slate-800">18 tuổi đến liền dưới 60 tuổi</td>
                  <td className="py-2.5 text-slate-600 font-medium">Người lao động tại công ty, DN</td>
                  <td className="py-2.5 text-right font-bold text-slate-950 font-mono">{reportData.from_18_to_60_worker.toLocaleString('vi-VN')}</td>
                  <td className="py-2.5 text-right text-slate-500 font-mono">
                    {reportData.total > 0 ? ((reportData.from_18_to_60_worker / reportData.total) * 100).toFixed(1) : 0}%
                  </td>
                </tr>

                {/* 5. 18-60 Official */}
                <tr>
                  <td className="py-2.5 font-medium text-slate-800">18 tuổi đến liền dưới 60 tuổi</td>
                  <td className="py-2.5 text-slate-600 font-medium">Cán bộ viên chức công chức</td>
                  <td className="py-2.5 text-right font-bold text-slate-950 font-mono">{reportData.from_18_to_60_officer.toLocaleString('vi-VN')}</td>
                  <td className="py-2.5 text-right text-slate-500 font-mono">
                    {reportData.total > 0 ? ((reportData.from_18_to_60_officer / reportData.total) * 100).toFixed(1) : 0}%
                  </td>
                </tr>

                {/* 6. Seniors */}
                <tr>
                  <td className="py-2.5 font-medium text-slate-800">{CATEGORIES.above_60.name}</td>
                  <td className="py-2.5 text-slate-400">-</td>
                  <td className="py-2.5 text-right font-bold text-slate-950 font-mono">{reportData.above_60.toLocaleString('vi-VN')}</td>
                  <td className="py-2.5 text-right text-slate-500 font-mono">
                    {reportData.total > 0 ? ((reportData.above_60 / reportData.total) * 100).toFixed(1) : 0}%
                  </td>
                </tr>

                {/* Total Row */}
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <td colSpan={2} className="py-3 px-2 text-slate-900 font-bold">TỔNG CỘNG HỒ SƠ</td>
                  <td className="py-3 px-2 text-right text-indigo-700 font-mono text-sm">{reportData.total.toLocaleString('vi-VN')}</td>
                  <td className="py-3 px-2 text-right text-slate-900 font-mono">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
