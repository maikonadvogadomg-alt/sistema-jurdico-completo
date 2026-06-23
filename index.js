require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { neon } = require('@neondatabase/serverless');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'troque_esta_senha_em_producao';

// ─── Conexão com banco Neon ───────────────────────────────────────────────
const sql = neon(process.env.DATABASE_URL);

app.use(cors());
app.use(express.json());

// ─── Middleware de autenticação ───────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ erro: 'Token necessário' });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ROTAS PÚBLICAS
// ═══════════════════════════════════════════════════════════════════════════

// GET /health — verificar se a API está online
app.get('/health', (_, res) => res.json({ status: 'ok', hora: new Date().toISOString() }));

// POST /auth/login — autenticar usuário
app.post('/auth/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });
  try {
    const rows = await sql`SELECT * FROM usuarios WHERE email = ${email} AND ativo = true`;
    const usuario = rows[0];
    if (!usuario) return res.status(401).json({ erro: 'Credenciais inválidas' });
    const ok = await bcrypt.compare(senha, usuario.senha_hash);
    if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' });
    const token = jwt.sign({ id: usuario.id, email: usuario.email, perfil: usuario.perfil }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil, oab: usuario.oab } });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /auth/registro — criar primeiro usuário admin
app.post('/auth/registro', async (req, res) => {
  const { nome, email, senha, oab } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Nome, email e senha obrigatórios' });
  try {
    const hash = await bcrypt.hash(senha, 12);
    const rows = await sql`
      INSERT INTO usuarios (nome, email, senha_hash, perfil, oab)
      VALUES (${nome}, ${email}, ${hash}, 'admin', ${oab || null})
      RETURNING id, nome, email, perfil, oab`;
    const token = jwt.sign({ id: rows[0].id, email: rows[0].email, perfil: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, usuario: rows[0] });
  } catch (err) {
    if (err.message.includes('unique')) return res.status(409).json({ erro: 'Email já cadastrado' });
    res.status(500).json({ erro: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLIENTES (protegido por auth)
// ═══════════════════════════════════════════════════════════════════════════
app.get('/clientes', auth, async (req, res) => {
  const { busca, pagina = 1, limite = 20 } = req.query;
  const offset = (pagina - 1) * limite;
  try {
    let rows;
    if (busca) {
      rows = await sql`SELECT * FROM clientes WHERE ativo = true AND (nome ILIKE ${'%'+busca+'%'} OR cpf LIKE ${'%'+busca+'%'} OR email ILIKE ${'%'+busca+'%'}) ORDER BY nome LIMIT ${+limite} OFFSET ${offset}`;
    } else {
      rows = await sql`SELECT * FROM clientes WHERE ativo = true ORDER BY nome LIMIT ${+limite} OFFSET ${offset}`;
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get('/clientes/:id', auth, async (req, res) => {
  try {
    const [cliente] = await sql`SELECT * FROM clientes WHERE id = ${req.params.id} AND ativo = true`;
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });
    const processos = await sql`SELECT id, numero_processo, tipo, area_direito, status, fase FROM processos WHERE cliente_id = ${req.params.id} ORDER BY criado_em DESC`;
    res.json({ ...cliente, processos });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post('/clientes', auth, async (req, res) => {
  const { nome, cpf, rg, email, telefone, celular, endereco, cidade, estado, cep, data_nascimento, observacoes } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
  try {
    const [c] = await sql`INSERT INTO clientes (nome,cpf,rg,email,telefone,celular,endereco,cidade,estado,cep,data_nascimento,observacoes) VALUES (${nome},${cpf||null},${rg||null},${email||null},${telefone||null},${celular||null},${endereco||null},${cidade||null},${estado||null},${cep||null},${data_nascimento||null},${observacoes||null}) RETURNING *`;
    res.status(201).json(c);
  } catch (err) {
    if (err.message.includes('unique')) return res.status(409).json({ erro: 'CPF ou email já cadastrado' });
    res.status(500).json({ erro: err.message });
  }
});

app.put('/clientes/:id', auth, async (req, res) => {
  const { nome, cpf, rg, email, telefone, celular, endereco, cidade, estado, cep, data_nascimento, observacoes } = req.body;
  try {
    const [c] = await sql`UPDATE clientes SET nome=COALESCE(${nome},nome), cpf=COALESCE(${cpf||null},cpf), email=COALESCE(${email||null},email), telefone=COALESCE(${telefone||null},telefone), celular=COALESCE(${celular||null},celular), endereco=COALESCE(${endereco||null},endereco), cidade=COALESCE(${cidade||null},cidade), estado=COALESCE(${estado||null},estado), cep=COALESCE(${cep||null},cep), observacoes=COALESCE(${observacoes||null},observacoes), atualizado_em=NOW() WHERE id=${req.params.id} RETURNING *`;
    res.json(c);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSOS
// ═══════════════════════════════════════════════════════════════════════════
app.get('/processos', auth, async (req, res) => {
  const { busca, status, area, pagina = 1, limite = 20 } = req.query;
  const offset = (pagina - 1) * limite;
  try {
    const rows = await sql`
      SELECT p.*, c.nome AS cliente_nome, c.cpf AS cliente_cpf, u.nome AS advogado
      FROM processos p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN usuarios u ON u.id = p.usuario_id
      WHERE (${busca||null} IS NULL OR p.numero_processo ILIKE ${'%'+(busca||'')+'%'} OR c.nome ILIKE ${'%'+(busca||'')+'%'})
        AND (${status||null} IS NULL OR p.status = ${status||null})
        AND (${area||null} IS NULL OR p.area_direito = ${area||null})
      ORDER BY p.criado_em DESC
      LIMIT ${+limite} OFFSET ${offset}`;
    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get('/processos/:id', auth, async (req, res) => {
  try {
    const [p] = await sql`SELECT p.*, c.nome AS cliente_nome FROM processos p LEFT JOIN clientes c ON c.id = p.cliente_id WHERE p.id = ${req.params.id}`;
    if (!p) return res.status(404).json({ erro: 'Processo não encontrado' });
    const [audiencias, prazos, documentos, movimentacoes] = await Promise.all([
      sql`SELECT * FROM audiencias WHERE processo_id = ${req.params.id} ORDER BY data_hora`,
      sql`SELECT * FROM prazos WHERE processo_id = ${req.params.id} ORDER BY data_limite`,
      sql`SELECT * FROM documentos WHERE processo_id = ${req.params.id} ORDER BY criado_em DESC`,
      sql`SELECT * FROM movimentacoes WHERE processo_id = ${req.params.id} ORDER BY data_movimentacao DESC LIMIT 50`,
    ]);
    res.json({ ...p, audiencias, prazos, documentos, movimentacoes });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post('/processos', auth, async (req, res) => {
  const { numero_processo, cliente_id, tipo, area_direito, vara, comarca, tribunal, polo_ativo, polo_passivo, objeto, valor_causa, data_distribuicao, data_prazo, observacoes } = req.body;
  if (!numero_processo) return res.status(400).json({ erro: 'Número do processo obrigatório' });
  try {
    const [p] = await sql`INSERT INTO processos (numero_processo,cliente_id,usuario_id,tipo,area_direito,vara,comarca,tribunal,polo_ativo,polo_passivo,objeto,valor_causa,data_distribuicao,data_prazo,observacoes) VALUES (${numero_processo},${cliente_id||null},${req.usuario.id},${tipo||null},${area_direito||null},${vara||null},${comarca||null},${tribunal||null},${polo_ativo||null},${polo_passivo||null},${objeto||null},${valor_causa||null},${data_distribuicao||null},${data_prazo||null},${observacoes||null}) RETURNING *`;
    res.status(201).json(p);
  } catch (err) {
    if (err.message.includes('unique')) return res.status(409).json({ erro: 'Número de processo já cadastrado' });
    res.status(500).json({ erro: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUDIÊNCIAS
// ═══════════════════════════════════════════════════════════════════════════
app.get('/audiencias', auth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT a.*, p.numero_processo, c.nome AS cliente_nome
      FROM audiencias a
      JOIN processos p ON p.id = a.processo_id
      LEFT JOIN clientes c ON c.id = p.cliente_id
      WHERE a.data_hora >= NOW()
      ORDER BY a.data_hora LIMIT 50`;
    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post('/audiencias', auth, async (req, res) => {
  const { processo_id, tipo, data_hora, local, sala, juiz, pauta } = req.body;
  if (!processo_id || !data_hora) return res.status(400).json({ erro: 'Processo e data/hora obrigatórios' });
  try {
    const [a] = await sql`INSERT INTO audiencias (processo_id,tipo,data_hora,local,sala,juiz,pauta) VALUES (${processo_id},${tipo||null},${data_hora},${local||null},${sala||null},${juiz||null},${pauta||null}) RETURNING *`;
    res.status(201).json(a);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// PRAZOS
// ═══════════════════════════════════════════════════════════════════════════
app.get('/prazos/proximos', auth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT pr.*, p.numero_processo, c.nome AS cliente_nome
      FROM prazos pr
      JOIN processos p ON p.id = pr.processo_id
      LEFT JOIN clientes c ON c.id = p.cliente_id
      WHERE pr.concluido = false AND pr.data_limite >= NOW()::date
      ORDER BY pr.data_limite LIMIT 30`;
    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD — resumo geral
// ═══════════════════════════════════════════════════════════════════════════
app.get('/dashboard', auth, async (req, res) => {
  try {
    const [stats] = await sql`
      SELECT
        (SELECT COUNT(*) FROM processos WHERE status = 'ativo') AS processos_ativos,
        (SELECT COUNT(*) FROM clientes WHERE ativo = true) AS total_clientes,
        (SELECT COUNT(*) FROM audiencias WHERE data_hora BETWEEN NOW() AND NOW() + INTERVAL '7 days') AS audiencias_semana,
        (SELECT COUNT(*) FROM prazos WHERE concluido = false AND data_limite <= NOW()::date + 7) AS prazos_proximos`;
    res.json(stats);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ─── Iniciar servidor ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(``);
  console.log(`⚖️  Sistema Jurídico SK — API REST`);
  console.log(`🟢 Rodando em http://localhost:${PORT}`);
  console.log(``);
  console.log(`Endpoints disponíveis:`);
  console.log(`  POST /auth/registro   — criar conta`);
  console.log(`  POST /auth/login      — fazer login`);
  console.log(`  GET  /dashboard       — resumo geral`);
  console.log(`  GET  /clientes        — listar clientes`);
  console.log(`  GET  /processos       — listar processos`);
  console.log(`  GET  /audiencias      — próximas audiências`);
  console.log(`  GET  /prazos/proximos — prazos vencendo`);
});