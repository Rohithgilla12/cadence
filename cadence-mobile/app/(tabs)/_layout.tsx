import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet } from 'react-native';
import {
  IconChartBar,
  IconHome,
  IconUser,
  IconUsers,
} from '@tabler/icons-react-native';

import { colors } from '@/theme/tokens';

// iOS uses the native UIVisualEffectView "system chrome material" — this is
// the same recipe Apple uses for the system tab bar on iOS 26 (Liquid Glass).
// It's the platform default for navigation chrome, distinct from custom
// glassmorphism (which DS §12 still forbids). Reduce Transparency is
// honored automatically by the native view. Android keeps the flat card
// background since Material 3 has no equivalent platform material.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.moss,
        tabBarInactiveTintColor: colors.ink3,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopColor: colors.hairline,
            borderTopWidth: StyleSheet.hairlineWidth,
            elevation: 0,
          },
          default: {
            backgroundColor: colors.card,
            borderTopColor: colors.hairline,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
        }),
        tabBarBackground:
          Platform.OS === 'ios'
            ? () => (
                <BlurView
                  tint="systemChromeMaterialLight"
                  intensity={80}
                  style={StyleSheet.absoluteFill}
                />
              )
            : undefined,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <IconHome size={18} color={color} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="reflect"
        options={{
          title: 'Reflect',
          tabBarIcon: ({ color }) => <IconChartBar size={18} color={color} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="circles"
        options={{
          title: 'Circles',
          tabBarIcon: ({ color }) => <IconUsers size={18} color={color} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color }) => <IconUser size={18} color={color} strokeWidth={1.5} />,
        }}
      />
    </Tabs>
  );
}
