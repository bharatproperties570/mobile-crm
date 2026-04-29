            <View style={{
                width: size, height: size, borderRadius: size / 2,
                borderWidth: strokeWidth,
                borderColor: color,
                borderLeftColor: score > 75 ? color : 'transparent',
                borderBottomColor: score > 50 ? color : 'transparent',
                borderRightColor: score > 25 ? color : 'transparent',
                borderTopColor: color,
                transform: [{ rotate: '-45deg' }]
            }}></View>
            <Text style={{ fontSize: 9, fontWeight: '800', color: theme.text, position: 'absolute' }}>{score}</Text>
        </View>
    );
});

const StaggeredLeadItem = memo(({ item, index, renderItem }: any) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200, // Faster, snappy entry
            delay: Math.min(index * 20, 300), // Cap delay so large lists don't feel slow
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View style={{
            opacity: fadeAnim,
            transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }}>
            {renderItem({ item, index })}
        </Animated.View>
    );
});

const LeadCard = memo(({ lead, index, onPress, onMore, isSelected, onLongPress, liveScore }: {
    lead: Lead;
    index: number;
    onPress: () => void;
    onMore: () => void;
    isSelected?: boolean;
    onLongPress?: () => void;
    liveScore?: { score: number; color: string; label: string };
}) => {
    const { theme, isDarkMode } = useTheme();
    const { trackCall } = useCallTracking();
    const { getLookupValue } = useLookup();
    const { findUser } = useUsers();
    const name = leadName(lead);
    const isDark = isDarkMode;
    const stageCfgMap = isDark ? STAGE_CONFIG_DARK : STAGE_CONFIG_LIGHT;
    const stageLabel = getLookupValue("Stage", lead.stage) || "New";
    const stageCfg = (stageCfgMap as any)[stageLabel] || (stageCfgMap as any).default;
    const score = liveScore ? { val: liveScore.score, color: liveScore.color, bg: liveScore.color + (isDark ? '25' : '15') } : getLeadScore(lead, isDark);

    const scaleValue = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            delay: Math.min(index * 20, 300),
            useNativeDriver: true,
        }).start();
    }, [index]);

    const onPressIn = () => {
        Animated.spring(scaleValue, { toValue: 0.98, useNativeDriver: true }).start();
    };
    const onPressOut = () => {
        Animated.spring(scaleValue, { toValue: 1, useNativeDriver: true }).start();
    };

    const renderRightActions = () => (
        <View style={styles.rightActions}>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: theme.primary }]} onPress={() => trackCall(lead.mobile || "", lead._id, "Lead", name)}>
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: theme.warning }]} onPress={() => Linking.openURL(`sms:${lead.mobile}`)}>
                <Ionicons name="chatbubble" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>SMS</Text>
            </TouchableOpacity>
        </View>
    );

    const renderLeftActions = () => (
        <View style={styles.leftActions}>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: theme.success }]} onPress={() => {
                const cleanPhone = (lead.mobile || "").replace(/[^0-9]/g, "");
                Linking.openURL(`whatsapp://send?phone=${cleanPhone.length === 10 ? "91" + cleanPhone : cleanPhone}`);
            }}>
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? '#818CF8' : "#6366F1" }]} onPress={() => lead.email && Linking.openURL(`mailto:${lead.email}`)}>
                <Ionicons name="mail" size={20} color="#fff" />
                <Text style={styles.swipeLabel}>Email</Text>
            </TouchableOpacity>
        </View>
    );

    const intent = getLookupValue("Requirement", lead.requirement).toLowerCase();
    const intentConfig: Record<string, { bg: string; text: string }> = {
        buy: { bg: isDark ? 'rgba(34, 197, 94, 0.15)' : '#DCFCE7', text: isDark ? '#34D399' : '#15803D' },
        rent: { bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFEDD5', text: isDark ? '#FBBF24' : '#C2410C' },
        lease: { bg: isDark ? 'rgba(59, 130, 246, 0.15)' : '#E0F2FE', text: isDark ? '#60A5FA' : '#0369A1' }
    };
    const currentIntent = intentConfig[intent] || null;

    const requirementText = [
        getLookupValue("Category", lead.propertyType) || getLookupValue("Requirement", lead.requirement), 
        getLookupValue("SubCategory", lead.subType) || getLookupValue("SubRequirement", lead.subRequirement), 
        getLookupValue("UnitType", lead.unitType)
    ].filter(v => v && v !== '—').join(" • ") || "No Requirement specified";

    const budgetText = (lead.budgetMin || lead.budgetMax) 
        ? `₹${formatAmount(lead.budgetMin || 0)} - ₹${formatAmount(lead.budgetMax || 0)}`
        : "";

    const sizeText = (lead.areaMin || lead.areaMax)
        ? `${lead.areaMin || ""}${lead.areaMin && lead.areaMax ? "-" : ""}${lead.areaMax || ""} ${lead.areaMetric || ""}`.trim()
        : "";

    const locationText = [lead.locArea, getLookupValue("Location", lead.location), getLookupValue("City", lead.locCity)]
        .filter(v => v && v !== "—").join(", ");

    const projectText = lead.projectName || lead.project?.name;
    const blockText = lead.locBlock;

    return (
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}>
            <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleValue }, { translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
                <TouchableOpacity
                    activeOpacity={1}
                    onPressIn={onPressIn}
                    onPressOut={onPressOut}
                    onPress={onPress}
                    onLongPress={onLongPress}
                    style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, isSelected && styles.cardSelected]}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <View style={{ width: 44, justifyContent: 'center', alignItems: 'center' }}>
                                <LeadScoreRing score={score.val} isDark={isDark} color={score.color} size={44} />
                            </View>

                            <View style={styles.rowContent}>
                                <View style={styles.rowTop}>
                                    <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{name}</Text>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <Ionicons name="call-outline" size={12} color={theme.textMuted} />
                                    <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600', marginLeft: 4 }}>{lead.mobile}</Text>
                                    {lead.email ? (
                                        <>
                                            <Text style={{ fontSize: 12, color: theme.textMuted, marginHorizontal: 6 }}>•</Text>
                                            <Ionicons name="mail-outline" size={12} color={theme.textMuted} />
                                            <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600', marginLeft: 4, flex: 1 }} numberOfLines={1}>{lead.email}</Text>
                                        </>
                                    ) : null}
                                </View>
                                
                                <Text style={[styles.rowSubject, { color: theme.textSecondary, marginBottom: 4 }]} numberOfLines={1}>
                                    {requirementText}
                                </Text>

                                {(budgetText || sizeText) && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        {budgetText && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                <Ionicons name="pricetag-outline" size={10} color="#10B981" />
                                                <Text style={{ fontSize: 10, color: '#10B981', fontWeight: '800' }}>{budgetText}</Text>
                                            </View>
                                        )}
                                        {sizeText && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                <Ionicons name="expand-outline" size={10} color="#6366F1" />
                                                <Text style={{ fontSize: 10, color: '#6366F1', fontWeight: '800' }}>{sizeText}</Text>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {(projectText || blockText || locationText) && (
                                    <View style={{ marginBottom: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Ionicons name="location-outline" size={12} color={theme.textMuted} />
                                            <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '700' }} numberOfLines={1}>
                                                {projectText ? `${projectText}${blockText ? ` (Block ${blockText})` : ''} • ` : ''}{locationText}
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                <View style={styles.rowMeta}>
                                    <View style={[styles.outcomeBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.border }]}>
                                        <Text style={[styles.outcomeText, { color: theme.textSecondary }]}>
                                            {resolveName(lead.assignment?.assignedTo || lead.owner, getLookupValue, findUser)}
                                        </Text>
                                    </View>

                                    {(() => {
                                        const team = resolveName(lead.assignment?.team?.[0] || lead.owner?.team, getLookupValue, findUser);
                                        if (team && team !== "—") {
                                            return (
                                                <View style={[styles.outcomeBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.border }]}>
                                                    <Text style={[styles.outcomeText, { color: theme.textSecondary }]}>{team}</Text>
                                                </View>
                                            );
                                        }
                                        return null;
                                    })()}

