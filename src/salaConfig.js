// ─── SALA PABLO NERUDA — PASEO LA PLAZA 2026 ──────────────────────────────────
// Matriz de 27 columnas exacta según el plano PDF oficial del teatro.
// Los 'null' representan exactamente los pasillos intermedios y espacios vacíos laterales.

export const SALA = {
  platea: {
    label: "Platea",
    filas: [
      // Fila 1: 19 a 11 (Izq) · PASILLO · 9 a 1 y 2 a 8 (Centro) · PASILLO · 10 a 16 (Der)
      { id: "F1",  grid: [null, null, 19, 17, 15, 13, 11, null, 9, 7, 5, 3, 1, 2, 4, 6, 8, null, 10, 12, 14, 16, null, null, null, null, null] },
      
      // Fila 2: 21 a 11 (Izq) · PASILLO · 9 a 1 y 2 a 10 (Centro) · PASILLO · 12 a 18 (Der)
      { id: "F2",  grid: [null, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, null, 10,12, 14, 16, 18, null, null, null, null] },
      
      // Fila 3: 19 a 11 (Izq) · PASILLO · 9 a 1 y 2 a 10 (Centro) · PASILLO · 12 a 20 (Der)
      { id: "F3",  grid: [null, null, 19, 17, 15, 13, 11, null, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, null, 12, 14, 16, 18, 20, null, null, null] },
      
      // Fila 4: 21 a 11 (Izq) · PASILLO · 9 a 1 y 2 a 10 (Centro) · PASILLO · 12 a 22 (Der)
      { id: "F4",  grid: [null, 21, 19, 17, 15, 13, 11, null, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, null, 12, 14, 16, 18, 20, 22, null, null] },
      
      // Fila 5: 25 a 13 (Izq) · PASILLO · 11 a 1 y 2 a 10 (Centro) · PASILLO · 12 a 24 (Der)
      { id: "F5",  grid: [25, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, null, 12, 14, 16, 18, 20, 22, 24] },
      
      // Fila 6: 25 a 13 (Izq) · PASILLO · 11 a 1 y 2 a 10 (Centro) · PASILLO · 12 a 24 (Der)
      { id: "F6",  grid: [25, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, null, 12, 14, 16, 18, 20, 22, 24] },
      
      // Fila 7: 23 a 13 (Izq) · PASILLO · 11 a 1 y 2 a 12 (Centro) · PASILLO · 14 a 26 (Der)
      { id: "F7",  grid: [null, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, 12, null, 14, 16, 18, 20, 22, 24, 26] },
      
      // Fila 8: 23 a 13 (Izq) · PASILLO · 11 a 1 y 2 a 12 (Centro) · PASILLO · 14 a 26 (Der)
      { id: "F8",  grid: [null, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, 12, null, 14, 16, 18, 20, 22, 24, 26] },
      
      // Fila 9: 25 a 13 (Izq) · PASILLO · 11 a 1 y 2 a 12 (Centro) · PASILLO · 14 a 26 (Der)
      { id: "F9",  grid: [25, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, 12, null, 14, 16, 18, 20, 22, 24, 26] },
      
      // Fila 10: 23 a 13 (Izq) · PASILLO · 11 a 1 y 2 a 12 (Centro) · PASILLO · 14 a 24 (Der)
      { id: "F10", grid: [null, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, 12, null, 14, 16, 18, 20, 22, 24, null] },
      
      // Fila 11: 23 a 13 (Izq) · PASILLO · 11 a 1 y 2 a 12 (Centro) · PASILLO · 14 a 24 (Der)
      { id: "F11", grid: [null, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, 12, null, 14, 16, 18, 20, 22, 24, null] },
      
      // Fila 12: 23 a 13 (Izq) · PASILLO · 11 a 1 y 2 a 12 (Centro) · PASILLO · 14 a 26 (Der)
      { id: "F12", grid: [null, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, 12, null, 14, 16, 18, 20, 22, 24, 26] },
      
      // Fila 13: 23 a 13 (Izq) · PASILLO · 11 a 1 y 2 a 12 (Centro) · PASILLO · 14 a 24 (Der)
      { id: "F13", grid: [null, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, 12, null, 14, 16, 18, 20, 22, 24, null] },
      
      // Fila 14: 25 a 13 (Izq) · PASILLO · 11 a 1 y 2 a 10 (Centro) · PASILLO · 12 a 24 (Der)
      { id: "F14", grid: [25, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, null, 12, 14, 16, 18, 20, 22, 24] },
      
      // Fila 15: 25 a 13 (Izq) · PASILLO · 11 a 1 y 2 a 10 (Centro) · PASILLO · 12 a 24 (Der)
      { id: "F15", grid: [25, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, null, 12, 14, 16, 18, 20, 22, 24] },
      
      // Fila 16: 23 a 13 (Izq) · PASILLO · 11 a 1 y 2 a 10 (Centro) · PASILLO · 12 a 24 (Der)
      { id: "F16", grid: [null, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, null, 12, 14, 16, 18, 20, 22, 24, null] },
      
      // Fila 17: 25 a 13 (Izq) · PASILLO · 11 a 1 y 2 a 10 (Centro) · PASILLO · 12 a 22 (Der)
      { id: "F17", grid: [25, 23, 21, 19, 17, 15, 13, null, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, null, 12, 14, 16, 18, 20, 22, null] },
      
      // Fila 18: 17 a 13 (Izq) · PASILLO · 11 a 1 y 2 a 12 (Centro) · PASILLO · 14 (Der)
      { id: "F18", grid: [null, null, null, null, 17, 15, 13, null, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, 12, null, 14, null, null, null, null, null] },
    ]
  },
  pullman: {
    label: "Pullman",
    filas: [
      // Pullman Fila 1: 25 a 15 (Izq) · PASILLO · 13 a 1 y 2 a 12 (Centro) · PASILLO · 14 a 26 (Der)
      { id: "P1", grid: [null, 25, 23, 21, 19, 17, 15, null, 13, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, 12, null, 14, 16, 18, 20, 22, 24, 26] },
      
      // Pullman Fila 2: 27 a 17 (Izq) · PASILLO · 15 a 1 y 2 a 14 (Centro) · PASILLO · 16 a 26 (Der)
      { id: "P2", grid: [27, 25, 23, 21, 19, 17, null, 15, 13, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, 12, 14, null, 16, 18, 20, 22, 24, 26] },
      
      // Pullman Fila 3: 25 a 17 (Izq) · PASILLO · 15 a 1 y 2 a 14 (Centro) · PASILLO · 16 a 24 (Der)
      { id: "P3", grid: [null, 25, 23, 21, 19, 17, null, 15, 13, 11, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, 12, 14, null, 16, 18, 20, 22, 24, null] },
      
      // Pullman Fila 4: 25 a 11 (Izq) · PASILLO · 9 a 1 y 2 a 16 (Centro) · PASILLO · 18 a 24 (Der)
      { id: "P4", grid: [25, 23, 21, 19, 17, 15, 13, 11, null, 9, 7, 5, 3, 1, 2, 4, 6, 8, 10, 12, 14, 16, null, 18, 20, 22, 24, null], pasilloSeparador: true }
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
