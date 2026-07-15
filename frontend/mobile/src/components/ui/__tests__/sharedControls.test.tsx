import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import PrimaryButton from '../PrimaryButton';
import { StateView } from '../StateView';

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

describe('shared mobile controls', () => {
  test('primary action exposes button semantics and invokes its handler', async () => {
    const onPress = jest.fn();
    const screen = await render(<PrimaryButton label="Save project" onPress={onPress} />);

    const button = screen.getByLabelText('Save project');
    expect(button.props.accessibilityRole).toBe('button');
    fireEvent.press(button);
    await waitFor(() => expect(onPress).toHaveBeenCalledTimes(1));
  });

  test('loading primary action is announced as busy and disabled', async () => {
    const screen = await render(<PrimaryButton label="Saving" loading onPress={jest.fn()} />);
    expect(screen.getByLabelText('Saving').props.accessibilityState)
      .toEqual({ disabled: true, busy: true });
  });

  test('state view provides an accessible recovery action', async () => {
    const retry = jest.fn();
    const screen = await render(
      <StateView title="Inbox unavailable" message="Check your connection." actionLabel="Try again" onAction={retry} />,
    );

    const button = screen.getByLabelText('Try again');
    expect(button.props.accessibilityRole).toBe('button');
    fireEvent.press(button);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
