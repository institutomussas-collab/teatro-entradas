import { useState, useEffect, useRef } from "react";
import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, onSnapshot, runTransaction,
  collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs
} from "firebase/firestore";
import { SALA, getAllSeatIds, CONFIG } from "./salaConfig.js";
import { logEvent, getLogs, LOG_EVENTS } from "./logger.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genUserId = () => `u_${Math.random().toString(36).slice(2,9)}_${Date.now()}`;

// ─── Init Firestore ───────────────────────────────────────────────────────────
async function initSalaIfNeeded() {
  const ref = doc(db, "entradas", "sala");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const seats = {};
    for (const id of getAllSeatIds()) {
      seats[id] = { status: "free", userId: null, blockedUntil: null };
    }
    await setDoc(ref, { seats });
  }
  const qRef = doc(db, "entradas", "queue");
  const qSnap = await getDoc(qRef);
  if (!qSnap.exists()) await setDoc(qRef, { list: [] });
  const tRef = doc(db, "entradas", "turno");
  const tSnap = await getDoc(tRef);
  if (!tSnap.exists()) await setDoc(tRef, { userId: null, expiresAt: null });
}

async function resetSala() {
  const seats = {};
  for (const id of getAllSeatIds()) {
    seats[id] = { status: "free", userId: null, blockedUntil: null };
  }
  await setDoc(doc(db, "entradas", "sala"), { seats });
  await setDoc(doc(db, "entradas", "queue"), { list: [] });
  await setDoc(doc(db, "entradas", "turno"), { userId: null, expiresAt: null });
}

