import React from "react";
import { Stack } from "expo-router";
import { View, Text, StyleSheet, LogBox, ActivityIndicator, TouchableOpacity, ScrollView, Platform } from "react-native";
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
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { useCallMonitor } from "@/utils/CallMonitor";

// Prevent auto-hide so we control the white-screen phase
SplashScreen.preventAutoHideAsync().catch(() => {});

LogBox.ignoreLogs([
  'VirtualizedLists should never be nested',
  '[safeApiCall] Error:',
  'Network Error',
  'ActivityIndicator is not defined'
]);

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("[RootBoundary] Fatal error:", error, errorInfo);
    // EMERGENCY: If we crash during boot, hide splash screen so the error is visible
    SplashScreen.hideAsync().catch(() => {});
  }

  handleRestart = async () => {
    try {
        await Updates.reloadAsync();
    } catch (e) {
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
            <Text style={styles.errorSubtitle}>Something went wrong during rendering.</Text>
            <ScrollView style={styles.errorScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.errorText}>{this.state.error?.toString()}</Text>
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

function RootContent() {
  const [isReady, setIsReady] = React.useState(false);
  
  React.useEffect(() => {
    async function prepare() {
      try {
        console.log("[RootLayout] MOUNTING CONTENT...");
        await new Promise(resolve => setTimeout(resolve, 500)); 
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }
    }
    prepare();
  }, []);

  // WATCHDOG: Ensure splash screen hides even if 'prepare' hangs
  React.useEffect(() => {
    const timer = setTimeout(() => {
        if (!isReady) {
            console.warn("[RootContent] Startup watchdog triggered. Forcing splash hide.");
            setIsReady(true);
            SplashScreen.hideAsync().catch(() => {});
        }
    }, 6000);
    return () => clearTimeout(timer);
  }, [isReady]);

  useCallMonitor();
  
  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1DB954" />
        <Text style={{ color: '#fff', marginTop: 20, fontWeight: '700' }}>INITIALIZING CRM...</Text>
      </View>
    );
  }

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
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="index" />
                      <Stack.Screen name="(auth)/login" />
                      <Stack.Screen name="(tabs)" />
                    </Stack>
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
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <RootContent />
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </ErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  errorCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 30,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 15
  },
  errorTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4
  },
  errorSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center'
  },
  errorScroll: {
    maxHeight: 150,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 20
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  restartBtn: {
    backgroundColor: '#1DB954',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center'
  },
  restartBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1
  }
});
