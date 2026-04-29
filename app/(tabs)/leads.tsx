import { useEffect, useState, useCallback, useMemo, useRef, memo } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator, Alert, Linking,
    Modal, Animated, Dimensions, Pressable, ScrollView, Vibration
} from "react-native";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { getLeads, leadName, updateLead, deleteLead, type Lead } from "@/services/leads.service";
import { getLookups, type Lookup } from "@/services/lookups.service";
import { safeApiCall, lookupVal } from "@/services/api.helpers";
import { getLeadScores } from "@/services/stageEngine.service";
import { useCallTracking } from "@/context/CallTrackingContext";
import { useTheme } from "@/context/ThemeContext";
import { useLookup } from "@/context/LookupContext";
import { useUsers } from "@/context/UserContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

function resolveName(field: unknown, getLookupValue?: (type: string, val: any) => string, findUser?: (id: string) => any): string {
    if (!field) return "None";
    if (Array.isArray(field)) {
        return field.map(item => resolveName(item, getLookupValue, findUser)).filter(name => name && name !== "None").join(", ") || "None";
    }
    if (typeof field === "object" && field !== null) {
        const obj = field as any;
        if (obj.lookup_value) return String(obj.lookup_value);
        if (obj.fullName) return String(obj.fullName);
        if (obj.name) return String(obj.name);
    }
    return String(field);
}

const LeadCard = memo(({ lead, index, onPress, onMore, isSelected }: any) => {
    const { theme, isDarkMode } = useTheme();
    const { getLookupValue } = useLookup();
    const { findUser } = useUsers();
    const name = String(leadName(lead) || "Unnamed");
    const mobile = String(lead.mobile || "No Mobile");
    const email = lead.email ? String(lead.email) : null;
    const reqText = String(getLookupValue("Category", lead.propertyType) || "No Req");

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, isSelected && styles.cardSelected]}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.text }}>{name}</Text>
                        <TouchableOpacity onPress={onMore} style={{ padding: 4 }}><Ionicons name="ellipsis-vertical" size={20} color={theme.textMuted} /></TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Ionicons name="call" size={12} color={theme.textMuted} />
                        <Text style={{ fontSize: 12, color: theme.textSecondary, marginLeft: 4 }}>{mobile}</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>{reqText}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
});

export default function LeadsScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const { isAuthenticated } = useAuth();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [sheetVisible, setSheetVisible] = useState(false);

    const fetchLeads = useCallback(async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        const result = await safeApiCall<Lead>(() => getLeads({ q: search, limit: "50" }));
        if (!result.error && result.data) {
            setLeads(result.data);
        }
        setLoading(false);
        setRefreshing(false);
    }, [search, isAuthenticated]);

    useFocusEffect(useCallback(() => { fetchLeads(); }, [fetchLeads]));

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <Text style={[styles.title, { color: theme.text }]}>LEADS</Text>
            </View>
            {loading ? <ActivityIndicator color={theme.primary} size="large" style={{ marginTop: 50 }} /> : (
                <FlatList
                    data={leads}
                    keyExtractor={(item) => String(item._id)}
                    contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
                    renderItem={({ item }) => (
                        <LeadCard
                            lead={item}
                            isSelected={selectedIds.includes(item._id)}
                            onPress={() => router.push(`/lead-detail?id=${item._id}`)}
                            onMore={() => { setSelectedLead(item); setSheetVisible(true); }}
                        />
                    )}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLeads(); }} tintColor={theme.primary} />}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 16, paddingTop: 60, borderBottomWidth: 1 },
    title: { fontSize: 20, fontWeight: "900" },
    card: { padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
    cardSelected: { borderWidth: 2, borderColor: '#3B82F6' },
});
