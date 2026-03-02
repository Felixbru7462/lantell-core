/**
 * PhotoUpload.tsx — Anchorpoint
 *
 * Reusable photo upload component backed by Supabase Storage.
 *
 * Prerequisites
 * ─────────────
 * 1. Create `src/lib/supabase.ts` (or .js) and export a supabase client:
 *
 *    import { createClient } from '@supabase/supabase-js'
 *    export const supabase = createClient(
 *      import.meta.env.VITE_SUPABASE_URL,
 *      import.meta.env.VITE_SUPABASE_ANON_KEY
 *    )
 *
 * 2. Adjust the import path below if your supabase client lives elsewhere.
 *
 * Usage
 * ─────
 *   <PhotoUpload
 *     bucket="job-photos"
 *     folder={jobId}
 *     maxPhotos={5}
 *     existingUrls={job.photoUrls}
 *     onUploadComplete={(urls) => setJob({ ...job, photoUrls: urls })}
 *   />
 */

import React, {
    useState,
    useCallback,
    useRef,
    useEffect,
    DragEvent,
    ChangeEvent,
  } from 'react';
  import { supabase } from '../lib/supabase';
  
  // ─── Types ───────────────────────────────────────────────────────────────────
  
  export interface PhotoUploadProps {
    /** Storage bucket name, e.g. 'job-photos' */
    bucket: string;
    /** Upload path prefix, e.g. a job id or 'disputes' */
    folder: string;
    /** Maximum total photos (existing + new). Default: 5 */
    maxPhotos?: number;
    /** Called with full array of public URLs after every successful upload batch */
    onUploadComplete: (urls: string[]) => void;
    /** URLs already persisted (shown as read-only thumbnails) */
    existingUrls?: string[];
  }
  
  interface FileItem {
    /** Stable client-side id */
    id: string;
    file: File;
    /** Object URL for preview */
    preview: string;
    /** 0–100 */
    progress: number;
    uploading: boolean;
    uploaded: boolean;
    /** Storage public URL once uploaded */
    url?: string;
    /** Inline error message for this file */
    error?: string;
  }
  
  // ─── Constants ───────────────────────────────────────────────────────────────
  
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
  
  // ─── Tiny spinner via injected keyframe ──────────────────────────────────────
  
  const SPIN_STYLE_ID = 'photo-upload-spin-keyframe';
  
  function ensureSpinKeyframe() {
    if (document.getElementById(SPIN_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = SPIN_STYLE_ID;
    style.textContent = `@keyframes __pu_spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }
  
  // ─── Helpers ─────────────────────────────────────────────────────────────────
  
  function uid(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  
  function validateFile(file: File): string | null {
    if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      return `"${file.name}" is not a supported format (JPG, PNG, WEBP only).`;
    }
    if (file.size > MAX_BYTES) {
      return `"${file.name}" exceeds the 10 MB limit.`;
    }
    return null;
  }
  
  // ─── Sub-components ──────────────────────────────────────────────────────────
  
  interface ThumbnailProps {
    src: string;
    alt: string;
    progress?: number;
    uploading?: boolean;
    uploaded?: boolean;
    error?: string;
    onRemove?: () => void;
  }
  
  function Thumbnail({
    src,
    alt,
    progress = 0,
    uploading = false,
    uploaded = false,
    error,
    onRemove,
  }: ThumbnailProps) {
    return (
      <div
        style={{
          position: 'relative',
          borderRadius: '6px',
          overflow: 'hidden',
          border: `1px solid ${error ? '#FCA5A5' : '#E5E3DF'}`,
          aspectRatio: '1 / 1',
          backgroundColor: '#F3F4F6',
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: uploading ? 0.45 : 1,
            transition: 'opacity 0.15s',
          }}
        />
  
        {/* Upload progress overlay */}
        {uploading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.35)',
              gap: '6px',
            }}
          >
            <div
              style={{
                width: '68%',
                height: '4px',
                backgroundColor: 'rgba(255,255,255,0.25)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: '#2563EB',
                  borderRadius: '2px',
                  transition: 'width 0.15s ease',
                }}
              />
            </div>
            <span
              style={{
                color: '#fff',
                fontSize: '11px',
                fontFamily: 'sans-serif',
                fontWeight: 500,
              }}
            >
              {progress}%
            </span>
          </div>
        )}
  
        {/* Uploaded badge */}
        {uploaded && !uploading && (
          <div
            style={{
              position: 'absolute',
              top: '5px',
              left: '5px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6.5l2.5 2.5 5.5-5.5"
                stroke="#fff"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
  
        {/* Error badge */}
        {error && !uploading && (
          <div
            style={{
              position: 'absolute',
              inset: 'auto 0 0 0',
              padding: '4px 6px',
              backgroundColor: 'rgba(255,255,255,0.93)',
              borderTop: '1px solid #FCA5A5',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                color: '#DC2626',
                fontFamily: 'sans-serif',
                lineHeight: 1.3,
                display: 'block',
              }}
            >
              Upload failed
            </span>
          </div>
        )}
  
        {/* Remove button */}
        {onRemove && !uploading && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remove photo"
            style={{
              position: 'absolute',
              top: '5px',
              right: '5px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0,0,0,0.52)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              lineHeight: 1,
            }}
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path
                d="M1 1l7 7M8 1L1 8"
                stroke="#fff"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    );
  }
  
  // ─── Main component ───────────────────────────────────────────────────────────
  
  export function PhotoUpload({
    bucket,
    folder,
    maxPhotos = 5,
    onUploadComplete,
    existingUrls = [],
  }: PhotoUploadProps) {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [globalError, setGlobalError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
  
    // Inject spin keyframe once on mount
    useEffect(() => {
      ensureSpinKeyframe();
    }, []);
  
    // Revoke preview Object URLs on unmount to avoid memory leaks
    useEffect(() => {
      return () => {
        files.forEach((f) => URL.revokeObjectURL(f.preview));
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  
    // ── File ingestion ─────────────────────────────────────────────────────────
  
    const addFiles = useCallback(
      (incoming: File[]) => {
        setGlobalError('');
  
        const usedSlots = existingUrls.length + files.length;
        const remaining = maxPhotos - usedSlots;
  
        if (remaining <= 0) {
          setGlobalError(
            `You have reached the limit of ${maxPhotos} photo${maxPhotos !== 1 ? 's' : ''}.`
          );
          return;
        }
  
        const inlineErrors: string[] = [];
        const accepted: FileItem[] = [];
        const capped = incoming.slice(0, remaining);
  
        if (incoming.length > remaining) {
          inlineErrors.push(
            `Only ${remaining} slot${remaining !== 1 ? 's' : ''} left — ${
              incoming.length - remaining
            } file${incoming.length - remaining !== 1 ? 's' : ''} ignored.`
          );
        }
  
        for (const file of capped) {
          const err = validateFile(file);
          if (err) {
            inlineErrors.push(err);
          } else {
            accepted.push({
              id: uid(),
              file,
              preview: URL.createObjectURL(file),
              progress: 0,
              uploading: false,
              uploaded: false,
            });
          }
        }
  
        if (inlineErrors.length > 0) setGlobalError(inlineErrors.join(' '));
        if (accepted.length > 0) {
          setFiles((prev) => [...prev, ...accepted]);
        }
      },
      [files, existingUrls, maxPhotos]
    );
  
    // ── Event handlers ─────────────────────────────────────────────────────────
  
    function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
      if (e.target.files) addFiles(Array.from(e.target.files));
      e.target.value = ''; // allow re-selecting the same file
    }
  
    function handleDrop(e: DragEvent<HTMLDivElement>) {
      e.preventDefault();
      setIsDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    }
  
    function handleDragOver(e: DragEvent<HTMLDivElement>) {
      e.preventDefault();
      setIsDragging(true);
    }
  
    function handleDragLeave(e: DragEvent<HTMLDivElement>) {
      e.preventDefault();
      // Only clear when leaving the drop-zone element itself
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setIsDragging(false);
      }
    }
  
    function removeFile(id: string) {
      setFiles((prev) => {
        const target = prev.find((f) => f.id === id);
        if (target) URL.revokeObjectURL(target.preview);
        return prev.filter((f) => f.id !== id);
      });
    }
  
    // ── Upload ─────────────────────────────────────────────────────────────────
  
    async function uploadFiles() {
      const pending = files.filter((f) => !f.uploaded && !f.uploading);
      if (pending.length === 0) return;
  
      setIsUploading(true);
      setGlobalError('');
  
      // Collect URLs as we go so onUploadComplete gets the full set
      const collectedUrls: string[] = [...existingUrls];
  
      // Track which items were already uploaded before this batch
      files
        .filter((f) => f.uploaded && f.url)
        .forEach((f) => collectedUrls.push(f.url!));
  
      for (const item of pending) {
        // Mark uploading
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, uploading: true, error: undefined, progress: 0 } : f
          )
        );
  
        const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${folder}/${Date.now()}-${safeName}`;
  
        try {
          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(path, item.file, {
              cacheControl: '3600',
              upsert: false,
              // @ts-ignore — onUploadProgress exists in supabase-js v2 but
              // may not yet appear in all community type definitions.
              onUploadProgress: (evt: { loaded: number; total: number }) => {
                const pct = Math.round((evt.loaded / evt.total) * 100);
                setFiles((prev) =>
                  prev.map((f) =>
                    f.id === item.id ? { ...f, progress: pct } : f
                  )
                );
              },
            });
  
          if (uploadError) throw uploadError;
  
          const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);
  
          const publicUrl = urlData.publicUrl;
          collectedUrls.push(publicUrl);
  
          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? { ...f, uploading: false, uploaded: true, progress: 100, url: publicUrl }
                : f
            )
          );
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : 'Upload failed. Please try again.';
  
          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? { ...f, uploading: false, progress: 0, error: msg }
                : f
            )
          );
        }
      }
  
      setIsUploading(false);
  
      // Only fire callback when at least one new URL was added
      if (collectedUrls.length > existingUrls.length) {
        onUploadComplete(collectedUrls);
      }
    }
  
    // ── Derived state ──────────────────────────────────────────────────────────
  
    const totalShown = existingUrls.length + files.length;
    const canAddMore = totalShown < maxPhotos;
    const pendingCount = files.filter((f) => !f.uploaded && !f.uploading).length;
    const hasErrors = files.some((f) => f.error);
  
    // ── Render ─────────────────────────────────────────────────────────────────
  
    return (
      <div style={{ fontFamily: 'sans-serif' }}>
  
        {/* ── Drop zone ── */}
        {canAddMore && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Click to select photos or drag and drop here"
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
            }}
            style={{
              border: `1px ${isDragging ? 'solid' : 'dashed'} ${
                isDragging ? '#2563EB' : '#E5E3DF'
              }`,
              borderRadius: '6px',
              padding: '28px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: isDragging ? '#EFF6FF' : '#FAF9F7',
              transition: 'border-color 0.15s, background-color 0.15s',
              userSelect: 'none',
              outline: 'none',
              marginBottom: totalShown > 0 ? '14px' : '0',
            }}
          >
            {/* Upload icon */}
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isDragging ? '#2563EB' : '#9CA3AF'}
              strokeWidth="1.5"
              style={{ display: 'block', margin: '0 auto 8px' }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
  
            <p
              style={{
                margin: '0 0 3px',
                fontSize: '14px',
                fontWeight: 500,
                color: isDragging ? '#2563EB' : '#1A1A1A',
                transition: 'color 0.15s',
              }}
            >
              Click to select or drag photos here
            </p>
            <p
              style={{
                margin: 0,
                fontSize: '12px',
                color: '#6B7280',
              }}
            >
              JPG, PNG, WEBP &mdash; max 10 MB each &nbsp;&middot;&nbsp;{' '}
              {totalShown} / {maxPhotos} photos
            </p>
  
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleInputChange}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
          </div>
        )}
  
        {/* ── Inline global error ── */}
        {globalError && (
          <p
            role="alert"
            style={{
              margin: '8px 0 10px',
              fontSize: '13px',
              color: '#DC2626',
              lineHeight: 1.45,
            }}
          >
            {globalError}
          </p>
        )}
  
        {/* ── Thumbnail grid ── */}
        {totalShown > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
              gap: '8px',
              marginBottom: pendingCount > 0 ? '14px' : '0',
            }}
          >
            {/* Already-persisted photos (read-only) */}
            {existingUrls.map((url, i) => (
              <Thumbnail
                key={url}
                src={url}
                alt={`Existing photo ${i + 1}`}
                uploaded
              />
            ))}
  
            {/* Newly selected files */}
            {files.map((item) => (
              <Thumbnail
                key={item.id}
                src={item.preview}
                alt={item.file.name}
                progress={item.progress}
                uploading={item.uploading}
                uploaded={item.uploaded}
                error={item.error}
                onRemove={!item.uploading && !item.uploaded ? () => removeFile(item.id) : undefined}
              />
            ))}
          </div>
        )}
  
        {/* ── Upload / retry button ── */}
        {(pendingCount > 0 || hasErrors) && (
          <button
            onClick={uploadFiles}
            disabled={isUploading || pendingCount === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              backgroundColor:
                isUploading || pendingCount === 0 ? '#BFDBFE' : '#2563EB',
              color: isUploading || pendingCount === 0 ? '#1E40AF' : '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 18px',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'sans-serif',
              cursor:
                isUploading || pendingCount === 0 ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
              lineHeight: 1,
            }}
          >
            {isUploading ? (
              <>
                {/* Spinner */}
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 13 13"
                  fill="none"
                  style={{
                    animation: '__pu_spin 0.75s linear infinite',
                    flexShrink: 0,
                  }}
                >
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                  <path
                    d="M6.5 1.5A5 5 0 0111.5 6.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Uploading&hellip;
              </>
            ) : hasErrors && pendingCount === 0 ? (
              'All uploads failed — check errors'
            ) : (
              <>
                {/* Arrow-up icon */}
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 13 13"
                  fill="none"
                  style={{ flexShrink: 0 }}
                >
                  <path
                    d="M6.5 10.5V2.5m0 0L3 6m3.5-3.5L10 6"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Upload {pendingCount} photo{pendingCount !== 1 ? 's' : ''}
              </>
            )}
          </button>
        )}
      </div>
    );
  }
  
  export default PhotoUpload;