import React from 'react';
import { View } from 'react-native';
import { AlertCircle, CheckCircle2, Loader, MonitorOff } from 'lucide-react-native';
import { useConnection } from '../store/connection';
import { useColors } from '../theme/colors';
import { T } from './ui';

export function ConnectionBanner({ compact }: { compact?: boolean }) {
  const { status, active, error } = useConnection();
  const c = useColors();
  let Icon = MonitorOff; let color = c.muted; let title = 'Not connected'; let sub = 'Connect a projector or display to present.';
  if (status === 'connected' && active) { Icon = CheckCircle2; color = c.success; title = active.name; sub = `Connected via ${active.protocol}`; }
  else if (status === 'connecting') { Icon = Loader; color = c.brand; title = 'Connecting…'; sub = 'Waiting for the receiver to confirm.'; }
  else if (status === 'guidance') { Icon = AlertCircle; color = c.warn; title = 'System mirroring (unverified)'; sub = 'Android controls this link; SmartBeam cannot confirm it.'; }
  else if (status === 'error') { Icon = AlertCircle; color = c.danger; title = 'Connection problem'; sub = error ?? 'The connection failed.'; }
  return (
    <View className="flex-row items-center gap-3" accessibilityLiveRegion="polite">
      <Icon size={compact ? 18 : 22} color={color} />
      <View className="flex-1">
        <T v="label" numberOfLines={1}>{title}</T>
        {!compact ? <T v="caption" muted numberOfLines={2}>{sub}</T> : null}
      </View>
    </View>
  );
}
