import React, { useState, useEffect, useMemo } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
    ActivityIndicator, Alert, SafeAreaView, Modal, FlatList, Image
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useLookup } from "@/context/LookupContext";
import * as ImagePicker from 'expo-image-picker';
import { getSizeLabel } from "@/utils/format.utils";
import api from "@/services/api";

export default function AddBuiltupDetailsScreen() {
    const router = useRouter();
    const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
    const { theme } = useTheme();
    const { propertyConfig, masterFields, getLookupValue } = useLookup();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [entityData, setEntityData] = useState<any>(null);

    // Form State
    const [subCategory, setSubCategory] = useState<any>(null);
    const [builtupType, setBuiltupType] = useState<any>(null);
    const [builtupDetails, setBuiltupDetails] = useState<any[]>([{ floor: 'Ground Floor', cluster: '', length: '', width: '', totalArea: '', imageUrl: '' }]);
    const [occupationDate, setOccupationDate] = useState("");
    const [ageOfConstruction, setAgeOfConstruction] = useState("");
    const [possessionStatus, setPossessionStatus] = useState("");
    const [furnishType, setFurnishType] = useState("");
    const [furnishedItems, setFurnishedItems] = useState<string[]>([]);
    const [currentFurnishedItem, setCurrentFurnishedItem] = useState("");
    const [heroImage, setHeroImage] = useState("");

    // Modal Control for Lookups
    const [modalConfig, setModalConfig] = useState<{ visible: boolean; type: string; data: any[] }>({
        visible: false,
        type: '',
        data: []
    });

    useEffect(() => {
        if (id && type) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [id, type]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const endpoint = type === 'Deal' ? `/deals/${id}` : `/inventory/${id}`;
            const res = await api.get(endpoint);
            const data = res.data?.records?.[0] || res.data?.data || res.data?.[0] || res.data;
            if (!data) throw new Error("Not found");
            
            setEntityData(data);

            const subCatVal = getLookupValue('SubCategory', data.subCategory) || data.subCategory || '';
            const bTypeVal = getLookupValue('BuiltupType', data.builtupType) || data.builtupType || '';
            
            if (subCatVal && subCatVal !== "—") setSubCategory({ name: subCatVal, _id: data.subCategory });
            if (bTypeVal && bTypeVal !== "—") setBuiltupType({ name: bTypeVal, _id: data.builtupType });

            const initialDetails = (data.builtupDetails && data.builtupDetails.length > 0)
                ? data.builtupDetails.map((row: any) => ({
                    floor: row.floor || 'Ground Floor',
                    cluster: row.cluster || '',
                    length: row.length || '',
                    width: row.width || '',
                    totalArea: row.totalArea || '',
                    imageUrl: row.imageUrl || ''
                }))
                : [{ floor: 'Ground Floor', cluster: '', length: '', width: '', totalArea: '', imageUrl: '' }];
            setBuiltupDetails(initialDetails);
            
            if (data.occupationDate) {
                setOccupationDate(new Date(data.occupationDate).toISOString().split('T')[0]);
            }
            
            setAgeOfConstruction(data.ageOfConstruction || data.constructionAge || '');
            setPossessionStatus(data.possessionStatus || '');
            setFurnishType(data.furnishType || '');
            setHeroImage(data.websiteMetadata?.featuredImage || '');
            
            const items = data.furnishedItems 
                ? data.furnishedItems.split(',').map((s: string) => s.trim()).filter(Boolean)
                : [];
            setFurnishedItems(items);

        } catch (error) {
            console.error("Fetch Error:", error);
            Alert.alert("Error", "Failed to load entity data.");
        } finally {
            setLoading(false);
        }
    };

    const categoryName = useMemo(() => {
        if (!entityData) return 'Residential';
        return getLookupValue('Category', entityData.category) || entityData.category || 'Residential';
    }, [entityData, getLookupValue]);

    const sizeType = useMemo(() => {
        if (!entityData) return '';
        const rawId = entityData.sizeType || entityData.sizeLabel || '';
        const resolvedProp = getLookupValue('PropertyType', rawId);
        if (resolvedProp && resolvedProp !== "—") return resolvedProp;
        const resolvedSize = getLookupValue('Size', rawId);
        if (resolvedSize && resolvedSize !== "—") return resolvedSize;
        return rawId;
    }, [entityData, getLookupValue]);

    const sizeLabelDisplay = useMemo(() => {
        if (!entityData) return '';
        return getSizeLabel(entityData, getLookupValue) || sizeType || '';
    }, [entityData, getLookupValue, sizeType]);

    const { availableSubCategories, availableBuiltupTypes } = useMemo(() => {
        if (!propertyConfig) return { availableSubCategories: [], availableBuiltupTypes: [] };
        const currentCategoryConfig = propertyConfig[categoryName] || {};
        const subCats = (currentCategoryConfig.subCategories || []).map((sc: any) => ({ name: sc.name, _id: sc._id || sc.id }));

        let builtTypes: any[] = [];
        if (subCategory && subCategory.name) {
            const subName = String(subCategory.name).trim().toLowerCase();
            const subCatConfig = (currentCategoryConfig.subCategories || []).find(
                (sc: any) => String(sc.name).trim().toLowerCase() === subName
            );
            if (subCatConfig) {
                const allBuiltUpTypes = new Set<string>();
                const sType = String(sizeType).trim().toLowerCase();
                const sLabelDisplay = String(sizeLabelDisplay).trim().toLowerCase();
                
                const typeConfig = (subCatConfig.types || []).find(
                    (t: any) => {
                        const tName = String(t.name).trim().toLowerCase();
                        return tName === sType || tName === sLabelDisplay;
                    }
                );
                
                if (typeConfig && Array.isArray(typeConfig.builtupTypes) && typeConfig.builtupTypes.length > 0) {
                    typeConfig.builtupTypes.forEach((bt: any) => {
                        if (typeof bt === 'object' && bt !== null) {
                            const name = bt.name || getLookupValue('BuiltupType', bt._id || bt.id);
                            allBuiltUpTypes.add(JSON.stringify({ _id: bt._id || bt.id, name }));
                        } else {
                            const name = getLookupValue('BuiltupType', bt) !== "—" ? getLookupValue('BuiltupType', bt) : bt;
                            allBuiltUpTypes.add(JSON.stringify({ name, _id: bt }));
                        }
                    });
                } else {
                    (subCatConfig.types || []).forEach((t: any) => {
                        if (Array.isArray(t.builtupTypes)) {
                            t.builtupTypes.forEach((bt: any) => {
                                if (typeof bt === 'object' && bt !== null) {
                                    const name = bt.name || getLookupValue('BuiltupType', bt._id || bt.id);
                                    allBuiltUpTypes.add(JSON.stringify({ _id: bt._id || bt.id, name }));
                                } else {
                                    const name = getLookupValue('BuiltupType', bt) !== "—" ? getLookupValue('BuiltupType', bt) : bt;
                                    allBuiltUpTypes.add(JSON.stringify({ name, _id: bt }));
                                }
                            });
                        }
                    });
                }
                builtTypes = Array.from(allBuiltUpTypes).map((s: string) => JSON.parse(s));
            }
        }

        return { availableSubCategories: subCats, availableBuiltupTypes: builtTypes };
    }, [propertyConfig, categoryName, subCategory, sizeType, getLookupValue]);

    const handleAddBuiltupRow = () => {
        setBuiltupDetails(prev => [...prev, { floor: 'Ground Floor', cluster: '', length: '', width: '', totalArea: '', imageUrl: '' }]);
    };

    const handleRemoveBuiltupRow = (index: number) => {
        if (builtupDetails.length === 1) {
            setBuiltupDetails([{ floor: 'Ground Floor', cluster: '', length: '', width: '', totalArea: '', imageUrl: '' }]);
        } else {
            setBuiltupDetails(prev => prev.filter((_, idx) => idx !== index));
        }
    };

    const updateBuiltupRow = (index: number, field: string, value: string) => {
        setBuiltupDetails(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            
            if (field === 'width' || field === 'length') {
                const w = parseFloat(field === 'width' ? value : updated[index].width) || 0;
                const l = parseFloat(field === 'length' ? value : updated[index].length) || 0;
                updated[index].totalArea = (w && l) ? (w * l).toFixed(2) : '';
            }
            return updated;
        });
    };

    const pickImage = async (index: number) => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
                return;
            }

            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                await uploadRowImage(index, result.assets[0]);
            }
        } catch (error) {
            console.error("ImagePicker Error:", error);
        }
    };

    const uploadRowImage = async (index: number, asset: any) => {
        setBuiltupDetails(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], uploading: true };
            return updated;
        });

        try {
            const formData = new FormData();
            formData.append("file", {
                uri: asset.uri,
                name: asset.fileName || `upload_${Date.now()}.jpg`,
                type: asset.mimeType || "image/jpeg"
            } as any);

            const res = await api.post('/upload', formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    'Accept': 'application/json' 
                },
                transformRequest: (data) => data
            });

            if (res.data && res.data.success) {
                const uploadedUrl = res.data.url;
                setBuiltupDetails(prev => {
                    const updated = [...prev];
                    updated[index] = { ...updated[index], imageUrl: uploadedUrl, uploading: false };
                    return updated;
                });
                if (!heroImage) setHeroImage(uploadedUrl);
            } else {
                throw new Error("Upload failed server side");
            }
        } catch (error) {
            console.error("Upload error:", error);
            Alert.alert("Upload Failed", "Could not upload image.");
            setBuiltupDetails(prev => {
                const updated = [...prev];
                updated[index] = { ...updated[index], uploading: false };
                return updated;
            });
        }
    };

    const handleAddFurnishedItem = () => {
        const trimmed = currentFurnishedItem.trim();
        if (trimmed && !furnishedItems.includes(trimmed)) {
            setFurnishedItems(prev => [...prev, trimmed]);
            setCurrentFurnishedItem('');
        }
    };

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);

        try {
            const payload: any = {
                subCategory: subCategory?._id || null,
                builtupType: builtupType?._id || null,
                occupationDate: occupationDate === '' ? null : occupationDate,
                ageOfConstruction: ageOfConstruction,
                possessionStatus: possessionStatus,
                furnishType: furnishType,
                furnishedItems: furnishType === 'Unfurnished' ? '' : furnishedItems.join(', '),
                builtupDetails: builtupDetails.map(row => ({
                    floor: row.floor,
                    cluster: row.cluster,
                    length: row.length === '' ? null : Number(row.length),
                    width: row.width === '' ? null : Number(row.width),
                    totalArea: row.totalArea === '' ? null : Number(row.totalArea),
                    imageUrl: row.imageUrl || ''
                }))
            };

            if (type === 'Deal') {
                payload.websiteMetadata = {
                    ...entityData.websiteMetadata,
                    featuredImage: heroImage
                };
            }

            const endpoint = type === 'Deal' ? `/deals/${id}` : `/inventory/${id}`;
            const response = await api.put(endpoint, payload);

            if (response.data && response.data.success) {
                Alert.alert("Success", "Built-up & Furnishing details updated successfully!", [
                    { text: "OK", onPress: () => handleGoBack() }
                ]);
            } else {
                throw new Error(response.data?.error || "Failed to update details");
            }
        } catch (error: any) {
            console.error("Save Error:", error);
            Alert.alert("Error", error.message || "Failed to save details.");
        } finally {
            setSaving(false);
        }
    };

    const openModal = (modalType: 'subCategory' | 'builtupType' | 'floor' | 'plan' | 'possessionStatus' | 'furnishType', data: any[]) => {
        setModalConfig({ visible: true, type: modalType, data });
    };

    const handleSelect = (item: any) => {
        switch (modalConfig.type) {
            case 'subCategory': setSubCategory(item); setBuiltupType(null); break;
            case 'builtupType': setBuiltupType(item); break;
            case 'possessionStatus': setPossessionStatus(item.name); break;
            case 'furnishType': setFurnishType(item.name); break;
            case 'floor':
                if (item.index !== undefined) {
                    updateBuiltupRow(item.index, 'floor', item.name);
                }
                break;
            case 'plan':
                if (item.index !== undefined) {
                    updateBuiltupRow(item.index, 'cluster', item.name);
                }
                break;
        }
        setModalConfig({ ...modalConfig, visible: false });
    };

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/inventory');
        }
    };

    if (loading) return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Add Builtup Details</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.saveBtn, { color: theme.primary }]}>Save</Text>}
                </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                {/* Context Box */}
                <View style={[styles.readOnlyBox, { backgroundColor: theme.border + '30', borderColor: theme.border }]}>
                    <Text style={{ fontSize: 12, color: theme.textLight, fontWeight: '700' }}>UPDATING {type.toUpperCase()} #{entityData?.dealId || entityData?.unitNo || id}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                        <View>
                            <Text style={{ fontSize: 10, color: theme.textLight }}>CATEGORY</Text>
                            <Text style={{ fontSize: 13, color: theme.text, fontWeight: '600' }}>{categoryName}</Text>
                        </View>
                        <View>
                            <Text style={{ fontSize: 10, color: theme.textLight }}>CONFIG</Text>
                            <Text style={{ fontSize: 13, color: theme.text, fontWeight: '600' }}>{sizeLabelDisplay || 'N/A'}</Text>
                        </View>
                    </View>
                </View>

                {/* Categories */}
                <View style={styles.row}>
                    <View style={styles.col}>
                        <Text style={[styles.label, { color: theme.textLight }]}>SUB CATEGORY</Text>
                        <TouchableOpacity style={[styles.input, { borderColor: theme.border }]} onPress={() => openModal('subCategory', availableSubCategories)}>
                            <Text style={{ color: subCategory ? theme.text : theme.textLight }}>{subCategory ? subCategory.name : "Select"}</Text>
                            <Ionicons name="chevron-down" size={16} color={theme.textLight} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.col}>
                        <Text style={[styles.label, { color: theme.textLight }]}>BUILT-UP TYPE</Text>
                        <TouchableOpacity 
                            style={[styles.input, { borderColor: theme.border, opacity: subCategory ? 1 : 0.5 }]} 
                            onPress={() => subCategory && openModal('builtupType', availableBuiltupTypes)}
                            disabled={!subCategory}
                        >
                            <Text style={{ color: builtupType ? theme.text : theme.textLight }}>{builtupType ? builtupType.name : "Select"}</Text>
                            <Ionicons name="chevron-down" size={16} color={theme.textLight} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.divider} />

                {/* Builtup Details Rows */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={[styles.label, { color: theme.text, marginBottom: 0 }]}>FLOOR-WISE BUILTUP DETAILS</Text>
                    <TouchableOpacity onPress={handleAddBuiltupRow} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary + '20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                        <Ionicons name="add" size={16} color={theme.primary} />
                        <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700', marginLeft: 4 }}>Add Row</Text>
                    </TouchableOpacity>
                </View>

                {builtupDetails.map((row, idx) => (
                    <View key={idx} style={[styles.rowCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                            <TouchableOpacity style={[styles.input, { flex: 1, marginRight: 8, borderColor: theme.border, height: 40 }]} onPress={() => openModal('floor', (masterFields?.floorLevels || ['Ground Floor', 'First Floor']).map((f: string) => ({ name: f, index: idx })))}>
                                <Text style={{ color: theme.text, fontSize: 12 }}>{row.floor || 'Select Floor'}</Text>
                                <Ionicons name="chevron-down" size={14} color={theme.textLight} />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.input, { flex: 1, marginRight: 8, borderColor: theme.border, height: 40 }]} onPress={() => openModal('plan', (masterFields?.floorPlans || ['Drawing Room', 'Bedroom']).map((p: string) => ({ name: p, index: idx })))}>
                                <Text style={{ color: theme.text, fontSize: 12 }}>{row.cluster || 'Select Plan'}</Text>
                                <Ionicons name="chevron-down" size={14} color={theme.textLight} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleRemoveBuiltupRow(idx)} disabled={builtupDetails.length === 1} style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: builtupDetails.length === 1 ? theme.border : '#fee2e2', borderRadius: 8 }}>
                                <Ionicons name="trash" size={18} color={builtupDetails.length === 1 ? theme.textLight : '#ef4444'} />
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                            <TextInput style={[styles.input, { flex: 1, marginRight: 8, borderColor: theme.border, color: theme.text, height: 40 }]} placeholder="Width" placeholderTextColor={theme.textLight} keyboardType="numeric" value={row.width?.toString() || ''} onChangeText={t => updateBuiltupRow(idx, 'width', t)} />
                            <TextInput style={[styles.input, { flex: 1, marginRight: 8, borderColor: theme.border, color: theme.text, height: 40 }]} placeholder="Length" placeholderTextColor={theme.textLight} keyboardType="numeric" value={row.length?.toString() || ''} onChangeText={t => updateBuiltupRow(idx, 'length', t)} />
                            <View style={{ flex: 1, backgroundColor: theme.border + '40', borderRadius: 8, justifyContent: 'center', alignItems: 'center', height: 40 }}>
                                <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>{row.totalArea ? `${row.totalArea} sqft` : '-'}</Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {row.imageUrl ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Image source={{ uri: row.imageUrl }} style={{ width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: theme.border }} />
                                    <TouchableOpacity onPress={() => updateBuiltupRow(idx, 'imageUrl', '')} style={{ marginLeft: 10, padding: 8, backgroundColor: '#fee2e2', borderRadius: 8 }}>
                                        <Ionicons name="close" size={16} color="#ef4444" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setHeroImage(row.imageUrl)} style={{ marginLeft: 10, padding: 8, backgroundColor: heroImage === row.imageUrl ? '#fef3c7' : theme.border, borderRadius: 8 }}>
                                        <Ionicons name={heroImage === row.imageUrl ? "star" : "star-outline"} size={16} color={heroImage === row.imageUrl ? "#d97706" : theme.textLight} />
                                    </TouchableOpacity>
                                </View>
                            ) : row.uploading ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color={theme.primary} />
                                    <Text style={{ marginLeft: 8, color: theme.primary, fontSize: 12 }}>Uploading...</Text>
                                </View>
                            ) : (
                                <TouchableOpacity onPress={() => pickImage(idx)} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: theme.textLight, padding: 8, borderRadius: 8 }}>
                                    <Ionicons name="cloud-upload-outline" size={16} color={theme.textLight} />
                                    <Text style={{ marginLeft: 6, color: theme.textLight, fontSize: 12 }}>Upload Image</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                ))}

                <View style={styles.divider} />

                {/* Status & Dates */}
                <View style={styles.row}>
                    <View style={styles.col}>
                        <Text style={[styles.label, { color: theme.textLight }]}>POSSESSION STATUS</Text>
                        <TouchableOpacity style={[styles.input, { borderColor: theme.border }]} onPress={() => openModal('possessionStatus', [{ name: 'Ready to Move' }, { name: 'Under Construction' }])}>
                            <Text style={{ color: possessionStatus ? theme.text : theme.textLight }}>{possessionStatus || "Select"}</Text>
                            <Ionicons name="chevron-down" size={16} color={theme.textLight} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.col}>
                        <Text style={[styles.label, { color: theme.textLight }]}>AGE OF CONSTRUCTION</Text>
                        <TextInput style={[styles.input, { borderColor: theme.border, color: theme.text }]} placeholder="e.g. 5 Years" placeholderTextColor={theme.textLight} value={ageOfConstruction} onChangeText={setAgeOfConstruction} />
                    </View>
                </View>

                {/* Furnishing */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: theme.textLight }]}>FURNISH STATUS</Text>
                    <TouchableOpacity style={[styles.input, { borderColor: theme.border }]} onPress={() => openModal('furnishType', [{ name: 'Fully Furnished' }, { name: 'Semi Furnished' }, { name: 'Unfurnished' }])}>
                        <Text style={{ color: furnishType ? theme.text : theme.textLight }}>{furnishType || "Select Status"}</Text>
                        <Ionicons name="chevron-down" size={16} color={theme.textLight} />
                    </TouchableOpacity>
                </View>

                {furnishType && furnishType !== 'Unfurnished' ? (
                    <View style={styles.section}>
                        <Text style={[styles.label, { color: theme.textLight }]}>FURNISHED ITEMS</Text>
                        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                            <TextInput 
                                style={[styles.input, { flex: 1, borderColor: theme.border, color: theme.text, marginRight: 10 }]} 
                                placeholder="Add item (e.g. AC, Bed)" 
                                placeholderTextColor={theme.textLight} 
                                value={currentFurnishedItem} 
                                onChangeText={setCurrentFurnishedItem} 
                                onSubmitEditing={handleAddFurnishedItem}
                            />
                            <TouchableOpacity onPress={handleAddFurnishedItem} style={{ backgroundColor: theme.primary, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 12 }}>
                                <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {furnishedItems.map((item, idx) => (
                                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.border + '40', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: theme.border }}>
                                    <Text style={{ color: theme.text, fontSize: 12, marginRight: 6 }}>{item}</Text>
                                    <TouchableOpacity onPress={() => setFurnishedItems(prev => prev.filter(i => i !== item))}>
                                        <Ionicons name="close-circle" size={16} color={theme.textLight} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}

                <View style={{ height: 40 }} />
            </ScrollView>

            <Modal visible={modalConfig.visible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Select Option</Text>
                            <TouchableOpacity onPress={() => setModalConfig({ ...modalConfig, visible: false })}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={modalConfig.data}
                            keyExtractor={(item, idx) => item._id || item.name || idx.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.lookupItem, { borderBottomColor: theme.border }]}
                                    onPress={() => handleSelect(item)}
                                >
                                    <Text style={[styles.lookupText, { color: theme.text }]}>{item.name}</Text>
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
    section: { marginBottom: 20 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    col: { flex: 1, marginHorizontal: 5 },
    label: { fontSize: 10, fontWeight: "800", marginBottom: 8, letterSpacing: 0.5 },
    readOnlyBox: { padding: 15, borderRadius: 12, borderWidth: 1, marginBottom: 24 },
    input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 20 },
    rowCard: { padding: 15, borderRadius: 12, borderWidth: 1, marginBottom: 15 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80%" },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: "800" },
    lookupItem: { paddingVertical: 15, borderBottomWidth: 1 },
    lookupText: { fontSize: 16, fontWeight: "600" },
});
