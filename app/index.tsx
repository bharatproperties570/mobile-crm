import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function Index() {
    const { loading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        console.log(`[IndexPage] AuthState: loading=${loading}, isAuthenticated=${isAuthenticated}`);
        if (!loading) {
            if (isAuthenticated) {
                console.log("[IndexPage] Redirecting to (tabs)");
                router.replace("/(tabs)");
            } else {
                console.log("[IndexPage] Redirecting to (auth)/login");
                router.replace("/(auth)/login");
            }
        }
    }, [loading, isAuthenticated]);

    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#EEF2FF" }}>
            <ActivityIndicator size="large" color="#1E40AF" />
        </View>
    );
}
