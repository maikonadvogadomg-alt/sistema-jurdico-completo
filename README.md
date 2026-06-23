# Sistema Jurídico SK — API REST Completa ⚖️

## Configuração

### 1. Banco de Dados (Neon — gratuito)
1. Acesse **neon.tech** e crie conta
2. Crie um projeto chamado "juridico"
3. Copie a **Connection string** do painel
4. Cole no arquivo **.env** em DATABASE_URL

### 2. Instalar e configurar
```bash
npm install
node setup-db.js   # cria todas as tabelas automaticamente
npm start          # inicia o servidor
```

## Criar primeira conta de admin

```bash
curl -X POST http://localhost:3000/auth/registro \
  -H "Content-Type: application/json" \
  -d '{"nome":"Dr. Saulo Kenji","email":"saulo@sk.com","senha":"sua_senha","oab":"OAB/XX 12345"}'
```

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | /health | Verificar API |
| POST | /auth/registro | Criar conta |
| POST | /auth/login | Fazer login |
| GET | /dashboard | Resumo geral |
| GET/POST | /clientes | Listar/criar clientes |
| GET | /clientes/:id | Detalhes + processos do cliente |
| PUT | /clientes/:id | Editar cliente |
| GET/POST | /processos | Listar/criar processos |
| GET | /processos/:id | Detalhes completos + tudo vinculado |
| GET | /audiencias | Próximas audiências |
| POST | /audiencias | Cadastrar audiência |
| GET | /prazos/proximos | Prazos vencendo |

## Publicar no Railway (grátis)
1. Crie conta em **railway.app**
2. "New Project" → "Deploy from GitHub"
3. Configure as variáveis de ambiente (DATABASE_URL e JWT_SECRET)
4. Deploy automático!

## Áreas do Direito suportadas
- Cível | Trabalhista | Criminal | Família | Previdenciário | Tributário | Consumidor | Administrativo
