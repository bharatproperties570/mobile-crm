import { Tabs } from "expo-router";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useDepartment } from "../context/DepartmentContext";
import { useTheme } from "../context/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TABS_CONFIG = [
    { name: 'index', label: 'Home', icon: 'home-outline', iconActive: 'home' },
    { name: 'leads', label: 'Leads', icon: 'people-outline', iconActive: 'people' },
    { name: 'contacts', label: 'Contacts', icon: 'person-circle-outline', iconActive: 'person-circle' },
    { name: 'deals', label: 'Deals', icon: 'wallet-outline', iconActive: 'wallet' },
    { name: 'activities', label: 'Activities', icon: 'calendar-outline', iconActive: 'calendar' },
    { name: 'companies', label: 'Company', icon: 'business-outline', iconActive: 'business' },
    { name: 'projects', label: 'Project', icon: 'cube-outline', iconActive: 'cube' },
    { name: 'inventory', label: 'Inventory', icon: 'grid-outline', iconActive: 'grid' },
    { name: 'bookings', label: 'Booking', icon: 'newspaper-outline', iconActive: 'newspaper' },
    { name: 'accounts', label: 'Account', icon: 'cash-outline', iconActive: 'cash' },
    { name: 'marketing', label: 'Marketing', icon: 'megaphone-outline', iconActive: 'megaphone' },
    { name: 'intake', label: 'Intake', icon: 'scan-outline', iconActive: 'scan' },
];

const AnimatedTabItem = ({ route, isFocused, activeColor, navigation, config }: any) => {
    const { theme } = useTheme();
    const scaleAnim = useRef(new Animated.Value(isFocused ? 1.2 : 1)).current;
    const rotateAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

    useEffect(() => {
        const animations = [
            Animated.spring(scaleAnim, {
                toValue: isFocused ? 1.2 : 1,
                useNativeDriver: true,
                friction: 4,
            })
        ];

        if (isFocused) {
            rotateAnim.setValue(0);
            animations.push(
                Animated.timing(rotateAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                })
            );
        } else {
            rotateAnim.setValue(0);
        }

        Animated.parallel(animations).start();
    }, [isFocused]);

    const rotate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    const onPress = () => {
        const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
        });

        if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
        }
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            style={[styles.tabItem, isFocused && styles.tabItemActive]}
            activeOpacity={0.7}
        >
            <Animated.View style={[
                styles.iconBox,
                isFocused && {
                    backgroundColor: activeColor + '15',
                    borderColor: activeColor + '30',
                    borderWidth: 1.5,
                    shadowColor: activeColor,
                    shadowOpacity: 0.2,
                    shadowRadius: 10,
                },
                { transform: [{ scale: scaleAnim }, { rotate }] }
            ]}>
                <Ionicons
                    name={(isFocused ? config.iconActive : config.icon) as any}
                    size={22}
                    color={isFocused ? activeColor : theme.textLight}
                />
            </Animated.View>
            <Text style={[
                styles.tabLabel,
                { color: theme.textLight },
                isFocused && { color: activeColor, fontWeight: "900", letterSpacing: 0.5 }
            ]}>
                {config.label}
            </Text>
            {isFocused && (
                <Animated.View
                    style={[
                        styles.activeIndicator,
                        { backgroundColor: activeColor, opacity: scaleAnim.interpolate({ inputRange: [1, 1.2], outputRange: [0, 1] }) }
                    ]}
                />
            )}
        </TouchableOpacity>
    );
};

function CustomTabBar({ state, descriptors, navigation, activeColor }: any) {
    const { theme } = useTheme();
    return (
        <View style={[styles.tabBarContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                decelerationRate="fast"
            >
                {state.routes.map((route: any, index: number) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;
                    const config = TABS_CONFIG.find(t => t.name === route.name);

                    if (!config || options.href === null) return null;

                    return (
                        <AnimatedTabItem
                            key={route.key}
                            route={route}
                            isFocused={isFocused}
                            activeColor={activeColor}
                            options={options}
                            navigation={navigation}
                            config={config}
                        />
                    );
                })}
            </ScrollView>
        </View>
    );
}

export default function TabsLayout() {
    const { config } = useDepartment();
    const { theme } = useTheme();

    // In Omni-Nav, all tabs are visible and accessible. 
    // We hta-ing the DepartmentSwitcher and consolidating all icons in one place.

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <Tabs
                tabBar={(props) => <CustomTabBar {...props} activeColor={config.color} />}
                screenOptions={{
                    headerShown: false,
                }}
            >
                {TABS_CONFIG.map(tab => (
                    <Tabs.Screen
                        key={tab.name}
                        name={tab.name}
                        options={{
                            title: tab.label,
                        }}
                    />
                ))}
                <Tabs.Screen
                    name="more"
                    options={{
                        href: null,
                    }}
                />
            </Tabs>
        </View>
    );
}

const styles = StyleSheet.create({
    tabBarContainer: {
        position: 'absolute',
        bottom: 25,
        left: 15,
        right: 15,
        height: 88,
        backgroundColor: "rgba(255, 255, 255, 0.85)", // Glass effect base
        borderRadius: 35,
        elevation: 25,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 25,
        borderWidth: 1.5,
        borderColor: "rgba(255, 255, 255, 0.6)", // Glossy border
        overflow: 'hidden'
    },
    scrollContent: {
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    tabItem: {
        alignItems: "center",
        justifyContent: "center",
        width: 90,
        height: '100%',
    },
    tabItemActive: {
        // Subtle feedback for active tab
    },
    iconBox: {
        width: 46,
        height: 46,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 5,
        backgroundColor: "transparent",
        borderColor: "transparent",
        borderWidth: 1.5,
    },
    tabLabel: {
        fontSize: 10,
        color: "#94A3B8",
        fontWeight: "700",
        letterSpacing: 0.3,
        marginTop: 2
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 12,
        width: 16,
        height: 4,
        borderRadius: 2,
    }
});
