import { useEffect, useState, useCallback, useRef } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, RefreshControl, ActivityIndicator, Animated, ScrollView, Dimensions, Platform, Modal, KeyboardAvoidingView, Alert
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import api from "@/services/api";
import { safeApiCall } from "@/services/api.helpers";
import * as Print from "expo-print";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const STATUS_COLORS: Record<string, string> = {
    'Booked': '#3B82F6',
    'Agreement': '#8B5CF6',
    'Registry': '#10B981',
    'Pending': '#F59E0B',
    'Cancelled': '#EF4444',
    'Hold': '#64748B'
};

function formatCurrency(amount: number) {
    if (!amount) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

// ==========================================
// SEGMENTED CONTROL COMPONENT
// ==========================================
function SegmentedControl({ tabs, activeTab, onTabChange, theme }: any) {
    return (
        <View style={[styles.segmentedContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {tabs.map((tab: string) => {
                const isActive = activeTab === tab;
                return (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.segmentTab, isActive && { backgroundColor: theme.primary + '1A' }]}
                        onPress={() => onTabChange(tab)}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            styles.segmentText,
                            { color: isActive ? theme.primary : theme.textLight },
                            isActive && { fontWeight: '700' }
                        ]}>{tab}</Text>
                        {isActive && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

// ==========================================
// KPI CARD COMPONENT
// ==========================================
function KpiCard({ title, value, icon, color, theme }: any) {
    return (
        <View style={[styles.kpiCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.kpiIconBox, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{value}</Text>
            <Text style={[styles.kpiTitle, { color: theme.textLight }]}>{title}</Text>
        </View>
    );
}

// ==========================================
// BOOKING CARD COMPONENT
// ==========================================
function BookingCard({ booking, onPress, onQuickAction, onOpenDocs, theme }: { booking: any; onPress: () => void, onQuickAction: () => void, onOpenDocs: () => void, theme: any }) {
    const status = booking.status || booking.stage || 'Pending';
    const color = STATUS_COLORS[status] || theme.primary;
    
    const dealValue = booking.financials?.dealValue || booking.totalDealAmount || 0;
    const paidAmount = booking.financials?.totalPaidAmount || booking.totalPaidAmount || 0;
    const balanceAmount = booking.financials?.totalBalanceAmount || booking.totalBalanceAmount || (dealValue - paidAmount);
    const progress = dealValue > 0 ? (paidAmount / dealValue) * 100 : 0;
    
    const project = booking.property?.project || booking.property?.projectName || 'General Project';
    const unit = booking.property?.unit || booking.property?.unitNo || '';
    const clientName = booking.customer?.buyer?.name || booking.lead?.name || 'Valued Client';

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.appNo, { color: theme.text }]}>{booking.id || booking.applicationNo || "DRAFT"}</Text>
                        {unit ? <View style={[styles.unitBadge, { backgroundColor: theme.background }]}><Text style={{ color: theme.textLight, fontSize: 10, fontWeight: '700' }}>{unit}</Text></View> : null}
                    </View>
                    <Text style={[styles.projectName, { color: theme.textLight }]}>{project}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: color + "15" }]}>
                    <Text style={[styles.statusText, { color: color }]}>{status.toUpperCase()}</Text>
                </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.background }]} />

            <View style={styles.clientRow}>
                <View style={[styles.avatarBox, { backgroundColor: theme.primary + '15' }]}>
                    <Text style={[styles.avatarText, { color: theme.primary }]}>{clientName.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.clientName, { color: theme.text }]}>{clientName}</Text>
                    <Text style={[styles.dateText, { color: theme.textLight }]}>Booked on {new Date(booking.dealDate || booking.bookingDate || Date.now()).toLocaleDateString()}</Text>
                </View>
                
                <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity style={[styles.quickActionBtn, { backgroundColor: theme.border }]} onPress={onOpenDocs}>
                        <Ionicons name="document-text" size={14} color={theme.text} />
                        <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>DOCS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.quickActionBtn, { backgroundColor: theme.primary }]} onPress={onQuickAction}>
                        <Ionicons name="add" size={14} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>PAY</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={[styles.financeBox, { backgroundColor: theme.background }]}>
                <View style={styles.financeRow}>
                    <View>
                        <Text style={[styles.financeLabel, { color: theme.textLight }]}>Deal Value</Text>
                        <Text style={[styles.financeVal, { color: theme.text }]}>{formatCurrency(dealValue)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.financeLabel, { color: theme.textLight }]}>Paid Amount</Text>
                        <Text style={[styles.financeVal, { color: STATUS_COLORS['Booked'] }]}>{formatCurrency(paidAmount)}</Text>
                    </View>
                </View>
                
                <View style={styles.progressContainer}>
                    <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                        <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.progressText, { color: theme.textLight }]}>{progress.toFixed(0)}%</Text>
                </View>
                
                {balanceAmount > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text style={[styles.financeLabel, { color: STATUS_COLORS['Cancelled'] }]}>Balance Due</Text>
                        <Text style={[styles.financeVal, { color: STATUS_COLORS['Cancelled'], fontSize: 13 }]}>{formatCurrency(balanceAmount)}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}

