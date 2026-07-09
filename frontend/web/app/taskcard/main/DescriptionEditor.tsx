'use client';
import React, { useEffect, useState } from 'react';
import { Edit2 } from 'lucide-react';

interface DescriptionEditorProps {
  description: string;
  onUpdateDescription?: (description: string) => void;
  readOnly?: boolean;
}

const DescriptionEditor: React.FC<DescriptionEditorProps> = ({ description, onUpdateDescription, readOnly = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [edited, setEdited] = useState(description);

  // Sync local edit buffer when the description changes from outside (e.g. parent re-fetch after another user edits)
  useEffect(() => {
    setEdited(description);
  }, [description]);

  const handleSave = () => {
    if (edited !== description) {
      onUpdateDescription?.(edited);
    }
    setIsEditing(false);
  };

  return (
    <div className="mb-8 group">
      <h3 className="text-sm font-bold text-cu-text-primary mb-2">Description</h3>
      {isEditing ? (
        <div>
          <textarea
            value={edited ?? ''}
            onChange={(e) => setEdited(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEdited(description);
                setIsEditing(false);
              }
            }}
            autoFocus
            rows={6}
            className="w-full p-4 rounded-xl border-2 border-cu-primary text-cu-text-secondary text-sm leading-relaxed focus:outline-none resize-y bg-cu-bg shadow-cu-sm"
            placeholder="Add a description..."
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-cu-primary text-white text-sm font-semibold rounded-xl hover:bg-cu-primary-hover transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setEdited(description); setIsEditing(false); }}
              className="px-3 py-1.5 bg-cu-bg-secondary text-cu-text-primary text-sm font-semibold rounded-xl hover:bg-cu-bg-tertiary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !readOnly && onUpdateDescription && setIsEditing(true)}
          className={`p-4 rounded-xl border border-cu-border transition-all min-h-[112px] text-cu-text-secondary text-sm leading-relaxed relative bg-cu-bg ${readOnly || !onUpdateDescription ? '' : 'hover:bg-cu-hover hover:border-cu-primary/30 cursor-text'}`}
        >
          {description || <span className="text-cu-text-muted italic">No description provided</span>}
          {!readOnly && onUpdateDescription && <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Edit2 size={14} className="text-cu-text-muted" />
          </div>}
        </div>
      )}
    </div>
  );
};

export default DescriptionEditor;
