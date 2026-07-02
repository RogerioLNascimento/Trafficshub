"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AuthScreen from "@/components/AuthScreen";
import TrafficHub from "@/components/TrafficHub";
import { Loader2 } from "lucide-react";

export default function Page() {
  const [session, setSession] = useState(undefined); // undefined = carregando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Carregando
  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: "#0B0E13", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#8993A6", fontFamily: "Inter, sans-serif", fontSize: 14 }}>
        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <Loader2 size={20} className="spin" color="#2DD4BF" />
        Carregando TrafficHub...
      </div>
    );
  }

  // Não logado
  if (!session) return <AuthScreen />;

  // Logado
  return <TrafficHub session={session} />;
}
