function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const env = {
  get appUrl() {
    return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get encryptionKey() {
    return required("ENCRYPTION_KEY");
  },
  get cronSecret() {
    return process.env.CRON_SECRET;
  },
  github: {
    get clientId() {
      return required("GITHUB_CLIENT_ID");
    },
    get clientSecret() {
      return required("GITHUB_CLIENT_SECRET");
    },
    get scopes() {
      return process.env.GITHUB_SCOPES ?? "read:user";
    },
  },
  defaultAi: {
    get provider() {
      return process.env.DEFAULT_AI_PROVIDER;
    },
    get model() {
      return process.env.DEFAULT_AI_MODEL;
    },
    get apiKey() {
      return process.env.DEFAULT_AI_API_KEY;
    },
    get baseUrl() {
      return process.env.DEFAULT_AI_BASE_URL;
    },
  },
};
