import { DOMParser } from '@xmldom/xmldom';

import { Autorizacion, MensajeSri, RespuestaAutorizacion } from './modelo';
import { RespuestaSriIlegibleError } from './errores';

type Nodo = { nodeType: number; localName?: string | null; nodeName: string; childNodes: { length: number; item(i: number): Nodo | null }; textContent: string | null };

function leer(xml: string): Nodo {
  try {
    const documento = new DOMParser().parseFromString(xml, 'text/xml');
    return documento.documentElement as unknown as Nodo;
  } catch (error) {
    throw new RespuestaSriIlegibleError(`El SRI respondio algo que no es XML: ${(error as Error).message}`);
  }
}

const nombre = (n: Nodo) => n.localName ?? n.nodeName.replace(/^.*:/, '');

function hijos(padre: Nodo | null, etiqueta: string): Nodo[] {
  const lista: Nodo[] = [];
  if (!padre) return lista;
  for (let i = 0; i < padre.childNodes.length; i++) {
    const hijo = padre.childNodes.item(i)!;
    if (hijo.nodeType === 1 && nombre(hijo) === etiqueta) lista.push(hijo);
  }
  return lista;
}

const hijo = (padre: Nodo | null, etiqueta: string) => hijos(padre, etiqueta)[0] ?? null;
const texto = (padre: Nodo | null, etiqueta: string) => hijo(padre, etiqueta)?.textContent?.trim() ?? null;

function buscar(raiz: Nodo, etiqueta: string): Nodo | null {
  if (nombre(raiz) === etiqueta) return raiz;
  for (let i = 0; i < raiz.childNodes.length; i++) {
    const n = raiz.childNodes.item(i)!;
    if (n.nodeType !== 1) continue;
    const encontrado = buscar(n, etiqueta);
    if (encontrado) return encontrado;
  }
  return null;
}

function mensajes(padre: Nodo | null): MensajeSri[] {
  return hijos(hijo(padre, 'mensajes'), 'mensaje').map((m) => ({
    identificador: texto(m, 'identificador') ?? '',
    mensaje: texto(m, 'mensaje') ?? '',
    informacionAdicional: texto(m, 'informacionAdicional'),
    tipo: texto(m, 'tipo') ?? '',
  }));
}

function falla(raiz: Nodo): string | null {
  const fault = buscar(raiz, 'Fault');
  return fault ? (texto(fault, 'faultstring') ?? 'SOAP Fault sin detalle') : null;
}

export function leerRespuestaAutorizacion(xml: string): RespuestaAutorizacion {
  const raiz = leer(xml);
  const respuesta = buscar(raiz, 'RespuestaAutorizacionComprobante') ?? buscar(raiz, 'RespuestaAutorizacionLote');
  if (!respuesta) {
    throw new RespuestaSriIlegibleError(falla(raiz) ?? 'La respuesta de autorizacion no trae RespuestaAutorizacion.');
  }
  const numero = Number(texto(respuesta, 'numeroComprobantes') ?? texto(respuesta, 'numeroComprobantesLote') ?? '0');

  const autorizaciones: Autorizacion[] = hijos(hijo(respuesta, 'autorizaciones'), 'autorizacion').map((a) => {
    const comprobante = texto(a, 'comprobante') ?? '';
    return {
      claveAcceso: /<claveAcceso>\s*(\d{49})\s*<\/claveAcceso>/.exec(comprobante)?.[1] ?? null,
      estado: texto(a, 'estado') ?? '',
      numeroAutorizacion: texto(a, 'numeroAutorizacion'),
      fechaAutorizacion: texto(a, 'fechaAutorizacion'),
      mensajes: mensajes(a),
    };
  });

  return { numeroComprobantes: Number.isFinite(numero) ? numero : 0, autorizaciones };
}
