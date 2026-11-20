import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import { CONVERTIBLE, ALLOWED, MIME, convertToPdf, extOf, extractNotes, kindOf, looksLikeExpectedType, safeName } from './files';
import { loadConfig, type Config } from './config';
import { RoomStore } from './rooms';

interface Meta { id: string; createdAt: number; expiresAt: number }

export function createApp(cfg: Config = loadConfig()) {
  const app = express();
  const rooms = new RoomStore();
  const contentRoot = path.join(cfg.dataDir, 'content');
  fs.mkdirSync(contentRoot, { recursive: true });
  const tmp = path.join(cfg.dataDir, 'tmp');
  fs.mkdirSync(tmp, { recursive: true });

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors());
  app.use(express.json({ limit: '64kb' }));
  app.use(rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));

  const requireKey = (req: Request, res: Response, next: NextFunction) => {
    if (!cfg.apiKey) return next();
    const a = Buffer.from(cfg.apiKey), b = Buffer.from(String(req.header('x-smartbeam-key') ?? ''));
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
    res.status(401).json({ error: 'Invalid or missing API key.' });
  };

  const baseUrl = (req: Request) => cfg.publicUrl || `${req.protocol}://${req.get('host')}`;
  const upload = multer({ dest: tmp, limits: { fileSize: cfg.maxUploadBytes, files: 1 } });

  app.get('/health', (_req, res) => res.json({ ok: true, converter: cfg.sofficeBin }));

  // ---- temporary content hosting + conversion ------------------------------------------------
  const handleUpload = async (req: Request, res: Response) => {
    const f = req.file;
    if (!f) return res.status(400).json({ error: 'No file was uploaded.' });
    const cleanupTmp = () => fs.rmSync(f.path, { force: true });
    try {
      const name = safeName(f.originalname);
      const ext = extOf(name);
      if (!ALLOWED.has(ext)) { cleanupTmp(); return res.status(415).json({ error: `Unsupported file type .${ext}` }); }
      if (!looksLikeExpectedType(f.path, ext)) { cleanupTmp(); return res.status(415).json({ error: 'The file content does not match its extension.' }); }

      const id = crypto.randomBytes(16).toString('hex');
      const dir = path.join(contentRoot, id);
      fs.mkdirSync(dir, { recursive: true });
      const dest = path.join(dir, name);
      fs.renameSync(f.path, dest);
      const now = Date.now();
      fs.writeFileSync(path.join(dir, '.meta.json'), JSON.stringify({ id, createdAt: now, expiresAt: now + cfg.ttlMs } satisfies Meta));

      const url = `${baseUrl(req)}/c/${id}/${encodeURIComponent(name)}`;
      const body: Record<string, unknown> = { id, kind: kindOf(ext), url, expiresAt: now + cfg.ttlMs };
      if (req.body?.convert === '1' && CONVERTIBLE.has(ext)) {
        try {
          const pdf = await convertToPdf(cfg.sofficeBin, dest, dir, cfg.convertTimeoutMs);
          body.pdfUrl = `${baseUrl(req)}/c/${id}/${encodeURIComponent(path.basename(pdf))}`;
          if (ext === 'pptx') body.notes = await extractNotes(dest).catch(() => []);
        } catch (e) {
          fs.rmSync(dir, { recursive: true, force: true });
          return res.status(422).json({ error: (e as Error).message });
        }
      }
      res.status(201).json(body);
    } catch (e) {
      cleanupTmp();
      res.status(500).json({ error: 'Upload failed.' });
    }
  };

  app.post('/api/content', requireKey, upload.single('file'), handleUpload);
  app.post('/api/convert', requireKey, upload.single('file'), (req, res, next) => { req.body = { ...req.body, convert: '1' }; handleUpload(req, res).catch(next); });

  app.delete('/api/content/:id', requireKey, (req, res) => {
    if (!/^[a-f0-9]{32}$/.test(req.params.id)) return res.status(400).json({ error: 'Bad id' });
    fs.rmSync(path.join(contentRoot, req.params.id), { recursive: true, force: true });
    res.json({ deleted: true });
  });

  app.get('/c/:id/:file', (req, res) => {
    const { id } = req.params;
    if (!/^[a-f0-9]{32}$/.test(id)) return res.status(400).end();
    const file = path.join(contentRoot, id, path.basename(req.params.file));
    if (!file.startsWith(path.join(contentRoot, id)) || !fs.existsSync(file) || path.basename(file).startsWith('.')) return res.status(404).end();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', MIME[extOf(file)] ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(file); // supports Range requests
  });

  // ---- QR rooms ---------------------------------------------------------------------------------
  const roomLimit = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
  app.post('/api/rooms', roomLimit, (_req, res) => res.status(201).json(rooms.create()));
  app.get('/api/rooms/:id', (req, res) => { const i = rooms.info(req.params.id); i ? res.json(i) : res.status(404).json({ error: 'Room not found' }); });
  app.get('/api/rooms/:id/state', async (req, res) => {
    const r = await rooms.poll(req.params.id, String(req.query.rt ?? ''), Number(req.query.since ?? 0));
    r ? res.json(r) : res.status(404).json({ error: 'Room not found' });
  });
  app.patch('/api/rooms/:id/state', (req, res) => {
    const { key, patch } = req.body ?? {};
    if (!patch || typeof patch !== 'object') return res.status(400).json({ error: 'Missing patch' });
    rooms.patch(req.params.id, String(key ?? ''), patch) ? res.json({ ok: true }) : res.status(403).json({ error: 'Invalid room key' });
  });

  // ---- receiver pages ---------------------------------------------------------------------------
  app.use('/receiver', express.static(cfg.receiverDir, { index: 'room.html' }));
  app.get('/', (_req, res) => res.redirect('/receiver/room.html'));

  // ---- expiry -----------------------------------------------------------------------------------
  const sweep = () => {
    const now = Date.now();
    for (const id of fs.readdirSync(contentRoot)) {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(contentRoot, id, '.meta.json'), 'utf8')) as Meta;
        if (meta.expiresAt < now) fs.rmSync(path.join(contentRoot, id), { recursive: true, force: true });
      } catch { fs.rmSync(path.join(contentRoot, id), { recursive: true, force: true }); }
    }
    rooms.sweep();
  };
  const timer = setInterval(sweep, 60_000);
  timer.unref();

  app.use((err: Error & { code?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File is too large.' });
    res.status(500).json({ error: 'Server error.' });
  });

  return { app, sweep, rooms, stop: () => clearInterval(timer) };
}
