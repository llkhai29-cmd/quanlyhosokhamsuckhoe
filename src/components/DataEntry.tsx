/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CATEGORIES, AgeGroup, CheckupRecord } from '../types';
import { FilePlus, Calendar, Landmark, Users, PlusCircle, PenLine } from 'lucide-react';

interface DataEntryProps {
  onAddRecord: (record: Omit<CheckupRecord, 'id' | 'createdAt'>) => void;
  existingFacilities: string[];
}

export default function DataEntry({ onAddRecord, existingFacilities }: DataEntryProps) {
  const [date, setDate] = useState<string>(
    new Date().toLocaleDateString('sv-SE') // Returns YYYY-MM-DD
  );
  const [facility, setFacility] = useState<string>('');
  const [category, setCategory] = useState<AgeGroup>('under_6');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!facility.trim()) return;
    if (quantity === '' || quantity <= 0) return;

    onAddRecord({
      date,
      facility: facility.trim(),
      category,
      quantity,
      notes: notes.trim() || undefined,
    });

    setQuantity('');
    setNotes('');
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  return (
    <div id="data-entry-card" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 relative">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
          <FilePlus className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-lg text-slate-900">Nhập số liệu mới</h2>
          <p className="text-xs text-slate-500">Thêm số lượng hồ sơ bảo cáo theo nhóm độ tuổi</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Date Row */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Ngày thực hiện khám sức khỏe
          </label>
          <input
            id="input-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans"
          />
        </div>

        {/* Facility */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-slate-400" />
            Cơ sở tổ chức khám / Địa bàn quản lý
          </label>
          <div className="relative">
            <input
              id="input-facility"
              type="text"
              required
              placeholder="VD: Trung tâm Y tế Quận 1, Trạm Y tế Phường Bến Nghé..."
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
              list="facilities-list"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
            <datalist id="facilities-list">
              {existingFacilities.map((f, i) => (
                <option key={i} value={f} />
              ))}
            </datalist>
          </div>
          {existingFacilities.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="text-[10px] text-slate-400 self-center">Gợi ý gần đây:</span>
              {existingFacilities.slice(0, 3).map((f, idx) => (
                <button
                  id={`suggested-facility-${idx}`}
                  key={idx}
                  type="button"
                  onClick={() => setFacility(f)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100 transition-all"
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Categories Selection with detailed subdivisions */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            Nhóm đối tượng độ tuổi
          </label>
          <div className="grid grid-cols-1 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
            {Object.values(CATEGORIES).map((cat) => (
              <label
                key={cat.id}
                className={`relative flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  category === cat.id
                    ? 'border-blue-500 bg-blue-50/30'
                    : 'border-slate-100 hover:border-slate-200 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="age-category"
                  checked={category === cat.id}
                  onChange={() => setCategory(cat.id)}
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-800">{cat.name}</span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                    >
                      {cat.parentGroupName}
                    </span>
                  </div>
                  {cat.subName && (
                    <p className="text-[10px] text-slate-500 mt-0.5">Phân loại: {cat.subName}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
            <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
            Số lượng hồ sơ đã khám
          </label>
          <input
            id="input-quantity"
            type="number"
            required
            min="1"
            placeholder="Nhập số..."
            value={quantity}
            onChange={(e) => {
              const val = e.target.value;
              setQuantity(val === '' ? '' : parseInt(val, 10));
            }}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
            <PenLine className="w-3.5 h-3.5 text-slate-400" />
            Ghi chú phụ / Ghi chú đợt khám (Không bắt buộc)
          </label>
          <textarea
            id="input-notes"
            rows={2}
            placeholder="VD: Khám sức khỏe định kỳ năm 2026..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 resize-none font-sans"
          />
        </div>

        {/* Submit */}
        <button
          id="btn-submit-record"
          type="submit"
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium text-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
        >
          <PlusCircle className="w-4 h-4" />
          Lưu bản ghi nhập số liệu
        </button>
      </form>

      {showSuccessToast && (
        <div id="success-toast" className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white text-xs px-4 py-2 rounded-full shadow-md flex items-center gap-2 transition-opacity animate-fade-in">
          <span>✓</span> Thêm bản ghi thành công!
        </div>
      )}
    </div>
  );
}
