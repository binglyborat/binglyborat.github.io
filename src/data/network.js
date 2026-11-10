import {SCHOOLS} from './schools.js';
import {buildNetwork} from '../core/network.js';
import {createLazyNetwork} from '../core/lazy-network.js';
import {groupNetwork} from '../core/grouped-network.js';

// Maintainer tools and tests can inspect the complete graph. Browsers download
// the directory first and fetch publication evidence only for selected people.
const index=typeof window==='undefined'?null:(await import('./network-index.js')).NETWORK_INDEX;
export const RAW_NETWORK=index
 ?createLazyNetwork(index,{baseURL:new URL('./network-shards/',import.meta.url)})
 :buildNetwork(SCHOOLS,(await import('./research.js')).CONNECTIONS);
export const GROUPED_NETWORK=groupNetwork(RAW_NETWORK,index?.grouping);
export let NETWORK=GROUPED_NETWORK;

export function networkForState(state) {
 return state?.ui?.combinePeopleRecords===false?RAW_NETWORK:GROUPED_NETWORK;
}
export function useNetworkForState(state) {
 NETWORK=networkForState(state);
 return NETWORK;
}
