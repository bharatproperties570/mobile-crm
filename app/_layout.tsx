import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DepartmentProvider } from "@/context/DepartmentContext";
import { CallTrackingProvider } from "@/context/CallTrackingContext";
import { ThemeProvider } from "@/context/ThemeContext";

import { LookupProvider } from "@/context/LookupContext";
import { AuthProvider } from "@/context/AuthContext";
import { UserProvider } from "@/context/UserContext";
import { ProjectProvider } from "@/context/ProjectContext";
import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  'VirtualizedLists should never be nested',
  '[safeApiCall] Error:',
  'Network Error'
]);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <UserProvider>
          <ProjectProvider>
            <ThemeProvider>
              <LookupProvider>
                <DepartmentProvider>
                  <CallTrackingProvider>
                    <StatusBar style="auto" />
                    <Stack screenOptions={{ headerShown: false }} />
                  </CallTrackingProvider>
                </DepartmentProvider>
              </LookupProvider>
            </ThemeProvider>
          </ProjectProvider>
        </UserProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

