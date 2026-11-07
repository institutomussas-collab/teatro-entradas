// ─── SALA PABLO NERUDA — PASEO LA PLAZA 2026 ──────────────────────────────────
// Matriz de 27 columnas basada en el plano oficial del teatro.
// Los 'null' reservan el espacio visual de los pasillos laterales e internos.

export const SALA = {
  platea: {
    label: "Platea",
    filas: [
      { id: "F1",  grid: [null, null, 19, 17, 15, 13, 11, null, 9, 7, 5, 3, 1, null, 2, 4, 6, 8, null, 10, 12, 14, 16, null, null, null, null] },
      { id: "F2",  grid: [null, 21, 19, 17, 15, 13, 11, null, 9, 7, 5, 3, 1, null, 2, 4, 6, 8, null, 10, 12, 14, 16, 18, null, null, null] },
      { id: "F3",  grid: [null, null, 19, 17, 15, 13, 11, null, 9, 7, 5, 3, 1, null, 2, 4, 6, 8, null, 10, 12, 14, 16, 18, 20, null, null] },
      { id: "F4",  grid: [null, 21, 19, 17, 15, 13, 11, null, 9, 7, 5, 3, 1, null, 2, 4, 6, 8, null, 10, 12, 14, 16, 18, 20, 22, null] },
      { id: "F5",  grid: [25, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, null, 1, 2, 4, 6, null, 8, 10, 12, 14, 16, 18, 20, 22] },
      { id: "F6",  grid: [25, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, null, 1, 2, 4, 6, null, 8, 10, 12, 14, 16, 18, 20, 22] },
      { id: "F7",  grid: [null, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, null, 1, 2, 4, 6, null, 8, 10, 12, 14, 16, 18, 20, 22] },
      { id: "F8",  grid: [null, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, null, 1, 2, 4, 6, null, 8, 10, 12, 14, 16, 18, 20, 22] },
      { id: "F9",  grid: [25, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, null, 1, 2, 4, 6, null, 8, 10, 12, 14, 16, 18, 20, 22] },
      { id: "F10", grid: [null, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, null, 1, 2, 4, 6, null, 8, 10, 12, 14, 16, 18, 20, null] },
      { id: "F11", grid: [null, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, null, 1, 2, 4, 6, null, 8, 10, 12, 14, 16, 18, 20, null] },
      { id: "F12", grid: [null, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, null, 1, 2, 4, 6, null, 8, 10, 12, 14, 16, 18, 20, 22] },
      { id: "F13", grid: [null, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, null, 1, 2, 4, 6, null, 8, 10, 12, 14, 16, 18, 20, null] },
      { id: "F14", grid: [25, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, null, 1, 2, 4, 6, null, 8, 10, 12, 14, 16, 18, 20, null] },
      { id: "F15", grid: [25, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, null, 1, 2, 4, 6, null, 8, 10, 12, 14, 16, 18, 20, null] },
      { id: "F16", grid: [null, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, null, 1, 2, 4, 6, null, 8, 10, 12, 14, 16, 18, 20, null] },
      { id: "F17", grid: [25, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, null, 1, 2, 4, 6, null, 8, 10, 12, 14, 16, 18, null, null] },
      { id: "F18", grid: [null, null, null, null, 17, 15, 13, null, 11, 9, 7, 5, 3, null, 1, 2, 4, 6, null, 8, 10, 12, 14, null, null, null, null] },
    ]
  },
  pullman: {
    label: "Pullman",
    filas: [
      { id: "P1", grid: [null, 25, 23, 21, 19, 17, 15, null, 13, 11, 9, 7, 5, 3, 1, null, 2, 4, 6, 8, null, 10, 12, 14, 16, 18, null] },
      { id: "P2", grid: [27, 25, 23, 21, 19, 17, 15, null, 13, 11, 9, 7, 5, 3, 1, null, 2, 4, 6, 8, null, 10, 12, 14, 16, 18, 20] },
      { id: "P3", grid: [null, 25, 23, 21, 19, 17, 15, null, 13, 11, 9, 7, 5, 3, 1, null, 2, 4, 6, 8, null, 10, 12, 14, 16, null, null] },
      { id: "P4", grid: [25, 23, 21, 19, 17, 15, 13, 11, null, 9, 7, 5, 3, 1, null, 2, 4, 6, 8, null, 10, 12, 14, 16, 18, 20, null], pasilloSeparador: true }
    ]
  }
};

export function getAllSeatIds() {
  const ids = [];
  for (const sector of [SALA.platea, SALA.pullman]) {
    for (const fila of sector.filas) {
      for (const val of fila.grid) {
        if (val !== null) ids.push(`${fila.id}-${val}`);
      }
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
