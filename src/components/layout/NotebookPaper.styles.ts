/**
 * NotebookPaper.styles.ts — Estilos del componente de papel con anillado espiral realista.
 *
 * Las anillas metálicas se generan dinámicamente según el alto del contenedor.
 * Usa LinearGradient de expo-linear-gradient para simular metal.
 * Incluye línea de margen roja y sombra sutil en el lado izquierdo.
 */

import { StyleSheet } from 'react-native';
import { colors } from '../../styles/ui.styles';

// ─── Constantes de diseño ────────────────────────────────────────────

/** Espacio en px entre centros de anillas. Determina cuántas se renderizan. */
export const RING_SPACING = 30;

/** Ancho de cada anilla (óvalo horizontal) */
const RING_WIDTH = 18;

/** Alto de cada anilla */
const RING_HEIGHT = 13;

/** Cuánto sobresalen las anillas por fuera del borde del papel */
const RING_PROTRUSION = 8;

/** Colores del degradado metálico (de claro a oscuro, diagonal) */
export const RING_GRADIENT_COLORS = ['#FAF9F6', '#EFECE7', '#D6D0C9', '#B8B0A8'];

/** Dirección del degradado (esquina sup-izq → inf-der) */
export const RING_GRADIENT_START = { x: 0.15, y: 0 };
export const RING_GRADIENT_END = { x: 0.85, y: 1 };

/** Color de fondo del papel */
const PAPER_BG = 'rgba(254, 252, 243, 0.92)';

/** Color de la línea de margen roja (tenue) */
const MARGIN_LINE_COLOR = 'rgba(244, 63, 94, 0.20)';

/** Posición X de la línea de margen (después de la zona de anillas) */
const MARGIN_LINE_LEFT = 20;

// ─── Native styles ──────────────────────────────────────────────────

export const nativeStyles = StyleSheet.create({
  /** Contenedor exterior. overflow visible para que las anillas sobresalgan. */
  container: {
    position: 'relative',
    marginLeft: RING_PROTRUSION,
    overflow: 'visible',
  },

  /** Superficie del papel con padding izquierdo amplio (~45px). */
  paper: {
    backgroundColor: PAPER_BG,
    borderRadius: 16,
    paddingTop: 20,
    paddingBottom: 20,
    paddingRight: 20,
    paddingLeft: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.amber100,
    // Sombra general del papel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },

  /** Sombra sutil donde el papel se une con las anillas (borde izquierdo). */
  bindingShadow: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 34,
    backgroundColor: 'rgba(120, 113, 108, 0.025)', // stone-500 muy tenue
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },

  /** Línea vertical roja tipo margen de cuaderno. */
  marginLine: {
    position: 'absolute',
    left: MARGIN_LINE_LEFT,
    top: 14,
    bottom: 14,
    width: 1,
    backgroundColor: MARGIN_LINE_COLOR,
  },

  /** Columna invisible que contiene las anillas, centrada en el borde izquierdo. */
  ringsColumn: {
    position: 'absolute',
    left: -(RING_WIDTH / 2),
    top: 22,
    bottom: 22,
    width: RING_WIDTH,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    zIndex: 10,
  },

  /** Contenedor de una anilla individual (óvalo). */
  ringOuter: {
    width: RING_WIDTH,
    height: RING_HEIGHT,
    borderRadius: RING_HEIGHT / 2,
    overflow: 'hidden',
    // Sombra metálica
    shadowColor: '#52525b',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },

  /** Gradiente que rellena la anilla. */
  ringGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /** Hueco interior de la anilla (simula el alambre hueco). */
  ringInner: {
    width: RING_WIDTH - 6,
    height: RING_HEIGHT - 6,
    borderRadius: (RING_HEIGHT - 6) / 2,
    backgroundColor: PAPER_BG,
  },

  /** Reflejo metálico superior (línea brillante en la anilla). */
  ringHighlight: {
    position: 'absolute',
    top: 1.5,
    left: 5,
    right: 5,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
});