// ==========================================
// FUNNEL BAR COMPONENT (Analytics)
// ==========================================
function FunnelBar({ label, value, max, color, theme }: any) {
    const widthPct = max > 0 ? (value / max) * 100 : 0;
    return (
        <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
                <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800' }}>{value}</Text>
            </View>
            <View style={{ height: 12, backgroundColor: theme.border, borderRadius: 6, overflow: 'hidden' }}>
                <Animated.View style={{ height: '100%', width: `${widthPct}%`, backgroundColor: color, borderRadius: 6 }} />
            </View>
        </View>
    );
}

// ==========================================
// MAIN SCREEN
// ==========================================
export default function BookingsScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    
    const [viewState, setViewState] = useState<'Deals' | 'Ledger' | 'Analytics'>('Deals');
    const [bookings, setBookings] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Ledger State
    const [selectedBookingForLedger, setSelectedBookingForLedger] = useState<any>(null);
    const [ledgerData, setLedgerData] = useState<any>(null);
    const [ledgerLoading, setLedgerLoading] = useState(false);

    // Payment Modal State
    const [isPaymentModalVisible, setPaymentModalVisible] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [paymentPurpose, setPaymentPurpose] = useState('Part Payment');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Document Modal State
    const [isDocModalVisible, setDocModalVisible] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await safeApiCall<any>(() => api.get("/bookings?limit=50"));
            if (!result.error && result.data) {
                setBookings(result.data.data || result.data.records || result.data || []);
            }

            const statsResult = await safeApiCall<any>(() => api.get("/bookings/dashboard/stats"));
            if (!statsResult.error && statsResult.data) {
                setStats(statsResult.data.data || statsResult.data);
            }
            
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        } catch (e) {
            console.error("Failed to fetch bookings data:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [fadeAnim]);

    useEffect(() => { fetchData(); }, []);

    const fetchLedger = async (bookingId: string) => {
        setLedgerLoading(true);
        setViewState('Ledger');
        try {
            const res = await safeApiCall<any>(() => api.get(`/bookings/${bookingId}`));
            if (!res.error && res.data) {
                setLedgerData(res.data.data || res.data);
            }
        } catch (e) {
            console.error("Failed to fetch ledger", e);
        } finally {
            setLedgerLoading(false);
        }
    };

    const handleAddPayment = async () => {
        if (!selectedBookingForLedger || !paymentAmount) return;
        setIsSubmitting(true);
        try {
            const amountNum = parseFloat(paymentAmount);
            const currentPaid = selectedBookingForLedger.financials?.totalPaidAmount || selectedBookingForLedger.totalPaidAmount || 0;
            const payload = {
                bookingId: selectedBookingForLedger._id,
                paymentPurpose,
                paidDate: new Date().toISOString(),
                transactions: [{ amount: amountNum, paymentMode }],
                totalPaidAmount: currentPaid + amountNum
            };
            
            const res = await safeApiCall<any>(() => api.put(`/bookings/${selectedBookingForLedger._id}/payment`, payload));
            if (!res.error) {
                setPaymentModalVisible(false);
                setPaymentAmount('');
                fetchData();
                if (viewState === 'Ledger') fetchLedger(selectedBookingForLedger._id);
            } else {
                alert("Payment Failed");
            }
        } catch (e) {
            alert("Error submitting payment");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGenerateDoc = async (type: string) => {
        if (!selectedBookingForLedger) return;
        setDocModalVisible(false);
        
        let printWindow: Window | null = null;
        if (Platform.OS === 'web') {
            // Open window synchronously before async API call to prevent popup blockers
            printWindow = window.open('', '_blank', 'width=900,height=800');
            if (printWindow) {
                printWindow.document.write('<div style="font-family: sans-serif; padding: 40px; text-align: center;"><h2>Generating Document...</h2><p>Please wait while we fetch the details.</p></div>');
            } else {
                Alert.alert("Popup Blocked", "Please allow popups in your browser to view and print documents.");
                return;
            }
        }
        
        try {
            // Fetch generated HTML string directly from backend (bypassing safeApiCall to preserve raw string)
            const bookingId = selectedBookingForLedger._id || selectedBookingForLedger.id;
            const res = await api.get(`/bookings/${bookingId}/document?type=${encodeURIComponent(type)}`);
            
            if (!res?.data || typeof res.data !== 'string') {
                if (printWindow) printWindow.close();
                Alert.alert("Error", "Could not fetch document. Invalid response format.");
                return;
            }
            
            const htmlStr = res.data;
            
            if (Platform.OS === 'web' && printWindow) {
                printWindow.document.open();
                printWindow.document.write(htmlStr);
                printWindow.document.close();
                // Add a slight delay before printing to allow resources to load
                setTimeout(() => {
                    printWindow?.print();
                }, 500);
            } else if (Platform.OS !== 'web') {
                await Print.printAsync({ html: htmlStr });
            }
        } catch (err: any) {
            if (printWindow) printWindow.close();
            const msg = err?.response?.data?.message || err.message || "Failed to generate document.";
            Alert.alert("Print Error", msg);
            console.error("Document Generation Error:", err);
        }
    };

    const filtered = bookings.filter(b => {
        const query = search.toLowerCase();
        const idMatch = (b.id || b.applicationNo || "").toLowerCase().includes(query);
        const nameMatch = (b.customer?.buyer?.name || b.lead?.name || "").toLowerCase().includes(query);
        const projectMatch = (b.property?.project || b.property?.projectName || "").toLowerCase().includes(query);
        return idMatch || nameMatch || projectMatch;
    });

    const maxFunnel = stats ? Math.max(stats.pendingCount || 0, stats.bookedCount || 0, stats.agreementCount || 0, stats.registryCount || 0) : 1;

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header Area */}
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.title, { color: theme.text }]}>Command Centre</Text>
                    <TouchableOpacity style={[styles.filterBtn, { backgroundColor: theme.background }]}>
                        <Ionicons name="options-outline" size={20} color={theme.text} />
                    </TouchableOpacity>
                </View>
                
                <View style={{ marginTop: 16 }}>
                    <SegmentedControl 
                        tabs={['Deals', 'Ledger', 'Analytics']} 
                        activeTab={viewState} 
                        onTabChange={setViewState} 
                        theme={theme}
                    />
                </View>
            </View>

            {/* KPI Scroll View */}
            {viewState === 'Deals' && stats && (
                <View style={{ backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiScroll}>
                        <KpiCard title="Total Value" value={formatCurrency(stats.totalDealValue || 0)} icon="briefcase" color="#3B82F6" theme={theme} />
                        <KpiCard title="Collected" value={formatCurrency(stats.totalPaidValue || 0)} icon="cash" color="#10B981" theme={theme} />
                        <KpiCard title="Pending" value={formatCurrency(stats.totalBalanceValue || 0)} icon="alert-circle" color="#F59E0B" theme={theme} />
                        <KpiCard title="Total Deals" value={(stats.totalCount || 0).toString()} icon="document-text" color="#8B5CF6" theme={theme} />
                    </ScrollView>
                </View>
            )}

            {/* Main Content Area */}
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
            ) : viewState === 'Deals' ? (
                <>
                    <View style={[styles.searchBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Ionicons name="search" size={18} color={theme.textLight} />
                        <TextInput
                            style={[styles.searchInput, { color: theme.text }]}
                            placeholder="Search IDs, Names, or Projects..."
                            placeholderTextColor={theme.textLight}
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                    <Animated.FlatList
                        data={filtered}
                        keyExtractor={(item, index) => item._id || item.id || index.toString()}
                        style={{ opacity: fadeAnim }}
                        renderItem={({ item }) => (
                            <BookingCard
                                booking={item}
                                theme={theme}
                                onPress={() => { setSelectedBookingForLedger(item); fetchLedger(item._id || item.id); }}
                                onQuickAction={() => { setSelectedBookingForLedger(item); setPaymentModalVisible(true); }}
                                onOpenDocs={() => { setSelectedBookingForLedger(item); setDocModalVisible(true); }}
                            />
                        )}
                        contentContainerStyle={styles.list}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={theme.primary} />}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Ionicons name="document-text-outline" size={60} color={theme.border} />
                                <Text style={[styles.emptyText, { color: theme.textLight }]}>No bookings found</Text>
                            </View>
                        }
                    />
                </>
            ) : viewState === 'Analytics' ? (
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 20 }}>Conversion Pipeline</Text>
                        <FunnelBar label="Pending" value={stats?.pendingCount || 0} max={maxFunnel} color="#64748B" theme={theme} />
                        <FunnelBar label="Booked" value={stats?.bookedCount || 0} max={maxFunnel} color="#3B82F6" theme={theme} />
                        <FunnelBar label="Agreement" value={stats?.agreementCount || 0} max={maxFunnel} color="#8B5CF6" theme={theme} />
                        <FunnelBar label="Registry" value={stats?.registryCount || 0} max={maxFunnel} color="#10B981" theme={theme} />
                    </View>
                    
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                        <View style={[styles.card, { flex: 1, backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>{stats?.totalCount || 0}</Text>
                            <Text style={{ fontSize: 12, color: theme.textLight, marginTop: 4 }}>Total Active Deals</Text>
                        </View>
                        <View style={[styles.card, { flex: 1, backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={{ fontSize: 24, fontWeight: '800', color: '#10B981' }}>
                                {stats?.totalCount ? Math.round(((stats?.registryCount || 0) / stats.totalCount) * 100) : 0}%
                            </Text>
                            <Text style={{ fontSize: 12, color: theme.textLight, marginTop: 4 }}>Registry Rate</Text>
                        </View>
                    </View>
                </ScrollView>
            ) : viewState === 'Ledger' ? (
                <View style={{ flex: 1 }}>
                    {!selectedBookingForLedger ? (
                        <View style={styles.center}>
                            <Ionicons name="list-circle-outline" size={50} color={theme.border} />
                            <Text style={[styles.emptyText, { color: theme.textLight, marginTop: 15 }]}>Select a Deal to view Ledger</Text>
                            <TouchableOpacity style={{ marginTop: 20, padding: 12, backgroundColor: theme.primary + '20', borderRadius: 10 }} onPress={() => setViewState('Deals')}>
                                <Text style={{ color: theme.primary, fontWeight: '700' }}>Browse Deals</Text>
                            </TouchableOpacity>
                        </View>
                    ) : ledgerLoading ? (
                        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
                    ) : (
                        <ScrollView contentContainerStyle={{ padding: 20 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>
                                    {selectedBookingForLedger.id || selectedBookingForLedger.applicationNo || "Ledger"}
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity style={[styles.quickActionBtn, { backgroundColor: theme.border }]} onPress={() => setDocModalVisible(true)}>
                                        <Ionicons name="document-text" size={16} color={theme.text} />
                                        <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>DOCS</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.quickActionBtn, { backgroundColor: theme.primary }]} onPress={() => setPaymentModalVisible(true)}>
                                        <Ionicons name="add" size={16} color="#fff" />
                                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>ADD</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Ledger Timeline */}
                            {(ledgerData?.paymentSchedule || []).length === 0 && (ledgerData?.transactions || []).length === 0 ? (
                                <Text style={{ color: theme.textLight, textAlign: 'center', marginTop: 40 }}>No payment history available.</Text>
                            ) : (
                                <View style={{ paddingLeft: 10 }}>
                                    {[...(ledgerData?.transactions || []), ...(ledgerData?.paymentSchedule || [])].map((item: any, idx: number) => {
                                        const isTransaction = !!item.paymentMode;
                                        const amount = item.amount || item.installmentAmount || 0;
                                        const date = item.paidDate || item.dueDate;
                                        const title = item.paymentPurpose || item.label || 'Payment';
                                        
                                        return (
                                            <View key={idx} style={{ flexDirection: 'row', marginBottom: 20 }}>
                                                <View style={{ alignItems: 'center', marginRight: 15 }}>
                                                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: isTransaction ? '#10B981' : theme.border, zIndex: 2 }} />
                                                    <View style={{ width: 2, flex: 1, backgroundColor: theme.border, marginTop: -4 }} />
                                                </View>
                                                <View style={{ flex: 1, paddingBottom: 10 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{title}</Text>
                                                        <Text style={{ fontSize: 15, fontWeight: '800', color: isTransaction ? '#10B981' : theme.text }}>{formatCurrency(amount)}</Text>
                                                    </View>
                                                    <Text style={{ fontSize: 12, color: theme.textLight, marginTop: 4 }}>
                                                        {isTransaction ? `Paid via ${item.paymentMode}` : 'Scheduled Installment'} • {date ? new Date(date).toLocaleDateString() : 'N/A'}
                                                    </Text>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </ScrollView>
                    )}
                </View>
            ) : null}

            {/* DOCUMENTS MODAL */}
            <Modal visible={isDocModalVisible} transparent animationType="slide">
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Generate Documents</Text>
                            <TouchableOpacity onPress={() => setDocModalVisible(false)}>
                                <Ionicons name="close-circle" size={28} color={theme.textLight} />
                            </TouchableOpacity>
                        </View>
                        
                        <TouchableOpacity style={[styles.docBtn, { borderColor: theme.border }]} onPress={() => handleGenerateDoc('Short Agreement')}>
                            <View style={[styles.docIcon, { backgroundColor: '#6366f115' }]}><Ionicons name="document-text" size={20} color="#6366f1" /></View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>Token (Short Agreement)</Text>
                                <Text style={{ color: theme.textLight, fontSize: 12 }}>Print preliminary token agreement</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.docBtn, { borderColor: theme.border }]} onPress={() => handleGenerateDoc('Sale Agreement')}>
                            <View style={[styles.docIcon, { backgroundColor: '#3b82f615' }]}><Ionicons name="contract" size={20} color="#3b82f6" /></View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>Detailed Sale Agreement</Text>
                                <Text style={{ color: theme.textLight, fontSize: 12 }}>Print the full legal contract</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.docBtn, { borderColor: theme.border }]} onPress={() => handleGenerateDoc('Token Receipt')}>
                            <View style={[styles.docIcon, { backgroundColor: '#10b98115' }]}><Ionicons name="receipt" size={20} color="#10b981" /></View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>Token Receipt</Text>
                                <Text style={{ color: theme.textLight, fontSize: 12 }}>Acknowledge received payments</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.docBtn, { borderColor: theme.border }]} onPress={() => handleGenerateDoc('Demand Letter')}>
                            <View style={[styles.docIcon, { backgroundColor: '#f59e0b15' }]}><Ionicons name="mail" size={20} color="#f59e0b" /></View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>Demand Letter</Text>
                                <Text style={{ color: theme.textLight, fontSize: 12 }}>Generate payment demand notice</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.docBtn, { borderColor: theme.border }]} onPress={() => handleGenerateDoc('Brokerage Invoice')}>
                            <View style={[styles.docIcon, { backgroundColor: '#8b5cf615' }]}><Ionicons name="wallet" size={20} color="#8b5cf6" /></View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>Brokerage Invoice</Text>
                                <Text style={{ color: theme.textLight, fontSize: 12 }}>Generate bill for facilitation</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ACTION PANEL MODAL */}
            <Modal visible={isPaymentModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Add Payment</Text>
                            <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                                <Ionicons name="close-circle" size={28} color={theme.textLight} />
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={{ color: theme.textLight, fontSize: 13, marginBottom: 8, fontWeight: '600' }}>AMOUNT (₹)</Text>
                        <TextInput
                            style={[styles.modalInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                            keyboardType="numeric"
                            placeholder="Enter amount..."
                            placeholderTextColor={theme.textLight}
                            value={paymentAmount}
                            onChangeText={setPaymentAmount}
                        />

                        <Text style={{ color: theme.textLight, fontSize: 13, marginBottom: 8, marginTop: 16, fontWeight: '600' }}>PURPOSE</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                            {['Token', 'Part Payment', 'Final Payment'].map(p => (
                                <TouchableOpacity key={p} onPress={() => setPaymentPurpose(p)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: paymentPurpose === p ? theme.primary : theme.card, borderWidth: 1, borderColor: paymentPurpose === p ? theme.primary : theme.border }}>
                                    <Text style={{ color: paymentPurpose === p ? '#fff' : theme.text, fontSize: 13, fontWeight: '600' }}>{p}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={{ color: theme.textLight, fontSize: 13, marginBottom: 8, marginTop: 8, fontWeight: '600' }}>PAYMENT MODE</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
                            {['Cash', 'Cheque', 'RTGS', 'UPI'].map(m => (
                                <TouchableOpacity key={m} onPress={() => setPaymentMode(m)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: paymentMode === m ? theme.primary : theme.card, borderWidth: 1, borderColor: paymentMode === m ? theme.primary : theme.border }}>
                                    <Text style={{ color: paymentMode === m ? '#fff' : theme.text, fontSize: 13, fontWeight: '600' }}>{m}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity 
                            style={[{ backgroundColor: theme.primary, padding: 16, borderRadius: 12, alignItems: 'center' }, isSubmitting && { opacity: 0.7 }]} 
                            onPress={handleAddPayment}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Submit Payment</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1 },
    title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
    filterBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    
    segmentedContainer: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 4 },
    segmentTab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', position: 'relative' },
    segmentText: { fontSize: 13, fontWeight: '600' },
    activeIndicator: { position: 'absolute', bottom: -4, width: '40%', height: 3, borderRadius: 3 },
    
    kpiScroll: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
    kpiCard: { width: 140, padding: 14, borderRadius: 16, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    kpiIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    kpiValue: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
    kpiTitle: { fontSize: 12, fontWeight: '500' },

    searchBar: { flexDirection: "row", alignItems: "center", margin: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 15, fontWeight: "600" },
    
    list: { paddingHorizontal: 16, paddingBottom: 100 },
    card: { padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
    appNo: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
    unitBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    projectName: { fontSize: 12, marginTop: 4, fontWeight: "500" },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
    
    divider: { height: 1, marginBottom: 12 },
    
    clientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    avatarBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { fontSize: 14, fontWeight: '800' },
    clientName: { fontSize: 15, fontWeight: '700' },
    dateText: { fontSize: 11, marginTop: 2 },
    quickActionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4, marginLeft: 10 },
    
    financeBox: { padding: 12, borderRadius: 12 },
    financeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    financeLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
    financeVal: { fontSize: 15, fontWeight: '800' },
    
    progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    progressText: { fontSize: 11, fontWeight: '700', width: 30, textAlign: 'right' },
    
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    empty: { alignItems: "center", marginTop: 80 },
    emptyText: { marginTop: 16, fontSize: 16, fontWeight: "600" },

    modalInput: { padding: 16, borderRadius: 12, borderWidth: 1, fontSize: 18, fontWeight: '700' },
    
    docBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
    docIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 }
});
