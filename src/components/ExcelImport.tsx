/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import XLSX from 'xlsx-js-style';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  ChevronRight, 
  PlusCircle, 
  FileCheck, 
  Loader2 
} from 'lucide-react';
import { CATEGORIES, AgeGroup, CheckupRecord } from '../types';

interface ExcelImportProps {
  onAddRecords: (records: Omit<CheckupRecord, 'id' | 'createdAt'>[]) => Promise<void>;
  onUpdateTarget?: (facilityName: string, targetValue: number) => Promise<void> | void;
  existingFacilities: string[];
  existingManagedAreas: string[];
}

interface ParsedRow {
  index: number;
  date: string;
  facility: string;
  managedArea: string;
  target?: number;
  under_6: number;
  from_6_to_18: number;
  from_18_to_60_community: number;
  from_18_to_60_worker: number;
  from_18_to_60_officer: number;
  above_60: number;
  notes: string;
  errors: string[];
}

export default function ExcelImport({
  onAddRecords,
  onUpdateTarget,
  existingFacilities,
  existingManagedAreas,
}: ExcelImportProps) {
  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download high-contrast, pre-styled template
  const handleDownloadTemplate = () => {
    const headers = [
      "Ngày khám (YYYY-MM-DD)",
      "Cơ sở tổ chức khám",
      "Địa bàn quản lý",
      "Chỉ tiêu khám cơ sở (Không bắt buộc)",
      "Mã dưới 6 tuổi (Số lượng)",
      "Từ 6 đến dưới 18 (Số lượng)",
      "18 - dưới 60: Cộng đồng (Số lượng)",
      "18 - dưới 60: Người lao động (Số lượng)",
      "18 - dưới 60: Cán bộ viên chức (Số lượng)",
      "Từ 60 tuổi trở lên (Số lượng)",
      "Ghi chú (Không bắt buộc)"
    ];

    const data = [
      [
        "2026-06-15",
        "Bệnh viện Đa khoa Quận 1",
        "Phường Bến Nghé",
        500,
        15,
        25,
        100,
        150,
        50,
        30,
        "Đợt khám sức khỏe hè 2026"
      ],
      [
        "2026-06-16",
        "Trung tâm Y tế Quận 3",
        "Phường Võ Thị Sáu",
        400,
        10,
        20,
        80,
        120,
        40,
        25,
        "Khám sức khỏe công vụ"
      ]
    ];

    const aoa = [
      ["BẢN MẪU NHẬP SỐ LIỆU HỒ SƠ KHÁM SỨC KHỎE ĐỊNH KỲ"],
      ["HƯỚNG DẪN: Điền thông tin vào các hàng bên dưới. Ngày nhập dạng YYYY-MM-DD. Các cột số lượng điền số nguyên dương."],
      [], // blank
      headers,
      ...data
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Apply basic styling & widths
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }
    ];

    ws['!cols'] = [
      { wch: 24 }, // Ngày
      { wch: 30 }, // Cơ sở
      { wch: 25 }, // Địa bàn
      { wch: 32 }, // Chỉ tiêu
      { wch: 22 }, // Dưới 6
      { wch: 22 }, // 6 - 18
      { wch: 28 }, // 18-60 CĐ
      { wch: 28 }, // 18-60 NLĐ
      { wch: 28 }, // 18-60 CB
      { wch: 24 }, // 60+
      { wch: 30 }  // Ghi chú
    ];

    // Style title
    const fontName = 'Segoe UI';
    const styleTitle = {
      font: { name: fontName, sz: 12, bold: true, color: { rgb: '1E3A8A' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
    const styleComment = {
      font: { name: fontName, sz: 9.5, italic: true, color: { rgb: '4B5563' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
    const styleHeader = {
      font: { name: fontName, sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1E293B' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '475569' } },
        bottom: { style: 'medium', color: { rgb: '0F172A' } },
        left: { style: 'thin', color: { rgb: '475569' } },
        right: { style: 'thin', color: { rgb: '475569' } }
      }
    };

    // Apply formatting to cells
    ws['A1'].s = styleTitle;
    ws['A2'].s = styleComment;

    // Loop through headers row (idx = 3)
    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 3, c });
      if (ws[cellRef]) ws[cellRef].s = styleHeader;
    }

    XLSX.utils.book_append_sheet(wb, ws, "Nhập số liệu");
    XLSX.writeFile(wb, "Mau_Import_So_Lieu_Kham_Suc_Khoe.xlsx");
  };

  // Helper to parse date gracefully
  const parseExcelDate = (val: any): string => {
    if (!val) return '';
    if (val instanceof Date) {
      return val.toLocaleDateString('sv-SE');
    }
    if (typeof val === 'number') {
      // Decode SheetJS serial date if formatted as number
      try {
        const d = XLSX.SSF.parse_date_code(val);
        const mm = String(d.m).padStart(2, '0');
        const dd = String(d.d).padStart(2, '0');
        return `${d.y}-${mm}-${dd}`;
      } catch (e) {
        // Fallback
      }
    }
    
    // String parsing
    const s = String(val).trim();
    // Test for common Vietnamese format DD/MM/YYYY
    const ddmmyyyy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (ddmmyyyy) {
      const d = ddmmyyyy[1].padStart(2, '0');
      const m = ddmmyyyy[2].padStart(2, '0');
      const y = ddmmyyyy[3];
      return `${y}-${m}-${d}`;
    }
    // Test for YYYY-MM-DD
    if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return s;
    }
    return s;
  };

  // Main file processing logic
  const processFile = (file: File) => {
    setErrorMsg(null);
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return;

        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];

        // Read sheet to raw arrays to detect layout flexibly
        const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        if (rawRows.length === 0) {
          throw new Error('Tệp tải lên không chứa dữ liệu hoặc trống.');
        }

        // Find the header row (typically row with "Ngày" and "Cơ sở")
        let headerRowIdx = -1;
        for (let idx = 0; idx < rawRows.length; idx++) {
          const row = rawRows[idx];
          if (row && row.length > 1) {
            const rowStr = row.map(cell => String(cell).toLowerCase()).join(' ');
            if (rowStr.includes('ngày') && (rowStr.includes('cơ sở') || rowStr.includes('địa bàn') || rowStr.includes('chi tiết'))) {
              headerRowIdx = idx;
              break;
            }
          }
        }

        // Fallback if header row not found
        if (headerRowIdx === -1) {
          // Assume row 3 is header (index 3) or search for first non-empty row with elements
          for (let i = 0; i < rawRows.length; i++) {
            if (rawRows[i] && rawRows[i].filter(Boolean).length >= 4) {
              headerRowIdx = i;
              break;
            }
          }
        }

        // If still not found, throw error
        if (headerRowIdx === -1) {
          throw new Error('Không thể tự động nhận dạng dòng chứa tiêu đề. Vui lòng tải và điền theo đúng Bảng mẫu.');
        }

        const headers = rawRows[headerRowIdx].map(h => String(h || '').trim());
        const dataRows = rawRows.slice(headerRowIdx + 1);

        // Map column offsets based on header keyword matching
        let colDate = -1;
        let colFacility = -1;
        let colArea = -1;
        let colTarget = -1;
        let colU6 = -1;
        let col6To18 = -1;
        let colComm = -1;
        let colWork = -1;
        let colOff = -1;
        let colAdv60 = -1;
        let colNotes = -1;

        headers.forEach((h, idx) => {
          const lh = h.toLowerCase();
          if (lh.includes('ngày') || lh.includes('date') || lh.includes('thời gian')) {
            if (colDate === -1) colDate = idx;
          } else if (lh.includes('cơ sở') || lh.includes('đơn vị') || lh.includes('bệnh viện') || lh.includes('trung tâm') || lh.includes('nơi khám') || lh.includes('facility')) {
            if (colFacility === -1) colFacility = idx;
          } else if (lh.includes('địa bàn') || lh.includes('khu vực') || lh.includes('phường') || lh.includes('xã') || lh.includes('managed') || lh.includes('area')) {
            if (colArea === -1) colArea = idx;
          } else if (lh.includes('chỉ tiêu') || lh.includes('giao') || lh.includes('target')) {
            if (colTarget === -1) colTarget = idx;
          } else if (lh.includes('dưới 6') || lh.includes('u6') || lh.includes('< 6') || lh.includes('<6')) {
            if (colU6 === -1) colU6 = idx;
          } else if (lh.includes('từ 6') || lh.includes('6-18') || lh.includes('6 đến') || lh.includes('u18')) {
            if (col6To18 === -1) col6To18 = idx;
          } else if (lh.includes('cộng đồng') || lh.includes('tự do') || lh.includes('community')) {
            if (colComm === -1) colComm = idx;
          } else if (lh.includes('lao động') || lh.includes('doanh nghiệp') || lh.includes('công ty') || lh.includes('nhà máy') || lh.includes('worker') || lh.includes('loại 2') || lh.includes('nld')) {
            if (colWork === -1) colWork = idx;
          } else if (lh.includes('cán bộ') || lh.includes('viên chức') || lh.includes('công chức') || lh.includes('officer') || lh.includes('loại 3') || lh.includes('cbvc')) {
            if (colOff === -1) colOff = idx;
          } else if (lh.includes('60 tuổi') || lh.includes('trở lên') || lh.includes('60 trở') || lh.includes('u60+') || lh.includes('above') || lh.includes('hưu trí') || lh.includes('già')) {
            if (colAdv60 === -1) colAdv60 = idx;
          } else if (lh.includes('ghi chú') || lh.includes('notes') || lh.includes('mô tả') || lh.includes('detail')) {
            if (colNotes === -1) colNotes = idx;
          }
        });

        // Safe Fallbacks in case columns aren't matched by keywords, map sequentially for template integrity
        if (colDate === -1) colDate = 0;
        if (colFacility === -1) colFacility = 1;
        if (colArea === -1) colArea = 2;
        if (colTarget === -1) colTarget = 3;
        if (colU6 === -1) colU6 = 4;
        if (col6To18 === -1) col6To18 = 5;
        if (colComm === -1) colComm = 6;
        if (colWork === -1) colWork = 7;
        if (colOff === -1) colOff = 8;
        if (colAdv60 === -1) colAdv60 = 9;
        if (colNotes === -1) colNotes = 10;

        const results: ParsedRow[] = [];
        const initialSelected = new Set<number>();

        dataRows.forEach((row, rIdx) => {
          // Skip completely empty rows
          if (!row || row.filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== '').length === 0) {
            return;
          }

          const rawDate = row[colDate];
          const rawFacility = row[colFacility];
          const rawArea = row[colArea];
          const rawTarget = row[colTarget];
          
          const dateStr = parseExcelDate(rawDate);
          const facilityStr = String(rawFacility || '').trim();
          const areaStr = String(rawArea || '').trim();
          const targetNum = rawTarget !== undefined && rawTarget !== '' ? parseInt(String(rawTarget), 10) : undefined;

          // Helper to count integers safely
          const parseCount = (cellVal: any) => {
            if (cellVal === undefined || cellVal === null || cellVal === '') return 0;
            const parsed = parseInt(String(cellVal), 10);
            return isNaN(parsed) || parsed < 0 ? 0 : parsed;
          };

          const u6_cnt = parseCount(row[colU6]);
          const c6to18_cnt = parseCount(row[col6To18]);
          const comm_cnt = parseCount(row[colComm]);
          const work_cnt = parseCount(row[colWork]);
          const off_cnt = parseCount(row[colOff]);
          const above60_cnt = parseCount(row[colAdv60]);
          const rowNotes = String(row[colNotes] || '').trim();

          const errors: string[] = [];
          if (!dateStr) {
            errors.push('Hàng thiếu thông tin Ngày khám.');
          } else if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            errors.push(`Định dạng ngày chưa đúng (${dateStr}). Định dạng yêu cầu là YYYY-MM-DD.`);
          }
          
          if (!facilityStr) {
            errors.push('Hàng thiếu tên Cơ sở tổ chức khám.');
          }

          if (!areaStr) {
            errors.push('Hàng thiếu thông tin Địa bàn quản lý.');
          }

          const totalQuantity = u6_cnt + c6to18_cnt + comm_cnt + work_cnt + off_cnt + above60_cnt;
          if (totalQuantity <= 0 && (!targetNum || targetNum <= 0)) {
            errors.push('Hàng không có dữ liệu số lượng hồ sơ nhóm tuổi nào hoặc chỉ tiêu.');
          }

          const parsedRow: ParsedRow = {
            index: rIdx,
            date: dateStr,
            facility: facilityStr,
            managedArea: areaStr,
            target: isNaN(targetNum as any) ? undefined : targetNum,
            under_6: u6_cnt,
            from_6_to_18: c6to18_cnt,
            from_18_to_60_community: comm_cnt,
            from_18_to_60_worker: work_cnt,
            from_18_to_60_officer: off_cnt,
            above_60: above60_cnt,
            notes: rowNotes,
            errors
          };

          results.push(parsedRow);
          
          // Row is valid, select it by default for import
          if (errors.length === 0) {
            initialSelected.add(rIdx);
          }
        });

        if (results.length === 0) {
          throw new Error('Không có dòng dữ liệu hợp lệ nào được tìm thấy trong tập tin Excel.');
        }

        setParsedRows(results);
        setSelectedRowIndexes(initialSelected);

      } catch (err: any) {
        console.error("Lỗi đọc file Excel:", err);
        setErrorMsg(err?.message || 'Có lỗi xảy ra trong quá trình giải mã tệp excel. Phải đảm bảo tệp tin đúng chuẩn định dạng.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Toggle row selection
  const handleToggleRow = (index: number) => {
    const next = new Set(selectedRowIndexes);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedRowIndexes(next);
  };

  // Toggle all valid rows
  const handleToggleSelectAll = () => {
    const validRows = parsedRows.filter(r => r.errors.length === 0);
    if (selectedRowIndexes.size === validRows.length) {
      setSelectedRowIndexes(new Set()); // deselect all
    } else {
      setSelectedRowIndexes(new Set(validRows.map(r => r.index))); // select all
    }
  };

  // Final Action to Save Items
  const handleConfirmImport = async () => {
    if (selectedRowIndexes.size === 0) return;
    setImporting(true);

    try {
      const recordsToImport: Omit<CheckupRecord, 'id' | 'createdAt'>[] = [];
      const rowsToImport = parsedRows.filter(r => selectedRowIndexes.has(r.index));

      // Process and split rows into separate CheckupRecord entries
      for (const row of rowsToImport) {
        
        // Update facility Targets if present
        if (row.target !== undefined && row.target > 0 && onUpdateTarget) {
          await onUpdateTarget(row.facility, row.target);
        }

        const buildRecord = (cat: AgeGroup, qty: number) => {
          if (qty > 0) {
            recordsToImport.push({
              date: row.date,
              facility: row.facility,
              managedArea: row.managedArea,
              category: cat,
              quantity: qty,
              notes: row.notes || undefined,
            });
          }
        };

        buildRecord('under_6', row.under_6);
        buildRecord('from_6_to_18', row.from_6_to_18);
        buildRecord('from_18_to_60_community', row.from_18_to_60_community);
        buildRecord('from_18_to_60_worker', row.from_18_to_60_worker);
        buildRecord('from_18_to_60_officer', row.from_18_to_60_officer);
        buildRecord('above_60', row.above_60);
      }

      if (recordsToImport.length > 0) {
        await onAddRecords(recordsToImport);
      }

      setImportSuccess(true);
      setParsedRows([]);
      setSelectedRowIndexes(new Set());
    } catch (e: any) {
      console.error(e);
      setErrorMsg('Quá trình nhập hàng loạt gặp sự cố. Vui lòng kiểm tra lại quyền liên kết.');
    } finally {
      setImporting(false);
    }
  };

  const handleClearPreview = () => {
    setParsedRows([]);
    setSelectedRowIndexes(new Set());
    setErrorMsg(null);
  };

  // Preview totals computation
  const summaryTotals = useMemo(() => {
    let recordsCount = 0;
    let totalQuantity = 0;
    const selectedRows = parsedRows.filter(r => selectedRowIndexes.has(r.index));

    selectedRows.forEach(row => {
      const counts = [
        row.under_6,
        row.from_6_to_18,
        row.from_18_to_60_community,
        row.from_18_to_60_worker,
        row.from_18_to_60_officer,
        row.above_60
      ];
      counts.forEach(q => {
        if (q > 0) {
          recordsCount++;
          totalQuantity += q;
        }
      });
    });

    return { recordsCount, totalQuantity };
  }, [parsedRows, selectedRowIndexes]);

  return (
    <div id="excel-import-wrapper" className="space-y-6">
      
      {/* Alert Banner / Instruction */}
      <div className="bg-slate-50 rounded-xl p-4.5 border border-slate-100 flex items-start gap-3">
        <FileSpreadsheet className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 leading-relaxed space-y-1">
          <p className="font-semibold text-slate-800">Cơ chế nhập dữ liệu thông minh từ Excel:</p>
          <p>• Điền hồ sơ sức khỏe cơ sở theo các cột thông tin: ngày khám, đơn vị, khu vực hành chính quản lý, và chỉ tiêu giao.</p>
          <p>• Điền số lượng cụ thể vào các cột độ tuổi: <strong className="text-slate-700">Dưới 6 tuổi, 6 đến 18, và từ 18 đến dưới 60</strong> (gồm Cộng đồng, Doanh nghiệp, CBCCVC), và nhóm <strong className="text-slate-700">trên 60 tuổi</strong>.</p>
          <p>• Hệ thống sẽ tự động đối chiếu, tính toán và phân tách thành các bản ghi cơ sở dữ liệu riêng biệt để tăng hiệu suất xử lý.</p>
        </div>
      </div>

      {/* Action panel: Drag Zone or Template Downloader */}
      {parsedRows.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Box 1: Drag upload box (large span) */}
          <div className="md:col-span-2">
            <div 
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`w-full min-h-[190px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer select-none ${
                dragActive 
                  ? 'border-indigo-500 bg-indigo-50/20' 
                  : 'border-slate-200 hover:border-indigo-400 bg-white hover:bg-slate-50/30'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="p-3 bg-indigo-50 rounded-full text-indigo-600 mb-3.5">
                <Upload className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">
                Kéo thả file Excel của bạn vào đây hoặc click để chọn tệp
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                Hỗ trợ tệp bảng tính Excel dạng .xlsx, .xls hoặc .csv đúng định dạng cột tiêu đề chính
              </p>
            </div>
          </div>

          {/* Box 2: Template helper downloader */}
          <div className="md:col-span-1 bg-white border border-slate-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
            <div>
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">Yêu cầu khuôn mẫu</h4>
              <p className="text-[10.5px] text-slate-500 mt-1.5 leading-relaxed">
                Để việc nhập số liệu đạt độ chính xác cao nhất và không bị lỗi, vui lòng tải bản mẫu tiêu chuẩn do hệ thống thiết kế sẵn.
              </p>
              <div className="mt-3.5 space-y-1.5 pl-1.5 text-[10px] text-slate-500">
                <p>✓ Cấu trúc cột phân loại độ tuổi đồng bộ</p>
                <p>✓ Định dạng Ngày đạt chuẩn tự động</p>
                <p>✓ Chứa hàng mô tả ví dụ minh họa</p>
              </div>
            </div>

            <button
              id="btn-download-excel-template"
              type="button"
              onClick={handleDownloadTemplate}
              className="w-full mt-5 py-2 px-3 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              Tải bảng mẫu nhập số liệu
            </button>
          </div>

        </div>
      ) : (
        /* Preview list rows */
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
          
          {/* Header Action Row */}
          <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 px-5">
            <div>
              <h3 className="font-bold text-sm text-slate-900 block">Danh sách xử lý tệp nhập</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Kiểm duyệt tính hợp lệ và chọn hàng để thêm vào hệ thống ({selectedRowIndexes.size}/{parsedRows.length} hàng đã chọn)
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearPreview}
                className="py-1.5 px-3 border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-100 rounded-lg text-xs font-medium transition-all"
              >
                Hủy bỏ
              </button>
              <button
                id="btn-confirm-excel-import"
                type="button"
                onClick={handleConfirmImport}
                disabled={selectedRowIndexes.size === 0 || importing}
                className="py-1.5 px-4 bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang xử lý thực thi...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-3.5 h-3.5" />
                    Chấp thuận & Lưu {summaryTotals.recordsCount} Bản Ghi
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Validation Warning Summary if any invalid rows exist */}
          {parsedRows.some(r => r.errors.length > 0) && (
            <div className="bg-amber-50 border-b border-amber-100 p-3 px-5 flex items-start gap-2.5 text-xs text-amber-800 leading-normal">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Nhận diện được hàng có chứa cảnh báo lỗi!</p>
                <p className="text-[11px] text-amber-700">Các hàng bị lỗi (bôi đỏ bên dưới) sẽ không thể chọn hoặc lưu được. Vui lòng định dạng lại tệp hoặc sửa thông tin.</p>
              </div>
            </div>
          )}

          {/* Table display */}
          <div className="overflow-x-auto max-h-[350px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/50 text-[10px] text-slate-500 font-bold uppercase border-b border-slate-100 sticky top-0 z-10">
                  <th className="py-2.5 px-4 text-center w-12">
                    <input 
                      type="checkbox"
                      checked={parsedRows.filter(r => r.errors.length === 0).length > 0 && selectedRowIndexes.size === parsedRows.filter(r => r.errors.length === 0).length}
                      onChange={handleToggleSelectAll}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3">Ngày khám</th>
                  <th className="py-2.5 px-3">Cơ sở khám bệnh</th>
                  <th className="py-2.5 px-3 font-sans">Địa bàn</th>
                  <th className="py-2.5 px-3 text-right">Chỉ tiêu</th>
                  <th className="py-2.5 px-3 text-right bg-blue-50/30 text-blue-800">Dưới 6</th>
                  <th className="py-2.5 px-3 text-right bg-cyan-50/30 text-cyan-800">6 - 18</th>
                  <th className="py-2.5 px-3 text-right bg-emerald-50/30 text-emerald-800">Cộng đồng</th>
                  <th className="py-2.5 px-3 text-right bg-amber-50/30 text-amber-800">NLĐ</th>
                  <th className="py-2.5 px-3 text-right bg-violet-50/30 text-violet-800">CBVC</th>
                  <th className="py-2.5 px-3 text-right bg-pink-50/30 text-pink-800">Trên 60</th>
                  <th className="py-2.5 px-4">Ghi chú</th>
                  <th className="py-2.5 px-4">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.map((row) => {
                  const hasErrors = row.errors.length > 0;
                  const isSelected = selectedRowIndexes.has(row.index);
                  
                  return (
                    <tr 
                      key={row.index}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        hasErrors 
                          ? 'bg-red-50/30 text-red-900' 
                          : isSelected 
                            ? 'bg-blue-50/10' 
                            : 'text-slate-700'
                      }`}
                    >
                      <td className="py-2 px-4 text-center">
                        <input 
                          type="checkbox"
                          disabled={hasErrors}
                          checked={isSelected && !hasErrors}
                          onChange={() => handleToggleRow(row.index)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono font-medium">{row.date || <span className="text-red-500 italic">Thiếu</span>}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{row.facility || <span className="text-red-500 italic">Thiếu</span>}</td>
                      <td className="py-2 px-3">{row.managedArea || <span className="text-red-500 italic">Thiếu</span>}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-indigo-600">{row.target !== undefined ? row.target.toLocaleString('vi-VN') : '-'}</td>
                      <td className="py-2 px-3 text-right font-mono bg-blue-50/10 text-blue-700 font-medium">{row.under_6}</td>
                      <td className="py-2 px-3 text-right font-mono bg-cyan-50/10 text-cyan-700 font-medium">{row.from_6_to_18}</td>
                      <td className="py-2 px-3 text-right font-mono bg-emerald-50/10 text-emerald-700 font-medium">{row.from_18_to_60_community}</td>
                      <td className="py-2 px-3 text-right font-mono bg-amber-50/10 text-amber-700 font-medium">{row.from_18_to_60_worker}</td>
                      <td className="py-2 px-3 text-right font-mono bg-violet-50/10 text-violet-700 font-medium">{row.from_18_to_60_officer}</td>
                      <td className="py-2 px-3 text-right font-mono bg-pink-50/10 text-pink-700 font-medium">{row.above_60}</td>
                      <td className="py-2 px-4 max-w-[120px] truncate" title={row.notes}>{row.notes || <span className="text-slate-300">-</span>}</td>
                      <td className="py-2 px-4 font-semibold">
                        {hasErrors ? (
                          <div className="flex items-center gap-1 text-red-600" title={row.errors.join(' ')}>
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[10px] truncate max-w-[90px]">{row.errors[0]}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[10px]">Hợp lệ</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Footer Total Summary Info */}
          <div className="p-3.5 px-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium font-sans">
            <div>
              <span>Tổng số chỉ mục hợp lệ chọn lưu: </span>
              <strong className="text-slate-800 font-mono">{selectedRowIndexes.size}</strong> hàng
            </div>
            <div>
              <span>Tách thành: </span>
              <strong className="text-indigo-600 font-mono font-bold text-sm bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">{summaryTotals.recordsCount}</strong> bản ghi đơn lẻ
            </div>
            <div>
              <span>Tổng lượt khám: </span>
              <strong className="text-slate-800 font-mono font-bold">{summaryTotals.totalQuantity.toLocaleString('vi-VN')}</strong> hồ sơ
            </div>
          </div>

        </div>
      )}

      {/* Success banner alert */}
      {importSuccess && (
        <div id="excel-success-info-banner" className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-start gap-3.5 animate-fade-in shadow-sm">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-emerald-900 text-sm">Nhập dữ liệu thành công!</h4>
            <p className="text-xs text-emerald-700 leading-normal">
              Toàn bộ số lượng hồ sơ phân loại trong tệp đã được thêm hoàn chỉnh vào hệ thống. Các chỉ tiêu cơ sở được cập nhật đồng nhất.
            </p>
            <p className="text-[10.5px] text-emerald-600 mt-1 font-medium">
              * Nếu biểu mẫu đồng bộ tự động được bật, dữ liệu sẽ được tự động cập nhật lên liên kết Google Sheets.
            </p>
          </div>
        </div>
      )}

      {/* Primary Error Box if any error loaded */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4.5 flex items-start gap-3 text-rose-800 text-xs leading-normal font-medium">
          <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Lỗi trong quá trình thao tác:</p>
            <p className="text-rose-700 mt-1">{errorMsg}</p>
          </div>
        </div>
      )}

    </div>
  );
}
