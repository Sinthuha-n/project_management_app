/**
 * Mobile documents explorer aligned with the app's light mobile theme.
 * Design: light surfaces, compact controls, SVG icons, and staggered rows.
 * Performance: parallel initial fetch, memoized filters, callback-stable actions, skeleton loading.
 * CI/CD note: scoped to this file only; no token, API, navigation, test, or workflow changes.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import api from '../../api/axios';
import { T } from '../../constants/tokens';

const { width: SW } = Dimensions.get('window');
const GLASS = {
  border: T.border,
  text: T.textPrimary,
  secondary: T.textSecondary,
  muted: T.textMuted,
  placeholder: T.textMuted,
};
const BG_GRADIENT = [T.bgSecondary, '#FFFFFF', T.bgSecondary] as const;
const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;
const useNativeDriver = Platform.OS !== 'web';

export interface DocFolder {
  id: number;
  name: string;
  parentFolderId?: number | null;
  documentCount?: number;
}

export interface DocItem {
  id: number;
  name: string;
  contentType?: string;
  fileSizeBytes?: number;
  createdAt?: string;
  uploadedBy?: string;
  folderId?: number | null;
}

interface MobileDocsScreenProps {
  projectId: number;
  projectName?: string;
  topOffset?: number;
}

interface GlassIconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  accent?: boolean;
  label?: string;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(contentType?: string): { emoji: string; color: string } {
  const type = (contentType ?? '').toLowerCase();
  if (type.includes('pdf')) return { emoji: '📕', color: '#F87171' };
  if (type.includes('sheet') || type.includes('excel') || type.includes('spreadsheet')) return { emoji: '📊', color: '#34D399' };
  if (type.includes('word') || type.includes('document')) return { emoji: '📝', color: '#60A5FA' };
  if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg')) return { emoji: '🖼️', color: '#A78BFA' };
  return { emoji: '📄', color: '#94A3B8' };
}

const getErrorMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

const SpringTouchable = memo(function SpringTouchable({
  onPress,
  children,
  style,
  disabled = false,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.96, tension: 500, friction: 10, useNativeDriver }).start();
  }, [scale]);
  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, tension: 350, friction: 14, useNativeDriver }).start();
  }, [scale]);

  return (
    <Animated.View style={[styles.springScale, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        disabled={disabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={style}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
});

const FadeInUp = memo(function FadeInUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, delay, useNativeDriver }),
      Animated.spring(translateY, { toValue: 0, delay, tension: 200, friction: 20, useNativeDriver }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [delay, opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
});

const LiquidGlassCard = memo(function LiquidGlassCard({
  children,
  style,
  intensity = 28,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}) {
  return (
    <View style={[styles.card, style]}>
      <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.98)', 'rgba(247,248,250,0.94)']}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.topShine} />
      <View style={styles.cardContent}>{children}</View>
    </View>
  );
});

const SkeletonPulse = memo(function SkeletonPulse({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width: number;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.5] });
  return <Animated.View style={[styles.skeletonPulse, { width, height, borderRadius, opacity }, style]} />;
});

export const DocsSkeleton = memo(function DocsSkeleton() {
  const folderRows = [0, 1, 2];
  const fileRows = [0, 1, 2, 3];

  return (
    <ScrollView pointerEvents="none" contentContainerStyle={styles.docsSkeletonContent} showsVerticalScrollIndicator={false}>
      <View style={styles.skeletonSectionHeader}>
        <SkeletonPulse width={60} height={10} />
        <SkeletonPulse width={24} height={18} borderRadius={9} />
      </View>
      <LiquidGlassCard style={styles.sectionCard}>
        {folderRows.map((row) => (
          <View key={row} style={[styles.skeletonRow, row < folderRows.length - 1 && styles.rowDivider]}>
            <SkeletonPulse width={40} height={40} borderRadius={12} />
            <View style={styles.skeletonTextStack}>
              <SkeletonPulse width={SW * 0.4} height={12} />
              <SkeletonPulse width={SW * 0.22} height={10} />
            </View>
            <SkeletonPulse width={28} height={28} borderRadius={14} />
          </View>
        ))}
      </LiquidGlassCard>
      <View style={styles.skeletonSectionHeader}>
        <SkeletonPulse width={60} height={10} />
        <SkeletonPulse width={24} height={18} borderRadius={9} />
      </View>
      <LiquidGlassCard style={styles.sectionCard}>
        {fileRows.map((row) => (
          <View key={row} style={[styles.skeletonRow, row < fileRows.length - 1 && styles.rowDivider]}>
            <SkeletonPulse width={40} height={40} borderRadius={12} />
            <View style={styles.skeletonTextStack}>
              <SkeletonPulse width={SW * 0.4} height={12} />
              <SkeletonPulse width={SW * 0.22} height={10} />
            </View>
            <View style={styles.skeletonActions}>
              <SkeletonPulse width={28} height={28} borderRadius={14} />
              <SkeletonPulse width={28} height={28} borderRadius={14} />
            </View>
          </View>
        ))}
      </LiquidGlassCard>
    </ScrollView>
  );
});

const IconSearch = memo(function IconSearch() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={8} stroke={T.textMuted} strokeWidth={2.5} />
      <Path d="m21 21-4.3-4.3" stroke={T.textMuted} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
});

const IconBack = memo(function IconBack() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 5l-7 7 7 7" stroke={T.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

export const IconPlus = memo(function IconPlus() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M12 5v14" stroke={T.primary} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
});

const IconTrash = memo(function IconTrash() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" stroke="#F87171" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

const IconDownload = memo(function IconDownload() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={T.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

const IconUpload = memo(function IconUpload() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke={T.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

const IconFolder = memo(function IconFolder({ color = '#F59E0B' }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill={color + '30'}>
      <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

const IconChevronRight = memo(function IconChevronRight() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="m9 18 6-6-6-6" stroke={T.textMuted} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

const IconNewFolder = memo(function IconNewFolder() {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
      <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2zM12 11v6M9 14h6" stroke={T.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

export const IconFile = memo(function IconFile() {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" stroke="#60A5FA" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

export const IconStar = memo(function IconStar({ filled, color = '#F59E0B' }: { filled: boolean; color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

export const IconCheck = memo(function IconCheck() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke="#34D399" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

const GlassIconButton = memo(function GlassIconButton({
  icon,
  onPress,
  accent = false,
  label,
  disabled = false,
  accessibilityLabel,
  style,
}: GlassIconButtonProps) {
  return (
    <SpringTouchable
      onPress={onPress}
      disabled={disabled}
      style={[styles.glassIconButton, label ? styles.glassIconWithLabel : styles.glassIconSquare, accent && styles.glassIconAccent, style]}
    >
      <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={accent ? [T.primaryLight, '#FFFFFF'] : ['#FFFFFF', T.bgSecondary]}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={StyleSheet.absoluteFillObject}
      />
      <View accessibilityLabel={accessibilityLabel} style={styles.glassIconContent}>
        {icon}
        {label ? <Text style={styles.glassIconLabel}>{label}</Text> : null}
      </View>
    </SpringTouchable>
  );
});

const SectionHeader = memo(function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionBadge}>
        <Text style={styles.sectionBadgeText}>{count}</Text>
      </View>
    </View>
  );
});

const EmptyState = memo(function EmptyState({
  inFolder,
  searchQuery,
  onCreateFolder,
  onUpload,
}: {
  inFolder: boolean;
  searchQuery: string;
  onCreateFolder: () => void;
  onUpload: () => void;
}) {
  const hasSearch = searchQuery.trim().length > 0;
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{inFolder ? '📂' : hasSearch ? '🔎' : '🗂️'}</Text>
      <Text style={styles.emptyTitle}>{hasSearch ? 'No matches found' : inFolder ? 'This folder is empty' : 'No documents yet'}</Text>
      <Text style={styles.emptySubtitle}>
        {hasSearch ? 'Try a different search term.' : inFolder ? 'Upload files into this folder.' : 'Create folders or upload files for this project.'}
      </Text>
      {!hasSearch ? (
        <View style={styles.emptyButtons}>
          {!inFolder ? (
            <GlassIconButton accessibilityLabel="Create folder" icon={<IconNewFolder />} label="New Folder" onPress={onCreateFolder} />
          ) : null}
          <GlassIconButton accessibilityLabel="Upload file" accent icon={<IconUpload />} label="Upload File" onPress={onUpload} />
        </View>
      ) : null}
    </View>
  );
});

export default function MobileDocsScreen({ projectId, projectName, topOffset = 0 }: MobileDocsScreenProps) {
  const [view, setView] = useState<'explorer' | 'create_folder'>('explorer');
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [activeFolderName, setActiveFolderName] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'folders'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const inFolder = activeFolderId !== null;
  const headerTitle = inFolder ? activeFolderName : projectName ? `${projectName} Docs` : 'Documents';
  const isSkeleton = initialLoading || loadingDocs;

  const fetchFolders = useCallback(async (): Promise<DocFolder[]> => {
    const res = await api.get<DocFolder[]>(`/api/projects/${projectId}/folders`);
    return res.data ?? [];
  }, [projectId]);

  const fetchDocuments = useCallback(async (folderId: number | null): Promise<DocItem[]> => {
    const params: { folderId?: number } = {};
    if (folderId !== null) params.folderId = folderId;
    const res = await api.get<DocItem[]>(`/api/projects/${projectId}/documents`, { params });
    return res.data ?? [];
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    setError(null);
    Promise.all([fetchFolders(), fetchDocuments(null)])
      .then(([nextFolders, nextDocuments]) => {
        if (cancelled) return;
        setFolders(nextFolders);
        setDocuments(nextDocuments);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load documents.'));
      })
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchFolders, fetchDocuments]);

  const filteredFolders = useMemo(
    () => folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [folders, searchQuery]
  );
  const filteredDocs = useMemo(
    () => documents.filter((d) => d.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [documents, searchQuery]
  );

  const handleOpenFolder = useCallback(async (folder: DocFolder) => {
    setActiveFolderId(folder.id);
    setActiveFolderName(folder.name);
    setSearchQuery('');
    setLoadingDocs(true);
    setError(null);
    try {
      setDocuments(await fetchDocuments(folder.id));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load folder documents.'));
    } finally {
      setLoadingDocs(false);
    }
  }, [fetchDocuments]);

  const handleBackToRoot = useCallback(async () => {
    setActiveFolderId(null);
    setActiveFolderName('');
    setSearchQuery('');
    setLoadingDocs(true);
    setError(null);
    try {
      setDocuments(await fetchDocuments(null));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to load documents.'));
    } finally {
      setLoadingDocs(false);
    }
  }, [fetchDocuments]);

  const handleCreateFolder = useCallback(async () => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      Alert.alert('Validation', 'Please enter a folder name.');
      return;
    }
    setCreatingFolder(true);
    setError(null);
    try {
      await api.post<DocFolder>(`/api/projects/${projectId}/folders`, { name: trimmedName, parentFolderId: null });
      setFolders(await fetchFolders());
      setNewFolderName('');
      setView('explorer');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create folder.'));
      Alert.alert('Error', getErrorMessage(err, 'Failed to create folder.'));
    } finally {
      setCreatingFolder(false);
    }
  }, [fetchFolders, newFolderName, projectId]);

  const handleDeleteFolder = useCallback((folder: DocFolder) => {
    Alert.alert('Delete Folder', `Delete "${folder.name}" and all its contents?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete<void>(`/api/projects/${projectId}/folders/${folder.id}`);
            setFolders(await fetchFolders());
            if (activeFolderId === folder.id) {
              await handleBackToRoot();
            }
          } catch (err: unknown) {
            Alert.alert('Error', getErrorMessage(err, 'Failed to delete folder.'));
          }
        },
      },
    ]);
  }, [activeFolderId, fetchFolders, handleBackToRoot, projectId]);

  const handleUploadDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if ((result as { canceled?: boolean }).canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setUploading(true);
      setError(null);
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? 'application/octet-stream',
      } as unknown as Blob);
      if (activeFolderId !== null) formData.append('folderId', String(activeFolderId));
      await api.post<{ id: number; title: string; content?: string }>(
        `/api/projects/${projectId}/documents/upload`,
        formData,
      );
      setDocuments(await fetchDocuments(activeFolderId));
    } catch (err: unknown) {
      if ((err as { canceled?: boolean })?.canceled) return;
      setError(getErrorMessage(err, 'Failed to upload document.'));
    } finally {
      setUploading(false);
    }
  }, [activeFolderId, fetchDocuments, projectId]);

  const handleDownloadDocument = useCallback(async (doc: DocItem) => {
    try {
      const res = await api.get<{ downloadUrl?: string }>(`/api/projects/${projectId}/documents/${doc.id}/download-url`);
      if (res.data.downloadUrl) await Linking.openURL(res.data.downloadUrl);
    } catch (err: unknown) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to download document.'));
    }
  }, [projectId]);

  const handleDeleteDocument = useCallback((doc: DocItem) => {
    Alert.alert('Delete Document', `Delete "${doc.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete<void>(`/api/projects/${projectId}/documents/${doc.id}`);
            setDocuments(await fetchDocuments(activeFolderId));
          } catch (err: unknown) {
            Alert.alert('Error', getErrorMessage(err, 'Failed to delete document.'));
          }
        },
      },
    ]);
  }, [activeFolderId, fetchDocuments, projectId]);

  const renderTabs = () => (
    <View style={styles.tabRow}>
      {(['all', 'folders'] as const).map((tab) => {
        const active = activeTab === tab;
        return (
          <SpringTouchable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tabButton, active && styles.tabButtonActive]}>
            {active ? <LinearGradient colors={[T.primaryLight, '#FFFFFF']} style={StyleSheet.absoluteFillObject} /> : null}
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab === 'all' ? 'All' : 'Folders'}</Text>
          </SpringTouchable>
        );
      })}
    </View>
  );

  const renderExplorerView = () => {
    const empty = (!inFolder && activeTab !== 'folders' && filteredFolders.length === 0 && filteredDocs.length === 0)
      || (!inFolder && activeTab === 'folders' && filteredFolders.length === 0)
      || (inFolder && filteredDocs.length === 0);

    return (
      <View style={styles.fullFlex}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {inFolder ? <GlassIconButton accessibilityLabel="Back to root" icon={<IconBack />} onPress={handleBackToRoot} /> : null}
            <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
          </View>
          <View style={styles.headerActions}>
            {!inFolder ? <GlassIconButton accessibilityLabel="New folder" icon={<IconNewFolder />} onPress={() => setView('create_folder')} /> : null}
            <GlassIconButton
              accessibilityLabel="Upload document"
              accent
              disabled={uploading}
              icon={uploading ? <ActivityIndicator color={T.primary} size="small" /> : <IconUpload />}
              onPress={handleUploadDocument}
            />
          </View>
        </View>

        <View style={styles.searchBar}>
          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['#FFFFFF', T.bgSecondary]} style={StyleSheet.absoluteFillObject} />
          <IconSearch />
          <TextInput
            clearButtonMode="while-editing"
            onChangeText={setSearchQuery}
            placeholder={inFolder ? 'Search files...' : 'Search documents & folders...'}
            placeholderTextColor={GLASS.placeholder}
            style={styles.searchInput}
            value={searchQuery}
          />
        </View>

        {!inFolder ? renderTabs() : null}

        {isSkeleton ? (
          <DocsSkeleton />
        ) : (
          <ScrollView contentContainerStyle={styles.contentScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!inFolder && (activeTab === 'all' || activeTab === 'folders') && filteredFolders.length > 0 ? (
              <FadeInUp>
                <SectionHeader label="FOLDERS" count={filteredFolders.length} />
                <LiquidGlassCard style={styles.sectionCard}>
                  {filteredFolders.map((folder, idx) => (
                    <FadeInUp key={folder.id} delay={idx * 25}>
                      <View style={[styles.row, idx < filteredFolders.length - 1 && styles.rowDivider]}>
                        <SpringTouchable onPress={() => handleOpenFolder(folder)} style={styles.rowLeft}>
                          <View style={styles.folderIconWrap}><IconFolder /></View>
                          <View style={styles.rowTextWrap}>
                            <Text style={styles.rowTitle} numberOfLines={1}>{folder.name}</Text>
                            {folder.documentCount !== undefined ? <Text style={styles.rowMeta}>{folder.documentCount} documents</Text> : null}
                          </View>
                        </SpringTouchable>
                        <View style={styles.rowActions}>
                          <GlassIconButton accessibilityLabel={`Delete ${folder.name}`} icon={<IconTrash />} onPress={() => handleDeleteFolder(folder)} />
                          <IconChevronRight />
                        </View>
                      </View>
                    </FadeInUp>
                  ))}
                </LiquidGlassCard>
              </FadeInUp>
            ) : null}

            {activeTab !== 'folders' && filteredDocs.length > 0 ? (
              <FadeInUp delay={inFolder ? 0 : 80}>
                {!inFolder ? <SectionHeader label="FILES" count={filteredDocs.length} /> : null}
                <LiquidGlassCard style={styles.sectionCard}>
                  {filteredDocs.map((doc, idx) => {
                    const fileIcon = getFileIcon(doc.contentType);
                    return (
                      <FadeInUp key={doc.id} delay={idx * 25}>
                        <View style={[styles.row, idx < filteredDocs.length - 1 && styles.rowDivider]}>
                          <View style={styles.rowLeft}>
                            <View style={[styles.fileIconWrap, { backgroundColor: fileIcon.color + '22' }]}>
                              <Text style={[styles.fileEmoji, { color: fileIcon.color }]}>{fileIcon.emoji}</Text>
                            </View>
                            <View style={styles.rowTextWrap}>
                              <Text style={styles.rowTitle} numberOfLines={1}>{doc.name}</Text>
                              <Text style={styles.rowMeta}>{formatBytes(doc.fileSizeBytes)}</Text>
                            </View>
                          </View>
                          <View style={styles.rowActions}>
                            <GlassIconButton accessibilityLabel={`Download ${doc.name}`} icon={<IconDownload />} onPress={() => handleDownloadDocument(doc)} />
                            <GlassIconButton accessibilityLabel={`Delete ${doc.name}`} icon={<IconTrash />} onPress={() => handleDeleteDocument(doc)} />
                          </View>
                        </View>
                      </FadeInUp>
                    );
                  })}
                </LiquidGlassCard>
              </FadeInUp>
            ) : null}

            {empty ? <EmptyState inFolder={inFolder} searchQuery={searchQuery} onCreateFolder={() => setView('create_folder')} onUpload={handleUploadDocument} /> : null}
            {uploading ? (
              <View style={styles.uploadPill}>
                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient colors={['#FFFFFF', T.bgSecondary]} style={StyleSheet.absoluteFillObject} />
                <ActivityIndicator color={T.primary} size="small" />
                <Text style={styles.uploadText}>Uploading file...</Text>
              </View>
            ) : null}
            {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderCreateFolderView = () => (
    <View style={styles.fullFlex}>
      <View style={styles.createHeader}>
        <GlassIconButton accessibilityLabel="Back to documents" icon={<IconBack />} onPress={() => setView('explorer')} />
        <Text style={styles.createHeaderTitle}>New Folder</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.createBody}>
        <Text style={styles.inputLabel}>FOLDER NAME</Text>
        <LiquidGlassCard>
          <TextInput
            autoFocus
            onChangeText={setNewFolderName}
            onSubmitEditing={handleCreateFolder}
            placeholder="Design files, specs, assets..."
            placeholderTextColor={GLASS.placeholder}
            returnKeyType="done"
            style={styles.folderInput}
            value={newFolderName}
          />
        </LiquidGlassCard>
        <SpringTouchable disabled={creatingFolder} onPress={handleCreateFolder} style={styles.createButton}>
          <LinearGradient colors={[T.primary, T.primaryHover]} style={StyleSheet.absoluteFillObject} />
          {creatingFolder ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.createButtonText}>Create Folder</Text>}
        </SpringTouchable>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={BG_GRADIENT} style={[styles.container, { paddingTop: topOffset }]}>
      {view === 'create_folder' ? renderCreateFolderView() : renderExplorerView()}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fullFlex: { flex: 1 },
  springScale: { alignSelf: 'auto' },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.bg,
    ...Platform.select({ ios: { shadowColor: '#64748B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 18 }, android: { elevation: 3 } }),
  },
  topShine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: '#FFFFFF' },
  cardContent: { paddingHorizontal: 16, paddingVertical: 4 },
  skeletonPulse: { backgroundColor: '#E5E7EB' },
  docsSkeletonContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  skeletonSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginBottom: 8, marginTop: 8 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  skeletonTextStack: { flex: 1, gap: 6 },
  skeletonActions: { flexDirection: 'row', gap: 6 },
  glassIconButton: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  glassIconSquare: { width: 40, height: 40 },
  glassIconWithLabel: { minHeight: 40, paddingHorizontal: 12 },
  glassIconAccent: { borderColor: T.primaryMuted },
  glassIconContent: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  glassIconLabel: { fontSize: 11, fontWeight: '700', color: T.primary },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginBottom: 8 },
  sectionLabel: { color: T.textSecondary, fontSize: 10, letterSpacing: 1.8, fontWeight: '800' },
  sectionBadge: { backgroundColor: T.primaryLight, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  sectionBadgeText: { fontSize: 10, fontWeight: '700', color: T.primary },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBar: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, color: T.textPrimary, padding: 0, fontSize: 14, fontWeight: '600' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  tabButton: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: T.border, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 9 },
  tabButtonActive: { borderColor: T.primaryMuted },
  tabText: { fontSize: 12, fontWeight: '800', color: T.textSecondary },
  tabTextActive: { color: T.primary },
  contentScroll: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionCard: { marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.borderLight },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTextWrap: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: GLASS.text },
  rowMeta: { marginTop: 3, fontSize: 12, color: GLASS.secondary },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  folderIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center' },
  fileIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fileEmoji: { fontSize: 20 },
  emptyState: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 40, gap: 8 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: T.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: T.textSecondary, textAlign: 'center', lineHeight: 19 },
  emptyButtons: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  uploadPill: { marginTop: 8, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: T.border, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  uploadText: { color: T.textPrimary, fontWeight: '700', fontSize: 13 },
  errorBanner: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.28)', borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 10 },
  errorText: { color: '#F87171', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  createHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  createHeaderTitle: { fontSize: 16, fontWeight: '800', color: T.textPrimary },
  headerSpacer: { width: 40 },
  createBody: { paddingHorizontal: 20, paddingTop: 32 },
  inputLabel: { color: T.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 8 },
  folderInput: { fontSize: 15, color: T.textPrimary, paddingVertical: 14, paddingHorizontal: 0 },
  createButton: {
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    ...Platform.select({ ios: { shadowColor: '#155DFC', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16 }, android: { elevation: 5 } }),
  },
  createButtonText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
