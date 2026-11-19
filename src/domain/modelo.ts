export type Ambiente = 1 | 2;

export interface MensajeSri {
  identificador: string;
  mensaje: string;
  informacionAdicional: string | null;
  tipo: string;
}

export interface ComprobanteEnviado {
  id: string;
  empresaId: string;
  ambiente: Ambiente;
  intento: number;
  claveAcceso: string;
  modo: 'LOTE' | 'INDIVIDUAL';
  claveLote: string | null;
  consultas: number;
  referencia: Date;
}

export interface Autorizacion {
  claveAcceso: string | null;
  estado: string;
  numeroAutorizacion: string | null;
  fechaAutorizacion: string | null;
  mensajes: MensajeSri[];
}

export interface RespuestaAutorizacion {
  numeroComprobantes: number;
  autorizaciones: Autorizacion[];
}

export type EstadoLote = 'CREADO' | 'NO_ENVIADO' | 'NO_RECONOCIDO' | 'RECIBIDO' | 'DEVUELTO' | 'COMPLETADO';
