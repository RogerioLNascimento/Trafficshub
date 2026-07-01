# TrafficHub

Sistema de gestão para gestores de tráfego pago: CRM de clientes, contratos, campanhas (KPIs), pipeline comercial em Kanban e um copiloto de IA (Claude) que analisa os dados e responde perguntas.

## Rodando localmente

```bash
npm install
cp .env.example .env.local
# edite .env.local e cole sua chave real da Anthropic
npm run dev
```

Abra http://localhost:3000

## Deploy na Vercel

**Opção A — via GitHub (recomendado)**

1. Crie um repositório no GitHub e suba este projeto:
   ```bash
   git init
   git add .
   git commit -m "TrafficHub inicial"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/trafficshub.git
   git push -u origin main
   ```
2. Em https://vercel.com → **Add New Project** → importe o repositório.
3. Em **Environment Variables**, adicione:
   - `ANTHROPIC_API_KEY` = sua chave (gere em https://console.anthropic.com/settings/keys)
4. Clique em **Deploy**.

**Opção B — via Vercel CLI**

```bash
npm install -g vercel
vercel
vercel env add ANTHROPIC_API_KEY
vercel --prod
```

⚠️ **Importante:** a chave da Anthropic só deve existir como variável de ambiente no servidor (`ANTHROPIC_API_KEY`), nunca com prefixo `NEXT_PUBLIC_`. Ela é usada exclusivamente dentro de `app/api/ai/route.js`, que roda no servidor — o navegador do usuário nunca tem acesso a ela.

## Estrutura do projeto

```
app/
  api/ai/route.js     → endpoint server-side que chama a API da Anthropic
  layout.js           → layout raiz
  page.js             → renderiza o componente principal
  globals.css         → reset básico
components/
  TrafficHub.jsx       → aplicação inteira (CRM, contratos, campanhas, pipeline, IA)
```

## O que já funciona

- CRM de clientes (criar, editar, excluir, buscar, filtrar por status)
- Contratos (MRR, status de pagamento, inadimplência)
- Campanhas com KPIs (CPL, CPA, ROAS, CTR) e gráficos
- Pipeline comercial em Kanban
- IA copiloto (análise de dashboard, análise por cliente, chat livre) — chamando a Claude de verdade
- Persistência local dos dados (localStorage do navegador)

## O que é simulado (próximos passos reais de evolução)

- **Métricas de campanha**: hoje são geradas com dados realistas simulados. Para conectar contas reais, é preciso implementar OAuth com o Meta Marketing API e o Google Ads API e trocar a função `genMetrics()` em `TrafficHub.jsx` por chamadas reais a essas APIs (idealmente via rotas server-side em `app/api/`, nunca direto do navegador, pelos mesmos motivos da chave da Anthropic).
- **Persistência**: hoje os dados ficam no `localStorage` do navegador (por usuário, por dispositivo). Para um SaaS multiusuário de verdade, o próximo passo é trocar por um banco de dados real (PostgreSQL) com uma API própria — posso gerar esse backend (com autenticação multiusuário, multi-tenant) como evolução deste projeto.
- **Pagamentos/contratos**: status de pagamento hoje é simulado; integrar com Stripe ou outro gateway é o passo natural para cobrança recorrente real.

## Stack

Next.js 14 (App Router) · React 18 · Recharts · Lucide Icons · API Route própria para IA
