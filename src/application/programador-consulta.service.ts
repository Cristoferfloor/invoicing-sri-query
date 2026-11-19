import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';

import { COMPROBANTES_PORT, ComprobantesPort } from '../domain/puertos';
import { ConsultarAutorizacionesService } from './consultar-autorizaciones.service';

export const CONFIGURACION_CONSULTA_AUTOMATICA = Symbol('CONFIGURACION_CONSULTA_AUTOMATICA');

export interface ConfiguracionConsultaAutomatica {
  activo: boolean;
  pulsoMs: number;
  esperasConsultaSegundos: number[];
}

@Injectable()
export class ProgramadorConsultaService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ProgramadorConsultaService.name);
  private temporizador?: NodeJS.Timeout;
  private ocupado = false;

  constructor(
    private readonly consulta: ConsultarAutorizacionesService,
    @Inject(COMPROBANTES_PORT) private readonly comprobantes: ComprobantesPort,
    @Inject(CONFIGURACION_CONSULTA_AUTOMATICA) private readonly config: ConfiguracionConsultaAutomatica,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.activo) return;
    this.temporizador = setInterval(() => void this.pulso(), this.config.pulsoMs);
    this.logger.log(JSON.stringify({
      evento: 'consulta_automatica_activa', esperasConsultaSegundos: this.config.esperasConsultaSegundos,
    }));
  }

  onApplicationShutdown(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  private async pulso(): Promise<void> {
    if (this.ocupado) return;
    this.ocupado = true;
    try {
      for (const empresaId of await this.comprobantes.empresasConEnviados()) {
        const r = await this.consulta.consultar(empresaId, this.config.esperasConsultaSegundos);
        if (r.comprobantes.length === 0 && !r.error) continue;
        this.logger.log(JSON.stringify({
          evento: 'consulta_automatica', empresaId, lotesConsultados: r.lotesConsultados,
          resultados: r.comprobantes.reduce<Record<string, number>>((a, c) => ({ ...a, [c.resultado]: (a[c.resultado] ?? 0) + 1 }), {}),
          error: r.error,
        }));
      }
    } catch (error) {
      this.logger.error(JSON.stringify({ evento: 'pulso_consulta_fallido', error: (error as Error).message }));
    } finally {
      this.ocupado = false;
    }
  }
}
