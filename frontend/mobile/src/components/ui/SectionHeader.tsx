import { StyleSheet, Text, View } from 'react-native';
import { T } from '../../constants/tokens';

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <View style={styles.row} accessibilityRole="header">
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: T.space3, marginBottom: T.space3 },
  copy: { flex: 1 },
  title: { color: T.textPrimary, fontSize: T.fontTitle, fontWeight: '800' },
  description: { color: T.textSecondary, fontSize: T.fontBody, lineHeight: 20, marginTop: T.space1 },
});
