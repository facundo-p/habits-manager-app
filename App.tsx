import './global.css';

import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Merriweather_700Bold } from '@expo-google-fonts/merriweather';
import { Lato_400Regular } from '@expo-google-fonts/lato';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarCheck, BookOpen, BarChart3, Settings } from 'lucide-react-native';

import { AppBackground } from './src/components/layout/AppBackground';
import { DailySheetScreen } from './src/screens/DailySheetScreen';
import { HabitLibraryScreen } from './src/screens/HabitLibraryScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ROUTES } from './src/config/constants';
import { tabBarTheme, iconDefaults, colors } from './src/styles/ui.styles';
import { initDatabase } from './src/services/db';
import { checkAndBackfillHistory } from './src/services/assignmentService';
import { useHabitStore } from './src/store/useHabitStore';
import type { RootStackParamList, RootTabParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

/**
 * Estilos nativos para la pantalla de carga y el botón flotante de Settings.
 * NO usar NativeWind aquí — puede no estar listo aún al primer render.
 */
const nativeStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.amber50,
  },
  gearWrapper: {
    position: 'absolute',
    top: 52,
    right: 16,
    zIndex: 20,
  },
  gearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 251, 235, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
});

// ─── Icono de tab genérico ──────────────────────────────────────────

function TabIcon(Icon: typeof CalendarCheck, color: string) {
  return <Icon color={color} size={iconDefaults.size} strokeWidth={iconDefaults.strokeWidth} />;
}

// ─── Botón flotante de Settings (dentro del MainTabs) ────────────────

function SettingsGear() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={nativeStyles.gearWrapper}>
      <Pressable
        style={nativeStyles.gearButton}
        onPress={() => navigation.navigate(ROUTES.SETTINGS as 'Ajustes')}
      >
        <Settings size={20} color={colors.amber700} strokeWidth={iconDefaults.strokeWidth} />
      </Pressable>
    </View>
  );
}

// ─── Tab navigator (pantallas principales) ───────────────────────────

function MainTabs() {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: tabBarTheme.activeTintColor,
          tabBarInactiveTintColor: tabBarTheme.inactiveTintColor,
          tabBarStyle: tabBarTheme.style,
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tab.Screen
          name={ROUTES.DAILY_SHEET as 'Hoy'}
          component={DailySheetScreen}
          options={{
            tabBarIcon: ({ color }) => TabIcon(CalendarCheck, color),
          }}
          listeners={{
            tabPress: () => {
              useHabitStore.getState().resetToToday();
            },
          }}
        />
        <Tab.Screen
          name={ROUTES.HABIT_LIBRARY as 'Biblioteca'}
          component={HabitLibraryScreen}
          options={{
            tabBarIcon: ({ color }) => TabIcon(BookOpen, color),
          }}
        />
        <Tab.Screen
          name={ROUTES.STATS as 'Progreso'}
          component={StatsScreen}
          options={{
            tabBarIcon: ({ color }) => TabIcon(BarChart3, color),
          }}
        />
      </Tab.Navigator>
      <SettingsGear />
    </View>
  );
}

// ─── App principal ──────────────────────────────────────────────────

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Merriweather_700Bold,
    Lato_400Regular,
  });

  useEffect(() => {
    initDatabase()
      .then(() => checkAndBackfillHistory())
      .then(() => console.log('DB inicializada y backfill completado'))
      .catch((err) => console.error('Error inicializando DB:', err));
  }, []);

  useEffect(() => {
    if (fontError) {
      console.error('Error cargando fuentes:', fontError);
    }
  }, [fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={nativeStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.amber600} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppBackground>
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
            <Stack.Screen name={ROUTES.MAIN as 'Main'} component={MainTabs} />
            <Stack.Screen
              name={ROUTES.SETTINGS as 'Ajustes'}
              component={SettingsScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </Stack.Navigator>
        </AppBackground>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
