# invoicing-sri-query

Consulta ante el SRI el estado de autorización de los comprobantes ya enviados.

Parte de la facturación electrónica V2 para el SRI de Ecuador. NestJS + TypeScript.

## Puerto

`3005` — `GET /salud` devuelve el estado del servicio.

## Arranque

```bash
cp .env.example .env    # completar los valores
npm ci
npm run build
npm run start:prod
```

Antes hay que levantar la red y las bases de
[invoicing-infrastructure](https://github.com/Cristoferfloor/invoicing-infrastructure).
