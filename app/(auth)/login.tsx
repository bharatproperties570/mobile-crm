import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
    Dimensions, Image
} from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

const logoImg = require("../../assets/images/crm-logo.png");

const { width, height } = Dimensions.get("window");

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert("Required", "Please provide email and password.");
            return;
        }
        setLoading(true);
        try {
            const response = await api.post("/auth/login", { email, password });
            const token = response.data?.token || response.data?.accessToken;
            if (token) {
                await login(token, response.data?.user);
                // AuthContext handles redirection to (tabs)
            } else {
                Alert.alert("Security Check", "We couldn't verify those credentials. Please try again.");
            }
        } catch (error: any) {
            console.error("Login attempt failed:", error?.response?.data || error.message);
            const message = error?.response?.data?.message || "Ensure your server is reachable and try again.";
            Alert.alert("Authentication Failed", message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView 
                contentContainerStyle={styles.scroll} 
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Top Section / Branding */}
                <View style={styles.headerSection}>
                    <View style={styles.logoContainer}>
                        <Image 
                            source={logoImg} 
                            style={styles.logo} 
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={styles.brandName}>Bharat Properties</Text>
                    <Text style={styles.brandSlogan}>Mobile Sales Command Center</Text>
                </View>

                {/* Login Card */}
                <View style={styles.authCard}>
                    <Text style={styles.welcomeText}>Welcome Back</Text>
                    <Text style={styles.loginInstruction}>Sign in to access your dashboard</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Corporate Email</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="mail-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                            <TextInput
                                style={styles.textInput}
                                placeholder="name@bharatproperties.com"
                                placeholderTextColor="#94A3B8"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                editable={!loading}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Security Password</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
                            <TextInput
                                style={styles.textInput}
                                placeholder="Your Secure Password"
                                placeholderTextColor="#94A3B8"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                editable={!loading}
                            />
                        </View>
                    </View>

                    <TouchableOpacity 
                        style={styles.forgotPassword}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.forgotText}>Forgot password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.primaryButton, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <View style={styles.buttonContent}>
                                <Text style={styles.buttonLabel}>Authenticate</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* System Info */}
                <View style={styles.systemFooter}>
                    <Text style={styles.versionTag}>BP-CRM Mobile Version 2.0</Text>
                    <Text style={styles.securitySeal}>
                        <Ionicons name="shield-checkmark" size={14} color="#CBD5E1" /> Secure Encrypted Connection
                    </Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: "#F8FAFC" 
    },
    scroll: { 
        flexGrow: 1, 
        justifyContent: "space-between",
        paddingBottom: 40 
    },
    headerSection: {
        backgroundColor: "#0F172A",
        height: height * 0.35,
        justifyContent: "center",
        alignItems: "center",
        borderBottomLeftRadius: 60,
        borderBottomRightRadius: 60,
        paddingBottom: 40,
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
    },
    logoContainer: {
        width: 200,
        height: 140,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
    },
    logo: {
        width: "100%",
        height: "100%"
    },
    brandName: {
        fontSize: 28,
        fontWeight: "900",
        color: "#fff",
        letterSpacing: -1
    },
    brandSlogan: {
        fontSize: 14,
        color: "rgba(255, 255, 255, 0.7)",
        marginTop: 6,
        fontWeight: "500"
    },
    authCard: {
        backgroundColor: "#fff",
        borderRadius: 30,
        marginHorizontal: 20,
        marginTop: -60,
        padding: 30,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 30,
        elevation: 10,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: "800",
        color: "#0F172A",
        textAlign: "left"
    },
    loginInstruction: {
        fontSize: 14,
        color: "#64748B",
        marginBottom: 35,
        marginTop: 4
    },
    inputGroup: {
        marginBottom: 20
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: "#334155",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 8,
        marginLeft: 4
    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        borderRadius: 15,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: "#E2E8F0"
    },
    inputIcon: {
        marginRight: 10
    },
    textInput: {
        flex: 1,
        paddingVertical: 15,
        fontSize: 16,
        color: "#0F172A",
        fontWeight: "600"
    },
    forgotPassword: {
        alignSelf: "flex-end",
        marginBottom: 30
    },
    forgotText: {
        fontSize: 13,
        color: "#0F172A",
        fontWeight: "700"
    },
    primaryButton: {
        backgroundColor: "#1E3A8A",
        borderRadius: 18,
        paddingVertical: 18,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#1E3A8A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonDisabled: {
        opacity: 0.7,
        backgroundColor: "#94A3B8"
    },
    buttonContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    buttonLabel: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "800"
    },
    systemFooter: {
        alignItems: "center",
        marginTop: 40
    },
    versionTag: {
        fontSize: 12,
        color: "#94A3B8",
        fontWeight: "600"
    },
    securitySeal: {
        fontSize: 11,
        color: "#CBD5E1",
        marginTop: 8,
        fontWeight: "500",
        flexDirection: "row",
        alignItems: "center"
    }
});
