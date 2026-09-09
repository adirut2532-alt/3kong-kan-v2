import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
// Online repair explicitly authorized after audit on 2026-09-08. Original hashes remain in qa/core-preservation.json.
// AI improvement explicitly requested by the owner; canonical game rules remain locked.
const baseline=JSON.parse(readFileSync(new URL('../qa/core-preservation.json',import.meta.url)));
for(const item of baseline.filter(x=>x.sha256 && !['functions/index.js','firestore.rules','src/utils/aiEngine.js'].includes(x.file))){
 const hash=createHash('sha256').update(readFileSync(new URL('../'+item.file,import.meta.url))).digest('hex');
 assert.equal(hash,item.sha256,`${item.file} differs from audited source`);
 console.log('Unchanged:',item.file);
}
const {sha256}=await import('../src/utils/sha256.js');
assert.equal(await sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
assert.equal(await sha256(''),'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
console.log('Restored SHA-256 helper: 2 standard vectors passed');
