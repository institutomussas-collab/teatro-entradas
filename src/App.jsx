import { useState, useEffect, useRef } from "react";
import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, onSnapshot, runTransaction,
  collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs
} from "firebase/firestore";
import { SALA, getAllSeatIds, CONFIG } from "./salaConfig.js";
import { logEvent, getLogs, LOG_EVENTS } from "./logger.js";

const genUserId = () => `u_${Math.random().toString(36).slice(2,9)}_${Date.now()}`;

// ─── EmailJS con adjunto base64 ───────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function enviarMailAdmin({ buyerName, buyerDni, alumnaName, buyerEmail, seats, total, comprobanteFile }) {
  try {
    const base64 = await fileToBase64(comprobanteFile);
    const ext = comprobanteFile.name.split(".").pop();
    await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: CONFIG.EMAILJS_SERVICE_ID,
        template_id: CONFIG.EMAILJS_TEMPLATE_ID,
        user_id: CONFIG.EMAILJS_PUBLIC_KEY,
        template_params: {
          to_email: CONFIG.ADMIN_EMAIL,
          buyer_name: buyerName,
          buyer_dni: buyerDni,
          alumna_name: alumnaName,
          buyer_email: buyerEmail,
          seats: seats.join(", "),
          total: `$${total.toLocaleString("es-AR")} ARS`,
          comprobante_url: `data:image/${ext};base64,${base64}`,
        }
      })
    });
  } catch(e) { console.error("EmailJS:", e); }
}

// ─── Firestore helpers ────────────────────────────────────────────────────────
async function initSalaIfNeeded() {
  const ref = doc(db, "entradas", "sala");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const seats = {};
    for (const id of getAllSeatIds()) seats[id] = { status: "free", userId: null, blockedUntil: null };
    await setDoc(ref, { seats });
  }
  const qSnap = await getDoc(doc(db, "entradas", "queue"));
  if (!qSnap.exists()) await setDoc(doc(db, "entradas", "queue"), { list: [] });
  const tSnap = await getDoc(doc(db, "entradas", "turno"));
  if (!tSnap.exists()) await setDoc(doc(db, "entradas", "turno"), { userId: null, expiresAt: null });
}

