import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, Text, TextInput, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import { useColors } from '../theme/colors';

type Variant = 'title' | 'h2' | 'body' | 'caption' | 'label';
const VARIANT: Record<Variant, string> = {
  title: 'text-2xl font-bold',
  h2: 'text-lg font-semibold',
  body: 'text-base',
  caption: 'text-xs',
  label: 'text-sm font-medium'
};

export function T({ v = 'body', muted, className = '', children, ...rest }: { v?: Variant; muted?: boolean; className?: string; children: React.ReactNode } & React.ComponentProps<typeof Text>) {
  return (
    <Text {...rest} className={`${VARIANT[v]} ${muted ? 'text-muted dark:text-mutedd' : 'text-ink dark:text-inkd'} ${className}`}>
      {children}
    </Text>
  );
}

export function Card({ className = '', children, onPress, ...rest }: ViewProps & { className?: string; onPress?: () => void }) {
  const base = `rounded-2xl bg-surface dark:bg-surfd border border-line dark:border-lined p-4 shadow-sm ${className}`;
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" className={`${base} active:opacity-80`} {...rest}>
        {children}
      </Pressable>
    );
  }
  return <View className={base} {...rest}>{children}</View>;
}

export function Button({ label, onPress, icon: Icon, variant = 'primary', loading, disabled, small, className = '', accessibilityLabel }: {
  label: string; onPress?: () => void; icon?: LucideIcon; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean; disabled?: boolean; small?: boolean; className?: string; accessibilityLabel?: string;
}) {
  const c = useColors();
  const bg = { primary: 'bg-brand', secondary: 'bg-surface dark:bg-surfd border border-line dark:border-lined', ghost: 'bg-transparent', danger: 'bg-danger' }[variant];
  const fg = variant === 'primary' || variant === 'danger' ? '#FFFFFF' : variant === 'ghost' ? c.brand : c.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      className={`${bg} ${small ? 'min-h-[40px] px-3' : 'min-h-[48px] px-5'} rounded-xl flex-row items-center justify-center gap-2 ${disabled ? 'opacity-50' : 'active:opacity-80'} ${className}`}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : Icon ? <Icon size={small ? 16 : 18} color={fg} /> : null}
      <Text style={{ color: fg }} className={`${small ? 'text-sm' : 'text-base'} font-semibold`}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon: Icon, onPress, label, size = 22, tone = 'default', active, className = '' }: {
  icon: LucideIcon; onPress?: () => void; label: string; size?: number; tone?: 'default' | 'brand' | 'danger' | 'light'; active?: boolean; className?: string;
}) {
  const c = useColors();
  const color = tone === 'brand' ? c.brand : tone === 'danger' ? c.danger : tone === 'light' ? '#FFFFFF' : c.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      className={`h-12 w-12 rounded-full items-center justify-center ${active ? 'bg-brand/15' : ''} active:opacity-70 ${className}`}
    >
      <Icon size={size} color={active ? c.brand : color} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon: Icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: LucideIcon }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      className={`h-10 px-4 rounded-full flex-row items-center gap-1.5 border ${selected ? 'bg-brand border-brand' : 'bg-surface dark:bg-surfd border-line dark:border-lined'}`}
    >
      {Icon ? <Icon size={14} color={selected ? '#fff' : c.muted} /> : null}
      <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-ink dark:text-inkd'}`}>{label}</Text>
    </Pressable>
  );
}

const TONES = {
  success: ['bg-success/15', 'text-success'],
  warn: ['bg-warn/20', 'text-warn'],
  danger: ['bg-danger/15', 'text-danger'],
  neutral: ['bg-line dark:bg-lined', 'text-muted dark:text-mutedd'],
  info: ['bg-brand/15', 'text-brand']
} as const;

export function StatusPill({ tone, label }: { tone: keyof typeof TONES; label: string }) {
  const [bg, fg] = TONES[tone];
  return (
    <View className={`px-2.5 py-1 rounded-full self-start ${bg}`}>
      <Text className={`text-xs font-semibold ${fg}`}>{label}</Text>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View className="flex-row items-center justify-between mt-6 mb-3">
      <T v="h2">{title}</T>
      {action ? <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button"><Text className="text-brand font-semibold">{action}</Text></Pressable> : null}
    </View>
  );
}

export function EmptyState({ icon: Icon, title, message, actionLabel, onAction }: { icon: LucideIcon; title: string; message: string; actionLabel?: string; onAction?: () => void }) {
  const c = useColors();
  return (
    <View className="items-center justify-center py-10 px-6">
      <View className="h-20 w-20 rounded-full bg-brand/10 items-center justify-center mb-4">
        <Icon size={36} color={c.brand} />
      </View>
      <T v="h2" className="text-center">{title}</T>
      <T muted className="text-center mt-1 mb-4">{message}</T>
      {actionLabel ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true })
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View className="items-center justify-center py-12" accessibilityLiveRegion="polite">
      <Animated.View style={{ opacity: pulse }} className="h-14 w-14 rounded-2xl bg-brand mb-4" />
      <T muted>{label}</T>
    </View>
  );
}

