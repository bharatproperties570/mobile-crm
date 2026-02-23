import { useState, useCallback, useEffect, memo } from "react";
import {
    View, Text, StyleSheet, TextInput, FlatList,
    TouchableOpacity, ActivityIndicator, SafeAreaView, Keyboard
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getLeads } from "./services/leads.service";
import { getContacts } from "./services/contacts.service";
import { getDeals } from "./services/deals.service";
import { getProjects } from "./services/projects.service";
import { getInventory } from "./services/inventory.service";
import { extractList } from "./services/api.helpers";

type ResultType = 'Lead' | 'Contact' | 'Deal' | 'Project' | 'Inventory' | 'Command';

interface SearchResult {
    id: string;
    title: string;
    subtitle?: string;
    type: ResultType;
    icon: string;
    color: string;
    route: string;
}

const COMMANDS = [
    { id: 'c1', title: 'Add New Lead', type: 'Command', icon: 'person-add', color: '#3B82F6', route: '/add-lead' },
    { id: 'c2', title: 'Schedule Activity', type: 'Command', icon: 'calendar', color: '#F59E0B', route: '/add-activity' },
    { id: 'c3', title: 'Create Deal', type: 'Command', icon: 'briefcase', color: '#10B981', route: '/add-deal' },
    { id: 'c4', title: 'Add Inventory', type: 'Command', icon: 'add-circle', color: '#8B5CF6', route: '/add-inventory' },
    { id: 'c5', title: 'Go to Dashboard', type: 'Command', icon: 'home', color: '#6366F1', route: '/(tabs)' },
];

