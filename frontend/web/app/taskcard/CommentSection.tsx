"use client";
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { getUserFromToken } from '@/lib/auth';
import ActivityFeed from './ActivityFeed';
import CommentItem from './components/CommentItem';
import { tasksApi, projectsApi } from '@/services/api-contract';
import type { Member } from '@/services/projects-contract';
import { getOrFetchUserMap } from './sidebar/userMapCache';
import { resolveProfilePhotoUrl } from '@/lib/profile-photo';

interface Comment {
  id: number;
  text: string;
  authorName: string;
  createdAt: string;
}

interface CommentSectionProps {
  taskId?: number;
  onFetchRef?: (fn: () => void) => void;
  projectId?: number;
}

interface UserProfile {
  userId?: number;
  username?: string;
  email?: string;
  profilePicUrl?: string | null;
  fullName?: string;
}

function buildUsersMap(users: UserProfile[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};

  users.forEach((u) => {
    const pic = resolveProfilePhotoUrl(u.profilePicUrl, u.userId);
    if (typeof u.userId === 'number') {
      map[`id:${u.userId}`] = pic;
    }
    if (u.email) {
      map[`email:${u.email.toLowerCase()}`] = pic;
    }
    if (u.username) {
      map[u.username] = pic;
      map[`username:${u.username.toLowerCase()}`] = pic;
    }
    if (u.fullName) {
      map[u.fullName] = pic;
      map[`fullname:${u.fullName.toLowerCase()}`] = pic;
    }
  });

  return map;
}

const CommentSection: React.FC<CommentSectionProps> = ({ taskId, onFetchRef, projectId }) => {
  const [activeTab, setActiveTab] = useState<'Comments' | 'History'>('Comments');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username?: string; email: string; profilePicUrl?: string | null } | null>(null);
  const [usersMap, setUsersMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const user = getUserFromToken();
    if (user) {
      queueMicrotask(() => setCurrentUser(user));

      let isActive = true;

      // Avatar enrichment is optional; comments should still work if this lookup is unauthorized.
      const fetchUsers = async () => {
        try {
          let uidMap: Record<string, string | null>;
          if (projectId) {
            const members = await projectsApi.getMembers(projectId);
            uidMap = buildUsersMap(members.map((m: Member) => m.user ? {
              userId: m.user.userId,
              username: m.user.username,
              email: m.user.email,
              profilePicUrl: m.user.profilePicUrl
            } : {
              userId: m.userId,
              username: m.username,
              email: m.email,
              profilePicUrl: null
            }));
          } else {
            uidMap = await getOrFetchUserMap();
          }

          if (!isActive) return;

          const currentUserPic = uidMap[`email:${user.email.toLowerCase()}`]
            || (user.userId ? uidMap[`id:${user.userId}`] : null)
            || (user.username ? uidMap[user.username] || uidMap[`username:${user.username.toLowerCase()}`] : null);

          if (currentUserPic) {
            setCurrentUser(prev => prev ? { ...prev, profilePicUrl: currentUserPic } : null);
          }
          setUsersMap(uidMap);
        } catch {
          if (isActive) {
            setUsersMap({});
          }
        }
      };
      void fetchUsers();

      return () => {
        isActive = false;
      };
    }
  }, [projectId]);

  const resolveProfilePic = (url?: string | null) => {
    return resolveProfilePhotoUrl(url) || '';
  };

  const fetchComments = async () => {
    if (!taskId) return;
    try {
      const response = await tasksApi.getComments(taskId);
      setComments(response);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  useEffect(() => {
    if (taskId) {
      queueMicrotask(() => void fetchComments());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    onFetchRef?.(fetchComments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchComments]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !taskId || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await tasksApi.postComment(taskId, {
        content: newComment
      });
      setNewComment('');
      await fetchComments();
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUserInitial = () => {
    if (!currentUser) return 'U';
    return (currentUser.username?.[0] || currentUser.email[0]).toUpperCase();
  };

  return (
    <div className="mt-8">
      <div className="flex items-center gap-6 border-b border-cu-border mb-4">
        {['Comments', 'History'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as 'Comments' | 'History')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-cu-primary text-cu-primary'
                : 'border-transparent text-cu-text-muted hover:text-cu-text-primary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden bg-cu-primary">
          {currentUser?.profilePicUrl ? (
             <Image 
               src={resolveProfilePic(currentUser.profilePicUrl)} 
               alt="Current User" 
               width={32} 
               height={32} 
               className="w-full h-full object-cover" 
               unoptimized 
             />
          ) : (
             getUserInitial()
          )}
        </div>
        <div className="flex-1">
          <textarea
            rows={2}
            placeholder="Add a comment..."
            value={newComment}
            maxLength={2000}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleAddComment();
              }
            }}
            disabled={isSubmitting}
            className="w-full border border-cu-border bg-cu-bg text-cu-text-primary rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-cu-primary/20 focus:border-cu-primary focus:outline-none transition-all placeholder:text-cu-text-muted disabled:bg-cu-bg-secondary resize-none"
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-cu-text-muted">
              <strong>Pro tip:</strong> press <span className="bg-cu-bg-secondary border border-cu-border px-1 rounded text-cu-text-secondary font-mono">Enter</span> to comment
            </p>
            <p className="text-xs text-cu-text-muted">{newComment.length}/2000</p>
          </div>
        </div>
      </div>

      {/* Comments List */}
      {activeTab === 'Comments' && (
        <div className="mt-6">
          {comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  resolvedPicUrl={resolveProfilePic(usersMap[comment.authorName])}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 text-center py-8 bg-cu-bg-secondary rounded-xl border border-dashed border-cu-border">
              <p className="text-cu-text-muted text-sm">No comments yet.</p>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'History' && (
        <ActivityFeed taskId={taskId} />
      )}
    </div>
  );
};

export default CommentSection;
