import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { storage } from "./services/storage";

export default function Index() {
    const [checking, setChecking] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        storage.getItem("authToken").then(token => {
            setIsLoggedIn(!!token);
            setChecking(false);
        });
    }, []);

    if (checking) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#EEF2FF" }}>
                <ActivityIndicator size="large" color="#1E40AF" />
            </View>
        );
    }

    return <Redirect href={isLoggedIn ? "/(tabs)" : "/(auth)/login"} />;
}
