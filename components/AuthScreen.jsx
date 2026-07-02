"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .auth-bg { min-height: 100vh; background: #0B0E13; display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; padding: 20px; }
  .auth-card { background: #141822; border: 1px solid #1F2530; border-radius: 16px; padding: 36px 32px; width: 100%; max-width: 400px; }
  .auth-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; justify-content: center; }
  .auth-mark { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #2DD4BF, #8B7CF6); display: flex; align-items: center; justify-content: center; font-family: 'Sora', sans-serif; font-weight: 700; font-size: 14px; color: #0B0E13; }
  .auth-brand-name { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 20px; color: #E7EAF0; }
  .auth-title { font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 600; color: #E7EAF0; text-align: center; margin-bottom: 6px; }
  .auth-sub { font-size: 13px; color: #8993A6; text-align: center; margin-bottom: 24px; }
  .auth-field { margin-bottom: 14px; }
  .auth-label { display: block; font-size: 12px; color: #8993A6; font-weight: 500; margin-bottom: 5px; }
  .auth-input { width: 100%; background: #0E1117; border: 1px solid #262C3A; border-radius: 8px; padding: 10px 12px; color: #E7EAF0; font-size: 13px; font-family: inherit; outline: none; }
  .auth-input:focus { border-color: #2DD4BF; }
  .auth-btn { width: 100%; background: #2DD4BF; color: #06231F; border: none; border-radius: 8px; padding: 11px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 6px; }
  .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .auth-switch { text-align: center; margin-top: 18px; font-size: 13px; color: #8993A6; }
  .auth-switch button { background: none; border: none; color: #2DD4BF; cursor: pointer; font-size: 13px; font-family: inherit; font-weight: 500; }
  .auth-error { background: #FB718520; border: 1px solid #FB718540; border-radius: 8px; padding: 10px 12px; font-size: 13px; color: #FB7185; margin-bottom: 14px; }
  .auth-success { background: #2DD4BF20; border: 1px solid #2DD4BF40; border-radius: 8px; padding: 10px 12px; font-size: 13px; color: #2DD4BF; margin-bottom: 14px; }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

export default function AuthScreen() {
  const [mode, setMode] = useState("login"); // login | cadastro | esqueci
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setError("Preencha e-mail e senha."); return; }
    setLoading(true); setError(""); setSuccess("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
    setLoading(false);
  };

  const handleCadastro = async () => {
    if (!name || !email || !password) { setError("Preencha todos os campos."); return; }
    if (password.length < 6) { setError("A senha precisa ter pelo menos 6 caracteres."); return; }
    setLoading(true); setError(""); setSuccess("");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    if (data.user) {
      await supabase.from("profiles").insert({ id: data.user.id, name, role: "admin" });
      setSuccess("Conta criada! Verifique seu e-mail para confirmar o cadastro.");
    }
    setLoading(false);
  };

  const handleEsqueci = async () => {
    if (!email) { setError("Digite seu e-mail."); return; }
    setLoading(true); setError(""); setSuccess("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) setError(error.message);
    else setSuccess("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    setLoading(false);
  };

  const handle = mode === "login" ? handleLogin : mode === "cadastro" ? handleCadastro : handleEsqueci;

  return (
    <div className="auth-bg">
      <style>{CSS}</style>
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-mark">TH</div>
          <span className="auth-brand-name">TrafficHub</span>
        </div>

        <h2 className="auth-title">
          {mode === "login" ? "Entrar na sua conta" : mode === "cadastro" ? "Criar conta" : "Recuperar senha"}
        </h2>
        <p className="auth-sub">
          {mode === "login" ? "Hub de gestão para tráfego pago" : mode === "cadastro" ? "Configure sua agência em minutos" : "Vamos te ajudar a recuperar o acesso"}
        </p>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        {mode === "cadastro" && (
          <div className="auth-field">
            <label className="auth-label">Seu nome</label>
            <input className="auth-input" placeholder="Ex: Rafael Silva" value={name} onChange={e => setName(e.target.value)} />
          </div>
        )}

        <div className="auth-field">
          <label className="auth-label">E-mail</label>
          <input className="auth-input" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} />
        </div>

        {mode !== "esqueci" && (
          <div className="auth-field">
            <label className="auth-label">Senha</label>
            <input className="auth-input" type="password" placeholder={mode === "cadastro" ? "Mínimo 6 caracteres" : "••••••••"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} />
          </div>
        )}

        <button className="auth-btn" onClick={handle} disabled={loading}>
          {loading && <Loader2 size={15} className="spin" />}
          {mode === "login" ? "Entrar" : mode === "cadastro" ? "Criar conta" : "Enviar e-mail de recuperação"}
        </button>

        <div className="auth-switch">
          {mode === "login" && <>
            <button onClick={() => { setMode("esqueci"); setError(""); setSuccess(""); }}>Esqueci minha senha</button>
            {" · "}
            <button onClick={() => { setMode("cadastro"); setError(""); setSuccess(""); }}>Criar conta</button>
          </>}
          {mode === "cadastro" && <>
            Já tem conta?{" "}
            <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>Entrar</button>
          </>}
          {mode === "esqueci" && <>
            <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>Voltar para o login</button>
          </>}
        </div>
      </div>
    </div>
  );
}
