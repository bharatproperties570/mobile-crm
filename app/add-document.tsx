import React, { useState, useEffect, useCallback } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
    ActivityIndicator, Alert, SafeAreaView, Modal, FlatList, Platform, Switch
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "@/context/ThemeContext";
import { getContactById, updateContact } from "@/services/contacts.service";
import { getInventory, getInventoryById, updateInventory } from "@/services/inventory.service";
import { getHierarchicalDocs } from "@/services/lookups.service";
import { getProjects, getProjectById, updateProject } from "@/services/projects.service";
import { getLeadById, updateLead } from "@/services/leads.service";
import { getDealById } from "@/services/deals.service";
import api from "@/services/api";

export default function AddDocumentScreen() {
    const router = useRouter();
    const { id, type, mode } = useLocalSearchParams<{ id: string; type: string; mode?: string }>();
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
        if (id && type) {
            init();
        } else {
            setLoading(false);
        }
    }, [id, type]);

    const init = async () => {
        setLoading(true);
        try {
            const [catRes, projRes, entityRes] = await Promise.all([
                getHierarchicalDocs(),
                getProjects(),
                type === "Contact" ? getContactById(id!) : 
                type === "Lead" ? getLeadById(id!) :
                type === "Deal" ? getDealById(id!) :
                type === "Project" ? getProjectById(id!) :
                getInventoryById(id!)
            ]);

            setCategories(catRes?.data || []);
            setProjects(projRes?.data || (Array.isArray(projRes) ? projRes : []));

            const data = entityRes?.records?.[0] || entityRes?.data || entityRes?.[0] || entityRes;
            setEntityData(data);
            
            if (type === "Contact") {
                setEntityName([data.firstName, data.lastName, data.name, data.surname].filter(Boolean).join(" ") || "Contact");
                setExistingDocs(data.documents || []);
            } else if (type === "Lead") {
                setEntityName(data.firstName ? `${data.firstName} ${data.lastName || ''}` : "Lead");
                setExistingDocs(data.documents || []);
            } else if (type === "Deal") {
                setEntityName(data.dealId || [data.projectName, data.unitNo].filter(Boolean).join(" - ") || "Deal");
                setExistingDocs(data.documents || []);
            } else if (type === "Project") {
                setEntityName(data.name || "Project");
                setExistingDocs(data.projectDocuments || []);
            } else {
                setEntityName(`Unit ${data.unitNumber || data.unitNo} - ${data.projectName}`);
                setExistingDocs(data.inventoryDocuments || []);

                // Collect owners and associates for linking
                let contacts = [
                    ...(data.owners || []).map((o: any) => ({ ...o, role: 'Owner', id: o._id })),
                    ...(data.associates || []).map((a: any) => ({ ...a, role: (a.relationship || 'Associate'), id: (a.contact?._id || a.contact) }))
                ];

                if (contacts.length === 0) {
                    if (data.ownerName) contacts.push({ name: data.ownerName, mobile: data.ownerPhone, role: 'Property Owner', id: null });
                    if (data.associatedContact) contacts.push({ name: data.associatedContact, mobile: data.associatedPhone, role: 'Associate', id: null });
                }
                setPotentialContacts(contacts);
            }

            const cats = (catRes?.data || []);
            if (mode === "upload" && cats.length > 0) {
                const mediaCat = cats.find((c: any) => c.lookup_value === "Media");
                if (mediaCat) {
                    setSelectedCategory(mediaCat);
                    const imageType = ((mediaCat as any).subCategories || []).find((s: any) => s.lookup_value === "Images" || s.lookup_value === "Image");
                    if (imageType) setSelectedType(imageType);
                }
            }
        } catch (error) {
            console.error("Init error:", error);
            Alert.alert("Error", "Failed to load initial data. Check your network.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedCategory) {
            setTypes(selectedCategory.subCategories || []);
        } else {
            setTypes([]);
            setSelectedType(null);
        }
    }, [selectedCategory]);

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
            if (!result.canceled) setSelectedFile(result);
        } catch (err) {
            console.error("Picker error:", err);
        }
    };

    const uploadFile = async (fileResult: any, options: any = {}) => {
        const formData = new FormData();
        const asset = fileResult.assets?.[0];

        if (!asset) {
            console.error("[AddDocument] No asset found in file picker result", fileResult);
            throw new Error("No file selected or file access denied");
        }

        console.log(`[AddDocument] Preparing upload for: ${asset.name} (${asset.mimeType})`);

        if (Platform.OS === 'web') {
            const nativeFile = (asset as any).file;
            if (nativeFile) {
                formData.append('file', nativeFile);
            } else {
                try {
                    const response = await fetch(asset.uri);
                    const blob = await response.blob();
                    formData.append('file', blob, asset.name || `upload_${Date.now()}`);
                } catch (err) {
                    console.error("[AddDocument] Web Blob Fetch failed:", err);
                    formData.append('file', {
                        uri: asset.uri,
                        name: asset.name,
                        type: asset.mimeType || 'application/octet-stream'
                    } as any);
                }
            }
        } else {
            // On Native (iOS/Android)
            const fileToUpload = {
                uri: asset.uri,
                name: asset.name || `upload_${Date.now()}`,
                type: asset.mimeType || "application/octet-stream"
            };
            formData.append("file", fileToUpload as any);
        }

        if (options.entityType) formData.append("entityType", String(options.entityType));
        if (options.entityName) formData.append("entityName", String(options.entityName));
        if (options.docCategory) formData.append("docCategory", String(options.docCategory));
        if (options.docType) formData.append("docType", String(options.docType));

        console.log(`[AddDocument] Dispatching FormData upload...`);
        
        // IMPORTANT: In React Native, do NOT manually set the Content-Type header for FormData
        // because it needs to automatically include the boundary string.
        const res = await api.post("/upload", formData, {
            headers: {
                'Accept': 'application/json',
                // 'Content-Type': 'multipart/form-data', // REMOVED: Let boundary be set automatically
            },
            transformRequest: (data) => data, 
        });
        return res.data;
    };

    const handleSave = async () => {
        if (saving) return;
        if (!id) return Alert.alert("Error", "Entity ID is missing. Please go back and try again.");
        if (!selectedCategory) return Alert.alert("Error", "Select Document Category");
        if (!selectedType) return Alert.alert("Error", "Select Document Type");
        if (!docNumber) return Alert.alert("Error", "Provide Document Number");
        if (!selectedFile || selectedFile.canceled) return Alert.alert("Error", "Select a file");

        console.log(`[AddDocument] Starting save for ${type} ID: ${id}`);
        setSaving(true);
        try {
            let fileUrl = "";
            const uploadRes = await uploadFile(selectedFile, {
                entityType: type,
                entityName: entityName,
                docCategory: selectedCategory.lookup_value,
                docType: selectedType.lookup_value
            });
            
            console.log("[AddDocument] Upload Response:", uploadRes?.success);
            if (uploadRes.success) {
                fileUrl = uploadRes.url;
            } else {
                throw new Error(uploadRes.error || "Upload failed");
            }

            const newDoc = {
                documentCategory: selectedCategory._id,
                documentName: selectedCategory._id,
                documentType: selectedType._id,
                documentNo: docNumber,
                documentNumber: docNumber,
                documentPicture: fileUrl,
                url: fileUrl,
                file: fileUrl,
                name: selectedCategory.lookup_value,
                type: selectedType.lookup_value,
                projectName: type === "Contact" ? (linkToInventory ? (selectedProject?.name || "") : "") : (entityData?.projectName || ""),
                block: type === "Contact" ? (linkToInventory ? (selectedBlock?.name || selectedBlock || "") : "") : (entityData?.block || ""),
                unitNumber: type === "Contact" ? (linkToInventory ? (selectedUnit?.unitNumber || "") : "") : (entityData?.unitNumber || entityData?.unitNo || ""),
                linkedContactId: type === "Inventory" ? selectedContact?.id || selectedContact?._id : (type === "Contact" ? id : null),
                linkedContactMobile: selectedContact?.mobile || ""
            };

            const updatedDocs = [...existingDocs, newDoc];
            console.log("[AddDocument] Updating entity with new document count:", updatedDocs.length);

            const isMedia = selectedCategory.lookup_value === "Media" || mode === "upload";
            const isImage = isMedia && (selectedType.lookup_value === "Images" || selectedType.lookup_value === "Image");
            const isVideo = isMedia && (selectedType.lookup_value === "Videos" || selectedType.lookup_value === "Video");

            if (type === "Inventory" && (isImage || isVideo)) {
                const mediaItem = isImage ? {
                    title: docNumber || selectedFile.assets[0].name || "Image",
                    category: "Main",
                    url: fileUrl
                } : {
                    title: docNumber || selectedFile.assets[0].name || "Video",
                    type: "Upload",
                    url: fileUrl
                };

                const currentImages = entityData.inventoryImages || [];
                const currentVideos = entityData.inventoryVideos || [];

                if (isImage) {
                    await updateInventory(id, { inventoryImages: [...currentImages, mediaItem] });
                } else {
                    await updateInventory(id, { inventoryVideos: [...currentVideos, mediaItem] });
                }
            } else if (type === "Contact") {
                await updateContact(id, { documents: updatedDocs });
            } else if (type === "Lead") {
                await updateLead(id, { documents: updatedDocs });
            } else if (type === "Deal") {
                await api.put(`/deals/${id}`, { documents: updatedDocs });
            } else if (type === "Project") {
                await updateProject(id, { projectDocuments: updatedDocs });
            } else {
                await updateInventory(id, { inventoryDocuments: updatedDocs });
            }

            console.log("[AddDocument] Save successful");
            Alert.alert("Success", "Document saved successfully", [
                { text: "OK", onPress: () => {
                    if (router.canGoBack()) router.back();
                    else router.replace("/(tabs)");
                }}
            ]);
        } catch (error: any) {
            console.error("[AddDocument] Save error:", error);
            const errorMsg = error.response?.data?.error || error.message || "Failed to add document";
            Alert.alert("Error", errorMsg);
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
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} style={styles.backBtn}>
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
                    <Text style={[styles.label, { color: theme.textLight }]}>SPECIFIC TYPE *</Text>
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
                    <Text style={[styles.label, { color: theme.textLight }]}>DOCUMENT / REF NUMBER *</Text>
                    <TextInput
                        style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                        value={docNumber}
                        onChangeText={setDocNumber}
                        placeholder="Enter Number"
                        placeholderTextColor={theme.textLight}
                    />
                </View>

                {/* 4. Link Toggles */}
                {type === "Contact" && (
                    <View style={[styles.toggleRow, { borderColor: theme.border }]}>
                        <Text style={[styles.toggleLabel, { color: theme.text }]}>Link to Inventory?</Text>
                        <Switch
                            value={linkToInventory}
                            onValueChange={setLinkToInventory}
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

                {type === "Inventory" && (
                    <View style={[styles.inventoryBox, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '30' }]}>
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: theme.primary }]}>LINKED TO CONTACT (OPTIONAL)</Text>
                            <TouchableOpacity style={[styles.input, { backgroundColor: '#fff', borderColor: theme.border }]} onPress={() => openModal('contact')}>
                                <Text style={{ color: selectedContact ? theme.text : theme.textLight }}>
                                    {selectedContact ? `${selectedContact.name} (${selectedContact.role})` : "Select Related Contact"}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color={theme.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* 6. File Upload */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.textLight }]}>DOCUMENT FILE *</Text>
                    <TouchableOpacity style={[styles.uploadBtn, { borderColor: theme.primary, borderStyle: 'dashed' }]} onPress={pickDocument}>
                        <Ionicons name="cloud-upload-outline" size={24} color={theme.primary} />
                        <Text style={[styles.uploadText, { color: theme.primary }]}>
                            {selectedFile && !selectedFile.canceled ? selectedFile.assets[0].name : "Choose File..."}
                        </Text>
                    </TouchableOpacity>
                </View>

                {saving && <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 20 }} />}
            </ScrollView>

            {saving && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }]}>
                    <View style={{ backgroundColor: theme.card, padding: 30, borderRadius: 20, alignItems: 'center', gap: 15 }}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={{ color: theme.text, fontWeight: '700' }}>Saving Document...</Text>
                        <Text style={{ color: theme.textLight, fontSize: 12 }}>Please do not close the app</Text>
                    </View>
                </View>
            )}

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
