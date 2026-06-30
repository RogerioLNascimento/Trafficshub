import "./globals.css";

export const metadata = {
  title: "TrafficHub — Gestão para tráfego pago",
  description: "Hub de inteligência e operação para gestores de tráfego pago.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
