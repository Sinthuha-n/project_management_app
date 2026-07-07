'use client';

import React, { useState } from 'react';
import { Search, Plus, Hash, MessageCircle, Users, X, Bell, Pencil, Trash2 } from 'lucide-react';
import { ChatMessage, ChatRoom } from './chat';
import { isFileDocument } from './chatMessage';
import { CreateChannelModal, EditChannelModal, ConfirmDeleteModal } from './chatModals';
import { avatarColor } from '@/hooks/chat/chat-utils';
import { resolveProfilePhotoUrl } from '@/lib/profile-photo';

interface ChatSidebarProps {
  currentUser: string;
  currentUserAliases: string[];
  users: string[];
  userProfilePics?: Record<string, string>;
  rooms: ChatRoom[];
  selectedUser: string | null;
  selectedRoomId: number | null;
  onSelectUser: (user: string | null) => void;
  onSelectRoom: (roomId: number | null) => void;
  privateUnseenCounts: Record<string, number>;
  roomUnseenCounts: Record<number, number>;
  privateLastMessages: Record<string, ChatMessage | null>;
  roomLastMessages: Record<number, ChatMessage | null>;
  teamUnseenCount: number;
  teamLastMessage: ChatMessage | null;
  teamTypingUsers: string[];
  roomTypingUsers: Record<number, string[]>;
  privateTypingUsers: string[];
  onCreateRoom: (name: string, members: string[]) => void;
  onDeleteRoom: (roomId: number) => void;
  onUpdateRoomMeta: (roomId: number, updates: { name?: string; topic?: string; description?: string }) => void;
  onAddTeam: (teamName: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isLoading?: boolean;
  roomMentionCounts?: Record<number, number>;
  teamMentionCount?: number;
  onlineUsers: string[];
}



function formatTime(timestamp?: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-cu-primary text-white text-xs font-semibold flex items-center justify-center leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function MentionBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center leading-none gap-0.5"
      title={`${count} mention${count !== 1 ? 's' : ''}`}
    >
      <Bell size={10} />
      {count > 9 ? '9+' : count}
    </span>
  );
}

function SidebarSkeleton() {
  return (
    <div className="px-3 space-y-2 mt-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl">
          <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-cu-bg-tertiary" />
          <div className="flex-1 space-y-1.5">
            <div className={`h-3 animate-pulse rounded bg-cu-bg-tertiary ${i % 2 === 0 ? 'w-3/4' : 'w-1/2'}`} />
            <div className="h-2.5 w-full animate-pulse rounded bg-cu-bg-tertiary" />
          </div>
        </div>
      ))}
    </div>
  );
}

