import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const STATE_DIR = path.join(ROOT, '.firebrox');
export const WORKSPACE_DIR = path.join(ROOT, 'workspace');
const SETTINGS_PATH = path.join(STATE_DIR, 'settings.json');

export const PROVIDERS = ['openai', 'anthropic', 'gemini', 'groq', 'ollama', 'custom', 'demo'];

export const PROVIDER_META = {
  openai: {
    label: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini'],
    defaultModel: 'gpt-4o-mini',
    needsKey: true,
  },
  anthropic: {
    label: 'Anthropic',
    baseURL: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest'],
    defaultModel: 'claude-3-5-haiku-latest',
    needsKey: true,
  },
  gemini: {
    label: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    defaultModel: 'gemini-2.0-flash',
    needsKey: true,
  },
  groq: {
    label: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
    needsKey: true,
  },
  ollama: {
    label: 'Ollama (local)',
    baseURL: 'http://localhost:11434/v1',
    models: ['llama3.1', 'llama3', 'qwen2.5', 'mistral', 'deepseek-r1'],
    defaultModel: 'llama3.1',
    needsKey: false,
  },
  custom: {
    label: 'OpenAI-compatible',
    baseURL: 'http://localhost:1234/v1',
    models: [],
    defaultModel: '',
    needsKey: false,
  },
  demo: {
    label: 'Demo brain (offline)',
    baseURL: '',
    models: [],
    defaultModel: 'demo',
    needsKey: false,
  },
};

export const DEFAULTS = {
  provider: 'demo',
  apiKey: '',
  model: '',
  baseURL: '',
  temperature: 0.7,
  maxSteps: 8,
  systemPrompt: '',
};

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !m[1].startsWith('#')) {
        const val = m[2].replace(/^["']|["']$/g, '');
        if (!process.env[m[1]]) process.env[m[1]] = val;
      }
    }
  }
}

function envSetting(name) {
  return process.env[`FIREBROX_${name}`];
}

export function getSettings() {
  loadEnv();
  const settings = { ...DEFAULTS };

  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      Object.assign(settings, JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')));
    } catch {
      /* ignore corrupt settings */
    }
  }

  // Environment variables override persisted settings.
  const envMap = {
    provider: envSetting('PROVIDER'),
    apiKey: envSetting('API_KEY'),
    model: envSetting('MODEL'),
    baseURL: envSetting('BASE_URL'),
    temperature: envSetting('TEMPERATURE'),
    maxSteps: envSetting('MAX_STEPS'),
  };
  for (const [k, v] of Object.entries(envMap)) {
    if (v !== undefined && v !== '') settings[k] = k === 'temperature' || k === 'maxSteps' ? Number(v) : v;
  }

  // Resolve model + base URL defaults.
  const meta = PROVIDER_META[settings.provider] || PROVIDER_META.custom;
  if (!settings.baseURL) settings.baseURL = meta.baseURL;
  if (!settings.model) settings.model = meta.defaultModel;

  return settings;
}

export function saveSettings(patch) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const current = getSettings();
  const next = { ...current, ...patch };

  // Strip undefined/empty values that should not persist as overrides.
  const allowed = [
    'provider', 'apiKey', 'model', 'baseURL', 'temperature', 'maxSteps', 'systemPrompt',
  ];
  const out = {};
  for (const k of allowed) if (next[k] !== undefined && next[k] !== '') out[k] = next[k];

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(out, null, 2));
  return getSettings();
}

export function publicConfig() {
  const s = getSettings();
  return {
    provider: s.provider,
    model: s.model,
    baseURL: s.baseURL,
    temperature: s.temperature,
    maxSteps: s.maxSteps,
    systemPrompt: s.systemPrompt,
    hasKey: Boolean(s.apiKey),
    providers: Object.fromEntries(
      Object.entries(PROVIDER_META).map(([k, m]) => [k, {
        label: m.label,
        defaultModel: m.defaultModel,
        models: m.models,
        needsKey: m.needsKey,
      }]),
    ),
  };
}

export function ensureDirs() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}
