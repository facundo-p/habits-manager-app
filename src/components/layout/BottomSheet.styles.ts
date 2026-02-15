/**
 * BottomSheet.styles.ts — Estilos del componente shell de modal inferior.
 */

import { overlay } from '../../styles/ui.styles';

export const styles = {
  /** Fondo oscuro con justify-end para empujar el sheet abajo */
  backdrop: overlay.backdrop,

  /** Contenedor del sheet con bordes redondeados superiores */
  sheet: `${overlay.content} mb-6`,
} as const;
