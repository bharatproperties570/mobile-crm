import React, { useState, useEffect, useCallback } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
    ActivityIndicator, Alert, SafeAreaView, Modal, FlatList, Platform, Switch
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "./context/ThemeContext";
import { getContactById, updateContact } from "./services/contacts.service";
import { getInventory, getInventoryById, updateInventory } from "./services/inventory.service";
import { getLookups } from "./services/lookups.service";
import { getProjects } from "./services/projects.service";
import api from "./services/api";

export default function AddDocumentScreen() {
    const router = useRouter();
    const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
    const { theme } = useTheme();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [entityName, setEntityName] = useState("");
    const [existingDocs, setExistingDocs] = useState<any[]>([]);
    const [entityData, setEntityData] = useState<any>(null);

    // Form State
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);

    const [types, setTypes] = useState<any[]>([]);
    const [selectedType, setSelectedType] = useState<any>(null);

    const [docNumber, setDocNumber] = useState("");
    const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);

    // Inventory Linking State (For Contacts)
    const [linkToInventory, setLinkToInventory] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [blocks, setBlocks] = useState<any[]>([]);
    const [selectedBlock, setSelectedBlock] = useState<any>(null);
    const [units, setUnits] = useState<any[]>([]);
    const [selectedUnit, setSelectedUnit] = useState<any>(null);

    // Contact Linking State (For Inventory)
    const [linkToOwner, setLinkToOwner] = useState(false);
    const [potentialContacts, setPotentialContacts] = useState<any[]>([]);
    const [selectedContact, setSelectedContact] = useState<any>(null);

    // Modal Control
    const [modalConfig, setModalConfig] = useState<{ visible: boolean; type: 'category' | 'type' | 'project' | 'block' | 'unit' | 'contact'; data: any[] }>({
        visible: false,
        type: 'category',
        data: []
    });

    useEffect(() => {
        if (id && type) init();
    }, [id, type]);

    const init = async () => {
        setLoading(true);
        try {
            const [catRes, projRes, entityRes] = await Promise.all([
                getLookups("DocumentCategory"),
                getProjects(),
                type === "Contact" ? getContactById(id!) : getInventoryById(id!)
            ]);

            setCategories(catRes?.data || (Array.isArray(catRes) ? catRes : []));
            setProjects(projRes?.data || (Array.isArray(projRes) ? projRes : []));

            const data = entityRes?.data ?? entityRes;
            setEntityData(data);
            if (type === "Contact") {
                setEntityName([data.name, data.surname].filter(Boolean).join(" ") || "Contact");
                setExistingDocs(data.documents || []);
            } else {
                setEntityName(`Unit ${data.unitNumber || data.unitNo} - ${data.projectName}`);
                setExistingDocs(data.inventoryDocuments || []);

                // Collect owners and associates for linking
                const contacts = [
                    ...(data.owners || []).map((o: any) => ({ ...o, role: 'Owner' })),
                    ...(data.associates || []).map((a: any) => ({ ...a, role: 'Associate' }))
                ];
                setPotentialContacts(contacts);
            }
        } catch (error) {
            console.error("Init error:", error);
            Alert.alert("Error", "Failed to load initial data");
        } finally {
            setLoading(false);
        }
    };

    // Cascading Lookups: Types depend on Category
    useEffect(() => {
        if (selectedCategory) {
            fetchTypes(selectedCategory._id);
        } else {
            setTypes([]);
            setSelectedType(null);
        }
    }, [selectedCategory]);

    const fetchTypes = async (categoryId: string) => {
        try {
            const res = await api.get("/lookups", { params: { lookup_type: "DocumentType", parent_lookup_id: categoryId } });
            setTypes(res.data?.data || (Array.isArray(res.data) ? res.data : []));
        } catch (error) {
            console.error("Fetch types error:", error);
        }
    };

    // Cascading Inventory: Blocks depend on Project, Units depend on Block
    useEffect(() => {
        if (selectedProject) {
            setBlocks(selectedProject.blocks || []);
            setSelectedBlock(null);
            setSelectedUnit(null);
        }
    }, [selectedProject]);

    useEffect(() => {
        if (selectedProject && (selectedBlock || selectedProject.blocks?.length === 0)) {
            fetchUnits();
        }
    }, [selectedProject, selectedBlock]);

    const fetchUnits = async () => {
        try {
            const params: any = { project: selectedProject._id };
            if (selectedBlock) params.block = selectedBlock.name || selectedBlock;
            const res = await getInventory(params);
            setUnits(res.data || (Array.isArray(res) ? res : []));
        } catch (error) {
            console.error("Fetch units error:", error);
        }
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ["application/pdf", "image/*"],
                copyToCacheDirectory: true
            });

            if (!result.canceled) {
                setSelectedFile(result);
            }
        } catch (err) {
            console.error("Picker error:", err);
        }
    };

    const uploadFile = async (fileResult: any) => {
        const formData = new FormData();
        const file = fileResult.assets[0];

        formData.append("file", {
            uri: Platform.OS === "android" ? file.uri : file.uri.replace("file://", ""),
            name: file.name,
            type: file.mimeType || "application/octet-stream"
        } as any);

        const res = await api.post("/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" }
        });
        return res.data;
    };

    const handleSave = async () => {
        if (!selectedCategory) return Alert.alert("Error", "Select Document Category");
        if (!selectedType) return Alert.alert("Error", "Select Document Type");
        if (!docNumber) return Alert.alert("Error", "Provide Document Number");

        setSaving(true);
        try {
            let fileUrl = "";
            if (selectedFile && !selectedFile.canceled) {
                const uploadRes = await uploadFile(selectedFile);
                if (uploadRes.success) fileUrl = uploadRes.url;
            }

            const newDoc = {
                documentCategory: selectedCategory._id,
                documentType: selectedType._id,
                documentName: selectedType._id, // Map to Type ID as per Web CRM logic
                documentNo: docNumber,
                documentPicture: fileUrl,
                file: fileUrl,
                // Metadata for cross-linking
                projectName: type === "Contact" ? (linkToInventory ? (selectedProject?.name || "") : "") : (entityData?.projectName || ""),
                block: type === "Contact" ? (linkToInventory ? (selectedBlock?.name || selectedBlock || "") : "") : (entityData?.block || ""),
                unitNumber: type === "Contact" ? (linkToInventory ? (selectedUnit?.unitNumber || "") : "") : (entityData?.unitNumber || entityData?.unitNo || ""),
                linkedContactId: type === "Inventory" && linkToOwner ? selectedContact?._id : (type === "Contact" ? id : null)
            };

            const updatedDocs = [...existingDocs, newDoc];

            if (type === "Contact") {
                await updateContact(id!, { documents: updatedDocs });
            } else {
                await updateInventory(id!, { inventoryDocuments: updatedDocs });

                // DUAL SAVE: If linked to an owner/associate, push to their documents as well
                if (linkToOwner && selectedContact?._id) {
                    try {
                        const contactRes = await getContactById(selectedContact._id);
                        const contactData = contactRes?.data ?? contactRes;
                        const contactDocs = [...(contactData.documents || []), newDoc];
                        await updateContact(selectedContact._id, { documents: contactDocs });
                    } catch (err) {
                        console.error("Failed to dual-save document to contact:", err);
                        // We don't block the main save if this fails, but maybe alert?
                    }
                }
            }

            Alert.alert("Success", "Document added and uploaded successfully", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } catch (error: any) {
            console.error("Save error:", error);
            Alert.alert("Error", error.response?.data?.error || "Failed to add document");
        } finally {
            setSaving(false);
        }
    };

    const openModal = (modalType: typeof modalConfig.type) => {
        let data: any[] = [];
        switch (modalType) {
            case 'category': data = categories; break;
            case 'type': data = types; break;
            case 'project': data = projects; break;
            case 'block': data = blocks; break;
            case 'unit': data = units; break;
            case 'contact': data = potentialContacts; break;
        }
        setModalConfig({ visible: true, type: modalType, data });
    };

    const handleSelect = (item: any) => {
        switch (modalConfig.type) {
            case 'category': setSelectedCategory(item); setSelectedType(null); break;
            case 'type': setSelectedType(item); break;
            case 'project': setSelectedProject(item); setSelectedBlock(null); setSelectedUnit(null); break;
            case 'block': setSelectedBlock(item); setSelectedUnit(null); break;
            case 'unit': setSelectedUnit(item); break;
            case 'contact': setSelectedContact(item); break;
        }
        setModalConfig({ ...modalConfig, visible: false });
    };

    if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Add Document</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.saveBtn, { color: theme.primary }]}>Save</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.textLight }]}>RELATED TO</Text>
                    <View style={[styles.readOnlyBox, { backgroundColor: theme.border + '20' }]}>
                        <Text style={[styles.readOnlyText, { color: theme.text }]}>{entityName} ({type})</Text>
                    </View>
                </View>

                {/* 1. Category */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.textLight }]}>DOCUMENT CATEGORY *</Text>
                    <TouchableOpacity style={[styles.input, { borderColor: theme.border }]} onPress={() => openModal('category')}>
                        <Text style={{ color: selectedCategory ? theme.text : theme.textLight }}>{selectedCategory ? selectedCategory.lookup_value : "Select Category"}</Text>
                        <Ionicons name="chevron-down" size={20} color={theme.textLight} />
                    </TouchableOpacity>
                </View>

                {/* 2. Type */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.textLight }]}>DOCUMENT TYPE *</Text>
                    <TouchableOpacity
                        style={[styles.input, { borderColor: theme.border, opacity: selectedCategory ? 1 : 0.5 }]}
                        onPress={() => selectedCategory && openModal('type')}
                        disabled={!selectedCategory}
                    >
                        <Text style={{ color: selectedType ? theme.text : theme.textLight }}>{selectedType ? selectedType.lookup_value : "Select Type"}</Text>
                        <Ionicons name="chevron-down" size={20} color={theme.textLight} />
                    </TouchableOpacity>
                </View>

                {/* 3. Number */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.textLight }]}>DOCUMENT NUMBER *</Text>
                    <TextInput
                        style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                        value={docNumber}
                        onChangeText={setDocNumber}
                        placeholder="Enter Number"
                        placeholderTextColor={theme.textLight}
                    />
                </View>

                {/* 4. Link Toggles */}
                {type === "Contact" ? (
                    <View style={[styles.toggleRow, { borderColor: theme.border }]}>
                        <Text style={[styles.toggleLabel, { color: theme.text }]}>Link to Inventory?</Text>
                        <Switch
                            value={linkToInventory}
                            onValueChange={setLinkToInventory}
                            trackColor={{ false: "#CBD5E1", true: theme.primary }}
                        />
                    </View>
                ) : (
                    <View style={[styles.toggleRow, { borderColor: theme.border }]}>
                        <Text style={[styles.toggleLabel, { color: theme.text }]}>Link to Owner?</Text>
                        <Switch
                            value={linkToOwner}
                            onValueChange={setLinkToOwner}
                            trackColor={{ false: "#CBD5E1", true: theme.primary }}
                        />
                    </View>
                )}

                {/* 5. Conditional Links */}
                {type === "Contact" && linkToInventory && (
                    <View style={[styles.inventoryBox, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '30' }]}>
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: theme.primary }]}>PROJECT</Text>
                            <TouchableOpacity style={[styles.input, { backgroundColor: '#fff', borderColor: theme.border }]} onPress={() => openModal('project')}>
                                <Text style={{ color: selectedProject ? theme.text : theme.textLight }}>{selectedProject ? selectedProject.name : "Select Project"}</Text>
                                <Ionicons name="chevron-down" size={18} color={theme.primary} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: theme.primary }]}>BLOCK</Text>
                            <TouchableOpacity
                                style={[styles.input, { backgroundColor: '#fff', borderColor: theme.border, opacity: selectedProject ? 1 : 0.5 }]}
                                onPress={() => selectedProject && openModal('block')}
                                disabled={!selectedProject}
                            >
                                <Text style={{ color: selectedBlock ? theme.text : theme.textLight }}>{selectedBlock ? (selectedBlock.name || selectedBlock) : "Select Block"}</Text>
                                <Ionicons name="chevron-down" size={18} color={theme.primary} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: theme.primary }]}>UNIT NUMBER</Text>
                            <TouchableOpacity
                                style={[styles.input, { backgroundColor: '#fff', borderColor: theme.border, opacity: (selectedBlock || (selectedProject && projects.length === 0)) ? 1 : 0.5 }]}
                                onPress={() => (selectedBlock || selectedProject) && openModal('unit')}
                                disabled={!selectedProject}
                            >
                                <Text style={{ color: selectedUnit ? theme.text : theme.textLight }}>{selectedUnit ? selectedUnit.unitNumber : "Select Unit"}</Text>
                                <Ionicons name="chevron-down" size={18} color={theme.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {type === "Inventory" && linkToOwner && (
                    <View style={[styles.inventoryBox, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '30' }]}>
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: theme.primary }]}>SELECT OWNER / ASSOCIATE</Text>
                            <TouchableOpacity style={[styles.input, { backgroundColor: '#fff', borderColor: theme.border }]} onPress={() => openModal('contact')}>
                                <Text style={{ color: selectedContact ? theme.text : theme.textLight }}>
                                    {selectedContact ? `${selectedContact.name} (${selectedContact.role})` : "Select Contact"}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color={theme.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* 6. File Upload */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.textLight }]}>UPLOAD FILE (PDF/IMAGE)</Text>
                    <TouchableOpacity style={[styles.uploadBtn, { borderColor: theme.primary, borderStyle: 'dashed' }]} onPress={pickDocument}>
                        <Ionicons name="cloud-upload-outline" size={24} color={theme.primary} />
                        <Text style={[styles.uploadText, { color: theme.primary }]}>
                            {selectedFile && !selectedFile.canceled ? selectedFile.assets[0].name : "Choose File..."}
                        </Text>
                    </TouchableOpacity>
                </View>

                {saving && <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 20 }} />}
            </ScrollView>

            <Modal visible={modalConfig.visible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Select {modalConfig.type.toUpperCase()}</Text>
                            <TouchableOpacity onPress={() => setModalConfig({ ...modalConfig, visible: false })}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={modalConfig.data}
                            keyExtractor={(item, idx) => item._id || idx.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.lookupItem, { borderBottomColor: theme.border }]}
                                    onPress={() => handleSelect(item)}
                                >
                                    <Text style={[styles.lookupText, { color: theme.text }]}>
                                        {item.lookup_value || item.name || item.unitNumber || (item.role ? `${item.name} (${item.role})` : item)}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 20, color: theme.textLight }}>No options available</Text>}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1 },
    headerTitle: { fontSize: 18, fontWeight: "800" },
    backBtn: { width: 40 },
    saveBtn: { fontSize: 16, fontWeight: "700" },
    content: { padding: 20 },
    section: { marginBottom: 18 },
    label: { fontSize: 10, fontWeight: "800", marginBottom: 8, letterSpacing: 0.5 },
    readOnlyBox: { padding: 15, borderRadius: 12 },
    readOnlyText: { fontSize: 14, fontWeight: "600" },
    input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 18, backgroundColor: "#fff" },
    toggleLabel: { fontSize: 14, fontWeight: "700" },
    inventoryBox: { padding: 15, borderRadius: 12, borderWidth: 1, marginBottom: 18 },
    uploadBtn: { height: 80, borderWidth: 2, borderRadius: 12, justifyContent: "center", alignItems: "center", gap: 8 },
    uploadText: { fontSize: 14, fontWeight: "600" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80%" },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: "800" },
    lookupItem: { paddingVertical: 15, borderBottomWidth: 1 },
    lookupText: { fontSize: 16, fontWeight: "600" },
});
