import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { storage } from "./services/storage";
import api from "./services/api";

export default function Index() {
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const autoLogin = async () => {
            try {
                console.log("Attempting background auto-login...");
                const response = await api.post("/auth/login", { email: "test@bharatproperties.com", password: "Test@123" });
                const token = response.data?.token || response.data?.accessToken;
                if (token) {
                    console.log("Auto-login successful, saving token.");
                    await storage.setItem("authToken", token);
                }
            } catch (error: any) {
                console.warn("Auto-login failed:", error?.response?.data || error.message);
            } finally {
                setChecking(false);
            }
        };

        storage.getItem("authToken").then(token => {
            if (!token) {
                autoLogin();
            } else {
                setChecking(false);
            }
        });
    }, []);

    if (checking) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#EEF2FF" }}>
                <ActivityIndicator size="large" color="#1E40AF" />
            </View>
        );
    }

    return <Redirect href="/(tabs)" />;
}
