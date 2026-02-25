import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './context/ThemeContext';
import { getInventoryById, updateInventory, Inventory } from './services/inventory.service';
import { getContacts, Contact, contactFullName, contactPhone } from './services/contacts.service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const RELATIONSHIPS = [
    "Spouse", "Partner", "Child", "Parent", "Sibling",
    "Father", "Mother", "Brother", "Sister",
    "Friend", "Colleague", "Broker", "Agent", "Other"
];

export default function ManageOwnersScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { theme } = useTheme();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [inv, setInv] = useState<Inventory | null>(null);
    const [owners, setOwners] = useState<any[]>([]);
    const [associates, setAssociates] = useState<any[]>([]);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<Contact[]>([]);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [linkRole, setLinkRole] = useState<'Property Owner' | 'Associate'>('Property Owner');
    const [linkRelationship, setLinkRelationship] = useState('');

    useEffect(() => {
        if (id) fetchInventory();
    }, [id]);

    const fetchInventory = async () => {
        try {
            const body = await getInventoryById(id!);
            const data = body.data || body; // Handle both {success, data} and direct object
            setInv(data);
            setOwners(data.owners || []);
            setAssociates(data.associates || []);
        } catch (error) {
            console.error("Fetch error:", error);
            Alert.alert("Error", "Failed to load inventory details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.trim().length > 1) {
                performSearch();
            } else {
                setSearchResults([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const performSearch = async () => {
        setSearching(true);
        try {
            const res = await getContacts({ search: searchTerm });
            // Handle both {success, records} and other shapes
            const list = res.records || res.data || (Array.isArray(res) ? res : []);
            setSearchResults(list.slice(0, 5));
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setSearching(false);
        }
    };

    const handleAddPerson = () => {
        if (!selectedContact) return;

        const newEntry = {
            _id: selectedContact._id,
            name: contactFullName(selectedContact),
            mobile: contactPhone(selectedContact),
            phones: selectedContact.phones || [],
            emails: selectedContact.emails || []
        };

        if (linkRole === 'Property Owner') {
            if (owners.some(o => (o._id || o) === newEntry._id)) {
                return Alert.alert("Already Added", "This contact is already an owner.");
            }
            setOwners([...owners, { ...newEntry, role: 'Property Owner' }]);
        } else {
            if (associates.some(a => (a._id || a) === newEntry._id)) {
                return Alert.alert("Already Added", "This contact is already an associate.");
            }
            if (!linkRelationship) return Alert.alert("Input Required", "Please select a relationship for the associate.");
            setAssociates([...associates, { ...newEntry, relationship: linkRelationship }]);
        }

        // Reset search
        setSelectedContact(null);
        setSearchTerm('');
        setSearchResults([]);
        setLinkRelationship('');
    };

    const handleRemove = (type: 'owner' | 'associate', index: number) => {
        if (type === 'owner') {
            const updated = [...owners];
            updated.splice(index, 1);
            setOwners(updated);
        } else {
            const updated = [...associates];
            updated.splice(index, 1);
            setAssociates(updated);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const primaryOwner = owners.find(o => o.role === 'Property Owner') || owners[0];
            const primaryAssociate = associates[0];

            const updates = {
                owners,
                associates,
                ownerName: typeof primaryOwner === 'object' ? (primaryOwner.name || primaryOwner.fullName) : (primaryOwner || ''),
                ownerPhone: typeof primaryOwner === 'object' ? (primaryOwner.mobile || primaryOwner.phones?.[0]?.number) : '',
                associatedContact: primaryAssociate?.name || primaryAssociate?.fullName || '',
                associatedPhone: primaryAssociate?.mobile || primaryAssociate?.phones?.[0]?.number || ''
            };

            await updateInventory(id!, updates);
            Alert.alert("Success", "Owners and associates updated successfully", [
                { text: "OK", onPress: () => router.back() }
            ]);
        } catch (error) {
            console.error("Save error:", error);
            Alert.alert("Error", "Failed to save changes");
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
                <Text style={[styles.headerTitle, { color: theme.text }]}>Manage Owners</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={[styles.saveBtn, { color: theme.primary }]}>Save</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Search Section */}
                <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Add New Person</Text>

                    {!selectedContact ? (
                        <View style={styles.searchContainer}>
                            <View style={[styles.searchInputWrapper, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                <Ionicons name="search" size={20} color={theme.textLight} />
                                <TextInput
                                    style={[styles.searchInput, { color: theme.text }]}
                                    placeholder="Search by name or mobile..."
                                    placeholderTextColor={theme.textLight}
                                    value={searchTerm}
                                    onChangeText={setSearchTerm}
                                />
                                {searching && <ActivityIndicator size="small" color={theme.primary} />}
                            </View>

                            {searchResults.length > 0 && (
                                <View style={[styles.resultsContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                    {searchResults.map(contact => (
                                        <TouchableOpacity
                                            key={contact._id}
                                            style={[styles.resultItem, { borderBottomColor: theme.border }]}
                                            onPress={() => {
                                                setSelectedContact(contact);
                                                setSearchTerm('');
                                                setSearchResults([]);
                                            }}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.resultName, { color: theme.text }]}>{contactFullName(contact)}</Text>
                                                <Text style={[styles.resultPhone, { color: theme.textLight }]}>{contactPhone(contact)}</Text>
                                            </View>
                                            <Ionicons name="add-circle" size={24} color={theme.primary} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    ) : (
                        <View style={[styles.selectedCard, { backgroundColor: theme.background, borderColor: theme.primary + '30' }]}>
                            <View style={styles.selectedInfo}>
                                <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
                                    <Text style={[styles.avatarText, { color: theme.primary }]}>{contactFullName(selectedContact).charAt(0)}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.selectedName, { color: theme.text }]}>{contactFullName(selectedContact)}</Text>
                                    <Text style={[styles.selectedPhone, { color: theme.textLight }]}>{contactPhone(selectedContact)}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setSelectedContact(null)}>
                                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.roleRow}>
                                <TouchableOpacity
                                    style={[styles.roleBtn, linkRole === 'Property Owner' && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                    onPress={() => setLinkRole('Property Owner')}
                                >
                                    <Text style={[styles.roleBtnText, linkRole === 'Property Owner' && { color: '#fff' }]}>Property Owner</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.roleBtn, linkRole === 'Associate' && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                    onPress={() => setLinkRole('Associate')}
                                >
                                    <Text style={[styles.roleBtnText, linkRole === 'Associate' && { color: '#fff' }]}>Associate</Text>
                                </TouchableOpacity>
                            </View>

                            {linkRole === 'Associate' && (
                                <View style={styles.relationshipContainer}>
                                    <Text style={[styles.label, { color: theme.textLight }]}>Relationship</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relScroll}>
                                        {RELATIONSHIPS.map(rel => (
                                            <TouchableOpacity
                                                key={rel}
                                                style={[styles.relChip, linkRelationship === rel && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                                onPress={() => setLinkRelationship(rel)}
                                            >
                                                <Text style={[styles.relChipText, linkRelationship === rel && { color: '#fff' }]}>{rel}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.primary }]} onPress={handleAddPerson}>
                                <Text style={styles.confirmBtnText}>Confirm & Add</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Current Owners List */}
                <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Current Owners</Text>
                    {owners.length === 0 ? (
                        <Text style={styles.emptyText}>No owners assigned.</Text>
                    ) : (
                        owners.map((owner, idx) => (
                            <View key={idx} style={[styles.itemCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                <View style={styles.itemInfo}>
                                    <View style={[styles.avatar, { backgroundColor: theme.primary + '10' }]}>
                                        <Text style={[styles.avatarText, { color: theme.primary }]}>{(typeof owner === 'object' ? owner.name : 'U').charAt(0)}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.itemName, { color: theme.text }]}>{typeof owner === 'object' ? owner.name : 'Unknown'}</Text>
                                        <Text style={[styles.itemMeta, { color: theme.textLight }]}>{typeof owner === 'object' ? (owner.phones?.[0]?.number || owner.mobile || "No Phone") : ""}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleRemove('owner', idx)}>
                                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                {/* Current Associates List */}
                <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Associates</Text>
                    {associates.length === 0 ? (
                        <Text style={styles.emptyText}>No associates assigned.</Text>
                    ) : (
                        associates.map((assoc, idx) => (
                            <View key={idx} style={[styles.itemCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                <View style={styles.itemInfo}>
                                    <View style={[styles.avatar, { backgroundColor: '#F59E0B' + '10' }]}>
                                        <Text style={[styles.avatarText, { color: '#F59E0B' }]}>{assoc.name?.charAt(0) || 'U'}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={[styles.itemName, { color: theme.text }]}>{assoc.name || 'Unknown'}</Text>
                                            <View style={[styles.pill, { backgroundColor: '#F59E0B' + '15' }]}>
                                                <Text style={[styles.pillText, { color: '#F59E0B' }]}>{assoc.relationship || 'Associate'}</Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.itemMeta, { color: theme.textLight }]}>{assoc.phones?.[0]?.number || assoc.mobile || "No Phone"}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleRemove('associate', idx)}>
                                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
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
    scroll: { padding: 20 },
    section: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 16 },
    searchContainer: { position: 'relative' },
    searchInputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 50, borderRadius: 15, borderWidth: 1, gap: 10 },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '600' },
    resultsContainer: { position: 'absolute', top: 55, left: 0, right: 0, borderRadius: 15, borderWidth: 1, zIndex: 10, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, maxHeight: 250, overflow: 'hidden' },
    resultItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1 },
    resultName: { fontSize: 14, fontWeight: '700' },
    resultPhone: { fontSize: 12, marginTop: 2 },
    selectedCard: { padding: 15, borderRadius: 15, borderWidth: 1 },
    selectedInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 16, fontWeight: '800' },
    selectedName: { fontSize: 15, fontWeight: '800' },
    selectedPhone: { fontSize: 12 },
    roleRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
    roleBtn: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center' },
    roleBtnText: { fontSize: 13, fontWeight: '700', color: 'rgba(0,0,0,0.5)' },
    relationshipContainer: { marginBottom: 15 },
    label: { fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase' },
    relScroll: { flexDirection: 'row' },
    relChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', marginRight: 8 },
    relChipText: { fontSize: 12, fontWeight: '700', color: 'rgba(0,0,0,0.5)' },
    confirmBtn: { height: 45, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    itemCard: { padding: 12, borderRadius: 15, borderWidth: 1, marginBottom: 10 },
    itemInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    itemName: { fontSize: 14, fontWeight: '800' },
    itemMeta: { fontSize: 11, marginTop: 2 },
    emptyText: { textAlign: 'center', padding: 20, fontSize: 13, opacity: 0.5, fontWeight: '600' },
    pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    pillText: { fontSize: 9, fontWeight: '800' },
});
