const { createClient } = require('@supabase/supabase-js');

// Cabeçalhos padrão com suporte a CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  // Trata requisições de pré-conexão (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Variáveis de ambiente SUPABASE_URL ou SUPABASE_KEY não configuradas.' })
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const data = JSON.parse(event.body);
    
    // Insere os dados recebidos na tabela 'measurements'
    const { error } = await supabase.from('measurements').insert([
      {
        sensor_id: data.sensor_id,
        voltage: data.voltage,
        current: data.current,
        power: data.power,
        power_factor: data.power_factor,
        estimated_monthly_cost: data.estimated_monthly_cost
      }
    ]);

    if (error) {
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: error.message }) 
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Dados gravados no Supabase com sucesso!' })
    };
  } catch (err) {
    return { 
      statusCode: 400, 
      headers, 
      body: JSON.stringify({ error: 'Erro na requisição: ' + err.message }) 
    };
  }
};