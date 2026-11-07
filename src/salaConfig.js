// ─── SALA PABLO NERUDA — PASEO LA PLAZA 2026 ──────────────────────────────────
// Plano oficial real según documento oficial (3 sectores por fila)
// Numeración: Impares a la izquierda, Pares a la derecha

export const SALA = {
  platea: {
    label: "Platea",
    filas: [
      { id: "F1",  izq: [19,17,15,13,11], centroIzq: [9,7,5,3,1], centroDer: [2,4,6,8], der: [10,12,14,16] },
      { id: "F2",  izq: [21,19,17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10], der: [12,14,16,18] },
      { id: "F3",  izq: [19,17,15,13,11], centroIzq: [9,7,5,3,1], centroDer: [2,4,6,8,10], der: [12,14,16,18,20] },
      { id: "F4",  izq: [21,19,17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10], der: [12,14,16,18,20,22] },
      { id: "F5",  izq: [25,23,21,19,17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10], der: [12,14,16,18,20,22,24] },
      { id: "F6",  izq: [25,23,21,19,17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10], der: [12,14,16,18,20,22,24] },
      { id: "F7",  izq: [23,21,19,17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10,12], der: [14,16,18,20,22,24,26] },
      { id: "F8",  izq: [23,21,19,17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10,12], der: [14,16,18,20,22,24,26] },
      { id: "F9",  izq: [25,23,21,19,17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10,12], der: [14,16,18,20,22,24,26] },
      { id: "F10", izq: [23,21,19,17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10,12], der: [14,16,18,20,22,24] },
      { id: "F11", izq: [23,21,19,17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10,12], der: [14,16,18,20,22,24] },
      { id: "F12", izq: [23,21,19,17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10,12], der: [14,16,18,20,22,24,26] },
      { id: "F13", izq: [23,21,19,17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10,12], der: [14,16,18,20,22,24] },
      { id: "F14", izq: [25,23,21,19,17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10,12], der: [14,16,18,20,22,24] },
      { id: "F15", izq: [25,23,21,19,17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10,12], der: [14,16,18,20,22,24] },
      { id: "F16", izq: [23,21,19,17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10,12], der: [14,16,18,20,22,24] },
      { id: "F17", izq: [25,23,21,19,17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10], der: [12,14,16,18,20,22] },
      { id: "F18", izq: [17,15,13], centroIzq: [11,9,7,5,3,1], centroDer: [2,4,6,8,10,12], der: [14] },
    ]
  },
  pullman: {
    label: "Pullman",
    filas: [
      { id: "P1", izq: [25,23,21,19,17,15], centroIzq: [13,11,9,7,5,3,1], centroDer: [2,4,6,8,10,12], der: [14,16,18,20,22,24,26] },
      { id: "P2", izq: [27,25,23,21,19,17], centroIzq: [15,13,11,9,7,5,3,1], centroDer: [2,4,6,8,10,12,14], der: [16,18,20,22,24,26] },
      { id: "P3", izq: [25,23,21,19,17], centroIzq: [15,13,11,9,7,5,3,1], centroDer: [2,4,6,8,10,12,14], der: [16,18,20,22,24] },
      { id: "P4", izq: [25,23,21,19,17,15,13,11], centroIzq: [9,7,5,3,1], centroDer: [2,4,6,8,10,12,14,16], der: [18,20,22,24], pasilloSeparador: true }
    ]
  }
};

// Genera la lista completa de IDs de butacas
export function getAllSeatIds() {
  const ids = [];
  for (const sector of [SALA.platea, SALA.pullman]) {
    for (const fila of sector.filas) {
      const bloq = [...(fila.izq||[]), ...(fila.centroIzq||[]), ...(fila.centroDer||[]), ...(fila.der||[])];
      for (const n of bloq) ids.push(`${fila.id}-${n}`);
    }
  }
  return ids;
}

export const CONFIG = {
  EVENTO_NOMBRE: "Mussas",
  EVENTO_SUBTITULO: "Instituto de Danza",
  EVENTO_FECHA: "11 de Diciembre de 2026 · 20:00 hs",
  EVENTO_LUGAR: "Paseo La Plaza — Sala Pablo Neruda",
  PRECIO: 2500,
  TURNO_MINUTOS: 5,
  ADMIN_PASSWORD: "mussas2025",
  ADMIN_EMAIL: "institutomussas@gmail.com",
  EMAILJS_SERVICE_ID: "service_3gat7f2",
  EMAILJS_TEMPLATE_ID: "template_lx7v1bf",
  EMAILJS_PUBLIC_KEY: "8FUUXg0aGQ6kLJJLB",
  EMAILJS_TEMPLATE_COMPRADOR_ID: "template_79otqsm",
};
