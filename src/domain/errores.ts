export abstract class ErrorConsultaSri extends Error {
  abstract readonly codigo: string;

  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class SriNoDisponibleError extends ErrorConsultaSri {
  readonly codigo = 'SRI_NO_DISPONIBLE';
}

export class RespuestaSriIlegibleError extends ErrorConsultaSri {
  readonly codigo = 'RESPUESTA_SRI_ILEGIBLE';
}

export class LoteNoEncontradoError extends ErrorConsultaSri {
  readonly codigo = 'LOTE_NO_ENCONTRADO';
}