export const ChatSidebar = ({
  currentUser,
  currentUserAliases,
  users,
  userProfilePics = {},
  rooms,
  selectedUser,
  selectedRoomId,
  onSelectUser,
  onSelectRoom,
  privateUnseenCounts,
  roomUnseenCounts,
  privateLastMessages,
  roomLastMessages,
  teamUnseenCount,
  teamLastMessage,
  teamTypingUsers,
  roomTypingUsers,
  privateTypingUsers,
  onCreateRoom,
  onDeleteRoom,
  onUpdateRoomMeta,
  searchTerm,
  onSearchChange,
  isLoading,
  roomMentionCounts = {},
  teamMentionCount = 0,
  onlineUsers,
}: ChatSidebarProps) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editRoomData, setEditRoomData] = useState<ChatRoom | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<number | null>(null);

  const hasSelectedRoom = selectedRoomId !== null && Number.isFinite(selectedRoomId);
  const currentUserIdentitySet = new Set([
    currentUser.toLowerCase(),
    ...currentUserAliases.map((a) => a.toLowerCase()),
  ]);
  const dmUsers = users.filter((user) => !currentUserIdentitySet.has(user.toLowerCase()));
  const isTeamSelected = !selectedUser && !hasSelectedRoom;

  const getMessagePreview = (content?: string | null): string => {
    if (!content) return '';
    if (isFileDocument(content)) return 'File attachment';
    return content.length > 40 ? content.slice(0, 40) + '...' : content;
  };

  return (
    <aside className="flex h-full w-full flex-shrink-0 flex-col overflow-hidden border-r border-cu-border bg-cu-bg lg:w-72">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-cu-border px-4 pb-3 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cu-primary to-blue-600 shadow-cu-sm">
            <MessageCircle size={15} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-cu-text-primary">Messages</span>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-cu-text-muted transition-colors hover:bg-cu-hover hover:text-cu-text-primary md:h-7 md:w-7"
          aria-label="Create channel"
          title="New channel"
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 rounded-xl border border-cu-border bg-cu-bg-secondary px-3 py-2.5 transition-all focus-within:border-cu-primary/40 focus-within:bg-cu-bg focus-within:ring-2 focus-within:ring-cu-primary/15">
          <Search size={14} className="flex-shrink-0 text-cu-text-muted" strokeWidth={2.5} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent text-sm text-cu-text-primary placeholder:text-cu-text-muted outline-none"
            aria-label="Search conversations"
          />
          {searchTerm && (
            <button onClick={() => onSearchChange('')} className="text-cu-text-muted hover:text-cu-text-primary">
              <X size={13} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-4">
        {isLoading ? (
          <SidebarSkeleton />
        ) : (
          <>
            {/* ── Team Chat ── */}
            <div className="px-3 mt-1">
              <button
                onClick={() => { onSelectUser(null); onSelectRoom(null); }}
                className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-xl transition-all duration-150 group
                  ${isTeamSelected
                    ? 'bg-cu-primary/10 border border-cu-primary/25'
                    : 'hover:bg-cu-hover border border-transparent'}`}
                aria-label="Open Team Chat"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all
                  ${isTeamSelected ? 'bg-cu-primary shadow-cu-sm shadow-cu-primary/20' : 'bg-cu-bg-secondary group-hover:bg-cu-hover'}`}>
                  <Users size={16} className={isTeamSelected ? 'text-white' : 'text-cu-text-muted'} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`truncate text-[13.5px] font-semibold ${isTeamSelected ? 'text-cu-primary' : 'text-cu-text-primary'}`}>
                      Team Chat
                    </span>
                    {teamLastMessage?.timestamp && (
                      <span className="flex-shrink-0 text-[10px] text-cu-text-muted">
                        {formatTime(teamLastMessage.timestamp)}
                      </span>
                    )}
                  </div>
                  {teamTypingUsers.length > 0 && !isTeamSelected ? (
                    <p className="truncate text-[11.5px] font-medium text-cu-primary">
                      {teamTypingUsers[0]} is typing...
                    </p>
                  ) : teamLastMessage?.content ? (
                    <p className="truncate text-[11.5px] text-cu-text-muted">
                      {getMessagePreview(teamLastMessage.content)}
                    </p>
                  ) : (
                    <p className="text-[11.5px] italic text-cu-text-muted">No messages yet</p>
                  )}
                </div>
                <UnreadBadge count={teamUnseenCount} />
                <MentionBadge count={teamMentionCount} />
              </button>
            </div>

            {/* ── Group Channels ── */}
            <div className="mt-4 px-3">
              <p className="mb-1.5 px-1 text-[10.5px] font-bold uppercase tracking-widest text-cu-text-muted">
                Channels
              </p>

              {rooms.length === 0 && (
                <p className="px-1 py-1.5 text-[12px] italic text-cu-text-muted">
                  No channels yet - create one!
                </p>
              )}

              <div className="space-y-0.5">
                {rooms.map((room) => {
                  const isCreator = !!room.createdBy && currentUserIdentitySet.has(room.createdBy.toLowerCase());
                  const isRoomSelected = hasSelectedRoom && selectedRoomId === room.id;
                  const roomTypers = roomTypingUsers[room.id] || [];
                  const showTyping = roomTypers.length > 0 && !isRoomSelected;
                  const lastMsg = roomLastMessages[room.id];
                  const unseen = roomUnseenCounts[room.id] || 0;

                  return (
                    <button
                      key={room.id}
                      onClick={() => onSelectRoom(room.id)}
                      className={`group/room w-full flex items-center gap-3 px-3 py-3.5 rounded-xl transition-all duration-150 text-left
                        ${isRoomSelected
                          ? 'bg-cu-primary/10 border border-cu-primary/25'
                          : 'hover:bg-cu-hover border border-transparent'}`}
                      aria-label={`Open #${room.name}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
                        ${isRoomSelected ? 'bg-cu-primary shadow-cu-sm shadow-cu-primary/20' : 'bg-cu-bg-secondary group-hover/room:bg-cu-hover'}`}>
                        <Hash size={14} className={isRoomSelected ? 'text-white' : 'text-cu-text-muted'} strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className={`flex-1 truncate text-[13px] font-semibold ${isRoomSelected ? 'text-cu-primary' : 'text-cu-text-primary'}`}>
                            {room.name}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                            {/* Room owner actions */}
                            {isCreator && (
                              <div className="opacity-0 group-hover/room:opacity-100 transition-opacity flex items-center gap-0.5">
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setEditRoomData(room);
                                  }}
                                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-cu-text-muted transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
                                  aria-label={`Edit ${room.name}`}
                                  title="Edit channel"
                                >
                                  <Pencil size={12} />
                                </div>
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setRoomToDelete(room.id);
                                  }}
                                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-cu-text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                                  aria-label={`Delete ${room.name}`}
                                  title="Delete channel"
                                >
                                  <Trash2 size={12} />
                                </div>
                              </div>
                            )}

                            <MentionBadge count={roomMentionCounts[room.id] || 0} />
                            <UnreadBadge count={unseen} />

                            {lastMsg?.timestamp && (
                              <span className="text-[10px] text-cu-text-muted">
                                {formatTime(lastMsg.timestamp)}
                              </span>
                            )}
                          </div>
                        </div>
                        {showTyping ? (
                          <p className="truncate text-[11px] font-medium text-cu-primary">{roomTypers[0]} is typing...</p>
                        ) : (
                          <p className="truncate text-[11px] text-cu-text-muted">
                            {room.topic || getMessagePreview(lastMsg?.content) || `Created by ${room.createdBy}`}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Direct Messages ── */}
            <div className="mt-4 px-3">
              <p className="mb-1.5 px-1 text-[10.5px] font-bold uppercase tracking-widest text-cu-text-muted">
                Direct Messages
              </p>

              {dmUsers.length === 0 && (
                <p className="px-1 py-1.5 text-[12px] italic text-cu-text-muted">
                  No team members found
                </p>
              )}

              <div className="space-y-0.5">
                {dmUsers.map((user) => {
                  const lastMsg = privateLastMessages[user];
                  const unseen = privateUnseenCounts[user] || 0;
                  const isTyping = privateTypingUsers.includes(user.toLowerCase());
                  const isSelectedDm = selectedUser === user;
                  const showTyping = isTyping && !isSelectedDm;
                  const profilePicUrl = resolveProfilePhotoUrl(userProfilePics?.[user]);
                  return (
                    <button
                      key={user}
                      onClick={() => onSelectUser(user)}
                      className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-xl transition-all duration-150
                        ${isSelectedDm
                          ? 'bg-cu-primary/10 border border-cu-primary/25'
                          : 'hover:bg-cu-hover border border-transparent'}`}
                      aria-label={`Open DM with ${user}`}
                    >
                      {/* Avatar */}
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {profilePicUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={profilePicUrl} alt={user} className="w-9 h-9 rounded-full object-cover shadow-cu-sm" />
                        ) : (
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(user)} flex items-center justify-center text-white font-semibold text-[13px]`}>
                            {user.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {onlineUsers.includes(user.toLowerCase()) && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-cu-bg bg-emerald-400" />}
                      </div>

                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`truncate text-[13.5px] font-medium ${isSelectedDm ? 'font-semibold text-cu-primary' : 'text-cu-text-primary'}`}>
                            {user}
                          </span>
                          {lastMsg?.timestamp && (
                            <span className="flex-shrink-0 text-[10px] text-cu-text-muted">
                              {formatTime(lastMsg.timestamp)}
                            </span>
                          )}
                        </div>
                        {showTyping ? (
                          <p className="text-[11.5px] font-medium text-cu-primary">typing...</p>
                        ) : lastMsg?.content ? (
                          <p className="truncate text-[11.5px] text-cu-text-muted">
                            {getMessagePreview(lastMsg.content)}
                          </p>
                        ) : (
                          <p className="text-[11.5px] italic text-cu-text-muted">Start a conversation</p>
                        )}
                      </div>
                      <UnreadBadge count={unseen} />
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <CreateChannelModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        users={users}
        onCreate={onCreateRoom}
      />
      {editRoomData && (
        <EditChannelModal
          isOpen={!!editRoomData}
          onClose={() => setEditRoomData(null)}
          initialName={editRoomData.name}
          initialTopic={editRoomData.topic || ''}
          initialDescription={editRoomData.description || ''}
          onSave={(updates) => onUpdateRoomMeta(editRoomData.id, updates)}
        />
      )}
      <ConfirmDeleteModal
        isOpen={roomToDelete !== null}
        onClose={() => setRoomToDelete(null)}
        title="Delete Channel"
        message="Are you sure you want to delete this channel? This action cannot be undone."
        onConfirm={() => {
          if (roomToDelete !== null) onDeleteRoom(roomToDelete);
          setRoomToDelete(null);
        }}
      />
    </aside>
  );
};
