import path from 'node:path';

export interface Config {
  port: number; publicUrl: string; apiKey: string; dataDir: string; receiverDir: string;
  ttlMs: number; maxUploadBytes: number; sofficeBin: string; convertTimeoutMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 8080),
    publicUrl: (env.PUBLIC_URL ?? '').replace(/\/+$/, ''),
    apiKey: env.API_KEY ?? '',
    dataDir: path.resolve(env.DATA_DIR ?? './data'),
    receiverDir: path.resolve(env.RECEIVER_DIR ?? path.join(__dirname, '..', '..', 'receiver')),
    ttlMs: Number(env.CONTENT_TTL_MINUTES ?? 120) * 60_000,
    maxUploadBytes: Number(env.MAX_UPLOAD_MB ?? 200) * 1024 * 1024,
    sofficeBin: env.SOFFICE_BIN ?? 'soffice',
    convertTimeoutMs: Number(env.CONVERT_TIMEOUT_SECONDS ?? 120) * 1000
  };
}
