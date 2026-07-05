import { useEffect, useState } from 'react';
import type { RecordVersion, VersionMeta } from '@nib/plugin-api';
import { Icon } from '@nib/shell';

export interface VersionsPanelProps {
  recordId: string;
  onRestore(versionId: number): void;
  onClose(): void;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return sameDay
    ? time
    : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${time}`;
}

const styles = `
.nib-versions {
  width: 280px;
  flex: none;
  border-left: 1px solid rgba(30, 25, 18, 0.08);
  background: #F5F1E9;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.nib-versions-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid rgba(30, 25, 18, 0.07);
  font-size: 13px;
  font-weight: 700;
  color: #26221D;
}
.nib-versions-header .nib-versions-close {
  margin-left: auto;
  border: none;
  background: transparent;
  font-size: 15px;
  color: #8A8171;
  cursor: default;
}
.nib-versions-empty { padding: 16px 18px; font-size: 12px; color: #8A8171; line-height: 1.5; }
.nib-versions-timeline {
  flex: 1;
  overflow-y: auto;
  padding: 16px 8px 16px 18px;
  position: relative;
}
.nib-versions-line {
  position: absolute;
  left: 23px;
  top: 22px;
  bottom: 16px;
  width: 1.5px;
  background: rgba(30, 25, 18, 0.12);
}
.nib-versions-node {
  position: relative;
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0 6px 18px 20px;
  cursor: default;
}
.nib-versions-node::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #C3BBAD;
  border: 2.5px solid #F5F1E9;
}
.nib-versions-node[data-active='true']::before { background: #BF6B44; }
.nib-versions-node[data-latest='true']::before { background: #26221D; }
.nib-versions-node-label { font-size: 12.5px; font-weight: 600; color: #26221D; }
.nib-versions-node-time {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10.5px;
  color: #9B948A;
}
.nib-versions-preview {
  border-top: 1px solid rgba(30, 25, 18, 0.08);
  padding: 12px 16px 14px;
  max-height: 44%;
  overflow-y: auto;
}
.nib-versions-preview-title { font-size: 12.5px; font-weight: 700; margin-bottom: 6px; }
.nib-versions-preview pre {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  white-space: pre-wrap;
  color: #6B655C;
  background: #FBFAF7;
  border: 1px solid rgba(30, 25, 18, 0.08);
  border-radius: 8px;
  padding: 8px 10px;
  margin: 0 0 8px;
}
.nib-versions-restore {
  width: 100%;
  border: none;
  background: #BF6B44;
  color: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 8px 0;
  border-radius: 8px;
  cursor: default;
}
`;

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
      <style>{styles}</style>
      <div className="nib-versions-header">
        <Icon name="history" size={15} />
        <span>Version history</span>
        <button className="nib-versions-close" onClick={onClose}>
          ×
        </button>
      </div>
      {versions.length === 0 ? (
        <div className="nib-versions-empty">
          No snapshots yet — versions appear as the note is edited over time.
        </div>
      ) : (
        <div className="nib-versions-timeline">
          <div className="nib-versions-line" />
          {versions.map((version, index) => (
            <button
              key={version.id}
              className="nib-versions-node"
              data-active={preview?.id === version.id}
              data-latest={index === 0}
              onClick={() => openPreview(version.id)}
            >
              <div className="nib-versions-node-label">
                {index === 0 ? 'Latest snapshot' : `Snapshot ${versions.length - index}`}
              </div>
              <div className="nib-versions-node-time">{formatTime(version.createdAt)}</div>
            </button>
          ))}
        </div>
      )}
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
