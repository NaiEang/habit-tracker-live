import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function AvatarUpload({ user }) {
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const fileInputRef = useRef(null)

  // 1 MB size limit in bytes
  const MAX_FILE_SIZE = 1 * 1024 * 1024

  // ============================================================
  // Render existing avatar on mount (from profiles.avatar_url)
  // ============================================================
  useEffect(() => {
    let isMounted = true

    async function loadProfileAvatar() {
      if (!user?.id) {
        setLoadingInitial(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .maybeSingle()

        if (error) {
          console.warn('Could not load avatar profile:', error.message)
        } else if (data?.avatar_url && isMounted) {
          setAvatarUrl(data.avatar_url)
        }
      } catch (err) {
        console.warn('Error fetching avatar on mount:', err)
      } finally {
        if (isMounted) setLoadingInitial(false)
      }
    }

    loadProfileAvatar()

    return () => {
      isMounted = false
    }
  }, [user?.id])

  // Clean up object URL when component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // ============================================================
  // Hand-written Client-side Validation & Preview Generation
  // ============================================================
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Clear previous feedback
    setErrorMessage(null)
    setSuccessMessage(null)

    // Guard 1: Validate file type (must be image)
    if (!file.type.startsWith('image/')) {
      setErrorMessage(
        `Rejected: "${file.name}" is not an image (${file.type || 'unknown type'}). Please choose an image file (PNG, JPG, WebP, GIF).`
      )
      // Reset input value so user can select again
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Guard 2: Validate file size (<= 1 MB)
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
      setErrorMessage(
        `Rejected: File size is ${sizeMB} MB. Maximum allowed size is 1.00 MB.`
      )
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Revoke previous object URL if any
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    // Generate local preview using URL.createObjectURL
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    setSelectedFile(file)
  }

  // Cancel the preview state
  const handleCancelPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setSelectedFile(null)
    setErrorMessage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ============================================================
  // Upload to Supabase Storage with upsert: true and save to profiles
  // ============================================================
  const handleUpload = async () => {
    if (!selectedFile || !user?.id || uploading) return

    setUploading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const fileExt = selectedFile.name.split('.').pop() || 'png'
      // Path format: <auth.uid()>/avatar.<ext> to satisfy storage RLS folder policy
      const filePath = `${user.id}/avatar.${fileExt}`

      // 1. Upload to public 'avatars' bucket with upsert: true (replaces existing file, no duplicates)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        throw uploadError
      }

      // 2. Retrieve public URL
      const { data: publicData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Add a timestamp query param to bust browser cache on replacement
      const cacheBustedUrl = `${publicData.publicUrl}?t=${Date.now()}`

      // 3. Save / Upsert to profiles.avatar_url
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          avatar_url: cacheBustedUrl,
          updated_at: new Date().toISOString()
        })

      if (profileError) {
        throw profileError
      }

      // 4. Update local state
      setAvatarUrl(cacheBustedUrl)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      setSelectedFile(null)
      setSuccessMessage('✓ Avatar successfully uploaded and saved!')
      if (fileInputRef.current) fileInputRef.current.value = ''

      setTimeout(() => setSuccessMessage(null), 3500)
    } catch (err) {
      console.error('Error uploading avatar:', err)
      setErrorMessage(`Upload failed: ${err.message || 'Make sure storage bucket and RLS policies are created.'}`)
    } finally {
      setUploading(false)
    }
  }

  const currentDisplayImage = previewUrl || avatarUrl

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      background: 'rgba(22, 27, 34, 0.7)',
      padding: '16px 20px',
      borderRadius: 14,
      border: '1px solid var(--border-color)',
      maxWidth: 480
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Avatar circle / image */}
        <div style={{
          position: 'relative',
          width: 58,
          height: 58,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(62, 207, 142, 0.2), rgba(88, 166, 255, 0.2))',
          border: previewUrl ? '2px dashed var(--accent-amber)' : '2px solid var(--brand-green)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: previewUrl ? '0 0 14px rgba(227, 179, 65, 0.4)' : '0 0 12px rgba(62, 207, 142, 0.25)'
        }}>
          {currentDisplayImage ? (
            <img
              src={currentDisplayImage}
              alt="User Avatar"
              loading="lazy"
              width="58"
              height="58"
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: '1.4rem' }}>👤</span>
          )}

          {previewUrl && (
            <span style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(227, 179, 65, 0.85)',
              color: '#000',
              fontSize: '0.55rem',
              fontWeight: 800,
              textAlign: 'center',
              textTransform: 'uppercase',
              padding: '1px 0'
            }}>
              Preview
            </span>
          )}
        </div>

        {/* Info & action buttons */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Profile Avatar
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              (Max 1 MB &bull; Images only)
            </span>
          </div>

          <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            {!previewUrl ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                📁 Choose Image...
              </button>
            ) : (
              /* Preview state action buttons */
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="btn btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                >
                  {uploading ? 'Uploading...' : '✓ Confirm Upload'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelPreview}
                  disabled={uploading}
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#ff7b72' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear Inline Error for Rejected Files */}
      {errorMessage && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(248, 81, 73, 0.15)',
          border: '1px solid rgba(248, 81, 73, 0.4)',
          borderRadius: 8,
          fontSize: '0.8rem',
          color: '#ff7b72',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8
        }}>
          <span>⚠️ {errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            style={{ background: 'transparent', border: 'none', color: '#ff7b72', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Preview Notification Banner */}
      {previewUrl && (
        <div style={{
          padding: '6px 10px',
          background: 'rgba(227, 179, 65, 0.12)',
          border: '1px solid rgba(227, 179, 65, 0.35)',
          borderRadius: 6,
          fontSize: '0.75rem',
          color: '#e3b341',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <span>🔍</span>
          <span>
            <strong>Previewing:</strong> {selectedFile?.name} ({(selectedFile?.size / 1024).toFixed(1)} KB). Click "Confirm Upload" to persist to Supabase.
          </span>
        </div>
      )}

      {/* Success Notification */}
      {successMessage && (
        <div style={{
          padding: '6px 10px',
          background: 'rgba(62, 207, 142, 0.12)',
          border: '1px solid rgba(62, 207, 142, 0.35)',
          borderRadius: 6,
          fontSize: '0.75rem',
          color: 'var(--brand-green)'
        }}>
          {successMessage}
        </div>
      )}
    </div>
  )
}
