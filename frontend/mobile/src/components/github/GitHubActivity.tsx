import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type {
  GitHubCommit,
  GitHubIssue,
  GitHubNotification,
  GitHubPullRequest,
} from '../../services/githubMobileService';

type Tab = 'prs' | 'commits' | 'issues';
const PAGE_SIZE = 8;

function relativeTime(value?: string): string {
  if (!value) return '';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export async function openGitHubUrl(url?: string): Promise<void> {
  if (!url || !/^https:\/\/(www\.)?github\.com\//i.test(url)) return;
  if (await Linking.canOpenURL(url)) await Linking.openURL(url);
}

function Empty({ label }: { label: string }) {
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name="github" size={28} color="#6E7681" />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <View style={styles.pagination}>
      <TouchableOpacity disabled={page === 1} onPress={() => onPage(page - 1)} style={styles.pageButton}>
        <MaterialCommunityIcons name="chevron-left" size={18} color={page === 1 ? '#484F58' : '#C9D1D9'} />
      </TouchableOpacity>
      <Text style={styles.pageText}>{page} / {pages}</Text>
      <TouchableOpacity disabled={page === pages} onPress={() => onPage(page + 1)} style={styles.pageButton}>
        <MaterialCommunityIcons name="chevron-right" size={18} color={page === pages ? '#484F58' : '#C9D1D9'} />
      </TouchableOpacity>
    </View>
  );
}

function PullRequestCard({ item }: { item: GitHubPullRequest }) {
  const status = item.draft ? 'Draft' : item.merged_at ? 'Merged' : item.state === 'closed' ? 'Closed' : 'Open';
  const color = status === 'Open' ? '#3FB950' : status === 'Merged' ? '#A371F7' : status === 'Closed' ? '#F85149' : '#8B949E';
  return (
    <TouchableOpacity accessibilityRole="link" onPress={() => void openGitHubUrl(item.html_url)} style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.code}>PR #{item.number}</Text>
        <View style={[styles.status, { borderColor: `${color}66`, backgroundColor: `${color}18` }]}><Text style={[styles.statusText, { color }]}>{status}</Text></View>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>{item.head?.ref || 'branch'} → {item.base?.ref || 'base'} · @{item.user?.login || 'unknown'}</Text>
      <Text style={styles.time}>{relativeTime(item.updated_at)}</Text>
    </TouchableOpacity>
  );
}

function CommitCard({ item }: { item: GitHubCommit }) {
  return (
    <TouchableOpacity accessibilityRole="link" onPress={() => void openGitHubUrl(item.html_url)} style={styles.card}>
      <Text style={styles.code}>{item.sha.slice(0, 7)}</Text>
      <Text style={styles.title}>{item.commit.message.split('\n')[0]}</Text>
      <Text style={styles.meta}>{item.author?.login || item.commit.author.name}</Text>
      <Text style={styles.time}>{relativeTime(item.commit.author.date)}</Text>
    </TouchableOpacity>
  );
}

function IssueCard({ item, imported, onImport }: { item: GitHubIssue; imported: boolean; onImport: (issue: GitHubIssue) => void }) {
  const color = item.state === 'open' ? '#3FB950' : '#8B949E';
  return (
    <View style={styles.card}>
      <TouchableOpacity accessibilityRole="link" onPress={() => void openGitHubUrl(item.html_url)}>
        <View style={styles.rowBetween}>
          <Text style={styles.code}>Issue #{item.number}</Text>
          <Text style={[styles.statusText, { color }]}>{item.state === 'open' ? 'Open' : 'Closed'}</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        {!!item.labels.length && <View style={styles.labels}>{item.labels.map(label => <Text key={`${label.id}-${label.name}`} style={[styles.label, { color: `#${label.color}` }]}>{label.name}</Text>)}</View>}
        <Text style={styles.meta}>@{item.user.login} · {item.comments} comments · {relativeTime(item.updated_at)}</Text>
      </TouchableOpacity>
      <TouchableOpacity disabled={imported} onPress={() => onImport(item)} style={[styles.importButton, imported && styles.importedButton]}>
        <MaterialCommunityIcons name={imported ? 'check' : 'tray-arrow-down'} size={14} color={imported ? '#3FB950' : '#58A6FF'} />
        <Text style={[styles.importText, imported && { color: '#3FB950' }]}>{imported ? 'Imported as task' : 'Import as task'}</Text>
      </TouchableOpacity>
    </View>
  );
}

interface GitHubActivityProps {
  pullRequests: GitHubPullRequest[];
  commits: GitHubCommit[];
  issues: GitHubIssue[];
  notifications: GitHubNotification[];
  importedIssues: Set<number>;
  onImport: (issue: GitHubIssue) => void;
  onReadNotification: (id: number) => void;
  onReadAll: () => void;
}

