/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { CheckupRecord, CATEGORIES } from '../types';
import XLSX from 'xlsx-js-style';
import { Download, FileSpreadsheet, Calendar, CalendarDays, Filter, Target } from 'lucide-react';

interface ExportSectionProps {
  records: CheckupRecord[];
  facilityTargets?: Record<string, number>;
}

export default function ExportSection({ 
  records,
  facilityTargets = {}
}: ExportSectionProps) {
  const [exportMode, setExportMode] = useState<'month' | 'range'>('month');
  const [reportMonth, setReportMonth] = useState<string>(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${yyyy}-${mm}`; // YYYY-MM
  });
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}-01`; // First day of the month
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date();
    return today.toLocaleDateString('sv-SE'); // YYYY-MM-DD
  });
  const [reportFacility, setReportFacility] = useState<string>('all');

  // List of facilities for selection dropdown
  const facilities = useMemo(() => {
    const list = new Set(records.map((r) => r.facility));
    return ['all', ...Array.from(list)];
  }, [records]);

  // Compute reports datasets
  const reportData = useMemo(() => {
    // Filter records by Month-Year or Date Range and Facility
    const filtered = records.filter((r) => {
      const facilityMatches = reportFacility === 'all' || r.facility === reportFacility;
      if (!facilityMatches) return false;

      if (exportMode === 'month') {
        const [year, month] = reportMonth.split('-');
        const rDate = new Date(r.date);
        const yearMatches = rDate.getFullYear() === parseInt(year, 10);
        const monthMatches = (rDate.getMonth() + 1) === parseInt(month, 10);
        return yearMatches && monthMatches;
      } else {
        // Range mode: r.date is YYYY-MM-DD format
        return r.date >= startDate && r.date <= endDate;
      }
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
  }, [records, exportMode, reportMonth, startDate, endDate, reportFacility]);

  // Compute target value for selected facility / month
  const currentTarget = useMemo(() => {
    if (reportFacility === 'all') {
      // Sum target of all unique facilities present in records
      const uniqueFacs = Array.from(new Set(records.map((r) => r.facility).filter(Boolean)));
      return uniqueFacs.reduce((sum, f) => sum + (facilityTargets[f] || 0), 0);
    }
    return facilityTargets[reportFacility] || 0;
  }, [records, facilityTargets, reportFacility]);

  // Compute cumulative total count for selected facility across all time to match Dashboard summary table
  const cumulativeTotalForFacility = useMemo(() => {
    if (reportFacility === 'all') {
      return records.reduce((sum, r) => sum + r.quantity, 0);
    }
    return records
      .filter((r) => r.facility === reportFacility)
      .reduce((sum, r) => sum + r.quantity, 0);
  }, [records, reportFacility]);

  // Compute achievement/progress rate based on target and cumulative records sum from the summary table
  const achievementRate = useMemo(() => {
    if (currentTarget <= 0) return 0;
    return (cumulativeTotalForFacility / currentTarget) * 100;
  }, [cumulativeTotalForFacility, currentTarget]);

  // Handle excel build & download triggers
  const handleExportExcel = () => {
    let dateLabel = '';
    let filename = '';
    let tabName = '';

    if (exportMode === 'month') {
      const [year, month] = reportMonth.split('-');
      dateLabel = `Tháng ${month}/${year}`;
      filename = `Bao_cao_Ho_so_Kham_suc_khoe_T${month}_${year}.xlsx`;
      tabName = `Tháng ${month}`;
    } else {
      const startFmt = new Date(startDate).toLocaleDateString('vi-VN');
      const endFmt = new Date(endDate).toLocaleDateString('vi-VN');
      dateLabel = `Từ ngày ${startFmt} đến ngày ${endFmt}`;
      filename = `Bao_cao_Ho_so_Kham_suc_khoe_tu_${startDate}_den_${endDate}.xlsx`;
      tabName = 'Báo cáo ngày';
    }
    
    // Format descriptive array rows for SheetJS
    const excelBody = [
      ['BÁO CÁO THỐNG KÊ SỐ LƯỢNG HỒ SƠ KHÁM SỨC KHỎE ĐỊNH KỲ'],
      [], // Row 2 (blank spacer)
      ['Kỳ báo cáo:', dateLabel, '', '', 'Tổng số hồ sơ đã khám:', { v: reportData.total, t: 'n', z: '#,##0' }, ''], // Row 3
      ['Đơn vị báo cáo:', reportFacility === 'all' ? 'Tất cả cơ sở khám bệnh' : reportFacility, '', '', 'Chỉ tiêu được giao:', currentTarget > 0 ? { v: currentTarget, t: 'n', z: '#,##0' } : 'Chưa thiết lập', ''], // Row 4
      ['Thời gian xuất:', new Date().toLocaleString('vi-VN'), '', '', 'Tỷ lệ hoàn thành (lũy kế):', currentTarget > 0 ? { v: achievementRate / 100, t: 'n', z: '0.0%' } : '0.0%', ''], // Row 5
      [], // Row 6 (blank spacer)
      ['STT', 'Mã Nhóm', 'Nhóm đối tượng độ tuổi', 'Phân loại chi tiết', 'Nhóm độ tuổi gốc', 'Số lượng hồ sơ', 'Tỷ lệ %'], // Row 7 (Header)
      [
        '1', 
        'under_6', 
        CATEGORIES.under_6.name, 
        '-', 
        CATEGORIES.under_6.parentGroupName, 
        { v: reportData.under_6, t: 'n', z: '#,##0' }, 
        { f: 'IF(F14>0, F8/F14, 0)', t: 'n', z: '0.0%' }
      ],
      [
        '2', 
        'from_6_to_18', 
        CATEGORIES.from_6_to_18.name, 
        '-', 
        CATEGORIES.from_6_to_18.parentGroupName, 
        { v: reportData.from_6_to_18, t: 'n', z: '#,##0' }, 
        { f: 'IF(F14>0, F9/F14, 0)', t: 'n', z: '0.0%' }
      ],
      [
        '3', 
        'from_18_to_60_community', 
        '18 đến dưới 60 tuổi', 
        'Cộng đồng', 
        CATEGORIES.from_18_to_60_community.parentGroupName, 
        { v: reportData.from_18_to_60_community, t: 'n', z: '#,##0' }, 
        { f: 'IF(F14>0, F10/F14, 0)', t: 'n', z: '0.0%' }
      ],
      [
        '4', 
        'from_18_to_60_worker', 
        '18 đến dưới 60 tuổi', 
        'Người lao động tại công ty, doanh nghiệp', 
        CATEGORIES.from_18_to_60_worker.parentGroupName, 
        { v: reportData.from_18_to_60_worker, t: 'n', z: '#,##0' }, 
        { f: 'IF(F14>0, F11/F14, 0)', t: 'n', z: '0.0%' }
      ],
      [
        '5', 
        'from_18_to_60_officer', 
        '18 đến dưới 60 tuổi', 
        'Cán bộ viên chức công chức', 
        CATEGORIES.from_18_to_60_officer.parentGroupName, 
        { v: reportData.from_18_to_60_officer, t: 'n', z: '#,##0' }, 
        { f: 'IF(F14>0, F12/F14, 0)', t: 'n', z: '0.0%' }
      ],
      [
        '6', 
        'above_60', 
        CATEGORIES.above_60.name, 
        '-', 
        CATEGORIES.above_60.parentGroupName, 
        { v: reportData.above_60, t: 'n', z: '#,##0' }, 
        { f: 'IF(F14>0, F13/F14, 0)', t: 'n', z: '0.0%' }
      ],
      [
        '-', 
        'TOTAL', 
        'TỔNG CỘNG HỒ SƠ', 
        '-', 
        '-', 
        { f: 'SUM(F8:F13)', t: 'n', z: '#,##0' }, 
        { v: reportData.total > 0 ? 1.0 : 0.0, t: 'n', z: '0.0%' }
      ]
    ];
 
     // Create Excel Workbook
     const wb = XLSX.utils.book_new();
     const ws = XLSX.utils.aoa_to_sheet(excelBody);
 
     // Apply metadata configs and percentage layout formats
     ws['!cols'] = [
       { wch: 8 },  // STT (Column A)
       { wch: 25 }, // Mã Nhóm (Column B)
       { wch: 32 }, // Nhóm đối tượng (Column C)
       { wch: 42 }, // Phân loại chi tiết (Column D)
       { wch: 25 }, // Nhóm độ tuổi gốc (Column E)
       { wch: 22 }, // Số lượng (Column F)
       { wch: 15 }, // Tỷ lệ (Column G)
     ];
 
     ws['!rows'] = [
       { hpt: 32 }, // row 1 (A1 Title)
       { hpt: 12 }, // row 2 (spacer)
       { hpt: 22 }, // row 3 (KPI Row 1)
       { hpt: 22 }, // row 4 (KPI Row 2)
       { hpt: 22 }, // row 5 (KPI Row 3)
       { hpt: 15 }, // row 6 (spacer)
       { hpt: 28 }, // row 7 (Table Header)
       { hpt: 22 }, // row 8 (Data under_6)
       { hpt: 22 }, // row 9 (Data from_6_to_18)
       { hpt: 22 }, // row 10 (Data from_18_to_60_community)
       { hpt: 22 }, // row 11 (Data from_18_to_60_worker)
       { hpt: 22 }, // row 12 (Data from_18_to_60_officer)
       { hpt: 22 }, // row 13 (Data above_60)
       { hpt: 28 }  // row 14 (TOTAL row)
     ];
 
     // Merging Title Cells professionally
     ws['!merges'] = [
       { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Merge A1:G1 for title
       { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } }, // Merge B3:D3 for Kỳ báo cáo value
       { s: { r: 3, c: 1 }, e: { r: 3, c: 3 } }, // Merge B4:D4 for Đơn vị báo cáo value
       { s: { r: 4, c: 1 }, e: { r: 4, c: 3 } }  // Merge B5:D5 for Thời gian xuất value
     ];
 
     // Styles configurations
     const fontName = 'Segoe UI';
 
     const styleHeader = {
       font: { name: fontName, sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
       fill: { fgColor: { rgb: '1E293B' } }, // Slate 800 background
       alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
       border: {
         top: { style: 'thin', color: { rgb: '334155' } },
         bottom: { style: 'thin', color: { rgb: '334155' } },
         left: { style: 'thin', color: { rgb: '475569' } },
         right: { style: 'thin', color: { rgb: '475569' } }
       }
     };
 
     const styleTitleMain = {
       font: { name: fontName, sz: 15, bold: true, color: { rgb: '111827' } }, // Dark charcoal
       alignment: { horizontal: 'center', vertical: 'center' }
     };
 
     // KPI Panel elements
     const styleKpiLabelLeft = {
       font: { name: fontName, sz: 9.5, bold: true, color: { rgb: '334155' } },
       fill: { fgColor: { rgb: 'F8FAFC' } }, // Soft slate background
       alignment: { horizontal: 'left', vertical: 'center' },
       border: {
         top: { style: 'thin', color: { rgb: 'E2E8F0' } },
         bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
         left: { style: 'thin', color: { rgb: 'E2E8F0' } },
         right: { style: 'thin', color: { rgb: 'E2E8F0' } }
       }
     };
 
     const styleKpiValueLeft = {
       font: { name: fontName, sz: 9.5, color: { rgb: '0F172A' } },
       alignment: { horizontal: 'left', vertical: 'center' },
       border: {
         top: { style: 'thin', color: { rgb: 'E2E8F0' } },
         bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
         left: { style: 'thin', color: { rgb: 'E2E8F0' } },
         right: { style: 'thin', color: { rgb: 'E2E8F0' } }
       }
     };
 
     const styleKpiLabelRight = {
       font: { name: fontName, sz: 9.5, bold: true, color: { rgb: '334155' } },
       fill: { fgColor: { rgb: 'F8FAFC' } }, // Soft slate background
       alignment: { horizontal: 'left', vertical: 'center' },
       border: {
         top: { style: 'thin', color: { rgb: 'E2E8F0' } },
         bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
         left: { style: 'thin', color: { rgb: 'E2E8F0' } },
         right: { style: 'thin', color: { rgb: 'E2E8F0' } }
       }
     };
 
     const styleKpiValueRightNum = {
       font: { name: fontName, sz: 10, bold: true, color: { rgb: '4F46E5' } }, // Elegant Indigo
       alignment: { horizontal: 'right', vertical: 'center' },
       border: {
         top: { style: 'thin', color: { rgb: 'E2E8F0' } },
         bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
         left: { style: 'thin', color: { rgb: 'E2E8F0' } },
         right: { style: 'thin', color: { rgb: 'E2E8F0' } }
       }
     };
 
     const styleBorderThin = {
       top: { style: 'thin', color: { rgb: 'E2E8F0' } },
       bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
       left: { style: 'thin', color: { rgb: 'E2E8F0' } },
       right: { style: 'thin', color: { rgb: 'E2E8F0' } }
     };
 
     // Body Cell Zebra / Alignment generator
     const getStyleDataCell = (col: string, row: number) => {
       const isZebra = row % 2 !== 0; // alternating backgrounds
       const bgColor = isZebra ? 'F8FAFC' : 'FFFFFF';
       
       const baseStyle: any = {
         font: { name: fontName, sz: 10, color: { rgb: '1E293B' } },
         fill: { fgColor: { rgb: bgColor } },
         border: styleBorderThin,
         alignment: { vertical: 'center' }
       };
 
       if (col === 'A') {
         baseStyle.alignment.horizontal = 'center';
         baseStyle.font.color = { rgb: '64748B' }; // lighter STT
       } else if (col === 'B') {
         baseStyle.alignment.horizontal = 'center';
         baseStyle.font.color = { rgb: '64748B' };
       } else if (col === 'C') {
         baseStyle.alignment.horizontal = 'left';
         baseStyle.font.bold = true;
       } else if (col === 'D') {
         baseStyle.alignment.horizontal = 'left';
         if (excelBody[row - 1][3] !== '-') {
           baseStyle.font.italic = true;
           baseStyle.font.color = { rgb: '475569' };
         }
       } else if (col === 'E') {
         baseStyle.alignment.horizontal = 'left';
         baseStyle.font.color = { rgb: '64748B' };
       } else if (col === 'F') {
         baseStyle.alignment.horizontal = 'right';
         baseStyle.font.bold = true;
         baseStyle.font.sz = 10.5;
         baseStyle.font.color = { rgb: '0F172A' };
       } else if (col === 'G') {
         baseStyle.alignment.horizontal = 'right';
         baseStyle.font.bold = true;
         baseStyle.font.sz = 10.5;
         baseStyle.font.color = { rgb: '334155' };
       }
 
       return baseStyle;
     };
 
     const styleTotalRow = (col: string) => {
       const baseStyle: any = {
         font: { name: fontName, sz: 10.5, bold: true, color: { rgb: '1E293B' } },
         fill: { fgColor: { rgb: 'EEF2FF' } }, // Premium faint blue total banner
         alignment: { vertical: 'center' },
         border: {
           top: { style: 'thin', color: { rgb: '4F46E5' } },
           bottom: { style: 'double', color: { rgb: '4F46E5' } },
           left: { style: 'thin', color: { rgb: 'E2E8F0' } },
           right: { style: 'thin', color: { rgb: 'E2E8F0' } }
         }
       };
 
       if (col === 'A' || col === 'B') {
         baseStyle.alignment.horizontal = 'center';
         baseStyle.font.color = { rgb: '64748B' };
       } else if (col === 'C') {
         baseStyle.alignment.horizontal = 'left';
         baseStyle.font.color = { rgb: '312E81' }; 
       } else if (col === 'F') {
         baseStyle.alignment.horizontal = 'right';
         baseStyle.font.color = { rgb: '4F46E5' }; 
         baseStyle.font.sz = 11.5;
       } else if (col === 'G') {
         baseStyle.alignment.horizontal = 'right';
         baseStyle.font.color = { rgb: '4F46E5' };
         baseStyle.font.sz = 11.5;
       } else {
         baseStyle.alignment.horizontal = 'left';
       }
 
       return baseStyle;
     };
 
     // Explicit post-processing alignment and cell property reinforcement
     Object.keys(ws).forEach((cellRef) => {
       if (cellRef.startsWith('!')) return;
       const cell = ws[cellRef];
       if (!cell) return;
 
       const col = cellRef.replace(/[0-9]/g, '');
       const row = parseInt(cellRef.replace(/[^0-9]/g, ''), 10);
 
       // Default font & fallback style
       cell.s = {
         font: { name: fontName, sz: 10, color: { rgb: '334155' } }
       };
 
       // 1. Report Main Title (Row 1)
       if (row === 1) {
         cell.s = styleTitleMain;
       }
 
       // 2. KPI / Metrics block (Row 3, 4, 5)
       else if (row === 3 || row === 4 || row === 5) {
         if (col === 'A') {
           cell.s = styleKpiLabelLeft;
         } else if (col === 'B' || col === 'C' || col === 'D') {
           cell.s = styleKpiValueLeft;
         } else if (col === 'E') {
           cell.s = styleKpiLabelRight;
         } else if (col === 'F' || col === 'G') {
           cell.s = styleKpiValueRightNum;
           if (col === 'F') {
             if (row === 3 || row === 4) {
               if (typeof cell.v === 'number') {
                 cell.t = 'n';
                 cell.z = '#,##0';
               }
             } else if (row === 5) {
               if (typeof cell.v === 'number') {
                 cell.t = 'n';
                 cell.z = '0.0%';
               }
             }
           }
         }
       }
 
       // 3. Main Table Header row (Row 7)
       else if (row === 7) {
         cell.s = styleHeader;
       }
 
       // 4. Data rows (Row 8 to 13)
       else if (row >= 8 && row <= 13) {
         cell.s = getStyleDataCell(col, row);
         
         // Force numerical and formula formats on the main body
         if (col === 'F') {
           cell.t = 'n';
           cell.z = '#,##0';
         }
         if (col === 'G') {
           cell.t = 'n';
           cell.z = '0.0%';
         }
       }
 
       // 5. TOTAL aggregate footer (Row 14)
       else if (row === 14) {
         cell.s = styleTotalRow(col);
         if (col === 'F') {
           cell.t = 'n';
           cell.z = '#,##0';
         }
         if (col === 'G') {
           cell.t = 'n';
           cell.z = '0.0%';
         }
       }
     });

    XLSX.utils.book_append_sheet(wb, ws, tabName);
    
    // Write out the file with descriptive filename
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
          
          {/* Calendar Select Mode */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Khung thời gian báo cáo
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-150 rounded-lg">
              <button
                type="button"
                onClick={() => setExportMode('month')}
                className={`py-1.5 text-xs font-bold rounded-md transition-all select-none ${
                  exportMode === 'month'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Mẫu Tháng
              </button>
              <button
                type="button"
                onClick={() => setExportMode('range')}
                className={`py-1.5 text-xs font-bold rounded-md transition-all select-none ${
                  exportMode === 'range'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Khoảng Ngày
              </button>
            </div>
          </div>

          {exportMode === 'month' ? (
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
                className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                  Từ ngày
                </label>
                <input
                  id="report-start-date-picker"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                  Đến ngày
                </label>
                <input
                  id="report-end-date-picker"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
            </div>
          )}

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
              className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
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
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-500 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer select-none"
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
                {exportMode === 'month' ? (
                  `Bản xem trước dữ liệu báo cáo tháng ${reportMonth.split('-')[1]}/${reportMonth.split('-')[0]}`
                ) : (
                  `Bản xem trước báo cáo từ ngày ${new Date(startDate).toLocaleDateString('vi-VN')} đến ngày ${new Date(endDate).toLocaleDateString('vi-VN')}`
                )}
              </p>
              <p className="text-[10px] text-slate-400">
                Lọc dựa trên {reportData.filteredRecordsCount} bản ghi thực tế đã lưu
              </p>
            </div>
            <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium font-mono">
              Tổng số hồ sơ: {reportData.total.toLocaleString('vi-VN')}
            </span>
          </div>

          {/* Target and Achievement Rate Progress Bar */}
          <div className="mb-4.5 bg-gradient-to-r from-indigo-50/50 to-blue-50/30 border border-indigo-100/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
            <div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="text-xs font-bold font-sans">Chỉ tiêu cơ sở:</span>
                <span className="text-xs font-bold font-mono text-indigo-600">
                  {currentTarget > 0 ? `${currentTarget.toLocaleString('vi-VN')} hồ sơ` : 'Chưa thiết lập'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 font-sans">
                {reportFacility === 'all' ? 'Tổng chỉ tiêu luy kế tất cả địa bàn' : `Chỉ tiêu được giao của ${reportFacility}`}
              </p>
            </div>
            
            {currentTarget > 0 ? (
              <div className="flex-1 max-w-[240px] space-y-1">
                <div className="flex justify-between items-center text-[10px] font-semibold text-slate-700 font-sans">
                  <span>Tỷ lệ đạt chỉ tiêu (lũy kế):</span>
                  <span className={`font-mono font-bold ${achievementRate >= 100 ? 'text-emerald-600' : 'text-indigo-600'}`} title="Tỷ lệ đạt lũy kế dựa trên Bảng tổng hợp hiệu suất cơ sở">
                    {achievementRate.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200/60 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-500 ${achievementRate >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                    style={{ width: `${Math.min(100, achievementRate)}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-slate-400 font-medium italic flex items-center gap-1">
                <span>(Thiết lập chỉ tiêu ở trang Dashboard/Nhập số liệu để theo dõi tỷ lệ đạt)</span>
              </div>
            )}
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
                  <td className="py-3 px-2 text-right text-indigo-600 font-mono font-bold" id="total-achievement-rate-preview">
                    {reportData.total > 0 ? '100.0%' : '0.0%'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
