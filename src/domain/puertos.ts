import { Ambiente, ComprobanteEnviado, EstadoLote, MensajeSri, RespuestaAutorizacion } from './modelo';

export const SRI_PORT = Symbol('SRI_PORT');
export const COMPROBANTES_PORT = Symbol('COMPROBANTES_PORT');
export const LOTES_PORT = Symbol('LOTES_PORT');

export interface SriPort {
  autorizacion(ambiente: Ambiente, claveAcceso: string): Promise<RespuestaAutorizacion>;
  autorizacionLote(ambiente: Ambiente, claveLote: string): Promise<RespuestaAutorizacion>;
}

export interface ComprobantesPort {
  empresasConEnviados(): Promise<string[]>;
  enviados(empresaId: string): Promise<ComprobanteEnviado[]>;
  marcarAutorizacion(
    c: { id: string; intento: number },
    resultado: { estado: 'AUTORIZADO' | 'NO_AUTORIZADO'; numero: string | null; fecha: string | null; mensajes: MensajeSri[] },
  ): Promise<boolean>;
  anotarConsulta(c: { id: string; intento: number }): Promise<void>;
}

export interface ComprobanteDelLote {
  comprobanteId: string;
  claveAcceso: string;
  estado: string;
}

export interface LoteGuardado {
  claveLote: string;
  empresaId: string;
  tipo: string;
  ambiente: Ambiente;
  estado: EstadoLote;
  comprobantes: ComprobanteDelLote[];
  tamanoBytes: number;
  sri: {
    recepcion: { estado: string | null; mensajes: MensajeSri[]; respondidoEn: Date | null };
    autorizacion: { consultas: number; numeroComprobantesLote: number; ultimaConsultaEn: Date | null };
  };
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface LotesPort {
  registrarConsulta(claveLote: string, numeroComprobantesLote: number, comprobantes: ComprobanteDelLote[], estado: EstadoLote): Promise<void>;
  obtener(claveLote: string): Promise<LoteGuardado | null>;
  recibidos(empresaId: string): Promise<LoteGuardado[]>;
}
