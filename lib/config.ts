// Konfigurasi terpusat untuk environment variables
export const config = {
  librechat: {
    apiUrl: process.env.LIBRECHAT_API_URL,
    apiKey: process.env.LIBRECHAT_API_KEY,
    model: process.env.LIBRECHAT_MODEL,
    promptEngineerModel: process.env.LIBRECHAT_PROMPT_ENGINEER_MODEL,
    imageGeneratorModel: process.env.LIBRECHAT_IMAGE_GENERATOR_MODEL,
  },
  n8n: {
    webhookUrl: process.env.N8N_WEBHOOK_URL,
  },
};