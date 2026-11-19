import { Inject, Injectable, Logger } from '@nestjs/common';

import { COMPROBANTES_PORT, ComprobantesPort, LOTES_PORT, LoteGuardado, LotesPort, SRI_PORT, SriPort } from '../domain/puertos';
import { Autorizacion, ComprobanteEnviado } from '../domain/modelo';
import { estadoDeAutorizacion } from '../domain/interpretacion';
import { LoteNoEncontradoError, SriNoDisponibleError } from '../domain/errores';

export interface ResumenConsulta {
  empresaRuc: string;
  lotesConsultados: number;
  comprobantes: Array<{ claveAcceso: string; via: string; resultado: string; fechaAutorizacion: string | null; mensaje: string | null }>;
  error: string | null;
}

@Injectable()
export class ConsultarAutorizacionesService {
  private readonly logger = new Logger(ConsultarAutorizacionesService.name);

  constructor(
    @Inject(SRI_PORT) private readonly sri: SriPort,
    @Inject(COMPROBANTES_PORT) private readonly comprobantes: ComprobantesPort,
    @Inject(LOTES_PORT) private readonly lotes: LotesPort,
  ) {}

  async consultar(empresaRuc: string, esperasSegundos?: number[]): Promise<ResumenConsulta> {
    const resumen: ResumenConsulta = { empresaRuc, lotesConsultados: 0, comprobantes: [], error: null };
    const enviados = await this.comprobantes.enviados(empresaRuc);
    const porClave = new Map(enviados.map((c) => [c.claveAcceso, c]));
    const toca = (consultas: number, referencia: Date | null) => {
      if (!esperasSegundos || !referencia) return true;
      const espera = esperasSegundos[Math.min(consultas, esperasSegundos.length - 1)];
      return Date.now() >= new Date(referencia).getTime() + espera * 1000;
    };

    try {
      for (const lote of await this.lotes.recibidos(empresaRuc)) {
        if (!toca(lote.sri.autorizacion.consultas, lote.sri.autorizacion.ultimaConsultaEn ?? lote.sri.recepcion.respondidoEn)) {
          lote.comprobantes.forEach((c) => porClave.delete(c.claveAcceso));
          continue;
        }
        const respuesta = await this.sri.autorizacionLote(lote.ambiente, lote.claveLote);
        resumen.lotesConsultados++;
        const porClaveRespuesta = new Map(respuesta.autorizaciones.filter((a) => a.claveAcceso).map((a) => [a.claveAcceso!, a]));

        for (const item of lote.comprobantes.filter((c) => c.estado === 'ENVIADO')) {
          const comprobante = porClave.get(item.claveAcceso);
          if (!comprobante) {
            item.estado = 'RESUELTO';
            continue;
          }
          const autorizacion = porClaveRespuesta.get(item.claveAcceso);
          if (!autorizacion) continue;
          item.estado = await this.aplicar(comprobante, autorizacion, `lote ${lote.claveLote}`, resumen);
          porClave.delete(item.claveAcceso);
        }
        await this.lotes.registrarConsulta(lote.claveLote, respuesta.numeroComprobantes, lote.comprobantes, this.estadoLote(lote));
      }

      for (const comprobante of porClave.values()) {
        if (!toca(comprobante.consultas, comprobante.referencia)) continue;
        const respuesta = await this.sri.autorizacion(comprobante.ambiente, comprobante.claveAcceso);
        const autorizacion = respuesta.autorizaciones.find((a) => !a.claveAcceso || a.claveAcceso === comprobante.claveAcceso);
        await this.aplicar(comprobante, autorizacion, 'individual', resumen);
      }
    } catch (error) {
      if (!(error instanceof SriNoDisponibleError)) throw error;
      resumen.error = error.message;
    }
    return resumen;
  }

  async lote(claveLote: string): Promise<LoteGuardado> {
    const lote = await this.lotes.obtener(claveLote);
    if (!lote) throw new LoteNoEncontradoError(`No existe el lote ${claveLote}.`);
    return lote;
  }

  private async aplicar(
    comprobante: ComprobanteEnviado,
    autorizacion: Autorizacion | undefined,
    via: string,
    resumen: ResumenConsulta,
  ): Promise<string> {
    const estado = estadoDeAutorizacion(autorizacion);
    const mensaje = autorizacion?.mensajes.map((m) => `${m.identificador} ${m.mensaje} ${m.informacionAdicional ?? ''}`.trim()).join('; ') || null;

    if (estado === 'PENDIENTE') {
      await this.comprobantes.anotarConsulta(comprobante);
      resumen.comprobantes.push({ claveAcceso: comprobante.claveAcceso, via, resultado: 'PENDIENTE', fechaAutorizacion: null, mensaje });
      return 'ENVIADO';
    }

    await this.comprobantes.marcarAutorizacion(comprobante, {
      estado,
      numero: autorizacion!.numeroAutorizacion,
      fecha: autorizacion!.fechaAutorizacion,
      mensajes: autorizacion!.mensajes,
    });
    resumen.comprobantes.push({ claveAcceso: comprobante.claveAcceso, via, resultado: estado, fechaAutorizacion: autorizacion!.fechaAutorizacion, mensaje });
    this.logger.log(JSON.stringify({ evento: 'autorizacion_consultada', claveAcceso: comprobante.claveAcceso, via, resultado: estado }));
    return estado;
  }

  private estadoLote(lote: LoteGuardado) {
    return lote.comprobantes.every((c) => c.estado !== 'ENVIADO') ? ('COMPLETADO' as const) : ('RECIBIDO' as const);
  }
}
