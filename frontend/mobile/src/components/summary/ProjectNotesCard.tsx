/**
 * ProjectNotesCard — Mobile-native editable project note.
 * Reads & writes the project description field (web-compatible '|||AUTHOR:' format).
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import api from '../../api/axios';

const PRIMARY = '#155DFC';
const AMBER   = '#F59E0B';
const DELIMITER = '|||AUTHOR:';

function parseNote(raw: string) {
  if (!raw) return { text: '', author: '' };
  const parts = raw.split(DELIMITER);
  return parts.length >= 2 ? { text: parts[0], author: parts[1] } : { text: raw, author: '' };
}

function serializeNote(text: string, author: string) {
  return author ? text + DELIMITER + author : text;
}

export function ProjectNotesCard({
  projectId, defaultNote = '',
}: { projectId: number; defaultNote?: string }) {
  const parsed = parseNote(defaultNote);
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState(parsed.text);
  const [isSaving, setIsSaving] = useState(false);
  const [authorName, setAuthorName] = useState('Team Member');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  // Fetch current user name for author attribution
  useEffect(() => {
    api.get('/api/user/me').then(res => {
      const u = res.data;
      setAuthorName(u?.fullName || u?.username || 'Team Member');
    }).catch(() => {});
  }, []);

  // Sync when prop changes (e.g. after refresh)
  useEffect(() => {
    if (!isEditing) setNote(parseNote(defaultNote).text);
  }, [defaultNote, isEditing]);

  // Fade in animation
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handleEdit = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSave = async () => {
    if (note === parsed.text) { setIsEditing(false); return; }
    setIsSaving(true);
    try {
      await api.patch(`/api/projects/${projectId}`, {
        description: serializeNote(note, authorName),
      });
      setIsEditing(false);
    } catch {
      Alert.alert('Error', 'Failed to save note. Please try again.');
      setNote(parsed.text);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNote(parsed.text);
    setIsEditing(false);
  };

  return (
    <Animated.View style={[st.wrap, { opacity: fadeAnim }]}>
      {/* Author line */}
      {!isEditing && parsed.author ? (
        <Text style={st.author}>Last edited by <Text style={st.authorName}>{parsed.author}</Text></Text>
      ) : null}

      {/* Edit / Save button */}
      <View style={st.toolbar}>
        {isEditing ? (
          <View style={st.toolbarRow}>
            <TouchableOpacity style={st.cancelBtn} onPress={handleCancel}>
              <Text style={st.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.saveBtn} onPress={handleSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M20 6L9 17l-5-5" />
                  </Svg>
                  <Text style={st.saveText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={st.editBtn} onPress={handleEdit}>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </Svg>
            <Text style={st.editText}>Edit Note</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Note content */}
      {isEditing ? (
        <TextInput
          ref={inputRef}
          value={note}
          onChangeText={setNote}
          placeholder="Jot down important rules, goals, or notes for this project..."
          placeholderTextColor="#CBD5E1"
          multiline
          style={st.input}
          textAlignVertical="top"
        />
      ) : (
        <TouchableOpacity onPress={handleEdit} activeOpacity={0.85}>
          <Text style={note ? st.noteText : st.placeholder}>
            {note || 'Tap to write a shared project note or summary...'}
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: 10 },
  author: { fontSize: 10, fontWeight: '500', color: '#CBD5E1', fontStyle: 'italic' },
  authorName: { fontWeight: '700', color: '#94A3B8' },

  toolbar: {},
  toolbarRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },

  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
  },
  editText: { fontSize: 11, fontWeight: '700', color: AMBER },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
    backgroundColor: PRIMARY, minWidth: 72, justifyContent: 'center',
  },
  saveText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  cancelBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 11, fontWeight: '700', color: '#64748B' },

  noteText: {
    fontSize: 13, fontWeight: '500', color: '#334155', lineHeight: 21,
  },
  placeholder: {
    fontSize: 13, fontWeight: '400', color: '#CBD5E1', fontStyle: 'italic', lineHeight: 21,
  },
  input: {
    fontSize: 13, fontWeight: '500', color: '#334155', lineHeight: 21,
    backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12, minHeight: 90,
    borderWidth: 1, borderColor: '#FDE68A',
  },
});
