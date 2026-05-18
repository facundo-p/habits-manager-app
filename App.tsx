import './global.css';

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ActivityIndicator, StyleSheet, View } from 'react-native';
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
import { MigrationErrorScreen } from './src/components/screens/MigrationErrorScreen';
import { ROUTES } from './src/config/constants';
import { tabBarTheme, iconDefaults, colors } from './src/styles/ui.styles';
import { initDatabase } from './src/services/db';
import { checkAndBackfillHistory } from './src/services/assignmentService';
import { bootSequence, type MigrationState } from './src/services/bootSequence';
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
        name={ROUTES.DAILY_SHEET}
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
        name={ROUTES.HABIT_LIBRARY}
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

  const [migrationState, setMigrationState] = useState<MigrationState>({ status: 'pending' });

  // REQ-04-06 — INVARIANTE: bootSequence corre initDatabase → checkAndBackfillHistory
  // en orden. Si initDatabase falla (migration v2), retorna 'failed' y App renderiza
  // MigrationErrorScreen bloqueando el NavigationContainer (D-05).
  const runBoot = useCallback(() => {
    setMigrationState({ status: 'pending' });
    bootSequence({ initDatabase, checkAndBackfillHistory })
      .then(setMigrationState)
      .catch((err) => setMigrationState({ status: 'failed', error: err }));
  }, []);

  useEffect(() => {
    runBoot();
  }, [runBoot]);

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

  function handleRestore() {
    // Phase 1: el flow de restore desde el error screen está deferido a una
    // iteración futura (requiere mount de Drive auth + RestoreFromDriveScreen
    // fuera del NavigationContainer principal, no trivial). Por ahora ofrecemos
    // guidance accionable + acceso al snapshot pre-v2 vía file manager (per
    // documentación del PR). UAT Scenario 2 valida que el botón es visible.
    Alert.alert(
      'Restaurar desde backup',
      'Para restaurar tu información:\n\n1. Cerrá esta pantalla con "Reintentar migración" (si está disponible).\n2. Desde Ajustes → "Importar respaldo" o "Restaurar desde Drive", elegí tu backup.\n\nSi tenés un snapshot pre-actualización, está en el directorio de la app (pre-v2-snapshot-*.json).',
      [{ text: 'Entendido' }],
    );
  }

  if (!fontsLoaded && !fontError) {
    return (
      <View style={nativeStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.amber600} />
      </View>
    );
  }

  if (migrationState.status === 'pending') {
    return (
      <View style={nativeStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.amber600} />
      </View>
    );
  }

  if (migrationState.status === 'failed') {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <MigrationErrorScreen
          error={migrationState.error}
          onRetry={runBoot}
          onRestore={handleRestore}
        />
      </SafeAreaProvider>
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
