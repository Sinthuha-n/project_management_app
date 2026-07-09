'use client';
import React from 'react';
import { Download, Trash2, FileText, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import type { TaskAttachment } from '@/services/task-attachments-service';

// Uses aria-hidden because the icon is decorative — the file name in the adjacent text already describes the attachment
const AttachmentIcon = ({ contentType }: { contentType: string }) => {
  if (contentType.startsWith('image/')) return <ImageIcon size={18} className="text-purple-500 shrink-0" aria-hidden="true" />;
  if (contentType === 'application/pdf') return <FileText size={18} className="text-red-500 shrink-0" aria-hidden="true" />;
  return <FileIcon size={18} className="text-blue-500 shrink-0" aria-hidden="true" />;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

interface AttachmentsPanelProps {
  attachments: TaskAttachment[];
  onRemove: (id: number) => Promise<void>;
  readOnly?: boolean;
}

const AttachmentsPanel: React.FC<AttachmentsPanelProps> = ({ attachments, onRemove, readOnly = false }) => {
  if (attachments.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-bold text-cu-text-primary mb-3">Attachments</h3>
      <div className="space-y-2">
        {attachments.map((att) => (
          <div key={att.id} className="flex items-center gap-3 p-2.5 border border-cu-border rounded-lg hover:bg-cu-hover transition-colors group">
            <AttachmentIcon contentType={att.contentType} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cu-text-primary truncate">{att.fileName}</p>
              <p className="text-xs text-cu-text-muted">{formatFileSize(att.fileSize)} · {att.uploadedByName}</p>
            </div>
            <a
              href={att.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded hover:bg-cu-primary/10 text-cu-text-muted hover:text-cu-primary transition-colors"
              title="Download"
            >
              <Download size={14} />
            </a>
            {!readOnly && (
              <button
                onClick={() => onRemove(att.id)}
                className="p-1.5 rounded hover:bg-cu-danger/10 text-cu-text-muted hover:text-cu-danger transition-colors opacity-0 group-hover:opacity-100"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttachmentsPanel;
