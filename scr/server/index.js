const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Armazena as leituras em memória
let sensorData = {
  equipmentId: 1,
  voltage: 0,
  current: 0,
  powerKw: 0,
  pf: 0,
  frequency: 0,
  energyKwh: 0,
  updatedAt: new Date()
};

// 📥 Rota que o ESP32 chama (POST)
app.post('/api/telemetry', (req, res) => {
  sensorData = {
    ...req.body,
    updatedAt: new Date()
  };
  console.log('📡 Dados recebidos do ESP32:', sensorData);
  res.status(200).json({ status: 'OK' });
});

// 📤 Rota que a tela SmartSensors.jsx chama (GET)
app.get('/api/telemetry', (req, res) => {
  res.json(sensorData);
});

// Inicia na porta 3001 aceitando conexões da rede local (0.0.0.0)
app.listen(3001, '0.0.0.0', () => {
  console.log('🚀 Backend do ESP32 rodando em http://localhost:3001');
});