import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Animated,
  TouchableOpacity, RefreshControl, TextInput, Modal,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { usePortfolios } from '../../src/hooks/usePortfolios';
import PortfolioCard from '../../src/components/portfolio/PortfolioCard';

// ── Staggered fade-slide ──────────────────────────────────────────────────────
function FadeSlideIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, tension: 160, friction: 18 }),
    ]).start();
  }, [delay, opacity, translateY]);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT_COLORS = ['#155DFC', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4'];
const EMOJIS = ['📁', '🚀', '💼', '⚡', '🎯', '💡', '🌟', '🔥', '🏆', '📊'];

// ── Create Portfolio Sheet ────────────────────────────────────────────────────
function CreateSheet({ visible, onClose, onCreate }: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, color: string, emoji: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(ACCENT_COLORS[0]);
  const [emoji, setEmoji] = useState('');
  const [loading, setLoading] = useState(false);
  const translateY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 600,
      useNativeDriver: true,
      tension: 320,
      friction: 30,
    }).start();
    if (!visible) { setName(''); setDescription(''); setColor(ACCENT_COLORS[0]); setEmoji(''); }
  }, [translateY, visible]);

  const submit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try { await onCreate(name.trim(), description.trim(), color, emoji); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={sh.outer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={sh.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[sh.sheet, { transform: [{ translateY }] }]}>
          {/* Accent bar */}
          <View style={[sh.accentBar, { backgroundColor: color }]} />
          <View style={sh.handle} />

          <Text style={sh.title}>New Portfolio</Text>

          {/* Emoji row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sh.emojiScroll} contentContainerStyle={sh.emojiContent}>
            {EMOJIS.map(e => (
              <TouchableOpacity key={e} onPress={() => setEmoji(emoji === e ? '' : e)}
                style={[sh.emojiBtn, emoji === e && { borderColor: color, borderWidth: 2 }]}>
                <Text style={sh.emojiText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Portfolio name *"
            placeholderTextColor="#9CA3AF"
            style={sh.input}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Description (optional)"
            placeholderTextColor="#9CA3AF"
            style={[sh.input, { marginBottom: 16 }]}
          />

          <Text style={sh.colorLabel}>Accent color</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sh.colorRow}>
            {ACCENT_COLORS.map(c => (
              <TouchableOpacity key={c} onPress={() => setColor(c)}
                style={[sh.colorDot, { backgroundColor: c }, color === c && sh.colorDotActive]} />
            ))}
          </ScrollView>

          <View style={sh.actions}>
            <TouchableOpacity style={sh.cancelBtn} onPress={onClose}>
              <Text style={sh.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[sh.createBtn, { backgroundColor: color }, (!name.trim() || loading) && { opacity: 0.5 }]}
              onPress={submit}
              disabled={loading || !name.trim()}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={sh.createText}>Create</Text>
              }
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function PortfoliosScreen() {
  const router = useRouter();
  const { portfolios, loading, error, refresh, create } = usePortfolios();
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = async (name: string, description: string, color: string, emoji: string) => {
    await create({ name, description: description || undefined, color, emoji: emoji || undefined });
    setShowCreate(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Portfolios</Text>
          <Text style={s.subtitle}>
            {portfolios.length > 0
              ? `${portfolios.length} portfolio${portfolios.length !== 1 ? 's' : ''}`
              : 'Aggregate projects and track progress'}
          </Text>
        </View>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
          <Text style={s.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* ── View tabs ── */}
      <View style={s.tabsWrapper}>
        <View style={s.tabsContainer}>
          <TouchableOpacity
            style={s.tabBtn}
            onPress={() => router.push('/(tabs)/spaces' as never)}
            activeOpacity={0.8}
          >
            <Text style={s.tabBtnText}>All Projects</Text>
          </TouchableOpacity>
          <View style={[s.tabBtn, s.tabBtnActive]}>
            <Text style={[s.tabBtnText, s.tabBtnTextActive]}>Portfolios</Text>
          </View>
        </View>
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#155DFC" colors={['#155DFC']} />
        }
      >
        {loading && portfolios.length === 0 ? (
          <View style={s.centerState}>
            <ActivityIndicator color="#155DFC" size="large" />
          </View>
        ) : error ? (
          <View style={s.centerState}>
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity onPress={refresh} style={s.retryBtn}>
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : portfolios.length === 0 ? (
          <FadeSlideIn delay={80}>
            <View style={s.emptyState}>
              <View style={s.emptyIcon}>
                <Text style={s.emptyEmoji}>📁</Text>
              </View>
              <Text style={s.emptyTitle}>No portfolios yet</Text>
              <Text style={s.emptyDesc}>
                Group your projects to track cross-project health and progress.
              </Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
                <Text style={s.emptyBtnText}>Create Portfolio</Text>
              </TouchableOpacity>
            </View>
          </FadeSlideIn>
        ) : (
          portfolios.map((p, i) => (
            <FadeSlideIn key={p.id} delay={i * 60 + 60}>
              <PortfolioCard portfolio={p} />
            </FadeSlideIn>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <CreateSheet visible={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
    </SafeAreaView>
  );
}

// ── Screen styles (light theme) ───────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  title:    { fontSize: 24, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  newBtn: {
    marginTop: 4,
    backgroundColor: '#155DFC',
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 12,
    ...Platform.select({
      ios: { shadowColor: '#155DFC', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  newBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  tabsWrapper: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  tabsContainer: {
    flexDirection: 'row', backgroundColor: '#F0F0F5',
    borderRadius: 12, padding: 4,
  },
  tabBtn: {
    flex: 1, paddingVertical: 9, alignItems: 'center', justifyContent: 'center', borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3 },
      android: { elevation: 2 },
    }),
  },
  tabBtnText:       { fontSize: 13, fontWeight: '500', color: '#6B6F7B' },
  tabBtnTextActive: { color: '#155DFC', fontWeight: '700' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  centerState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  errorText:   { color: '#FF5C5C', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  retryBtn:    { backgroundColor: '#EBF2FF', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText:   { color: '#155DFC', fontWeight: '600', fontSize: 14 },

  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: '#EBF2FF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyEmoji:   { fontSize: 32 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  emptyDesc:    { fontSize: 13, color: '#6B6F7B', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:     {
    backgroundColor: '#155DFC', borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});

// ── Create sheet styles (light theme) ─────────────────────────────────────────
const sh = StyleSheet.create({
  outer:    { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
    borderWidth: 1, borderColor: '#E8E8ED',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16 },
      android: { elevation: 12 },
    }),
  },
  accentBar:    { height: 3, borderRadius: 2, marginBottom: 10 },
  handle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E8E8ED', alignSelf: 'center', marginBottom: 16 },
  title:        { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  emojiScroll:  { marginBottom: 14 },
  emojiContent: { gap: 8, paddingRight: 8 },
  emojiBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#F7F8FA',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E8E8ED',
  },
  emojiText:     { fontSize: 20 },
  input: {
    backgroundColor: '#F7F8FA', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: '#1A1A2E', fontSize: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E8E8ED',
  },
  colorLabel:    { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 8 },
  colorRow:      { gap: 8, marginBottom: 20, paddingRight: 8 },
  colorDot:      { width: 28, height: 28, borderRadius: 14 },
  colorDotActive:{ transform: [{ scale: 1.25 }], borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)' },
  actions:       { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    alignItems: 'center', backgroundColor: '#F7F8FA',
    borderWidth: 1, borderColor: '#E8E8ED',
  },
  cancelText:  { color: '#6B6F7B', fontWeight: '600', fontSize: 14 },
  createBtn:   { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  createText:  { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
