// Netlify Function — libera butacas bloqueadas vencidas
// Se llama desde cron-job.org cada 5 minutos

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { credential } from "firebase-admin";

// Inicializar Firebase Admin (solo una vez)
if (!getApps().length) {
  initializeApp({
    credential: credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

export const handler = async (event) => {
  // Seguridad: solo permitir llamadas con el token correcto
  const token = event.headers["x-cron-token"] || event.queryStringParameters?.token;
  if (token !== process.env.CRON_SECRET) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  try {
    const salaRef = db.collection("entradas").doc("sala");
    const snap = await salaRef.get();

    if (!snap.exists) {
      return { statusCode: 200, body: JSON.stringify({ liberadas: 0, msg: "Sala no existe" }) };
    }

    const seats = snap.data().seats || {};
    const now = Date.now();
    const updates = {};
    let liberadas = 0;

    for (const [id, seat] of Object.entries(seats)) {
      if (seat.status === "blocked" && seat.blockedUntil && seat.blockedUntil < now) {
        updates[`seats.${id}`] = { status: "free", userId: null, blockedUntil: null };
        liberadas++;
      }
    }

    if (liberadas > 0) {
      await salaRef.update(updates);
      console.log(`Liberadas ${liberadas} butacas vencidas`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ liberadas, timestamp: new Date().toISOString() }),
    };
  } catch (e) {
    console.error("Error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
