import { useColorScheme } from 'nativewind';

export const palette = {
  navy: '#101B36', brand: '#3867F5', cyan: '#20C4D8', bg: '#F6F8FC', surface: '#FFFFFF', ink: '#172033',
  muted: '#6B7690', line: '#E3E8F2', danger: '#E5484D', success: '#18A957', warn: '#F5A524',
  bgd: '#0B1220', surfd: '#16213A', inkd: '#EAF0FF', mutedd: '#9AA7C7', lined: '#26324F'
};

/** Resolved colours for places where class names cannot be used (icons, third-party props). */
export function useColors() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  return {
    dark,
    bg: dark ? palette.bgd : palette.bg,
    surface: dark ? palette.surfd : palette.surface,
    ink: dark ? palette.inkd : palette.ink,
    muted: dark ? palette.mutedd : palette.muted,
    line: dark ? palette.lined : palette.line,
    brand: palette.brand,
    cyan: palette.cyan,
    navy: palette.navy,
    danger: palette.danger,
    success: palette.success,
    warn: palette.warn
  };
}
