import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator, SafeAreaView, Linking } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "@/services/api";
import { useTheme } from "@/context/ThemeContext";

export default function DocumentsScreen() {
    const router = useRouter();
    const { id, dealId, type = "Deal" } = useLocalSearchParams<{ id: string; dealId: string; type: string }>();
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [entityData, setEntityData] = useState<any>(null);
    const [documents, setDocuments] = useState<any[]>([]);

    const targetId = id || dealId;
    const targetType = dealId ? "Deal" : type;

    const fetchDocuments = useCallback(async () => {
        if (!targetId) return;
        setLoading(true);
        try {
            const endpoint = targetType === "Deal" ? `/deals/${targetId}` : 
                           targetType === "Lead" ? `/leads/${targetId}` :
                           targetType === "Contact" ? `/contacts/${targetId}` : `/inventory/${targetId}`;
            
            const res = await api.get(endpoint);
            const data = res.data?.data || res.data;
            setEntityData(data);
            
            // Map different document field names across models
            let docs = [];
            if (targetType === "Deal") docs = data.documents || [];
            else if (targetType === "Inventory") docs = data.inventoryDocuments || [];
            else docs = data.documents || [];
            
            setDocuments(docs);
        } catch (error) {
            console.error("Fetch documents error:", error);
            Alert.alert("Error", "Failed to load documents");
        } finally {
            setLoading(false);
        }
    }, [targetId, targetType]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    const handleAdd = () => {
        router.push(`/add-document?id=${targetId}&type=${targetType}`);
    };

    const openDocument = (url: string) => {
        if (!url) return;
        Linking.openURL(url).catch(err => {
            console.error("Failed to open URL:", err);
            Alert.alert("Error", "Could not open document");
        });
    };

    const renderItem = ({ item }: any) => {
        const isPdf = item.url?.toLowerCase().endsWith('.pdf') || item.type?.toLowerCase() === 'pdf' || item.documentType?.toLowerCase() === 'pdf';
        return (
            <TouchableOpacity style={[styles.docItem, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => openDocument(item.url || item.documentPicture)}>
                <View style={[styles.docIcon, { backgroundColor: isPdf ? '#FEE2E220' : '#EFF6FF20' }]}>
                    <Ionicons
                        name={isPdf ? "document-text" : "image"}
                        size={24}
                        color={isPdf ? "#EF4444" : "#3B82F6"}
                    />
                </View>
                <View style={styles.docInfo}>
                    <Text style={[styles.docName, { color: theme.text }]}>{item.name || item.documentNo || item.documentNumber || "Unnamed Document"}</Text>
                    <Text style={[styles.docMeta, { color: theme.textSecondary }]}>
                        {item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString() : "No Date"} • {item.type || item.documentType || "Standard"}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Documents</Text>
                    <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
                        {entityData?.dealId || entityData?.firstName || entityData?.unitNo || "Collection"}
                    </Text>
                </View>
                <TouchableOpacity onPress={handleAdd} style={styles.addBtn}>
                    <Ionicons name="add-circle" size={32} color={theme.primary} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>
            ) : (
                <FlatList
                    data={documents}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => index.toString()}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="cloud-upload-outline" size={64} color={theme.border} />
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No documents found</Text>
                            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: theme.primary }]} onPress={handleAdd}>
                                <Text style={styles.emptyBtnText}>Upload First Document</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
    headerTitleWrap: { flex: 1, marginLeft: 16 },
    headerTitle: { fontSize: 20, fontWeight: "900" },
    headerSub: { fontSize: 12, fontWeight: "600", textTransform: 'uppercase' },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    list: { padding: 20 },
    docItem: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
    docIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 },
    docInfo: { flex: 1 },
    docName: { fontSize: 15, fontWeight: "700" },
    docMeta: { fontSize: 12, marginTop: 2 },
    empty: { alignItems: "center", marginTop: 100 },
    emptyText: { fontSize: 16, fontWeight: "700", marginTop: 16 },
    emptyBtn: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    emptyBtnText: { color: "#fff", fontWeight: "800" },
});

