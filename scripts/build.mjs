import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = resolve(root, 'dist');
await mkdir(target, { recursive: true });
for (const path of ['index.html', '.nojekyll', 'assets', 'data']) {
  await cp(resolve(root, path), resolve(target, path), { recursive: true });
}
console.log('Static site built in dist/. No runtime dependencies.');
