import { Tabs } from "expo-router";
import React from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAppData } from "@/providers/app-data-provider";

export default function TabLayout() {
  const theme = useColorScheme() ?? "light";
  const { dirtyItems } = useAppData();
  const dirtyCount = dirtyItems.length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[theme].tint,
        tabBarInactiveTintColor: Colors[theme].tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: Colors[theme].surface,
          borderTopColor: Colors[theme].border,
          height: 82,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons size={size} name="auto-awesome" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Closet",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons size={size} name="checkroom" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: "Planner",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons size={size} name="calendar-month" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons size={size} name="shield" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="laundry"
        options={{
          title: "Laundry",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              size={size}
              name="local-laundry-service"
              color={color}
            />
          ),
          tabBarBadge: dirtyCount > 0 ? dirtyCount : undefined,
        }}
      />
      <Tabs.Screen
        name="capsule"
        options={{
          title: "Capsule",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons size={size} name="style" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inspiration"
        options={{
          title: "Inspo",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons size={size} name="collections" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
