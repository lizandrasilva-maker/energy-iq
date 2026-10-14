const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO DO BANCO DE DADOS SQLITE ---
const dbPath = path.resolve(__dirname, 'telemetry.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco SQLite:', err.message);
  } else {
    console.log('📦 Conectado ao banco de dados SQLite (telemetry.db)');
  }
});

// Criação da Tabela conforme especificado
db.run(`
  CREATE TABLE IF NOT EXISTS telemetria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL,
    voltage FLOAT,
    current FLOAT,
    power FLOAT,
    energy FLOAT,
    pf FLOAT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Armazena a última leitura na memória para resposta rápida
let latestTelemetry = {};

// Rota POST: Recebe os dados do ESP32 e persiste no banco
app.post('/api/telemetry', (req, res) => {
  latestTelemetry = req.body;

  const equipmentId = req.body.equipmentId || req.body.equipment_id || 1;
  const voltage = req.body.voltage ?? null;
  const current = req.body.current ?? null;
  const power = req.body.powerKw ?? req.body.power ?? null;
  const energy = req.body.energy ?? null;
  const pf = req.body.pf ?? null;

  // Inserção na tabela telemetria
  const sql = `
    INSERT INTO telemetria (equipment_id, voltage, current, power, energy, pf)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [equipmentId, voltage, current, power, energy, pf], function (err) {
    if (err) {
      console.error('❌ Erro ao salvar no banco:', err.message);
      return res.status(500).json({ error: 'Erro interno ao salvar no banco de dados.' });
    }

    console.log(`📡 [ESP32] Registro ID ${this.lastID} salvo no SQLite com sucesso.`);
    res.status(200).json({ status: 'sucesso', id: this.lastID });
  });
});

// Rota GET: Envia os dados em tempo real para o Front-End
app.get('/api/telemetry', (req, res) => {
  res.json(latestTelemetry);
});

// Rota GET /api/analytics/compare: Rota de consultas agrupadas (Diária, Semanal, Mensal)
app.get('/api/analytics/compare', (req, res) => {
  const equipmentId = Number(req.query.equipmentId) || 1;
  const period = req.query.period || 'daily'; // 'daily', 'weekly', 'monthly'

  let groupByClause = "";
  let labelFormat = "";

  if (period === 'daily') {
    // Agrupa por dia (Ano-Mês-Dia) nos últimos 14 dias
    groupByClause = "DATE(timestamp)";
    labelFormat = "strftime('%d/%m', timestamp)";
  } else if (period === 'weekly') {
    // Agrupa por semana no ano
    groupByClause = "strftime('%Y-%W', timestamp)";
    labelFormat = "'Sem ' || strftime('%W', timestamp)";
  } else {
    // Agrupa por mês (Ano-Mês)
    groupByClause = "strftime('%Y-%m', timestamp)";
    labelFormat = "strftime('%m/%Y', timestamp)";
  }

  const query = `
    SELECT 
      ${labelFormat} as periodLabel,
      ROUND(AVG(power), 2) as avgPower,
      ROUND(SUM(power), 2) as totalEnergyKw,
      ROUND(AVG(pf), 2) as avgPf,
      COUNT(*) as recordsCount
    FROM telemetria
    WHERE equipment_id = ?
    GROUP BY ${groupByClause}
    ORDER BY timestamp DESC
    LIMIT 12
  `;

  db.all(query, [equipmentId], (err, rows) => {
    if (err) {
      console.error('❌ Erro ao consultar banco:', err.message);
      return res.status(500).json({ error: err.message });
    }
    // Inverte a ordem para ficar cronológico no gráfico
    res.json(rows.reverse());
  });
});

// Inicia o servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`Aguardando conexões do ESP32 no endpoint /api/telemetry...`);
});