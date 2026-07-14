import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { routes } from '../../navigation/routes';
import {
  createGitHubIssueFromTask,
  fetchTaskCommits,
  fetchTaskGitHubSummary,
  fetchTaskPullRequests,
  getProjectGitHubRepo,
  updateTaskGitHubBranch,
  validateGitHubBranch,
  type LinkedCommit,
  type LinkedPullRequest,
  type ProjectGitHubConnection,
  type TaskGitHubSummary,
} from '../../services/githubMobileService';
import { openGitHubUrl } from './GitHubActivity';

function CiPill({ status }: { status?: string | null }) {
  if (!status) return null;
  const color = status === 'PASSING' ? '#3FB950' : status === 'FAILED' ? '#F85149' : '#D29922';
  return <View style={[styles.pill, { borderColor: `${color}55`, backgroundColor: `${color}18` }]}><Text style={[styles.pillText, { color }]}>{status}</Text></View>;
}

export function TaskGitHubPanel({ taskId, projectId, task }: { taskId: number; projectId: number; task: any }) {
  const router = useRouter();
  const [repo, setRepo] = useState<ProjectGitHubConnection | null>(null);
  const [summary, setSummary] = useState<TaskGitHubSummary | null>(null);
  const [prs, setPrs] = useState<LinkedPullRequest[]>([]);
  const [commits, setCommits] = useState<LinkedCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branchEditing, setBranchEditing] = useState(false);
  const [branch, setBranch] = useState('');
  const [branchError, setBranchError] = useState<string | null>(null);
  const [showPrs, setShowPrs] = useState(true);
  const [showCommits, setShowCommits] = useState(true);
  const [issueModal, setIssueModal] = useState(false);
  const [issueTitle, setIssueTitle] = useState(task?.title ?? '');
  const [issueBody, setIssueBody] = useState(task?.description ?? '');
  const [issueLabels, setIssueLabels] = useState<string>((task?.labels ?? []).map((item: any) => typeof item === 'string' ? item : item.name).filter(Boolean).join(', '));
  const [creatingIssue, setCreatingIssue] = useState(false);

  const load = useCallback(async (sync = false) => {
    setLoading(true); setError(null);
    try {
      const connection = await getProjectGitHubRepo(String(projectId));
      setRepo(connection);
      if (!connection) return;
      const repoName = sync ? connection.repoFullName : undefined;
      const [nextSummary, nextPrs, nextCommits] = await Promise.all([
        fetchTaskGitHubSummary(taskId, repoName),
        fetchTaskPullRequests(taskId, repoName),
        fetchTaskCommits(taskId, repoName),
      ]);
      setSummary(nextSummary); setPrs(nextPrs); setCommits(nextCommits); setBranch(nextSummary.githubBranch ?? '');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? requestError?.message ?? 'Task GitHub data could not be loaded.');
    } finally { setLoading(false); }
  }, [projectId, taskId]);

  useEffect(() => { void load(); }, [load]);

  const saveBranch = async () => {
    const validation = validateGitHubBranch(branch);
    if (validation) { setBranchError(validation); return; }
    try {
      const next = await updateTaskGitHubBranch(taskId, branch.trim());
      setSummary(next); setBranchEditing(false); setBranchError(null);
    } catch (requestError: any) { setBranchError(requestError?.response?.data?.message ?? 'Branch could not be saved.'); }
  };

  const createIssue = async () => {
    if (!repo || !issueTitle.trim()) return;
    setCreatingIssue(true);
    try {
      const issue = await createGitHubIssueFromTask({
        taskId, repoFullName: repo.repoFullName, title: issueTitle, body: issueBody,
        labels: issueLabels.split(',').map(item => item.trim()).filter((item, index, all) => item && all.findIndex(other => other.toLowerCase() === item.toLowerCase()) === index),
      });
      setIssueModal(false);
      Alert.alert('GitHub issue created', `Issue #${issue.number} is linked to this task.`);
      await load();
    } catch (requestError: any) { Alert.alert('Issue not created', requestError?.response?.data?.message ?? requestError?.message ?? 'Please try again.'); }
    finally { setCreatingIssue(false); }
  };

  return (
    <View style={styles.panel}>
      <View style={styles.header}><View style={styles.headerLeft}><MaterialCommunityIcons name="github" size={18} color="#F0F6FC" /><Text style={styles.headerTitle}>GitHub</Text></View>{summary?.ciStatus && <CiPill status={summary.ciStatus} />}</View>
      {loading && !summary ? <ActivityIndicator color="#58A6FF" style={{ margin: 20 }} /> : !repo ? (
        <View style={styles.empty}><Text style={styles.muted}>Connect a project repository to enable task GitHub features.</Text><TouchableOpacity onPress={() => router.push(routes.github(projectId))}><Text style={styles.link}>Open GitHub hub</Text></TouchableOpacity></View>
      ) : (
        <View style={styles.body}>
          {!!error && <Text style={styles.error}>{error}</Text>}
      {task?.githubIssueNumber ? <TouchableOpacity onPress={() => void openGitHubUrl(task.githubIssueUrl || `https://github.com/${task.githubRepoFullName || repo.repoFullName}/issues/${task.githubIssueNumber}`)} style={styles.issueLink}><MaterialCommunityIcons name="alert-circle-outline" size={16} color="#3FB950" /><Text style={styles.link}>Issue #{task.githubIssueNumber} · View on GitHub</Text></TouchableOpacity> : <TouchableOpacity onPress={() => setIssueModal(true)} style={styles.outlineButton}><MaterialCommunityIcons name="plus" size={15} color="#58A6FF" /><Text style={styles.link}>Create GitHub issue</Text></TouchableOpacity>}

          <Text style={styles.label}>Branch</Text>
          {branchEditing ? <View><TextInput value={branch} onChangeText={value => { setBranch(value); setBranchError(null); }} autoCapitalize="none" autoCorrect={false} placeholder="feature/task-123" placeholderTextColor="#6E7681" style={styles.input} />{!!branchError && <Text style={styles.error}>{branchError}</Text>}<View style={styles.actions}><TouchableOpacity onPress={() => void saveBranch()} style={styles.smallPrimary}><Text style={styles.smallPrimaryText}>Save</Text></TouchableOpacity><TouchableOpacity onPress={() => { setBranchEditing(false); setBranch(summary?.githubBranch ?? ''); }} style={styles.smallOutline}><Text style={styles.muted}>Cancel</Text></TouchableOpacity></View></View> : <View style={styles.branch}><MaterialCommunityIcons name="source-branch" size={15} color="#8B949E" /><Text style={styles.branchText}>{summary?.githubBranch || 'No branch set'}</Text>{summary?.githubBranch && <TouchableOpacity onPress={() => void Clipboard.setStringAsync(summary.githubBranch!)}><MaterialCommunityIcons name="content-copy" size={15} color="#8B949E" /></TouchableOpacity>}<TouchableOpacity onPress={() => setBranchEditing(true)}><MaterialCommunityIcons name="pencil" size={15} color="#58A6FF" /></TouchableOpacity></View>}

          <View style={styles.summary}><View><Text style={styles.value}>{summary?.prCount ?? prs.length}</Text><Text style={styles.muted}>PRs</Text></View><View style={{ flex: 1 }}><Text style={styles.commitMessage} numberOfLines={1}>{commits[0]?.message || 'No recent commits'}</Text><Text style={styles.muted}>{commits[0]?.sha || ''}</Text></View><TouchableOpacity disabled={loading} onPress={() => void load(true)}><MaterialCommunityIcons name="refresh" size={18} color="#58A6FF" /></TouchableOpacity></View>

          <TouchableOpacity onPress={() => setShowPrs(value => !value)} style={styles.sectionHeader}><Text style={styles.sectionTitle}>Linked pull requests ({prs.length})</Text><MaterialCommunityIcons name={showPrs ? 'chevron-up' : 'chevron-down'} size={17} color="#8B949E" /></TouchableOpacity>
          {showPrs && prs.map(pr => <TouchableOpacity key={pr.id} onPress={() => void openGitHubUrl(pr.htmlUrl)} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>#{pr.prNumber} {pr.title}</Text><Text style={styles.muted}>{pr.headBranch} → {pr.baseBranch} · {pr.author}</Text><View style={styles.actions}><CiPill status={pr.ciStatus} />{!!pr.reviewStatus && <Text style={styles.review}>{pr.reviewStatus.replace(/_/g, ' ')}</Text>}</View></View></TouchableOpacity>)}

          <TouchableOpacity onPress={() => setShowCommits(value => !value)} style={styles.sectionHeader}><Text style={styles.sectionTitle}>Recent commits ({commits.length})</Text><MaterialCommunityIcons name={showCommits ? 'chevron-up' : 'chevron-down'} size={17} color="#8B949E" /></TouchableOpacity>
          {showCommits && commits.map(commit => <TouchableOpacity key={commit.id} onPress={() => void openGitHubUrl(commit.htmlUrl)} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{commit.message}</Text><Text style={styles.muted}>{commit.sha} · {commit.author}</Text>{!!commit.referencedTaskNumbers?.length && <Text style={styles.review}>References {commit.referencedTaskNumbers.map(number => `#${number}`).join(', ')}</Text>}</View><CiPill status={commit.ciStatus} /></TouchableOpacity>)}
        </View>
      )}

      <Modal visible={issueModal} transparent animationType="slide" onRequestClose={() => setIssueModal(false)}>
        <View style={styles.overlay}><View style={styles.modal}><View style={styles.header}><Text style={styles.headerTitle}>Create GitHub issue</Text><TouchableOpacity onPress={() => setIssueModal(false)}><MaterialCommunityIcons name="close" size={21} color="#C9D1D9" /></TouchableOpacity></View><Text style={styles.muted}>{repo?.repoFullName}</Text><TextInput value={issueTitle} onChangeText={setIssueTitle} placeholder="Issue title" placeholderTextColor="#6E7681" style={styles.input} /><TextInput value={issueBody} onChangeText={setIssueBody} placeholder="Issue body" placeholderTextColor="#6E7681" multiline style={[styles.input, { minHeight: 100 }]} /><TextInput value={issueLabels} onChangeText={setIssueLabels} placeholder="Labels, comma separated" placeholderTextColor="#6E7681" style={styles.input} /><TouchableOpacity disabled={creatingIssue || !issueTitle.trim()} onPress={() => void createIssue()} style={[styles.primary, (creatingIssue || !issueTitle.trim()) && { opacity: .4 }]}>{creatingIssue ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Create and link issue</Text>}</TouchableOpacity></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 18, borderWidth: 1, borderColor: '#30363D', backgroundColor: '#0D1117', overflow: 'hidden' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderBottomWidth: 1, borderBottomColor: '#30363D' }, headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 }, headerTitle: { color: '#F0F6FC', fontSize: 14, fontWeight: '900' }, body: { padding: 13 }, empty: { padding: 16, gap: 10 }, muted: { color: '#8B949E', fontSize: 11, lineHeight: 16 }, link: { color: '#58A6FF', fontSize: 12, fontWeight: '800' }, error: { color: '#F85149', fontSize: 11, marginVertical: 6 },
  issueLink: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }, outlineButton: { flexDirection: 'row', gap: 7, alignItems: 'center', borderWidth: 1, borderColor: '#30363D', borderRadius: 12, padding: 10, alignSelf: 'flex-start', marginBottom: 12 }, label: { color: '#8B949E', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 }, input: { color: '#F0F6FC', backgroundColor: '#161B22', borderWidth: 1, borderColor: '#30363D', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9, marginTop: 9 }, branch: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#30363D', backgroundColor: '#161B22', borderRadius: 11, padding: 10 }, branchText: { flex: 1, color: '#C9D1D9', fontSize: 11, fontFamily: 'monospace' },
  actions: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 7 }, smallPrimary: { backgroundColor: '#1F6FEB', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 7 }, smallPrimaryText: { color: '#FFF', fontSize: 11, fontWeight: '800' }, smallOutline: { borderWidth: 1, borderColor: '#30363D', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 7 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 13, padding: 11, borderRadius: 12, backgroundColor: '#161B22' }, value: { color: '#F0F6FC', fontSize: 18, fontWeight: '900', textAlign: 'center' }, commitMessage: { color: '#C9D1D9', fontSize: 11, fontWeight: '700' }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingVertical: 8 }, sectionTitle: { color: '#C9D1D9', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }, row: { flexDirection: 'row', gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(240,246,252,.07)' }, rowTitle: { color: '#F0F6FC', fontSize: 12, fontWeight: '700', marginBottom: 4 }, pill: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' }, pillText: { fontSize: 9, fontWeight: '900' }, review: { color: '#A371F7', fontSize: 9, fontWeight: '800' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(1,4,9,.72)' }, modal: { backgroundColor: '#0D1117', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: '#30363D', padding: 16, paddingBottom: 34 }, primary: { marginTop: 15, minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F6FEB' }, primaryText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
});
