import { AppRegistry, LogBox } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

// ── Suppress non-critical warnings in production ───────────────
LogBox.ignoreAllLogs(true);

// ── Global error handlers to prevent crash-to-pairing ──────────
// Unhandled JS exceptions
const defaultHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Log but don't crash — the app will try to recover
    console.error('[GlobalError]', isFatal ? 'FATAL' : 'non-fatal', error?.message);

    // For non-fatal errors, swallow and continue
    if (!isFatal) return;

    // For fatal errors, let the default handler manage the restart
    // but the credentials in AsyncStorage will survive
    if (defaultHandler) {
        defaultHandler(error, isFatal);
    }
});

// Unhandled promise rejections
if (typeof global !== 'undefined') {
    const originalRejection = (global as any).onunhandledrejection;
    (global as any).onunhandledrejection = (event: any) => {
        console.warn('[UnhandledRejection]', event?.reason?.message || event?.reason);
        // Don't propagate — prevents crash
        if (originalRejection) originalRejection(event);
    };
}

AppRegistry.registerComponent(appName, () => App);
