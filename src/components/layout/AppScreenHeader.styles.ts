/**
 * AppScreenHeader.styles.ts — Header reutilizable para pantallas con disposición horizontal.
 */
import { text, button } from '../../styles/ui.styles';

export const styles = {
  // El container es la fila principal
  container: 'flex-row items-center justify-between mb-4 px-1',
  
  // Slots laterales con ancho fijo para que el centro sea predecible
  leftSlot: 'w-10 justify-center',
  rightSlot: 'w-10 items-end justify-center',
  
  // El centro crece para ocupar todo el espacio
  centerSlot: 'flex-1 px-2 items-center justify-center',
  
  iconButton: button.iconSmall + ' bg-amber-100/80', // Un toque de transparencia cozy
  
  // Ajustamos un poco el tamaño si es necesario para que quepa en una línea
  title: text.titleLarge + ' leading-tight', 
  subtitle: text.caption + ' opacity-70',
} as const;