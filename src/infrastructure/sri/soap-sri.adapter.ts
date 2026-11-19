import { SriPort } from '../../domain/puertos';
import { Ambiente, RespuestaAutorizacion } from '../../domain/modelo';
import { leerRespuestaAutorizacion } from '../../domain/respuestas-sri';
import { SriNoDisponibleError } from '../../domain/errores';

const HOST: Record<Ambiente, string> = {
  1: 'https://celcer.sri.gob.ec',
  2: 'https://cel.sri.gob.ec',
};

export class SoapSriAdapter implements SriPort {
  constructor(private readonly timeoutMs: number) {}

  async autorizacion(ambiente: Ambiente, claveAcceso: string): Promise<RespuestaAutorizacion> {
    const cuerpo =
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">' +
      `<soapenv:Header/><soapenv:Body><ec:autorizacionComprobante><claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>` +
      '</ec:autorizacionComprobante></soapenv:Body></soapenv:Envelope>';
    return leerRespuestaAutorizacion(await this.post(ambiente, 'AutorizacionComprobantesOffline', cuerpo));
  }

  async autorizacionLote(ambiente: Ambiente, claveLote: string): Promise<RespuestaAutorizacion> {
    const cuerpo =
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">' +
      `<soapenv:Header/><soapenv:Body><ec:autorizacionComprobanteLote><claveAccesoLote>${claveLote}</claveAccesoLote>` +
      '</ec:autorizacionComprobanteLote></soapenv:Body></soapenv:Envelope>';
    return leerRespuestaAutorizacion(await this.post(ambiente, 'AutorizacionComprobantesOffline', cuerpo));
  }

  private async post(ambiente: Ambiente, servicio: string, cuerpo: string): Promise<string> {
    const url = `${HOST[ambiente]}/comprobantes-electronicos-ws/${servicio}`;
    let respuesta: Response;
    try {
      respuesta = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: '""' },
        body: cuerpo,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new SriNoDisponibleError(`No se pudo conectar con ${servicio} (${HOST[ambiente]}): ${(error as Error).message}`);
    }

    const texto = await respuesta.text();
    if (!respuesta.ok && !texto.includes('Envelope')) {
      throw new SriNoDisponibleError(`${servicio} respondio HTTP ${respuesta.status}.`);
    }
    return texto;
  }
}
