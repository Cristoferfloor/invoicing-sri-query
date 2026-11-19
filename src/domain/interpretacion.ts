import { Autorizacion } from './modelo';

export type EstadoAutorizacion = 'AUTORIZADO' | 'NO_AUTORIZADO' | 'PENDIENTE';

export function estadoDeAutorizacion(autorizacion: Autorizacion | undefined): EstadoAutorizacion {
  if (!autorizacion) return 'PENDIENTE';
  if (autorizacion.estado === 'AUTORIZADO') return 'AUTORIZADO';
  if (autorizacion.estado === 'NO AUTORIZADO') return 'NO_AUTORIZADO';
  return 'PENDIENTE';
}
