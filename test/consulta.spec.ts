import { leerRespuestaAutorizacion } from '../src/domain/respuestas-sri';
import { estadoDeAutorizacion } from '../src/domain/interpretacion';
import { ConsultarAutorizacionesService } from '../src/application/consultar-autorizaciones.service';
import { ComprobantesPort, LoteGuardado, LotesPort, SriPort } from '../src/domain/puertos';
import { ComprobanteEnviado } from '../src/domain/modelo';

describe('respuestas de autorizacion', () => {
  const clave = '1609202601239062547500110010019000000010000000111';

  it('lee una autorizacion por lote con el comprobante escapado', () => {
    const xml = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:autorizacionComprobanteLoteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionLote><claveAccesoLoteConsultada>x</claveAccesoLoteConsultada><numeroComprobantesLote>1</numeroComprobantesLote><autorizaciones><autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>${clave}</numeroAutorizacion><fechaAutorizacion>2026-09-16T10:00:00-05:00</fechaAutorizacion><ambiente>PRUEBAS</ambiente><comprobante>&lt;factura&gt;&lt;infoTributaria&gt;&lt;claveAcceso&gt;${clave}&lt;/claveAcceso&gt;&lt;/infoTributaria&gt;&lt;/factura&gt;</comprobante><mensajes/></autorizacion></autorizaciones></RespuestaAutorizacionLote></ns2:autorizacionComprobanteLoteResponse></soap:Body></soap:Envelope>`;
    const respuesta = leerRespuestaAutorizacion(xml);
    expect(respuesta.numeroComprobantes).toBe(1);
    expect(respuesta.autorizaciones[0]).toMatchObject({ claveAcceso: clave, estado: 'AUTORIZADO', numeroAutorizacion: clave });
    expect(estadoDeAutorizacion(respuesta.autorizaciones[0])).toBe('AUTORIZADO');
  });

  it('cero comprobantes es "todavia no", nunca rechazado', () => {
    const xml = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante><claveAccesoConsultada>${clave}</claveAccesoConsultada><numeroComprobantes>0</numeroComprobantes><autorizaciones/></RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse></soap:Body></soap:Envelope>`;
    const respuesta = leerRespuestaAutorizacion(xml);
    expect(respuesta.numeroComprobantes).toBe(0);
    expect(estadoDeAutorizacion(respuesta.autorizaciones[0])).toBe('PENDIENTE');
  });
});

describe('consulta: el lote no trae la factura', () => {
  it('la consulta individualmente en vez de dejarla ENVIADO para siempre', async () => {
    const enviado = (clave: string): ComprobanteEnviado => ({
      id: clave, empresaId: '2390625475001', ambiente: 2, intento: 1, claveAcceso: clave,
      modo: 'LOTE', claveLote: 'LOTE', consultas: 0, referencia: new Date(0),
    });
    const lote: LoteGuardado = {
      claveLote: 'LOTE', empresaId: '2390625475001', tipo: '01', ambiente: 2, estado: 'RECIBIDO', tamanoBytes: 1,
      comprobantes: [{ comprobanteId: 'A', claveAcceso: 'A', estado: 'ENVIADO' }, { comprobanteId: 'B', claveAcceso: 'B', estado: 'ENVIADO' }],
      sri: { recepcion: { estado: 'DEVUELTA', mensajes: [], respondidoEn: new Date(0) }, autorizacion: { consultas: 0, numeroComprobantesLote: 0, ultimaConsultaEn: null } },
      creadoEn: new Date(0), actualizadoEn: new Date(0),
    };
    const autorizados: string[] = [];

    const sri: SriPort = {
      autorizacionLote: jest.fn().mockResolvedValue({ numeroComprobantes: 0, autorizaciones: [] }),
      autorizacion: jest.fn().mockImplementation(async (_a: number, clave: string) => ({
        numeroComprobantes: 1,
        autorizaciones: [{ claveAcceso: clave, estado: 'AUTORIZADO', numeroAutorizacion: clave, fechaAutorizacion: '2026-09-16T15:35:06-05:00', mensajes: [] }],
      })),
    };
    const comprobantes = {
      enviados: jest.fn().mockResolvedValue([enviado('A'), enviado('B')]),
      marcarAutorizacion: jest.fn().mockImplementation(async (c: { id: string }) => { autorizados.push(c.id); return true; }),
      anotarConsulta: jest.fn(),
      empresasConEnviados: jest.fn(),
    } as unknown as ComprobantesPort;
    const lotes = {
      recibidos: jest.fn().mockResolvedValue([lote]),
      registrarConsulta: jest.fn(),
      obtener: jest.fn(),
    } as unknown as LotesPort;

    const resumen = await new ConsultarAutorizacionesService(sri, comprobantes, lotes).consultar('2390625475001', [3]);

    expect(sri.autorizacionLote).toHaveBeenCalledTimes(1);
    expect(sri.autorizacion).toHaveBeenCalledTimes(2);
    expect(autorizados.sort()).toEqual(['A', 'B']);
    expect(resumen.comprobantes.map((c) => c.via)).toEqual(['individual', 'individual']);
  });
});
