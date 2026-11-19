import { Db } from 'mongodb';

import { ComprobanteDelLote, LoteGuardado, LotesPort } from '../../domain/puertos';
import { EstadoLote } from '../../domain/modelo';

type Doc = { _id: string } & Record<string, any>;

export class MongoLotesRepository implements LotesPort {
  constructor(private readonly db: Db) {}

  private get col() {
    return this.db.collection<Doc>('lotes');
  }

  async prepararIndices(): Promise<void> {
    await this.col.createIndex({ empresaId: 1, estado: 1, creadoEn: -1 }, { name: 'por_empresa_y_estado' });
  }

  async registrarConsulta(claveLote: string, numeroComprobantesLote: number, comprobantes: ComprobanteDelLote[], estado: EstadoLote): Promise<void> {
    await this.col.updateOne(
      { _id: claveLote },
      {
        $set: {
          estado, comprobantes, actualizadoEn: new Date(),
          'sri.autorizacion.numeroComprobantesLote': numeroComprobantesLote,
          'sri.autorizacion.ultimaConsultaEn': new Date(),
        },
        $inc: { 'sri.autorizacion.consultas': 1 },
      },
    );
  }

  async obtener(claveLote: string): Promise<LoteGuardado | null> {
    const doc = await this.col.findOne({ _id: claveLote });
    return doc ? this.aModelo(doc) : null;
  }

  async recibidos(empresaId: string): Promise<LoteGuardado[]> {
    const docs = await this.col.find({ empresaId, estado: 'RECIBIDO' }).sort({ creadoEn: 1 }).toArray();
    return docs.map((d) => this.aModelo(d));
  }

  private aModelo(d: Doc): LoteGuardado {
    const { _id, ...resto } = d;
    return { claveLote: _id, ...resto } as LoteGuardado;
  }
}
