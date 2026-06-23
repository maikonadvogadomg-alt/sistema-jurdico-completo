// Execute com: node setup-db.js
// Cria todas as tabelas do sistema jurídico no banco Neon
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function criarTabelas() {
  console.log('⚙️  Criando tabelas...');
  
  await sql`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      senha_hash VARCHAR(255) NOT NULL,
      perfil VARCHAR(20) DEFAULT 'advogado',
      oab VARCHAR(20),
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMP DEFAULT NOW()
    )`;
  console.log('✅ usuarios');

  await sql`
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(200) NOT NULL,
      cpf VARCHAR(14) UNIQUE,
      rg VARCHAR(20),
      email VARCHAR(150),
      telefone VARCHAR(20),
      celular VARCHAR(20),
      endereco TEXT,
      cidade VARCHAR(100),
      estado CHAR(2),
      cep VARCHAR(9),
      data_nascimento DATE,
      observacoes TEXT,
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )`;
  console.log('✅ clientes');

  await sql`
    CREATE TABLE IF NOT EXISTS processos (
      id SERIAL PRIMARY KEY,
      numero_processo VARCHAR(50) UNIQUE NOT NULL,
      cliente_id INTEGER REFERENCES clientes(id),
      usuario_id INTEGER REFERENCES usuarios(id),
      tipo VARCHAR(50),
      area_direito VARCHAR(50),
      vara VARCHAR(100),
      comarca VARCHAR(100),
      tribunal VARCHAR(100),
      fase VARCHAR(50) DEFAULT 'inicial',
      status VARCHAR(30) DEFAULT 'ativo',
      polo_ativo TEXT,
      polo_passivo TEXT,
      objeto TEXT,
      valor_causa DECIMAL(15,2),
      data_distribuicao DATE,
      data_prazo DATE,
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )`;
  console.log('✅ processos');

  await sql`
    CREATE TABLE IF NOT EXISTS audiencias (
      id SERIAL PRIMARY KEY,
      processo_id INTEGER REFERENCES processos(id),
      tipo VARCHAR(80),
      data_hora TIMESTAMP NOT NULL,
      local VARCHAR(200),
      sala VARCHAR(50),
      juiz VARCHAR(150),
      pauta TEXT,
      resultado TEXT,
      status VARCHAR(20) DEFAULT 'agendada',
      lembrete_enviado BOOLEAN DEFAULT false,
      criado_em TIMESTAMP DEFAULT NOW()
    )`;
  console.log('✅ audiencias');

  await sql`
    CREATE TABLE IF NOT EXISTS prazos (
      id SERIAL PRIMARY KEY,
      processo_id INTEGER REFERENCES processos(id),
      descricao TEXT NOT NULL,
      data_limite DATE NOT NULL,
      tipo VARCHAR(50),
      concluido BOOLEAN DEFAULT false,
      criado_em TIMESTAMP DEFAULT NOW()
    )`;
  console.log('✅ prazos');

  await sql`
    CREATE TABLE IF NOT EXISTS documentos (
      id SERIAL PRIMARY KEY,
      processo_id INTEGER REFERENCES processos(id),
      nome VARCHAR(200) NOT NULL,
      tipo VARCHAR(50),
      url TEXT,
      tamanho_bytes INTEGER,
      enviado_por INTEGER REFERENCES usuarios(id),
      criado_em TIMESTAMP DEFAULT NOW()
    )`;
  console.log('✅ documentos');

  await sql`
    CREATE TABLE IF NOT EXISTS movimentacoes (
      id SERIAL PRIMARY KEY,
      processo_id INTEGER REFERENCES processos(id),
      descricao TEXT NOT NULL,
      tipo VARCHAR(50),
      data_movimentacao TIMESTAMP DEFAULT NOW(),
      usuario_id INTEGER REFERENCES usuarios(id),
      origem VARCHAR(30) DEFAULT 'manual'
    )`;
  console.log('✅ movimentacoes');

  await sql`
    CREATE TABLE IF NOT EXISTS financeiro (
      id SERIAL PRIMARY KEY,
      processo_id INTEGER REFERENCES processos(id),
      cliente_id INTEGER REFERENCES clientes(id),
      descricao TEXT NOT NULL,
      tipo VARCHAR(20) NOT NULL,
      valor DECIMAL(15,2) NOT NULL,
      data_vencimento DATE,
      data_pagamento DATE,
      status VARCHAR(20) DEFAULT 'pendente',
      criado_em TIMESTAMP DEFAULT NOW()
    )`;
  console.log('✅ financeiro');

  console.log('');
  console.log('🎉 Todas as tabelas criadas com sucesso!');
  console.log('');
  console.log('Próximos passos:');
  console.log('  1. npm start           — iniciar o servidor');
  console.log('  2. POST /auth/registro — criar sua conta de admin');
  console.log('  3. POST /auth/login    — fazer login e obter token JWT');
  process.exit(0);
}

criarTabelas().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});