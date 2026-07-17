// ─── SISTEMA DE LOGGING EN FIRESTORE ─────────────────────────────────────────
import { db } from "./firebase.js";
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from "firebase/firestore";

export const LOG_EVENTS = {
  ENTRO_AL_SITIO:        "Entró al sitio",
  SE_UNE_A_LA_FILA:      "Se unió a la fila",
  INICIO_TURNO:          "Inició su turno",
  SELECCIONO_BUTACA:     "Seleccionó butaca",
  DESELECCIONO_BUTACA:   "Deseleccionó butaca",
  COMPLETO_FORMULARIO:   "Completó formulario de datos",
  SUBIO_COMPROBANTE:     "Subió comprobante de pago",
  COMPRA_CONFIRMADA:     "Compra confirmada",
  TURNO_EXPIRADO:        "Turno expirado — volvió a la fila",
  BUTACA_TOMADA:         "Intentó tomar butaca ya ocupada",
  ERROR:                 "Error en el sistema",
  ADMIN_LOGIN:           "Admin inició sesión",
  ADMIN_ACTIVO_BUTACA:   "Admin activó butaca",
  ADMIN_ANULO_BUTACA:    "Admin anuló butaca",
};

export async function logEvent(userId, event, details = {}) {
  try {
    await addDoc(collection(db, "logs"), {
      userId,
      event,
      details,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent.slice(0, 100),
    });
  } catch (e) {
    console.error("Log error:", e);
  }
}

export async function getLogs(limitN = 200) {
  const q = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(limitN));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
