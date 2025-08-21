import React, { useMemo, useState } from "react";
import html2pdf from "html2pdf.js";

// ###############################################################
// HelpCare Preisrechner – mit PDF-Button (ohne Backend)
// - Fügt Variablen in ein Test‑Template ein
// - Klick auf Button erzeugt Druckdialog (PDF speichern)
// - Nutzt verstecktes <iframe>, damit es auch in Previews funktioniert
// ###############################################################

const CONFIG = {
  waehrung: "EUR",
  fixpreis: 2299,
  pflegestufe1: { 0: 70, 1: 110, 2: 150, 3: 190, 4: 230, 5: 270 },
  pflegestufe2: { 0: 300, 1: 350, 2: 400, 3: 450, 4: 500, 5: 550 },
  zuschlaege: {
    nachteinsaetze: 200,
    fuehrerschein: 125,
    deutsch: { Grund: 150, Mittel: 300, Gut: 400 },
  },
  foerderung: { 0: 0, 1: 0, 2: 347, 3: 599, 4: 800, 5: 990, steuer: 333, verhinderung: 295 },
};

function formatEUR(value) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: CONFIG.waehrung }).format(value);
}

export default function HelpCareRechner() {
  // Kundendaten
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");

  // Angebotskriterien
  const [pflegestufe1, setPflegestufe1] = useState(0);
  const [pflegestufe2, setPflegestufe2] = useState(0);
  const [nacht, setNacht] = useState(false);
  const [fuehrerschein, setFuehrerschein] = useState(false);
  const [deutsch, setDeutsch] = useState("Grund");
  const [foerderungen, setFoerderungen] = useState({ steuer: false, verhinderung: false });

  const result = useMemo(() => {
    let basis = CONFIG.fixpreis;
    basis += CONFIG.pflegestufe1[pflegestufe1] || 0;
    basis += CONFIG.pflegestufe2[pflegestufe2] || 0;
    if (nacht) basis += CONFIG.zuschlaege.nachteinsaetze;
    if (fuehrerschein) basis += CONFIG.zuschlaege.fuehrerschein;
    basis += CONFIG.zuschlaege.deutsch[deutsch] || 0;

    let foerd = 0;
    foerd += CONFIG.foerderung[pflegestufe1] || 0;
    foerd += CONFIG.foerderung[pflegestufe2] || 0;
    if (foerderungen.steuer) foerd += CONFIG.foerderung.steuer;
    if (foerderungen.verhinderung) foerd += CONFIG.foerderung.verhinderung;

    return { netto: basis, mitFoerderung: Math.max(basis - foerd, 0), foerd };
  }, [pflegestufe1, pflegestufe2, nacht, fuehrerschein, deutsch, foerderungen]);

  function toggleFoerd(key) { setFoerderungen((prev) => ({ ...prev, [key]: !prev[key] })); }

  // ---------- TEST-TEMPLATE mit Platzhaltern ----------
  // In der Praxis ersetzt du den HTML-String unten durch DEIN bestehendes Template
  // und behältst die gleiche Ersetzungslogik ({{NAME}}, {{PREIS_NETTO}}, ...)
  function buildHTMLFromTemplate(data) {
    const tpl = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>HelpCare – Angebot</title>
<style>
  body{font-family:Arial,sans-serif;color:#0f172a}
  .wrap{max-width:800px;margin:0 auto;padding:24px}
  h1{font-size:22px;margin:0 0 8px}
  h2{font-size:16px;margin:24px 0 8px}
  table{width:100%;border-collapse:collapse}
  td,th{border:1px solid #e2e8f0;padding:8px;font-size:14px;text-align:left}
  .right{text-align:right}
  .muted{color:#475569}
  .total{font-weight:700}
  @media print { .no-print { display:none } }
</style>
</head>
<body>
  <div class="wrap">
    <h1>HelpCare – Angebot</h1>
    <div class="muted">Datum: {{DATUM}}</div>

    <h2>Kundendaten</h2>
    <table>
      <tr><th>Name</th><td>{{NAME}}</td></tr>
      <tr><th>E‑Mail</th><td>{{EMAIL}}</td></tr>
      <tr><th>Telefon</th><td>{{TELEFON}}</td></tr>
    </table>

    <h2>Angaben</h2>
    <table>
      <tr><th>Pflegestufe P1</th><td>{{PFLEGESTUFE1}}</td></tr>
      <tr><th>Pflegestufe P2</th><td>{{PFLEGESTUFE2}}</td></tr>
      <tr><th>Nachteinsätze</th><td>{{NACHTEINSAETZE}}</td></tr>
      <tr><th>Führerschein</th><td>{{FUEHRERSCHEIN}}</td></tr>
      <tr><th>Deutschkenntnisse</th><td>{{DEUTSCH}}</td></tr>
    </table>

    <h2>Preis</h2>
    <table>
      <tr><td>Fixpreis</td><td class="right">{{PREIS_FIX}}</td></tr>
      <tr><td>Förderung gesamt</td><td class="right">{{FOERDERUNG_GESAMT}}</td></tr>
      <tr><td class="total">Angebotspreis (netto)</td><td class="right total">{{PREIS_NETTO}}</td></tr>
      <tr><td class="total">Preis mit Förderung</td><td class="right total">{{PREIS_MIT_FOERDERUNG}}</td></tr>
    </table>

    <button class="no-print" onclick="window.print()">Als PDF speichern</button>
  </div>
</body>
</html>`;

    // Platzhalter ersetzen
    return Object.entries(data).reduce((acc, [key, val]) => acc.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), String(val ?? "")), tpl);
  }

  async function handleCreatePDF() {
    const datum = new Date().toLocaleDateString("de-DE");
    const html = buildHTMLFromTemplate({
      DATUM: datum,
      NAME: name || "–",
      EMAIL: email || "–",
      TELEFON: telefon || "–",
      PFLEGESTUFE1: `Stufe ${pflegestufe1} (+${CONFIG.pflegestufe1[pflegestufe1]}€)`,
      PFLEGESTUFE2: `Stufe ${pflegestufe2} (+${CONFIG.pflegestufe2[pflegestufe2]}€)`,
      NACHTEINSAETZE: nacht ? `Ja (+${CONFIG.zuschlaege.nachteinsaetze}€)` : "Nein",
      FUEHRERSCHEIN: fuehrerschein ? `Ja (+${CONFIG.zuschlaege.fuehrerschein}€)` : "Nein",
      DEUTSCH: `${deutsch} (+${CONFIG.zuschlaege.deutsch[deutsch]}€)`,
      PREIS_FIX: formatEUR(CONFIG.fixpreis),
      FOERDERUNG_GESAMT: "- " + formatEUR(result.foerd),
      PREIS_NETTO: formatEUR(result.netto),
      PREIS_MIT_FOERDERUNG: formatEUR(result.mitFoerderung),
    });

    // 1) Direkter PDF‑Download via html2pdf.js
    try {
      const filenameSafeName = (name || "Angebot").replace(/[^a-zA-Z0-9_\-ÄÖÜäöüß ]+/g, "").trim() || "Angebot";
      const filename = `HelpCare-Angebot_${filenameSafeName}_${datum}.pdf`;
      const options = {
        margin:       [10, 10, 10, 10], // mm
        filename,
        image:        { type: "jpeg", quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, dpi: 192, letterRendering: true },
        jsPDF:        { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak:    { mode: ["css", "legacy"], avoid: [".no-break"] },
      };

      await html2pdf().set(options).from(html).save();
      return; // erfolgreich gespeichert
    } catch (err) {
      // Fallback auf Druckdialog
      console.warn("html2pdf fehlgeschlagen, nutze Print-Fallback", err);
    }

    // 2) Fallback: Druckdialog über verstecktes iframe (funktioniert oft auch in Previews)
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }
    };
    iframe.srcdoc = html;

    // 3) Alternativ-Fallback: neues Tab öffnen (falls iframe blockiert ist)
    // const w = window.open("", "_blank");
    // if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold mb-4">HelpCare Angebotsrechner</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Eingaben */}
          <section className="bg-white p-4 rounded-2xl shadow-sm">
            <h2 className="text-lg font-medium mb-3">Kundendaten</h2>
            <div className="grid grid-cols-1 gap-3 mb-4">
              <input className="border rounded-xl px-3 py-2" placeholder="Name" value={name} onChange={(e)=>setName(e.target.value)} />
              <input className="border rounded-xl px-3 py-2" placeholder="E‑Mail" value={email} onChange={(e)=>setEmail(e.target.value)} />
              <input className="border rounded-xl px-3 py-2" placeholder="Telefon" value={telefon} onChange={(e)=>setTelefon(e.target.value)} />
            </div>

            <h2 className="text-lg font-medium mb-3">Kriterien</h2>
            <label className="block mb-2">Pflegestufe Person 1</label>
            <select value={pflegestufe1} onChange={(e) => setPflegestufe1(Number(e.target.value))} className="mb-4 w-full border rounded p-2">
              {Object.keys(CONFIG.pflegestufe1).map((key) => (
                <option key={key} value={key}>Stufe {key} (+{CONFIG.pflegestufe1[key]}€)</option>
              ))}
            </select>

            <label className="block mb-2">Pflegestufe Person 2</label>
            <select value={pflegestufe2} onChange={(e) => setPflegestufe2(Number(e.target.value))} className="mb-4 w-full border rounded p-2">
              {Object.keys(CONFIG.pflegestufe2).map((key) => (
                <option key={key} value={key}>Stufe {key} (+{CONFIG.pflegestufe2[key]}€)</option>
              ))}
            </select>

            <div className="mb-4">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={nacht} onChange={(e) => setNacht(e.target.checked)} />
                Nacht­einsätze (+{CONFIG.zuschlaege.nachteinsaetze}€)
              </label>
            </div>

            <div className="mb-4">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={fuehrerschein} onChange={(e) => setFuehrerschein(e.target.checked)} />
                Führerschein (+{CONFIG.zuschlaege.fuehrerschein}€)
              </label>
            </div>

            <label className="block mb-2">Deutschkenntnisse</label>
            <select value={deutsch} onChange={(e) => setDeutsch(e.target.value)} className="mb-4 w-full border rounded p-2">
              {Object.keys(CONFIG.zuschlaege.deutsch).map((key) => (
                <option key={key} value={key}>{key} (+{CONFIG.zuschlaege.deutsch[key]}€)</option>
              ))}
            </select>

            <h3 className="text-md font-medium mt-4 mb-2">Förderung berücksichtigen</h3>
            <label className="block">
              <input type="checkbox" checked={foerderungen.steuer} onChange={() => toggleFoerd("steuer")} /> Steuervorteil ({formatEUR(CONFIG.foerderung.steuer)})
            </label>
            <label className="block">
              <input type="checkbox" checked={foerderungen.verhinderung} onChange={() => toggleFoerd("verhinderung")} /> Verhinderungspflege ({formatEUR(CONFIG.foerderung.verhinderung)})
            </label>
          </section>

          {/* Ergebnisse */}
          <aside className="bg-white p-4 rounded-2xl shadow-sm">
            <h2 className="text-lg font-medium mb-3">Preisübersicht</h2>
            <div className="space-y-2 text-sm">
              <Row label="Angebotspreis (Netto)" value={formatEUR(result.netto)} strong />
              <Row label="Förderung gesamt" value={"-" + formatEUR(result.foerd)} subtle />
              <Row label="Preis mit Förderung" value={formatEUR(result.mitFoerderung)} emphasize />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2">
              <button onClick={handleCreatePDF} className="rounded-2xl bg-slate-900 text-white py-3 text-sm font-medium hover:bg-slate-800">PDF erzeugen</button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, emphasize = false, strong = false, subtle = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-slate-600 ${subtle ? "opacity-80" : ""}`}>{label}</span>
      <span className={strong ? "font-semibold text-slate-900" : (emphasize ? "font-medium text-slate-800" : "text-slate-800")}>{value}</span>
    </div>
  );
}
