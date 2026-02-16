/**
 * ErrorBoundary — Catches React rendering errors
 *
 * Instead of crashing to a white screen (and losing context),
 * this boundary auto-recovers by remounting the child tree.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
    children: React.ReactNode;
    onError?: (error: Error) => void;
}

interface State {
    hasError: boolean;
    retryCount: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
    private retryTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, retryCount: 0 };
    }

    static getDerivedStateFromError(_error: Error): Partial<State> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[ErrorBoundary]', error.message, errorInfo.componentStack);
        this.props.onError?.(error);
    }

    componentDidUpdate(_prevProps: Props, prevState: State) {
        if (this.state.hasError && !prevState.hasError) {
            // Auto-retry after 3 seconds
            this.retryTimer = setTimeout(() => {
                this.setState((s) => ({
                    hasError: false,
                    retryCount: s.retryCount + 1,
                }));
            }, 3000);
        }
    }

    componentWillUnmount() {
        if (this.retryTimer) clearTimeout(this.retryTimer);
    }

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <Text style={styles.text}>Recovering...</Text>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: '#333',
        fontSize: 14,
    },
});
