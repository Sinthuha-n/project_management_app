import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ThemeName = keyof typeof Colors;
type ThemeColorName = keyof (typeof Colors)['light'];

type ThemeProps = {
  light?: string;
  dark?: string;
};

export function useThemeColor(props: ThemeProps, colorName: ThemeColorName) {
  const theme = (useColorScheme() ?? 'light') as ThemeName;
  const colorFromProps = props[theme];

  return colorFromProps ?? Colors[theme][colorName];
}
