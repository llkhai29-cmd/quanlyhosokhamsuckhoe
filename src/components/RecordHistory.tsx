/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckupRecord, CATEGORIES, AgeGroup } from '../types';
import { Search, Trash2, CheckCircle2, AlertCircle, FileSpreadsheet, Calendar, MapPin, Tag, AlertTriangle, X } from 'lucide-react';

interface RecordHistoryProps {
  records: CheckupRecord[];
  onDeleteRecord: (id: string) => void;
  onSyncNow?: () => void;
  isSyncing: boolean;
  sheetsUrl: string | null;
}

export default function RecordHistory({ 
  records, 
  onDeleteRecord, 
  onSyncNow, 
  isSyncing,
  sheetsUrl 
}: RecordHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AgeGroup>('all');
  const [recordToDelete, setRecordToDelete] = useState<CheckupRecord | null>(null);

  const handleDelete = (record: CheckupRecord) => {
    setRecordToDelete(record);
  };

  const handleConfirmDelete = () => {
    if (recordToDelete) {
      onDeleteRecord(recordToDelete.id);
      setRecordToDelete(null);
    }
  };

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchesSearch = r.facility.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (r.notes && r.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [records, searchTerm, categoryFilter]);

  return (
    <>
      <div id="history-card" className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-semibold text-lg text-slate-900">Sổ nhật ký nhập số liệu</h2>
          <p className="text-xs text-slate-500">Xem và hiệu chỉnh tất cả các bản ghi số lượng hồ sơ</p>
        </div>

        {/* Sync Controls integration */}
        <div className="flex items-center gap-2">
          {sheetsUrl && (
            <a
              id="btn-open-google-sheet"
              href={sheetsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg font-medium transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Mở Google Sheets
            </a>
          )}
          {onSyncNow && (
            <button
              id="btn-trigger-sync"
              disabled={isSyncing || records.length === 0}
              onClick={onSyncNow}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs text-white rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:scale-95 transition-all ${
                records.length === 0 
                  ? 'bg-slate-200 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              {isSyncing ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang đồng bộ...
                </>
              ) : (
                'Đồng bộ lên Sheets'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Table Filters Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            id="history-search-input"
            type="text"
            placeholder="Tìm kiếm theo cơ sở / ghi chú..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Category Filter */}
        <select
          id="history-category-filter-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'all' | AgeGroup)}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 transition-all cursor-pointer"
        >
          <option value="all">Tất cả nhóm tuổi đối tượng (Mặc định)</option>
          {Object.entries(CATEGORIES).map(([key, value]) => (
            <option key={key} value={key}>{value.name} ({value.parentGroupName})</option>
          ))}
        </select>
      </div>

      {/* Table / List View */}
      {filtered.length === 0 ? (
        <div id="history-empty-view" className="text-center py-12 border border-dashed border-slate-150 rounded-2xl">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Không tìm thấy bản ghi nhập số liệu nào phù hợp.</p>
          {records.length > 0 && (
            <button
              id="btn-clear-filters"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
              }}
              className="text-xs text-blue-600 hover:underline mt-1 font-medium"
            >
              Xóa tất cả bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-2">Ngày khám</th>
                <th className="py-3 px-2">Cơ sở khám / Địa bàn</th>
                <th className="py-3 px-2">Nhóm đối tượng</th>
                <th className="py-3 px-2 text-right">Số lượng hồ sơ</th>
                <th className="py-3 px-2">Ghi chú</th>
                <th className="py-3 px-2 text-center">Trạng thái Google Sheets</th>
                <th className="py-3 px-2 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((record) => {
                const cat = CATEGORIES[record.category];
                return (
                  <tr key={record.id} className="text-xs text-slate-700 hover:bg-slate-50/40 transition-colors">
                    {/* Date */}
                    <td className="py-3 px-2 font-mono whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-800">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(record.date).toLocaleDateString('vi-VN')}
                      </div>
                    </td>

                    {/* Facility */}
                    <td className="py-3 px-2 font-medium text-slate-900 max-w-[200px] truncate">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{record.facility}</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-2 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{cat.name}</span>
                        <span className="text-[10px] text-slate-400">{cat.parentGroupName}</span>
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="py-3 px-2 text-right font-bold text-slate-900 font-mono text-sm whitespace-nowrap">
                      {record.quantity.toLocaleString('vi-VN')}
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-2 max-w-[150px] truncate text-slate-500">
                      {record.notes || <em className="text-slate-300">Không có</em>}
                    </td>

                    {/* Sync Status */}
                    <td className="py-3 px-2 text-center whitespace-nowrap">
                      {record.syncedAt ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Đã đồng bộ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                          <AlertCircle className="w-3 h-3 text-amber-500 animate-pulse" />
                          Chờ đồng bộ
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-2 text-right whitespace-nowrap">
                      <button
                        id={`btn-delete-${record.id}`}
                        onClick={() => handleDelete(record)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 transition-all"
                        title="Xóa bản ghi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Footer statistics indicator */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <div>
          Hiển thị <strong>{filtered.length}</strong> / <strong>{records.length}</strong> bản ghi nhập số liệu
        </div>
        <div>
          Tổng số hồ sơ được sàng lọc: <strong className="font-mono text-slate-700">{filtered.reduce((sum, r) => sum + r.quantity, 0).toLocaleString('vi-VN')}</strong>
        </div>
      </div>
    </div>

    <AnimatePresence>
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop mapping */}
          <motion.div
            id="confirm-delete-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRecordToDelete(null)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            id="confirm-delete-dialog"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
            className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-100 overflow-hidden z-10"
            role="dialog"
            aria-modal="true"
          >
            <button
              id="btn-close-delete-dialog"
              onClick={() => setRecordToDelete(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-50 rounded-full text-red-600 shrink-0">
                <AlertTriangle className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-bold text-slate-950 text-base">Xác nhận xóa bản ghi số liệu</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Bạn có chắc chắn muốn xóa bản ghi số liệu sàng lọc này? Hành động này sẽ loại bỏ dữ liệu thống kê liên quan.
                </p>
              </div>
            </div>

            {/* Data Detail Card */}
            <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Cơ sở khám:</span>
                <span className="font-semibold text-slate-800">{recordToDelete.facility}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ngày khám:</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {new Date(recordToDelete.date).toLocaleDateString('vi-VN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Nhóm tuổi:</span>
                <span className="font-semibold text-indigo-700">
                  {CATEGORIES[recordToDelete.category].name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Số lượng:</span>
                <span className="font-bold text-slate-900 font-mono text-sm">
                  {recordToDelete.quantity.toLocaleString('vi-VN')} hồ sơ
                </span>
              </div>
              {recordToDelete.notes && (
                <div className="pt-2 border-t border-slate-100/50 flex flex-col gap-1">
                  <span className="text-slate-400">Ghi chú:</span>
                  <span className="text-slate-600 bg-white/70 p-1.5 rounded-md border border-slate-100/30 line-clamp-2 italic">
                    {recordToDelete.notes}
                  </span>
                </div>
              )}
            </div>

            <p className="mt-4 text-[10.5px] font-medium text-red-600/90 leading-normal flex items-center gap-1.5 bg-red-50/50 p-2.5 rounded-lg border border-red-100/45">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Lưu ý: Hành động này không thể hoàn tác nếu không nhập lại thủ công.
            </p>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                id="btn-cancel-delete"
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer active:scale-97"
              >
                Hủy bỏ
              </button>
              <button
                id="btn-confirm-delete"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-97"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xác nhận xóa
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </>
  );
}