export default function SearchScreen() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    const performSearch = useCallback(async (text: string) => {
        if (!text || text.length < 2) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            const params = { search: text, limit: '5' };
            const [l, c, d, p, i] = await Promise.allSettled([
                getLeads(params),
                getContacts(params),
                getDeals(params),
                getProjects(), // Projects API might not support params, we'll filter client-side if needed
                getInventory(params)
            ]);

            const newResults: SearchResult[] = [];

            // Add Commands if applicable
            const commandMatches = COMMANDS.filter(cmd =>
                cmd.title.toLowerCase().includes(text.toLowerCase())
            );
            newResults.push(...(commandMatches as any[]));

            if (l.status === 'fulfilled') {
                extractList(l.value).forEach((item: any) => {
                    newResults.push({
                        id: item._id,
                        title: `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unnamed Lead',
                        subtitle: item.mobile || item.email || 'Lead',
                        type: 'Lead',
                        icon: 'people',
                        color: '#3B82F6',
                        route: `/lead-detail?id=${item._id}`
                    });
                });
            }

            if (c.status === 'fulfilled') {
                extractList(c.value).forEach((item: any) => {
                    newResults.push({
                        id: item._id,
                        title: item.fullName || item.name || 'Unnamed Contact',
                        subtitle: item.phones?.[0]?.number || 'Contact',
                        type: 'Contact',
                        icon: 'person-circle',
                        color: '#6366F1',
                        route: `/contact-detail?id=${item._id}`
                    });
                });
            }

            if (d.status === 'fulfilled') {
                extractList(d.value).forEach((item: any) => {
                    newResults.push({
                        id: item._id,
                        title: item.title || item.name || item.dealId || 'Untitled Deal',
                        subtitle: `₹${item.amount || item.price || 0} • ${item.stage || 'Deal'}`,
                        type: 'Deal',
                        icon: 'wallet',
                        color: '#10B981',
                        route: `/deal-detail?id=${item._id}`
                    });
                });
            }

            if (p.status === 'fulfilled') {
                extractList(p.value)
                    .filter((item: any) => item.name.toLowerCase().includes(text.toLowerCase()))
                    .forEach((item: any) => {
                        newResults.push({
                            id: item._id,
                            title: item.name,
                            subtitle: item.location || 'Project',
                            type: 'Project',
                            icon: 'cube',
                            color: '#F59E0B',
                            route: `/project-detail?id=${item._id}`
                        });
                    });
            }

            if (i.status === 'fulfilled') {
                extractList(i.value).forEach((item: any) => {
                    newResults.push({
                        id: item._id,
                        title: `Unit ${item.unitNumber} • ${item.projectName}`,
                        subtitle: `${item.block} • ${item.status || 'Inventory'}`,
                        type: 'Inventory',
                        icon: 'grid',
                        color: '#8B5CF6',
                        route: `/inventory-detail?id=${item._id}`
                    });
                });
            }

            setResults(newResults);
        } catch (error) {
            console.error("Global search error:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timeout = setTimeout(() => performSearch(query), 400);
        return () => clearTimeout(timeout);
    }, [query, performSearch]);

    const ResultItem = memo(({ item, onPress }: { item: SearchResult; onPress: () => void }) => (
        <TouchableOpacity
            style={styles.resultItem}
            onPress={onPress}
        >
            <View style={[styles.iconBox, { backgroundColor: item.color + '15' }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
            </View>
            <View style={styles.resultInfo}>
                <View style={styles.resultHeader}>
                    <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={[styles.typeBadge, { backgroundColor: item.color + '10' }]}>
                        <Text style={[styles.typeText, { color: item.color }]}>{item.type.toUpperCase()}</Text>
                    </View>
                </View>
                {item.subtitle && <Text style={styles.resultSubtitle}>{item.subtitle}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
        </TouchableOpacity>
    ));

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search anything..."
                        placeholderTextColor="#94A3B8"
                        autoFocus
                        value={query}
                        onChangeText={setQuery}
                        returnKeyType="search"
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery("")}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {loading && (
                <View style={styles.loadingBar}>
                    <ActivityIndicator size="small" color="#3B82F6" />
                </View>
            )}

            <FlatList
                data={results}
                keyExtractor={(item) => `${item.type}-${item.id}`}
                renderItem={({ item }) => (
                    <ResultItem
                        item={item}
                        onPress={() => {
                            Keyboard.dismiss();
                            router.push(item.route as any);
                        }}
                    />
                )}
                contentContainerStyle={styles.list}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
                ListEmptyComponent={
                    !loading && query.length >= 2 ? (
                        <View style={styles.empty}>
                            <Ionicons name="search-outline" size={64} color="#E2E8F0" />
                            <Text style={styles.emptyText}>No matches found for "{query}"</Text>
                        </View>
                    ) : !loading && query.length < 2 ? (
                        <View style={styles.suggestions}>
                            <Text style={styles.suggestionTitle}>Quick Commands</Text>
                            {COMMANDS.map(cmd => (
                                <TouchableOpacity
                                    key={cmd.id}
                                    style={styles.suggestionItem}
                                    onPress={() => router.push(cmd.route as any)}
                                >
                                    <View style={[styles.suggestionIcon, { backgroundColor: cmd.color + '15' }]}>
                                        <Ionicons name={cmd.icon as any} size={18} color={cmd.color} />
                                    </View>
                                    <Text style={styles.suggestionLabel}>{cmd.title}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : null
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    backBtn: { marginRight: 12 },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: '#1E293B',
        fontWeight: '600'
    },
    loadingBar: {
        height: 2,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10
    },
    list: { padding: 16 },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    resultInfo: { flex: 1 },
    resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    resultTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B', flex: 1, marginRight: 8 },
    typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    typeText: { fontSize: 9, fontWeight: '900' },
    resultSubtitle: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 15, color: '#94A3B8', fontWeight: '600' },
    suggestions: { marginTop: 20 },
    suggestionTitle: { fontSize: 13, fontWeight: '800', color: '#94A3B8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20
    },
    suggestionIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    suggestionLabel: { fontSize: 15, fontWeight: '700', color: '#334155' }
});
