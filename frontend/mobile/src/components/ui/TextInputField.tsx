import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  StyleSheet,
  KeyboardTypeOptions,
  ReturnKeyTypeOptions,
  TextInputProps,
  Animated,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { isWeb } from '../../lib/platform';

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
  submitBehavior?: TextInputProps['submitBehavior'];
  editable?: boolean;
  errorText?: string;
  secureTextEntry?: boolean;
  textContentType?: string;
  autoComplete?: TextInputProps['autoComplete'];
  right?: React.ReactNode;
  inputRef?: React.RefObject<TextInput | null>;
  accessibilityHint?: string;
  testID?: string;
};

export default function TextInputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = 'none',
  autoCorrect = false,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
  submitBehavior,
  editable = true,
  errorText,
  secureTextEntry = false,
  textContentType,
  autoComplete,
  right,
  inputRef,
  accessibilityHint,
  testID,
}: Props) {
  const [isFocused, setIsFocused] = useState(false);
  const localInputRef = useRef<TextInput>(null);
  const resolvedInputRef = inputRef ?? localInputRef;

  const floatAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(floatAnim, {
      toValue: isFocused || !!value ? 1 : 0,
      duration: 160,
      useNativeDriver: false, // color interpolation requires false
    }).start();
  }, [floatAnim, isFocused, value]);

  const labelTop = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, -10],
  });
  const labelFontSize = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 12],
  });
  const labelColor = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.textMuted, isFocused ? Colors.primary : Colors.textSecondary],
  });

  const borderColor = errorText
    ? Colors.errorRed
    : isFocused
    ? Colors.primary
    : '#E0E7FF';

  return (
    <View style={[styles.wrapper, { position: 'relative' }]}>
      <Animated.Text
        style={[
          styles.floatingLabel,
          {
            top: labelTop,
            fontSize: labelFontSize,
            color: labelColor,
          },
        ]}
        pointerEvents="none"
      >
        {label}
      </Animated.Text>
      <Pressable
        accessibilityRole="none"
        onPress={() => resolvedInputRef.current?.focus()}
        style={[styles.inputContainer, { borderColor }, isFocused && styles.focusedShadow]}
      >
        <TextInput
          ref={resolvedInputRef}
          style={[styles.input, isWeb && { height: undefined }, { paddingTop: 10 }]}
          value={value}
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ disabled: !editable }}
          testID={testID}
          onChangeText={onChangeText}
          placeholder={isFocused || value ? '' : undefined}
          placeholderTextColor="#B0B7C3"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          returnKeyType={isWeb ? undefined : returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          submitBehavior={submitBehavior}
          editable={editable}
          secureTextEntry={secureTextEntry}
          textContentType={textContentType as never}
          autoComplete={autoComplete}
          showSoftInputOnFocus
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {right}
      </Pressable>
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 0,
    paddingTop: 10,
  },
  floatingLabel: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: 4,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
  },
  focusedShadow: {
    ...Platform.select({
      web: { boxShadow: `0 0 8px ${Colors.primary}1F` },
      default: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
    }),
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
    height: '100%',
  },
  errorText: {
    fontSize: 12,
    color: Colors.errorRed,
    marginTop: 4,
  },
});
