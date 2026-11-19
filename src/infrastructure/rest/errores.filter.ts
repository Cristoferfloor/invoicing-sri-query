import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

import { ErrorConsultaSri } from '../../domain/errores';

const ESTADO_HTTP: Record<string, HttpStatus> = {
  LOTE_NO_ENCONTRADO: HttpStatus.NOT_FOUND,
  SRI_NO_DISPONIBLE: HttpStatus.SERVICE_UNAVAILABLE,
  RESPUESTA_SRI_ILEGIBLE: HttpStatus.BAD_GATEWAY,
};

@Catch(ErrorConsultaSri)
export class ErroresFilter implements ExceptionFilter<ErrorConsultaSri> {
  catch(error: ErrorConsultaSri, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(ESTADO_HTTP[error.codigo] ?? HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ estado: 'RECHAZADO', error: error.codigo, mensaje: error.message });
  }
}
