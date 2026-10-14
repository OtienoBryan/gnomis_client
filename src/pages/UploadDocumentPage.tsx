import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Folder, FolderPlus, ChevronRight, Home, ArrowLeft, UploadCloud, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchWithAuth } from '../utils/fetchWithAuth';

interface FolderItem {
  id: number;
  name: string;
  parent_folder_id: number | null;
}

interface CategoryItem {
  id: number;
  name: string;
}

const FALLBACK_CATEGORIES = ['Contract', 'Agreement', 'Other'];

const UploadDocumentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const staffId = searchParams.get('staff_id');
  const staffName = searchParams.get('staff_name');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES);

  // Folder browser: the document is saved into the folder you are currently inside (null = root)
  const [folderPath, setFolderPath] = useState<FolderItem[]>([]);
  const [subfolders, setSubfolders] = useState<FolderItem[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentFolder = folderPath.length > 0 ? folderPath[folderPath.length - 1] : null;
  const locationLabel = ['Root', ...folderPath.map((f) => f.name)].join(' / ');

  useEffect(() => {
    fetchWithAuth('/api/document-categories')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: CategoryItem[]) => {
        if (Array.isArray(data) && data.length > 0) setCategories(data.map((c) => c.name));
      })
      .catch(() => { /* keep the fallback categories */ });
  }, []);

  const loadSubfolders = async (parentId: number | null) => {
    setFoldersLoading(true);
    setFolderError(null);
    try {
      const res = await fetchWithAuth(`/api/document-folders?parent_folder_id=${parentId === null ? 'null' : parentId}`);
      if (!res.ok) throw new Error('Failed to load folders');
      const data = await res.json();
      setSubfolders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setSubfolders([]);
      setFolderError(err.message || 'Failed to load folders');
    } finally {
      setFoldersLoading(false);
    }
  };

  useEffect(() => {
    if (!staffId) loadSubfolders(currentFolder ? currentFolder.id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolder?.id, staffId]);

  const openFolder = (folder: FolderItem) => setFolderPath((path) => [...path, folder]);
  const goToLevel = (level: number) => setFolderPath((path) => path.slice(0, level)); // 0 = root

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setCreatingFolder(true);
    setFolderError(null);
    try {
      const res = await fetchWithAuth('/api/document-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent_folder_id: currentFolder ? currentFolder.id : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to create folder');
      setNewFolderName('');
      openFolder(data as FolderItem); // step into the new folder so the document lands in it
    } catch (err: any) {
      setFolderError(err.message || 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);
    if (!title.trim() || !category || !file) {
      setError('Title, category, and file are required.');
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('category', category);
    formData.append('file', file);
    formData.append('description', description);

    try {
      let res: Response;
      if (staffId) {
        // Employee document (unchanged behaviour)
        res = await fetchWithAuth(`/api/staff/${staffId}/documents`, { method: 'POST', body: formData });
      } else {
        // General document: optional expiry date and the chosen folder
        if (expiryDate) formData.append('end_date', expiryDate);
        if (currentFolder) formData.append('parent_folder_id', String(currentFolder.id));
        res = await fetchWithAuth('/api/documents', { method: 'POST', body: formData });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to upload document');
      }
      setSuccess(staffId ? 'Document uploaded successfully!' : `Document uploaded to ${locationLabel}`);
      setTitle('');
      setFile(null);
      setDescription('');
      setExpiryDate('');
      const fileInput = document.getElementById('upload-file-input') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-red-500 focus:border-transparent';
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1';

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
              <UploadCloud className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {staffId && staffName ? `Upload Document for ${staffName}` : 'Upload Document'}
              </h1>
              <p className="text-xs text-gray-500">Files are stored securely in Cloudinary</p>
            </div>
          </div>
          {!staffId && (
            <button
              type="button"
              onClick={() => navigate('/document-list')}
              className="text-xs text-red-600 hover:underline"
            >
              View all documents
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" /> {success}
            </div>
          )}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Title <span className="text-red-500">*</span></label>
              <input type="text" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} disabled={loading} />
            </div>
            <div>
              <label className={labelCls}>Category <span className="text-red-500">*</span></label>
              <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} disabled={loading}>
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {!staffId && (
            <div>
              <label className={labelCls}>Folder</label>
              <div className="border border-gray-200 rounded-md">
                {/* Breadcrumb: click a level to jump back to it */}
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center flex-wrap gap-1 text-xs">
                  <button type="button" onClick={() => goToLevel(0)} className="flex items-center gap-1 text-red-600 hover:underline">
                    <Home className="h-3 w-3" /> Root
                  </button>
                  {folderPath.map((f, i) => (
                    <React.Fragment key={f.id}>
                      <ChevronRight className="h-3 w-3 text-gray-400" />
                      <button
                        type="button"
                        onClick={() => goToLevel(i + 1)}
                        className={i === folderPath.length - 1 ? 'font-semibold text-gray-900' : 'text-red-600 hover:underline'}
                      >
                        {f.name}
                      </button>
                    </React.Fragment>
                  ))}
                  {folderPath.length > 0 && (
                    <button
                      type="button"
                      onClick={() => goToLevel(folderPath.length - 1)}
                      className="ml-auto flex items-center gap-1 text-gray-600 hover:text-gray-900"
                    >
                      <ArrowLeft className="h-3 w-3" /> Up
                    </button>
                  )}
                </div>

                {/* Subfolders of the current level */}
                <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                  {foldersLoading ? (
                    <p className="px-3 py-3 text-xs text-gray-500">Loading folders...</p>
                  ) : subfolders.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-gray-500">No folders here. Create one below, or upload to this location.</p>
                  ) : (
                    subfolders.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => openFolder(f)}
                        className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm text-gray-800 hover:bg-red-50"
                      >
                        <Folder className="h-4 w-4 text-amber-500" />
                        <span className="flex-1 truncate">{f.name}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                    ))
                  )}
                </div>

                {/* New folder inside the current level (folders can nest to any depth) */}
                <div className="px-3 py-2 border-t border-gray-200 flex items-center gap-2">
                  <FolderPlus className="h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateFolder();
                      }
                    }}
                    placeholder={currentFolder ? `New folder inside "${currentFolder.name}"` : 'New folder at the top level'}
                    className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-red-500 focus:border-transparent"
                    disabled={creatingFolder || loading}
                  />
                  <button
                    type="button"
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim() || creatingFolder || loading}
                    className="px-3 py-1.5 text-xs rounded-md bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingFolder ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
              {folderError && <p className="mt-1 text-xs text-red-600">{folderError}</p>}
              <p className="mt-1 text-xs text-gray-500">
                The document will be saved in: <span className="font-medium text-gray-800">{locationLabel}</span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>File <span className="text-red-500">*</span></label>
              <input
                id="upload-file-input"
                type="file"
                className={inputCls}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={loading}
              />
            </div>
            {!staffId && (
              <div>
                <label className={labelCls}>Expiry date <span className="text-gray-400">(optional)</span></label>
                <input
                  type="date"
                  className={inputCls}
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              className={inputCls}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              className="px-5 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Uploading...' : 'Upload'}
            </button>
            <button
              type="button"
              className="px-5 py-2 rounded-md text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300"
              onClick={() => navigate(-1)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadDocumentPage;
