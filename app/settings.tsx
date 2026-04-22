import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { useTheme } from "@/context/ThemeContext";

const SettingsItem = memo(({ icon, label, sublabel, onPress, rightElement, color = "#64748B" }: any) => {
    const { theme } = useTheme();
    return (
        <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            <View style={styles.itemContent}>
                <Text style={[styles.itemLabel, { color: theme.text }]}>{label}</Text>
                {sublabel && <Text style={[styles.itemSublabel, { color: theme.textLight }]}>{sublabel}</Text>}
            </View>
            {rightElement ? rightElement : <Ionicons name="chevron-forward" size={18} color={theme.borderStrong} />}
        </TouchableOpacity>
    );
});

const SectionHeader = memo(({ title }: { title: string }) => {
    const { theme, isDarkMode } = useTheme();
    return <Text style={[styles.sectionTitle, { color: theme.textLight }]}>{title}</Text>;
});

export default function SettingsScreen() {
    const router = useRouter();
    const { isDarkMode, toggleTheme, theme } = useTheme();
    const [notifications, setNotifications] = useState(true);
    const [biometrics, setBiometrics] = useState(true);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.border }]}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.profileSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>BP</Text>
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={[styles.profileName, { color: theme.text }]}>Bharat Properties</Text>
                        <Text style={[styles.profileRole, { color: theme.textMuted }]}>Administrator • Sales Command</Text>
                    </View>
                    <TouchableOpacity style={[styles.editBtn, { backgroundColor: theme.border }]}>
                        <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                </View>

                <SectionHeader title="App Preferences" />
                <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <SettingsItem
                        icon="notifications-outline"
                        label="Push Notifications"
                        sublabel="Critical alerts and lead updates"
                        color="#4F46E5"
                        rightElement={<Switch value={notifications} onValueChange={setNotifications} trackColor={{ true: '#4F46E5', false: theme.borderStrong }} />}
                    />
                    <SettingsItem
                        icon="moon-outline"
                        label="Dark Mode"
                        sublabel="System morphing theme"
                        color="#1E293B"
                        rightElement={<Switch value={isDarkMode} onValueChange={toggleTheme} trackColor={{ true: '#4F46E5', false: theme.borderStrong }} />}
                        onPress={toggleTheme}
                    />
                    <SettingsItem
                        icon="language-outline"
                        label="Language"
                        sublabel="English (United States)"
                        color="#10B981"
                        onPress={() => alert("Language selection coming soon")}
                    />
                </View>
                {/* Security Section */}
                <SectionHeader title="Security & Privacy" />
                <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <SettingsItem
                        icon="finger-print-outline"
                        label="Biometric Lock"
                        sublabel="Secure Face ID / Touch ID"
                        color="#EC4899"
                        rightElement={<Switch value={biometrics} onValueChange={setBiometrics} trackColor={{ true: '#EC4899', false: theme.borderStrong }} />}
                    />
                    <SettingsItem
                        icon="shield-checkmark-outline"
                        label="Two-Factor Auth"
                        sublabel="Extra layer of protection"
                        color="#8B5CF6"
                        onPress={() => alert("Security settings feature coming soon")}
                    />
                    <SettingsItem
                        icon="key-outline"
                        label="Change Password"
                        color="#F59E0B"
                        onPress={() => alert("Password reset initiated via email")}
                    />
                </View>
                {/* System Section */}
                <SectionHeader title="System" />
                <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <SettingsItem
                        icon="cloud-download-outline"
                        label="Sync Data"
                        sublabel="Last synced 2m ago"
                        color="#3B82F6"
                        onPress={() => alert("Data synchronization synchronized!")}
                    />
                    <SettingsItem
                        icon="information-circle-outline"
                        label="About App"
                        sublabel="Version 3.0.5 (Enterprise)"
                        color="#64748B"
                        onPress={() => alert("Bharat Properties CRM v3.0.5\nStable Release")}
                    />
                    <SettingsItem
                        icon="bug-outline"
                        label="Report a Bug"
                        color="#EF4444"
                        onPress={() => alert("Bug report form opened")}
                    />
                </View>

                <TouchableOpacity 
                    style={[styles.logoutBtn, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2' }]}
                    onPress={() => alert("Logging out...")}
                >
                    <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: theme.textMuted }]}>Powered by Antigravity OS</Text>
                    <Text style={[styles.footerVersion, { color: theme.borderStrong }]}>© 2026 Bharat Properties CRM</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
    backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: "800" },

    content: { flex: 1, paddingHorizontal: 20 },

    profileSection: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 24, marginTop: 20, marginBottom: 24, borderWidth: 1 },
    avatar: { width: 56, height: 56, borderRadius: 20, backgroundColor: "#2563EB", justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: "#fff", fontSize: 20, fontWeight: "800" },
    profileInfo: { flex: 1, marginLeft: 16 },
    profileName: { fontSize: 17, fontWeight: "700" },
    itemLabel: { fontSize: 15, fontWeight: "600" },
    itemSublabel: { fontSize: 12, fontWeight: "500", marginTop: 2 },

    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 20, marginTop: 8, marginBottom: 30 },
    logoutText: { color: "#EF4444", fontSize: 15, fontWeight: "700" },

    footer: { alignItems: 'center', marginBottom: 50 },
    footerText: { fontSize: 13, fontWeight: "700" },
    footerVersion: { fontSize: 11, fontWeight: "600", marginTop: 4 }
});
