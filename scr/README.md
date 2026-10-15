# EnergyIQ — site e funções

Esta pasta contém o site (React + Vite + Tailwind) e as funções serverless (`api/`).
A documentação completa do projeto está no [README da raiz](../README.md).

```bash
npm install
cp .env.example .env.local   # preencha com os valores da equipe
npm run dev                  # http://localhost:5173 (inclui as funções de api/)
npm run build                # gera dist/
node scripts/atualizar-tarifas.mjs   # atualiza as tarifas da ANEEL
```
