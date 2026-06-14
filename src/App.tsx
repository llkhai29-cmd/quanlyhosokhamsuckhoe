/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { CheckupRecord, SyncConfig, CATEGORIES } from './types';
import { initAuth, googleSignIn, logout, db, OperationType, handleFirestoreError } from './lib/firebase';
import { findExistingSpreadsheet, createSpreadsheet, syncRecordsToSpreadsheet } from './lib/googleSheets';

import Dashboard from './components/Dashboard';
import DataEntry from './components/DataEntry';
import RecordHistory from './components/RecordHistory';
import ExportSection from './components/ExportSection';

import { 
  Activity, 
  LayoutDashboard, 
  PlusCircle, 
  ListTodo, 
  FileSpreadsheet, 
  CloudCheck, 
  LogOut, 
  LogIn, 
  CheckCircle2, 
  RefreshCw, 
  AlertTriangle 
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'entry' | 'history' | 'export'>('dashboard');
  const [records, setRecords] = useState<CheckupRecord[]>([]);
  const [facilityTargets, setFacilityTargets] = useState<Record<string, number>>({});
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Sync state
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    spreadsheetId: null,
    spreadsheetUrl: null,
    lastSyncedAt: null,
    autoSync: true,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Real-time Firestore targets sync when authenticated
  useEffect(() => {
    if (!user) {
      const savedTargets = localStorage.getItem('health_checkup_facility_targets');
      if (savedTargets) {
        try {
          setFacilityTargets(JSON.parse(savedTargets));
        } catch (e) {
          console.error('Lỗi khi đọc LocalStorage targets:', e);
        }
      } else {
        setFacilityTargets({});
      }
      return;
    }

    const docRef = doc(db, 'targets', user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const targets = data.facilityTargets || {};
        setFacilityTargets(targets);
        localStorage.setItem('health_checkup_facility_targets', JSON.stringify(targets));
      } else {
        setFacilityTargets({});
      }
    }, (error) => {
      console.error('Lỗi khi lắng nghe Firestore targets:', error);
    });

    return () => unsubscribe();
  }, [user]);

  // Update target for a single health facility
  const updateFacilityTarget = async (facilityName: string, targetValue: number) => {
    const updatedTargets = {
      ...facilityTargets,
      [facilityName]: Math.max(0, targetValue),
    };
    
    setFacilityTargets(updatedTargets);
    localStorage.setItem('health_checkup_facility_targets', JSON.stringify(updatedTargets));

    if (user) {
      try {
        await setDoc(doc(db, 'targets', user.uid), {
          userId: user.uid,
          facilityTargets: updatedTargets,
          updatedAt: Date.now(),
        });
      } catch (error) {
        console.error('Lỗi khi lưu chỉ tiêu lên Firestore:', error);
      }
    }
  };

  // Migrate raw offline records from LocalStorage to Firestore upon logging in
  const syncOfflineRecordsToFirestore = async (currentUser: User) => {
    const saved = localStorage.getItem('health_checkup_records');
    if (!saved) return;
    try {
      const localRecords: CheckupRecord[] = JSON.parse(saved);
      // Synchronize only those records that don't have a userId field (offline/local only)
      const unsyncedLocal = localRecords.filter(r => !('userId' in r) || !(r as any).userId);
      if (unsyncedLocal.length === 0) return;

      const batch = writeBatch(db);
      const path = 'records';
      
      unsyncedLocal.forEach((rec) => {
        const docRef = doc(db, path, rec.id);
        batch.set(docRef, {
          ...rec,
          userId: currentUser.uid
        });
      });
      
      await batch.commit();
      console.log(`Đồng bộ thành công ${unsyncedLocal.length} bản ghi offline lên Firestore.`);
    } catch (e) {
      console.error('Lỗi khi đồng bộ tự động dữ liệu cũ lên Firestore:', e);
    }
  };

  // Real-time Firestore sync when authenticated
  useEffect(() => {
    if (!user) {
      const saved = localStorage.getItem('health_checkup_records');
      if (saved) {
        try {
          setRecords(JSON.parse(saved));
        } catch (e) {
          console.error('Lỗi khi đọc LocalStorage:', e);
        }
      } else {
        setRecords([]);
      }
      return;
    }

    const path = 'records';
    const q = query(collection(db, path), where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbRecords: CheckupRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        dbRecords.push({
          id: data.id,
          date: data.date,
          facility: data.facility,
          managedArea: data.managedArea || '',
          category: data.category,
          quantity: data.quantity,
          notes: data.notes,
          createdAt: data.createdAt,
          syncedAt: data.syncedAt,
        });
      });
      // Sort newest first
      dbRecords.sort((a, b) => b.createdAt - a.createdAt);
      setRecords(dbRecords);
      // Keep LocalStorage updated as a fallback cache
      localStorage.setItem('health_checkup_records', JSON.stringify(dbRecords));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user]);

  // Load sync config and establish auth connection
  useEffect(() => {
    const savedSync = localStorage.getItem('health_checkup_sync_config');
    if (savedSync) {
      try {
        setSyncConfig(JSON.parse(savedSync));
      } catch (e) {
        console.error('Lỗi khi đọc LocalStorage sync config:', e);
      }
    }

    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setNeedsAuth(false);
        // Find existing spreadsheet if user logged in
        checkOrCreateSpreadsheet(token);
        // Automatically sync existing offline records to Firestore
        syncOfflineRecordsToFirestore(currentUser);
      },
      () => {
        setNeedsAuth(true);
        setUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Save records to LocalStorage when changed
  const saveRecordsToLocalStorage = (updatedRecords: CheckupRecord[]) => {
    setRecords(updatedRecords);
    localStorage.setItem('health_checkup_records', JSON.stringify(updatedRecords));
  };

  // Google sign-in handler
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setSyncError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
        await checkOrCreateSpreadsheet(result.accessToken);
      }
    } catch (err: any) {
      console.error('Đăng nhập thất bại:', err);
      if (err?.code === 'auth/popup-blocked') {
        setSyncError(
          'Trình duyệt đã chặn cửa sổ Popup đăng nhập. Vui lòng cho phép hiện Popup ở góc phải thanh địa chỉ tiện ích, hoặc bấm chia sẻ/Mở trang trong tab mới (mũi tên chéo góc phải trên của AI Studio) để đăng nhập an toàn.'
        );
      } else {
        setSyncError(
          'Đăng nhập Google thất bại. Do hạn chế bảo mật nội dung Iframe của AI Studio, vui lòng bấm nút "Mở trong tab mới" (icon mũi tên chéo góc trên bên phải khung preview) để đăng nhập và kết nối Google Drive thuận tiện nhất.'
        );
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Google sign-out handler
  const handleLogout = async () => {
    const confirmLogout = window.confirm('Bạn muốn đăng xuất khỏi Google Drive và Google Sheets?');
    if (!confirmLogout) return;

    try {
      await logout();
      setUser(null);
      setAccessToken(null);
      setNeedsAuth(true);
      
      const resetSyncConfig = {
        spreadsheetId: null,
        spreadsheetUrl: null,
        lastSyncedAt: null,
        autoSync: true,
      };
      setSyncConfig(resetSyncConfig);
      localStorage.setItem('health_checkup_sync_config', JSON.stringify(resetSyncConfig));
    } catch (err) {
      console.error('Lỗi khi đăng xuất:', err);
    }
  };

  // Find or create the sync spreadsheet in Drive
  const checkOrCreateSpreadsheet = async (token: string) => {
    setIsSyncing(true);
    try {
      let sheetDetail = await findExistingSpreadsheet(token);
      if (!sheetDetail) {
        sheetDetail = await createSpreadsheet(token);
      }

      setSyncConfig((prev) => {
        const next = {
          ...prev,
          spreadsheetId: sheetDetail!.spreadsheetId,
          spreadsheetUrl: sheetDetail!.spreadsheetUrl,
        };
        localStorage.setItem('health_checkup_sync_config', JSON.stringify(next));
        return next;
      });
    } catch (err: any) {
      console.error('Lỗi khi khởi tạo Google Sheets:', err);
      setSyncError(
        'Khởi tạo kết nối Google Sheets thất bại. Đảm bảo bạn đã bấm chọn (tích các ô vuông) đồng ý cấp quyền xem/chỉnh sửa file Google Drive & Google Sheets tại giao diện đăng nhập Google. Bạn có thể Đăng xuất để tiến hành liên kết và chọn tích quyền lại.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  // Perform synchronization logic
  const handleSyncToSheets = async (targetRecords = records) => {
    if (!accessToken || !syncConfig.spreadsheetId) {
      setSyncError('Chưa thiết lập liên kết Google Sheets hoặc phiên đăng nhập hết hạn.');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    try {
      await syncRecordsToSpreadsheet(accessToken, syncConfig.spreadsheetId, targetRecords);

      // Set all local records as synced
      const timestamp = Date.now();
      const updated = targetRecords.map((r) => ({
        ...r,
        syncedAt: timestamp,
      }));

      if (user) {
        // Push syncedAt status changes to Firestore
        const batch = writeBatch(db);
        const path = 'records';
        updated.forEach((r) => {
          const docRef = doc(db, path, r.id);
          batch.set(docRef, {
            ...r,
            userId: user.uid
          }, { merge: true });
        });
        await batch.commit();
      } else {
        setRecords(updated);
        localStorage.setItem('health_checkup_records', JSON.stringify(updated));
      }

      setSyncConfig((prev) => {
        const next = {
          ...prev,
          lastSyncedAt: timestamp,
        };
        localStorage.setItem('health_checkup_sync_config', JSON.stringify(next));
        return next;
      });
    } catch (err: any) {
      console.error('Lỗi khi đồng bộ lên Sheets:', err);
      setSyncError('Không thể đồng bộ dữ liệu tới Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Add a new medical record log
  const handleAddRecord = async (newRecordData: Omit<CheckupRecord, 'id' | 'createdAt'>) => {
    const countRecords = records.length;
    // Simple id generation - prefix with timestamp and index
    const newRecord: CheckupRecord = {
      ...newRecordData,
      id: `REC-${Date.now()}-${countRecords + 1}`,
      createdAt: Date.now(),
    };

    if (user) {
      const path = 'records';
      try {
        await setDoc(doc(db, path, newRecord.id), {
          ...newRecord,
          userId: user.uid
        });
        
        // Push update to Google Sheets if autoSync is true
        if (syncConfig.autoSync && accessToken && syncConfig.spreadsheetId) {
          const updated = [newRecord, ...records];
          await handleSyncToSheets(updated);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `${path}/${newRecord.id}`);
      }
    } else {
      const updated = [newRecord, ...records];
      saveRecordsToLocalStorage(updated);
      if (syncConfig.autoSync && accessToken && syncConfig.spreadsheetId) {
        await handleSyncToSheets(updated);
      }
    }
  };

  // Delete an existing record
  const handleDeleteRecord = async (id: string) => {
    if (user) {
      const path = 'records';
      try {
        await deleteDoc(doc(db, path, id));
        
        // Push update to Google Sheets if autoSync is true
        if (syncConfig.autoSync && accessToken && syncConfig.spreadsheetId) {
          const updated = records.filter((r) => r.id !== id);
          await handleSyncToSheets(updated);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
      }
    } else {
      const updated = records.filter((r) => r.id !== id);
      saveRecordsToLocalStorage(updated);
      if (syncConfig.autoSync && accessToken && syncConfig.spreadsheetId) {
        await handleSyncToSheets(updated);
      }
    }
  };

  // Edit/Update an existing medical record
  const handleUpdateRecord = async (updatedRecord: CheckupRecord) => {
    if (user) {
      const path = 'records';
      try {
        await setDoc(doc(db, path, updatedRecord.id), {
          ...updatedRecord,
          userId: user.uid
        }, { merge: true });
        
        // Push update to Google Sheets if autoSync is true
        if (syncConfig.autoSync && accessToken && syncConfig.spreadsheetId) {
          const updated = records.map((r) => (r.id === updatedRecord.id ? updatedRecord : r));
          await handleSyncToSheets(updated);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `${path}/${updatedRecord.id}`);
      }
    } else {
      const updated = records.map((r) => (r.id === updatedRecord.id ? updatedRecord : r));
      saveRecordsToLocalStorage(updated);
      if (syncConfig.autoSync && accessToken && syncConfig.spreadsheetId) {
        await handleSyncToSheets(updated);
      }
    }
  };

  // Auto-complete list of facility names based on history
  const uniqueFacilities = useMemo(() => {
    const list = new Set(records.map((r) => r.facility).filter(Boolean));
    return Array.from(list);
  }, [records]);

  // Auto-complete list of managed areas based on history
  const uniqueManagedAreas = useMemo(() => {
    const list = new Set(records.map((r) => r.managedArea).filter(Boolean));
    return Array.from(list);
  }, [records]);

  // Unsynced records count
  const unsyncedCount = useMemo(() => {
    return records.filter((r) => !r.syncedAt).length;
  }, [records]);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-800">
      
      {/* Top Banner Navigation Bar */}
      <header id="app-header" className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Activity className="w-5.5 h-5.5 stroke-2" />
            </div>
            <div>
              <h1 className="font-bold text-base text-slate-900 tracking-tight leading-tight">Quản lý Hồ sơ Khám sức khỏe</h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Sở Y tế / Ban chỉ đạo Bảo vệ chất lượng sức khỏe</p>
            </div>
          </div>

          {/* User auth and connection metadata */}
          <div className="flex items-center gap-4">
            
            {/* Sync Cloud status indicator */}
            {!needsAuth && user ? (
              <div id="auth-status-container" className="hidden md:flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-1.5 px-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-6 h-6 rounded-full border border-white shadow-sm" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold font-sans">
                    {user.email?.[0].toUpperCase()}
                  </div>
                )}
                <div className="text-left font-sans">
                  <p className="text-[10.5px] font-bold text-slate-800 leading-tight block truncate max-w-[120px]">{user.displayName || 'Quản trị viên'}</p>
                  <p className="text-[9px] text-slate-400 block truncate max-w-[120px]">{user.email}</p>
                </div>
                <div className="h-5 w-[1px] bg-slate-200" />
                <button
                  id="btn-header-logout"
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 transition-all"
                  title="Đăng xuất tài khoản Drive/Sheets"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                id="btn-header-login"
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 hover:-translate-y-[0.5px] shadow-md shadow-blue-500/10 transition-all duration-150"
              >
                {isLoggingIn ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Đăng kết nối...
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5" />
                    Đồng bộ Google Drive
                  </>
                )}
              </button>
            )}

          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        
        {/* Sync errors/warnings or outstanding alerts */}
        {syncError && (
          <div id="sync-error-banner" className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-xs text-red-900">Tính năng đồng bộ Google gặp trục trặc</h4>
              <p className="text-[11px] text-red-700 mt-0.5">{syncError}</p>
            </div>
            <button 
              onClick={() => setSyncError(null)}
              className="text-slate-400 hover:text-slate-700 text-xs px-2"
            >
              đóng
            </button>
          </div>
        )}

        {/* Sync Status bar for unsynced changes */}
        {!needsAuth && user && unsyncedCount > 0 && (
          <div id="unsynced-records-banner" className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shrink-0">
                <RefreshCw className="w-4 h-4 animate-spin-slow" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-blue-900">
                  Phát hiện {unsyncedCount} bản ghi chưa đồng bộ hoàn tất
                </h4>
                <p className="text-[10px] text-blue-600 leading-normal">
                  Dữ liệu đang được lưu cục bộ trên máy tính này. Đồng bộ ngay lên Google Sheets để báo cáo trực tiếp.
                </p>
              </div>
            </div>
            
            <button
              id="btn-banner-sync"
              disabled={isSyncing}
              onClick={() => handleSyncToSheets()}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:scale-95 transition-all text-center shrink-0"
            >
              {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Ngay bây giờ'}
            </button>
          </div>
        )}

        {/* Google Sheets Link Indicator */}
        {!needsAuth && user && syncConfig.spreadsheetUrl && (
          <div id="google-sheets-connected-indicator" className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="text-[11px] text-emerald-800">
                Đã kết nối với Google Sheet: 
                <a
                  href={syncConfig.spreadsheetUrl}
                  target="_blank"
                  className="ml-1 font-bold underline hover:text-emerald-900"
                  rel="noreferrer"
                >
                  Quản lý Hồ sơ Khám sức khỏe
                </a>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  id="checkbox-auto-sync"
                  type="checkbox"
                  checked={syncConfig.autoSync}
                  onChange={(e) => {
                    const next = { ...syncConfig, autoSync: e.target.checked };
                    setSyncConfig(next);
                    localStorage.setItem('health_checkup_sync_config', JSON.stringify(next));
                  }}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                />
                <span className="text-[10.5px] text-emerald-700 font-medium">Bật Tự động đồng bộ</span>
              </label>
              {syncConfig.lastSyncedAt && (
                <span className="text-[9.5px] text-slate-400">
                  Lần đồng bộ cuối: {new Date(syncConfig.lastSyncedAt).toLocaleTimeString('vi-VN')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tab Selection Area */}
        <div id="tab-controls-container" className="flex border-b border-slate-200">
          <nav className="flex gap-4 sm:gap-6 -mb-px">
            {/* Tab 1: Dashboard */}
            <button
              id="tab-btn-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`pb-3 px-1 border-b-2 font-semibold text-xs tracking-tight transition-all flex items-center gap-1.5 ${
                activeTab === 'dashboard'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Trực quan dashboard
            </button>

            {/* Tab 2: Entry */}
            <button
              id="tab-btn-entry"
              onClick={() => setActiveTab('entry')}
              className={`pb-3 px-1 border-b-2 font-semibold text-xs tracking-tight transition-all flex items-center gap-1.5 ${
                activeTab === 'entry'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              Nhập số liệu mới
            </button>

            {/* Tab 3: History */}
            <button
              id="tab-btn-history"
              onClick={() => setActiveTab('history')}
              className={`pb-3 px-1 border-b-2 font-semibold text-xs tracking-tight transition-all flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ListTodo className="w-4 h-4" />
              Sổ nhật ký ({records.length})
            </button>

            {/* Tab 4: Export */}
            <button
              id="tab-btn-export"
              onClick={() => setActiveTab('export')}
              className={`pb-3 px-1 border-b-2 font-semibold text-xs tracking-tight transition-all flex items-center gap-1.5 ${
                activeTab === 'export'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Xuất báo cáo định kỳ
            </button>
          </nav>
        </div>

        {/* Tab Panels */}
        <div id="tab-content" className="space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <Dashboard 
                  records={records} 
                  facilityTargets={facilityTargets} 
                  onUpdateTarget={updateFacilityTarget} 
                />
              </motion.div>
            )}

            {activeTab === 'entry' && (
              <motion.div
                key="entry"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Form container */}
                <div className="lg:col-span-2">
                  <DataEntry 
                    onAddRecord={handleAddRecord} 
                    existingFacilities={uniqueFacilities} 
                    existingManagedAreas={uniqueManagedAreas}
                    facilityTargets={facilityTargets}
                    onUpdateTarget={updateFacilityTarget}
                  />
                </div>

                {/* Sidebar Quick status indicator */}
                <div className="space-y-4">
                  
                  {/* Auth notice helper card on sync */}
                  {needsAuth && (
                    <div className="bg-gradient-to-br from-indigo-500 to-blue-700 text-white rounded-2xl p-5 shadow-sm">
                      <h3 className="font-semibold text-sm">Đồng bộ Cloud an toàn</h3>
                      <p className="text-[10.5px] leading-relaxed text-blue-100 mt-1.5">
                        Đăng nhập tài khoản Google để hệ thống tự động khởi tạo và đồng bộ các biểu báo số liệu liên tục lên Google Sheets.
                      </p>
                      <button
                        id="btn-sidebar-login"
                        onClick={handleLogin}
                        disabled={isLoggingIn}
                        className="w-full mt-4 py-2 bg-white text-blue-700 rounded-xl font-bold text-xs hover:bg-blue-50 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        {isLoggingIn ? 'Đang kết nối...' : 'Kết nối Google Drive'}
                      </button>
                    </div>
                  )}

                  {/* Categories description helper */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3.5">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Danh mục nhóm tuổi chỉ định</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Tiêu chuẩn phân nhóm đối tượng khám</p>
                    </div>
                    
                    <div className="space-y-2.5">
                      {/* group 0-6 */}
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Từ 0 đến liền dưới 6 tuổi</p>
                          <p className="text-[9px] text-slate-400">Trẻ em chưa đến tuổi đi học tiểu học</p>
                        </div>
                      </div>

                      {/* group 6-18 */}
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Từ 6 tuổi đến liền dưới 18 tuổi</p>
                          <p className="text-[9px] text-slate-400">Học sinh phổ thông tiểu học - trung học</p>
                        </div>
                      </div>

                      {/* group 18-60 containing 3 sub groups */}
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Từ 18 tuổi đến liền dưới 60 tuổi</p>
                          <p className="text-[9.5px] text-slate-500 font-medium">Bao gồm 3 nhánh đối tượng phụ:</p>
                          <div className="pl-3 mt-1.5 space-y-1 text-[9px] text-slate-500 list-disc">
                            <p>• <strong>Cộng đồng:</strong> Người lao động tự do, nông dân.</p>
                            <p>• <strong>NLĐ doanh nghiệp:</strong> Nhân viên công ty, xí nghiệp.</p>
                            <p>• <strong>Cán bộ viên chức công chức:</strong> Cơ quan Nhà nước.</p>
                          </div>
                        </div>
                      </div>

                      {/* group above 60 */}
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-pink-500 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Từ 60 tuổi trở lên</p>
                          <p className="text-[9px] text-slate-400">Nhóm người cao tuổi, hưu trí</p>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Statistics helper preview info */}
                  <div className="bg-slate-900 border border-slate-950 text-white rounded-2xl p-5 shadow-sm relative overflow-hidden">
                    <h4 className="font-bold text-xs text-slate-200">Bản ghi có trong ngày</h4>
                    <p className="text-2xl font-bold font-mono mt-2">
                      {records.filter(r => r.date === new Date().toISOString().split('T')[0]).reduce((s, r) => s + r.quantity, 0).toLocaleString('vi-VN')}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">Hồ sơ khám sức khỏe đã nhập hôm nay</p>
                  </div>

                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <RecordHistory 
                  records={records} 
                  onDeleteRecord={handleDeleteRecord} 
                  onUpdateRecord={handleUpdateRecord} 
                  onSyncNow={accessToken && syncConfig.spreadsheetId ? () => handleSyncToSheets() : undefined}
                  isSyncing={isSyncing}
                  sheetsUrl={syncConfig.spreadsheetUrl}
                />
              </motion.div>
            )}

            {activeTab === 'export' && (
              <motion.div
                key="export"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <ExportSection records={records} facilityTargets={facilityTargets} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* Footer copyright */}
      <footer id="app-footer" className="bg-white border-t border-slate-100 py-6 mt-12 text-center text-xs text-slate-400 font-sans">
        <p className="font-semibold text-slate-500">Hệ thống Quản lý Số liệu Hồ sơ Khám sức khỏe định kỳ</p>
        <p className="text-[10px] mt-1 text-slate-400">Hỗ trợ đầy đủ các tính năng nhập cơ sở dữ liệu, lọc trực quan, kết xuất biểu mẫu Excel và đồng bộ trực tiếp đám mây.</p>
      </footer>

    </div>
  );
}
