'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Highlight } from '@tiptap/extension-highlight';
import { Underline } from '@tiptap/extension-underline';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Link } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import debounce from 'lodash.debounce';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Code, Link as LinkIcon, Highlighter,
  List, ListOrdered, CheckSquare,
  Heading1, Heading2, Heading3, Quote, Table as TableIcon,
  Minus, Undo2, Redo2, Type,
} from 'lucide-react';
import { Collaboration } from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import * as Y from 'yjs';
import type { WebsocketProvider } from 'y-websocket';
import SlashCommand, { slashSuggestion } from './slashCommand';
import { Modal } from '@/components/ui/Modal';

interface CollaborationUser { name: string; color: string; avatar?: string; }

export function validateUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;

  // Remove all spaces and control characters to check for bad schemes
  const normalized = trimmed.replace(/[\s\u0000-\u001F]/g, '');
  if (/^(javascript|data|vbscript|file|ftp):/i.test(normalized)) {
    return false;
  }

  if (trimmed.startsWith('//')) {
    return false;
  }

  try {
    const base = 'http://relative-base.internal';
    const parsed = new URL(trimmed, base);

    if (parsed.origin === base) {
      return true;
    }

    return (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:' ||
      parsed.protocol === 'mailto:'
    );
  } catch (_e) {
    return false;
  }
}

interface EditorProps {
  content: string;
  onUpdate: (html: string) => void;
  onImmediateUpdate?: (html: string) => void;
  editable?: boolean;
  ydoc?: Y.Doc;
  provider?: WebsocketProvider;
  collaborationUser?: CollaborationUser;
}

