import React from "react";
import { Stack } from "expo-router";
import { View, Text, StyleSheet, LogBox } from "react-native";
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

LogBox.ignoreLogs([
  'VirtualizedLists should never be nested',
  '[safeApiCall] Error:',
  'Network Error'
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
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>SYSTEM RENDER CRASH</Text>
          <Text style={styles.errorText}>{this.state.error?.toString()}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  console.log("[RootLayout] MOUNTING CORE SERVICES...");
  
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthProvider>
            <NotificationProvider>
              <UserProvider>
                <ProjectProvider>
                  <ThemeProvider>
                    <LookupProvider>
                      <DepartmentProvider>
                        <CallTrackingProvider>
                          <StatusBar style="auto" />
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
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#7F1D1D',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  errorTitle: {
    color: '#FECACA',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 10
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'monospace',
    textAlign: 'center'
  }
});
