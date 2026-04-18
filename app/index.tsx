import React, { useEffect } from "react";
import { View, ActivityIndicator, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function Index() {
    const { loading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        console.log(`[IndexPage] State: loading=${loading}, auth=${isAuthenticated}`);
        // If auth state is resolved, the AuthContext should handle redirection.
        // But if it hangs, the user can use the emergency bypass button below.
    }, [loading, isAuthenticated]);

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <ActivityIndicator size="large" color="#1E40AF" />
                <Text style={styles.title}>BP-CRM MISSION CONTROL</Text>
                <Text style={styles.sub}>Synchronizing secure data structures...</Text>
                
                <View style={styles.emergencyBox}>
                    <Text style={styles.emergencyHint}>If startup takes more than 10 seconds:</Text>
                    <TouchableOpacity 
                        onPress={() => router.replace("/(auth)/login")}
                        style={styles.bypassBtn}
                    >
                        <Text style={styles.bypassText}>Force Login Screen</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        onPress={() => router.replace("/(tabs)")}
                        style={[styles.bypassBtn, { backgroundColor: '#F1F5F9', marginTop: 12 }]}
                    >
                        <Text style={[styles.bypassText, { color: '#64748B' }]}>Direct to Dashboard</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#EEF2FF",
        justifyContent: "center",
        alignItems: "center",
        padding: 40
    },
    content: {
        alignItems: 'center',
        width: '100%'
    },
    title: {
        marginTop: 24,
        color: "#1E40AF",
        fontSize: 18,
        fontWeight: "900",
        textAlign: "center",
        letterSpacing: 1
    },
    sub: {
        marginTop: 8,
        color: "#64748B",
        fontSize: 14,
        fontWeight: "600",
        textAlign: "center"
    },
    emergencyBox: {
        marginTop: 60,
        width: '100%',
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10
    },
    emergencyHint: {
        color: "#94A3B8",
        fontSize: 12,
        textAlign: "center",
        marginBottom: 16,
        fontWeight: "600"
    },
    bypassBtn: {
        backgroundColor: "#1E40AF",
        padding: 16,
        borderRadius: 12,
        alignItems: 'center'
    },
    bypassText: {
        color: "#FFFFFF",
        fontWeight: "800",
        fontSize: 14
    }
});
