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

## Deploy

### Opção A: Railway (mais fácil, recomendado)

1. Crie uma conta em [railway.app](https://railway.app)
2. Crie um novo projeto → **Deploy from GitHub**
3. Adicione um serviço **PostgreSQL** no projeto
4. Adicione um serviço **Node.js** apontando para a pasta `backend/`
5. Defina as variáveis de ambiente:
   - `DATABASE_URL` → use a variável do PostgreSQL gerada pelo Railway (`${{Postgres.DATABASE_URL}}`)
   - `NODE_ENV=production`
   - `FRONTEND_URL=https://sua-url-do-frontend.com`
6. Para o frontend, suba em [vercel.com](https://vercel.com) apontando para a pasta `frontend/`:
   - Variável: `VITE_API_URL=https://sua-url-do-backend.railway.app`

### Opção B: Render

O arquivo `backend/render.yaml` já configura tudo automaticamente.

1. Faça push do projeto no GitHub
2. Acesse [render.com](https://render.com) → **New → Blueprint**
3. Selecione o repositório — o `render.yaml` faz o resto
4. Para o frontend, crie um **Static Site** no Render apontando para `frontend/`:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Variável: `VITE_API_URL=https://sua-url-do-backend.onrender.com`

---

## Estrutura do banco

```sql
groups   → id, letter (A-E)
teams    → id, name, group_id, position (1-4)
matches  → id, group_id, home_team_id, away_team_id, home_score, away_score, played
```

A classificação geral é calculada via SQL puro com `RANK() OVER (ORDER BY pts DESC, goal_diff DESC, gf DESC)`.

---

## Funcionalidades

- Editar nomes dos times diretamente na interface
- Registrar placares por grupo, jogo a jogo
- Classificação geral automática (pontos → saldo de gols → gols marcados)
- Número de classificados configurável (padrão: 16)
- Auto-refresh da classificação a cada 15 segundos
- Reset completo de nomes e placares
- Responsivo para mobile

---

## API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/groups` | Todos os grupos com times |
| PUT | `/api/groups/:letter/teams` | Atualizar nomes dos times |
| POST | `/api/groups/reset` | Resetar tudo |
| GET | `/api/matches?group=A` | Jogos de um grupo |
| PATCH | `/api/matches/:id` | Atualizar placar |
| GET | `/api/standings` | Classificação geral |
| GET | `/api/standings/group/:letter` | Classificação de um grupo |
| GET | `/health` | Health check |
