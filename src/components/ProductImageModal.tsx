import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

interface Props {
  product: { id: number; product_name: string; image_url?: string } | null;
  onClose: () => void;
  onUploaded: (productId: number, imageUrl: string) => void;
}

const MAX_SIZE_MB = 5;

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const ProductImageModal: React.FC<Props> = ({ product, onClose, onUploaded }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const productId = product?.id;

  // Reset whenever a different product is opened
  useEffect(() => {
    setFile(null);
    setError(null);
    setDragOver(false);
    setUploading(false);
  }, [productId]);

  // Local preview of the chosen file
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!product) return null;

  const chooseFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, WebP or GIF).');
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`The image is too large. The maximum size is ${MAX_SIZE_MB} MB.`);
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    chooseFile(e.dataTransfer.files?.[0]);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Choose an image first.');
      return;
    }
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await axios.post(`/api/financial/products/${product.id}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        onUploaded(product.id, res.data.url);
        onClose();
      } else {
        setError(res.data?.error || 'Failed to upload image');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const shownImage = preview || product.image_url || null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={uploading ? undefined : onClose}>
      <form
        onSubmit={handleUpload}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-lg w-full max-w-md"
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">{product.image_url ? 'Change Image' : 'Upload Image'}</h2>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{product.product_name}</p>
        </div>

        <div className="px-5 py-4">
          <div
            onDragOver={e => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed transition-colors text-center ${
              dragOver ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'
            } ${shownImage ? 'p-3' : 'py-10 px-4'}`}
          >
            {shownImage ? (
              <img src={shownImage} alt={product.product_name} className="mx-auto max-h-56 rounded-lg object-contain" />
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">Drag and drop an image here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                chooseFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 min-h-[1rem]">
            {file ? (
              <>
                <span className="truncate mr-2">
                  {file.name} · {formatSize(file.size)}
                </span>
                <button type="button" onClick={() => setFile(null)} className="text-red-600 hover:text-red-800 font-medium whitespace-nowrap">
                  Remove
                </button>
              </>
            ) : (
              <span>{product.image_url ? 'Current image shown. Choose a new one to replace it.' : `JPG, PNG, WebP or GIF, up to ${MAX_SIZE_MB} MB.`}</span>
            )}
          </div>

          {error && <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading || !file}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductImageModal;
