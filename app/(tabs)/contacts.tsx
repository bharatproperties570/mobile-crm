import { useEffect, useState, useCallback, useMemo } from "react";
import {
    View, Text, StyleSheet, SectionList, TextInput,
    RefreshControl, ActivityIndicator, Linking, TouchableOpacity, Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
    getContacts, contactFullName, contactPhone, contactEmail,
    lookupVal, type Contact,
} from "../services/contacts.service";
import { safeApiCall } from "../services/api.helpers";
import { useCallTracking } from "../context/CallTrackingContext";

const AVATAR_COLORS = ["#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6"];

const STAGE_COLORS: Record<string, string> = {
    new: "#6366F1",
    warm: "#F59E0B",
    hot: "#EF4444",
    cold: "#94A3B8",
    active: "#10B981",
};

function getInitials(c: Contact): string {
    if (c.fullName) {
        const parts = c.fullName.split(" ").filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    const n = (c.name || "").trim();
    const s = (c.surname || "").trim();
    if (n && s) return (n[0] + s[0]).toUpperCase();
    if (n) return n.slice(0, 2).toUpperCase();
    return "?";
}

function ContactRow({ contact, idx, onPress }: { contact: Contact; idx: number; onPress: () => void }) {
    const { trackCall } = useCallTracking();
    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
    const name = contactFullName(contact);
    const phone = contactPhone(contact);
    const email = contactEmail(contact);
    const stage = (contact.stage || "new").toLowerCase();
    const stageColor = STAGE_COLORS[stage] ?? "#94A3B8";

    const openWhatsApp = () => {
        if (!phone) return;
        const cleanPhone = phone.replace(/[^0-9]/g, "");
        Linking.openURL(`whatsapp://send?phone=${cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone}`);
    };

    return (
        <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
            <View style={[styles.avatar, { backgroundColor: color + "15" }]}>
                <Text style={[styles.avatarText, { color }]}>{getInitials(contact)}</Text>
            </View>
            <View style={styles.rowContent}>
                <View style={styles.rowMain}>
                    <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
                    <View style={[styles.stageDot, { backgroundColor: stageColor }]} />
                </View>
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {lookupVal(contact.designation) !== "—" ? `${lookupVal(contact.designation)} • ` : ""}
                    {contact.company || (phone ? phone : "Individual")}
                </Text>
            </View>
            <View style={styles.rowActions}>
                {phone ? (
                    <TouchableOpacity style={styles.miniAction} onPress={(e) => { e.stopPropagation(); trackCall(phone, contact._id, "Contact", name); }}>
                        <Text style={styles.miniIcon}>📞</Text>
                    </TouchableOpacity>
                ) : null}
                {phone ? (
                    <TouchableOpacity style={[styles.miniAction, { backgroundColor: "#DCFCE7" }]} onPress={(e) => { e.stopPropagation(); openWhatsApp(); }}>
                        <Text style={styles.miniIcon}>💬</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

export default function ContactsScreen() {
    const router = useRouter();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchContacts = useCallback(async () => {
        const result = await safeApiCall<Contact>(() => getContacts());
        if (result.error) {
            Alert.alert("Data Load Error", `Could not load contacts:\n${result.error}`, [{ text: "Retry", onPress: fetchContacts }]);
        } else {
            setContacts(result.data);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchContacts();
        }, [fetchContacts])
    );

    const sections = useMemo(() => {
        const q = search.toLowerCase();
        const filtered = contacts.filter((c) => {
            const name = contactFullName(c).toLowerCase();
            const phone = contactPhone(c);
            const comp = (c.company || "").toLowerCase();
            const tags = (c.tags || []).join(" ").toLowerCase();
            return name.includes(q) || phone.includes(q) || comp.includes(q) || tags.includes(q);
        });

        const groups: Record<string, Contact[]> = {};
        filtered.forEach(c => {
            const firstLetter = contactFullName(c)[0]?.toUpperCase() || "#";
            const key = /[A-Z]/.test(firstLetter) ? firstLetter : "#";
            if (!groups[key]) groups[key] = [];
            groups[key].push(c);
        });

        return Object.keys(groups)
            .sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)))
            .map(key => ({
                title: key,
                data: groups[key].sort((a, b) => contactFullName(a).localeCompare(contactFullName(b)))
            }));
    }, [contacts, search]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Phonebook</Text>
                    <Text style={styles.headerSubtitle}>{contacts.length} CRM Contacts</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/add-contact")}>
                    <Text style={styles.addBtnText}>+ New</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchBox}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search relationships..."
                        placeholderTextColor="#94A3B8"
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
            </View>

            {loading ? (
                <ActivityIndicator color="#6366F1" size="large" style={{ marginTop: 60 }} />
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item, index }) => <ContactRow contact={item} idx={index} onPress={() => router.push(`/contact-detail?id=${item._id}`)} />}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{title}</Text>
                        </View>
                    )}
                    contentContainerStyle={styles.list}
                    stickySectionHeadersEnabled={true}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchContacts(); }} tintColor="#6366F1" />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyIcon}>👤</Text>
                            <Text style={styles.emptyText}>{search ? "No results found" : "Your phonebook is empty"}</Text>
                        </View>
                    }
                />
            )}

            <TouchableOpacity style={styles.fab} onPress={() => router.push("/add-contact")}>
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#FFF" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
    headerTitle: { fontSize: 32, fontWeight: "900", color: "#1E293B", letterSpacing: -1 },
    headerSubtitle: { fontSize: 13, color: "#64748B", fontWeight: "600", marginTop: 2 },
    addBtn: { backgroundColor: "#F1F5F9", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    addBtnText: { color: "#6366F1", fontWeight: "800", fontSize: 13 },
    searchContainer: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    searchBox: {
        flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    },
    searchIcon: { fontSize: 15, marginRight: 8 },
    searchInput: { flex: 1, fontSize: 16, color: "#1E293B", fontWeight: "600" },
    list: { paddingBottom: 120 },
    sectionHeader: { backgroundColor: "#F8FAFC", paddingHorizontal: 20, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    sectionTitle: { fontSize: 14, fontWeight: "800", color: "#6366F1" },
    row: {
        flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12,
        backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F8FAFC"
    },
    avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", marginRight: 16 },
    avatarText: { fontSize: 16, fontWeight: "800" },
    rowContent: { flex: 1 },
    rowMain: { flexDirection: "row", alignItems: "center" },
    rowName: { fontSize: 17, fontWeight: "700", color: "#334155", marginRight: 8 },
    stageDot: { width: 8, height: 8, borderRadius: 4 },
    rowSubtitle: { fontSize: 13, color: "#94A3B8", marginTop: 2, fontWeight: "500" },
    rowActions: { flexDirection: "row", gap: 8 },
    miniAction: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
    miniIcon: { fontSize: 13 },
    fab: {
        position: "absolute", bottom: 40, right: 20, width: 60, height: 60, borderRadius: 30,
        backgroundColor: "#1E293B", justifyContent: "center", alignItems: "center",
        shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6,
    },
    fabText: { fontSize: 32, color: "#fff", lineHeight: 36 },
    empty: { alignItems: "center", marginTop: 100 },
    emptyIcon: { fontSize: 60, color: "#E2E8F0", marginBottom: 16 },
    emptyText: { fontSize: 18, color: "#94A3B8", fontWeight: "700" },
});
