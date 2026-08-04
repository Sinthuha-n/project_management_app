import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type {
  CollaboratorPermission,
  GitHubIssue,
  GitHubRepository,
  SavedGitHubAccount,
} from '../../services/githubMobileService';

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}><Text style={styles.title}>{title}</Text><TouchableOpacity onPress={onClose}><MaterialCommunityIcons name="close" size={22} color="#C9D1D9" /></TouchableOpacity></View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function RepositoryPicker({ visible, repositories, loading, current, onClose, onSelect }: {
  visible: boolean; repositories: GitHubRepository[]; loading: boolean; current?: string; onClose: () => void; onSelect: (repo: GitHubRepository) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => repositories.filter(repo => repo.full_name.toLowerCase().includes(query.toLowerCase())), [query, repositories]);
  return (
    <Sheet visible={visible} title="Choose repository" onClose={onClose}>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search owner or repository" placeholderTextColor="#6E7681" style={styles.input} />
      {loading ? <ActivityIndicator color="#58A6FF" style={styles.loader} /> : (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {filtered.map(repo => (
            <TouchableOpacity key={repo.id} disabled={repo.full_name === current} onPress={() => onSelect(repo)} style={styles.listItem}>
              <MaterialCommunityIcons name={repo.private ? 'lock-outline' : 'earth'} size={18} color="#8B949E" />
              <View style={{ flex: 1 }}><Text style={styles.itemTitle}>{repo.full_name}</Text><Text style={styles.itemSub}>{repo.default_branch} · {repo.private ? 'Private' : 'Public'}</Text></View>
              {repo.full_name === current && <MaterialCommunityIcons name="check" size={18} color="#3FB950" />}
            </TouchableOpacity>
          ))}
          {filtered.length === 0 && <Text style={styles.empty}>No repositories found.</Text>}
        </ScrollView>
      )}
    </Sheet>
  );
}

