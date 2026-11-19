import { Db } from 'mongodb';

import { ComprobantesPort } from '../../domain/puertos';
import { Ambiente, ComprobanteEnviado, MensajeSri } from '../../domain/modelo';

type Doc = Record<string, any>;
type DocComprobante = { _id: string } & Doc;

export class MongoComprobantesRepository implements ComprobantesPort {
  constructor(private readonly db: Db) {}

  private get col() {
    return this.db.collection<DocComprobante>('comprobantes');
  }

  async empresasConEnviados(): Promise<string[]> {
    return (await this.col.distinct('empresaId', { estado: 'ENVIADO' })) as string[];
  }

  async enviados(empresaId: string): Promise<ComprobanteEnviado[]> {
    const docs = await this.col.find({ empresaId, estado: 'ENVIADO' }).project({ 'intentos.archivos': 0, 'intentos.datos': 0 }).toArray();
    return docs.flatMap((d) => {
      const intento = this.intentoActual(d);
      if (!intento) return [];
      return [{
        id: d._id, empresaId: d.empresaId, ambiente: d.ambiente as Ambiente, intento: intento.numero,
        claveAcceso: intento.claveAcceso, modo: intento.envio?.modo ?? 'INDIVIDUAL', claveLote: intento.envio?.claveLote ?? null,
        consultas: intento.sri?.autorizacion?.consultas ?? 0,
        referencia: intento.sri?.autorizacion?.ultimaConsultaEn ?? intento.envio?.enviadoEn ?? d.actualizadoEn,
      }];
    });
  }

  async marcarAutorizacion(
    c: { id: string; intento: number },
    r: { estado: 'AUTORIZADO' | 'NO_AUTORIZADO'; numero: string | null; fecha: string | null; mensajes: MensajeSri[] },
  ): Promise<boolean> {
    const set: Doc = {
      'intentos.$[i].sri.autorizacion.estado': r.estado === 'AUTORIZADO' ? 'AUTORIZADO' : 'NO AUTORIZADO',
      'intentos.$[i].sri.autorizacion.fecha': r.fecha,
      'intentos.$[i].sri.autorizacion.mensajes': r.mensajes,
    };
    if (r.estado === 'AUTORIZADO') set['intentos.$[i].autorizacion'] = { numero: r.numero, fecha: r.fecha };
    const ahora = new Date();
    const resultado = await this.col.updateOne(
      { _id: c.id, estado: 'ENVIADO' },
      {
        $set: { estado: r.estado, actualizadoEn: ahora, 'intentos.$[i].estado': r.estado, ...set },
        $push: { 'intentos.$[i].historial': { estado: r.estado, fecha: ahora, servicio: 'consulta-sri' } } as Doc,
        $inc: { 'intentos.$[i].sri.autorizacion.consultas': 1 },
      },
      { arrayFilters: [{ 'i.numero': c.intento }] },
    );
    return resultado.modifiedCount === 1;
  }

  async anotarConsulta(c: { id: string; intento: number }): Promise<void> {
    await this.col.updateOne(
      { _id: c.id, estado: 'ENVIADO' },
      { $inc: { 'intentos.$[i].sri.autorizacion.consultas': 1 }, $set: { 'intentos.$[i].sri.autorizacion.ultimaConsultaEn': new Date() } as Doc },
      { arrayFilters: [{ 'i.numero': c.intento }] },
    );
  }

  private intentoActual(d: Doc): Doc | undefined {
    return (d.intentos as Doc[] | undefined)?.find((i) => i.numero === d.intentoActual);
  }
}
