/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  MoreVertical,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { AppTable } from '../components/AppTable';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { AppDropdown } from '../components/AppDropdown';
import { ProcessingActivity, LegalBasis } from '../types';

interface ActivitiesFeatureProps {
  id: string;
  activities: ProcessingActivity[];
  onAddActivityClick: () => void;
  onDeleteActivity: (id: string) => void;
  onDeleteMultipleActivities: (ids: string[]) => void;
  onEditActivityClick: (activity: ProcessingActivity) => void;
}

export const ActivitiesFeature: React.FC<ActivitiesFeatureProps> = ({
  id,
  activities,
  onAddActivityClick,
  onDeleteActivity,
  onDeleteMultipleActivities,
  onEditActivityClick,
}) => {
  // States for List view
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedBasis, setSelectedBasis] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  const [sortKey, setSortKey] = useState<string>('lastUpdated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Compute filtering lists dynamically
  const deptOptions = useMemo(() => {
    const sets = new Set(activities.map((a) => a.department));
    return ['All', ...Array.from(sets)];
  }, [activities]);

  const basisOptions = ['All', 'Consent', 'Contract', 'Legal Obligation', 'Vital Interests', 'Public Task', 'Legitimate Interests'];

  // Sorting handler
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities
      .filter((activity) => {
        const matchesSearch =
          activity.name.toLowerCase().includes(search.toLowerCase()) ||
          activity.purpose.toLowerCase().includes(search.toLowerCase()) ||
          activity.id.toLowerCase().includes(search.toLowerCase());

        const matchesDept = selectedDept === 'All' || activity.department === selectedDept;

        const matchesBasis =
          selectedBasis === 'All' || activity.legalBasis.toLowerCase().includes(selectedBasis.toLowerCase());

        const matchesStatus = selectedStatus === 'All' || activity.status === selectedStatus;

        return matchesSearch && matchesDept && matchesBasis && matchesStatus;
      })
      .sort((a: any, b: any) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        if (Array.isArray(valA)) valA = valA.join(', ');
        if (Array.isArray(valB)) valB = valB.join(', ');

        if (typeof valA === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
      });
  }, [activities, search, selectedDept, selectedBasis, selectedStatus, sortKey, sortOrder]);

  // Paginated activities
  const paginatedActivities = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredActivities.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredActivities, currentPage]);

  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage) || 1;

  // Bulk selectors
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const ids = paginatedActivities.map((a) => a.id);
      setSelectedIds(ids);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (rowId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, rowId]);
    } else {
      setSelectedIds((prev) => prev.filter((id) => id !== rowId));
    }
  };

  // Bulk delete action logic
  const handleBulkDelete = () => {
    if (confirm(`Confirm bulk deleting ${selectedIds.length} ROPA records? This operation is irreversible.`)) {
      onDeleteMultipleActivities(selectedIds);
      setSelectedIds([]);
    }
  };

  // Quick export CSV logic
  const handleExportCSV = () => {
    const headers = ['Activity ID', 'Name', 'Purpose', 'Department', 'Legal Basis', 'Retention Period', 'DPIA Required', 'Status', 'Last Updated'];
    const rows = filteredActivities.map((a) => [
      a.id,
      `"${a.name.replace(/"/g, '""')}"`,
      `"${a.purpose.replace(/"/g, '""')}"`,
      a.department,
      a.legalBasis,
      a.retentionPeriod,
      a.dpiaRequired ? 'TRUE' : 'FALSE',
      a.status,
      a.lastUpdated,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PrivacyPilot_ROPA_Registry_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id={id} className="space-y-6">
      {/* Search and Filters Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex-1 max-w-lg">
            <AppTextField
              id="search-activities"
              placeholder="Search by ROPA code, record title, or purpose query..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              icon={<Search className="h-4 w-4 text-slate-400" />}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {selectedIds.length > 0 && (
              <AppButton
                id="btn-bulk-delete"
                variant="danger"
                size="sm"
                className="h-9"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Discard ({selectedIds.length})
              </AppButton>
            )}

            <AppButton
              id="btn-export-ropa"
              variant="outline"
              size="sm"
              className="h-9 border-slate-200 dark:border-slate-800 dark:bg-slate-905"
              onClick={handleExportCSV}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
              Download CSV
            </AppButton>

            <AppButton
              id="btn-add-activity-trigger"
              variant="primary"
              size="sm"
              className="h-9"
              onClick={onAddActivityClick}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Record Activity
            </AppButton>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 flex flex-wrap items-center gap-4">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Scope Filters
          </span>

          <div className="inline-flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Department:</span>
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md py-1 px-2.5 outline-hidden text-slate-700 dark:text-slate-350 cursor-pointer"
            >
              {deptOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Legal Basis:</span>
            <select
              value={selectedBasis}
              onChange={(e) => {
                setSelectedBasis(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md py-1 px-2.5 outline-hidden text-slate-700 dark:text-slate-350 cursor-pointer"
            >
              {basisOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md py-1 px-2.5 outline-hidden text-slate-700 dark:text-slate-350 cursor-pointer"
            >
              <option value="All">All statuses</option>
              <option value="Active">Active</option>
              <option value="Draft">Draft</option>
              <option value="Archived">Archived</option>
              <option value="Review Required">Review Required</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Register */}
      <AppTable<ProcessingActivity>
        id="activities-registry-table"
        selectable
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelectRow}
        getRowId={(row) => row.id}
        onSort={handleSort}
        sortKey={sortKey}
        sortOrder={sortOrder}
        columns={[
          {
            key: 'id',
            header: 'CODE',
            sortable: true,
            render: (row) => (
              <span className="font-mono text-xs font-bold text-indigo-605 dark:text-indigo-400">
                {row.id}
              </span>
            ),
          },
          {
            key: 'name',
            header: 'RECORDS DETAILS',
            sortable: true,
            render: (row) => (
              <div>
                <h4 className="text-sm font-bold text-slate-805 dark:text-slate-200 leading-tight">
                  {row.name}
                </h4>
                <p className="text-[11px] text-slate-450 dark:text-slate-500 mt-0.5 line-clamp-1">
                  {row.purpose}
                </p>
              </div>
            ),
          },
          {
            key: 'department',
            header: 'UNIT',
            sortable: true,
            render: (row) => (
              <span className="text-xs font-semibold px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200/40 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 rounded-md">
                {row.department}
              </span>
            ),
          },
          {
            key: 'legalBasis',
            header: 'LEGAL BASIS',
            sortable: true,
            render: (row) => {
              const brief = row.legalBasis.split(' ')[0];
              return (
                <span className="text-xs font-bold font-mono text-indigo-600/90 dark:text-indigo-405">
                  {brief}
                </span>
              );
            },
          },
          {
            key: 'retentionPeriod',
            header: 'RETENTION',
            sortable: true,
          },
          {
            key: 'dpiaRequired',
            header: 'DPIA CAP',
            sortable: true,
            render: (row) => (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                  row.dpiaRequired
                    ? 'bg-amber-50 dark:bg-amber-950/45 text-amber-600 dark:text-amber-400 border border-amber-200/40'
                    : 'bg-slate-50 dark:bg-slate-950 text-slate-400 border border-slate-200/30'
                }`}
              >
                {row.dpiaRequired ? (
                  <>
                    <AlertTriangle className="h-3 w-3" /> Required
                  </>
                ) : (
                  'No Risk'
                )}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'STATUS',
            sortable: true,
            render: (row) => (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-2 py-1 rounded-lg ${
                  row.status === 'Active'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-450 border border-emerald-250/30'
                    : row.status === 'Draft'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-500'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${row.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {row.status}
              </span>
            ),
          },
          {
            key: 'actions',
            header: '',
            render: (row) => (
              <div className="flex justify-end gap-1.5">
                <AppButton
                  id={`btn-edit-act-${row.id}`}
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  onClick={() => onEditActivityClick(row)}
                  title="Configure activity structure"
                >
                  Configure
                </AppButton>
                <button
                  onClick={() => {
                    if (confirm(`Confirm deleting ROPA record ${row.id}?`)) {
                      onDeleteActivity(row.id);
                    }
                  }}
                  className="p-1 text-slate-450 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  title="Discard archive record"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ),
          },
        ]}
        data={paginatedActivities}
      />

      {/* Pagination component */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl px-5 py-3.5 shadow-2xs">
        <span className="text-xs text-slate-500">
          Viewing rows <strong className="font-bold text-slate-700 dark:text-slate-305">{filteredActivities.length ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> to <strong className="font-bold text-slate-700 dark:text-slate-305">{Math.min(currentPage * itemsPerPage, filteredActivities.length)}</strong> of <strong className="font-bold text-slate-700 dark:text-slate-305">{filteredActivities.length}</strong> registries
        </span>

        <div className="flex items-center gap-1">
          <AppButton
            id="btn-prev-page"
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((c) => Math.max(1, c - 1))}
            className="px-2.5"
          >
            <ChevronLeft className="h-4 w-4" />
          </AppButton>

          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPage(idx + 1)}
              className={`h-8 w-8 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                currentPage === idx + 1
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {idx + 1}
            </button>
          ))}

          <AppButton
            id="btn-next-page"
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((c) => Math.min(totalPages, c + 1))}
            className="px-2.5"
          >
            <ChevronRight className="h-4 w-4" />
          </AppButton>
        </div>
      </div>
    </div>
  );
};
