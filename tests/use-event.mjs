import assert from 'node:assert/strict';
import React, {act, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {useEvent} from '../src/hooks/useEvent.js';
const dom = new JSDOM('<div id="root"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let callback, subscriptions = 0, cleanups = 0;
function Consumer({value}) {
  const handler = useEvent(() => value);
  useEffect(() => { subscriptions++; callback = handler; return () => { cleanups++; }; }, [handler]);
  return React.createElement('span', null, value);
}
const root = createRoot(document.getElementById('root'));
await act(async () => root.render(React.createElement(Consumer, {value: 'sound on'})));
const first = callback;
assert.equal(callback(), 'sound on');
await act(async () => root.render(React.createElement(Consumer, {value: 'sound off'})));
assert.equal(callback, first);
assert.equal(callback(), 'sound off');
assert.equal(subscriptions, 1);
await act(async () => root.unmount());
assert.equal(cleanups, 1);
dom.window.close();
console.log('PASS subscription callback sees latest UI state without resubscribing; unmount cleans up');
