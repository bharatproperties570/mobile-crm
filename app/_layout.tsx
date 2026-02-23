import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DepartmentProvider } from "./context/DepartmentContext";
import { CallTrackingProvider } from "./context/CallTrackingContext";
import { ThemeProvider } from "./context/ThemeContext";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <DepartmentProvider>
          <CallTrackingProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
          </CallTrackingProvider>
        </DepartmentProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
