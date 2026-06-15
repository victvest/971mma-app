import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { TrainingScreen } from '../screens/TrainingScreen';
import { RewardsScreen } from '../screens/RewardsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SideMenu } from '../components/SideMenu';
import { MenuProvider } from '../context/MenuContext';
import type { MainStackParamList } from './types';
import { palette } from '../theme';

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainStack() {
  return (
    <MenuProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: palette.ink800 },
        }}
      >
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen name="Training" component={TrainingScreen} />
        <Stack.Screen name="Rewards" component={RewardsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
      <SideMenu />
    </MenuProvider>
  );
}
