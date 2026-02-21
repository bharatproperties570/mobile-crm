import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { storage } from "../services/storage";
import api from "../services/api";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert("Error", "Please enter email and password.");
            return;
        }
        setLoading(true);
        try {
            const response = await api.post("/auth/login", { email, password });
            const token = response.data?.token || response.data?.accessToken;
            if (token) {
                await storage.setItem("authToken", token);
                router.replace("/(tabs)");
            } else {
                Alert.alert("Login Failed", "Invalid credentials.");
            }
        } catch (error: any) {
            const message = error?.response?.data?.message || "Could not connect to server.";
            Alert.alert("Login Failed", message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <View style={styles.logoContainer}>
                    <View style={styles.logoCircle}>
                        <Text style={styles.logoText}>BP</Text>
                    </View>
                    <Text style={styles.appName}>Bharat Properties</Text>
                    <Text style={styles.subtitle}>CRM — Sales Team App</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Welcome Back 👋</Text>
                    <Text style={styles.cardSubtitle}>Sign in to continue</Text>

                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="you@bharatproperties.com"
                        placeholderTextColor="#9CA3AF"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        editable={!loading}
                    />

                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="#9CA3AF"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        editable={!loading}
                    />

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Sign In →</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <Text style={styles.footer}>Bharat Properties CRM v1.0</Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#EEF2FF" },
    scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
    logoContainer: { alignItems: "center", marginBottom: 32 },
    logoCircle: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: "#1E40AF", justifyContent: "center", alignItems: "center", marginBottom: 14,
        shadowColor: "#1E40AF", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
    },
    logoText: { color: "#fff", fontSize: 28, fontWeight: "800" },
    appName: { fontSize: 24, fontWeight: "800", color: "#1E293B" },
    subtitle: { fontSize: 13, color: "#64748B", marginTop: 4 },
    card: {
        backgroundColor: "#fff", borderRadius: 24, padding: 28,
        shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 5,
    },
    cardTitle: { fontSize: 20, fontWeight: "700", color: "#1E293B" },
    cardSubtitle: { fontSize: 13, color: "#94A3B8", marginBottom: 24, marginTop: 4 },
    label: { fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 6, marginTop: 14, textTransform: "uppercase", letterSpacing: 0.5 },
    input: {
        borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12,
        padding: 14, fontSize: 15, color: "#1E293B", backgroundColor: "#F8FAFC",
    },
    button: {
        backgroundColor: "#1E40AF", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 28,
        shadowColor: "#1E40AF", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    footer: { textAlign: "center", color: "#CBD5E1", fontSize: 12, marginTop: 32 },
});
