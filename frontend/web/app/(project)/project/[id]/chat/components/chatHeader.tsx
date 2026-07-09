'use client';

import { ArrowLeft, Search, Users, X } from 'lucide-react';
import { avatarColor } from '@/hooks/chat/chat-utils';
import { resolveProfilePhotoUrl } from '@/lib/profile-photo';

interface ChatHeaderProps {
  selectedRoom: { name?: string | null; topic?: string | null } | null;
  selectedUser: string | null;
  userProfilePics: Record<string, string>;
  onlineUsers: string[];
  isConnected: boolean;
  phaseDEnabled: boolean;
  showSearch: boolean;
  onToggleSearch: () => void;
  onShowSidebar: () => void;
}



export function ChatHeader({
  selectedRoom,
  selectedUser,
  userProfilePics,
  onlineUsers,
  isConnected,
  phaseDEnabled,
  showSearch,
  onToggleSearch,
  onShowSidebar,
}: ChatHeaderProps) {
  const selectedUserProfilePicUrl = selectedUser
    ? resolveProfilePhotoUrl(userProfilePics[selectedUser])
    : null;

  const headerIcon = selectedRoom
    ? (
      <div className={`w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-br ${avatarColor(selectedRoom?.name || 'G')} flex items-center justify-center text-white text-[13px] font-bold shadow-cu-sm ring-2 ring-cu-bg`}>
        {(selectedRoom?.name || 'G').charAt(0).toUpperCase()}
      </div>
    )
    : selectedUser && selectedUserProfilePicUrl
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={selectedUserProfilePicUrl} alt={selectedUser} className="w-8 h-8 rounded-full flex-shrink-0 object-cover shadow-cu-sm ring-2 ring-cu-bg" />
      : selectedUser
        ? (
          <div className={`w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-br ${avatarColor(selectedUser)} flex items-center justify-center text-white text-[13px] font-bold shadow-cu-sm ring-2 ring-cu-bg`}>
            {(selectedUser || '?').charAt(0).toUpperCase()}
          </div>
        )
        : (
          <div className="w-8 h-8 rounded-full flex-shrink-0 bg-cu-primary/10 flex items-center justify-center text-cu-primary shadow-cu-sm ring-2 ring-cu-bg">
            <Users size={16} strokeWidth={2.5} />
          </div>
        );

  const headerTitle = selectedRoom
    ? selectedRoom.name ?? 'Group Chat'
    : selectedUser ?? 'Team Chat';

  const headerSub = selectedRoom
    ? selectedRoom.topic || 'Group channel'
    : selectedUser
      ? 'Private message'
      : onlineUsers.length > 0
        ? `${onlineUsers.length} member${onlineUsers.length !== 1 ? 's' : ''} online`
        : 'Team workspace';

  return (
    <div className="sticky top-0 z-30 flex h-12 flex-shrink-0 items-center justify-between border-b border-cu-border bg-cu-bg/95 px-2.5 backdrop-blur supports-[backdrop-filter]:backdrop-blur sm:h-14 sm:px-5 md:h-16">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          className="-ml-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-cu-text-secondary transition-colors hover:bg-cu-hover hover:text-cu-text-primary lg:hidden"
          onClick={onShowSidebar}
          aria-label="Back to conversations"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="w-9 h-9 sm:w-9 sm:h-9 rounded-xl bg-cu-primary/10 flex items-center justify-center flex-shrink-0">
          {headerIcon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[14px] font-semibold text-cu-text-primary sm:text-[15px]">{headerTitle}</h2>
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}
              title={isConnected ? 'Connected' : 'Disconnected'}
            />
          </div>
          <p className="truncate text-[11px] text-cu-text-muted sm:text-[12px]">{headerSub}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {onlineUsers.length > 0 && (
          <div className="hidden items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11.5px] font-semibold text-emerald-500 sm:flex">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {onlineUsers.length} online
          </div>
        )}

        {phaseDEnabled && (
          <button
            onClick={onToggleSearch}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-cu-text-muted transition-colors hover:bg-cu-hover hover:text-cu-text-primary sm:h-10 sm:w-10 md:h-9 md:w-9"
            title="Search messages"
            aria-label="Toggle message search"
          >
            {showSearch ? <X size={17} strokeWidth={2.5} /> : <Search size={17} strokeWidth={2.5} />}
          </button>
        )}
      </div>
    </div>
  );
}
