import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, SafeAreaView, Platform, Dimensions, Image
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "./context/ThemeContext";
import { getInventoryById, updateInventory } from "./services/inventory.service";
import api from "./services/api";

const { width } = Dimensions.get("window");
const GRID_SIZE = (width - 60) / 3;

export default function UploadMediaScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { theme } = useTheme();

    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [media, setMedia] = useState<any[]>([]);

    useEffect(() => {
        if (id) fetchInventory();
    }, [id]);

    const fetchInventory = async () => {
        try {
            const body = await getInventoryById(id!);
            const data = body.data || body;
            setMedia(data.media || data.images || []);
        } catch (error) {
            console.error("Fetch error:", error);
            Alert.alert("Error", "Failed to load media");
        } finally {
            setLoading(false);
        }
    };

    const pickMedia = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ["image/*", "video/*"],
                multiple: true,
                copyToCacheDirectory: true
            });

            if (!result.canceled) {
                handleUploads(result.assets);
            }
        } catch (err) {
            console.error("Picker error:", err);
            Alert.alert("Error", "Failed to pick media");
        }
    };

    const handleUploads = async (assets: any[]) => {
        setUploading(true);
        try {
            const uploadedUrls = [];
            for (const asset of assets) {
                const formData = new FormData();
                formData.append("file", {
                    uri: asset.uri,
                    name: asset.name || `upload_${Date.now()}`,
                    type: asset.mimeType || "image/jpeg"
                } as any);

                const res = await api.post("/upload", formData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });

                if (res.data.success) {
                    uploadedUrls.push({
                        url: res.data.url,
                        type: asset.mimeType?.startsWith('video') ? 'video' : 'image',
                        thumbnail: res.data.thumbnail || res.data.url
                    });
                }
            }

            const updatedMedia = [...media, ...uploadedUrls];
            setMedia(updatedMedia);
            await updateInventory(id!, { media: updatedMedia });
            Alert.alert("Success", "Media uploaded successfully");
        } catch (error) {
            console.error("Upload error:", error);
            Alert.alert("Error", "Failed to upload one or more files");
        } finally {
            setUploading(false);
        }
    };

    const removeMedia = async (index: number) => {
        const updatedMedia = [...media];
        updatedMedia.splice(index, 1);
        setMedia(updatedMedia);
        try {
            await updateInventory(id!, { media: updatedMedia });
        } catch (error) {
            console.error("Remove error:", error);
        }
    };

    if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Upload Media</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.grid}>
                    <TouchableOpacity style={[styles.uploadCard, { borderColor: theme.primary, borderStyle: 'dashed' }]} onPress={pickMedia} disabled={uploading}>
                        {uploading ? (
                            <ActivityIndicator color={theme.primary} />
                        ) : (
                            <>
                                <Ionicons name="camera-outline" size={32} color={theme.primary} />
                                <Text style={[styles.uploadLabel, { color: theme.primary }]}>Add Media</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {media.map((item, index) => (
                        <View key={index} style={styles.mediaCard}>
                            <Image source={{ uri: item.url || item }} style={styles.image} />
                            <TouchableOpacity style={styles.deleteBtn} onPress={() => removeMedia(index)}>
                                <Ionicons name="trash" size={16} color="#fff" />
                            </TouchableOpacity>
                            {item.type === 'video' && (
                                <View style={styles.videoBadge}>
                                    <Ionicons name="play" size={12} color="#fff" />
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
    headerTitle: { fontSize: 18, fontWeight: "800" },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 20 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    uploadCard: { width: GRID_SIZE, height: GRID_SIZE, borderRadius: 15, borderWidth: 2, justifyContent: 'center', alignItems: 'center', gap: 4 },
    uploadLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    mediaCard: { width: GRID_SIZE, height: GRID_SIZE, borderRadius: 15, overflow: 'hidden', backgroundColor: '#eee' },
    image: { width: '100%', height: '100%' },
    deleteBtn: { position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
    videoBadge: { position: 'absolute', bottom: 5, left: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
});
