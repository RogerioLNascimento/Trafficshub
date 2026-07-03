"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import ContractsModule from "@/components/ContractsModule";
import {
  LayoutDashboard, Users, FileText, Megaphone, Kanban as KanbanIcon, Sparkles,
  Plus, X, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Search,
  Tag as TagIcon, Calendar, Mail, Phone, ChevronRight, Loader2, CheckCircle2,
  Clock, ArrowRight, Trash2, Building2, Target, LogOut
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area
} from "recharts";

// ---------------------------------------------------------------------------
// CONSTANTS & MOCK DATA GENERATION
// ---------------------------------------------------------------------------

const NICHES = ["Infoproduto", "E-commerce", "Clínica/Saúde", "Imobiliária", "Advocacia", "Educação", "Estética", "B2B/SaaS"];
const STATUS_OPTS = ["prospeccao", "negociacao", "ativo", "inativo", "cancelado"];
const STATUS_LABEL = { prospeccao: "Prospecção", negociacao: "Em negociação", ativo: "Ativo", inativo: "Inativo", cancelado: "Cancelado" };
const STATUS_COLOR = { prospeccao: "#FBBF24", negociacao: "#8B7CF6", ativo: "#2DD4BF", inativo: "#8993A6", cancelado: "#FB7185" };
const STAGES = [
  { id: "novo", label: "Lead novo" },
  { id: "contato", label: "Contato feito" },
  { id: "reuniao", label: "Reunião agendada" },
  { id: "proposta", label: "Proposta enviada" },
  { id: "fechado", label: "Fechado" },
  { id: "perdido", label: "Perdido" },
];

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return Math.abs(h) || 1;
}

function genMetrics(clientId, trendBias = 0) {
  const rnd = seededRandom(hashStr(clientId));
  const days = 14;
  const out = [];
  let baseSpend = 80 + rnd() * 220;
  let baseCpl = 18 + rnd() * 35;
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const drift = trendBias * ((days - i) / days);
    const spend = Math.max(20, baseSpend * (1 + (rnd() - 0.5) * 0.25));
    const cpl = Math.max(5, baseCpl * (1 + drift) * (1 + (rnd() - 0.5) * 0.3));
    const leads = Math.max(1, Math.round(spend / cpl));
    const impressions = Math.round(spend * (35 + rnd() * 25));
    const clicks = Math.round(impressions * (0.008 + rnd() * 0.02));
    const conversions = Math.max(0, Math.round(leads * (0.15 + rnd() * 0.25)));
    const revenue = conversions * (120 + rnd() * 380);
    out.push({
      date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      spend: Math.round(spend), cpl: Math.round(cpl * 100) / 100, leads, impressions, clicks,
      ctr: Math.round((clicks / impressions) * 10000) / 100, conversions, revenue: Math.round(revenue),
      roas: Math.round((revenue / spend) * 100) / 100, cpa: conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : 0,
    });
  }
  return out;
}

function aggregate(metrics) {
  const sum = (k) => metrics.reduce((a, m) => a + m[k], 0);
  const spend = sum("spend"), leads = sum("leads"), conversions = sum("conversions"), revenue = sum("revenue");
  const impressions = sum("impressions"), clicks = sum("clicks");
  return {
    spend, leads, conversions, revenue, impressions, clicks,
    cpl: leads ? Math.round((spend / leads) * 100) / 100 : 0,
    cpa: conversions ? Math.round((spend / conversions) * 100) / 100 : 0,
    roas: spend ? Math.round((revenue / spend) * 100) / 100 : 0,
    ctr: impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0,
  };
}

function trendOf(metrics, key) {
  const half = Math.floor(metrics.length / 2);
  const first = metrics.slice(0, half).reduce((a, m) => a + m[key], 0) / half;
  const second = metrics.slice(half).reduce((a, m) => a + m[key], 0) / (metrics.length - half);
  if (first === 0) return 0;
  return Math.round(((second - first) / first) * 1000) / 10;
}

const SEED_CLIENTS = [
  { id: "c1", name: "Dra. Camila Reis Odontologia", niche: "Clínica/Saúde", status: "ativo", monthlyValue: 2200, contact: "Camila Reis", email: "camila@drareis.com.br", phone: "(11) 98888-1111", tags: ["recorrente", "indicação"], trendBias: 0.35, startDate: "2025-02-01" },
  { id: "c2", name: "Loja Verde Fit", niche: "E-commerce", status: "ativo", monthlyValue: 3500, contact: "Pedro Almeida", email: "pedro@verdefit.com", phone: "(21) 97777-2222", tags: ["e-commerce", "alto ticket"], trendBias: -0.25, startDate: "2024-11-10" },
  { id: "c3", name: "Construtora Horizonte", niche: "Imobiliária", status: "ativo", monthlyValue: 6000, contact: "Renata Souza", email: "renata@horizonteimoveis.com", phone: "(31) 96666-3333", tags: ["alto ticket", "lançamento"], trendBias: 0.05, startDate: "2025-01-15" },
  { id: "c4", name: "Método Avança (Infoproduto)", niche: "Infoproduto", status: "ativo", monthlyValue: 4200, contact: "Lucas Tavares", email: "lucas@metodoavanca.com", phone: "(41) 95555-4444", tags: ["lançamento", "recorrente"], trendBias: -0.4, startDate: "2024-08-01" },
  { id: "c5", name: "Espaço Estética Bella", niche: "Estética", status: "negociacao", monthlyValue: 1800, contact: "Bianca Lima", email: "bianca@bella.com", phone: "(11) 94444-5555", tags: ["novo"], trendBias: 0, startDate: "2026-06-20" },
  { id: "c6", name: "Advocacia Martins & Cia", niche: "Advocacia", status: "prospeccao", monthlyValue: 2500, contact: "Fernando Martins", email: "fernando@martinsadv.com", phone: "(11) 93333-6666", tags: ["b2b"], trendBias: 0, startDate: "" },
  { id: "c7", name: "Colégio Saber Mais", niche: "Educação", status: "inativo", monthlyValue: 2900, contact: "Juliana Costa", email: "juliana@sabermais.edu.br", phone: "(19) 92222-7777", tags: ["sazonal"], trendBias: 0, startDate: "2024-02-01" },
  { id: "c8", name: "NeoTech SaaS B2B", niche: "B2B/SaaS", status: "cancelado", monthlyValue: 5000, contact: "Rafael Nogueira", email: "rafael@neotech.io", phone: "(48) 91111-8888", tags: ["b2b", "churn"], trendBias: 0, startDate: "2024-05-01" },
];

const SEED_LEADS = [
  { id: "l1", name: "Studio Pilates Move", company: "Studio Move", niche: "Estética", stage: "novo", origin: "Indicação", value: 1500, note: "" },
  { id: "l2", name: "Clínica Vetcare", company: "Vetcare", niche: "Clínica/Saúde", stage: "contato", origin: "Instagram", value: 2200, note: "Respondeu o primeiro contato, aguardando retorno." },
  { id: "l3", name: "Imobiliária Costa Azul", company: "Costa Azul", niche: "Imobiliária", stage: "reuniao", origin: "Indicação", value: 4500, note: "Reunião marcada para quinta-feira às 15h." },
  { id: "l4", name: "Curso Online Finanças", company: "FinEdu", niche: "Infoproduto", stage: "proposta", origin: "Outbound", value: 3800, note: "Proposta enviada, follow-up em 2 dias." },
  { id: "l5", name: "Mercado Bom Preço", company: "Bom Preço", niche: "E-commerce", stage: "fechado", origin: "Inbound", value: 2800, note: "Fechado! Iniciar onboarding." },
  { id: "l6", name: "Barbearia Vintage", company: "Vintage Barber", niche: "Estética", stage: "perdido", origin: "Indicação", value: 900, note: "Optou por fazer in-house." },
];

const fmtBRL = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// ---------------------------------------------------------------------------
// STORAGE HOOK
// ---------------------------------------------------------------------------

