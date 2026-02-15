import React from 'react';
import { ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BACKGROUND_IMAGE_URI, BLUR_INTENSITY, BLUR_TINT } from '../../config/constants';
import { styles, nativeStyles } from './AppBackground.styles';

interface AppBackgroundProps {
  children: React.ReactNode;
}

export function AppBackground({ children }: AppBackgroundProps) {
  return (
    <ImageBackground
      source={{ uri: BACKGROUND_IMAGE_URI }}
      resizeMode="cover"
      style={nativeStyles.image}
    >
      <BlurView
        intensity={BLUR_INTENSITY}
        tint={BLUR_TINT}
        style={nativeStyles.blur}
      >
        <SafeAreaView className={styles.safeArea}>
          {children}
        </SafeAreaView>
      </BlurView>
    </ImageBackground>
  );
}
