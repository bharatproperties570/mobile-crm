import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";

/**
 * index.tsx — Entry Gate
 *
 * Architecture Note (Senior Professional):
 * ─────────────────────────────────────────
 * This screen is shown ONLY during the brief moment while:
 *   1. AuthContext.checkAuth() is still running (AsyncStorage read, ~50-100ms)
 *   2. SplashScreen hasn't hidden yet (hides in checkAuth() finally block)
 *
 * In practice, the user NEVER sees this screen — the splash covers it.
 * Once the splash hides, AuthContext's Redirection Engine has ALREADY
 * resolved the correct destination and router.replace() has been called.
 *
 * DO NOT add redirect logic here — single source of truth is AuthContext.
 */
export default function Index() {
    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#1DB954" />
            <Text style={styles.label}>BP CRM</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#121212",
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
    },
    label: {
        color: "#1DB954",
        fontSize: 22,
        fontWeight: "900",
        letterSpacing: 4,
    },
});
