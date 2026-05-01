import './global.css';

import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Merriweather_700Bold } from '@expo-google-fonts/merriweather';
import { Lato_400Regular } from '@expo-google-fonts/lato';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CalendarCheck, BookOpen, BarChart3 } from 'lucide-react-native';

import { AppBackground } from './src/components/layout/AppBackground';
import { DailySheetScreen } from './src/screens/DailySheetScreen';
import { HabitLibraryScreen } from './src/screens/HabitLibraryScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { RestoreFromDriveScreen } from './src/screens/RestoreFromDriveScreen';
import { ROUTES } from './src/config/constants';
import { tabBarTheme, iconDefaults, colors } from './src/styles/ui.styles';
import { initDatabase } from './src/services/db';
import { checkAndBackfillHistory } from './src/services/assignmentService';
import { configureGoogleSignin, silentSignInIfPossible } from './src/services/googleAuth';
import { useHabitStore } from './src/store/useHabitStore';
import { useSettingsStore } from './src/store/useSettingsStore';
import type { RootStackParamList, RootTabParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

/**
 * Estilos nativos para la pantalla de carga.
 * NO usar NativeWind aquí — puede no estar listo aún al primer render.
 */
const nativeStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.amber50,
  },
});

// ─── Icono de tab genérico ──────────────────────────────────────────

function TabIcon(Icon: typeof CalendarCheck, color: string) {
  return <Icon color={color} size={iconDefaults.size} strokeWidth={iconDefaults.strokeWidth} />;
}

// ─── Tab navigator (pantallas principales) ───────────────────────────

function MainTabs() {
  return (
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
  );
}

// ─── App principal ──────────────────────────────────────────────────

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Merriweather_700Bold,
    Lato_400Regular,
  });

  useEffect(() => {
    // REQ-04-06 — INVARIANTE: El orden initDatabase -> checkAndBackfillHistory es crítico.
    // initDatabase corre runMigrations (PRAGMA user_version + UNIQUE INDEX).
    // PROHIBIDO importar/llamar funciones del subsistema de assignments (repository
    // o service de daily_assignments) desde el render-phase de App.tsx antes de
    // que esta cadena resuelva. Si necesitás un nuevo hook al boot, encadenalo como
    // `.then(() => tuFuncion())` después de checkAndBackfillHistory.
    initDatabase()
      .then(() => checkAndBackfillHistory())
      .then(() => console.log('DB inicializada y backfill completado'))
      .catch((err) => console.error('Error inicializando DB:', err));
  }, []);

  useEffect(() => {
    configureGoogleSignin();
    silentSignInIfPossible()
      .then((session) => {
        if (session) {
          useSettingsStore.getState().setGoogleEmail(session.email);
        }
      })
      .catch((err) => console.error('[App] silent sign-in unexpected error:', err));
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
      <StatusBar style="dark" />
      <NavigationContainer>
        <AppBackground>
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
            <Stack.Screen name={ROUTES.MAIN as 'Main'} component={MainTabs} />
            <Stack.Screen
              name={ROUTES.SETTINGS as 'Ajustes'}
              component={SettingsScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="RestoreFromDrive"
              component={RestoreFromDriveScreen}
              options={{ headerShown: false, animation: 'slide_from_right' }}
            />
          </Stack.Navigator>
        </AppBackground>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
