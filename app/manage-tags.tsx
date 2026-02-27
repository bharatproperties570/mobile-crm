import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, SafeAreaView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './context/ThemeContext';
import { getInventoryById, updateInventory } from './services/inventory.service';

export default function ManageTagsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { theme } = useTheme();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');

    useEffect(() => {
        if (id) fetchInventory();
    }, [id]);

    const fetchInventory = async () => {
        try {
            const body = await getInventoryById(id!);
            const data = body.data || body;
            setTags(data.tags || []);
        } catch (error) {
            console.error("Fetch error:", error);
            Alert.alert("Error", "Failed to load tags");
        } finally {
            setLoading(false);
        }
    };

    const handleAddTag = () => {
        const trimmed = newTag.trim();
        if (!trimmed) return;
        if (tags.includes(trimmed)) {
            Alert.alert("Duplicate", "This tag already exists.");
            return;
        }
        setTags([...tags, trimmed]);
        setNewTag('');
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateInventory(id!, { tags });
            Alert.alert("Success", "Tags updated successfully", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } catch (error) {
            console.error("Save error:", error);
            Alert.alert("Error", "Failed to save tags");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Manage Tags</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.saveBtn, { color: theme.primary }]}>Save</Text>}
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: theme.card }]}>
                    <TextInput
                        style={[styles.input, { color: theme.text }]}
                        placeholder="Type a new tag..."
                        placeholderTextColor={theme.textLight}
                        value={newTag}
                        onChangeText={setNewTag}
                        onSubmitEditing={handleAddTag}
                    />
                    <TouchableOpacity onPress={handleAddTag} style={[styles.addBtn, { backgroundColor: theme.primary }]}>
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View style={styles.tagsContainer}>
                    <Text style={[styles.sectionLabel, { color: theme.textLight }]}>ACTIVE TAGS</Text>
                    <ScrollView contentContainerStyle={styles.tagsInner}>
                        {tags.length === 0 ? (
                            <Text style={[styles.emptyText, { color: theme.textLight }]}>No tags added yet.</Text>
                        ) : (
                            tags.map(tag => (
                                <View key={tag} style={[styles.tagChip, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                                    <Text style={[styles.tagText, { color: theme.primary }]}>{tag}</Text>
                                    <TouchableOpacity onPress={() => handleRemoveTag(tag)} style={styles.removeTag}>
                                        <Ionicons name="close-circle" size={18} color={theme.primary} />
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    saveBtn: { fontSize: 16, fontWeight: '800' },
    content: { padding: 20 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, paddingLeft: 15, overflow: 'hidden', marginBottom: 30 },
    input: { flex: 1, height: 50, fontSize: 15, fontWeight: '600' },
    addBtn: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
    tagsContainer: { flex: 1 },
    sectionLabel: { fontSize: 11, fontWeight: '800', marginBottom: 15, letterSpacing: 1 },
    tagsInner: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tagChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    tagText: { fontSize: 14, fontWeight: '700' },
    removeTag: { marginLeft: 8 },
    emptyText: { fontSize: 14, fontStyle: 'italic', marginTop: 10 },
});
