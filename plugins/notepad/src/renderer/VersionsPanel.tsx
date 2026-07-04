import { useEffect, useState } from 'react';
import type { RecordVersion, VersionMeta } from '@nib/plugin-api';

export interface VersionsPanelProps {
  recordId: string;
  onRestore(versionId: number): void;
  onClose(): void;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VersionsPanel({ recordId, onRestore, onClose }: VersionsPanelProps) {
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [preview, setPreview] = useState<RecordVersion>();

  useEffect(() => {
    if (!window.nib) return;
    void window.nib.records.listVersions(recordId).then(setVersions);
  }, [recordId]);

  const openPreview = (versionId: number) => {
    if (!window.nib) return;
    void window.nib.records.getVersion(versionId).then(setPreview);
  };

  return (
    <aside className="nib-versions">
      <div className="nib-versions-header">
        <span>Version history</span>
        <button onClick={onClose}>×</button>
      </div>
      {versions.length === 0 && (
        <div className="nib-versions-empty">
          No snapshots yet — versions appear as the note is edited over time.
        </div>
      )}
      <div className="nib-versions-list">
        {versions.map((version) => (
          <button
            key={version.id}
            className="nib-versions-item"
            data-active={preview?.id === version.id}
            onClick={() => openPreview(version.id)}
          >
            {formatTime(version.createdAt)}
          </button>
        ))}
      </div>
      {preview && (
        <div className="nib-versions-preview">
          <div className="nib-versions-preview-title">{preview.title || 'Untitled'}</div>
          <pre>{preview.bodyMd}</pre>
          <button className="nib-versions-restore" onClick={() => onRestore(preview.id)}>
            Restore this version
          </button>
        </div>
      )}
    </aside>
  );
}
