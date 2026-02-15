/**
 * SleepScreen — Black screen during hibernate/empty playlist
 *
 * Minimal memory footprint: no video components rendered.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

export const SleepScreen: React.FC = () => {
    return <View style={styles.container} />;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
});
