import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { PlanoraIconMark, PlanoraWordmark } from './PlanoraLogoMark';

type Props = {
  title: string;
  subtitle?: string;
};

export default function BrandHeader({ title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      {/* Glowing icon mark */}
      <View style={styles.iconGlow}>
        <PlanoraIconMark size={72} />
      </View>

      {/* Wordmark */}
      <View style={styles.wordmarkWrap}>
        <PlanoraWordmark width={150} />
      </View>

      {/* Optional subtitle (page context, e.g. "Enter the reset code") */}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {/* Page title (e.g. "Welcome Back", "Create Account") */}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  iconGlow: {
    shadowColor: '#9810FA',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 0,
  },
  wordmarkWrap: {
    marginTop: 10,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 6,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
});
