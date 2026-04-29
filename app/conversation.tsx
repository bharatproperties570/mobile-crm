import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
    KeyboardAvoidingView, Platform, ActivityIndicator, Image,
    Dimensions, Alert, Pressable, Modal
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { getMessagingStream, sendReply } from '@/services/activities.service';
import api from '@/services/api';
import * as DocumentPicker from 'expo-document-picker';
import { safeApiCall } from '@/services/api.helpers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ConversationScreen() {
    const { id, participant, phone, via } = useLocalSearchParams();
    const { theme, isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const flatListRef = useRef<FlatList>(null);

    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [mediaModal, setMediaModal] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [matched, setMatched] = useState(false); // Local state for match status

    const fetchMessages = useCallback(async () => {
        try {
            // Fetch the stream and filter for this participant
            const res = await safeApiCall(() => getMessagingStream());
            if (res.data) {
                const participantKey = (phone as string) || (participant as string);
                
                // Filtering messages for this specific conversation
                const thread = res.data.filter((act: any) => {
                    const actKey = act.phone || act.phoneNumber || act.participant || act.details?.from || '';
                    return actKey === participantKey;
                });

                // Flatten threads if any
                const allMsgs: any[] = [];
                thread.forEach((act: any) => {
                    if (act.thread && act.thread.length > 0) {
                        allMsgs.push(...act.thread.map((m: any) => ({
                            id: m.id || `${act._id}_${m.time}`,
                            text: m.text,
                            sender: m.sender, // agent | customer | ai
                            time: m.time,
                            type: m.type || 'text',
                            metadata: m.metadata
                        })));
                    } else {
                        allMsgs.push({
                            id: act._id,
                            text: act.subject || act.description || act.details?.message,
                            sender: act.outcome === 'Received' ? 'customer' : 'agent',
                            time: act.date || act.createdAt,
                            type: act.details?.attachment ? 'media' : 'text',
                            metadata: act.details?.attachment
                        });
                    }
                });

                // Sort by time
                const sorted = allMsgs.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
                
                // Deduplicate
                const seen = new Set();
                const unique = sorted.filter(m => {
                    const key = `${m.time}_${m.text}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });

                setMessages(unique);
            }
        } catch (e) {
            console.error("[Conversation] Fetch error:", e);
        } finally {
            setLoading(false);
        }
    }, [id, participant, phone]);

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [fetchMessages]);

    const handleSendMessage = async () => {
        if (!inputText.trim() || sending) return;

        const text = inputText.trim();
        setInputText('');
        setSending(true);

        try {
            const res = await sendReply({
                phoneNumber: phone as string,
                message: text,
                channel: (via as string).toLowerCase()
            });

            if (res.success) {
                fetchMessages();
            } else {
                Alert.alert("Failed", res.error || "Could not send message");
            }
        } catch (e) {
            Alert.alert("Error", "Something went wrong while sending.");
        } finally {
            setSending(false);
        }
    };

    const handleConvertToLead = async () => {
        if (!phone || isActionLoading) return;
        
        setIsActionLoading(true);
        try {
            // Using the same central endpoint I just added to the backend
            const res = await api.post('/activities/messaging/convert-to-lead', {
                phoneNumber: phone as string,
                name: participant as string,
                source: `Mobile ${via || 'Messaging'}`
            });
            
            if (res.data?.success) {
                Alert.alert("Success", "Contact converted to Lead successfully!");
                setMatched(true);
                // Refresh messages to see updated metadata if any
                fetchMessages();
            } else {
                Alert.alert("Failed", res.data?.error || "Could not convert to lead.");
            }
        } catch (e: any) {
            console.error("Conversion error:", e);
            Alert.alert("Error", "Something went wrong during conversion.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handlePickMedia = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'application/pdf', 'video/*'],
                copyToCacheDirectory: true
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                
                // Confirm sending
                Alert.alert(
                    "Send File?",
                    `Do you want to send ${file.name}?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { 
                            text: "Send", 
                            onPress: () => uploadAndSendMedia(file)
                        }
                    ]
                );
            }
        } catch (e) {
            console.error("Picker error:", e);
        }
    };

    const uploadAndSendMedia = async (file: any) => {
        setSending(true);
        try {
            // First upload to our media endpoint
            const formData = new FormData();
            formData.append('file', {
                uri: file.uri,
                name: file.name,
                type: file.mimeType || 'application/octet-stream'
            } as any);

            // Using the central api instance for upload to ensure auth headers are included
            const uploadRes = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const uploadData = uploadRes.data;

            if (uploadData.success) {
                const res = await sendReply({
                    phoneNumber: phone as string,
                    channel: (via as string).toLowerCase(),
                    attachment: {
                        type: file.mimeType?.startsWith('image') ? 'image' : (file.mimeType?.startsWith('video') ? 'video' : 'document'),
                        url: uploadData.url,
                        filename: file.name
                    }
                });
                if (res.success) fetchMessages();
                else Alert.alert("Failed", "Could not send media message");
            } else {
                Alert.alert("Upload Failed", "Could not upload file to CRM storage.");
            }
        } catch (e) {
            console.error("Upload error:", e);
            Alert.alert("Error", "Media sending failed.");
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }: { item: any }) => {
        const isMe = item.sender === 'agent' || item.sender === 'ai';
        const isAI = item.sender === 'ai';
        
        return (
            <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}>
                <View style={[
                    styles.bubble, 
                    isMe ? { backgroundColor: theme.primary } : { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 },
                    isAI && { backgroundColor: '#8b5cf6' }
                ]}>
                    {item.type === 'media' || item.metadata?.url ? (
                        <TouchableOpacity onPress={() => item.metadata?.type === 'image' && setPreviewImage(item.metadata.url)}>
                            <View style={styles.mediaContainer}>
                                {item.metadata?.type === 'image' ? (
                                    <Image source={{ uri: item.metadata.url }} style={styles.mediaImage} />
                                ) : (
                                    <View style={styles.fileContainer}>
                                        <Ionicons name="document-text" size={24} color={isMe ? "#fff" : theme.primary} />
                                        <Text style={[styles.fileName, { color: isMe ? "#fff" : theme.text }]} numberOfLines={1}>
                                            {item.metadata?.filename || 'Document'}
                                        </Text>
                                    </View>
                                )}
                                {item.text && <Text style={[styles.bubbleText, { color: isMe ? '#fff' : theme.text, marginTop: 5 }]}>{item.text}</Text>}
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <Text style={[styles.bubbleText, { color: isMe ? '#fff' : theme.text }]}>
                            {item.text}
                        </Text>
                    )}
                    <View style={styles.bubbleFooter}>
                        {isAI && <Text style={styles.aiBadge}>AI Bot</Text>}
                        <Text style={[styles.timeText, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textMuted }]}>
                            {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <Stack.Screen 
                options={{
                    headerTitle: () => (
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{participant}</Text>
                            <Text style={{ fontSize: 10, color: theme.textMuted, fontWeight: '600' }}>{via} • {phone}</Text>
                        </View>
                    ),
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {!matched && (
                                <TouchableOpacity 
                                    onPress={handleConvertToLead} 
                                    disabled={isActionLoading}
                                    style={{ marginRight: 15, padding: 6, borderRadius: 8, backgroundColor: theme.primary + '15' }}
                                >
                                    {isActionLoading ? (
                                        <ActivityIndicator size="small" color={theme.primary} />
                                    ) : (
                                        <Ionicons name="person-add" size={18} color={theme.primary} />
                                    )}
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => Alert.alert("Actions", "Extra actions here")}>
                                <Ionicons name="ellipsis-vertical" size={20} color={theme.text} />
                            </TouchableOpacity>
                        </View>
                    ),
                    headerStyle: { backgroundColor: theme.card },
                    headerTintColor: theme.text,
                }} 
            />

            <FlatList 
                ref={flatListRef}
                data={messages}
                keyExtractor={item => String(item.id || item.time || Math.random())}
                renderItem={renderMessage}
                contentContainerStyle={[styles.listContent, { paddingBottom: 20 }]}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                ListEmptyComponent={
                    loading ? (
                        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={{ color: theme.textMuted }}>No message history found.</Text>
                        </View>
                    )
                }
            />

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={[styles.inputContainer, { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 15) }]}>
                    <TouchableOpacity style={styles.attachBtn} onPress={handlePickMedia}>
                        <Ionicons name="add" size={24} color={theme.primary} />
                    </TouchableOpacity>
                    
                    <TextInput 
                        style={[styles.input, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', color: theme.text }]}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type a message..."
                        placeholderTextColor={theme.textMuted}
                        multiline
                    />

                    <TouchableOpacity 
                        style={[styles.sendBtn, { backgroundColor: theme.primary }, !inputText.trim() && { opacity: 0.5 }]} 
                        onPress={handleSendMessage}
                        disabled={!inputText.trim() || sending}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="send" size={18} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Image Preview Modal */}
            <Modal visible={!!previewImage} transparent animationType="fade">
                <Pressable style={styles.previewOverlay} onPress={() => setPreviewImage(null)}>
                    <Image source={{ uri: previewImage || '' }} style={styles.fullImage} resizeMode="contain" />
                    <TouchableOpacity style={styles.closePreview} onPress={() => setPreviewImage(null)}>
                        <Ionicons name="close-circle" size={40} color="#fff" />
                    </TouchableOpacity>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    listContent: { padding: 15 },
    messageRow: { marginBottom: 10, flexDirection: 'row', width: '100%' },
    messageRowMe: { justifyContent: 'flex-end' },
    messageRowThem: { justifyContent: 'flex-start' },
    bubble: {
        maxWidth: SCREEN_WIDTH * 0.75,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 18,
    },
    bubbleText: { fontSize: 15, fontWeight: '500', lineHeight: 20 },
    bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 5 },
    timeText: { fontSize: 9, fontWeight: '600' },
    aiBadge: { fontSize: 8, fontWeight: '800', color: '#fff', backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 4, borderRadius: 4 },
    
    inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1 },
    attachBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    input: { flex: 1, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, fontSize: 15, maxHeight: 100, marginHorizontal: 8 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    
    mediaContainer: { width: 200, overflow: 'hidden' },
    mediaImage: { width: '100%', height: 150, borderRadius: 12 },
    fileContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 5 },
    fileName: { fontSize: 13, fontWeight: '600', flex: 1 },
    
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
    previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: '100%', height: '100%' },
    closePreview: { position: 'absolute', top: 50, right: 20 },
});
