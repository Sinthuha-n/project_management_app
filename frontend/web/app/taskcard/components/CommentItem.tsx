'use client';
import React from 'react';
import Image from 'next/image';
import { formatDateTime } from '@/lib/date-time';
import { useTimeZone } from '@/components/providers/TimeZoneProvider';

interface CommentItemProps {
  comment: {
    id: number;
    text: string;
    authorName: string;
    createdAt: string;
  };
  resolvedPicUrl?: string;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, resolvedPicUrl }) => {
  const { timeZone } = useTimeZone();
  return (
  <div className="flex gap-3 pb-4 border-b border-cu-border">
    <div className="w-8 h-8 rounded-full bg-cu-bg-tertiary flex items-center justify-center text-cu-text-primary text-xs font-bold shrink-0 overflow-hidden">
      {resolvedPicUrl ? (
        <Image
          src={resolvedPicUrl}
          alt={comment.authorName}
          width={32}
          height={32}
          className="w-full h-full object-cover"
          unoptimized
        />
      ) : (
        comment.authorName.charAt(0).toUpperCase()
      )}
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-cu-text-primary">{comment.authorName}</span>
        <span className="text-xs text-cu-text-muted">{formatDateTime(comment.createdAt, {}, timeZone)}</span>
      </div>
      <p className="text-sm text-cu-text-secondary mt-1">{comment.text}</p>
    </div>
  </div>
  );
};

export default CommentItem;
