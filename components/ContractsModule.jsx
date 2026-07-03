"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  FileText, Plus, X, Loader2, Download, Upload, CheckCircle2,
  AlertTriangle, Clock, Trash2, Eye, DollarSign, Calendar,
  RefreshCw, ChevronDown, Building2
} from "lucide-react";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const fmtBRL = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const daysUntil = (d) => {
  if (!d) return null;
  const diff = new Date(d + "T00:00:00") - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const STATUS_CONFIG = {
  rascunho:  { label: "Rascunho",            color: "#8993A6", bg: "#8993A620" },
  enviado:   { label: "Aguard. assinatura",  color: "#FBBF24", bg: "#FBBF2420" },
  assinado:  { label: "Assinado",            color: "#2DD4BF", bg: "#2DD4BF20" },
  ativo:     { label: "Ativo",               color: "#2DD4BF", bg: "#2DD4BF20" },
  vencendo:  { label: "Vencendo em breve",   color: "#FB923C", bg: "#FB923C20" },
  vencido:   { label: "Vencido",             color: "#FB7185", bg: "#FB718520" },
  cancelado: { label: "Cancelado",           color: "#5B6577", bg: "#5B657720" },
};

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.rascunho;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 10px",
      borderRadius: 999, fontSize: 12, fontWeight: 600,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}40`,
    }}>{cfg.label}</span>
  );
}

// ---------------------------------------------------------------------------
// PDF GENERATION (usando jsPDF via CDN carregado dinamicamente)
// ---------------------------------------------------------------------------

async function loadJsPDF() {
  if (window.jspdf) return window.jspdf.jsPDF;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function generateContractPDF(contract) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const W = 210, margin = 20, lineH = 7, maxW = W - margin * 2;
  let y = margin;

  const addText = (text, x, size = 10, style = "normal", color = [30, 30, 30]) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
    doc.text(String(text || ""), x, y);
  };

  const addWrappedText = (text, size = 10, indent = 0) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(String(text || ""), maxW - indent);
    lines.forEach((line) => {
      if (y > 270) { doc.addPage(); y = margin; }
      doc.text(line, margin + indent, y);
      y += lineH * 0.85;
    });
    y += 2;
  };

  const addLine = (color = [220, 220, 220]) => {
    doc.setDrawColor(...color);
    doc.line(margin, y, W - margin, y);
    y += 5;
  };

  const checkPage = (space = 20) => {
    if (y + space > 270) { doc.addPage(); y = margin; }
  };

  // ---- CABEÇALHO ----
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 35, "F");

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(45, 212, 191);
  doc.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS", margin, 16);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  doc.text(contract.title || "Contrato", margin, 26);
  doc.text(`Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, W - margin, 26, { align: "right" });

  y = 45;

  // ---- PARTES ----
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y - 4, maxW, 40, 3, 3, "F");

  addText("CONTRATANTE (AGÊNCIA)", margin + 5, 9, "bold", [100, 100, 100]);
  y += 7;
  addText(contract.agency_name || "—", margin + 5, 12, "bold", [15, 23, 42]);
  y += 7;
  if (contract.agency_cnpj) { addText(`CNPJ: ${contract.agency_cnpj}`, margin + 5, 10, "normal", [80, 80, 80]); y += 6; }
  if (contract.agency_signer) { addText(`Representado por: ${contract.agency_signer}`, margin + 5, 10, "normal", [80, 80, 80]); y += 6; }

  y += 5;
  doc.setFillColor(235, 240, 248);
  doc.roundedRect(margin, y - 4, maxW, 22, 3, 3, "F");
  addText("CONTRATADO (CLIENTE)", margin + 5, 9, "bold", [100, 100, 100]);
  y += 7;
  addText(contract.client_name || "—", margin + 5, 12, "bold", [15, 23, 42]);
  y += 10;

  y += 8;
  addLine();

  // ---- SERVIÇO ----
  checkPage(30);
  addText("1. OBJETO DO CONTRATO", margin, 12, "bold", [15, 23, 42]);
  y += 8;
  addWrappedText(contract.service_description || "Prestação de serviços de gestão de tráfego pago.");

  // ---- VALORES ----
  checkPage(35);
  addLine();
  addText("2. VALORES E CONDIÇÕES DE PAGAMENTO", margin, 12, "bold", [15, 23, 42]);
  y += 8;

  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y - 4, maxW, contract.setup_fee > 0 ? 28 : 20, 3, 3, "F");

  addText("Valor mensal:", margin + 5, 10, "normal", [80, 80, 80]);
  addText(fmtBRL(contract.monthly_value), margin + 60, 10, "bold", [15, 23, 42]);
  y += 7;
  if (contract.setup_fee > 0) {
    addText("Taxa de setup:", margin + 5, 10, "normal", [80, 80, 80]);
    addText(fmtBRL(contract.setup_fee), margin + 60, 10, "bold", [15, 23, 42]);
    y += 7;
  }
  addText("Renovação:", margin + 5, 10, "normal", [80, 80, 80]);
  addText(contract.renewal_type === "automatica" ? "Automática" : "Manual", margin + 60, 10, "normal", [15, 23, 42]);
  y += 10;

  // ---- VIGÊNCIA ----
  checkPage(25);
  addLine();
  addText("3. VIGÊNCIA", margin, 12, "bold", [15, 23, 42]);
  y += 8;
  addText(`Início: ${fmtDate(contract.start_date)}`, margin, 10, "normal", [40, 40, 40]);
  y += 6;
  addText(`Término: ${contract.end_date ? fmtDate(contract.end_date) : "Indeterminado"}`, margin, 10, "normal", [40, 40, 40]);
  y += 10;

  // ---- CLÁUSULAS ----
  if (contract.clauses) {
    checkPage(20);
    addLine();
    addText("4. CLÁUSULAS E CONDIÇÕES GERAIS", margin, 12, "bold", [15, 23, 42]);
    y += 8;
    addWrappedText(contract.clauses);
  }

  // ---- ASSINATURAS ----
  checkPage(55);
  if (y > 220) { doc.addPage(); y = margin; }
  y = Math.max(y, 230);

  addLine([200, 200, 200]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);

  const sigY = y + 5;
  doc.text("_".repeat(40), margin, sigY + 15);
  doc.text(contract.agency_signer || "Contratante", margin, sigY + 22);
  doc.text(contract.agency_name || "Agência", margin, sigY + 28);

  doc.text("_".repeat(40), W / 2 + 5, sigY + 15);
  doc.text(contract.client_name || "Contratado", W / 2 + 5, sigY + 22);
  doc.text("Cliente", W / 2 + 5, sigY + 28);

  y = sigY + 35;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Local e data: _________________________, ___/___/______`, margin, y);

  // Rodapé
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text("Documento gerado pelo TrafficHub · Para assinatura digital use Gov.br", W / 2, 290, { align: "center" });

  doc.save(`contrato-${(contract.client_name || "cliente").toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ---------------------------------------------------------------------------
// FORM MODAL
// ---------------------------------------------------------------------------

function ContractForm({ clients, initial, onSave, onClose }) {
  const empty = {
    client_id: "", client_name: "", title: "Contrato de Gestão de Tráfego Pago",
    service_description: "", clauses: "", monthly_value: 0, setup_fee: 0,
    start_date: new Date().toISOString().slice(0, 10), end_date: "",
    renewal_type: "automatica", status: "rascunho",
    agency_name: "", agency_cnpj: "", agency_signer: "",
  };
  const [form, setForm] = useState(initial || empty);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleClientChange = (clientId) => {
    const client = clients.find((c) => c.id === clientId);
    set("client_id", clientId);
    if (client) set("client_name", client.name);
  };

  return (
    <div style={{ maxHeight: "75vh", overflowY: "auto", paddingRight: 4 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <label className="field" style={{ gridColumn: "1/-1" }}>
          <span className="field-label">Título do contrato</span>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Cliente</span>
          <select value={form.client_id} onChange={(e) => handleClientChange(e.target.value)}>
            <option value="">Selecione um cliente</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Nome do cliente (no contrato)</span>
          <input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} placeholder="Nome completo ou razão social" />
        </label>
      </div>

      <div style={{ background: "#0E1117", border: "1px solid #262C3A", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#8993A6", fontWeight: 600, marginBottom: 10 }}>DADOS DA SUA AGÊNCIA</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label className="field">
            <span className="field-label">Nome da agência</span>
            <input value={form.agency_name} onChange={(e) => set("agency_name", e.target.value)} placeholder="Ex: Agência XYZ" />
          </label>
          <label className="field">
            <span className="field-label">CNPJ (opcional)</span>
            <input value={form.agency_cnpj} onChange={(e) => set("agency_cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
          </label>
          <label className="field" style={{ gridColumn: "1/-1" }}>
            <span className="field-label">Seu nome (assinante)</span>
            <input value={form.agency_signer} onChange={(e) => set("agency_signer", e.target.value)} placeholder="Seu nome completo" />
          </label>
        </div>
      </div>

      <label className="field">
        <span className="field-label">Descrição do serviço</span>
        <textarea rows={3} value={form.service_description} onChange={(e) => set("service_description", e.target.value)}
          placeholder="Ex: Gestão de campanhas de tráfego pago no Meta Ads (Facebook e Instagram) e Google Ads, incluindo criação, otimização e relatórios mensais." />
      </label>

      <label className="field">
        <span className="field-label">Cláusulas e condições (texto livre)</span>
        <textarea rows={6} value={form.clauses} onChange={(e) => set("clauses", e.target.value)}
          placeholder="Escreva aqui as cláusulas do contrato. Ex:&#10;&#10;1. O pagamento deverá ser realizado até o dia 5 de cada mês.&#10;2. O cancelamento deve ser solicitado com 30 dias de antecedência.&#10;3. Os resultados dependem de fatores externos e não são garantidos..." />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <label className="field">
          <span className="field-label">Valor mensal (R$)</span>
          <input type="number" value={form.monthly_value} onChange={(e) => set("monthly_value", Number(e.target.value))} />
        </label>
        <label className="field">
          <span className="field-label">Taxa de setup (R$)</span>
          <input type="number" value={form.setup_fee} onChange={(e) => set("setup_fee", Number(e.target.value))} />
        </label>
        <label className="field">
          <span className="field-label">Renovação</span>
          <select value={form.renewal_type} onChange={(e) => set("renewal_type", e.target.value)}>
            <option value="automatica">Automática</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Data de início</span>
          <input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Data de término</span>
          <input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Status</span>
          <select value={form.status} onChange={(e) => set("status", e.target.value)}>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={saving || !form.client_name || !form.title}
          onClick={async () => { setSaving(true); await onSave(form); setSaving(false); }}>
          {saving ? <Loader2 size={14} className="spin" /> : <FileText size={14} />}
          Salvar contrato
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CONTRACT DETAIL MODAL
// ---------------------------------------------------------------------------

function ContractDetail({ contract, onClose, onUpdate, onDelete }) {
  const [generating, setGenerating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const days = daysUntil(contract.end_date);

  const changeStatus = async (status) => {
    setUpdating(true);
    const updates = { status };
    if (status === "assinado") updates.signed_at = new Date().toISOString();
    await onUpdate(contract.id, updates);
    setUpdating(false);
  };

  const handleGeneratePDF = async () => {
    setGenerating(true);
    try { await generateContractPDF(contract); } catch (e) { alert("Erro ao gerar PDF: " + e.message); }
    setGenerating(false);
  };

  return (
    <div style={{ maxHeight: "75vh", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <StatusPill status={contract.status} />
        {days !== null && days <= 30 && days > 0 && (
          <span style={{ fontSize: 12, color: "#FB923C", background: "#FB923C20", padding: "3px 10px", borderRadius: 999, border: "1px solid #FB923C40" }}>
            ⏰ Vence em {days} dias
          </span>
        )}
        {days !== null && days <= 0 && (
          <span style={{ fontSize: 12, color: "#FB7185", background: "#FB718520", padding: "3px 10px", borderRadius: 999, border: "1px solid #FB718540" }}>
            ❌ Vencido há {Math.abs(days)} dias
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "#0E1117", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#8993A6", marginBottom: 4 }}>CLIENTE</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{contract.client_name}</div>
        </div>
        <div style={{ background: "#0E1117", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#8993A6", marginBottom: 4 }}>VALOR MENSAL</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#2DD4BF" }}>{fmtBRL(contract.monthly_value)}</div>
        </div>
        <div style={{ background: "#0E1117", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#8993A6", marginBottom: 4 }}>VIGÊNCIA</div>
          <div style={{ fontSize: 13 }}>{fmtDate(contract.start_date)} → {contract.end_date ? fmtDate(contract.end_date) : "Indeterminado"}</div>
        </div>
        <div style={{ background: "#0E1117", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#8993A6", marginBottom: 4 }}>RENOVAÇÃO</div>
          <div style={{ fontSize: 13 }}>{contract.renewal_type === "automatica" ? "Automática" : "Manual"}</div>
        </div>
      </div>

      {contract.service_description && (
        <div style={{ background: "#0E1117", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#8993A6", marginBottom: 6 }}>SERVIÇO</div>
          <div style={{ fontSize: 13, color: "#D5D9E2", lineHeight: 1.6 }}>{contract.service_description}</div>
        </div>
      )}

      {contract.clauses && (
        <div style={{ background: "#0E1117", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#8993A6", marginBottom: 6 }}>CLÁUSULAS</div>
          <div style={{ fontSize: 13, color: "#D5D9E2", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{contract.clauses}</div>
        </div>
      )}

      <div style={{ borderTop: "1px solid #1B202C", paddingTop: 14 }}>
        <div style={{ fontSize: 12, color: "#8993A6", marginBottom: 10, fontWeight: 600 }}>AÇÕES</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={handleGeneratePDF} disabled={generating}>
            {generating ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            Baixar PDF
          </button>
          {contract.status === "rascunho" && (
            <button className="btn btn-ghost" onClick={() => changeStatus("enviado")} disabled={updating}>
              <CheckCircle2 size={14} /> Marcar como enviado
            </button>
          )}
          {contract.status === "enviado" && (
            <button className="btn btn-ghost" onClick={() => changeStatus("assinado")} disabled={updating}>
              <CheckCircle2 size={14} /> Marcar como assinado
            </button>
          )}
          {(contract.status === "assinado" || contract.status === "enviado") && (
            <button className="btn btn-ghost" onClick={() => changeStatus("ativo")} disabled={updating}>
              <CheckCircle2 size={14} /> Ativar contrato
            </button>
          )}
          {contract.status !== "cancelado" && (
            <button className="btn btn-ghost" onClick={() => changeStatus("cancelado")} disabled={updating}
              style={{ color: "#FB7185" }}>
              <X size={14} /> Cancelar contrato
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => onDelete(contract.id)} style={{ color: "#FB7185", marginLeft: "auto" }}>
            <Trash2 size={14} /> Excluir
          </button>
        </div>

        {contract.status === "enviado" && (
          <div style={{ marginTop: 12, padding: 10, background: "#FBBF2415", border: "1px solid #FBBF2440", borderRadius: 8, fontSize: 12, color: "#FBBF24" }}>
            💡 Para assinatura gratuita com validade jurídica, peça ao cliente para acessar <strong>gov.br</strong>, fazer login e assinar o PDF que você enviou.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN VIEW
// ---------------------------------------------------------------------------

export default function ContractsModule({ userId, clients }) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState(null);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contracts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // Atualiza status automaticamente
    const today = new Date();
    const updated = (data || []).map((c) => {
      if (c.status === "cancelado" || c.status === "vencido") return c;
      if (c.end_date) {
        const days = daysUntil(c.end_date);
        if (days <= 0 && c.status === "ativo") return { ...c, status: "vencido" };
        if (days <= 30 && days > 0 && c.status === "ativo") return { ...c, status: "vencendo" };
      }
      return c;
    });
    setContracts(updated);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const saveContract = async (form) => {
    const row = {
      user_id: userId,
      client_id: form.client_id || null,
      client_name: form.client_name,
      title: form.title,
      service_description: form.service_description,
      clauses: form.clauses,
      monthly_value: Number(form.monthly_value) || 0,
      setup_fee: Number(form.setup_fee) || 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      renewal_type: form.renewal_type,
      status: form.status,
      agency_name: form.agency_name,
      agency_cnpj: form.agency_cnpj,
      agency_signer: form.agency_signer,
    };
    const { error } = await supabase.from("contracts").insert(row);
    if (error) { alert("Erro ao salvar: " + error.message); return; }
    setShowForm(false);
    fetchContracts();
  };

  const updateContract = async (id, updates) => {
    await supabase.from("contracts").update(updates).eq("id", id);
    setViewing((v) => v ? { ...v, ...updates } : v);
    fetchContracts();
  };

  const deleteContract = async (id) => {
    await supabase.from("contracts").delete().eq("id", id);
    setViewing(null);
    fetchContracts();
  };

  // Métricas resumo
  const ativos = contracts.filter((c) => ["ativo", "assinado"].includes(c.status));
  const vencendo = contracts.filter((c) => c.status === "vencendo");
  const mrr = ativos.reduce((a, c) => a + Number(c.monthly_value || 0), 0);

  return (
    <div className="view">
      <div className="view-header view-header-row">
        <div>
          <h1>Contratos</h1>
          <p className="view-sub">{contracts.length} contratos · {fmtBRL(mrr)} MRR</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={15} /> Novo contrato
        </button>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="card kpi-card">
          <div className="kpi-top"><span className="kpi-label">MRR contratos ativos</span><DollarSign size={16} color="#5B6577" /></div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{fmtBRL(mrr)}</div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-top"><span className="kpi-label">Contratos ativos</span><CheckCircle2 size={16} color="#5B6577" /></div>
          <div className="kpi-value">{ativos.length}</div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-top"><span className="kpi-label">Vencendo em 30 dias</span><AlertTriangle size={16} color="#FB923C" /></div>
          <div className="kpi-value" style={{ color: vencendo.length > 0 ? "#FB923C" : undefined }}>{vencendo.length}</div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-top"><span className="kpi-label">Aguard. assinatura</span><Clock size={16} color="#FBBF24" /></div>
          <div className="kpi-value">{contracts.filter((c) => c.status === "enviado").length}</div>
        </div>
      </div>

      {/* Alertas */}
      {vencendo.length > 0 && (
        <div style={{ background: "#FB923C15", border: "1px solid #FB923C40", borderRadius: 10, padding: "12px 16px", marginBottom: 18, fontSize: 13, color: "#FB923C" }}>
          ⚠️ <strong>{vencendo.length} contrato(s)</strong> vencendo nos próximos 30 dias: {vencendo.map((c) => c.client_name).join(", ")}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, color: "#8993A6" }}>
          <Loader2 size={16} className="spin" /> Carregando contratos...
        </div>
      ) : contracts.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
          <FileText size={36} color="#2DD4BF" style={{ marginBottom: 14, opacity: 0.6 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Nenhum contrato ainda</div>
          <div style={{ fontSize: 13, color: "#8993A6", marginBottom: 20 }}>Crie seu primeiro contrato e gere o PDF para o cliente assinar</div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> Criar contrato</button>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Título</th>
                <th>Valor mensal</th>
                <th>Início</th>
                <th>Término</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const days = daysUntil(c.end_date);
                return (
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setViewing(c)}>
                    <td style={{ fontWeight: 600 }}>{c.client_name}</td>
                    <td style={{ color: "#8993A6", fontSize: 12 }}>{c.title}</td>
                    <td style={{ fontFamily: "monospace", color: "#2DD4BF" }}>{fmtBRL(c.monthly_value)}</td>
                    <td>{fmtDate(c.start_date)}</td>
                    <td>
                      {c.end_date ? (
                        <span style={{ color: days !== null && days <= 30 && days > 0 ? "#FB923C" : days !== null && days <= 0 ? "#FB7185" : undefined }}>
                          {fmtDate(c.end_date)}
                          {days !== null && days <= 30 && days > 0 && ` (${days}d)`}
                        </span>
                      ) : "Indeterminado"}
                    </td>
                    <td><StatusPill status={c.status} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="icon-btn" onClick={() => setViewing(c)}><Eye size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modais */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Novo contrato</h3>
              <button className="icon-btn" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <ContractForm clients={clients} onSave={saveContract} onClose={() => setShowForm(false)} />
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{viewing.title}</h3>
              <button className="icon-btn" onClick={() => setViewing(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <ContractDetail
                contract={viewing}
                onClose={() => setViewing(null)}
                onUpdate={updateContract}
                onDelete={deleteContract}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
