import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const upload = multer();

const app = express();
app.use(cors({ origin: true }));

async function withTempFiles(handler) {
  const baseDir = await mkdtemp(join(tmpdir(), 'pdf2svg-'));
  try {
    return await handler(baseDir);
  } finally {
    await rm(baseDir, { force: true, recursive: true });
  }
}

app.post('/convert/svg', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'missing file field' });
  }

  const exportPlain = req.body.exportPlain !== 'false';
  const vacuumDefs = req.body.vacuumDefs !== 'false';

  try {
    await withTempFiles(async (dir) => {
      const inputPath = join(dir, 'input.pdf');
      const outputPath = join(dir, 'output.svg');

      await writeFile(inputPath, req.file.buffer);

      const args = [
        inputPath,
        '--export-type=svg',
        `--export-filename=${outputPath}`
      ];

      if (exportPlain) {
        args.push('--export-plain-svg');
      }
      if (vacuumDefs) {
        args.push('--vacuum-defs');
      }

      console.log('[convert/svg] exec inkscape', { args });
      const { stdout, stderr } = await execFileAsync('inkscape', args, { windowsHide: true });
      if (stdout) {
        console.log('[convert/svg] inkscape stdout', stdout);
      }
      if (stderr) {
        console.log('[convert/svg] inkscape stderr', stderr);
      }

      const svg = await readFile(outputPath);
      console.log('[convert/svg] output bytes', svg.length);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(svg);
    });
  } catch (error) {
    console.error('[convert/svg] error', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`pdf-svg-service listening on http://localhost:${port}`);
});
