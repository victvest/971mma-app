import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { darkColors } from '@/shared/theme/colors';

const c = darkColors;

type FallbackProps = {
  error: Error | null;
  onReset: () => void;
};

function ErrorFallback({ error, onReset }: FallbackProps) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.iconWrap}>
        <Text style={styles.iconText}>⚠</Text>
      </View>

      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>
        {__DEV__ && error?.message
          ? error.message
          : 'An unexpected error occurred.\nPlease reload the app.'}
      </Text>

      <TouchableOpacity style={styles.button} onPress={onReset} activeOpacity={0.8}>
        <Text style={styles.buttonLabel}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

type Props = {
  children: React.ReactNode;

  fallback?: (props: FallbackProps) => React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {

    if (__DEV__) {
      console.error('[ErrorBoundary] Uncaught error:', error, info);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const props: FallbackProps = { error: this.state.error, onReset: this.handleReset };
      return this.props.fallback ? this.props.fallback(props) : <ErrorFallback {...props} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background.inverse,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.status.errorSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: c.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    color: c.text.tertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  button: {
    backgroundColor: c.accent.default,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: c.accent.onAccent,
  },
});
