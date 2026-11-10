/** Intern repeated evidence and endpoint objects for a smaller static download. */
export function packNetwork(network) {
 const {extraEdges=[],...base}=network;
 const tables={people:[],papers:[],sources:[],notes:[]};
 const indexes=Object.fromEntries(Object.keys(tables).map(key=>[key,new Map()]));
 function ref(table,value){
  const key=JSON.stringify(value??null),index=indexes[table];
  if(!index.has(key)){index.set(key,tables[table].length);tables[table].push(value??null);}
  return index.get(key);
 }
 const edges=extraEdges.map(({personA,personB,paper,sources,notes,...rest})=>[
  ref('people',personA),ref('people',personB),ref('papers',paper),ref('sources',sources),ref('notes',notes),rest,
 ]);
 return {base,tables,edges};
}

export function unpackNetwork({base,tables,edges}) {
 return {...base,extraEdges:edges.map(([a,b,p,s,n,rest])=>({
  ...rest,personA:tables.people[a],personB:tables.people[b],paper:tables.papers[p],sources:tables.sources[s]??undefined,notes:tables.notes[n]??undefined,
 }))};
}
