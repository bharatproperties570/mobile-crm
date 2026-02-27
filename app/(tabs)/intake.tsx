import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Modal, Alert, KeyboardAvoidingView, Platform,
    ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../context/ThemeContext';
import { splitIntakeMessage, parseDealContent, ParsedDeal, ParserConfig } from '../../utils/dealParser';
import { parseWhatsAppZip } from '../../utils/importParsers';
import { parsingService, ParsingRule } from '../services/parsing.service';
import IntakeItemCard from '../components/IntakeItemCard';

export default function IntakeScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const [pastedText, setPastedText] = useState('');
    const [parsedItems, setParsedItems] = useState<ParsedDeal[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [parserConfig, setParserConfig] = useState<ParserConfig | undefined>(undefined);

    // Fetch dynamic rules on mount
    useEffect(() => {
        loadRules();
    }, []);

    const loadRules = async () => {
        try {
            const response = await parsingService.getRules();
            if (response.success) {
                const rules: ParsingRule[] = response.data;
                const config: ParserConfig = {
                    cities: rules.filter(r => r.type === 'CITY').map(r => r.value),
                    locations: rules.filter(r => r.type === 'LOCATION').map(r => r.value),
                    types: {}
                };

                // Group types
                const typeRules = rules.filter(r => r.type === 'TYPE');
                const typesMap: Record<string, string[]> = {};
                typeRules.forEach(r => {
                    const cat = r.category || 'Residential';
                    if (!typesMap[cat]) typesMap[cat] = [];
                    typesMap[cat].push(r.value);
                });
                config.types = typesMap;

                setParserConfig(config);
            }
        } catch (error) {
            console.error("Failed to load parsing rules:", error);
        }
    };

    const handleParse = useCallback(async () => {
        if (!pastedText.trim()) {
            Alert.alert("Empty Content", "Please paste some deal or requirement text first.");
            return;
        }

        setIsProcessing(true);
        try {
            // Save to backend for persistence and sync
            const res = await parsingService.createIntake(pastedText);

            if (res.success) {
                const segments = splitIntakeMessage(pastedText);
                const parsed = segments.map(seg => parseDealContent(seg, parserConfig));

                setParsedItems(prev => [...parsed, ...prev]);
                setPastedText('');
                setIsModalOpen(false);
                Alert.alert("Success", "Deals extracted and synced to backend.");
            } else {
                throw new Error(res.message || "Failed to sync with server");
            }
        } catch (error: any) {
            Alert.alert("Sync Error", error.message || "Could not save to server.");
        } finally {
            setIsProcessing(false);
        }
    }, [pastedText, parserConfig]);

    const handleScanPhoto = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*'],
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            const file = result.assets[0];
            setIsProcessing(true);

            // Professional backend OCR processing
            const ocrRes = await parsingService.processOCR(file.uri);

            if (ocrRes.success) {
                const text = ocrRes.data.content;
                if (!text || !text.trim()) {
                    Alert.alert("OCR Error", "We couldn't detect any readable text in the image. Please try a clearer photo.");
                    return;
                }

                const segments = splitIntakeMessage(text);
                const parsed = segments.map(seg => parseDealContent(seg, parserConfig))
                    .filter(p => p.confidenceScore > 10);

                if (parsed.length === 0) {
                    Alert.alert("No Deals Found", "Text was extracted but we couldn't identify structured property deals.");
                } else {
                    setParsedItems(prev => [...parsed, ...prev]);
                }
            } else {
                throw new Error(ocrRes.message || "OCR processing failed.");
            }
        } catch (error: any) {
            Alert.alert("Extraction Error", error.message || "Failed to process photo.");
        } finally {
            setIsProcessing(false);
        }
    };


    const handleImportFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/zip', 'application/pdf', 'image/*'],
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            const file = result.assets[0];
            setIsProcessing(true);

            if (file.name.toLowerCase().endsWith('.zip')) {
                // 1. Try Local WhatsApp parsing
                try {
                    const messages = await parseWhatsAppZip(file.uri);
                    if (messages.length > 0) {
                        const parsed = messages.map(msg => parseDealContent(msg.content, parserConfig))
                            .filter(p => p.confidenceScore > 20);

                        setParsedItems(prev => [...parsed, ...prev]);
                        Alert.alert("Success", `Extracted ${parsed.length} potential deals from archive.`);
                        return;
                    }
                } catch (e) {
                    console.log("Local parse fail, trying backend fallback...");
                }

                // 2. Professional Backend ZIP Parser Fallback
                const zipRes = await parsingService.processZip(file.uri, file.name);
                if (zipRes.success && zipRes.data) {
                    const text = zipRes.data.content;
                    const segments = splitIntakeMessage(text);
                    const parsed = segments.map(seg => parseDealContent(seg, parserConfig))
                        .filter(p => p.confidenceScore > 20);

                    if (parsed.length > 0) {
                        setParsedItems(prev => [...parsed, ...prev]);
                        Alert.alert("Success", `Processed archive and extracted ${parsed.length} deals.`);
                    } else {
                        Alert.alert("No Data", "No usable property deals found in archive files.");
                    }
                } else {
                    Alert.alert("Invalid Archive", "This ZIP file structure is not supported.");
                }
            } else if (file.mimeType?.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png)$/i)) {
                // OCR Path
                const ocrRes = await parsingService.processOCR(file.uri);
                if (ocrRes.success) {
                    const segments = splitIntakeMessage(ocrRes.data.text);
                    const parsed = segments.map(seg => parseDealContent(seg, parserConfig))
                        .filter(p => p.confidenceScore > 10);
                    setParsedItems(prev => [...parsed, ...prev]);
                }
            } else if (file.name.toLowerCase().endsWith('.pdf')) {
                const pdfRes = await parsingService.processPdf(file.uri, file.name);
                if (pdfRes.success && pdfRes.data) {
                    const text = pdfRes.data.content;
                    const segments = splitIntakeMessage(text);
                    const parsed = segments.map(seg => parseDealContent(seg, parserConfig))
                        .filter(p => p.confidenceScore > 20);
                    setParsedItems(prev => [...parsed, ...prev]);
                    Alert.alert("Success", `Processed PDF and extracted ${parsed.length} deals.`);
                } else {
                    Alert.alert("Error", pdfRes.message || "Failed to process PDF.");
                }
            }
        } catch (error: any) {
            Alert.alert("Import Error", error.message || "Failed to process selection.");
        } finally {
            setIsProcessing(false);
        }
    };


    const handleClear = () => {
        setParsedItems([]);
    };

    const processIntake = (item: ParsedDeal) => {
        const params = new URLSearchParams();
        params.append('prefill', 'true');
        if (item.location !== 'Unspecified') params.append('location', item.location);
        if (item.specs.price) params.append('price', item.specs.price);
        if (item.specs.size) params.append('size', item.specs.size);
        if (item.type !== 'Unknown') params.append('type', item.type);
        if (item.address.unitNumber) params.append('unitNo', item.address.unitNumber);
        if (item.contacts.length > 0) {
            params.append('mobile', item.contacts[0].mobile);
            params.append('name', item.contacts[0].name);
        }

        if (item.intent === 'BUYER' || item.intent === 'TENANT') {
            router.push(`/add-lead?${params.toString()}`);
        } else {
            router.push(`/add-deal?${params.toString()}`);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header Area */}
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Deal Intake</Text>
                    <Text style={[styles.headerSub, { color: theme.textLight }]}>AI-powered automated parsing engine</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={handleScanPhoto} style={[styles.actionBtn, { borderColor: theme.border }]}>
                        <Ionicons name="camera-outline" size={22} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleImportFile} style={[styles.actionBtn, { borderColor: theme.border }]}>
                        <Ionicons name="document-text-outline" size={22} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsModalOpen(true)} style={[styles.addBtn, { backgroundColor: theme.primary }]}>
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

            </View>

            {/* List Content */}
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {isProcessing && (
                    <View style={styles.processingBar}>
                        <ActivityIndicator size="small" color={theme.primary} />
                        <Text style={[styles.processingText, { color: theme.textLight }]}>Analyzing content...</Text>
                    </View>
                )}

                {parsedItems.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={[styles.emptyIconBox, { backgroundColor: theme.primary + '10' }]}>
                            <Ionicons name="scan-outline" size={48} color={theme.primary} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: theme.text }]}>No Intakes Yet</Text>
                        <Text style={[styles.emptySub, { color: theme.textLight }]}>
                            Import WhatsApp exports or paste messages to extract structured deals instantly.
                        </Text>
                        <View style={styles.emptyActionsRow}>
                            <TouchableOpacity
                                style={[styles.emptyAction, { borderColor: theme.primary }]}
                                onPress={() => setIsModalOpen(true)}
                            >
                                <Text style={{ color: theme.primary, fontWeight: '700' }}>Paste Content</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.emptyAction, { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                onPress={handleImportFile}
                            >
                                <Text style={{ color: '#fff', fontWeight: '700' }}>Import File</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <>
                        <View style={styles.listHeader}>
                            <Text style={[styles.listTitle, { color: theme.textLight }]}>
                                {parsedItems.length} ITEMS EXTRACTED
                            </Text>
                            <TouchableOpacity onPress={handleClear}>
                                <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Clear All</Text>
                            </TouchableOpacity>
                        </View>
                        {parsedItems.map((item, idx) => (
                            <IntakeItemCard
                                key={idx}
                                item={item}
                                onProcess={() => processIntake(item)}
                            />
                        ))}
                    </>
                )}
            </ScrollView>

            {/* Input Modal */}
            <Modal visible={isModalOpen} animationType="slide" transparent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalBg}
                >
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Paste Raw Deal</Text>
                            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                                <Ionicons name="close" size={24} color={theme.textLight} />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={[styles.textInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                            placeholder="Paste your WhatsApp message or deal text here..."
                            placeholderTextColor={theme.textLight}
                            multiline
                            numberOfLines={10}
                            textAlignVertical="top"
                            value={pastedText}
                            onChangeText={setPastedText}
                            autoFocus
                        />

                        <TouchableOpacity
                            style={[styles.parseBtn, { backgroundColor: theme.primary }]}
                            onPress={handleParse}
                        >
                            <Ionicons name="flash" size={18} color="#fff" />
                            <Text style={styles.parseBtnText}>Detect & Split Deals</Text>
                        </TouchableOpacity>

                        <Text style={[styles.modalTip, { color: theme.textLight }]}>
                            Smart Engine will automatically detect intent, location, unit numbers, and contacts.
                        </Text>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    headerSub: {
        fontSize: 12,
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    actionBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    addBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 120, // Tab bar clearance
    },
    processingBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#f3f4f6',
        paddingVertical: 8,
        borderRadius: 12,
        marginBottom: 16,
    },
    processingText: {
        fontSize: 12,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyIconBox: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptySub: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 30,
        marginBottom: 24,
    },
    emptyActionsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    emptyAction: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 2,
        minWidth: 140,
        alignItems: 'center',
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    listTitle: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
    },
    modalBg: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        minHeight: 450,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    textInput: {
        height: 200,
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        fontSize: 16,
        marginBottom: 20,
    },
    parseBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 10,
        marginBottom: 16,
    },
    parseBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    modalTip: {
        fontSize: 12,
        textAlign: 'center',
        fontStyle: 'italic',
    }
});
