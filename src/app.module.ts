import { DynamicModule, Inject, Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { MongoClient } from 'mongodb';

import { ConsultarAutorizacionesService } from './application/consultar-autorizaciones.service';
import { CONFIGURACION_CONSULTA_AUTOMATICA, ProgramadorConsultaService } from './application/programador-consulta.service';
import { COMPROBANTES_PORT, LOTES_PORT, SRI_PORT } from './domain/puertos';
import { SoapSriAdapter } from './infrastructure/sri/soap-sri.adapter';
import { MongoComprobantesRepository } from './infrastructure/mongo/mongo-comprobantes.repository';
import { MongoLotesRepository } from './infrastructure/mongo/mongo-lotes.repository';
import { ConsultasController } from './infrastructure/rest/consultas.controller';
import { SaludController } from './infrastructure/rest/salud.controller';
import { TOKEN_ADMIN, TokenAdminGuard } from './infrastructure/rest/token-admin.guard';

const MONGO = Symbol('MONGO');

@Module({})
export class AppModule implements OnModuleInit, OnApplicationShutdown {
  constructor(
    @Inject(MONGO) private readonly mongo: MongoClient,
    @Inject(LOTES_PORT) private readonly lotes: MongoLotesRepository,
  ) {}

  static registrar(env: NodeJS.ProcessEnv): DynamicModule {
    if (!env.SRI_QUERY_MONGO_URL) throw new Error('Falta SRI_QUERY_MONGO_URL.');
    if (!env.SRI_QUERY_ADMIN_TOKEN) throw new Error('Falta SRI_QUERY_ADMIN_TOKEN.');

    const mongo = new MongoClient(env.SRI_QUERY_MONGO_URL);
    const db = mongo.db('invoicing');

    return {
      module: AppModule,
      controllers: [ConsultasController, SaludController],
      providers: [
        ConsultarAutorizacionesService,
        ProgramadorConsultaService,
        TokenAdminGuard,
        {
          provide: CONFIGURACION_CONSULTA_AUTOMATICA,
          useValue: {
            activo: env.SRI_QUERY_AUTO === 'true',
            pulsoMs: Number(env.SRI_QUERY_PULSE_MS ?? 3000),
            esperasConsultaSegundos: (env.SRI_QUERY_WAITS_SEC ?? '3,10,30,60,120,300,600,1800').split(',').map(Number),
          },
        },
        { provide: MONGO, useValue: mongo },
        { provide: TOKEN_ADMIN, useValue: env.SRI_QUERY_ADMIN_TOKEN },
        { provide: SRI_PORT, useValue: new SoapSriAdapter(Number(env.SRI_TIMEOUT_MS ?? 60000)) },
        { provide: COMPROBANTES_PORT, useValue: new MongoComprobantesRepository(db) },
        { provide: LOTES_PORT, useValue: new MongoLotesRepository(db) },
      ],
    };
  }

  async onModuleInit(): Promise<void> {
    await this.mongo.connect();
    await this.lotes.prepararIndices();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.mongo.close();
  }
}
