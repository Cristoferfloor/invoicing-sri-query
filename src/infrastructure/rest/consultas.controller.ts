import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Matches } from 'class-validator';

import { ConsultarAutorizacionesService } from '../../application/consultar-autorizaciones.service';
import { TokenAdminGuard } from './token-admin.guard';

export class EmpresaDto {
  @Matches(/^\d{10}00[1-9]$/, { message: 'empresaRuc debe ser un RUC de 13 digitos.' })
  empresaRuc!: string;
}

@Controller('v1')
@UseGuards(TokenAdminGuard)
export class ConsultasController {
  constructor(private readonly consulta: ConsultarAutorizacionesService) {}

  @Post('consultas')
  @HttpCode(HttpStatus.OK)
  consultar(@Body() cuerpo: EmpresaDto) {
    return this.consulta.consultar(cuerpo.empresaRuc);
  }

  @Get('lotes/:claveLote')
  lote(@Param('claveLote') claveLote: string) {
    return this.consulta.lote(claveLote);
  }
}
