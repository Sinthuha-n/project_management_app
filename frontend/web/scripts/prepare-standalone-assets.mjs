import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';

const standaloneRoot = path.join('.next', 'standalone', 'frontend', 'web');
const standaloneNext = path.join(standaloneRoot, '.next');

function copyDirectory(source, destination, { required = true } = {}) {
  if (!existsSync(source)) {
    if (required) {
      throw new Error(`Required standalone asset source is missing: ${source}`);
    }
    return;
  }

  rmSync(destination, { force: true, recursive: true });
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

mkdirSync(standaloneNext, { recursive: true });
copyDirectory(path.join('.next', 'static'), path.join(standaloneNext, 'static'));
copyDirectory('public', path.join(standaloneRoot, 'public'), { required: false });
