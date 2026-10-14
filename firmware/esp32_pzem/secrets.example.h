// Copie este arquivo para secrets.h (mesma pasta) e preencha.
// secrets.h NÃO vai para o Git (está no .gitignore): o repositório é público.

#pragma once

#define WIFI_SSID     "nome-da-rede"
#define WIFI_PASSWORD "senha-da-rede"

// Função da nova versão que recebe as medições (Vercel)
#define API_URL       "https://energy-iq-tau.vercel.app/api/sensor"

// Mesmo valor da variável DEVICE_TOKEN cadastrada na Vercel
#define DEVICE_TOKEN  "cole-aqui-o-token-do-dispositivo"
