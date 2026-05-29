/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  Search,
  Plus,
  Tag,
  Download,
  Eye,
  Trash2,
  UploadCloud,
  FileCode,
  ShieldCheck,
  Calendar,
  Layers,
  FileCheck,
} from 'lucide-react';
import { AppCard } from '../components/AppCard';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { AppDropdown } from '../components/AppDropdown';
import { AppModal } from '../components/AppModal';
import { AppTable } from '../components/AppTable';
import { DocumentItem } from '../types';

interface DocumentsFeatureProps {
  id: string;
  initialDocuments: DocumentItem[];
}

export const DocumentsFeature: React.FC<DocumentsFeatureProps> = ({ id, initialDocuments }) => {
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [selectedTag, setSelectedTag] = useState<string>('All');

  // Preview document modal
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFolder, setUploadFolder] = useState('ROPA');
  const [uploadType, setUploadType] = useState<'PDF' | 'DOCX'>('PDF');
  const [uploadTags, setUploadTags] = useState('Article-30, Q2-Report');

  const foldersList = ['All', 'ROPA', 'Privacy Policies', 'DPIA Reports', 'Audit Evidence'];

  // Compute all tags dynamically
  const tagsList = useMemo(() => {
    const sets = new Set<string>();
    documents.forEach((doc) => doc.tags.forEach((t) => sets.add(t)));
    return ['All', ...Array.from(sets)];
  }, [documents]);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesFolder = selectedFolder === 'All' || doc.folder === selectedFolder;
      const matchesTag = selectedTag === 'All' || doc.tags.includes(selectedTag);

      return matchesSearch && matchesFolder && matchesTag;
    });
  }, [documents, searchQuery, selectedFolder, selectedTag]);

  // Execute upload
  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadName.trim()) return;

    const parsedTags = uploadTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const newDoc: DocumentItem = {
      id: `DOC-${Math.floor(Math.random() * 900) + 200}`,
      name: uploadName.endsWith('.pdf') || uploadName.endsWith('.docx') ? uploadName : `${uploadName}.${uploadType.toLowerCase()}`,
      type: uploadType,
      folder: uploadFolder,
      size: `${(Math.random() * 2 + 0.2).toFixed(1)} MB`,
      createdOn: new Date().toISOString().split('T')[0],
      version: '1.0',
      tags: parsedTags,
      owner: 'Liam Sterling',
    };

    setDocuments((prev) => [newDoc, ...prev]);
    setIsUploadOpen(false);

    // Reset fields
    setUploadName('');
    setUploadTags('Article-30, Q2-Report');
  };

  const handleDeleteDoc = (id: string) => {
    if (confirm('Discard this audited compliance document? This is tracked inside system logs.')) {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    }
  };

  return (
    <div id={id} className="space-y-6">
      {/* Top action header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Document Repository & Evidence Locker
          </h2>
          <p className="text-xs text-slate-500">
            Tamper-proof storage hosting dynamic policy statements, signed DPIA impact assessments, and regulatory audits records.
          </p>
        </div>

        <AppButton
          id="btn-upload-trigger"
          variant="primary"
          size="sm"
          className="h-9"
          onClick={() => setIsUploadOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Deposit Document
        </AppButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Folders and Filters sidebar (lg:col-span-3) */}
        <div className="col-span-1 lg:col-span-3 space-y-4">
          {/* Folders block */}
          <AppCard id="doc-folders-card" title="Audited Folders">
            <div className="space-y-1.5">
              {foldersList.map((folder) => {
                const isSelected = selectedFolder === folder;
                const count = folder === 'All' ? documents.length : documents.filter((d) => d.folder === folder).length;

                return (
                  <button
                    key={folder}
                    onClick={() => setSelectedFolder(folder)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold select-none cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-600/10 text-indigo-400 border-l-[3px] border-indigo-500 font-extrabold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850/40'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isSelected ? <FolderOpen className="h-4.5 w-4.5 text-indigo-400" /> : <Folder className="h-4.5 w-4.5 text-slate-400" />}
                      {folder}
                    </span>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 rounded-sm font-bold text-slate-400 dark:text-slate-500">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </AppCard>

          {/* Tags Cloud block */}
          <AppCard id="doc-tags-card" title="Compliance Tags">
            <div className="flex flex-wrap gap-1.5">
              {tagsList.map((tag) => {
                const isSelected = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-sm border transition-colors cursor-pointer capitalize ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white font-extrabold'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-550 dark:text-slate-400 hover:bg-slate-50/50'
                    }`}
                  >
                    {tag === 'All' ? 'All Tags' : tag}
                  </button>
                );
              })}
            </div>
          </AppCard>
        </div>

        {/* Right Files Registry Table (lg:col-span-9) */}
        <div className="col-span-1 lg:col-span-9 space-y-4">
          {/* Active search panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-201 dark:border-slate-800 rounded-xl p-4 shadow-xs">
            <AppTextField
              id="search-documents"
              placeholder="Search documents by name, signature owner, auditing tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>

          <AppTable<DocumentItem>
            id="documents-ledger-table"
            columns={[
              {
                key: 'name',
                header: 'DOCUMENT FILENAME',
                render: (row) => (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/40 dark:border-slate-800 rounded-lg text-slate-400 flex-shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                        {row.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold font-mono text-indigo-605 dark:text-indigo-400">
                          {row.type} Format
                        </span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span className="text-[10px] text-slate-450 font-medium">
                          {row.size}
                        </span>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'folder',
                header: 'FOLDER',
                render: (row) => (
                  <span className="text-xs font-semibold px-2 py-1 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 rounded-lg border border-slate-100 dark:border-slate-800">
                    {row.folder}
                  </span>
                ),
              },
              {
                key: 'version',
                header: 'VER',
                render: (row) => (
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    v{row.version}
                  </span>
                ),
              },
              {
                key: 'tags',
                header: 'CLASSIFICATION TAGS',
                render: (row) => (
                  <div className="flex flex-wrap gap-1 max-w-[240px]">
                    {row.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] px-1.5 py-0.5 rounded-sm font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-950 text-slate-400 dark:text-slate-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ),
              },
              {
                key: 'createdOn',
                header: 'DEPOSITED',
                render: (row) => (
                  <div className="text-xs">
                    <p className="font-bold text-slate-800 dark:text-slate-350">{row.createdOn}</p>
                    <span className="text-[10px] text-slate-400 font-mono">By: {row.owner.split(' ')[0]}</span>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: '',
                render: (row) => (
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => setPreviewDoc(row)}
                      className="p-1.5 text-slate-400 hover:text-indigo-505 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg transition-colors"
                      title="Inspect metadata profile"
                    >
                      <Eye className="h-4.5 w-4.5" />
                    </button>
                    <a
                      href="#download"
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`Dispatched secure server stream. Downloading file: ${row.name}`);
                      }}
                      className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg transition-colors"
                      title="Request download trigger"
                    >
                      <Download className="h-4.5 w-4.5" />
                    </a>
                    <button
                      onClick={() => handleDeleteDoc(row.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg transition-colors"
                      title="Discard document from index"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>
                ),
              },
            ]}
            data={filteredDocs}
          />
        </div>
      </div>

      {/* Preview Modal Dialog */}
      <AppModal
        id="preview-doc-modal"
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title="Inspect Compliance Document Profile"
        maxWidth="md"
        footer={
          <AppButton id="btn-close-pre" variant="secondary" size="sm" onClick={() => setPreviewDoc(null)}>
            Dismiss Inspect
          </AppButton>
        }
      >
        {previewDoc && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center gap-3 border border-slate-800">
              <div className="p-2.5 bg-slate-800 rounded-lg text-indigo-400">
                <FileCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold truncate">{previewDoc.name}</h4>
                <p className="text-[10px] text-slate-500 font-mono">ID: {previewDoc.id} | TLS encrypted v1.3</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Audited Locker Folder</span>
                <p className="font-bold text-slate-800 dark:text-slate-205 mt-1">{previewDoc.folder}</p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Authorized Owner</span>
                <p className="font-bold text-slate-800 dark:text-slate-205 mt-1">{previewDoc.owner}</p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Locker Size</span>
                <p className="font-bold text-slate-805 dark:text-slate-205 mt-1">{previewDoc.size}</p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Version Index</span>
                <p className="font-bold text-indigo-550 dark:text-indigo-400 mt-1">v{previewDoc.version}</p>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-250/20 rounded-lg flex gap-3 text-xs text-emerald-800 dark:text-emerald-400 leading-snug">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="block mb-0.5">Integrity Seals Confirmed ✓</strong>
                The cryptographic hash of this documentation is logged inside the blockchain ledger. Unaltered regulatory backup verified.
              </div>
            </div>
          </div>
        )}
      </AppModal>

      {/* Upload Document Modal Dialog */}
      <AppModal
        id="upload-doc-modal"
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Deposit Document to Evidence Locker"
        maxWidth="md"
        footer={
          <div className="flex gap-2">
            <AppButton id="btn-cancel-up" variant="ghost" size="sm" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </AppButton>
            <AppButton id="btn-submit-up" variant="primary" size="sm" onClick={handleUploadSubmit}>
              Archive Evidence
            </AppButton>
          </div>
        }
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <AppTextField
            id="upload-name-input"
            label="Audit Document Name"
            placeholder="e.g. Q2_Internal_GDPR_ROPA_Audit"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <AppDropdown
              id="upload-folder-input"
              label="Audited Locker Folder"
              items={[
                { value: 'ROPA', label: 'ROPA Registries Documents' },
                { value: 'Privacy Policies', label: 'Privacy Policies' },
                { value: 'DPIA Reports', label: 'DPIA Reports' },
                { value: 'Audit Evidence', label: 'Audit Evidence Records' },
              ]}
              value={uploadFolder}
              onChange={(e) => setUploadFolder(e.target.value)}
            />

            <AppDropdown
              id="upload-type-input"
              label="Format Type"
              items={[
                { value: 'PDF', label: 'PDF Format (.pdf)' },
                { value: 'DOCX', label: 'DOCX Format (.docx)' },
              ]}
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as any)}
            />
          </div>

          <AppTextField
            id="upload-tags-input"
            label="Auditing tags (comma-separated)"
            placeholder="e.g. Legal, Article-30, Draft Statement"
            value={uploadTags}
            onChange={(e) => setUploadTags(e.target.value)}
          />

          {/* Secure drag block simulation */}
          <div className="p-6 border-2 border-dashed border-slate-205 dark:border-slate-800 rounded-xl text-center bg-slate-50/50 dark:bg-slate-955/20 flex flex-col items-center">
            <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
            <span className="text-xs text-slate-600 dark:text-slate-350 font-bold block">Drag and drop file backup here</span>
            <span className="text-[10px] text-slate-400 block mt-1">Accepting PDF or DOCX up to 45 MB</span>
          </div>
        </form>
      </AppModal>
    </div>
  );
};
