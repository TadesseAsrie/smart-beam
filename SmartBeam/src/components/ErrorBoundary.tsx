import React from 'react';
import { View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { Button, T } from './ui';

interface State { error: Error | null }

/** Catches render errors so one broken screen never takes the whole app down. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; onReset?: () => void }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[SmartBeam:boundary]', error, info.componentStack);
  }
  reset = () => { this.setState({ error: null }); this.props.onReset?.(); };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View className="flex-1 items-center justify-center px-8 bg-bg dark:bg-bgd">
        <AlertTriangle size={44} color="#E5484D" />
        <T v="h2" className="mt-4 text-center">Something went wrong</T>
        <T muted className="text-center mt-1 mb-6">{this.state.error.message}</T>
        <Button label="Try again" onPress={this.reset} />
      </View>
    );
  }
}
