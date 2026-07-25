'use client';
import React, { useEffect, useState } from 'react';
import SidebarField from './SidebarField';

interface StoryPointSectionProps {
  storyPoint: number;
  onUpdateStoryPoint?: (storyPoint: number) => void;
}

const StoryPointSection: React.FC<StoryPointSectionProps> = ({ storyPoint, onUpdateStoryPoint }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [edited, setEdited] = useState(storyPoint);

  useEffect(() => {
    queueMicrotask(() => setEdited(storyPoint));
  }, [storyPoint]);

  // Hide entirely when points are unset (0) rather than showing "0 points" which could mislead
  if (storyPoint <= 0) return null;

  const handleSave = () => {
    if (edited !== storyPoint && edited >= 0) {
      onUpdateStoryPoint?.(edited);
    }
    setIsEditing(false);
  };

  return (
    <SidebarField label="Story Points">
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            value={edited}
            onChange={(e) => setEdited(parseInt(e.target.value) || 0)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') { setEdited(storyPoint); setIsEditing(false); }
            }}
            autoFocus
            className="w-20 bg-cu-bg-secondary text-cu-text-primary text-xs font-bold px-2 py-1 rounded-full border-2 border-cu-primary focus:outline-none"
          />
        </div>
      ) : (
        <span
          onClick={() => onUpdateStoryPoint && setIsEditing(true)}
          className={`bg-cu-bg-secondary text-cu-text-primary text-xs font-bold px-2 py-1 rounded-full inline-block transition-colors ${onUpdateStoryPoint ? 'cursor-pointer hover:bg-cu-bg-tertiary' : 'cursor-not-allowed opacity-70'}`}
        >
          {storyPoint}
        </span>
      )}
    </SidebarField>
  );
};

export default StoryPointSection;
