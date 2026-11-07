import React, { useState, useEffect, useRef } from "react";
import { db, storage } from "./firebase.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  doc, getDoc, setDoc, onSnapshot, runTransaction,
  collection, addDoc, deleteDoc, serverTimestamp, query, orderBy, limit, getDocs
} from "firebase/firestore";
import { SALA, getAllSeatIds, CONFIG } from "./salaConfig.js";
import { logEvent, getLogs, LOG_EVENTS } from "./logger.js";

const genUserId = () => `u_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;

// ─── Firebase Storage ─────────────────────────────────────────────────────────
async function uploadToStorage(file, buyerName, seats) {
  const ext = file.name.split(".").pop();
  const fileName = `comprobantes/${buyerName.replace(/\s+/g, "_")}_${seats.join("-")}_${Date.now()}.${ext}`;
  const fileRef = storageRef(storage, fileName);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}

// ─── EmailJS ──────────────────────────────────────────────────────────────────
async function emailjsSend(templateId, params) {
  try {
    await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: CONFIG.EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: CONFIG.EMAILJS_PUBLIC_KEY,
        template_params: params,
      })
    });
  } catch (e) { console.error("EmailJS Error:", e); }
}

async function enviarMailAdmin({ buyerName, buyerDni, alumnaName, buyerEmail, seats, total, comprobanteUrl }) {
  await emailjsSend(CONFIG.EMAILJS_TEMPLATE_ID, {
    to_email: CONFIG.ADMIN_EMAIL,
    buyer_name: buyerName,
    buyer_dni: buyerDni,
    alumna_name: alumnaName,
    buyer_email: buyerEmail,
    seats: seats.join(", "),
    total: `$${total.toLocaleString("es-AR")} ARS`,
    comprobante_url: comprobanteUrl,
  });
}

async function enviarMailComprador({ buyerName, buyerEmail, alumnaName, seats, total }) {
  await emailjsSend(CONFIG.EMAILJS_TEMPLATE_COMPRADOR_ID, {
    buyer_email: buyerEmail,
    buyer_name: buyerName,
    alumna_name: alumnaName,
    seats: seats.join(", "),
    total: `$${total.toLocaleString("es-AR")} ARS`,
  });
}

// ─── Firestore Helpers ────────────────────────────────────────────────────────
async function initSalaIfNeeded() {
  const ref = doc(db, "entradas", "sala");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const seats = {};
    for (const id of getAllSeatIds()) seats[id] = { status: "free", userId: null, blockedUntil: null };
    await setDoc(ref, { seats });
  }
}

async function resetSala() {
  // 1. Resetear el mapa de la sala en Firestore
  const seats = {};
  for (const id of getAllSeatIds()) seats[id] = { status: "free", userId: null, blockedUntil: null };
  await setDoc(doc(db, "entradas", "sala"), { seats });

  // 2. Eliminar de Firestore el historial de compras previo (pruebas)
  const comprasSnap = await getDocs(collection(db, "compras"));
  const deletePromises = comprasSnap.docs.map(d => deleteDoc(doc(db, "compras", d.id)));
  await Promise.all(deletePromises);
}

async function liberarBloqueadasVencidas() {
  const now = Date.now();
  try {
    await runTransaction(db, async tx => {
      const ss = await tx.get(doc(db, "entradas", "sala"));
      if (!ss.exists()) return;
      const upd = { ...ss.data().seats };
      let changed = false;
      for (const [id, seat] of Object.entries(upd)) {
        if (seat.status === "blocked" && seat.blockedUntil && seat.blockedUntil < now) {
          upd[id] = { status: "free", userId: null, blockedUntil: null };
          changed = true;
        }
      }
      if (changed) tx.update(doc(db, "entradas", "sala"), { seats: upd });
    });
  } catch (e) { console.error("liberarBloqueadas:", e); }
}

// ─── Exportar Excel ───────────────────────────────────────────────────────────
function exportarExcel(compras, seats) {
  const butacaMap = {};
  
  // Como compras viene ordenado por fecha descendente, guardamos únicamente la última transacción realizada
  for (const c of compras) {
    for (const s of (c.seats || [])) {
      if (!butacaMap[s]) {
        butacaMap[s] = c;
      }
    }
  }

  const todasLasButacas = getAllSeatIds();
  const filas = todasLasButacas.map(seatId => {
    const seatData = seats[seatId];
    const esVendida = seatData?.status === "sold";
    
    // Si en la sala real la butaca no figura vendida, no exporta datos viejos
    const compra = esVendida ? butacaMap[seatId] : null;

    return {
      Butaca: seatId,
      Estado: esVendida ? "Vendida" : seatData?.status === "blocked" ? "Reservada" : "Libre",
      Comprador: compra?.buyerName || "",
      DNI: compra?.buyerDni || "",
      Email: compra?.buyerEmail || "",
      Alumna: compra?.alumnaName || "",
      Total: compra?.total ? `$${compra.total.toLocaleString("es-AR")}` : "",
      Fecha: compra?.timestamp?.toDate ? compra.timestamp.toDate().toLocaleString("es-AR") : "",
    };
  });

  const headers = Object.keys(filas[0]);
  const csv = [
    headers.join(";"),
    ...filas.map(r => headers.map(h => `"${(r[h] || "").toString().replace(/"/g, '""')}"`).join(";"))
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mussas-entradas-2026_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  if (window.location.hash === "#admin") return <AdminPanel />;

  const [userId] = useState(genUserId);
  const [seats, setSeats] = useState({});
  const [mySeats, setMySeats] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [toast, setToast] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerApellido, setBuyerApellido] = useState("");
  const [buyerDni, setBuyerDni] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [alumnaName, setAlumnaName] = useState("");
  const [comprobanteFile, setComprobanteFile] = useState(null);
  const [comprobantePreview, setComprobantePreview] = useState(null);
  const toastRef = useRef(null);

  useEffect(() => {
    initSalaIfNeeded().then(() => setPhase("mapa"));
    logEvent(userId, LOG_EVENTS.ENTRO_AL_SITIO);
    liberarBloqueadasVencidas();
    const iv = setInterval(liberarBloqueadasVencidas, 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "entradas", "sala"), snap => {
      if (snap.exists()) {
        const s = snap.data().seats || {};
        setSeats(s);
        setMySeats(prev => prev.filter(id => s[id]?.userId === userId));
      }
    });
    return unsub;
  }, [userId]);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3500);
  };

  const toggleSeat = async (seatId) => {
    if (phase !== "mapa") return;
    const seat = seats[seatId];
    if (mySeats.includes(seatId)) {
      try {
        await runTransaction(db, async tx => {
          const ss = await tx.get(doc(db, "entradas", "sala"));
          const upd = { ...ss.data().seats };
          upd[seatId] = { status: "free", userId: null, blockedUntil: null };
          tx.update(doc(db, "entradas", "sala"), { seats: upd });
        });
        setMySeats(prev => prev.filter(s => s !== seatId));
        logEvent(userId, LOG_EVENTS.DESELECCIONO_BUTACA, { seatId });
      } catch (e) { console.error(e); }
      return;
    }
    if (seat?.status === "sold") { showToast("Esta butaca ya fue vendida.", "error"); return; }
    if (seat?.status === "blocked" && seat?.userId !== userId) {
      showToast("Alguien ya seleccionó esta ubicación. Intentá con otra 😊", "warn"); return;
    }
    try {
      await runTransaction(db, async tx => {
        const ss = await tx.get(doc(db, "entradas", "sala"));
        const current = ss.data().seats[seatId];
        if (current.status !== "free") throw new Error("ocupada");
        const upd = { ...ss.data().seats };
        upd[seatId] = { status: "blocked", userId, blockedUntil: Date.now() + CONFIG.TURNO_MINUTOS * 60 * 1000 };
        tx.update(doc(db, "entradas", "sala"), { seats: upd });
      });
      setMySeats(prev => [...prev, seatId]);
      logEvent(userId, LOG_EVENTS.SELECCIONO_BUTACA, { seatId });
    } catch (e) {
      showToast("Alguien ya seleccionó esta ubicación. Intentá con otra 😊", "warn");
    }
  };

  const confirmarCompra = async () => {
    if (!buyerName.trim() || !buyerApellido.trim() || !buyerDni.trim() || !buyerEmail.trim() || !alumnaName.trim()) {
      setError("Completá todos los campos."); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
      setError("Ingresá un email válido."); return;
    }
    if (!comprobanteFile) { setError("Adjuntá el comprobante de pago."); return; }
    if (comprobanteFile.size > 5 * 1024 * 1024) { setError("El archivo es muy grande. Máximo 5MB."); return; }
    setError(""); setUploading(true);
    try {
      const fullName = `${buyerName} ${buyerApellido}`;
      const total = mySeats.length * CONFIG.PRECIO;
      const comprobanteUrl = await uploadToStorage(comprobanteFile, fullName, mySeats);
      await runTransaction(db, async tx => {
        const ss = await tx.get(doc(db, "entradas", "sala"));
        const upd = { ...ss.data().seats };
        for (const seatId of mySeats) {
          upd[seatId] = { status: "sold", userId, buyer: fullName, dni: buyerDni, alumna: alumnaName, comprobanteUrl, blockedUntil: null };
        }
        tx.update(doc(db, "entradas", "sala"), { seats: upd });
      });
      await addDoc(collection(db, "compras"), {
        userId, buyerName: fullName, buyerDni, buyerEmail, alumnaName,
        seats: mySeats, total, comprobanteUrl, timestamp: serverTimestamp(),
      });
      
      await Promise.all([
        enviarMailAdmin({ buyerName: fullName, buyerDni, alumnaName, buyerEmail, seats: mySeats, total, comprobanteUrl }),
        enviarMailComprador({ buyerName, buyerEmail, alumnaName, seats: mySeats, total })
      ]);

      logEvent(userId, LOG_EVENTS.COMPRA_CONFIRMADA, { seats: mySeats, buyer: fullName });
      setPhase("done");
    } catch (e) {
      console.error(e);
      setError("Hubo un error. Intentá de nuevo.");
      logEvent(userId, LOG_EVENTS.ERROR, { msg: e.message });
    }
    setUploading(false);
  };

  const total = mySeats.length * CONFIG.PRECIO;

  return (
    <div style={{ minHeight: "100vh", background: "var(--dark)" }}>
      <div className="top-stripe" />
      <header className="site-header">
        <p className="eyebrow">Entradas Online</p>
        <h1 className="site-title" style={{ fontSize: "clamp(42px,9vw,90px)", letterSpacing: ".04em" }}>{CONFIG.EVENTO_NOMBRE}</h1>
        <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(18px,3vw,28px)", color: "var(--gold-light)", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 16 }}>
          {CONFIG.EVENTO_SUBTITULO}
        </p>
        <div style={{ width: 60, height: 2, background: "#e0458a", margin: "0 auto 18px" }} />
        <p style={{ fontFamily: "'Archivo Narrow',sans-serif", fontSize: 13, color: "var(--text-mid)", letterSpacing: ".08em", marginBottom: 6 }}>
          FUNCIÓN · {CONFIG.EVENTO_FECHA}
        </p>
        <p style={{ fontFamily: "'Archivo Narrow',sans-serif", fontSize: 13, color: "var(--text-mid)", letterSpacing: ".06em", marginBottom: 16 }}>
          {CONFIG.EVENTO_LUGAR}
        </p>
        <div style={{ display: "inline-block", background: "var(--gold-dim)", border: "1px solid var(--gold)", padding: "8px 24px" }}>
          <span style={{ fontSize: 15, color: "var(--gold-light)", fontFamily: "'Archivo Narrow',sans-serif", letterSpacing: ".06em" }}>
            Valor reserva online: ${CONFIG.PRECIO.toLocaleString("es-AR")} por entrada
          </span>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 16px 120px" }}>
        {phase === "loading" && <Loader />}

        {phase === "mapa" && (
          <div>
            <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-mid)", marginBottom: 16 }}>
              Tocá las butacas que querés reservar. Se bloquean al instante para que nadie más las tome.
            </p>
            <div style={{ maxWidth: 520, margin: "0 auto 28px", background: "rgba(42,122,110,0.08)", border: "1px solid var(--border)", padding: "12px 20px", fontSize: 13, color: "var(--gold-light)", lineHeight: 1.7, textAlign: "center" }}>
              💡 Al tocar una butaca, esperá que se ponga <strong style={{ color: "#e0458a" }}>rosa</strong> para confirmar que quedó reservada para vos. Si no cambia de color, significa que otra persona la seleccionó al mismo tiempo — elegí otra.
            </div>
            <SalaMap seats={seats} mySeats={mySeats} onToggle={toggleSeat} userId={userId} />
            {mySeats.length > 0 && (
              <div className="selection-panel">
                <h3 style={{ fontSize: 22, marginBottom: 14 }}>Tu selección</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {mySeats.map(s => <span key={s} className="chip">{s}</span>)}
                </div>
                <p style={{ fontSize: 18, color: "var(--gold)", marginBottom: 20 }}>
                  Total: <strong>${total.toLocaleString("es-AR")} ARS</strong>
                </p>
                <button className="btn-primary" onClick={() => setPhase("formulario")} style={{ width: "100%" }}>
                  Continuar → Datos y pago
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "formulario" && (
          <div style={{ maxWidth: 520, margin: "0 auto" }}>
            <button className="btn-ghost" onClick={() => setPhase("mapa")} style={{ marginBottom: 20, fontSize: 11 }}>
              ← Volver al mapa
            </button>
            <div className="card">
              <h2 style={{ fontSize: 26, marginBottom: 6 }}>Tus datos</h2>
              <p style={{ fontSize: 13, color: "var(--cream)", marginBottom: 24 }}>
                Butacas: <strong style={{ color: "var(--gold)" }}>{mySeats.join(", ")}</strong>
                {" · "}Total: <strong style={{ color: "var(--gold)" }}>${total.toLocaleString("es-AR")}</strong>
              </p>
              <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, letterSpacing: ".1em", color: "#fff", display: "block", marginBottom: 6 }}>NOMBRE</label>
                    <input placeholder="Tu nombre" value={buyerName} onChange={e => setBuyerName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, letterSpacing: ".1em", color: "#fff", display: "block", marginBottom: 6 }}>APELLIDO</label>
                    <input placeholder="Tu apellido" value={buyerApellido} onChange={e => setBuyerApellido(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: ".1em", color: "#fff", display: "block", marginBottom: 6 }}>DNI</label>
                  <input placeholder="Número de DNI" value={buyerDni} onChange={e => setBuyerDni(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: ".1em", color: "var(--text-mid)", display: "block", marginBottom: 6 }}>EMAIL — te enviaremos la confirmación aquí</label>
                  <input placeholder="tucorreo@email.com" type="email" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: ".1em", color: "#fff", display: "block", marginBottom: 6 }}>NOMBRE Y APELLIDO DE LA ALUMNA QUE BAILA</label>
                  <input placeholder="Nombre completo de la alumna" value={alumnaName} onChange={e => setAlumnaName(e.target.value)} />
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: 18, marginBottom: 12 }}>Comprobante de pago</h3>
                <div style={{ background: "rgba(224,69,138,0.12)", border: "2px solid #e0458a", borderRadius: 2, padding: "16px 20px", marginBottom: 20 }}>
                  <p style={{ fontSize: 14, color: "#fff", fontWeight: 600, letterSpacing: ".02em", lineHeight: 1.7, fontFamily: "'Archivo Narrow',sans-serif" }}>
                    ⚠️ SIN CERRAR ESTA VENTANA, realizá el pago por transferencia al alias:<br />
                    <span style={{ fontSize: 18, color: "#e0458a", letterSpacing: ".08em" }}>MUSSAS2023</span><br />
                    y luego adjuntá el comprobante acá abajo.
                  </p>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-mid)", marginBottom: 16, lineHeight: 1.6 }}>
                  Adjuntá la foto o captura del comprobante. Máximo 5MB.
                </p>
                <label style={{ display: "block", border: "2px dashed var(--border)", padding: 28, textAlign: "center", cursor: "pointer", color: "var(--text-dim)", fontSize: 13, transition: "border-color .2s" }}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--gold)"; }}
                  onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                  onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--border)"; const f = e.dataTransfer.files[0]; if (f) { setComprobanteFile(f); setComprobantePreview(URL.createObjectURL(f)); } }}
                >
                  <input type="file" accept="image/*,.pdf" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files[0]; if (f) { setComprobanteFile(f); setComprobantePreview(URL.createObjectURL(f)); } }} />
                  {comprobantePreview ? (
                    <div>
                      <img src={comprobantePreview} alt="preview" style={{ maxHeight: 160, maxWidth: "100%", marginBottom: 8, objectFit: "contain" }} />
                      <p style={{ fontSize: 12, color: "var(--gold)" }}>✓ {comprobanteFile.name}</p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
                      <p>Tocá para adjuntar o arrastrá la imagen</p>
                      <p style={{ fontSize: 11, marginTop: 4, color: "#444" }}>JPG, PNG o PDF · máx. 5MB</p>
                    </div>
                  )}
                </label>
              </div>
              {error && <p style={{ color: "#e05050", fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <button className="btn-primary" onClick={confirmarCompra} disabled={uploading} style={{ width: "100%" }}>
                {uploading ? "