function ToolbarButton({
  onClick, isActive, tooltip, children,
}: {
  onClick: () => void;
  isActive?: boolean;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      type="button"
      className={`flex items-center justify-center w-8 h-8 min-w-[36px] min-h-[36px] rounded-md text-sm font-medium transition-all duration-150 ${
        isActive
          ? 'bg-cu-primary text-white shadow-sm'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-1 flex-shrink-0" />;
}

interface LinkEditModalProps {
  open: boolean;
  initialUrl: string;
  hasExistingLink: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (url: string) => void;
  onRemove: () => void;
}

function LinkEditModal({
  open,
  initialUrl,
  hasExistingLink,
  onOpenChange,
  onApply,
  onRemove,
}: LinkEditModalProps) {
  const [draftUrl, setDraftUrl] = useState(initialUrl);
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = draftUrl.trim();

    if (trimmedUrl === '') {
      onRemove();
      return;
    }

    if (!validateUrl(trimmedUrl)) {
      setUrlValidationError('Invalid URL. Only http, https, mailto, and relative app-safe URLs are allowed.');
      return;
    }

    onApply(trimmedUrl);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Insert / Edit Link"
      description="Enter a URL for this link. Only safe protocols (http, https, mailto) and relative app-safe URLs are allowed."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        <div>
          <label htmlFor="link-url-input" className="block text-sm font-medium text-cu-text-secondary mb-1">
            URL
          </label>
          <input
            id="link-url-input"
            type="text"
            value={draftUrl}
            onChange={(e) => {
              setDraftUrl(e.target.value);
              if (urlValidationError) setUrlValidationError(null);
            }}
            placeholder="https://example.com or /dashboard"
            className="w-full px-3 py-2 border border-cu-border rounded-cu-md bg-cu-bg text-cu-text-primary focus:outline-none focus:ring-2 focus:ring-cu-primary/20 text-sm"
            autoFocus
          />
          {urlValidationError && (
            <p className="mt-1.5 text-xs text-red-500 font-medium" role="alert">{urlValidationError}</p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {hasExistingLink && (
            <button
              type="button"
              onClick={onRemove}
              className="mr-auto px-4 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-cu-md transition-colors"
            >
              Remove link
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-xs font-medium text-cu-text-primary bg-cu-bg-secondary hover:bg-cu-bg-tertiary rounded-cu-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium text-white bg-cu-primary hover:bg-cu-primary-dark rounded-cu-md transition-colors"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Editor({ content, onUpdate, onImmediateUpdate, editable = true, ydoc, provider, collaborationUser }: EditorProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkInitialUrl, setLinkInitialUrl] = useState('');
  const [hasExistingLink, setHasExistingLink] = useState(false);
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);

  // 800ms debounce avoids a save API call on every keystroke while still feeling responsive
  const handleUpdate = useMemo(
    () => debounce((html: string) => { onUpdate(html); }, 800),
    [onUpdate]
  );

  // isMounted prevents TipTap from running during SSR — it depends on DOM APIs that don't exist server-side
  useEffect(() => { setIsMounted(true); }, []);  

  const extensions = useMemo(() => [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SlashCommand.configure({ suggestion: slashSuggestion as any }),
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // Disable StarterKit's bundled versions so our explicit imports below
      // (with custom config) are the sole registered instances.
      link: false,
      underline: false,
      // TipTap v3 uses `undoRedo` (not `history`); Yjs manages its own undo stack via Collaboration
      ...(ydoc ? { history: false, undoRedo: false } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any),
    Placeholder.configure({ placeholder: "Type '/' for commands, or start writing..." }),
    Highlight,
    Underline,
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({ openOnClick: false }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    ...(ydoc ? [
      Collaboration.configure({ document: ydoc }),
    ] : []),
    ...(ydoc && provider && collaborationUser ? [
      CollaborationCaret.configure({
        provider,
        user: collaborationUser,
        render(user) {
          const cursor = document.createElement('span');
          cursor.classList.add('collaboration-cursor__caret');
          cursor.style.borderLeftColor = user.color;
          cursor.style.borderLeftWidth = '2px';
          cursor.style.borderLeftStyle = 'solid';

          const label = document.createElement('span');
          label.classList.add('collaboration-cursor__label');
          label.style.backgroundColor = user.color;

          if (user.avatar) {
            const img = document.createElement('img');
            img.src = user.avatar;
            img.classList.add('collaboration-cursor__avatar');
            label.appendChild(img);
          }

          const nameText = document.createTextNode(user.name);
          label.appendChild(nameText);
          cursor.appendChild(label);
          return cursor;
        }
      })
    ] : []),
  ], [ydoc, provider, collaborationUser]);

  const editor = useEditor({
    // immediatelyRender: false prevents a SSR/CSR hydration mismatch since TipTap's output differs server vs browser
    immediatelyRender: false,
    extensions,
    content: ydoc ? undefined : content,
    editable,
    onUpdate: ({ editor, transaction }) => {
      const html = editor.getHTML();
      onImmediateUpdate?.(html);
      
      const isConnected = provider && provider.wsconnected;
      if (isConnected) {
        const isRemote = transaction.getMeta('y-sync$') !== undefined;
        if (!isRemote) {
          handleUpdate(html);
        }
      } else {
        handleUpdate(html);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-gray dark:prose-invert prose-base focus:outline-none max-w-none min-h-[400px] leading-relaxed',
      },
    },
  }, [ydoc]);

  // Sync content on external changes (e.g. file import or initial load when ydoc wasn't ready yet).
  // We skip when the editor is focused (user is actively typing) and when content is truly identical.
  // With Collaboration, getHTML() on an empty Yjs doc returns '<p></p>' so we treat that as empty too.
  useEffect(() => {
    if (!editor || editor.isFocused || !content || ydoc) return;
    const editorHTML = editor.getHTML();
    const editorIsEmpty = editorHTML === '<p></p>' || editorHTML === '';
    if (editorIsEmpty || content !== editorHTML) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor, ydoc]);

  // Synchronize initial content from DB if we are the first user to open the room
  useEffect(() => {
    if (!editor || !provider || !ydoc) return;

    let fallbackTimeoutId: NodeJS.Timeout;

    const handleSync = (isSynced: boolean) => {
      if (isSynced) {
        if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
        const fragment = ydoc.getXmlFragment('default');
        const editorHTML = editor.getHTML();
        const isEditorEmpty = editorHTML === '<p></p>' || editorHTML === '';
        if ((fragment.length === 0 || isEditorEmpty) && content) {
          editor.commands.setContent(content, { emitUpdate: false });
        }
      }
    };

    provider.on('sync', handleSync);

    if (provider.synced) {
      handleSync(true);
    } else {
      // Fallback: If Yjs WebSocket doesn't sync in 1.5 seconds (offline or server issues),
      // populate the editor with the DB content so the page isn't blank.
      fallbackTimeoutId = setTimeout(() => {
        const editorHTML = editor.getHTML();
        const isEditorEmpty = editorHTML === '<p></p>' || editorHTML === '';
        if (isEditorEmpty && content) {
          editor.commands.setContent(content, { emitUpdate: false });
        }
      }, 1500);
    }

    return () => {
      provider.off('sync', handleSync);
      if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
    };
  }, [editor, provider, ydoc, content]);

  if (!isMounted || !editor) {
    return (
      <div className="flex flex-col h-full animate-pulse">
        <div className="h-12 bg-gray-50 border-b border-gray-200" />
        <div className="flex-1 bg-white" />
      </div>
    );
  }

  const toggleLink = () => {
    const previousUrl = editor.getAttributes('link').href || '';
    savedSelectionRef.current = {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
    setLinkInitialUrl(previousUrl);
    setHasExistingLink(Boolean(previousUrl));
    setIsLinkModalOpen(true);
  };

  const restoreLinkSelection = () => {
    const chain = editor.chain().focus();
    if (savedSelectionRef.current) {
      chain.setTextSelection(savedSelectionRef.current);
    }
    return chain.extendMarkRange('link');
  };

  const applyLink = (url: string) => {
    restoreLinkSelection().setLink({ href: url }).run();
    setIsLinkModalOpen(false);
  };

  const removeLink = () => {
    restoreLinkSelection().unsetLink().run();
    setIsLinkModalOpen(false);
  };

  return (
    <div className="flex flex-col w-full h-full">

      {/* ── Sticky Toolbar ── */}
      {editable && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 px-3 py-2 bg-white border-b border-gray-200 shadow-sm">
          {/* Undo / Redo */}
          <ToolbarButton tooltip="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 size={15} />
          </ToolbarButton>

          <Divider />

          {/* Headings */}
          <ToolbarButton tooltip="Heading 1" isActive={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Heading 2" isActive={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Heading 3" isActive={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Normal text" isActive={editor.isActive('paragraph')}
            onClick={() => editor.chain().focus().setParagraph().run()}>
            <Type size={15} />
          </ToolbarButton>

          <Divider />

          {/* Inline marks */}
          <ToolbarButton tooltip="Bold (Ctrl+B)" isActive={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Italic (Ctrl+I)" isActive={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Underline (Ctrl+U)" isActive={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Strikethrough" isActive={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Highlight" isActive={editor.isActive('highlight')}
            onClick={() => editor.chain().focus().toggleHighlight().run()}>
            <Highlighter size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Inline Code" isActive={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}>
            <Code size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Link" isActive={editor.isActive('link')}
            onClick={toggleLink}>
            <LinkIcon size={15} />
          </ToolbarButton>

          <Divider />

          {/* Lists */}
          <ToolbarButton tooltip="Bullet List" isActive={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Numbered List" isActive={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={15} />
          </ToolbarButton>
          <ToolbarButton tooltip="Task List" isActive={editor.isActive('taskList')}
            onClick={() => editor.chain().focus().toggleTaskList().run()}>
            <CheckSquare size={15} />
          </ToolbarButton>

          <Divider />

          {/* Blocks */}
          <ToolbarButton tooltip="Blockquote" isActive={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote size={15} />
          </ToolbarButton>
          <span className="hidden sm:contents">
          <ToolbarButton tooltip="Code Block" isActive={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            <span className="text-xs font-mono font-bold">{`</>`}</span>
          </ToolbarButton>
          </span>
          <ToolbarButton tooltip="Horizontal rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus size={15} />
          </ToolbarButton>
          <span className="hidden sm:contents">
          <ToolbarButton tooltip="Insert table"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <TableIcon size={15} />
          </ToolbarButton>
          </span>
        </div>
      )}

      {/* ── Dark Bubble Menu (appears on text selection) ── */}
      {editor && (
        <BubbleMenu
          editor={editor}
          className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700"
        >
          {[
            { label: <Bold size={14} />, action: 'bold', run: () => editor.chain().focus().toggleBold().run() },
            { label: <Italic size={14} />, action: 'italic', run: () => editor.chain().focus().toggleItalic().run() },
            { label: <UnderlineIcon size={14} />, action: 'underline', run: () => editor.chain().focus().toggleUnderline().run() },
            { label: <Strikethrough size={14} />, action: 'strike', run: () => editor.chain().focus().toggleStrike().run() },
          ].map(({ label, action, run }) => (
            <button key={action} onClick={run} type="button"
              className={`p-1.5 rounded-md transition-colors ${editor.isActive(action) ? 'bg-white text-gray-900' : 'hover:bg-gray-700 text-gray-200'}`}>
              {label}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-600 mx-0.5" />
          <button onClick={() => editor.chain().focus().toggleHighlight().run()} type="button"
            className={`p-1.5 rounded-md transition-colors ${editor.isActive('highlight') ? 'bg-yellow-400 text-gray-900' : 'hover:bg-gray-700 text-gray-200'}`}>
            <Highlighter size={14} />
          </button>
          <button onClick={toggleLink} type="button"
            className={`p-1.5 rounded-md transition-colors ${editor.isActive('link') ? 'bg-white text-gray-900' : 'hover:bg-gray-700 text-gray-200'}`}>
            <LinkIcon size={14} />
          </button>
          <button onClick={() => editor.chain().focus().toggleCode().run()} type="button"
            className={`p-1.5 rounded-md transition-colors ${editor.isActive('code') ? 'bg-white text-gray-900' : 'hover:bg-gray-700 text-gray-200'}`}>
            <Code size={14} />
          </button>
        </BubbleMenu>
      )}

      {/* ── Editor Content Area ── */}
      <div
        className="flex-1 overflow-y-auto cursor-text"
        onClick={() => editor?.chain().focus().run()}
      >
        <div className="max-w-3xl mx-auto px-8 py-8">
          <EditorContent editor={editor} />
        </div>
      </div>

      {isLinkModalOpen && (
        <LinkEditModal
          open={isLinkModalOpen}
          onOpenChange={setIsLinkModalOpen}
          initialUrl={linkInitialUrl}
          hasExistingLink={hasExistingLink}
          onApply={applyLink}
          onRemove={removeLink}
        />
      )}
    </div>
  );
}
