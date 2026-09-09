import {useCallback,useLayoutEffect,useRef} from 'react';
// Stable subscription callback that always sees the latest rendered state.
export function useEvent(callback) {
  const latest=useRef(callback);
  useLayoutEffect(()=>{latest.current=callback;});
  return useCallback((...args)=>latest.current(...args),[]);
}
