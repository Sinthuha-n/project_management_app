import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter, StyleSheet, Text, View } from 'react-native';
import { GITHUB_TASK_BADGE_EVENT } from '../../realtime/events';

export function GitHubTaskBadges({ task }: { task: any }) {
  const [issueNumber, setIssueNumber] = useState(task?.githubIssueNumber);
  useEffect(() => {
    setIssueNumber(task?.githubIssueNumber);
    const subscription = DeviceEventEmitter.addListener(GITHUB_TASK_BADGE_EVENT, event => {
      if (event?.taskId === (task?.id ?? task?.taskId)) setIssueNumber(event.githubIssueNumber);
    });
    return () => subscription.remove();
  }, [task?.githubIssueNumber, task?.id, task?.taskId]);
  if (!task?.ciStatus && !(task?.openPrCount > 0) && !issueNumber) return null;
  const ciColor = task.ciStatus === 'PASSING' ? '#3FB950' : task.ciStatus === 'FAILED' ? '#F85149' : '#D29922';
  return (
    <View style={styles.row}>
      {task.ciStatus && <View style={[styles.badge, { borderColor: ciColor }]}><MaterialCommunityIcons name={task.ciStatus === 'PASSING' ? 'check-circle-outline' : task.ciStatus === 'FAILED' ? 'alert-circle-outline' : 'progress-clock'} size={11} color={ciColor} /><Text style={[styles.text, { color: ciColor }]}>{task.ciStatus}</Text></View>}
      {task.openPrCount > 0 && <View style={styles.badge}><MaterialCommunityIcons name="source-pull" size={11} color="#A371F7" /><Text style={[styles.text, { color: '#A371F7' }]}>{task.openPrCount}</Text></View>}
      {issueNumber && <View style={styles.badge}><MaterialCommunityIcons name="alert-circle-outline" size={11} color="#3FB950" /><Text style={[styles.text, { color: '#3FB950' }]}>#{issueNumber}</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: '#30363D', borderRadius: 99, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: '#0D1117' },
  text: { fontSize: 8, fontWeight: '900' },
});
