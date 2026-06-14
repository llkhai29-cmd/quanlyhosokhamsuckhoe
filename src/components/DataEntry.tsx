/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORIES, AgeGroup, CheckupRecord } from '../types';
import { FilePlus, Calendar, Landmark, Users, PlusCircle, PenLine, Search, Sparkles, Target } from 'lucide-react';

interface DataEntryProps {
  onAddRecord: (record: Omit<CheckupRecord, 'id' | 'createdAt'>) => void;
  existingFacilities: string[];
  existingManagedAreas?: string[];
  facilityTargets?: Record<string, number>;
  onUpdateTarget?: (facilityName: string, targetValue: number) => void;
}

export default function DataEntry({ 
  onAddRecord, 
  existingFacilities,
  existingManagedAreas = [],
  facilityTargets = {},
  onUpdateTarget
}: DataEntryProps) {
  const [date, setDate] = useState<string>(
    new Date().toLocaleDateString('sv-SE') // Returns YYYY-MM-DD
  );
  const [facility, setFacility] = useState<string>('');
  const [managedArea, setManagedArea] = useState<string>('');
  const [category, setCategory] = useState<AgeGroup>('under_6');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Facility Target State & Effect to load from prop
  const targetForCurrentFacility = useMemo(() => {
    const trimmed = facility.trim();
    if (!trimmed) return 0;
    return facilityTargets[trimmed] || 0;
  }, [facility, facilityTargets]);

  const [localTargetValue, setLocalTargetValue] = useState<string>('');

  useEffect(() => {
    setLocalTargetValue(targetForCurrentFacility > 0 ? String(targetForCurrentFacility) : '');
  }, [targetForCurrentFacility]);

  const handleLocalTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalTargetValue(val);
    const parsed = parseInt(val, 10);
    const finalValue = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    if (onUpdateTarget && facility.trim()) {
      onUpdateTarget(facility.trim(), finalValue);
    }
  };

  // Custom autocomplete state: Facility
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Filter existing facilities for suggestion matching based on input string
  const filteredSuggestions = useMemo(() => {
    const trimmedInput = facility.trim().toLowerCase();
    if (!trimmedInput) {
      // If blank, suggest top 5 most recently used
      return existingFacilities.slice(0, 5);
    }
    return existingFacilities
      .filter((f) => f.toLowerCase().includes(trimmedInput))
      .slice(0, 6);
  }, [facility, existingFacilities]);

  // Custom autocomplete state: Managed Area
  const [showAreaSuggestions, setShowAreaSuggestions] = useState(false);
  const [activeAreaIndex, setActiveAreaIndex] = useState(-1);
  const areaAutocompleteRef = useRef<HTMLDivElement>(null);

  // Filter existing managed areas for suggestion matching based on input string
  const filteredAreaSuggestions = useMemo(() => {
    const trimmedInput = managedArea.trim().toLowerCase();
    if (!trimmedInput) {
      return existingManagedAreas.slice(0, 5);
    }
    return existingManagedAreas
      .filter((a) => a.toLowerCase().includes(trimmedInput))
      .slice(0, 6);
  }, [managedArea, existingManagedAreas]);

  // Handle clicking outside the widgets to close the suggest lists
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (areaAutocompleteRef.current && !areaAutocompleteRef.current.contains(event.target as Node)) {
        setShowAreaSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
        setShowSuggestions(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      setActiveIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < filteredSuggestions.length) {
        setFacility(filteredSuggestions[activeIndex]);
        setShowSuggestions(false);
        setActiveIndex(-1);
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  const handleSelectSuggestion = (value: string) => {
    setFacility(value);
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  const handleAreaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showAreaSuggestions) {
      if (e.key === 'ArrowDown' && filteredAreaSuggestions.length > 0) {
        setShowAreaSuggestions(true);
        setActiveAreaIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      setActiveAreaIndex((prev) => (prev < filteredAreaSuggestions.length - 1 ? prev + 1 : prev));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setActiveAreaIndex((prev) => (prev > 0 ? prev - 1 : -1));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (activeAreaIndex >= 0 && activeAreaIndex < filteredAreaSuggestions.length) {
        setManagedArea(filteredAreaSuggestions[activeAreaIndex]);
        setShowAreaSuggestions(false);
        setActiveAreaIndex(-1);
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      setShowAreaSuggestions(false);
      setActiveAreaIndex(-1);
    }
  };

  const handleSelectAreaSuggestion = (value: string) => {
    setManagedArea(value);
    setShowAreaSuggestions(false);
    setActiveAreaIndex(-1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!facility.trim()) return;
    if (!managedArea.trim()) return;
    if (quantity === '' || quantity <= 0) return;

    onAddRecord({
      date,
      facility: facility.trim(),
      managedArea: managedArea.trim(),
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
        <div ref={autocompleteRef}>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-slate-400" />
            Cơ sở tổ chức khám
          </label>
          <div className="relative">
            <input
              id="input-facility"
              type="text"
              required
              placeholder="VD: Trung tâm Y tế Quận 1, Bệnh viện Quận 3..."
              value={facility}
              onChange={(e) => {
                setFacility(e.target.value);
                setShowSuggestions(true);
                setActiveIndex(-1);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 pr-10"
            />
            {facility && (
              <button
                type="button"
                onClick={() => {
                  setFacility('');
                  setShowSuggestions(true);
                  setActiveIndex(-1);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                id="btn-clear-facility"
              >
                <span className="text-xs">✕</span>
              </button>
            )}
            
            <AnimatePresence>
              {showSuggestions && (filteredSuggestions.length > 0 || facility.trim() !== '') && (
                <motion.div
                  id="autocomplete-dropdown"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-150 rounded-xl shadow-lg z-30 max-h-56 overflow-y-auto divide-y divide-slate-50"
                >
                  {filteredSuggestions.length > 0 ? (
                    <div className="p-1">
                      {filteredSuggestions.map((f, idx) => {
                        const isHighlighted = idx === activeIndex;
                        return (
                          <button
                            key={f}
                            id={`autocomplete-item-${idx}`}
                            type="button"
                            onClick={() => handleSelectSuggestion(f)}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 border-0 cursor-pointer ${
                              isHighlighted
                                ? 'bg-indigo-50 text-indigo-700 font-medium'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Landmark className={`w-3.5 h-3.5 shrink-0 ${isHighlighted ? 'text-indigo-500' : 'text-slate-400'}`} />
                              <span className="truncate">{f}</span>
                            </div>
                            {isHighlighted && (
                              <span className="text-[9px] text-indigo-500 font-medium font-sans">Chọn</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : facility.trim() !== '' ? (
                    <div className="p-3.5 text-center">
                      <p className="text-[11px] font-semibold text-slate-600 flex items-center justify-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Tên cơ sở y tế mới</span>
                      </p>
                      <p className="text-[9.5px] text-slate-400 mt-1 leading-normal">
                        Hệ thống sẽ lưu cơ sở mới này vào lịch sử thông tin chung sau khi bạn lưu bản ghi.
                      </p>
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {existingFacilities.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="text-[10px] text-slate-400 self-center">Gợi ý gần đây:</span>
              <AnimatePresence mode="popLayout">
                {existingFacilities.slice(0, 3).map((f, idx) => (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8, y: 2 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -2 }}
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    id={`suggested-facility-${idx}`}
                    key={f}
                    type="button"
                    onClick={() => setFacility(f)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100 transition-all font-medium cursor-pointer"
                  >
                    {f}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Managed Area */}
        <div ref={areaAutocompleteRef}>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            Địa bàn quản lý
          </label>
          <div className="relative">
            <input
              id="input-managed-area"
              type="text"
              required
              placeholder="VD: Quận 1, Quận 3, Phường Bến Nghé..."
              value={managedArea}
              onChange={(e) => {
                setManagedArea(e.target.value);
                setShowAreaSuggestions(true);
                setActiveAreaIndex(-1);
              }}
              onFocus={() => setShowAreaSuggestions(true)}
              onKeyDown={handleAreaKeyDown}
              autoComplete="off"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 pr-10"
            />
            {managedArea && (
              <button
                type="button"
                onClick={() => {
                  setManagedArea('');
                  setShowAreaSuggestions(true);
                  setActiveAreaIndex(-1);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                id="btn-clear-managed-area"
              >
                <span className="text-xs">✕</span>
              </button>
            )}
            
            <AnimatePresence>
              {showAreaSuggestions && (filteredAreaSuggestions.length > 0 || managedArea.trim() !== '') && (
                <motion.div
                  id="area-autocomplete-dropdown"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-150 rounded-xl shadow-lg z-30 max-h-56 overflow-y-auto divide-y divide-slate-50"
                >
                  {filteredAreaSuggestions.length > 0 ? (
                    <div className="p-1">
                      {filteredAreaSuggestions.map((a, idx) => {
                        const isHighlighted = idx === activeAreaIndex;
                        return (
                          <button
                            key={a}
                            id={`area-autocomplete-item-${idx}`}
                            type="button"
                            onClick={() => handleSelectAreaSuggestion(a)}
                            onMouseEnter={() => setActiveAreaIndex(idx)}
                            className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 border-0 cursor-pointer ${
                              isHighlighted
                                ? 'bg-indigo-50 text-indigo-700 font-medium'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Search className={`w-3.5 h-3.5 shrink-0 ${isHighlighted ? 'text-indigo-500' : 'text-slate-400'}`} />
                              <span className="truncate">{a}</span>
                            </div>
                            {isHighlighted && (
                              <span className="text-[9px] text-indigo-500 font-medium font-sans">Chọn</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : managedArea.trim() !== '' ? (
                    <div className="p-3.5 text-center">
                      <p className="text-[11px] font-semibold text-slate-600 flex items-center justify-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Tên địa bàn mới</span>
                      </p>
                      <p className="text-[9.5px] text-slate-400 mt-1 leading-normal">
                        Hệ thống sẽ lưu địa bàn mới này vào lịch sử thông tin chung sau khi bạn lưu bản ghi.
                      </p>
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {existingManagedAreas.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="text-[10px] text-slate-400 self-center">Gợi ý gần đây:</span>
              <AnimatePresence mode="popLayout">
                {existingManagedAreas.slice(0, 3).map((a, idx) => (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8, y: 2 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -2 }}
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    id={`suggested-area-${idx}`}
                    key={a}
                    type="button"
                    onClick={() => setManagedArea(a)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100 transition-all font-medium cursor-pointer"
                  >
                    {a}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Facility Target Input */}
        <div className="p-3.5 bg-slate-50/50 border border-slate-150 rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label htmlFor="facility-target-input" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-indigo-500 shrink-0" />
                Chỉ tiêu tuyển sinh/khám của cơ sở:
              </label>
              {facility.trim() !== '' ? (
                <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                  Số lượng hồ sơ chỉ tiêu giao cho <span className="font-semibold text-indigo-600">"{facility.trim()}"</span>. Hệ thống sẽ cập nhật tự động.
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                  Chỉ tiêu sẽ được liên kết sau khi bạn chọn hoặc nhập <span className="font-semibold text-slate-500">tên cơ sở y tế</span> ở mục trên.
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
              <input
                id="facility-target-input"
                type="number"
                min="0"
                placeholder={facility.trim() !== '' ? "Nhập chỉ tiêu" : "Chưa có cơ sở..."}
                disabled={facility.trim() === ''}
                value={localTargetValue}
                onChange={handleLocalTargetChange}
                className={`w-28 px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono text-center focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all ${
                  facility.trim() !== ''
                    ? 'bg-white border border-indigo-200 text-slate-800'
                    : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              />
              <span className={`text-[10.5px] font-medium ${facility.trim() !== '' ? 'text-slate-500' : 'text-slate-400'}`}>hồ sơ</span>
            </div>
          </div>
        </div>

        {/* Categories Selection with detailed subdivisions */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            Nhóm đối tượng độ tuổi
          </label>
          <div className="grid grid-cols-1 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
            {Object.values(CATEGORIES).map((cat) => {
              const isActive = category === cat.id;
              return (
                <motion.label
                  key={cat.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`relative flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer overflow-hidden ${
                    isActive
                      ? 'border-transparent'
                      : 'border-slate-100 hover:border-slate-200 bg-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-category-indicator"
                      className="absolute inset-0 bg-blue-50/35 border border-blue-500 rounded-xl pointer-events-none z-0"
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    />
                  )}
                  <input
                    type="radio"
                    name="age-category"
                    checked={isActive}
                    onChange={() => setCategory(cat.id)}
                    className="mt-1 text-blue-600 focus:ring-blue-500 z-10"
                  />
                  <div className="flex-1 z-10">
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
                </motion.label>
              );
            })}
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

      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            id="success-toast"
            initial={{ opacity: 0, y: 15, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 15, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 450, damping: 25 }}
            className="absolute bottom-4 left-1/2 bg-emerald-600 text-white text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-50 font-medium"
          >
            <span>✓</span> Thêm bản ghi thành công!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
