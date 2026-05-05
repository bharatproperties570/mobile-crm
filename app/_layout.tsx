import React from "react";
import { Stack } from "expo-router";
import {
    View,
    Text,
    StyleSheet,
    LogBox,
    TouchableOpacity,
    ScrollView,
    Platform,
    ActivityIndicator,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/context/AuthContext";
import { UserProvider } from "@/context/UserContext";
import { ProjectProvider } from "@/context/ProjectContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { LookupProvider } from "@/context/LookupContext";
import { DepartmentProvider } from "@/context/DepartmentContext";
import { CallTrackingProvider } from "@/context/CallTrackingContext";
import { NotificationProvider } from "@/context/NotificationContext";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { useCallMonitor } from "@/utils/CallMonitor";

// ── Prevent native splash from auto-hiding ──────────────────────────────────
// AuthContext.checkAuth() will call hideAsync() once auth state is resolved.
// This is the single source of truth for when the splash disappears.
SplashScreen.preventAutoHideAsync().catch(() => {});

LogBox.ignoreLogs([
    "VirtualizedLists should never be nested",
    "[safeApiCall] Error:",
    "Network Error",
    "ActivityIndicator is not defined",
    "expo-av",
]);

// ── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: any }
> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("[RootBoundary] Fatal:", error, errorInfo);
        // Emergency: hide splash so error is visible
        SplashScreen.hideAsync().catch(() => {});
    }

    handleRestart = async () => {
        try {
            await Updates.reloadAsync();
        } catch {
            this.setState({ hasError: false, error: null });
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.errorContainer}>
                    <View style={styles.errorCard}>
                        <Text style={styles.errorIcon}>⚠️</Text>
                        <Text style={styles.errorTitle}>Application Error</Text>
                        <Text style={styles.errorSubtitle}>
                            Something went wrong during rendering.
                        </Text>
                        <ScrollView
                            style={styles.errorScroll}
                            showsVerticalScrollIndicator={false}
                        >
                            <Text style={styles.errorText}>
                                {this.state.error?.toString()}
                            </Text>
                        </ScrollView>
                        <TouchableOpacity
                            style={styles.restartBtn}
                            onPress={this.handleRestart}
                        >
                            <Text style={styles.restartBtnText}>RESTART APPLICATION</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }
        return this.props.children;
    }
}

// ── Stack Navigator wrapped in all providers ─────────────────────────────────
//
// ARCHITECTURE: Why no isReady gate?
// ─────────────────────────────────────────────────────────────────────────────
// The previous design had a 500ms timer before rendering providers. This
// created a white-screen window:
//
//   t=0ms   → RootContent mounts, shows dark spinner
//   t=500ms → providers render, Stack renders, splash hides
//   t=500ms → index.tsx shows (dark bg) ✓
//   t=~600ms → AuthContext.routerReady = true (another 500ms timer)
//   t=~700ms → checkAuth completes, loading=false
//   t=~700ms → redirect fires
//
// The gap between "splash hides" and "redirect fires" was the white screen.
//
// NEW DESIGN:
//   t=0ms   → providers render immediately (no gate)
//   t=0ms   → checkAuth() starts
//   t=~100ms → AsyncStorage read done, auth state known
//   t=~100ms → redirect fires (AuthContext)
//   t=~100ms → SplashScreen.hideAsync() called (correct screen showing)
//   RESULT: splash hides → correct screen is already rendered → NO white flash
//
function NavigatorContent() {
    // useCallMonitor is safely isolated here — it handles its own platform checks
    useCallMonitor();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                // Dark background on ALL screens and transitions
                contentStyle: { backgroundColor: "#121212" },
                animation: Platform.OS === "android" ? "fade" : "default",
                animationDuration: 150,
            }}
        >
            <Stack.Screen
                name="index"
                options={{ contentStyle: { backgroundColor: "#121212" } }}
            />
            <Stack.Screen
                name="(auth)/login"
                options={{ contentStyle: { backgroundColor: "#121212" } }}
            />
            <Stack.Screen
                name="(tabs)"
                options={{ contentStyle: { backgroundColor: "#121212" } }}
            />
        </Stack>
    );
}

function RootContent() {
    // Absolute failsafe: if checkAuth() never resolves (impossible crash),
    // force-hide splash after 10 seconds so user is never stuck on black screen.
    React.useEffect(() => {
        const failsafe = setTimeout(() => {
            console.warn("[RootLayout] 10s failsafe: forcing splash hide");
            SplashScreen.hideAsync().catch(() => {});
        }, 10000);
        return () => clearTimeout(failsafe);
    }, []);

    return (
        <AuthProvider>
            <NotificationProvider>
                <UserProvider>
                    <ProjectProvider>
                        <ThemeProvider>
                            <LookupProvider>
                                <DepartmentProvider>
                                    <CallTrackingProvider>
                                        <StatusBar style="light" />
                                        <NavigatorContent />
                                    </CallTrackingProvider>
                                </DepartmentProvider>
                            </LookupProvider>
                        </ThemeProvider>
                    </ProjectProvider>
                </UserProvider>
            </NotificationProvider>
        </AuthProvider>
    );
}

export default function RootLayout() {
    return (
        <View style={styles.root}>
            <ErrorBoundary>
                <SafeAreaProvider>
                    <GestureHandlerRootView style={styles.flex}>
                        <RootContent />
                    </GestureHandlerRootView>
                </SafeAreaProvider>
            </ErrorBoundary>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#121212",
    },
    flex: {
        flex: 1,
        backgroundColor: "#121212",
    },
    errorContainer: {
        flex: 1,
        backgroundColor: "#0F172A",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    errorCard: {
        backgroundColor: "#1E293B",
        borderRadius: 24,
        padding: 30,
        width: "100%",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.05)",
    },
    errorIcon: { fontSize: 40, marginBottom: 15 },
    errorTitle: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "800",
        marginBottom: 4,
    },
    errorSubtitle: {
        color: "#94A3B8",
        fontSize: 14,
        marginBottom: 20,
        textAlign: "center",
    },
    errorScroll: {
        maxHeight: 150,
        width: "100%",
        backgroundColor: "rgba(0,0,0,0.2)",
        borderRadius: 12,
        padding: 10,
        marginBottom: 20,
    },
    errorText: {
        color: "#F87171",
        fontSize: 12,
        fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    restartBtn: {
        backgroundColor: "#1DB954",
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 12,
        width: "100%",
        alignItems: "center",
    },
    restartBtnText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "800",
        letterSpacing: 1,
    },
});
