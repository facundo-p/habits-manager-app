/**
 * NotebookPaper — Contenedor estilo cuaderno con anillado espiral metálico.
 *
 * Las anillas se generan dinámicamente según el alto del contenedor
 * usando LinearGradient para simular metal pulido.
 * Incluye línea roja de margen y sombra sutil en el borde de encuadernación.
 */

import React, { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  nativeStyles,
  RING_SPACING,
  RING_GRADIENT_COLORS,
  RING_GRADIENT_START,
  RING_GRADIENT_END,
} from './NotebookPaper.styles';

interface NotebookPaperProps {
  children: React.ReactNode;
}

/** Cantidad de anillas por defecto antes de medir el alto. */
const DEFAULT_RING_COUNT = 5;

export function NotebookPaper({ children }: NotebookPaperProps) {
  const [ringCount, setRingCount] = useState(DEFAULT_RING_COUNT);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    const count = Math.max(3, Math.floor((h - 44) / RING_SPACING));
    setRingCount(count);
  }, []);

  return (
    <View style={nativeStyles.container}>
      <View style={nativeStyles.paper} onLayout={handleLayout}>
        <BindingShadow />
        <MarginLine />
        {children}
      </View>
      <SpiralRings count={ringCount} />
    </View>
  );
}

// ─── Sub-componentes internos ────────────────────────────────────────

/** Sombra sutil en el borde izquierdo del papel. */
function BindingShadow() {
  return <View style={nativeStyles.bindingShadow} />;
}

/** Línea vertical roja de margen. */
function MarginLine() {
  return <View style={nativeStyles.marginLine} />;
}

/** Columna de anillas espiral, posicionada sobre el borde izquierdo del papel. */
function SpiralRings({ count }: { count: number }) {
  return (
    <View style={nativeStyles.ringsColumn}>
      {Array.from({ length: count }, (_, i) => (
        <MetallicRing key={i} />
      ))}
    </View>
  );
}

/**
 * Anilla metálica individual.
 * Un óvalo con degradado gris claro→oscuro (LinearGradient)
 * y un hueco interior color papel para simular alambre hueco.
 * Incluye un reflejo brillante superior para efecto 3D.
 */
function MetallicRing() {
  return (
    <View style={nativeStyles.ringOuter}>
      <LinearGradient
        colors={RING_GRADIENT_COLORS}
        start={RING_GRADIENT_START}
        end={RING_GRADIENT_END}
        style={nativeStyles.ringGradient}
      >
        <View style={nativeStyles.ringInner} />
      </LinearGradient>
      <View style={nativeStyles.ringHighlight} />
    </View>
  );
}
