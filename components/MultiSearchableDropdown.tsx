import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    Modal, FlatList, Animated
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";

interface MultiSearchableDropdownProps {
    visible: boolean;
    onClose: () => void;
    options: { label: string, value: string }[];
    selectedValues: string[];
    onToggle: (v: string) => void;
    placeholder: string;
}

export function MultiSearchableDropdown({
    visible, onClose, options, selectedValues, onToggle, placeholder
}: MultiSearchableDropdownProps) {
    const { theme } = useTheme();
    const [search, setSearch] = useState("");
    
    const filtered = (options || []).filter(o =>
        o?.label?.toString().toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{placeholder}</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={[styles.modalSearchInput, { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.border, borderWidth: 1 }]}
                        placeholder="Search..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor={theme.textMuted}
                    />
                    <FlatList
                        data={filtered}
                        keyExtractor={(item, idx) => `${item.value}-${idx}`}
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={[styles.modalListItem, { borderBottomColor: theme.border + '50', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                                onPress={() => onToggle(item.value)}
                            >
                                <Text style={[styles.modalListItemText, { color: theme.textPrimary, fontWeight: selectedValues.includes(item.value) ? '700' : '400' }]}>{item.label}</Text>
                                <Ionicons 
                                    name={selectedValues.includes(item.value) ? "checkbox" : "square-outline"} 
                                    size={22} 
                                    color={selectedValues.includes(item.value) ? theme.primary : theme.textMuted} 
                                />
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', marginTop: 60 }}>
                                <Ionicons name="search-outline" size={48} color={theme.border} />
                                <Text style={[styles.modalEmptyText, { color: theme.textSecondary }]}>No matching results found</Text>
                            </View>
                        }
                        keyboardShouldPersistTaps="handled"
                    />
                    <TouchableOpacity 
                        style={{ backgroundColor: theme.primary, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 10, marginHorizontal: 16, marginBottom: 16 }} 
                        onPress={onClose}
                    >
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        height: '80%',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
    },
    modalSearchInput: {
        height: 50,
        borderRadius: 14,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    modalListItem: {
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    modalListItemText: {
        fontSize: 16,
    },
    modalEmptyText: {
        marginTop: 12,
        fontSize: 14,
    }
});
