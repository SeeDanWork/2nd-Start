import express from 'express';
import { config, validateConfig } from './config.js';
import { llmRoutes } from './routes/llm-routes.js';

const app = express();
app.use(express.json());

// CORS for local dev
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  next();
});

app.use('/llm', llmRoutes);

// Root
app.get('/', (_req, res) => {
  res.json({
    service: '@adcp/llm-router',
    version: '0.1.0',
    endpoints: [
      'POST /llm/classify-intent',
      'POST /llm/extract-entities',
      'POST /llm/normalize-request',
      'POST /llm/check-ambiguity',
      'POST /llm/generate-clarification',
      'POST /llm/generate-explanation',
      'GET  /llm/usage',
      'GET  /llm/logs',
      'GET  /llm/cache',
      'POST /llm/cache/clear',
      'GET  /llm/health',
    ],
  });
});

const warnings = validateConfig();
if (warnings.length > 0) {
  console.log('\n--- Configuration Warnings ---');
  warnings.forEach(w => console.log(`  ! ${w}`));
  console.log('------------------------------\n');
}

app.listen(config.port, () => {
  console.log(`LLM Router running on http://localhost:${config.port}`);
  console.log(`Default model: ${config.defaultModel}`);
  console.log(`Fallback model: ${config.fallbackModel}`);
});