async function resetSala() {
  const seats = {};
  for (const id of getAllSeatIds()) seats[id] = { status: "free", userId: null, blockedUntil: null };
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
  const [error, setError]     = useState("");
  const [uploading, setUploading] = useState(false);
  const [buyerName, setBuyerName]         = useState("");
  const [buyerApellido, setBuyerApellido] = useState("");
  const [buyerDni, setBuyerDni]           = useState("");
  const [buyerEmail, setBuyerEmail]       = useState("");
  const [alumnaName, setAlumnaName]       = useState("");
  const [comprobanteFile, setComprobanteFile]       = useState(null);
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
      } catch(e) { console.error(e); }
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
    } catch(e) {
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
    setError(""); setUploading(true);
    try {
      const fullName = `${buyerName} ${buyerApellido}`;
      const total = mySeats.length * CONFIG.PRECIO;

      // Marcar butacas como vendidas
      await runTransaction(db, async tx => {
        const ss = await tx.get(doc(db, "entradas", "sala"));
        const upd = { ...ss.data().seats };
        for (const seatId of mySeats) {
          upd[seatId] = { status: "sold", userId, buyer: fullName, dni: buyerDni, alumna: alumnaName, blockedUntil: null };
        }
        tx.update(doc(db, "entradas", "sala"), { seats: upd });
      });

      // Guardar compra en Firestore
      await addDoc(collection(db, "compras"), {
        userId, buyerName: fullName, buyerDni, buyerEmail, alumnaName,
        seats: mySeats, total, timestamp: serverTimestamp(),
      });

      // Enviar mail con comprobante adjunto
      await enviarMailAdmin({ buyerName: fullName, buyerDni, alumnaName, buyerEmail, seats: mySeats, total, comprobanteFile });

      logEvent(userId, LOG_EVENTS.COMPRA_CONFIRMADA, { seats: mySeats, buyer: fullName });
      setPhase("done");
    } catch(e) {
      console.error(e);
      setError("Hubo un error. Intentá de nuevo.");
      logEvent(userId, LOG_EVENTS.ERROR, { msg: e.message });
    }
    setUploading(false);
  };

  const total = mySeats.length * CONFIG.PRECIO;

  return (
    <div style={{ minHeight:"100vh", background:"var(--dark)" }}>
      <div className="top-stripe" />
      <header className="site-header">
        <p className="eyebrow">Entradas Online</p>
        <h1 className="site-title" style={{ fontSize:"clamp(42px,9vw,90px)", letterSpacing:".04em" }}>{CONFIG.EVENTO_NOMBRE}</h1>
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
                <button className="btn-primary" onClick={() => setPhase("formulario")} style={{ width:"100%" }}>
                  Continuar → Datos y pago
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "formulario" && (
          <div style={{ maxWidth:520, margin:"0 auto" }}>
            <button className="btn-ghost" onClick={() => setPhase("mapa")} style={{ marginBottom:20, fontSize:11 }}>
              ← Volver al mapa
            </button>
            <div className="card">
              <h2 style={{ fontSize:26, marginBottom:6 }}>Tus datos</h2>
              <p style={{ fontSize:13, color:"var(--text-mid)", marginBottom:24 }}>
                Butacas: <strong style={{ color:"var(--gold)" }}>{mySeats.join(", ")}</strong>
                {" · "}Total: <strong style={{ color:"var(--gold)" }}>${total.toLocaleString("es-AR")}</strong>
              </p>
              <div style={{ display:"grid", gap:12, marginBottom:24 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <label style={{ fontSize:11, letterSpacing:".1em", color:"var(--text-dim)", display:"block", marginBottom:6 }}>NOMBRE</label>
                    <input placeholder="Tu nombre" value={buyerName} onChange={e => setBuyerName(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize:11, letterSpacing:".1em", color:"var(--text-dim)", display:"block", marginBottom:6 }}>APELLIDO</label>
                    <input placeholder="Tu apellido" value={buyerApellido} onChange={e => setBuyerApellido(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:11, letterSpacing:".1em", color:"var(--text-dim)", display:"block", marginBottom:6 }}>DNI</label>
                  <input placeholder="Número de DNI" value={buyerDni} onChange={e => setBuyerDni(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize:11, letterSpacing:".1em", color:"var(--text-dim)", display:"block", marginBottom:6 }}>EMAIL</label>
                  <input placeholder="tucorreo@email.com" type="email" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize:11, letterSpacing:".1em", color:"var(--text-dim)", display:"block", marginBottom:6 }}>NOMBRE Y APELLIDO DE LA ALUMNA QUE BAILA</label>
                  <input placeholder="Nombre completo de la alumna" value={alumnaName} onChange={e => setAlumnaName(e.target.value)} />
                </div>
              </div>

              <div style={{ borderTop:"1px solid var(--border)", paddingTop:24, marginBottom:24 }}>
                <h3 style={{ fontSize:18, marginBottom:6 }}>Comprobante de pago</h3>
                <p style={{ fontSize:12, color:"var(--text-mid)", marginBottom:16, lineHeight:1.6 }}>
                  Realizá la transferencia y adjuntá la foto o captura. Te llegará a vos por mail junto con los datos de la reserva.
                </p>
                <label style={{ display:"block", border:"2px dashed var(--border)", padding:28, textAlign:"center", cursor:"pointer", color:"var(--text-dim)", fontSize:13, transition:"border-color .2s" }}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor="var(--gold)"; }}
                  onDragLeave={e => { e.currentTarget.style.borderColor="var(--border)"; }}
                  onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor="var(--border)"; const f=e.dataTransfer.files[0]; if(f){setComprobanteFile(f);setComprobantePreview(URL.createObjectURL(f));} }}
                >
                  <input type="file" accept="image/*,.pdf" style={{ display:"none" }}
                    onChange={e => { const f=e.target.files[0]; if(f){setComprobanteFile(f);setComprobantePreview(URL.createObjectURL(f));} }} />
                  {comprobantePreview ? (
                    <div>
                      <img src={comprobantePreview} alt="preview" style={{ maxHeight:160, maxWidth:"100%", marginBottom:8, objectFit:"contain" }} />
                      <p style={{ fontSize:12, color:"var(--gold)" }}>✓ {comprobanteFile.name}</p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize:32, marginBottom:8 }}>📎</div>
                      <p>Tocá para adjuntar o arrastrá la imagen</p>
                      <p style={{ fontSize:11, marginTop:4, color:"#444" }}>JPG, PNG o PDF</p>
                    </div>
                  )}
                </label>
              </div>

              {error && <p style={{ color:"#e05050", fontSize:13, marginBottom:12 }}>{error}</p>}
              <button className="btn-primary" onClick={confirmarCompra} disabled={uploading} style={{ width:"100%" }}>
                {uploading ? "Enviando comprobante…" : "Confirmar reserva"}
              </button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="ticket">
            <div style={{ fontSize:52, marginBottom:14 }}>🎟️</div>
            <h2 style={{ fontSize:34, marginBottom:8 }}>¡Reserva confirmada!</h2>
            <p style={{ fontSize:14, color:"var(--gold-light)", marginBottom:24, lineHeight:1.6 }}>
              Tu comprobante fue recibido. El equipo de Mussas lo verificará a la brevedad.
            </p>
            <div style={{ borderTop:"1px solid var(--border)", borderBottom:"1px solid var(--border)", padding:"20px 0", marginBottom:20 }}>
              <p style={{ fontSize:11, color:"var(--text-dim)", letterSpacing:".12em", marginBottom:10 }}>TUS BUTACAS</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
                {mySeats.map(s => <span key={s} className="seat-tag">{s}</span>)}
              </div>
              <p style={{ fontSize:16, color:"var(--gold)", marginTop:14 }}>${total.toLocaleString("es-AR")} ARS</p>
            </div>
            <p style={{ fontSize:13, color:"var(--text-mid)", lineHeight:1.7 }}>
              Recordá acercarte al instituto en los horarios habituales para abonar el saldo y retirar tus entradas físicas.<br />
              <strong style={{ color:"var(--gold-light)" }}>Las entradas son imprescindibles para ingresar a la sala.</strong>
            </p>
          </div>
        )}
      </main>

      {toast && (
        <div style={{ position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)", background: toast.type==="error"?"#3a1010":toast.type==="warn"?"#2e2010":"var(--dark3)", border:`1px solid ${toast.type==="error"?"var(--red)":toast.type==="warn"?"var(--gold)":"#333"}`, color: toast.type==="warn"?"var(--gold-light)":"var(--cream)", padding:"12px 24px", fontSize:14, zIndex:100, maxWidth:340, textAlign:"center", boxShadow:"0 4px 24px rgba(0,0,0,.5)", lineHeight:1.5 }}>
          {toast.msg}
        </div>
      )}
      <StickyLegend show={phase === "mapa"} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState("");
  const [passError, setPassError] = useState("");
  const [seats, setSeats] = useState({});
  const [logs, setLogs] = useState([]);
  const [compras, setCompras] = useState([]);
  const [tab, setTab] = useState("sala");
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

  if (!authed) return (
    <div style={{ minHeight:"100vh", background:"var(--dark)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div className="top-stripe" style={{ position:"fixed", top:0, left:0, right:0 }} />
      <div className="card" style={{ maxWidth:360, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:36, marginBottom:12 }}>🔐</div>
        <h2 style={{ fontSize:24, marginBottom:20 }}>Panel Admin</h2>
        <input type="password" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} style={{ marginBottom:12 }} />
        {passError && <p style={{ color:"#e05050", fontSize:13, marginBottom:10 }}>{passError}</p>}
        <button className="btn-primary" onClick={login} style={{ width:"100%" }}>Ingresar</button>
      </div>
    </div>
  );

  const soldSeats = Object.entries(seats).filter(([,s])=>s.status==="sold");
  const blockedSeats = Object.entries(seats).filter(([,s])=>s.status==="blocked");
  const freeSeats = Object.entries(seats).filter(([,s])=>s.status==="free");

  return (
    <div style={{ minHeight:"100vh", background:"var(--dark)" }}>
      <div className="top-stripe" />
      <header style={{ padding:"20px 24px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom:4 }}>Panel Admin</p>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:26 }}>Mussas — Función 2026</h1>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button className="btn-ghost" style={{ fontSize:11, borderColor:"var(--red)", color:"var(--red)" }} disabled={resetting}
            onClick={async()=>{ if(!confirm("¿Resetear toda la sala?"))return; setResetting(true); await resetSala(); setResetting(false); }}>
            {resetting?"Reseteando…":"🗑 Resetear sala"}
          </button>
          <a href="/"><button className="btn-ghost" style={{ fontSize:11 }}>← Volver al sitio</button></a>
        </div>
      </header>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:1, background:"var(--border)" }}>
        {[{label:"Vendidas",value:soldSeats.length,color:"var(--red)"},{label:"Reservadas",value:blockedSeats.length,color:"var(--gold)"},{label:"Libres",value:freeSeats.length,color:"var(--green-light)"},{label:"Compras",value:compras.length,color:"var(--cream)"}].map(({label,value,color})=>(
          <div key={label} style={{ background:"var(--dark2)", padding:"18px 20px", textAlign:"center" }}>
            <div style={{ fontSize:30, fontFamily:"'Archivo Narrow',sans-serif", fontWeight:600, color }}>{value}</div>
            <div style={{ fontSize:10, letterSpacing:".12em", color:"var(--text-dim)", marginTop:4 }}>{label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", borderBottom:"1px solid var(--border)", padding:"0 24px" }}>
        {[["sala","Sala"],["compras","Compras"],["logs","Log"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ background:"none", border:"none", borderBottom:tab===id?"2px solid var(--gold)":"2px solid transparent", color:tab===id?"var(--gold)":"var(--text-dim)", fontFamily:"'Archivo Narrow',sans-serif", fontSize:13, letterSpacing:".08em", padding:"14px 20px", cursor:"pointer", textTransform:"uppercase" }}>{label}</button>
        ))}
      </div>

      <div style={{ padding:24, maxWidth:1100, margin:"0 auto" }}>
        {tab==="sala" && (
          <div>
            <p style={{ fontSize:13, color:"var(--text-mid)", marginBottom:20 }}>Tocá una butaca para gestionarla.</p>
            <SalaMap seats={seats} mySeats={[]} onToggle={()=>{}} userId="ADMIN" adminMode onActivar={activarButaca} onAnular={anularButaca} />
          </div>
        )}

        {tab==="compras" && (
          <div>
            {compras.length===0 && <p style={{ color:"var(--text-dim)", fontSize:13 }}>No hay compras registradas.</p>}
            <div style={{ display:"grid", gap:10 }}>
              {compras.map(c=>(
                <div key={c.id} style={{ background:"var(--dark2)", border:"1px solid var(--border)", padding:"20px 24px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", flexWrap:"wrap", gap:8, marginBottom:12 }}>
                    <div>
                      <p style={{ fontSize:16, fontWeight:600, marginBottom:2 }}>{c.buyerName}</p>
                      <p style={{ fontSize:13, color:"var(--text-mid)" }}>DNI: {c.buyerDni} · Email: {c.buyerEmail}</p>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <p style={{ fontSize:16, color:"var(--gold)", fontWeight:600 }}>${(c.total||0).toLocaleString("es-AR")} ARS</p>
                      <p style={{ fontSize:11, color:"var(--text-dim)" }}>{c.timestamp?.toDate?c.timestamp.toDate().toLocaleString("es-AR"):"—"}</p>
                    </div>
                  </div>
                  <div style={{ borderTop:"1px solid var(--border)", paddingTop:10, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                    <div>
                      <p style={{ fontSize:13, color:"var(--gold-light)", marginBottom:2 }}>Alumna: <strong>{c.alumnaName}</strong></p>
                      <p style={{ fontSize:12, color:"var(--text-dim)" }}>Butacas: {(c.seats||[]).join(", ")}</p>
                    </div>
                    <div style={{ fontSize:11, color:"var(--text-dim)", fontStyle:"italic" }}>
                      📧 Comprobante enviado por mail
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="logs" && (
          <div>
            <button className="btn-ghost" style={{ marginBottom:16, fontSize:11 }} onClick={()=>getLogs(300).then(setLogs)}>↻ Actualizar</button>
            <div style={{ display:"grid", gap:4 }}>
              {logs.map(l=>(
                <div key={l.id} style={{ background:"var(--dark2)", border:"1px solid var(--border)", padding:"10px 16px", display:"grid", gridTemplateColumns:"160px 1fr auto", gap:12, alignItems:"center", fontSize:12 }}>
                  <span style={{ color:"var(--text-dim)", fontFamily:"monospace", fontSize:10 }}>{l.timestamp?.toDate?l.timestamp.toDate().toLocaleString("es-AR"):"—"}</span>
                  <span><span style={{ color:"var(--gold)", marginRight:8 }}>{l.event}</span>{l.details&&Object.keys(l.details).length>0&&<span style={{ color:"var(--text-dim)" }}>· {JSON.stringify(l.details)}</span>}</span>
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
    if (s.status === "sold") return "sold";
    if (s.status === "blocked") return s.userId === userId ? "mine" : "blocked";
    return "free";
  };

  const allFilas = [...SALA.platea.filas, ...SALA.pullman.filas];
  const maxIzq = Math.max(...allFilas.map(f => f.izq.length));
  const SW = 14, SG = 2, AISLE = 24;

  const renderSector = (sector, sectorKey) => (
    <div key={sectorKey} style={{ marginBottom:36 }}>
      <p style={{ textAlign:"center", fontSize:10, letterSpacing:".18em", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:12 }}>
        {sector.label}
      </p>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
        {sector.filas.map(fila => {
          const padIzq = maxIzq - fila.izq.length;
          return (
            <div key={fila.id} style={{ display:"flex", alignItems:"center" }}>
              <span style={{ fontSize:8, color:"#556", width:24, textAlign:"right", marginRight:3, fontFamily:"monospace", flexShrink:0 }}>{fila.id}</span>
              {/* Lado izquierdo alineado al pasillo */}
              <div style={{ display:"flex", gap:SG, width: maxIzq*(SW+SG)-SG, justifyContent:"flex-end" }}>
                {Array(padIzq).fill(null).map((_,i) => <div key={i} style={{ width:SW, height:11, flexShrink:0 }} />)}
                {fila.izq.map(n => {
                  const sid = `${fila.id}-${n}`;
                  return <div key={sid} className={`seat ${getStatus(sid)}`} style={{ width:SW, height:11, flexShrink:0 }} title={`Butaca ${sid}`} onClick={() => adminMode ? setAdminSeat(adminSeat===sid?null:sid) : onToggle(sid)} />;
                })}
              </div>
              {/* Pasillo */}
              <div style={{ width:AISLE, flexShrink:0 }} />
              {/* Lado derecho */}
              <div style={{ display:"flex", gap:SG }}>
                {fila.der.map(n => {
                  const sid = `${fila.id}-${n}`;
                  return <div key={sid} className={`seat ${getStatus(sid)}`} style={{ width:SW, height:11, flexShrink:0 }} title={`Butaca ${sid}`} onClick={() => adminMode ? setAdminSeat(adminSeat===sid?null:sid) : onToggle(sid)} />;
                })}
              </div>
              <span style={{ fontSize:8, color:"#556", width:24, marginLeft:3, fontFamily:"monospace", flexShrink:0 }}>{fila.id}</span>
            </div>
          );
        })}
      </div>

      {adminMode && adminSeat && seats[adminSeat] && (
        <div style={{ background:"var(--dark3)", border:"1px solid var(--gold)", padding:16, marginTop:16, maxWidth:360, margin:"16px auto 0" }}>
          <p style={{ fontSize:13, marginBottom:6 }}><strong style={{ color:"var(--gold)" }}>{adminSeat}</strong> — <strong>{seats[adminSeat].status}</strong></p>
          {seats[adminSeat].buyer && <p style={{ fontSize:12, color:"var(--text-mid)", marginBottom:2 }}>Comprador: {seats[adminSeat].buyer}</p>}
          {seats[adminSeat].dni && <p style={{ fontSize:12, color:"var(--text-mid)", marginBottom:2 }}>DNI: {seats[adminSeat].dni}</p>}
          {seats[adminSeat].alumna && <p style={{ fontSize:12, color:"var(--text-mid)", marginBottom:8 }}>Alumna: {seats[adminSeat].alumna}</p>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
            {seats[adminSeat].status!=="free" && <button className="btn-ghost" style={{ fontSize:10, borderColor:"var(--green-light)", color:"var(--green-light)" }} onClick={()=>{onActivar(adminSeat);setAdminSeat(null);}}>✓ Liberar</button>}
            {seats[adminSeat].status!=="sold" && <button className="btn-ghost" style={{ fontSize:10, borderColor:"var(--red)", color:"var(--red)" }} onClick={()=>{onAnular(adminSeat);setAdminSeat(null);}}>✗ Anular</button>}
            <button className="btn-ghost" style={{ fontSize:10 }} onClick={()=>setAdminSeat(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ textAlign:"center", overflowX:"auto" }}>
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
      {[{cls:"free",label:"Libre"},{cls:"mine",label:"Tu selección"},{cls:"blocked",label:"Reservada por otro"},{cls:"sold",label:"Vendida"}].map(({cls,label})=>(
        <div className="legend-item" key={cls}><div className={`legend-dot seat ${cls}`} /><span>{label}</span></div>
      ))}
    </div>
  );
}

function StickyLegend({ show }) {
  if (!show) return null;
  return (
    <div className="sticky-legend">
      {[{cls:"free",label:"Libre"},{cls:"mine",label:"Tu selección"},{cls:"blocked",label:"Reservada"},{cls:"sold",label:"Vendida"}].map(({cls,label})=>(
        <div className="legend-item" key={cls}><div className={`legend-dot seat ${cls}`} /><span>{label}</span></div>
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
