import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../src/utils/ruleEngine.js',import.meta.url));
const target=new URL('../functions/lib/ruleEngine.mjs',import.meta.url);
if(process.argv.includes('--check')) assert.deepEqual(readFileSync(target),source,'Deployed engine must be byte-identical to client engine');
else writeFileSync(target,source);
console.log('Server/client engine parity verified');
