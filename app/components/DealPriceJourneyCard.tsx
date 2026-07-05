import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import api from '@/services/api';

const formatINRFull = (amount: number) => {
    if (!amount || isNaN(amount)) return '—';
    return '₹ ' + Math.round(amount).toLocaleString('en-IN');
};

const GapBadge = ({ pct }: { pct: number | null | undefined }) => {
    if (pct === null || pct === undefined) return null;
    const isNeg = pct < 0;
    const abs = Math.abs(pct);
    return (
        <View style={[styles.badge, { 
            backgroundColor: isNeg ? '#fef2f2' : '#f0fdf4',
            borderColor: isNeg ? '#fecaca' : '#bbf7d0'
        }]}>
            <Text style={[styles.badgeText, { color: isNeg ? '#dc2626' : '#16a34a' }]}>
                {isNeg ? '▼' : '▲'} {abs.toFixed(1)}%
            </Text>
        </View>
    );
};

const JourneyStep = ({ 
    icon, label, price, rpu, unitLabel, pct, color, isLast, isCurrent, theme 
}: any) => {
    const isDark = theme.background === '#0F172A';

    return (
        <View style={styles.stepContainer}>
            {/* Timeline connector */}
            {!isLast && (
                <View style={styles.connectorContainer}>
                    <View style={[styles.connectorLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }]} />
                </View>
            )}

            {/* Icon */}
            <View style={styles.iconWrapper}>
                <View style={[
                    styles.iconBox,
                    {
                        backgroundColor: isCurrent ? color : (isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'),
                        borderColor: isCurrent ? color : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
                        shadowColor: isCurrent ? color : 'transparent',
                    }
                ]}>
                    <Ionicons name={icon} size={14} color={isCurrent ? '#fff' : '#94a3b8'} />
                </View>
            </View>

            {/* Content */}
            <View style={[styles.contentWrapper, { paddingBottom: isLast ? 0 : 20 }]}>
                <View style={styles.contentHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.stepLabel}>{label}</Text>
                        {price ? (
                            <>
                                <Text style={[styles.priceText, { color: isCurrent ? color : theme.text }]}>
                                    {formatINRFull(price)}
                                </Text>
                                {rpu && (
                                    <Text style={styles.rpuText}>
                                        {formatINRFull(rpu)} {unitLabel}
                                    </Text>
                                )}
                            </>
                        ) : (
                            <Text style={styles.notRecordedText}>Not recorded yet</Text>
                        )}
                    </View>
                    {pct !== null && pct !== undefined && (
                        <View style={styles.pctContainer}>
                            <Text style={styles.vsExpectedText}>vs Expected</Text>
                            <GapBadge pct={pct - 100} />
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

export default function DealPriceJourneyCard({ dealId, deal }: { dealId: string, deal?: any }) {
    const { theme } = useTheme();
    const isDark = theme.background === '#0F172A';
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (hasFetched.current || !dealId) return;
        hasFetched.current = true;
        
        api.get(`/pricing/deal-analysis/${dealId}`)
            .then(res => { 
                if (res.data?.status === 'success') setData(res.data.data); 
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [dealId]);

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={styles.loadingText}>Loading price analysis…</Text>
            </View>
        );
    }

    if (!data) return null;

    const j = data.priceJourney;
    const a = data.analysis;

    const steps = [
        { icon: 'pricetag', label: "Seller's Expected Price", price: j.expected?.price, rpu: j.expected?.ratePerUnit, pct: null, color: '#4f46e5', isCurrent: false },
        { icon: 'hand-left', label: 'Our Quoted Price', price: j.quoted?.price, rpu: j.quoted?.ratePerUnit, pct: j.quoted?.pct, color: '#0369a1', isCurrent: false },
        { icon: 'person', label: "Buyer's Offer", price: j.offer?.price, rpu: j.offer?.ratePerUnit, pct: j.offer?.pct, color: '#d97706', isCurrent: false },
        { icon: 'flag', label: 'Final Closed Price', price: j.closed?.price, rpu: j.closed?.ratePerUnit, pct: j.closed?.pct, color: '#16a34a', isCurrent: !!(j.closed?.price) },
    ];

    return (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Header */}
            <View style={styles.header}>
                <Ionicons name="stats-chart" size={16} color="#818cf8" style={{ marginRight: 8 }} />
                <View>
                    <Text style={styles.headerTitle}>Price Journey Analysis</Text>
                    <Text style={styles.headerSubtitle}>
                        {data.subCategory} · {data.areaUnitLabel}
                    </Text>
                </View>
            </View>

            <View style={styles.body}>
                {/* Journey Steps */}
                {steps.map((step, i) => (
                    <JourneyStep
                        key={i}
                        {...step}
                        theme={theme}
                        unitLabel={data.areaUnitLabel}
                        isLast={i === steps.length - 1}
                    />
                ))}

                {/* Gap Summary */}
                {(a.negotiationGapPct !== null || a.buyerDiscountAskedPct !== null) && (
                    <View style={[styles.gapSummary, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderColor: theme.border }]}>
                        {a.negotiationGapPct !== null && (
                            <View style={styles.gapCol}>
                                <Text style={styles.gapLabel}>Seller Negotiated</Text>
                                <Text style={styles.gapValRed}>▼ {Math.abs(a.negotiationGapPct).toFixed(1)}%</Text>
                                <Text style={styles.gapSub}>from Expected to Closed</Text>
                            </View>
                        )}
                        {a.buyerDiscountAskedPct !== null && (
                            <View style={styles.gapCol}>
                                <Text style={styles.gapLabel}>Buyer Pushed For</Text>
                                <Text style={styles.gapValOrange}>▼ {Math.abs(a.buyerDiscountAskedPct).toFixed(1)}%</Text>
                                <Text style={styles.gapSub}>Quoted to Offer gap</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Market Comparison */}
                {a.marketCompare && (
                    <View style={styles.marketCompareCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                            <Ionicons name="trending-up" size={12} color="#16a34a" style={{ marginRight: 4 }} />
                            <Text style={styles.marketCompareTitle}>vs Market Average</Text>
                        </View>
                        <View style={styles.marketCompareRow}>
                            <View>
                                <Text style={styles.marketCompareText}>This Deal: {formatINRFull(a.marketCompare.dealRPU)} {data.areaUnitLabel}</Text>
                                <Text style={styles.marketCompareText}>Market Avg: {formatINRFull(a.marketCompare.marketAvgRPU)} {data.areaUnitLabel}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.marketComparePct, { color: a.marketCompare.vsMarketPct >= 0 ? '#16a34a' : '#dc2626' }]}>
                                    {a.marketCompare.vsMarketPct >= 0 ? '+' : ''}{a.marketCompare.vsMarketPct?.toFixed(1)}%
                                </Text>
                                <Text style={styles.marketCompareSub}>{a.marketCompare.positioning}</Text>
                            </View>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { borderRadius: 16, borderWidth: 1, marginVertical: 12, overflow: 'hidden' },
    loadingContainer: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 16, borderWidth: 1, marginVertical: 12, gap: 10 },
    loadingText: { fontSize: 13, color: '#94a3b8' },
    header: { padding: 16, backgroundColor: '#1e293b', flexDirection: 'row', alignItems: 'center' },
    headerTitle: { fontSize: 14, fontWeight: '800', color: '#fff' },
    headerSubtitle: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    body: { padding: 20 },
    
    // Step Styles
    stepContainer: { flexDirection: 'row', gap: 14, position: 'relative' },
    connectorContainer: { position: 'absolute', left: 16, top: 34, width: 2, height: '100%', alignItems: 'center' },
    connectorLine: { width: 2, height: '100%', flex: 1 },
    iconWrapper: { flexShrink: 0 },
    iconBox: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
    contentWrapper: { flex: 1 },
    contentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    stepLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
    priceText: { fontSize: 16, fontWeight: '900', marginTop: 2 },
    rpuText: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    notRecordedText: { fontSize: 12, color: '#cbd5e1', marginTop: 4, fontStyle: 'italic' },
    
    // Badge Styles
    pctContainer: { alignItems: 'flex-end', gap: 4 },
    vsExpectedText: { fontSize: 11, color: '#94a3b8' },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
    badgeText: { fontSize: 10, fontWeight: '800' },
    
    // Gap Summary Styles
    gapSummary: { marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between' },
    gapCol: { flex: 1 },
    gapLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
    gapValRed: { fontSize: 14, fontWeight: '900', color: '#dc2626' },
    gapValOrange: { fontSize: 14, fontWeight: '900', color: '#d97706' },
    gapSub: { fontSize: 10, color: '#64748b', marginTop: 2 },
    
    // Market Compare Styles
    marketCompareCard: { marginTop: 12, padding: 14, borderRadius: 12, backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac' },
    marketCompareTitle: { fontSize: 10, color: '#16a34a', fontWeight: '800', textTransform: 'uppercase' },
    marketCompareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    marketCompareText: { fontSize: 11, color: '#374151', fontWeight: '600' },
    marketComparePct: { fontSize: 13, fontWeight: '800' },
    marketCompareSub: { fontSize: 10, color: '#64748b', marginTop: 2 },
});