function useAppData(userId) {
  const [data, setData] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const [{ data: clients }, { data: leads }] = await Promise.all([
          supabase.from("clients").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
          supabase.from("leads").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        ]);

        // Mapeia campos do banco para o formato do sistema
        const mappedClients = (clients || []).map(c => ({
          id: c.id, name: c.name, niche: c.niche || "Infoproduto",
          status: c.status || "prospeccao", monthlyValue: c.monthly_value || 0,
          contact: c.contact || "", email: c.email || "", phone: c.phone || "",
          tags: c.tags || [], startDate: c.start_date || "", trendBias: 0,
        }));

        const mappedLeads = (leads || []).map(l => ({
          id: l.id, name: l.name, company: l.company || "",
          niche: l.niche || "Infoproduto", stage: l.stage || "novo",
          origin: l.origin || "Indicação", value: l.value || 0, note: l.note || "",
        }));

        setData({
          clients: mappedClients.length > 0 ? mappedClients : [],
          leads: mappedLeads.length > 0 ? mappedLeads : [],
          insights: {},
        });
      } catch (e) {
        setData({ clients: [], leads: [], insights: {} });
      } finally {
        setReady(true);
      }
    })();
  }, [userId]);

  const save = useCallback(async (next) => {
    setData(next);
  }, []);

  const saveClient = useCallback(async (client, isNew = false) => {
    const row = {
      user_id: userId, name: client.name, niche: client.niche,
      status: client.status, monthly_value: client.monthlyValue,
      contact: client.contact, email: client.email, phone: client.phone,
      tags: client.tags, start_date: client.startDate || null,
    };
    if (isNew) {
      const { data: inserted } = await supabase.from("clients").insert(row).select().single();
      return inserted;
    } else {
      await supabase.from("clients").update(row).eq("id", client.id);
      return client;
    }
  }, [userId]);

  const deleteClient = useCallback(async (id) => {
    await supabase.from("clients").delete().eq("id", id);
  }, []);

  const saveLead = useCallback(async (lead, isNew = false) => {
    const row = {
      user_id: userId, name: lead.name, company: lead.company,
      niche: lead.niche, stage: lead.stage, origin: lead.origin,
      value: lead.value, note: lead.note,
    };
    if (isNew) {
      const { data: inserted } = await supabase.from("leads").insert(row).select().single();
      return inserted;
    } else {
      await supabase.from("leads").update(row).eq("id", lead.id);
      return lead;
    }
  }, [userId]);

  const deleteLead = useCallback(async (id) => {
    await supabase.from("leads").delete().eq("id", id);
  }, []);

  return { data, ready, save, saveClient, deleteClient, saveLead, deleteLead };
}

// ---------------------------------------------------------------------------
// SMALL UI PRIMITIVES
// ---------------------------------------------------------------------------

function Pill({ color, children }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px",
      borderRadius: 999, fontSize: 12, fontWeight: 600, color,
      background: color + "1A", border: `1px solid ${color}40`,
    }}>{children}</span>
  );
}

