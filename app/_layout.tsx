import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DepartmentProvider } from "./context/DepartmentContext";
import { CallTrackingProvider } from "./context/CallTrackingContext";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DepartmentProvider>
        <CallTrackingProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </CallTrackingProvider>
      </DepartmentProvider>
    </GestureHandlerRootView>
  );
}
