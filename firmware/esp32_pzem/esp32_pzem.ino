// =====================================================================
// EnergyIQ — firmware ESP32 + PZEM-004T v3/v4 (versão 2, NOVA VERSÃO)
//
// Base: código da equipe de 14/10/2026 (versão 1). A versão 1 continua no
// protótipo ORIGINAL e grava no Supabase do original; esta versão 2 é da
// nova versão do EnergyIQ e não mexe no original.
// Mudanças da versão 2:
//  - Envia para a função /api/sensor da nova versão (Vercel), que valida e
//    grava no Supabase da nova versão. O dispositivo NÃO guarda chave do
//    banco: se identifica com um token (x-device-token).
//  - Senha do Wi-Fi e token ficam em secrets.h (fora do Git; copie de
//    secrets.example.h e preencha).
//  - Descarta as primeiras leituras após ligar: o PZEM devolveu lixo na
//    1ª leitura em 03/10 e 13/10 (289 MW, 4607 V, FP 365).
//  - Valida TODOS os valores pela faixa do PZEM e pela coerência P ≈ V·I·FP
//    antes de enviar (antes só testava se a tensão era NaN).
//  - Envia também energia acumulada (kWh) e frequência (Hz).
//  - Reconexão automática do Wi-Fi e tempo limite no HTTP.
//
// NÃO COMPILADO/TESTADO pela auditoria (sem Arduino IDE/hardware). Testar
// em bancada antes de gravar no protótipo da apresentação.
//
// Bibliotecas: PZEM004Tv30 (mandulaj), ArduinoJson 7.x. Placa: ESP32.
// =====================================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <PZEM004Tv30.h>
#include <ArduinoJson.h>
#include "secrets.h"  // WIFI_SSID, WIFI_PASSWORD, API_URL, DEVICE_TOKEN

// --- Sensor ---
#define SENSOR_ID   "ESP32_PZEM_01"  // mesmo valor do campo sensorId no site (src/data/plant.js)
#define PZEM_RX_PIN 16
#define PZEM_TX_PIN 17

// --- Envio ---
const unsigned long SEND_INTERVAL_MS = 3000;  // 3 s (≈ 29 mil linhas/dia por sensor)
const int LEITURAS_DESCARTADAS_NO_INICIO = 2;

// Energia (kWh) e frequência (Hz). Exigem as colunas da migração
// supabase/migrations/0003_energia_frequencia.sql no banco da nova versão;
// sem elas a função responde erro 500 e nada é gravado (ponha 0 nesse caso).
#define ENVIAR_ENERGIA_FREQ 1

PZEM004Tv30 pzem(Serial2, PZEM_RX_PIN, PZEM_TX_PIN);

unsigned long lastSendTime = 0;
int leiturasIniciais = 0;

// Faixa de medição do PZEM-004T v4 (100 A) + coerência P ≈ V·I·FP.
// Mesma regra usada no site (isPlausibleReading em src/lib/electrical.js).
bool leituraValida(float v, float i, float p, float pf) {
  if (isnan(v) || isnan(i) || isnan(p) || isnan(pf)) return false;
  if (v < 80.0 || v > 260.0) return false;
  if (i < 0.0 || i > 100.0) return false;
  if (p < 0.0 || p > 26000.0) return false;
  if (pf < 0.0 || pf > 1.0) return false;
  // Quadro serial corrompido costuma trazer valores incoerentes entre si
  float esperado = v * i * pf;
  float tolerancia = max(5.0f, 0.15f * max(p, esperado));
  if (fabs(p - esperado) > tolerancia) return false;
  return true;
}

void conectarWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando ao Wi-Fi");
  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 20000) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWi-Fi conectado. IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n⚠️ Wi-Fi não conectou em 20 s; tentando de novo no próximo ciclo.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- Monitor de Energia EnergyIQ (firmware v2) ---");
  conectarWiFi();
}

void enviarLeitura(float v, float i, float p, float pf, float energia, float freq) {
  WiFiClientSecure client;
  client.setInsecure();  // protótipo: não confere o certificado do servidor

  HTTPClient http;
  http.setTimeout(8000);
  if (!http.begin(client, API_URL)) {
    Serial.println("❌ Erro ao iniciar a conexão HTTPS!");
    return;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);

  JsonDocument doc;
  doc["sensor_id"]    = SENSOR_ID;
  doc["voltage"]      = v;
  doc["current"]      = i;
  doc["power"]        = p;   // W
  doc["power_factor"] = pf;
#if ENVIAR_ENERGIA_FREQ
  if (!isnan(energia)) doc["energy_kwh"] = energia;  // contador acumulado do PZEM
  if (!isnan(freq))    doc["frequency"]  = freq;
#endif

  String payload;
  serializeJson(doc, payload);
  int code = http.POST(payload);
  if (code == 401) {
    Serial.println("❌ Token recusado (HTTP 401): confira DEVICE_TOKEN em secrets.h e na Vercel.");
  } else if (code == 200 || code == 201) {
    Serial.printf("✅ Enviado (HTTP %d)\n", code);
  } else {
    Serial.printf("❌ Erro no envio (HTTP %d): %s\n", code, http.getString().c_str());
  }
  http.end();
}

void loop() {
  if (millis() - lastSendTime < SEND_INTERVAL_MS) return;
  lastSendTime = millis();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ Wi-Fi desconectado; tentando reconectar...");
    conectarWiFi();
    return;
  }

  float v   = pzem.voltage();
  float i   = pzem.current();
  float p   = pzem.power();
  float pf  = pzem.pf();
  float e   = pzem.energy();
  float f   = pzem.frequency();

  // Primeiras leituras após ligar: descartadas (vieram corrompidas nos testes)
  if (leiturasIniciais < LEITURAS_DESCARTADAS_NO_INICIO) {
    leiturasIniciais++;
    Serial.printf("… leitura inicial %d descartada\n", leiturasIniciais);
    return;
  }

  if (!leituraValida(v, i, p, pf)) {
    Serial.printf("⚠️ Leitura descartada: %.1f V | %.3f A | %.1f W | FP %.2f\n", v, i, p, pf);
    return;
  }

  Serial.printf("[%s] %.1f V | %.3f A | %.1f W | FP %.2f | %.3f kWh | %.1f Hz\n",
                SENSOR_ID, v, i, p, pf, e, f);
  enviarLeitura(v, i, p, pf, e, f);
}
