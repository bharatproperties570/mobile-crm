import React from "react";
import { Stack } from "expo-router";
import {
    View,
    Text,
    StyleSheet,
    LogBox,
    TouchableOpacity,
    Platform,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../context/AuthContext";
import { UserProvider } from "../context/UserContext";
import { ProjectProvider } from "../context/ProjectContext";
import { ThemeProvider } from "../context/ThemeContext";
import { LookupProvider } from "../context/LookupContext";
import { DepartmentProvider } from "../context/DepartmentContext";
import { CallTrackingProvider } from "../context/CallTrackingContext";
import { NotificationProvider } from "../context/NotificationContext";
import * as SplashScreen from "expo-splash-screen";
import { useCallMonitor } from "../utils/CallMonitor";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";

// ── Prevent native splash from auto-hiding ──────────────────────────────────
SplashScreen.preventAutoHideAsync().catch(() => {});

LogBox.ignoreLogs(['ViewPropTypes will be removed', 'ColorPropType will be removed']);

function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
    return (
        <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={64} color="#EF4444" />
            <Text style={styles.errorTitle}>System Initialization Failure</Text>
            <Text style={styles.errorText}>{error.message}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={reset}>
                <Text style={styles.retryText}>Restart Command Center</Text>
            </TouchableOpacity>
        </View>
    );
}

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
        SplashScreen.hideAsync().catch(() => {});
    }
    render() {
        if (this.state.hasError) {
            return <ErrorFallback error={this.state.error} reset={() => this.setState({ hasError: false })} />;
        }
        return this.props.children;
    }
}

function NavigatorContent() {
    useCallMonitor();
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#121212" },
                animation: Platform.OS === "android" ? "fade" : "default",
                animationDuration: 150,
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)/login" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" />
        </Stack>
    );
}

function RootContent() {
    return (
        <AuthProvider>
            <NotificationProvider>
                <UserProvider>
                    <ProjectProvider>
                        <ThemeProvider>
                            <LookupProvider>
                                <DepartmentProvider>
                                    <CallTrackingProvider>
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
    const [fontsLoaded, fontError] = useFonts({
        ...Ionicons.font,
    });

    React.useEffect(() => {
        if (fontError) {
            console.error("[RootLayout] Font load error:", fontError);
        }
    }, [fontError]);

    const onLayoutRootView = React.useCallback(async () => {
        if (fontsLoaded || fontError) {
            // Give the app 300ms to paint the first frame behind the splash
            setTimeout(() => {
                SplashScreen.hideAsync().catch(() => {});
            }, 300);
        }
    }, [fontsLoaded, fontError]);

    if (!fontsLoaded && !fontError) {
        return <View style={{ flex: 1, backgroundColor: "#121212" }} />;
    }

    return (
        <View style={styles.root} onLayout={onLayoutRootView}>
            <StatusBar style="light" />
            <ErrorBoundary>
                <SafeAreaProvider style={styles.root}>
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
    },
    errorContainer: {
        flex: 1,
        backgroundColor: "#121212",
        justifyContent: "center",
        alignItems: "center",
        padding: 30,
    },
    errorTitle: {
        fontSize: 22,
        fontWeight: "900",
        color: "#FFFFFF",
        marginTop: 20,
        textAlign: "center",
    },
    errorText: {
        fontSize: 15,
        color: "#94A3B8",
        textAlign: "center",
        marginTop: 12,
        lineHeight: 22,
    },
    retryButton: {
        marginTop: 30,
        backgroundColor: "#1DB954",
        paddingHorizontal: 25,
        paddingVertical: 14,
        borderRadius: 12,
    },
    retryText: {
        color: "#FFFFFF",
        fontWeight: "800",
        fontSize: 16,
    },
});
