/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AgeGroup = 
  | 'under_6'
  | 'from_6_to_18'
  | 'from_18_to_60_community'
  | 'from_18_to_60_worker'
  | 'from_18_to_60_officer'
  | 'above_60';

export interface CategoryInfo {
  id: AgeGroup;
  name: string;
  parentGroup: '0_6' | '6_18' | '18_60' | '60_plus';
  parentGroupName: string;
  subName?: string;
  color: string;
}

export const CATEGORIES: Record<AgeGroup, CategoryInfo> = {
  under_6: {
    id: 'under_6',
    name: 'Dưới 6 tuổi',
    parentGroup: '0_6',
    parentGroupName: '0 đến dưới 6 tuổi',
    color: '#3b82f6', // blue
  },
  from_6_to_18: {
    id: 'from_6_to_18',
    name: 'Từ 6 đến dưới 18 tuổi',
    parentGroup: '6_18',
    parentGroupName: '6 tuổi đến dưới 18 tuổi',
    color: '#06b6d4', // cyan
  },
  from_18_to_60_community: {
    id: 'from_18_to_60_community',
    name: '18 - dưới 60: Cộng đồng',
    parentGroup: '18_60',
    parentGroupName: '18 đến dưới 60 tuổi',
    subName: 'Cộng đồng',
    color: '#10b981', // emerald
  },
  from_18_to_60_worker: {
    id: 'from_18_to_60_worker',
    name: '18 - dưới 60: NLĐ tại công ty, DN',
    parentGroup: '18_60',
    parentGroupName: '18 đến dưới 60 tuổi',
    subName: 'Người lao động tại công ty, doanh nghiệp',
    color: '#f59e0b', // amber
  },
  from_18_to_60_officer: {
    id: 'from_18_to_60_officer',
    name: '18 - dưới 60: Cán bộ công chức viên chức',
    parentGroup: '18_60',
    parentGroupName: '18 đến dưới 60 tuổi',
    subName: 'Cán bộ viên chức công chức',
    color: '#8b5cf6', // violet
  },
  above_60: {
    id: 'above_60',
    name: 'Từ 60 tuổi trở lên',
    parentGroup: '60_plus',
    parentGroupName: 'Từ 60 tuổi trở lên',
    color: '#ec4899', // pink
  }
};

export interface CheckupRecord {
  id: string;
  date: string; // YYYY-MM-DD
  facility: string; // Medical location
  managedArea: string; // Managed administrative area
  category: AgeGroup;
  quantity: number;
  notes?: string;
  createdAt: number; // timestamp
  syncedAt?: number; // timestamp of when synced to Google Sheets
}

export interface SyncConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  lastSyncedAt: number | null;
  autoSync: boolean;
}
