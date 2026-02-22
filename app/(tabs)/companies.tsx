import { useEffect, useState, useCallback, useMemo } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator, Linking
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getCompanies, type Company } from "../services/companies.service";
import { lookupVal, safeApiCall } from "../services/api.helpers";

const RELATIONSHIP_COLORS: Record<string, string> = {
    'Developer': '#3B82F6',
    'Channel Partner': '#10B981',
    'Vendor': '#F59E0B',
    'Land Owner': '#8B5CF6',
    'Institutional Owner': '#6366F1',
    'Other': '#64748B'
};

function CompanyCard({ company, onPress }: { company: Company; onPress: () => void }) {
    const industry = lookupVal(company.industry);
    const type = company.relationshipType || 'Other';
    const color = RELATIONSHIP_COLORS[type] || '#64748B';
    const firstPhone = company.phones?.[0]?.phoneNumber;

    const handleCall = () => {
        if (firstPhone) Linking.openURL(`tel:${firstPhone}`);
    };

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
                <View style={[styles.avatar, { backgroundColor: color + "15" }]}>
                    <Text style={[styles.avatarText, { color: color }]}>{company.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.headerInfo}>
                    <Text style={styles.companyName} numberOfLines={1}>{company.name}</Text>
                    <View style={styles.row}>
                        <View style={[styles.typeBadge, { backgroundColor: color + "15" }]}>
                            <Text style={[styles.typeText, { color: color }]}>{type}</Text>
                        </View>
                        <Text style={styles.industryText}>{industry}</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                    <Ionicons name="call" size={20} color="#3B82F6" />
                </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.footer}>
                <View style={styles.meta}>
                    <Ionicons name="mail-outline" size={14} color="#94A3B8" />
                    <Text style={styles.metaText} numberOfLines={1}>{company.emails?.[0]?.address || "No Email"}</Text>
                </View>
                {company.isPreferredPartner && (
                    <View style={styles.preferredBadge}>
                        <Ionicons name="star" size={10} color="#F59E0B" />
                        <Text style={styles.preferredText}>Preferred</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}

export default function CompaniesScreen() {
    const router = useRouter();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchCompanies = useCallback(async () => {
        const result = await safeApiCall<Company>(() => getCompanies());
        if (!result.error) {
            setCompanies(result.data);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => { fetchCompanies(); }, []);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return companies.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.relationshipType || "").toLowerCase().includes(q) ||
            lookupVal(c.industry).toLowerCase().includes(q)
        );
    }, [companies, search]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.title}>Companies</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name, type, industry..."
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <CompanyCard
                            company={item}
                            onPress={() => router.push(`/company/${item._id}`)}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCompanies(); }} tintColor="#1E3A8A" />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="business-outline" size={60} color="#E2E8F0" />
                            <Text style={styles.emptyText}>{search ? "No clusters found" : "No partner companies yet"}</Text>
                        </View>
                    }
                />
            )}

            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push("/add-company")}
                activeOpacity={0.8}
            >
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: {
        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
        paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, backgroundColor: "#fff"
    },
    backBtn: { padding: 8 },
    title: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
    searchBar: {
        flexDirection: "row", alignItems: "center", margin: 16, paddingHorizontal: 16,
        paddingVertical: 10, backgroundColor: "#fff", borderRadius: 14,
        borderWidth: 1, borderColor: "#E2E8F0"
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: "#1E293B" },
    list: { padding: 16, paddingBottom: 100 },
    card: {
        backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 16,
        borderWidth: 1, borderColor: "#F1F5F9",
        shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }
    },
    cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    avatar: {
        width: 48, height: 48, borderRadius: 14,
        justifyContent: "center", alignItems: "center"
    },
    avatarText: { fontSize: 20, fontWeight: "800" },
    headerInfo: { flex: 1, marginLeft: 12 },
    companyName: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
    row: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 8 },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    typeText: { fontSize: 10, fontWeight: "800" },
    industryText: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
    callBtn: { padding: 10, backgroundColor: "#EFF6FF", borderRadius: 12 },
    divider: { height: 1, backgroundColor: "#F8FAFC", marginBottom: 12 },
    footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    meta: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
    metaText: { fontSize: 12, color: "#64748B", fontWeight: "500" },
    preferredBadge: {
        flexDirection: "row", alignItems: "center", gap: 4,
        backgroundColor: "#FFFBEB", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6
    },
    preferredText: { fontSize: 10, fontWeight: "800", color: "#D97706" },
    empty: { alignItems: "center", marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 16, color: "#94A3B8", fontWeight: "600" },
    fab: {
        position: "absolute", bottom: 24, right: 24,
        width: 60, height: 60, borderRadius: 30, backgroundColor: "#1E3A8A",
        justifyContent: "center", alignItems: "center",
        shadowColor: "#1E3A8A", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5
    }
});