export function AccountPicker({ visible, accounts, onClose, onSelect, onAdd }: {
  visible: boolean; accounts: SavedGitHubAccount[]; onClose: () => void; onSelect: (login: string) => void; onAdd: () => void;
}) {
  return (
    <Sheet visible={visible} title="Choose GitHub account" onClose={onClose}>
      <ScrollView style={styles.list}>
        {accounts.map(account => (
          <TouchableOpacity key={account.login} onPress={() => onSelect(account.login)} style={styles.listItem}>
            {account.avatarUrl ? <Image source={{ uri: account.avatarUrl }} style={styles.avatar} /> : <MaterialCommunityIcons name="github" size={28} color="#C9D1D9" />}
            <View><Text style={styles.itemTitle}>{account.name || account.login}</Text><Text style={styles.itemSub}>@{account.login}</Text></View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={onAdd} style={styles.listItem}><MaterialCommunityIcons name="account-plus-outline" size={24} color="#58A6FF" /><Text style={styles.addText}>Add another account</Text></TouchableOpacity>
      </ScrollView>
    </Sheet>
  );
}

function memberIdentifier(member: any): string | null {
  return member.user?.githubUsername ?? member.githubUsername ?? member.user?.githubEmail ?? member.githubEmail ?? null;
}
function memberName(member: any): string {
  return member.user?.username ?? member.username ?? member.user?.email ?? member.email ?? 'Team member';
}

export function CollaboratorInviteSheet({ visible, members, loading, error, onClose, onInvite }: {
  visible: boolean; members: any[]; loading: boolean; error?: string | null; onClose: () => void; onInvite: (identifier: string, permission: CollaboratorPermission) => void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [permission, setPermission] = useState<CollaboratorPermission>('push');
  return (
    <Sheet visible={visible} title="Invite GitHub collaborator" onClose={onClose}>
      <TextInput value={identifier} onChangeText={setIdentifier} placeholder="GitHub username or email" placeholderTextColor="#6E7681" autoCapitalize="none" style={styles.input} />
      <Text style={styles.label}>Project members</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {members.map((member, index) => {
          const value = memberIdentifier(member);
          return <TouchableOpacity key={member.id ?? index} disabled={!value} onPress={() => value && setIdentifier(value)} style={[styles.chip, !value && styles.disabled]}><Text style={styles.chipText}>{memberName(member)}</Text></TouchableOpacity>;
        })}
      </ScrollView>
      <Text style={styles.label}>Permission</Text>
      <View style={styles.permissions}>{(['pull', 'triage', 'push', 'maintain'] as const).map(item => <TouchableOpacity key={item} onPress={() => setPermission(item)} style={[styles.chip, permission === item && styles.selected]}><Text style={styles.chipText}>{item}</Text></TouchableOpacity>)}</View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity disabled={loading || !identifier.trim()} onPress={() => onInvite(identifier, permission)} style={[styles.primary, (!identifier.trim() || loading) && styles.disabled]}>{loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Send invitation</Text>}</TouchableOpacity>
    </Sheet>
  );
}

export function ImportIssueSheet({ visible, issue, loading, error, onClose, onImport }: {
  visible: boolean; issue: GitHubIssue | null; loading: boolean; error?: string | null; onClose: () => void; onImport: () => void;
}) {
  return (
    <Sheet visible={visible} title="Import as task" onClose={onClose}>
      {issue && <View style={styles.preview}><Text style={styles.itemSub}>Issue #{issue.number} · {issue.state}</Text><Text style={styles.previewTitle}>{issue.title}</Text><Text style={styles.previewBody} numberOfLines={5}>{issue.body?.trim() || 'No description provided.'}</Text><View style={styles.permissions}>{issue.labels.map(label => <Text key={label.name} style={styles.chipText}>{label.name}</Text>)}</View></View>}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity disabled={loading || !issue} onPress={onImport} style={[styles.primary, (loading || !issue) && styles.disabled]}>{loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Create Planora task</Text>}</TouchableOpacity>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(1,4,9,.68)' },
  sheet: { maxHeight: '85%', minHeight: 260, backgroundColor: '#161B22', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: '#30363D', padding: 18, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, title: { color: '#F0F6FC', fontSize: 18, fontWeight: '800' },
  input: { color: '#F0F6FC', backgroundColor: '#0D1117', borderWidth: 1, borderColor: '#30363D', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 12, marginBottom: 12 },
  loader: { margin: 30 }, list: { maxHeight: 480 }, listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(240,246,252,.08)' },
  itemTitle: { color: '#F0F6FC', fontSize: 14, fontWeight: '700' }, itemSub: { color: '#8B949E', fontSize: 11, marginTop: 3 }, empty: { color: '#8B949E', textAlign: 'center', padding: 28 },
  avatar: { width: 36, height: 36, borderRadius: 18 }, addText: { color: '#58A6FF', fontWeight: '700' }, label: { color: '#8B949E', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginTop: 6, marginBottom: 8 },
  chips: { gap: 7, paddingBottom: 8 }, permissions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { borderWidth: 1, borderColor: '#30363D', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 }, selected: { borderColor: '#58A6FF', backgroundColor: 'rgba(88,166,255,.16)' }, chipText: { color: '#C9D1D9', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }, disabled: { opacity: .4 },
  primary: { marginTop: 18, backgroundColor: '#1F6FEB', borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#FFF', fontSize: 14, fontWeight: '800' }, error: { color: '#F85149', fontSize: 12, marginTop: 12 },
  preview: { borderWidth: 1, borderColor: '#30363D', borderRadius: 16, backgroundColor: '#0D1117', padding: 14 }, previewTitle: { color: '#F0F6FC', fontSize: 16, fontWeight: '800', marginTop: 8 }, previewBody: { color: '#8B949E', fontSize: 12, lineHeight: 18, marginVertical: 10 },
});
