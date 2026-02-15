/**
 * PairingScreen — Shows 6-digit pairing code
 *
 * Ported from digital-sign/app/player/page.tsx lines 615-723
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

interface PairingScreenProps {
    code: string;
}

export const PairingScreen: React.FC<PairingScreenProps> = ({ code }) => {
    const spinValue = useRef(new Animated.Value(0)).current;
    const pulseValue = useRef(new Animated.Value(0.6)).current;

    useEffect(() => {
        // Spinner rotation
        Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 1500,
                easing: Easing.linear,
                useNativeDriver: true,
            }),
        ).start();

        // Pulse animation for "Waiting..." text
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseValue, {
                    toValue: 0.4,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ]),
        ).start();
    }, []);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={styles.container}>
            {/* Title */}
            <View style={styles.titleContainer}>
                <Text style={styles.title}>
                    SIGNAGE<Text style={styles.titleAccent}>OS</Text>
                </Text>
                <Text style={styles.subtitle}>Device Setup</Text>
            </View>

            {/* Pairing Code Card */}
            <View style={styles.card}>
                <Text style={styles.cardLabel}>PAIRING CODE</Text>
                <Text style={styles.code}>{code || '------'}</Text>
            </View>

            {/* Status */}
            <View style={styles.statusContainer}>
                <Animated.View
                    style={[styles.spinner, { transform: [{ rotate: spin }] }]}
                >
                    <View style={styles.spinnerArc} />
                </Animated.View>
                <Animated.Text style={[styles.waitingText, { opacity: pulseValue }]}>
                    Waiting for connection...
                </Animated.Text>
            </View>

            <Text style={styles.instructions}>
                Go to{' '}
                <Text style={styles.bold}>Dashboard {'>'} Screens {'>'} Add Screen</Text>
                {'\n'}and enter this code.
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 4,
    },
    titleAccent: {
        color: '#60a5fa',
    },
    subtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 4,
    },
    card: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        borderRadius: 24,
        paddingHorizontal: 48,
        paddingVertical: 36,
        alignItems: 'center',
        marginBottom: 40,
    },
    cardLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#cbd5e1',
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    code: {
        fontSize: 56,
        fontWeight: 'bold',
        fontFamily: 'monospace',
        color: '#fff',
        letterSpacing: 8,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    spinner: {
        width: 20,
        height: 20,
    },
    spinnerArc: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: 'transparent',
        borderTopColor: '#93c5fd',
        borderRightColor: '#93c5fd',
    },
    waitingText: {
        fontSize: 15,
        color: '#93c5fd',
        marginLeft: 8,
    },
    instructions: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 20,
    },
    bold: {
        fontWeight: 'bold',
        color: '#94a3b8',
    },
});