async function liberarBloqueadasVencidas() {
  const now = Date.now();
  try {
    await runTransaction(db, async tx => {
      const ss = await tx.get(doc(db, "entradas", "sala"));
      if (!ss.exists()) return;
      const seats = ss.data().seats;
      const upd = { ...seats };
      let changed = false;
      for (const [id, seat] of Object.entries(seats)) {
        if (seat.status === "blocked" && seat.blockedUntil && seat.blockedUntil < now) {
          upd[id] = { status: "free", userId: null, blockedUntil: null };
          changed = true;
        }
      }
      if (changed) tx.update(doc(db, "entradas", "sala"), { seats: upd });
    });
  } catch(e) { console.error("liberarBloqueadas:", e); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  if (window.location.hash === "#admin") return <AdminPanel />;

  const [userId]    = useState(genUserId);
  const [seats, setSeats]     = useState({});
  const [mySeats, setMySeats] = useState([]);
  const [phase, setPhase]     = useState("loading");
  const [toast, setToast]     = useState(null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const toastRef = useRef(null);

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    initSalaIfNeeded().then(() => setPhase("mapa"));
    logEvent(userId, LOG_EVENTS.ENTRO_AL_SITIO);
    liberarBloqueadasVencidas();
    const interval = setInterval(liberarBloqueadasVencidas, 60000);
    return () => clearInterval(interval);
  }, []);

  // ── Listener butacas en tiempo real ─────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "entradas", "sala"), snap => {
      if (snap.exists()) {
        const newSeats = snap.data().seats || {};
        setSeats(newSeats);
        setMySeats(prev => prev.filter(id => newSeats[id]?.userId === userId));
      }
    });
    return unsub;
  }, [userId]);

  // ── Toast ────────────────────────────────────────────────────────────────────
  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3500);
  };

  // ── Toggle butaca ────────────────────────────────────────────────────────────
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
      } catch(e) { console.error(e); }
      return;
    }

    if (seat?.status === "sold") {
      showToast("Esta butaca ya fue vendida.", "error");
      return;
    }
    if (seat?.status === "blocked" && seat?.userId !== userId) {
      showToast("Alguien ya seleccionó esta ubicación. Intentá con otra 😊", "warn");
      return;
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
    } catch(e) {
      showToast("Alguien ya seleccionó esta ubicación. Intentá con otra 😊", "warn");
      logEvent(userId, LOG_EVENTS.BUTACA_TOMADA, { seatId });
    }
  };

  // ── Ir al formulario ─────────────────────────────────────────────────────────
  const irAFormulario = () => {
    if (mySeats.length === 0) { showToast("Seleccioná al menos una butaca.", "error"); return; }
    logEvent(userId, LOG_EVENTS.COMPLETO_FORMULARIO, { seats: mySeats });
    setPhase("formulario");
  };

  // ── Confirmar envío del form ─────────────────────────────────────────────────
  const confirmarFormEnviado = async () => {
    // Marcar butacas como vendidas
    await runTransaction(db, async tx => {
      const ss = await tx.get(doc(db, "entradas", "sala"));
      const upd = { ...ss.data().seats };
      for (const seatId of mySeats) {
        upd[seatId] = { status: "sold", userId, blockedUntil: null };
      }
      tx.update(doc(db, "entradas", "sala"), { seats: upd });
    });

    await addDoc(collection(db, "compras"), {
      userId, seats: mySeats,
      total: mySeats.length * CONFIG.PRECIO,
      timestamp: serverTimestamp(),
    });

    logEvent(userId, LOG_EVENTS.COMPRA_CONFIRMADA, { seats: mySeats });
    setPhase("done");
  };

  const total = mySeats.length * CONFIG.PRECIO;

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"var(--dark)" }}>
      <div className="top-stripe" />

      <header className="site-header">
        <p className="eyebrow">Entradas Online</p>
        <h1 className="site-title" style={{ fontSize:"clamp(42px,9vw,90px)", letterSpacing:".04em" }}>
          {CONFIG.EVENTO_NOMBRE}
        </h1>
        <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"clamp(18px,3vw,28px)", color:"var(--gold-light)", letterSpacing:".12em", textTransform:"uppercase", marginBottom:16 }}>
          {CONFIG.EVENTO_SUBTITULO}
        </p>
        <div style={{ width:60, height:2, background:"#e0458a", margin:"0 auto 18px" }} />
        <p style={{ fontFamily:"'Archivo Narrow',sans-serif", fontSize:13, color:"var(--text-mid)", letterSpacing:".08em", marginBottom:6 }}>
          FUNCIÓN · {CONFIG.EVENTO_FECHA}
        </p>
        <p style={{ fontFamily:"'Archivo Narrow',sans-serif", fontSize:13, color:"var(--text-mid)", letterSpacing:".06em", marginBottom:16 }}>
          {CONFIG.EVENTO_LUGAR}
        </p>
        <div style={{ display:"inline-block", background:"var(--gold-dim)", border:"1px solid var(--gold)", padding:"8px 24px" }}>
          <span style={{ fontSize:15, color:"var(--gold-light)", fontFamily:"'Archivo Narrow',sans-serif", letterSpacing:".06em" }}>
            Valor reserva online: ${CONFIG.PRECIO.toLocaleString("es-AR")} por entrada
          </span>
        </div>
      </header>

      <main style={{ maxWidth:1000, margin:"0 auto", padding:"36px 16px 120px" }}>

        {phase === "loading" && <Loader />}

        {phase === "mapa" && (
          <div>
            <p style={{ textAlign:"center", fontSize:13, color:"var(--text-mid)", marginBottom:28 }}>
              Tocá las butacas que querés reservar. Se bloquean al instante para que nadie más las tome.
            </p>
            <SalaMap seats={seats} mySeats={mySeats} onToggle={toggleSeat} userId={userId} />

            {mySeats.length > 0 && (
              <div className="selection-panel">
                <h3 style={{ fontSize:22, marginBottom:14 }}>Tu selección</h3>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
                  {mySeats.map(s => <span key={s} className="chip">{s}</span>)}
                </div>
                <p style={{ fontSize:18, color:"var(--gold)", marginBottom:20 }}>
                  Total: <strong>${total.toLocaleString("es-AR")} ARS</strong>
                </p>
                <button className="btn-primary" onClick={irAFormulario} style={{ width:"100%" }}>
                  Continuar → Completar datos y pago
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "formulario" && (
          <div style={{ maxWidth:640, margin:"0 auto" }}>
            <button className="btn-ghost" onClick={() => setPhase("mapa")} style={{ marginBottom:20, fontSize:11 }}>
              ← Volver al mapa
            </button>

            {/* Info de reserva */}
            <div style={{ background:"var(--dark2)", border:"1px solid var(--border)", borderTop:"2px solid var(--gold)", padding:"20px 24px", marginBottom:20 }}>
              <p style={{ fontSize:13, color:"var(--text-mid)", marginBottom:8 }}>
                Butacas seleccionadas: <strong style={{ color:"var(--gold)" }}>{mySeats.join(", ")}</strong>
              </p>
              <p style={{ fontSize:16, color:"var(--gold-light)" }}>
                Total a reservar: <strong>${total.toLocaleString("es-AR")} ARS</strong>
              </p>
            </div>

            {/* Instrucciones */}
            <div style={{ background:"rgba(224,69,138,0.08)", border:"1px solid rgba(224,69,138,0.3)", padding:"14px 20px", marginBottom:20, fontSize:13, color:"#f0a0c8", lineHeight:1.6 }}>
              📋 Completá el formulario con tus datos y adjuntá el comprobante de pago. Una vez enviado, hacé clic en <strong>"Ya envié el formulario"</strong> para confirmar tu reserva.
            </div>

            {/* Google Form incrustado */}
            <div style={{ border:"1px solid var(--border)", overflow:"hidden", background:"var(--dark2)", marginBottom:20 }}>
              <iframe
                src={CONFIG.GOOGLE_FORM_URL}
                width="100%"
                height="900"
                frameBorder="0"
                marginHeight="0"
                marginWidth="0"
                style={{ display:"block", filter:"invert(0.92) hue-rotate(140deg) brightness(0.9)" }}
                title="Formulario de reserva"
              >
                Cargando formulario…
              </iframe>
            </div>

            {/* Botón confirmar */}
            <button className="btn-primary" onClick={confirmarFormEnviado} style={{ width:"100%", padding:"16px" }}>
              ✅ Ya envié el formulario — Confirmar mi reserva
            </button>
            <p style={{ fontSize:11, color:"var(--text-dim)", textAlign:"center", marginTop:10 }}>
              Solo hacé clic después de completar y enviar el formulario de arriba
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="ticket">
            <div style={{ fontSize:52, marginBottom:14 }}>🎟️</div>
            <h2 style={{ fontSize:34, marginBottom:8 }}>¡Reserva confirmada!</h2>
            <p style={{ fontSize:14, color:"var(--gold-light)", marginBottom:24, lineHeight:1.6 }}>
              Tu reserva fue registrada correctamente.
            </p>
            <div style={{ borderTop:"1px solid var(--border)", borderBottom:"1px solid var(--border)", padding:"20px 0", marginBottom:20 }}>
              <p style={{ fontSize:11, color:"var(--text-dim)", letterSpacing:".12em", marginBottom:10 }}>TUS BUTACAS</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
                {mySeats.map(s => <span key={s} className="seat-tag">{s}</span>)}
              </div>
              <p style={{ fontSize:16, color:"var(--gold)", marginTop:14 }}>
                ${total.toLocaleString("es-AR")} ARS
              </p>
            </div>
            <p style={{ fontSize:13, color:"var(--text-mid)", lineHeight:1.7 }}>
              Recordá acercarte al instituto en los horarios habituales para abonar el saldo y retirar tus entradas físicas.<br />
              <strong style={{ color:"var(--gold-light)" }}>Las entradas son imprescindibles para ingresar a la sala.</strong>
            </p>
          </div>
        )}

      </main>

      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)",
          background: toast.type==="error" ? "#3a1010" : toast.type==="warn" ? "#2e2010" : "var(--dark3)",
          border:`1px solid ${toast.type==="error" ? "var(--red)" : toast.type==="warn" ? "var(--gold)" : "#333"}`,
          color: toast.type==="warn" ? "var(--gold-light)" : "var(--cream)",
          padding:"12px 24px", fontSize:14, zIndex:100, maxWidth:340, textAlign:"center",
          boxShadow:"0 4px 24px rgba(0,0,0,.5)", lineHeight:1.5,
        }}>
          {toast.msg}
        </div>
      )}

      <StickyLegend show={phase === "mapa"} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANEL ADMIN