function KpiCard({ label, value, delta, icon: Icon, suffix = "", invert = false }) {
  const positive = invert ? delta < 0 : delta > 0;
  const deltaColor = delta === 0 ? "#8993A6" : positive ? "#2DD4BF" : "#FB7185";
  return (
    <div className="card kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {Icon && <Icon size={16} color="#5B6577" />}
      </div>
      <div className="kpi-value">{value}{suffix}</div>
      {delta !== undefined && (
        <div className="kpi-delta" style={{ color: deltaColor }}>
          {delta === 0 ? "—" : positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {delta !== 0 && <span>{Math.abs(delta)}% vs período anterior</span>}
        </div>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={"modal" + (wide ? " modal-wide" : "")} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// AI INSIGHT GENERATION (calls Claude via the Messages API)
// ---------------------------------------------------------------------------

async function callClaude(prompt) {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error || "Erro ao gerar insight.");
  }
  return (json.text || "").trim();
}

function useAIInsight(cacheKey, data, save, buildPrompt) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cached = data?.insights?.[cacheKey];

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await callClaude(buildPrompt());
      const next = { ...data, insights: { ...data.insights, [cacheKey]: { text, at: new Date().toISOString() } } };
      await save(next);
    } catch (e) {
      setError("Não foi possível gerar o insight agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [data, save, cacheKey, buildPrompt]);

  return { cached, loading, error, generate };
}

// ---------------------------------------------------------------------------
// VIEW: DASHBOARD
// ---------------------------------------------------------------------------

function DashboardView({ data, save }) {
  const activeClients = data.clients.filter((c) => c.status === "ativo");
  const mrr = activeClients.reduce((a, c) => a + c.monthlyValue, 0);
  const cancelados = data.clients.filter((c) => c.status === "cancelado").length;
  const churnRate = data.clients.length ? Math.round((cancelados / data.clients.length) * 1000) / 10 : 0;

  const perfByClient = useMemo(() => activeClients.map((c) => {
    const metrics = genMetrics(c.id, c.trendBias);
    const agg = aggregate(metrics);
    const roasTrend = trendOf(metrics, "roas");
    const cplTrend = trendOf(metrics, "cpl");
    return { client: c, agg, roasTrend, cplTrend };
  }), [activeClients]);

  const atRisk = perfByClient.filter((p) => p.roasTrend < -10 || p.cplTrend > 15)
    .sort((a, b) => a.roasTrend - b.roasTrend);

  const topClients = [...perfByClient].sort((a, b) => b.agg.roas - a.agg.roas).slice(0, 3);

  const mrrSeries = useMemo(() => {
    const rnd = seededRandom(7);
    let v = mrr * 0.7;
    return Array.from({ length: 6 }).map((_, i) => {
      v = v * (1 + 0.04 + (rnd() - 0.3) * 0.03);
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      return { month: d.toLocaleDateString("pt-BR", { month: "short" }), mrr: Math.round(i === 5 ? mrr : v) };
    });
  }, [mrr]);

  const prompt = useCallback(() => {
    const summary = perfByClient.map((p) => ({
      cliente: p.client.name, nicho: p.client.niche, roas: p.agg.roas, cpl: p.agg.cpl,
      variacaoRoas: p.roasTrend + "%", variacaoCpl: p.cplTrend + "%",
    }));
    return `Você é um analista sênior de tráfego pago. Aqui está um resumo agregado dos últimos 14 dias de performance dos clientes ativos de uma agência (dados em JSON): ${JSON.stringify(summary)}. MRR atual: ${fmtBRL(mrr)}, churn: ${churnRate}%.
Escreva, em português, uma análise executiva curta para o dono da agência com no máximo 4 bullets: destaque (1) o cliente com pior tendência e uma hipótese de causa, (2) o cliente com melhor performance e o que está funcionando, (3) um risco de negócio (churn/MRR) se houver, (4) uma recomendação de ação prática para esta semana. Seja direto, sem introdução nem saudação, direto nos bullets.`;
  }, [perfByClient, mrr, churnRate]);

  const ai = useAIInsight("dashboard-weekly", data, save, prompt);

  return (
    <div className="view">
      <div className="view-header">
        <h1>Visão geral da agência</h1>
        <p className="view-sub">Resumo consolidado de todos os clientes ativos</p>
      </div>

      <div className="kpi-grid">
        <KpiCard label="MRR" value={fmtBRL(mrr)} icon={DollarSign} />
        <KpiCard label="Clientes ativos" value={activeClients.length} icon={Users} />
        <KpiCard label="Churn" value={churnRate} suffix="%" icon={TrendingDown} invert />
        <KpiCard label="Clientes em alerta" value={atRisk.length} icon={AlertTriangle} invert />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">MRR — últimos 6 meses</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={mrrSeries}>
              <defs>
                <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2DD4BF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1F2530" vertical={false} />
              <XAxis dataKey="month" stroke="#5B6577" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#5B6577" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: "#171A22", border: "1px solid #262C3A", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => fmtBRL(v)} />
              <Area type="monotone" dataKey="mrr" stroke="#2DD4BF" strokeWidth={2} fill="url(#mrrFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title-row">
            <div className="card-title" style={{ marginBottom: 0 }}><AlertTriangle size={14} color="#FB7185" /> Clientes com queda de performance</div>
          </div>
          {atRisk.length === 0 && <div className="empty-mini">Nenhum cliente em alerta no momento.</div>}
          {atRisk.map((p) => (
            <div key={p.client.id} className="risk-row">
              <div>
                <div className="risk-name">{p.client.name}</div>
                <div className="risk-sub">ROAS {p.roasTrend}% · CPL {p.cplTrend > 0 ? "+" : ""}{p.cplTrend}%</div>
              </div>
              <Pill color="#FB7185">Revisar</Pill>
            </div>
          ))}
          <div className="card-title" style={{ marginTop: 18 }}><TrendingUp size={14} color="#2DD4BF" /> Top performance</div>
          {topClients.map((p) => (
            <div key={p.client.id} className="risk-row">
              <div>
                <div className="risk-name">{p.client.name}</div>
                <div className="risk-sub">ROAS {p.agg.roas}x</div>
              </div>
              <Pill color="#2DD4BF">Destaque</Pill>
            </div>
          ))}
        </div>
      </div>

      <div className="card ai-card">
        <div className="card-title-row">
          <div className="card-title" style={{ marginBottom: 0 }}><Sparkles size={15} color="#8B7CF6" /> Insight semanal da IA</div>
          <button className="btn btn-ghost" onClick={ai.generate} disabled={ai.loading}>
            {ai.loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            {ai.cached ? "Atualizar análise" : "Gerar análise"}
          </button>
        </div>
        {ai.error && <div className="ai-error">{ai.error}</div>}
        {!ai.cached && !ai.loading && !ai.error && (
          <div className="empty-mini">Clique em "Gerar análise" para a IA ler os dados de todos os clientes ativos e te dar um resumo executivo da semana.</div>
        )}
        {ai.loading && <div className="empty-mini"><Loader2 size={14} className="spin" /> Analisando performance de {activeClients.length} clientes...</div>}
        {ai.cached && <div className="ai-text">{ai.cached.text}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VIEW: CLIENTS (CRM)
// ---------------------------------------------------------------------------

function ClientForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    id: "c" + Date.now(), name: "", niche: NICHES[0], status: "prospeccao",
    monthlyValue: 0, contact: "", email: "", phone: "", tags: [], trendBias: 0, startDate: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div>
      <Field label="Nome do cliente / empresa">
        <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Loja Verde Fit" />
      </Field>
      <div className="field-row">
        <Field label="Nicho">
          <select value={form.niche} onChange={(e) => set("niche", e.target.value)}>
            {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => set("status", e.target.value)}>
            {STATUS_OPTS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
      </div>
      <div className="field-row">
        <Field label="Contato responsável">
          <input value={form.contact} onChange={(e) => set("contact", e.target.value)} placeholder="Nome do contato" />
        </Field>
        <Field label="Valor mensal (R$)">
          <input type="number" value={form.monthlyValue} onChange={(e) => set("monthlyValue", Number(e.target.value))} />
        </Field>
      </div>
      <div className="field-row">
        <Field label="E-mail"><input value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Telefone"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
      </div>
      <Field label="Tags (separadas por vírgula)">
        <input value={form.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} />
      </Field>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.name}>Salvar cliente</button>
      </div>
    </div>
  );
}

function ClientDetail({ client, data, save, onClose }) {
  const metrics = useMemo(() => genMetrics(client.id, client.trendBias), [client.id, client.trendBias]);
  const agg = aggregate(metrics);
  const roasTrend = trendOf(metrics, "roas");
  const cplTrend = trendOf(metrics, "cpl");

  const prompt = useCallback(() => {
    return `Você é um analista de tráfego pago. Dados dos últimos 14 dias do cliente "${client.name}" (nicho: ${client.niche}): spend total R$${agg.spend}, CPL médio R$${agg.cpl}, CPA médio R$${agg.cpa}, ROAS ${agg.roas}x, CTR ${agg.ctr}%, variação de ROAS no período: ${roasTrend}%, variação de CPL: ${cplTrend}%.
Escreva em português uma análise curta (3-4 frases corridas, sem bullets, sem saudação) explicando o que esses números sugerem sobre a campanha desse cliente especificamente, uma hipótese provável de causa para a tendência observada, e uma sugestão concreta de otimização.`;
  }, [client, agg, roasTrend, cplTrend]);

  const ai = useAIInsight("client-" + client.id, data, save, prompt);

  return (
    <Modal title={client.name} onClose={onClose} wide>
      <div className="detail-top">
        <Pill color={STATUS_COLOR[client.status]}>{STATUS_LABEL[client.status]}</Pill>
        <span className="detail-niche"><Building2 size={13} /> {client.niche}</span>
        <span className="detail-niche"><DollarSign size={13} /> {fmtBRL(client.monthlyValue)}/mês</span>
      </div>
      <div className="detail-contacts">
        <span><Mail size={13} /> {client.email || "—"}</span>
        <span><Phone size={13} /> {client.phone || "—"}</span>
      </div>

      <div className="kpi-grid kpi-grid-4">
        <KpiCard label="CPL médio" value={fmtBRL(agg.cpl)} delta={cplTrend} invert icon={Target} />
        <KpiCard label="CPA médio" value={fmtBRL(agg.cpa)} icon={Target} />
        <KpiCard label="ROAS" value={agg.roas} suffix="x" delta={roasTrend} icon={TrendingUp} />
        <KpiCard label="CTR" value={agg.ctr} suffix="%" icon={Megaphone} />
      </div>

      <div className="card">
        <div className="card-title">Leads e investimento — 14 dias</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={metrics}>
            <CartesianGrid stroke="#1F2530" vertical={false} />
            <XAxis dataKey="date" stroke="#5B6577" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#5B6577" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "#171A22", border: "1px solid #262C3A", borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="leads" stroke="#2DD4BF" strokeWidth={2} dot={false} name="Leads" />
            <Line type="monotone" dataKey="cpl" stroke="#FBBF24" strokeWidth={2} dot={false} name="CPL (R$)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card ai-card">
        <div className="card-title-row">
          <div className="card-title" style={{ marginBottom: 0 }}><Sparkles size={15} color="#8B7CF6" /> Análise da IA</div>
          <button className="btn btn-ghost" onClick={ai.generate} disabled={ai.loading}>
            {ai.loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            {ai.cached ? "Atualizar" : "Gerar análise"}
          </button>
        </div>
        {ai.error && <div className="ai-error">{ai.error}</div>}
        {!ai.cached && !ai.loading && !ai.error && <div className="empty-mini">Peça à IA uma leitura específica da conta deste cliente.</div>}
        {ai.loading && <div className="empty-mini"><Loader2 size={14} className="spin" /> Lendo a performance de {client.name}...</div>}
        {ai.cached && <div className="ai-text">{ai.cached.text}</div>}
      </div>
    </Modal>
  );
}

function ClientsView({ data, save, saveClient, deleteClient }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [saving, setSaving] = useState(false);

  const filtered = data.clients.filter((c) => {
    if (statusFilter !== "todos" && c.status !== statusFilter) return false;
    if (query && !c.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const upsert = async (client) => {
    setSaving(true);
    try {
      const exists = data.clients.some((c) => c.id === client.id);
      const saved = await saveClient(client, !exists);
      const finalClient = { ...client, id: saved?.id || client.id };
      const clients = exists
        ? data.clients.map((c) => (c.id === client.id ? finalClient : c))
        : [...data.clients, finalClient];
      await save({ ...data, clients });
    } finally {
      setSaving(false);
      setShowForm(false);
      setEditing(null);
    }
  };

  const remove = async (id) => {
    await deleteClient(id);
    await save({ ...data, clients: data.clients.filter((c) => c.id !== id) });
  };

  return (
    <div className="view">
      <div className="view-header view-header-row">
        <div>
          <h1>Clientes</h1>
          <p className="view-sub">{data.clients.length} clientes cadastrados</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> Novo cliente</button>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={15} color="#5B6577" />
          <input placeholder="Buscar cliente..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="filter-chips">
          <button className={"chip" + (statusFilter === "todos" ? " chip-active" : "")} onClick={() => setStatusFilter("todos")}>Todos</button>
          {STATUS_OPTS.map((s) => (
            <button key={s} className={"chip" + (statusFilter === s ? " chip-active" : "")} onClick={() => setStatusFilter(s)}
              style={statusFilter === s ? { borderColor: STATUS_COLOR[s], color: STATUS_COLOR[s] } : {}}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="client-grid">
        {filtered.map((c) => (
          <div key={c.id} className="card client-card" onClick={() => setViewing(c)}>
            <div className="client-card-top">
              <div className="client-avatar">{c.name.slice(0, 2).toUpperCase()}</div>
              <Pill color={STATUS_COLOR[c.status]}>{STATUS_LABEL[c.status]}</Pill>
            </div>
            <div className="client-card-name">{c.name}</div>
            <div className="client-card-niche">{c.niche}</div>
            <div className="client-card-value">{fmtBRL(c.monthlyValue)}<span>/mês</span></div>
            <div className="client-card-tags">
              {c.tags.map((t) => <span key={t} className="tag-mini"><TagIcon size={10} /> {t}</span>)}
            </div>
            <div className="client-card-actions" onClick={(e) => e.stopPropagation()}>
              <button className="icon-btn" onClick={() => setEditing(c)}>Editar</button>
              <button className="icon-btn icon-btn-danger" onClick={() => remove(c.id)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="empty-mini">Nenhum cliente encontrado.</div>}
      </div>

      {showForm && <Modal title="Novo cliente" onClose={() => setShowForm(false)}>
        <ClientForm onSave={upsert} onClose={() => setShowForm(false)} />
      </Modal>}
      {editing && <Modal title="Editar cliente" onClose={() => setEditing(null)}>
        <ClientForm initial={editing} onSave={upsert} onClose={() => setEditing(null)} />
      </Modal>}
      {viewing && <ClientDetail client={viewing} data={data} save={save} onClose={() => setViewing(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VIEW: CONTRACTS
// ---------------------------------------------------------------------------

function ContractsView({ data }) {
  const rows = data.clients.filter((c) => c.status !== "prospeccao");
  const today = new Date();

  const paymentStatus = (c) => {
    const rnd = seededRandom(hashStr(c.id) + 1)();
    if (c.status === "cancelado") return "cancelado";
    if (rnd > 0.85) return "atrasado";
    if (rnd > 0.7) return "pendente";
    return "pago";
  };
  const PAY_COLOR = { pago: "#2DD4BF", pendente: "#FBBF24", atrasado: "#FB7185", cancelado: "#5B6577" };
  const PAY_LABEL = { pago: "Pago", pendente: "Pendente", atrasado: "Atrasado", cancelado: "Cancelado" };

  const totalMrr = rows.filter((c) => c.status === "ativo").reduce((a, c) => a + c.monthlyValue, 0);
  const inadimplencia = rows.filter((c) => paymentStatus(c) === "atrasado").reduce((a, c) => a + c.monthlyValue, 0);

  return (
    <div className="view">
      <div className="view-header">
        <h1>Contratos</h1>
        <p className="view-sub">Recorrência, vigência e status de pagamento</p>
      </div>

      <div className="kpi-grid">
        <KpiCard label="MRR contratado" value={fmtBRL(totalMrr)} icon={DollarSign} />
        <KpiCard label="Em inadimplência" value={fmtBRL(inadimplencia)} icon={AlertTriangle} invert />
        <KpiCard label="Contratos ativos" value={rows.filter((c) => c.status === "ativo").length} icon={FileText} />
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th><th>Início</th><th>Valor mensal</th><th>Renovação</th><th>Pagamento</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const pay = paymentStatus(c);
              return (
                <tr key={c.id}>
                  <td>
                    <div className="table-client">
                      <div className="client-avatar client-avatar-sm">{c.name.slice(0, 2).toUpperCase()}</div>
                      {c.name}
                    </div>
                  </td>
                  <td>{c.startDate ? new Date(c.startDate).toLocaleDateString("pt-BR") : "—"}</td>
                  <td>{fmtBRL(c.monthlyValue)}</td>
                  <td>{c.status === "ativo" ? "Automática" : "—"}</td>
                  <td><Pill color={PAY_COLOR[pay]}>{PAY_LABEL[pay]}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VIEW: CAMPAIGNS
// ---------------------------------------------------------------------------

function CampaignsView({ data }) {
  const activeClients = data.clients.filter((c) => c.status === "ativo");
  const [selectedId, setSelectedId] = useState(activeClients[0]?.id);
  const client = activeClients.find((c) => c.id === selectedId) || activeClients[0];
  const metrics = useMemo(() => client ? genMetrics(client.id, client.trendBias) : [], [client]);
  const agg = client ? aggregate(metrics) : null;

  if (!client) return <div className="view"><div className="empty-mini">Nenhum cliente ativo com campanhas.</div></div>;

  return (
    <div className="view">
      <div className="view-header">
        <h1>Campanhas</h1>
        <p className="view-sub">Meta Ads &amp; Google Ads — performance consolidada</p>
      </div>

      <div className="client-selector">
        {activeClients.map((c) => (
          <button key={c.id} className={"client-chip" + (c.id === client.id ? " client-chip-active" : "")} onClick={() => setSelectedId(c.id)}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="kpi-grid kpi-grid-4">
        <KpiCard label="Investimento (14d)" value={fmtBRL(agg.spend)} icon={DollarSign} />
        <KpiCard label="CPL médio" value={fmtBRL(agg.cpl)} delta={trendOf(metrics, "cpl")} invert icon={Target} />
        <KpiCard label="ROAS" value={agg.roas} suffix="x" delta={trendOf(metrics, "roas")} icon={TrendingUp} />
        <KpiCard label="CTR" value={agg.ctr} suffix="%" icon={Megaphone} />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Investimento diário</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={metrics}>
              <CartesianGrid stroke="#1F2530" vertical={false} />
              <XAxis dataKey="date" stroke="#5B6577" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#5B6577" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#171A22", border: "1px solid #262C3A", borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtBRL(v)} />
              <Bar dataKey="spend" fill="#8B7CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="card-title">ROAS x CPA</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={metrics}>
              <CartesianGrid stroke="#1F2530" vertical={false} />
              <XAxis dataKey="date" stroke="#5B6577" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#5B6577" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#171A22", border: "1px solid #262C3A", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="roas" stroke="#2DD4BF" strokeWidth={2} dot={false} name="ROAS" />
              <Line type="monotone" dataKey="cpa" stroke="#FB7185" strokeWidth={2} dot={false} name="CPA (R$)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Detalhamento diário</div>
        <table className="table">
          <thead><tr><th>Data</th><th>Investimento</th><th>Impressões</th><th>Cliques</th><th>CTR</th><th>Leads</th><th>CPL</th><th>Conversões</th><th>ROAS</th></tr></thead>
          <tbody>
            {[...metrics].reverse().slice(0, 7).map((m, i) => (
              <tr key={i}>
                <td>{m.date}</td><td>{fmtBRL(m.spend)}</td><td>{m.impressions.toLocaleString("pt-BR")}</td>
                <td>{m.clicks}</td><td>{m.ctr}%</td><td>{m.leads}</td><td>{fmtBRL(m.cpl)}</td><td>{m.conversions}</td><td>{m.roas}x</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VIEW: PIPELINE (Kanban)
// ---------------------------------------------------------------------------

function LeadForm({ onSave, onClose }) {
  const [form, setForm] = useState({ id: "l" + Date.now(), name: "", company: "", niche: NICHES[0], stage: "novo", origin: "Indicação", value: 0, note: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div>
      <Field label="Nome do lead"><input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <div className="field-row">
        <Field label="Empresa"><input value={form.company} onChange={(e) => set("company", e.target.value)} /></Field>
        <Field label="Origem">
          <select value={form.origin} onChange={(e) => set("origin", e.target.value)}>
            {["Indicação", "Inbound", "Outbound", "Instagram", "Google"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
      <div className="field-row">
        <Field label="Nicho">
          <select value={form.niche} onChange={(e) => set("niche", e.target.value)}>
            {NICHES.map((n) => <option key={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Valor estimado (R$)"><input type="number" value={form.value} onChange={(e) => set("value", Number(e.target.value))} /></Field>
      </div>
      <Field label="Nota"><textarea rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} /></Field>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.name}>Adicionar lead</button>
      </div>
    </div>
  );
}

function PipelineView({ data, save, saveLead, deleteLead }) {
  const [showForm, setShowForm] = useState(false);

  const moveLead = async (leadId, dir) => {
    const lead = data.leads.find((l) => l.id === leadId);
    const idx = STAGES.findIndex((s) => s.id === lead.stage);
    const nextIdx = Math.max(0, Math.min(STAGES.length - 1, idx + dir));
    const updatedLead = { ...lead, stage: STAGES[nextIdx].id };
    await saveLead(updatedLead, false);
    const leads = data.leads.map((l) => l.id === leadId ? updatedLead : l);
    await save({ ...data, leads });
  };

  const addLead = async (lead) => {
    const saved = await saveLead(lead, true);
    const newLead = { ...lead, id: saved?.id || lead.id };
    await save({ ...data, leads: [...data.leads, newLead] });
    setShowForm(false);
  };

  const removeLead = async (id) => {
    await deleteLead(id);
    await save({ ...data, leads: data.leads.filter((l) => l.id !== id) });
  };

  const total = data.leads.filter((l) => !["fechado", "perdido"].includes(l.stage)).reduce((a, l) => a + l.value, 0);

  return (
    <div className="view">
      <div className="view-header view-header-row">
        <div>
          <h1>Pipeline de prospecção</h1>
          <p className="view-sub">{data.leads.length} leads no funil · {fmtBRL(total)} em negociação</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> Novo lead</button>
      </div>

      <div className="kanban">
        {STAGES.map((stage, sIdx) => {
          const leads = data.leads.filter((l) => l.stage === stage.id);
          return (
            <div key={stage.id} className="kanban-col">
              <div className="kanban-col-header">
                <span>{stage.label}</span>
                <span className="kanban-count">{leads.length}</span>
              </div>
              <div className="kanban-col-body">
                {leads.map((l) => (
                  <div key={l.id} className="kanban-card">
                    <div className="kanban-card-top">
                      <span className="kanban-card-name">{l.name}</span>
                      <button className="icon-btn icon-btn-danger" onClick={() => removeLead(l.id)}><Trash2 size={12} /></button>
                    </div>
                    <div className="kanban-card-meta">{l.niche} · {l.origin}</div>
                    {l.value > 0 && <div className="kanban-card-value">{fmtBRL(l.value)}</div>}
                    {l.note && <div className="kanban-card-note">{l.note}</div>}
                    <div className="kanban-card-actions">
                      <button className="icon-btn" disabled={sIdx === 0} onClick={() => moveLead(l.id, -1)}>←</button>
                      <button className="icon-btn" disabled={sIdx === STAGES.length - 1} onClick={() => moveLead(l.id, 1)}>Mover <ArrowRight size={12} /></button>
                    </div>
                  </div>
                ))}
                {leads.length === 0 && <div className="kanban-empty">Vazio</div>}
              </div>
            </div>
          );
        })}
      </div>

      {showForm && <Modal title="Novo lead" onClose={() => setShowForm(false)}>
        <LeadForm onSave={addLead} onClose={() => setShowForm(false)} />
      </Modal>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VIEW: AI COPILOT (chat-style free question)
// ---------------------------------------------------------------------------

function AIView({ data }) {
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(false);

  const contextSummary = useMemo(() => {
    const active = data.clients.filter((c) => c.status === "ativo").map((c) => {
      const agg = aggregate(genMetrics(c.id, c.trendBias));
      return { nome: c.name, nicho: c.niche, status: c.status, valorMensal: c.monthlyValue, roas: agg.roas, cpl: agg.cpl };
    });
    const pipeline = data.leads.reduce((acc, l) => { acc[l.stage] = (acc[l.stage] || 0) + 1; return acc; }, {});
    return { clientesAtivos: active, pipeline };
  }, [data]);

  const ask = async () => {
    if (!question.trim()) return;
    const q = question;
    setQuestion("");
    setThread((t) => [...t, { role: "user", text: q }]);
    setLoading(true);
    try {
      const prompt = `Você é o copiloto de IA dentro de um sistema de gestão para uma agência de tráfego pago. Use os dados de contexto a seguir (JSON) para responder à pergunta do gestor de forma direta e prática, em português, sem rodeios: ${JSON.stringify(contextSummary)}.
Pergunta do gestor: "${q}"`;
      const text = await callClaude(prompt);
      setThread((t) => [...t, { role: "ai", text }]);
    } catch (e) {
      setThread((t) => [...t, { role: "ai", text: "Não consegui responder agora. Tente novamente em instantes." }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "Quais clientes estão com risco de cancelamento?",
    "Resuma a situação do pipeline comercial",
    "Qual cliente merece atenção prioritária essa semana?",
  ];

  return (
    <div className="view">
      <div className="view-header">
        <h1>Copiloto de IA</h1>
        <p className="view-sub">Pergunte qualquer coisa sobre seus clientes, campanhas e pipeline</p>
      </div>

      <div className="card ai-chat-card">
        <div className="ai-thread">
          {thread.length === 0 && (
            <div className="ai-suggestions">
              {suggestions.map((s) => (
                <button key={s} className="chip" onClick={() => setQuestion(s)}>{s}</button>
              ))}
            </div>
          )}
          {thread.map((m, i) => (
            <div key={i} className={"ai-msg " + (m.role === "user" ? "ai-msg-user" : "ai-msg-ai")}>
              {m.role === "ai" && <Sparkles size={14} color="#8B7CF6" style={{ marginTop: 2 }} />}
              <div>{m.text}</div>
            </div>
          ))}
          {loading && <div className="ai-msg ai-msg-ai"><Loader2 size={14} className="spin" color="#8B7CF6" /> <div>Pensando...</div></div>}
        </div>
        <div className="ai-input-row">
          <input placeholder="Pergunte sobre seus clientes, campanhas ou pipeline..." value={question}
            onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
          <button className="btn btn-primary" onClick={ask} disabled={loading || !question.trim()}>Enviar</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// APP SHELL
// ---------------------------------------------------------------------------

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "clients", label: "Clientes", icon: Users },
  { id: "contracts", label: "Contratos", icon: FileText },
  { id: "campaigns", label: "Campanhas", icon: Megaphone },
  { id: "pipeline", label: "Pipeline", icon: KanbanIcon },
  { id: "agenda", label: "Google Agenda", icon: Calendar },
  { id: "ai", label: "Copiloto IA", icon: Sparkles },
];

// ---------------------------------------------------------------------------
// VIEW: GOOGLE AGENDA (calendário visual)
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const EVENT_COLORS = ["#2DD4BF","#8B7CF6","#FB7185","#FBBF24","#60A5FA","#34D399","#F97316"];

function getEventColor(title) {
  let h = 0;
  for (let i = 0; i < (title||"").length; i++) h = (h << 5) - h + title.charCodeAt(i);
  return EVENT_COLORS[Math.abs(h) % EVENT_COLORS.length];
}

function AgendaView() {
  const [tokens, setTokens] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calView, setCalView] = useState("month");
  const [form, setForm] = useState({ title: "", date: "", startTime: "09:00", endTime: "10:00", description: "" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("google");
    const tokensParam = params.get("tokens");
    if (status === "success" && tokensParam) {
      setTokens(tokensParam);
      try { window.localStorage.setItem("google_tokens", tokensParam); } catch (e) {}
      window.history.replaceState({}, "", window.location.pathname);
      fetchEvents(tokensParam);
    } else if (status === "error") {
      setError("Não foi possível conectar ao Google Agenda. Tente novamente.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    try {
      const saved = window.localStorage.getItem("google_tokens");
      if (saved && !tokensParam) { setTokens(saved); fetchEvents(saved); }
    } catch (e) {}
  }, []);

  const fetchEvents = async (t) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/google/calendar?tokens=${encodeURIComponent(t)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setEvents(json.events || []);
    } catch (e) { setError("Erro ao carregar eventos: " + e.message); }
    finally { setLoading(false); }
  };

  const createEvent = async () => {
    if (!form.title || !form.date) return;
    setCreating(true); setError(null);
    try {
      const start = new Date(`${form.date}T${form.startTime}:00`).toISOString();
      const end = new Date(`${form.date}T${form.endTime}:00`).toISOString();
      const res = await fetch("/api/google/calendar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens, event: { title: form.title, start, end, description: form.description } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setShowForm(false);
      setForm({ title: "", date: "", startTime: "09:00", endTime: "10:00", description: "" });
      await fetchEvents(tokens);
    } catch (e) { setError("Erro ao criar evento: " + e.message); }
    finally { setCreating(false); }
  };

  const disconnect = () => {
    try { window.localStorage.removeItem("google_tokens"); } catch (e) {}
    setTokens(null); setEvents([]);
  };

  const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  const fmtFull = (iso) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const today = new Date();
  const isToday = (d) => d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();

  const eventsOnDay = (date) => events.filter((e) => {
    if (!e.start) return false;
    const d = new Date(e.start);
    return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
  });

  const buildMonthGrid = () => {
    const year = currentDate.getFullYear(), month = currentDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  };

  const buildWeekDays = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    return Array.from({ length: 7 }, (_, i) => { const dd = new Date(d); dd.setDate(d.getDate() + i); return dd; });
  };

  const prevPeriod = () => { const d = new Date(currentDate); if (calView === "month") d.setMonth(d.getMonth() - 1); else d.setDate(d.getDate() - 7); setCurrentDate(d); };
  const nextPeriod = () => { const d = new Date(currentDate); if (calView === "month") d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + 7); setCurrentDate(d); };

  const upcomingEvents = [...events].filter((e) => e.start && new Date(e.start) >= new Date()).sort((a, b) => new Date(a.start) - new Date(b.start));

  const CAL_CSS = `
    .cal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}
    .cal-nav{display:flex;align-items:center;gap:8px}
    .cal-nav-btn{background:#141822;border:1px solid #1F2530;color:#C7CCD6;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:14px;font-family:inherit}
    .cal-nav-btn:hover{background:#1B202C}
    .cal-title{font-family:'Sora',sans-serif;font-size:17px;font-weight:600;min-width:200px;text-align:center}
    .cal-tabs{display:flex;gap:4px}
    .cal-tab{background:#141822;border:1px solid #1F2530;color:#8993A6;padding:6px 13px;border-radius:7px;cursor:pointer;font-size:12px;font-family:inherit;font-weight:500}
    .cal-tab-active{background:#1B202C;color:#2DD4BF;border-color:#2DD4BF}
    .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:#1F2530;border-radius:10px;overflow:hidden}
    .cal-weekday{background:#0E1117;padding:10px 4px;text-align:center;font-size:11px;font-weight:600;color:#5B6577;text-transform:uppercase;letter-spacing:.05em}
    .cal-day{background:#141822;min-height:90px;padding:6px;cursor:pointer}
    .cal-day:hover{background:#161B25}
    .cal-day-empty{background:#0E1117;min-height:90px}
    .cal-num{font-size:12px;font-weight:600;color:#8993A6;margin-bottom:3px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%}
    .cal-today .cal-num{background:#2DD4BF;color:#06231F;font-weight:700}
    .cal-chip{font-size:10.5px;padding:2px 5px;border-radius:4px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;font-weight:500}
    .cal-more{font-size:10px;color:#5B6577;padding:1px 4px}
    .week-grid{display:grid;grid-template-columns:44px repeat(7,1fr);gap:1px;background:#1F2530;border-radius:10px;overflow:hidden;max-height:550px;overflow-y:auto}
    .week-dh{background:#0E1117;padding:8px 4px;text-align:center}
    .week-dn{font-size:10px;color:#5B6577;font-weight:600;text-transform:uppercase}
    .week-dd{font-size:17px;font-weight:700;color:#C7CCD6}
    .week-dd-today{color:#2DD4BF}
    .week-hr{background:#141822;min-height:48px;border-bottom:1px solid #1B202C;position:relative}
    .week-tl{background:#0E1117;min-height:48px;border-bottom:1px solid #1B202C;display:flex;align-items:flex-start;justify-content:flex-end;padding:3px 6px 0}
    .week-ht{font-size:9.5px;color:#5B6577}
    .week-ev{position:absolute;left:2px;right:2px;border-radius:4px;padding:2px 4px;font-size:10.5px;font-weight:500;cursor:pointer;overflow:hidden;z-index:1}
    .list-ev{display:flex;gap:12px;align-items:flex-start;padding:11px 0;border-bottom:1px solid #1B202C;cursor:pointer}
    .list-ev:hover{opacity:.85}
    .list-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;margin-top:4px}
    .list-date{font-size:11px;color:#8993A6;min-width:85px}
    .list-title{font-size:13px;font-weight:500}
    .list-time{font-size:11.5px;color:#8993A6;margin-top:2px}
    .ev-popup{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#141822;border:1px solid #262C3A;border-radius:12px;padding:20px;width:310px;z-index:200;box-shadow:0 20px 60px #00000090}
    .ev-overlay{position:fixed;inset:0;z-index:199}
  `;

  if (!tokens) {
    return (
      <div className="view">
        <style>{CAL_CSS}</style>
        <div className="view-header"><h1>Google Agenda</h1><p className="view-sub">Conecte sua conta para visualizar e criar eventos</p></div>
        <div className="card agenda-connect-card">
          <Calendar size={36} color="#2DD4BF" style={{ marginBottom: 14 }} />
          <h2 style={{ margin: "0 0 8px", fontFamily: "Sora, sans-serif", fontSize: 18 }}>Conectar Google Agenda</h2>
          <p style={{ color: "#8993A6", fontSize: 13.5, marginBottom: 22, maxWidth: 400 }}>Autorize o TrafficHub a acessar seu Google Agenda para visualizar compromissos e criar reuniões com clientes direto do sistema.</p>
          {error && <div className="ai-error" style={{ marginBottom: 14 }}>{error}</div>}
          <a href="/api/google/auth" className="btn btn-primary" style={{ textDecoration: "none" }}><Calendar size={15} /> Conectar com Google</a>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <style>{CAL_CSS}</style>

      <div className="cal-header">
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={prevPeriod}>‹</button>
          <span className="cal-title">
            {calView === "month" ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
              : calView === "week" ? (() => { const w = buildWeekDays(); return `${w[0].getDate()} – ${w[6].getDate()} de ${MONTHS[w[6].getMonth()]}`; })()
              : "Próximos eventos"}
          </span>
          <button className="cal-nav-btn" onClick={nextPeriod}>›</button>
          <button className="cal-nav-btn" onClick={() => setCurrentDate(new Date())}>Hoje</button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="cal-tabs">
            {[["month","Mês"],["week","Semana"],["list","Lista"]].map(([v,l]) => (
              <button key={v} className={"cal-tab" + (calView === v ? " cal-tab-active" : "")} onClick={() => setCalView(v)}>{l}</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> Evento</button>
          <button className="btn btn-ghost" onClick={() => fetchEvents(tokens)} disabled={loading}>{loading ? <Loader2 size={13} className="spin" /> : "↻"}</button>
          <button className="btn btn-ghost" onClick={disconnect} style={{ color: "#FB7185", fontSize: 12 }}>Sair</button>
        </div>
      </div>

      {error && <div className="card" style={{ color: "#FB7185", fontSize: 13, marginBottom: 14 }}>{error}</div>}
      {loading && <div className="card" style={{ color: "#8993A6", fontSize: 13, display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}><Loader2 size={14} className="spin" /> Carregando eventos...</div>}

      {/* MONTH */}
      {calView === "month" && !loading && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="cal-grid">
            {WEEKDAYS.map((d) => <div key={d} className="cal-weekday">{d}</div>)}
            {buildMonthGrid().map((day, i) => {
              if (!day) return <div key={i} className="cal-day-empty" />;
              const dayEvs = eventsOnDay(day);
              return (
                <div key={i} className={"cal-day" + (isToday(day) ? " cal-today" : "")}
                  onClick={() => { setForm((f) => ({ ...f, date: day.toISOString().slice(0, 10) })); setShowForm(true); }}>
                  <div className="cal-num">{day.getDate()}</div>
                  {dayEvs.slice(0, 3).map((e) => {
                    const color = getEventColor(e.title);
                    return <div key={e.id} className="cal-chip" style={{ background: color + "22", color, border: `1px solid ${color}35` }}
                      onClick={(ev) => { ev.stopPropagation(); setSelectedEvent(e); }}>
                      {fmtTime(e.start)} {e.title}
                    </div>;
                  })}
                  {dayEvs.length > 3 && <div className="cal-more">+{dayEvs.length - 3} mais</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK */}
      {calView === "week" && !loading && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="week-grid">
            <div className="week-tl week-dh" />
            {buildWeekDays().map((day, i) => (
              <div key={i} className="week-dh">
                <div className="week-dn">{WEEKDAYS[day.getDay()]}</div>
                <div className={"week-dd" + (isToday(day) ? " week-dd-today" : "")}>{day.getDate()}</div>
              </div>
            ))}
            {Array.from({ length: 24 }, (_, hour) => (
              <React.Fragment key={hour}>
                <div className="week-tl"><span className="week-ht">{hour > 0 ? `${String(hour).padStart(2,"0")}:00` : ""}</span></div>
                {buildWeekDays().map((day, di) => {
                  const hourEvs = eventsOnDay(day).filter((e) => e.start && new Date(e.start).getHours() === hour);
                  return (
                    <div key={di} className="week-hr" onClick={() => {
                      setForm((f) => ({ ...f, date: day.toISOString().slice(0,10), startTime: `${String(hour).padStart(2,"0")}:00`, endTime: `${String(hour+1).padStart(2,"0")}:00` }));
                      setShowForm(true);
                    }}>
                      {hourEvs.map((e) => {
                        const color = getEventColor(e.title);
                        return <div key={e.id} className="week-ev" style={{ background: color + "25", color, border: `1px solid ${color}40`, top: 2 }}
                          onClick={(ev) => { ev.stopPropagation(); setSelectedEvent(e); }}>
                          {fmtTime(e.start)} {e.title}
                        </div>;
                      })}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* LIST */}
      {calView === "list" && !loading && (
        <div className="card">
          {upcomingEvents.length === 0 && <div className="empty-mini">Nenhum evento próximo.</div>}
          {upcomingEvents.map((e) => {
            const color = getEventColor(e.title);
            const d = new Date(e.start);
            return (
              <div key={e.id} className="list-ev" onClick={() => setSelectedEvent(e)}>
                <div className="list-dot" style={{ background: color }} />
                <div className="list-date">{d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</div>
                <div style={{ flex: 1 }}>
                  <div className="list-title">{e.title}</div>
                  <div className="list-time">{fmtTime(e.start)}{e.end ? ` — ${fmtTime(e.end)}` : ""}</div>
                  {e.description && <div style={{ fontSize: 11.5, color: "#5B6577", marginTop: 2 }}>{e.description}</div>}
                </div>
                {e.link && <a href={e.link} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()}
                  style={{ color: "#2DD4BF", fontSize: 12, textDecoration: "none", flexShrink: 0 }}>Abrir →</a>}
              </div>
            );
          })}
        </div>
      )}

      {/* EVENT POPUP */}
      {selectedEvent && (
        <>
          <div className="ev-overlay" onClick={() => setSelectedEvent(null)} />
          <div className="ev-popup">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 11, height: 11, borderRadius: 3, background: getEventColor(selectedEvent.title), flexShrink: 0 }} />
                <span style={{ fontSize: 15, fontWeight: 600 }}>{selectedEvent.title}</span>
              </div>
              <button className="icon-btn" onClick={() => setSelectedEvent(null)}><X size={16} /></button>
            </div>
            <div style={{ fontSize: 13, color: "#8993A6", marginBottom: 4 }}>{fmtFull(selectedEvent.start)}{selectedEvent.end ? ` — ${fmtTime(selectedEvent.end)}` : ""}</div>
            {selectedEvent.description && <div style={{ fontSize: 13, color: "#C7CCD6", lineHeight: 1.5, margin: "10px 0" }}>{selectedEvent.description}</div>}
            {selectedEvent.link && <a href={selectedEvent.link} target="_blank" rel="noopener noreferrer"
              className="btn btn-primary" style={{ textDecoration: "none", fontSize: 13, display: "inline-flex", marginTop: 8 }}>
              Abrir no Google Agenda →
            </a>}
          </div>
        </>
      )}

      {/* FORM MODAL */}
      {showForm && (
        <Modal title="Novo evento" onClose={() => setShowForm(false)}>
          <Field label="Título do evento">
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Reunião com Cliente X" />
          </Field>
          <Field label="Data">
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </Field>
          <div className="field-row">
            <Field label="Início"><input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} /></Field>
            <Field label="Fim"><input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} /></Field>
          </div>
          <Field label="Descrição (opcional)">
            <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
          {error && <div className="ai-error">{error}</div>}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={createEvent} disabled={creating || !form.title || !form.date}>
              {creating ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Criar evento
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function TrafficHub({ session }) {
  const userId = session?.user?.id;
  const userName = session?.user?.email?.split("@")[0] || "Usuário";
  const { data, ready, save, saveClient, deleteClient, saveLead, deleteLead } = useAppData(userId);
  const [view, setView] = useState("dashboard");

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!ready || !data) {
    return (
      <div className="boot-screen">
        <style>{GLOBAL_CSS}</style>
        <Loader2 size={22} className="spin" color="#2DD4BF" />
        <span>Carregando TrafficHub...</span>
      </div>
    );
  }

  return (
    <div className="app">
      <style>{GLOBAL_CSS}</style>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">TH</span><span className="brand-name">TrafficHub</span></div>
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.id} className={"nav-item" + (view === n.id ? " nav-item-active" : "")} onClick={() => setView(n.id)}>
              <n.icon size={17} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="client-avatar client-avatar-sm">{userName.slice(0, 2).toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div className="user-name">{userName}</div>
              <div className="user-plan">Administrador</div>
            </div>
            <button className="icon-btn" onClick={handleLogout} title="Sair"><LogOut size={14} /></button>
          </div>
        </div>
      </aside>
      <main className="main">
        {view === "dashboard" && <DashboardView data={data} save={save} />}
        {view === "clients" && <ClientsView data={data} save={save} saveClient={saveClient} deleteClient={deleteClient} />}
        {view === "contracts" && <ContractsModule userId={userId} clients={data.clients} />}
        {view === "campaigns" && <CampaignsView data={data} />}
        {view === "pipeline" && <PipelineView data={data} save={save} saveLead={saveLead} deleteLead={deleteLead} />}
        {view === "agenda" && <AgendaView />}
        {view === "ai" && <AIView data={data} />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GLOBAL CSS (design tokens: navy/charcoal surface, teal/coral/amber/violet signal colors, mono numerics)
// ---------------------------------------------------------------------------

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');

* { box-sizing: border-box; }
.app, .boot-screen { font-family: 'Inter', system-ui, sans-serif; background: #0B0E13; color: #E7EAF0; }
.boot-screen { height: 100vh; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 14px; color: #8993A6; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.app { display: flex; min-height: 100vh; width: 100%; }

.sidebar { width: 220px; flex-shrink: 0; background: #0E1117; border-right: 1px solid #1B202C; display: flex; flex-direction: column; padding: 18px 12px; }
.brand { display: flex; align-items: center; gap: 10px; padding: 6px 8px 22px; }
.brand-mark { width: 30px; height: 30px; border-radius: 8px; background: linear-gradient(135deg, #2DD4BF, #8B7CF6); display: flex; align-items: center; justify-content: center; font-family: 'Sora', sans-serif; font-weight: 700; font-size: 12px; color: #0B0E13; }
.brand-name { font-family: 'Sora', sans-serif; font-weight: 600; font-size: 15px; letter-spacing: -0.01em; }
.nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; background: none; border: none; color: #8993A6; font-size: 13.5px; font-weight: 500; cursor: pointer; text-align: left; font-family: inherit; }
.nav-item:hover { background: #161B25; color: #E7EAF0; }
.nav-item-active { background: #161B25; color: #2DD4BF; }
.sidebar-footer { border-top: 1px solid #1B202C; padding-top: 12px; }
.user-chip { display: flex; align-items: center; gap: 9px; padding: 6px 8px; }
.user-name { font-size: 12.5px; font-weight: 600; }
.user-plan { font-size: 11px; color: #5B6577; }

.main { flex: 1; padding: 28px 36px 60px; max-width: 1180px; }
.view-header { margin-bottom: 22px; }
.view-header-row { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px; }
.view h1 { font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 600; margin: 0 0 4px; letter-spacing: -0.01em; }
.view-sub { color: #8993A6; font-size: 13px; margin: 0; }

.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
.kpi-grid-4 { grid-template-columns: repeat(4, 1fr); }
.card { background: #141822; border: 1px solid #1F2530; border-radius: 12px; padding: 18px; margin-bottom: 18px; }
.kpi-card { margin-bottom: 0; }
.kpi-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.kpi-label { font-size: 12px; color: #8993A6; font-weight: 500; }
.kpi-value { font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 600; letter-spacing: -0.02em; }
.kpi-delta { display: flex; align-items: center; gap: 4px; font-size: 11.5px; margin-top: 6px; font-weight: 500; }

.grid-2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; }
.card-title { font-size: 13px; font-weight: 600; color: #C7CCD6; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
.card-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }

.risk-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid #1B202C; }
.risk-row:last-child { border-bottom: none; }
.risk-name { font-size: 13px; font-weight: 500; }
.risk-sub { font-size: 11.5px; color: #5B6577; font-family: 'JetBrains Mono', monospace; margin-top: 2px; }

.ai-card { border-color: #2A2440; background: linear-gradient(180deg, #161329 0%, #141822 100%); }
.ai-text { font-size: 13.5px; line-height: 1.7; color: #D5D9E2; white-space: pre-wrap; }
.ai-error { font-size: 13px; color: #FB7185; }
.empty-mini { color: #5B6577; font-size: 13px; padding: 6px 0; }

.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; }
.btn-primary { background: #2DD4BF; color: #06231F; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost { background: #1B202C; color: #C7CCD6; border: 1px solid #262C3A; }
.icon-btn { background: none; border: none; color: #8993A6; cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; padding: 4px 6px; border-radius: 6px; font-family: inherit; }
.icon-btn:hover { background: #1B202C; color: #E7EAF0; }
.icon-btn-danger:hover { color: #FB7185; }

.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 10px; }
.search-box { display: flex; align-items: center; gap: 8px; background: #141822; border: 1px solid #1F2530; border-radius: 8px; padding: 8px 12px; min-width: 220px; }
.search-box input { background: none; border: none; outline: none; color: #E7EAF0; font-size: 13px; width: 100%; font-family: inherit; }
.filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { background: #141822; border: 1px solid #1F2530; color: #8993A6; padding: 6px 12px; border-radius: 999px; font-size: 12px; cursor: pointer; font-family: inherit; }
.chip-active { background: #1B202C; color: #E7EAF0; border-color: #2DD4BF; }

.client-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; }
.client-card { cursor: pointer; transition: border-color 0.15s; }
.client-card:hover { border-color: #2DD4BF60; }
.client-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.client-avatar { width: 34px; height: 34px; border-radius: 9px; background: #1F2530; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #8993A6; font-family: 'Sora', sans-serif; }
.client-avatar-sm { width: 26px; height: 26px; font-size: 10px; }
.client-card-name { font-size: 14.5px; font-weight: 600; margin-bottom: 2px; }
.client-card-niche { font-size: 12px; color: #5B6577; margin-bottom: 10px; }
.client-card-value { font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 600; color: #2DD4BF; margin-bottom: 10px; }
.client-card-value span { color: #5B6577; font-size: 11px; font-weight: 400; }
.client-card-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.tag-mini { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; color: #8993A6; background: #1B202C; padding: 3px 7px; border-radius: 5px; }
.client-card-actions { display: flex; justify-content: space-between; border-top: 1px solid #1B202C; padding-top: 10px; }

.modal-overlay { position: fixed; inset: 0; background: #00000099; display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
.modal { background: #141822; border: 1px solid #262C3A; border-radius: 14px; width: 100%; max-width: 440px; max-height: 88vh; overflow-y: auto; }
.modal-wide { max-width: 680px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #1B202C; position: sticky; top: 0; background: #141822; }
.modal-header h3 { margin: 0; font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 600; }
.modal-body { padding: 20px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }

.field { display: block; margin-bottom: 12px; }
.field-label { display: block; font-size: 12px; color: #8993A6; margin-bottom: 5px; font-weight: 500; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
input, select, textarea { width: 100%; background: #0E1117; border: 1px solid #262C3A; border-radius: 7px; padding: 9px 11px; color: #E7EAF0; font-size: 13px; font-family: inherit; outline: none; }
input:focus, select:focus, textarea:focus { border-color: #2DD4BF; }

.detail-top { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.detail-niche { font-size: 12.5px; color: #8993A6; display: flex; align-items: center; gap: 4px; }
.detail-contacts { display: flex; gap: 16px; font-size: 12.5px; color: #8993A6; margin-bottom: 18px; }
.detail-contacts span { display: flex; align-items: center; gap: 5px; }

.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table th { text-align: left; color: #5B6577; font-weight: 500; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.03em; padding: 8px 10px; border-bottom: 1px solid #1F2530; }
.table td { padding: 11px 10px; border-bottom: 1px solid #181D27; }
.table-client { display: flex; align-items: center; gap: 8px; }

.client-selector { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
.client-chip { background: #141822; border: 1px solid #1F2530; color: #8993A6; padding: 7px 13px; border-radius: 999px; font-size: 12.5px; cursor: pointer; font-family: inherit; }
.client-chip-active { background: #1B202C; color: #2DD4BF; border-color: #2DD4BF; }

.kanban { display: grid; grid-template-columns: repeat(6, minmax(190px, 1fr)); gap: 12px; overflow-x: auto; padding-bottom: 8px; }
.kanban-col { background: #0E1117; border: 1px solid #1B202C; border-radius: 10px; padding: 10px; min-width: 190px; }
.kanban-col-header { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 600; color: #C7CCD6; padding: 4px 4px 10px; }
.kanban-count { background: #1B202C; color: #8993A6; font-size: 10.5px; padding: 1px 7px; border-radius: 999px; }
.kanban-col-body { display: flex; flex-direction: column; gap: 8px; min-height: 60px; }
.kanban-card { background: #141822; border: 1px solid #1F2530; border-radius: 8px; padding: 10px; }
.kanban-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; }
.kanban-card-name { font-size: 12.5px; font-weight: 600; }
.kanban-card-meta { font-size: 11px; color: #5B6577; margin-top: 3px; }
.kanban-card-value { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #2DD4BF; margin-top: 6px; }
.kanban-card-note { font-size: 11px; color: #8993A6; margin-top: 6px; line-height: 1.4; }
.kanban-card-actions { display: flex; justify-content: space-between; margin-top: 9px; padding-top: 8px; border-top: 1px solid #1B202C; }
.kanban-empty { font-size: 11.5px; color: #3E4554; text-align: center; padding: 14px 0; }

.ai-chat-card { padding: 0; overflow: hidden; }
.ai-thread { padding: 18px; min-height: 220px; max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.ai-suggestions { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.ai-msg { display: flex; gap: 8px; font-size: 13.5px; line-height: 1.6; max-width: 85%; }
.ai-msg-user { align-self: flex-end; background: #1B202C; padding: 9px 13px; border-radius: 10px 10px 2px 10px; }
.ai-msg-ai { align-self: flex-start; color: #D5D9E2; white-space: pre-wrap; }
.ai-input-row { display: flex; gap: 8px; padding: 14px; border-top: 1px solid #1B202C; }
.ai-input-row input { flex: 1; }

.agenda-connect-card { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 48px 32px; }

@media (max-width: 880px) {
  .sidebar { width: 70px; }
  .brand-name, .nav-item span, .user-name, .user-plan { display: none; }
  .nav-item { justify-content: center; }
  .user-chip { justify-content: center; }
  .main { padding: 20px 16px 50px; }
  .kpi-grid, .kpi-grid-4 { grid-template-columns: repeat(2, 1fr); }
  .grid-2 { grid-template-columns: 1fr; }
  .field-row { grid-template-columns: 1fr; }
  .kanban { grid-template-columns: 1fr; }
}
`;