export function GitHubActivity({
  pullRequests, commits, issues, notifications, importedIssues,
  onImport, onReadNotification, onReadAll,
}: GitHubActivityProps) {
  const [tab, setTab] = useState<Tab>('prs');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [issueState, setIssueState] = useState<'all' | 'open' | 'closed'>('all');
  const [label, setLabel] = useState('');
  const unread = notifications.filter(item => !item.read);
  const filteredIssues = useMemo(() => issues.filter(issue => {
    if (issueState !== 'all' && issue.state !== issueState) return false;
    if (query.trim() && !issue.title.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (label.trim() && !issue.labels.some(item => item.name.toLowerCase().includes(label.trim().toLowerCase()))) return false;
    return true;
  }), [issueState, issues, label, query]);
  const current = tab === 'prs' ? pullRequests : tab === 'commits' ? commits : filteredIssues;
  const visible = current.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selectTab = (next: Tab) => { setTab(next); setPage(1); };
  return (
    <View>
      <View style={styles.notificationsHeader}>
        <View><Text style={styles.sectionTitle}>GitHub notifications</Text><Text style={styles.sectionSub}>{unread.length} unread for this repository</Text></View>
        {unread.length > 0 && <TouchableOpacity onPress={onReadAll}><Text style={styles.readAll}>Mark all read</Text></TouchableOpacity>}
      </View>
      {unread.slice(0, 4).map(item => (
        <TouchableOpacity key={item.id} onPress={() => { void onReadNotification(item.id); void openGitHubUrl(item.link); }} style={styles.notification}>
          <View style={styles.unreadDot} />
          <View style={{ flex: 1 }}><Text style={styles.notificationText}>{item.message}</Text><Text style={styles.time}>{relativeTime(item.createdAt)}</Text></View>
        </TouchableOpacity>
      ))}
      {unread.length === 0 && <Text style={styles.noNotifications}>No unread GitHub notifications.</Text>}

      <View style={styles.tabs}>
        {([
          ['prs', 'Pull requests', pullRequests.length],
          ['commits', 'Commits', commits.length],
          ['issues', 'Issues', issues.length],
        ] as const).map(([key, text, count]) => (
          <TouchableOpacity key={key} onPress={() => selectTab(key)} style={[styles.tab, tab === key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{text} {count}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'issues' && (
        <View style={styles.filters}>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search issues" placeholderTextColor="#6E7681" style={styles.input} />
          <TextInput value={label} onChangeText={setLabel} placeholder="Filter label" placeholderTextColor="#6E7681" style={styles.input} />
          <View style={styles.stateRow}>{(['all', 'open', 'closed'] as const).map(state => (
            <TouchableOpacity key={state} onPress={() => { setIssueState(state); setPage(1); }} style={[styles.stateButton, issueState === state && styles.stateButtonActive]}>
              <Text style={styles.stateText}>{state}</Text>
            </TouchableOpacity>
          ))}</View>
        </View>
      )}

      {visible.length === 0 ? <Empty label={`No ${tab === 'prs' ? 'pull requests' : tab} found`} /> : visible.map(item => (
        tab === 'prs' ? <PullRequestCard key={(item as GitHubPullRequest).id} item={item as GitHubPullRequest} />
          : tab === 'commits' ? <CommitCard key={(item as GitHubCommit).sha} item={item as GitHubCommit} />
            : <IssueCard key={(item as GitHubIssue).id} item={item as GitHubIssue} imported={importedIssues.has((item as GitHubIssue).number)} onImport={onImport} />
      ))}
      <Pagination page={page} total={current.length} onPage={setPage} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(240,246,252,.12)', backgroundColor: 'rgba(22,27,34,.82)', padding: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  code: { color: '#8B949E', fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  title: { color: '#F0F6FC', fontSize: 15, fontWeight: '700', lineHeight: 21, marginTop: 8 },
  meta: { color: '#8B949E', fontSize: 12, marginTop: 8 }, time: { color: '#6E7681', fontSize: 11, marginTop: 4 },
  status: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }, statusText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }, label: { borderRadius: 99, backgroundColor: 'rgba(255,255,255,.06)', paddingHorizontal: 7, paddingVertical: 3, fontSize: 10, fontWeight: '700' },
  importButton: { marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(240,246,252,.08)', paddingTop: 10, flexDirection: 'row', gap: 7, alignItems: 'center' }, importedButton: { opacity: .8 }, importText: { color: '#58A6FF', fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8, padding: 36, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#30363D' }, emptyText: { color: '#8B949E', fontSize: 13 },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginVertical: 16 }, pageButton: { borderWidth: 1, borderColor: '#30363D', borderRadius: 10, padding: 6 }, pageText: { color: '#8B949E', fontSize: 12 },
  tabs: { flexDirection: 'row', gap: 6, marginVertical: 16 }, tab: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#30363D', alignItems: 'center' }, tabActive: { backgroundColor: '#1F6FEB', borderColor: '#58A6FF' }, tabText: { color: '#8B949E', fontSize: 11, fontWeight: '700' }, tabTextActive: { color: '#FFF' },
  filters: { gap: 8, marginBottom: 12 }, input: { color: '#F0F6FC', backgroundColor: '#0D1117', borderWidth: 1, borderColor: '#30363D', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, stateRow: { flexDirection: 'row', gap: 6 }, stateButton: { borderWidth: 1, borderColor: '#30363D', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 }, stateButtonActive: { backgroundColor: 'rgba(88,166,255,.18)', borderColor: '#58A6FF' }, stateText: { color: '#C9D1D9', fontSize: 11, textTransform: 'capitalize' },
  notificationsHeader: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { color: '#F0F6FC', fontSize: 16, fontWeight: '800' }, sectionSub: { color: '#8B949E', fontSize: 11, marginTop: 3 }, readAll: { color: '#58A6FF', fontSize: 11, fontWeight: '700' },
  notification: { flexDirection: 'row', gap: 10, marginTop: 9, padding: 11, borderRadius: 14, backgroundColor: 'rgba(56,139,253,.08)', borderWidth: 1, borderColor: 'rgba(56,139,253,.2)' }, unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#58A6FF', marginTop: 5 }, notificationText: { color: '#C9D1D9', fontSize: 12, lineHeight: 17 }, noNotifications: { color: '#6E7681', fontSize: 12, marginTop: 10 },
});
