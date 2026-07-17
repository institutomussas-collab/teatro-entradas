// ─── CONFIGURACIÓN DE LA SALA ─────────────────────────────────────────────────
// Basado en la imagen del teatro: Planta Baja (forma de abanico) + 1º Piso
// Cada fila tiene { id, label, seats, offset } donde offset centra visualmente la fila

export const SALA = {
  // ── PLANTA BAJA ──────────────────────────────────────────────────────────────
  // La planta baja tiene forma de abanico: filas más cortas arriba, más largas abajo
  // con pasillos centrales que dividen cada fila en bloques
  plantaBaja: {
    label: "Planta Baja",
    filas: [
      // Formato: { id, butacas: [[desde, hasta], [desde, hasta]] } — cada array es un bloque separado por pasillo
      { id: "PB1",  bloques: [[1,4],  [5,12],  [13,16]] },
      { id: "PB2",  bloques: [[1,4],  [5,12],  [13,16]] },
      { id: "PB3",  bloques: [[1,5],  [6,13],  [14,18]] },
      { id: "PB4",  bloques: [[1,5],  [6,13],  [14,18]] },
      { id: "PB5",  bloques: [[1,5],  [6,14],  [15,19]] },
      { id: "PB6",  bloques: [[1,5],  [6,14],  [15,19]] },
      { id: "PB7",  bloques: [[1,6],  [7,15],  [16,21]] },
      { id: "PB8",  bloques: [[1,6],  [7,15],  [16,21]] },
      { id: "PB9",  bloques: [[1,6],  [7,16],  [17,22]] },
      { id: "PB10", bloques: [[1,6],  [7,16],  [17,22]] },
      { id: "PB11", bloques: [[1,7],  [8,17],  [18,24]] },
      { id: "PB12", bloques: [[1,7],  [8,17],  [18,24]] },
      { id: "PB13", bloques: [[1,7],  [8,18],  [19,25]] },
      { id: "PB14", bloques: [[1,7],  [8,18],  [19,25]] },
      { id: "PB15", bloques: [[1,8],  [9,19],  [20,27]] },
      { id: "PB16", bloques: [[1,8],  [9,19],  [20,27]] },
      { id: "PB17", bloques: [[1,8],  [9,20],  [21,28]] },
      { id: "PB18", bloques: [[1,8],  [9,20],  [21,28]] },
    ]
  },
  // ── 1º PISO ───────────────────────────────────────────────────────────────────
  // Forma de U: bloques izquierdo, centro, derecho
  primerPiso: {
    label: "1º Piso",
    filas: [
      { id: "PP1", bloques: [[1,6],  [7,12],  [13,18]] },
      { id: "PP2", bloques: [[1,6],  [7,14],  [15,20]] },
      { id: "PP3", bloques: [[1,5],  [6,16],  [17,21]] },
      { id: "PP4", bloques: [[1,5],  [6,16],  [17,21]] },
      { id: "PP5", bloques: [[1,4],  [5,16],  [17,20]] },
      { id: "PP6", bloques: [[1,4],  [5,14],  [15,18]] },
    ]
  }
};

// Genera lista plana de todos los seatIds
export function getAllSeatIds() {
  const ids = [];
  for (const sector of [SALA.plantaBaja, SALA.primerPiso]) {
    for (const fila of sector.filas) {
      for (const bloque of fila.bloques) {
        for (let n = bloque[0]; n <= bloque[1]; n++) {
          ids.push(`${fila.id}-${n}`);
        }
      }
    }
  }
  return ids;
}

export const CONFIG = {
  EVENTO_NOMBRE: "Mussas",
  EVENTO_SUBTITULO: "Instituto de Danza",
  EVENTO_FECHA: "11 de Diciembre de 2026 · 20:30 hs",
  EVENTO_LUGAR: "Paseo La Plaza — Sala Pablo Picasso",
  PRECIO_PB: 2000,   // Planta Baja — pesos ARS
  PRECIO_PP: 2000,   // 1º Piso
  TURNO_MINUTOS: 5,
  ADMIN_PASSWORD: "mussas2025", // ← cambiá esto
  ADMIN_EMAIL: "institutomussas@gmail.com",
  // Para envío de mail usamos EmailJS (gratuito, sin backend)
  EMAILJS_SERVICE_ID: "service_3gat7f2",
  EMAILJS_TEMPLATE_ID: "template_lx7v1bf",
  EMAILJS_PUBLIC_KEY: "8FUUXg0aGQ6kLJJLB",
};
