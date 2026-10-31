import {readFile,readdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {normalizeBundle} from '../dist/modules/data.js';
import {inspect} from './validate-dramaturgy.mjs';
import {DRAMATURGY,scriptFingerprint,fingerprint} from '../dist/modules/dramaturgy.js';
async function walk(dir){for(const name of await readdir(dir)){const p=`${dir}/${name}`;if((await stat(p)).isDirectory())await walk(p);else if(name.endsWith('.js'))execFileSync(process.execPath,['--check',p]);}}
await walk('dist');const html=await readFile('dist/index.html','utf8');if(!html.includes('lang="ja"')||!html.includes('manifest'))throw Error('Document metadata missing');
const production=normalizeBundle(JSON.parse(await readFile('dist/data/mousetrap.json','utf8')));if(production.id!=='mousetrap-private'||production.sample||production.lines.length!==1164||production.warnings.length)throw Error('Built-in production dataset missing or inconsistent');
const audit=await inspect(),dramaturgy=JSON.parse(await readFile('dist/data/mousetrap-dramaturgy.ja.json','utf8'));if(audit.errors.length||audit.datasetSha256!==DRAMATURGY.revision||await scriptFingerprint(production)!==DRAMATURGY.sourceFingerprint||await fingerprint(dramaturgy)!==DRAMATURGY.contentFingerprint)throw Error('Audited explanations or release fingerprints are inconsistent');
const manifest=JSON.parse(await readFile('dist/manifest.webmanifest'));for(const icon of manifest.icons)await stat('dist/'+icon.src);
console.log('Static application checked. Serve dist/ at any path.');