// ═══════════════════════════════════════════════════════════════════════════════
function AdminPanel() {
  const [authed, setAuthed]   = useState(false);
  const [pass, setPass]       = useState("");
  const [passError, setPassError] = useState("");
  const [seats, setSeats]     = useState({});
  const [logs, setLogs]       = useState([]);
  const [compras, setCompras] = useState([]);
  const [tab, setTab]         = useState("sala");
  const [resetting, setResetting] = useState(false);

  const login = () => {
    if (pass === CONFIG.ADMIN_PASSWORD) { setAuthed(true); logEvent("ADMIN", LOG_EVENTS.ADMIN_LOGIN); }
    else setPassError("Contraseña incorrecta.");
  };

  useEffect(() => {
    if (!authed) return;
    const unsub = onSnapshot(doc(db,"entradas","sala"), s => s.exists() && setSeats(s.data().seats||{}));
    getLogs(300).then(setLogs);
    getDocs(query(collection(db,"compras"), orderBy("timestamp","desc"), limit(100)))
      .then(snap => setCompras(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
    return unsub;
  }, [authed]);

  const activarButaca = async (seatId) => {
    await runTransaction(db, async tx => {
      const ss = await tx.get(doc(db,"entradas","sala"));
      const upd = { ...ss.data().seats };
      upd[seatId] = { status:"free", userId:null, blockedUntil:null };
      tx.update(doc(db,"entradas","sala"), { seats: upd });
    });
    logEvent("ADMIN", LOG_EVENTS.ADMIN_ACTIVO_BUTACA, { seatId });
  };

  const anularButaca = async (seatId) => {
    if (!confirm(`¿Anular butaca ${seatId}?`)) return;
    await runTransaction(db, async tx => {
      const ss = await tx.get(doc(db,"entradas","sala"));
      const upd = { ...ss.data().seats };
      upd[seatId] = { status:"sold", userId:"ADMIN-ANULADA", blockedUntil:null };
      tx.update(doc(db,"entradas","sala"), { seats: upd });
    });
    logEvent("ADMIN", LOG_EVENTS.ADMIN_ANULO_BUTACA, { seatId });
  };

  const resetearSala = async () => {
    if (!confirm("¿Resetear TODA la sala? Esto libera todas las butacas.")) return;
    setResetting(true);
    await resetSala();
    setResetting(false);
  };

  if (!authed) return (
    <div style={{ minHeight:"100vh", background:"var(--dark)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div className="top-stripe" style={{ position:"fixed", top:0, left:0, right:0 }} />
      <div className="card" style={{ maxWidth:360, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:36, marginBottom:12 }}>🔐</div>
        <h2 style={{ fontSize:24, marginBottom:20 }}>Panel Admin</h2>
        <input type="password" placeholder="Contraseña" value={pass}
          onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key==="Enter" && login()}
          style={{ marginBottom:12 }}
        />
        {passError && <p style={{ color:"#e05050", fontSize:13, marginBottom:10 }}>{passError}</p>}
        <button className="btn-primary" onClick={login} style={{ width:"100%" }}>Ingresar</button>
      </div>
    </div>
  );

  const soldSeats    = Object.entries(seats).filter(([,s]) => s.status==="sold");
  const blockedSeats = Object.entries(seats).filter(([,s]) => s.status==="blocked");
  const freeSeats    = Object.entries(seats).filter(([,s]) => s.status==="free");

  return (
    <div style={{ minHeight:"100vh", background:"var(--dark)" }}>
      <div className="top-stripe" />
      <header style={{ padding:"20px 24px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom:4 }}>Panel Admin</p>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:26 }}>Mussas — Función 2026</h1>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button className="btn-ghost" style={{ fontSize:11, borderColor:"var(--red)", color:"var(--red)" }}
            onClick={resetearSala} disabled={resetting}>
            {resetting ? "Reseteando…" : "🗑 Resetear sala"}
          </button>
          <a href="/"><button className="btn-ghost" style={{ fontSize:11 }}>← Volver al sitio</button></a>
        </div>
      </header>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:1, background:"var(--border)" }}>
        {[
          { label:"Vendidas",   value:soldSeats.length,    color:"var(--red)" },
          { label:"Reservadas", value:blockedSeats.length, color:"var(--gold)" },
          { label:"Libres",     value:freeSeats.length,    color:"var(--green-light)" },
          { label:"Compras",    value:compras.length,      color:"var(--cream)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:"var(--dark2)", padding:"18px 20px", textAlign:"center" }}>
            <div style={{ fontSize:30, fontFamily:"'Archivo Narrow',sans-serif", fontWeight:600, color }}>{value}</div>
            <div style={{ fontSize:10, letterSpacing:".12em", color:"var(--text-dim)", marginTop:4 }}>{label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:"1px solid var(--border)", padding:"0 24px" }}>
        {[["sala","Sala"],["compras","Compras"],["logs","Log"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background:"none", border:"none",
            borderBottom: tab===id ? "2px solid var(--gold)" : "2px solid transparent",
            color: tab===id ? "var(--gold)" : "var(--text-dim)",
            fontFamily:"'Archivo Narrow',sans-serif", fontSize:13, letterSpacing:".08em",
            padding:"14px 20px", cursor:"pointer", textTransform:"uppercase"
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding:24, maxWidth:1100, margin:"0 auto" }}>

        {tab === "sala" && (
          <div>
            <p style={{ fontSize:13, color:"var(--text-mid)", marginBottom:20 }}>
              Tocá una butaca para ver sus datos y gestionarla.
            </p>
            <SalaMap seats={seats} mySeats={[]} onToggle={()=>{}} userId="ADMIN"
              adminMode onActivar={activarButaca} onAnular={anularButaca} />
          </div>
        )}

        {tab === "compras" && (
          <div>
            {compras.length === 0 && <p style={{ color:"var(--text-dim)", fontSize:13 }}>No hay compras registradas todavía.</p>}
            <div style={{ display:"grid", gap:10 }}>
              {compras.map(c => (
                <div key={c.id} style={{ background:"var(--dark2)", border:"1px solid var(--border)", padding:"16px 20px" }}>
                  <p style={{ fontSize:13, color:"var(--gold)", marginBottom:4 }}>
                    Butacas: <strong>{(c.seats||[]).join(", ")}</strong>
                  </p>
                  <p style={{ fontSize:12, color:"var(--text-dim)" }}>
                    ${(c.total||0).toLocaleString("es-AR")} ARS · {c.timestamp?.toDate ? c.timestamp.toDate().toLocaleString("es-AR") : "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "logs" && (
          <div>
            <button className="btn-ghost" style={{ marginBottom:16, fontSize:11 }}
              onClick={() => getLogs(300).then(setLogs)}>↻ Actualizar</button>
            <div style={{ display:"grid", gap:4 }}>
              {logs.map(l => (
                <div key={l.id} style={{ background:"var(--dark2)", border:"1px solid var(--border)", padding:"10px 16px", display:"grid", gridTemplateColumns:"160px 1fr auto", gap:12, alignItems:"center", fontSize:12 }}>
                  <span style={{ color:"var(--text-dim)", fontFamily:"monospace", fontSize:10 }}>
                    {l.timestamp?.toDate ? l.timestamp.toDate().toLocaleString("es-AR") : "—"}
                  </span>
                  <span>
                    <span style={{ color:"var(--gold)", marginRight:8 }}>{l.event}</span>
                    {l.details && Object.keys(l.details).length > 0 && (
                      <span style={{ color:"var(--text-dim)" }}>· {JSON.stringify(l.details)}</span>
                    )}
                  </span>
                  <span style={{ color:"#444", fontFamily:"monospace", fontSize:10 }}>{(l.userId||"").slice(0,14)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAPA DE SALA
// ═══════════════════════════════════════════════════════════════════════════════
function SalaMap({ seats, mySeats, onToggle, userId, adminMode, onActivar, onAnular }) {
  const [adminSeat, setAdminSeat] = useState(null);
  if (!seats || Object.keys(seats).length === 0) return null;

  const getStatus = (seatId) => {
    if (mySeats.includes(seatId)) return "mine";
    const s = seats[seatId];
    if (!s) return "free";
    if (s.status === "sold")    return "sold";
    if (s.status === "blocked") return s.userId === userId ? "mine" : "blocked";
    return "free";
  };

  const renderSector = (sector, sectorKey) => (
    <div key={sectorKey} style={{ marginBottom:40 }}>
      <p style={{ textAlign:"center", fontSize:10, letterSpacing:".18em", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:14 }}>
        {sector.label}
      </p>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
        {sector.filas.map(fila => (
          <div key={fila.id} style={{ display:"flex", alignItems:"center", gap:2 }}>
            {/* Número de fila izquierda */}
            <span style={{ fontSize:8, color:"#445", width:20, textAlign:"right", fontFamily:"monospace" }}>{fila.id}</span>

            {/* Butacas izquierda (impares, de mayor a menor = de afuera hacia el centro) */}
            <div style={{ display:"flex", gap:2 }}>
              {fila.izq.map(n => {
                const seatId = `${fila.id}-${n}`;
                const status = getStatus(seatId);
                return (
                  <div key={seatId}
                    className={`seat ${status}`}
                    style={{ width:14, height:11 }}
                    title={`${seatId}${seats[seatId]?.buyer ? " — "+seats[seatId].buyer : ""}`}
                    onClick={() => adminMode ? setAdminSeat(adminSeat===seatId?null:seatId) : onToggle(seatId)}
                  />
                );
              })}
            </div>

            {/* Pasillo central */}
            <div style={{ width:16 }} />

            {/* Butacas derecha (pares, de menor a mayor = del centro hacia afuera) */}
            <div style={{ display:"flex", gap:2 }}>
              {fila.der.map(n => {
                const seatId = `${fila.id}-${n}`;
                const status = getStatus(seatId);
                return (
                  <div key={seatId}
                    className={`seat ${status}`}
                    style={{ width:14, height:11 }}
                    title={`${seatId}${seats[seatId]?.buyer ? " — "+seats[seatId].buyer : ""}`}
                    onClick={() => adminMode ? setAdminSeat(adminSeat===seatId?null:seatId) : onToggle(seatId)}
                  />
                );
              })}
            </div>

            <span style={{ fontSize:8, color:"#445", width:20, fontFamily:"monospace" }}>{fila.id}</span>
          </div>
        ))}
      </div>

      {/* Popup admin */}
      {adminMode && adminSeat && seats[adminSeat] && (
        <div style={{ background:"var(--dark3)", border:"1px solid var(--gold)", padding:16, marginTop:16, maxWidth:360, margin:"16px auto 0" }}>
          <p style={{ fontSize:13, marginBottom:6 }}>
            <strong style={{ color:"var(--gold)" }}>{adminSeat}</strong> — <strong>{seats[adminSeat].status}</strong>
          </p>
          {seats[adminSeat].buyer && <p style={{ fontSize:12, color:"var(--text-mid)", marginBottom:2 }}>Comprador: {seats[adminSeat].buyer}</p>}
          {seats[adminSeat].dni && <p style={{ fontSize:12, color:"var(--text-mid)", marginBottom:2 }}>DNI: {seats[adminSeat].dni}</p>}
          {seats[adminSeat].alumna && <p style={{ fontSize:12, color:"var(--text-mid)", marginBottom:8 }}>Alumna: {seats[adminSeat].alumna}</p>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
            {seats[adminSeat].status !== "free" && (
              <button className="btn-ghost" style={{ fontSize:10, borderColor:"var(--green-light)", color:"var(--green-light)" }}
                onClick={() => { onActivar(adminSeat); setAdminSeat(null); }}>
                ✓ Liberar
              </button>
            )}
            {seats[adminSeat].status !== "sold" && (
              <button className="btn-ghost" style={{ fontSize:10, borderColor:"var(--red)", color:"var(--red)" }}
                onClick={() => { onAnular(adminSeat); setAdminSeat(null); }}>
                ✗ Anular
              </button>
            )}
            <button className="btn-ghost" style={{ fontSize:10 }} onClick={() => setAdminSeat(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ marginBottom:24 }}><div className="escenario">Escenario</div></div>
      {renderSector(SALA.platea, "platea")}
      <div style={{ height:1, background:"var(--border)", maxWidth:500, margin:"4px auto 28px" }} />
      {renderSector(SALA.pullman, "pullman")}
      {!adminMode && <Legend />}
    </div>
  );
}

function Legend() {
  return (
    <div className="legend" style={{ marginTop:20 }}>
      {[
        { cls:"free",    label:"Libre" },
        { cls:"mine",    label:"Tu selección" },
        { cls:"blocked", label:"Reservada por otro" },
        { cls:"sold",    label:"Vendida" },
      ].map(({ cls, label }) => (
        <div className="legend-item" key={cls}>
          <div className={`legend-dot seat ${cls}`} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function StickyLegend({ show }) {
  if (!show) return null;
  return (
    <div className="sticky-legend">
      {[
        { cls:"free",    label:"Libre" },
        { cls:"mine",    label:"Tu selección" },
        { cls:"blocked", label:"Reservada" },
        { cls:"sold",    label:"Vendida" },
      ].map(({ cls, label }) => (
        <div className="legend-item" key={cls}>
          <div className={`legend-dot seat ${cls}`} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function Loader() {
  return (
    <div style={{ textAlign:"center", padding:80, color:"var(--text-dim)" }}>
      <div style={{ fontSize:32, marginBottom:12 }}>⌛</div>
      <p style={{ fontSize:12, letterSpacing:".15em" }}>CONECTANDO…</p>
    </div>
  );
}
