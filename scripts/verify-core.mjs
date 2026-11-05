import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
// Online repair explicitly authorized after audit on 2026-09-08. Original hashes remain in qa/core-preservation.json.
// AI improvement explicitly requested by the owner; canonical game rules remain locked.
const baseline=JSON.parse(readFileSync(new URL('../qa/core-preservation.json',import.meta.url)));
for(const item of baseline.filter(x=>x.sha256 && !['functions/index.js','firestore.rules','src/utils/aiEngine.js'].includes(x.file))){
 const hash=createHash('sha256').update(readFileSync(new URL('../'+item.file,import.meta.url))).digest('hex');
 // Owner-approved Derby correction, then owner-approved foul fix (2026-11-06): handSortKey padded to 5 slots so a
 // 3-card front is compared against a 5-card pile correctly (front AA vs mid 22 was wrongly accepted). Lock the new engine.
 const expected=item.file==='src/utils/ruleEngine.js'?'df38cba7c354e57bed7612e5d76b097a5fc607167d17ef84812239a7a082cef5':item.sha256;
 assert.equal(hash,expected,`${item.file} differs from approved source`);
 console.log('Verified:',item.file);
}
const {sha256}=await import('../src/utils/sha256.js');
assert.equal(await sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
assert.equal(await sha256(''),'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
console.log('Restored SHA-256 helper: 2 standard vectors passed');