export function SkeletonRows({ n = 3 }: { n?: number }) {
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.8, duration: 800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.35, duration: 800, useNativeDriver: true })
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View className="gap-3">
      {Array.from({ length: n }).map((_, i) => <Animated.View key={i} style={{ opacity: pulse }} className="h-16 rounded-2xl bg-line dark:bg-lined" />)}
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <View className="h-1.5 rounded-full bg-line dark:bg-lined overflow-hidden">
      <View className="h-full bg-brand rounded-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </View>
  );
}

export function Screen({ title, children, scroll = true, back = true, right, padded = true, footer, bg }: {
  title?: string; children: React.ReactNode; scroll?: boolean; back?: boolean; right?: React.ReactNode; padded?: boolean; footer?: React.ReactNode; bg?: string;
}) {
  const nav = useNavigation();
  const c = useColors();
  const body = scroll
    ? <ScrollView contentContainerStyle={{ paddingBottom: 32 }} className={padded ? 'px-5' : ''} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    : <View className={`flex-1 ${padded ? 'px-5' : ''}`}>{children}</View>;
  return (
    <SafeAreaView className={`flex-1 ${bg ?? 'bg-bg dark:bg-bgd'}`} edges={['top', 'left', 'right']}>
      {title ? (
        <View className="flex-row items-center h-14 px-3">
          {back && nav.canGoBack() ? <IconButton icon={ArrowLeft} label="Go back" onPress={() => nav.goBack()} /> : <View className="w-3" />}
          <T v="h2" className="flex-1" numberOfLines={1}>{title}</T>
          {right}
        </View>
      ) : null}
      {body}
      {footer}
    </SafeAreaView>
  );
}

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable className="flex-1 bg-black/50" onPress={onClose} accessibilityLabel="Close" />
      <View className="bg-surface dark:bg-surfd rounded-t-3xl px-5 pt-3 pb-8 max-h-[80%]">
        <View className="self-center h-1.5 w-10 rounded-full bg-line dark:bg-lined mb-3" />
        {title ? <T v="h2" className="mb-3">{title}</T> : null}
        <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </Modal>
  );
}

export function PromptDialog({ visible, title, initial = '', placeholder, confirmLabel = 'Save', onCancel, onSubmit }: {
  visible: boolean; title: string; initial?: string; placeholder?: string; confirmLabel?: string; onCancel: () => void; onSubmit: (value: string) => void;
}) {
  const [value, setValue] = React.useState(initial);
  const c = useColors();
  useEffect(() => { if (visible) setValue(initial); }, [visible, initial]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View className="w-full rounded-2xl bg-surface dark:bg-surfd p-5">
          <T v="h2" className="mb-3">{title}</T>
          <TextInput
            value={value} onChangeText={setValue} autoFocus placeholder={placeholder} placeholderTextColor={c.muted}
            style={{ color: c.ink }} className="h-12 rounded-xl border border-line dark:border-lined px-3 mb-4" accessibilityLabel={title}
            onSubmitEditing={() => onSubmit(value)}
          />
          <View className="flex-row justify-end gap-2">
            <Button label="Cancel" variant="ghost" onPress={onCancel} />
            <Button label={confirmLabel} onPress={() => onSubmit(value)} disabled={!value.trim()} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function Row({ icon: Icon, title, subtitle, right, onPress, tone }: { icon?: LucideIcon; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; tone?: 'default' | 'danger' }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} className="flex-row items-center min-h-[56px] py-2 gap-3 active:opacity-70">
      {Icon ? <View className="h-10 w-10 rounded-xl bg-brand/10 items-center justify-center"><Icon size={20} color={tone === 'danger' ? c.danger : c.brand} /></View> : null}
      <View className="flex-1">
        <T v="label" className={tone === 'danger' ? 'text-danger' : ''}>{title}</T>
        {subtitle ? <T v="caption" muted>{subtitle}</T> : null}
      </View>
      {right}
    </Pressable>
  );
}
