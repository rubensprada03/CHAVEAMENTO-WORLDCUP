# FIFA Champ 🏆

Plataforma para gerenciar campeonatos de FIFA entre amigos. 5 grupos, registro de placares, classificação geral automática.

## Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Banco de dados**: PostgreSQL

---

## Rodando localmente

### Pré-requisitos
- Node.js 18+
- PostgreSQL rodando localmente (ou use um serviço cloud)

### 1. Clone e configure o backend

```bash
cd backend
npm install
cp .env.example .env
```

Edite o `.env` com sua connection string do PostgreSQL:
```
DATABASE_URL=postgresql://user:senha@localhost:5432/fifa_champ
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

Inicie o backend (ele cria as tabelas e seed automaticamente na primeira vez):
```bash
npm run dev
```

### 2. Configure o frontend

```bash
cd frontend
npm install
cp .env.example .env
```

O `.env` do frontend pode ficar padrão para dev local (o Vite já tem proxy configurado).

Inicie o frontend:
```bash
npm run dev
```

Acesse: [http://localhost:5173](http://localhost:5173)

---
