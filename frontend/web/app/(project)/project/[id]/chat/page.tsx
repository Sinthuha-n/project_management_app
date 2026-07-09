'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { useChat } from './components/useChat';
import { ChatSidebar } from './components/chatSidebar';
import { ChatMessages } from './components/chatMessage';
import { ChatInput } from './components/chatInput';
import { ThreadPanel } from './components/threadPanel';
import { ChatLoadingSkeleton } from './components/chatLoadingSkeleton';
import { ChatConnectionBanners } from './components/chatConnectionBanners';
import { ChatHeader } from './components/chatHeader';
import { ChatSearchPanel } from './components/chatSearchPanel';

export default function ChatInterface() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const roomIdParam = searchParams.get('roomId');
  const withParam = searchParams.get('with');
  const viewParam = searchParams.get('view');
  const handledQueryRef = useRef<string | null>(null);
  const loadedPrivateRef = useRef<string | null>(null);
  const loadedRoomRef = useRef<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [targetMessageId, setTargetMessageId] = useState<number | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024;
  });

  const {
    currentUser,
    currentUserAliases,
    users,
    userProfilePics,
    rooms,
    roomMessages,
    messages,
    privateMessages,
    selectedUser,
    selectedRoomId,
    privateUnseenCounts,
    roomUnseenCounts,
    privateLastMessages,
    roomLastMessages,
    teamUnseenCount,
    teamLastMessage,
    onlineUsers,
    teamTypingUsers,
    roomTypingUsers,
    privateTypingUsers,
    featureFlags,
    searchResults,
    isSearchLoading,
    commandNotice: _commandNotice,
    messageReactions,
    activeThreadRoot,
    threadMessages,
    selectPrivateUser,
    selectRoom,
    sendMessage,
    sendRoomMessage,
    sendThreadReply,
    openThread,
    closeThread,
    editMessage,
    deleteMessage,
    toggleReaction,
    loadPrivateHistory,
    loadRoomHistory,
    createRoom,
    deleteRoom,
    updateRoomMeta,
    pinRoomMessage,
    sendTyping,
    searchMessages,
    trackTelemetry,
    addTeam,
    isLoading,
    isSocketConnected,
    isSocketReconnecting,
    error,
    retryConnection,
    roomMentionCounts,
    teamMentionCount,
  } = useChat(projectId);

  const [showChatSidebar, setShowChatSidebar] = useState(() => {
    if (typeof window === 'undefined') return true;
    const hasQuerySelection = Boolean(roomIdParam || withParam || viewParam === 'team');
    return !(window.innerWidth < 1024 && hasQuerySelection);
  });

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        setShowChatSidebar(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelectUser = (u: string | null) => {
    selectPrivateUser(u);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setShowChatSidebar(false);
  };

  const handleSelectRoom = (id: number | null) => {
    selectRoom(id);
    if (id !== null && typeof window !== 'undefined' && window.innerWidth < 1024) setShowChatSidebar(false);
  };

  const hasSelectedRoom = selectedRoomId !== null && Number.isFinite(selectedRoomId);
  const selectedRoom = hasSelectedRoom ? rooms.find((r) => r.id === selectedRoomId) ?? null : null;
  const isPrivateChat = !!selectedUser && !hasSelectedRoom;

  const displayMessages = hasSelectedRoom
    ? roomMessages[selectedRoomId as number] || []
    : selectedUser
    ? privateMessages[selectedUser] || []
    : messages;

  const filteredUsers = users.filter(
    (u) =>
      !currentUserAliases.some((alias) => alias && alias.toLowerCase() === u.toLowerCase()) &&
      u.toLowerCase() !== currentUser.toLowerCase() &&
      u.toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );
  const mentionCandidates = users.filter(
    (u) =>
      !currentUserAliases.some((alias) => alias && alias.toLowerCase() === u.toLowerCase()) &&
      u.toLowerCase() !== currentUser.toLowerCase(),
  );

  const filteredMessages = displayMessages.filter((msg) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    return (
      msg.sender.toLowerCase().includes(term) ||
      (msg.content && msg.content.toLowerCase().includes(term))
    );
  });

  const executeSearch = async () => { await searchMessages(searchQuery); };

  const jumpToSearchResult = async (result: {
    messageId: number;
    deepLinkUrl: string;
    roomId?: number | null;
  }) => {
    const deepLink = new URL(result.deepLinkUrl, 'https://planora.local');
    const roomId = deepLink.searchParams.get('roomId');
    const withUser = deepLink.searchParams.get('with');

    if (roomId) {
      const parsedRoomId = Number(roomId);
      if (Number.isFinite(parsedRoomId) && parsedRoomId > 0) {
        selectRoom(parsedRoomId);
        await loadRoomHistory(parsedRoomId);
        trackTelemetry('chat_search_result_opened', 'room', `roomId=${parsedRoomId}`);
      }
    } else if (withUser) {
      const partner = withUser.toLowerCase();
      selectPrivateUser(partner);
      await loadPrivateHistory(partner);
      trackTelemetry('chat_search_result_opened', 'private', `partner=${partner}`);
    } else {
      selectRoom(null);
      selectPrivateUser(null);
      trackTelemetry('chat_search_result_opened', 'team');
    }

    setTargetMessageId(result.messageId);
  };

  const roomTyping = hasSelectedRoom && selectedRoomId !== null ? (roomTypingUsers[selectedRoomId] || []) : [];
  const privateTyping = selectedUser
    ? privateTypingUsers.filter((u) => u === selectedUser.toLowerCase())
    : [];
  const activeTypingUser = hasSelectedRoom
    ? roomTyping[0]
    : selectedUser
    ? privateTyping[0]
    : teamTypingUsers[0];

  useEffect(() => {
    if (!selectedUser) {
      loadedPrivateRef.current = null;
      return;
    }
    const normalized = selectedUser.toLowerCase();
    if (loadedPrivateRef.current === normalized) {
      return;
    }
    loadedPrivateRef.current = normalized;
    loadPrivateHistory(selectedUser);
  }, [selectedUser, loadPrivateHistory]);

  useEffect(() => {
    if (featureFlags.phaseEEnabled && featureFlags.telemetryEnabled) {
      trackTelemetry('chat_screen_opened', 'chat', `project=${projectId}`);
    }
  }, [featureFlags.phaseEEnabled, featureFlags.telemetryEnabled, projectId, trackTelemetry]);

  useEffect(() => {
    const key = `${roomIdParam || ''}|${withParam || ''}|${viewParam || ''}`;
    if (!key || handledQueryRef.current === key) return;

    if (roomIdParam) {
      const parsedRoomId = Number(roomIdParam);
      if (Number.isFinite(parsedRoomId) && parsedRoomId > 0) {
        selectRoom(parsedRoomId);
        handledQueryRef.current = key;
        return;
      }
    }

    if (withParam) {
      selectPrivateUser(withParam.toLowerCase());
      handledQueryRef.current = key;
      return;
    }

    if (viewParam === 'team') {
      selectRoom(null);
      selectPrivateUser(null);
      handledQueryRef.current = key;
    }
  }, [roomIdParam, withParam, viewParam, selectRoom, selectPrivateUser]);

  useEffect(() => {
    if (!hasSelectedRoom) {
      loadedRoomRef.current = null;
      return;
    }
    const normalizedRoomId = selectedRoomId as number;
    if (loadedRoomRef.current === normalizedRoomId) {
      return;
    }
    loadedRoomRef.current = normalizedRoomId;
    loadRoomHistory(normalizedRoomId);
  }, [selectedRoomId, hasSelectedRoom, loadRoomHistory]);

  const showMobileThread = Boolean(activeThreadRoot) && isMobileViewport;

  const handleSendMessage = (content: string) => {
    if (hasSelectedRoom) sendRoomMessage(content, selectedRoomId as number);
    else sendMessage(content, selectedUser);
  };

  const handleCreateRoom = async (name: string, members: string[]) => {
    const createdRoom = await createRoom(name, members);
    if (!createdRoom) return;
    selectRoom(createdRoom.id);
    await loadRoomHistory(createdRoom.id);
  };

  const isConnected = isSocketConnected;
  const errorMessage = typeof error === 'string' ? error : String(error ?? '');
  const isReconnectError = errorMessage.toLowerCase().includes('reconnect');
  const shouldShowErrorBanner = errorMessage.length > 0 && !isReconnectError && !isSocketReconnecting;

  /* ── Loading skeleton ── */
  if (isLoading) {
    return <ChatLoadingSkeleton />;
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-cu-bg-secondary pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:pb-0">

      {/* ── Sidebar ── */}
      <div className={showChatSidebar ? 'flex w-full lg:w-auto' : 'hidden lg:flex'}>
        <ChatSidebar
          currentUser={currentUser}
          currentUserAliases={currentUserAliases}
          users={filteredUsers}
          userProfilePics={userProfilePics}
          rooms={rooms}
          selectedUser={selectedUser}
          selectedRoomId={selectedRoomId}
          onSelectUser={handleSelectUser}
          onSelectRoom={handleSelectRoom}
          privateUnseenCounts={privateUnseenCounts}
          roomUnseenCounts={roomUnseenCounts}
          privateLastMessages={privateLastMessages}
          roomLastMessages={roomLastMessages}
          teamUnseenCount={teamUnseenCount}
          teamLastMessage={teamLastMessage}
          teamTypingUsers={teamTypingUsers}
          roomTypingUsers={roomTypingUsers}
          privateTypingUsers={privateTypingUsers}
          onCreateRoom={handleCreateRoom}
          onDeleteRoom={deleteRoom}
          onUpdateRoomMeta={updateRoomMeta}
          onAddTeam={addTeam}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          isLoading={false}
          roomMentionCounts={roomMentionCounts}
          teamMentionCount={teamMentionCount}
          onlineUsers={onlineUsers}
        />
      </div>

      {/* ── Main chat area ── */}
      <div className={`flex-1 min-h-0 flex flex-col min-w-0 bg-cu-bg border-l-0 lg:border-l border-cu-border shadow-cu-sm ${!showChatSidebar ? 'flex w-full' : 'hidden lg:flex'}`}>
        <ChatConnectionBanners
          isConnected={isConnected}
          isReconnecting={isSocketReconnecting}
          shouldShowErrorBanner={shouldShowErrorBanner}
          error={error}
          onRetry={retryConnection}
        />

        <ChatHeader
          selectedRoom={selectedRoom}
          selectedUser={selectedUser}
          userProfilePics={userProfilePics}
          onlineUsers={onlineUsers}
          isConnected={isConnected}
          phaseDEnabled={featureFlags.phaseDEnabled}
          showSearch={showSearch}
          onToggleSearch={() => setShowSearch((prev) => !prev)}
          onShowSidebar={() => setShowChatSidebar(true)}
        />

        <ChatSearchPanel
          showSearch={showSearch}
          phaseDEnabled={featureFlags.phaseDEnabled}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onExecuteSearch={executeSearch}
          isSearchLoading={isSearchLoading}
          searchResults={searchResults}
          onOpenResult={jumpToSearchResult}
        />

        <div className="flex-1 min-h-0 flex flex-col">
          {!selectedUser && !hasSelectedRoom && displayMessages.length === 0 && !isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cu-primary/20 bg-cu-primary/10">
                <MessageCircle size={28} className="text-cu-primary" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-cu-text-primary">Select a conversation</h3>
                <p className="mt-1 text-[13px] text-cu-text-muted">Choose a channel or direct message from the sidebar to start chatting.</p>
              </div>
            </div>
          )}

          {/* Messages */}
          <ChatMessages
            projectId={projectId}
            messages={filteredMessages}
            targetMessageId={targetMessageId}
            currentUser={currentUser}
            currentUserAliases={currentUserAliases}
            isPrivateChat={isPrivateChat}
            userProfilePics={userProfilePics}
            activeRoomId={selectedRoomId}
            pinnedMessageId={selectedRoom?.pinnedMessageId ?? null}
            reactionsByMessageId={messageReactions}
            onOpenThread={openThread}
            onEditMessage={editMessage}
            onDeleteMessage={deleteMessage}
            onToggleReaction={toggleReaction}
            onPinRoomMessage={
              selectedRoomId ? (messageId) => pinRoomMessage(selectedRoomId, messageId) : undefined
            }
            typingUser={activeTypingUser}
          />

          {/* Input */}
          <ChatInput
            onSendMessage={handleSendMessage}
            onTypingChange={sendTyping}
            disabled={isLoading || ((!isConnected && !isSocketReconnecting) || shouldShowErrorBanner)}
            placeholder={
              hasSelectedRoom
                ? `Message #${selectedRoom?.name ?? 'channel'}...`
                : selectedUser
                ? `Message ${selectedUser}...`
                : 'Message team...'
            }
            enableMentions={!selectedUser}
            mentionCandidates={mentionCandidates}
          />
        </div>
      </div>

      {/* Thread panel */}
      <div className="hidden h-full min-h-0 lg:flex lg:flex-shrink-0">
        <AnimatePresence>
          {activeThreadRoot && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="h-full min-h-0 flex-shrink-0 overflow-hidden"
            >
              <ThreadPanel
                rootMessage={activeThreadRoot}
                threadMessages={threadMessages}
                userProfilePics={userProfilePics}
                reactionsByMessageId={messageReactions}
                onClose={closeThread}
                onSendReply={sendThreadReply}
                onToggleReaction={toggleReaction}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {activeThreadRoot && showMobileThread && (
          <div className="fixed inset-0 z-[var(--cu-z-overlay)] lg:hidden">
            <motion.button
              type="button"
              aria-label="Close thread panel overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/45"
              onClick={() => {
                closeThread();
              }}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="absolute right-0 top-0 h-full w-full max-w-xl bg-cu-bg shadow-cu-xl"
            >
              <div className="h-full min-h-0">
                <ThreadPanel
                  rootMessage={activeThreadRoot}
                  threadMessages={threadMessages}
                  userProfilePics={userProfilePics}
                  reactionsByMessageId={messageReactions}
                  onClose={closeThread}
                  onSendReply={sendThreadReply}
                  onToggleReaction={toggleReaction}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
