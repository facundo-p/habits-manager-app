import './global.css';

import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Merriweather_700Bold } from '@expo-google-fonts/merriweather';
import { Lato_400Regular } from '@expo-google-fonts/lato';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarCheck, BookOpen, BarChart3 } from 'lucide-react-native';

import { AppBackground } from './src/components/layout/AppBackground';
import { DailySheetScreen } from './src/screens/DailySheetScreen';
import { HabitLibraryScreen } from './src/screens/HabitLibraryScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { ROUTES } from './src/config/constants';
import { tabBarTheme, iconDefaults, colors } from './src/styles/ui.styles';
import { initDatabase } from './src/services/db';
import type { RootTabParamList } from './src/types';

const Tab = createBottomTabNavigator<RootTabParamList>();

/**
 * Estilos nativos para la pantalla de carga.
 * NO usar NativeWind aquí — puede no estar listo aún al primer render.
 */
const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.amber50,
  },
});

function TabIcon(Icon: typeof CalendarCheck, color: string) {
  return <Icon color={color} size={iconDefaults.size} strokeWidth={iconDefaults.strokeWidth} />;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Merriweather_700Bold,
    Lato_400Regular,
  });

  useEffect(() => {
    initDatabase()
      .then(() => console.log('DB inicializada correctamente'))
      .catch((err) => console.error('Error inicializando DB:', err));
  }, []);

  useEffect(() => {
    if (fontError) {
      console.error('Error cargando fuentes:', fontError);
    }
  }, [fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" color={colors.amber600} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppBackground>
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
        </AppBackground>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
