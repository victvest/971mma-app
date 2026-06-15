import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TabsParamList } from './types';
import { GlassTabBar } from '../components/GlassTabBar';
import { HomeScreen } from '../screens/HomeScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { ClassesScreen } from '../screens/ClassesScreen';
import { BeltJourneyScreen } from '../screens/BeltJourneyScreen';
import { CoachesScreen } from '../screens/CoachesScreen';

const Tab = createBottomTabNavigator<TabsParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Classes" component={ClassesScreen} options={{ title: 'Schedule' }} />
      <Tab.Screen name="Scan" component={ScanScreen} options={{ title: 'Check-in' }} />
      <Tab.Screen name="Belt" component={BeltJourneyScreen} options={{ title: 'Belt' }} />
      <Tab.Screen name="Coaches" component={CoachesScreen} options={{ title: 'Coaches' }} />
    </Tab.Navigator>
  );
}
