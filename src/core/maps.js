export const MAP_CATEGORIES={food:{label:'Restaurants & cafés',color:'#c05f32'},transit:{label:'Train & transit stops',color:'#4268b1'},nature:{label:'Parks & trails',color:'#338459'}};
export function googleMapsURL(school,category='campus') {
 const type={food:'restaurants',transit:'train stations public transport',nature:'parks nature trails'}[category];
 const query=`${type?`${type} near `:''}${(school.institutionName||school.name)}, ${school.city}, ${school.country}`;
 return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
export function overpassQuery(lat,lng) {
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new Error('Invalid map coordinates.');
 const around=`around:4000,${lat},${lng}`;
 return `[out:json][timeout:25];nwr(${around})[amenity~"^(restaurant|cafe|fast_food)$"]->.food; (nwr(${around})[railway~"^(station|halt|tram_stop)$"];nwr(${around})[public_transport=station];)->.transit; (nwr(${around})[leisure~"^(park|nature_reserve)$"];nwr(${around})[highway=trailhead];way(${around})[highway=path][sac_scale];)->.nature; .food out center 80; .transit out center 80; .nature out center 80;`;
}
export function mapCategory(tags={}) {
 if(['restaurant','cafe','fast_food'].includes(tags.amenity))return 'food';
 if(['station','halt','tram_stop'].includes(tags.railway)||tags.public_transport==='station')return 'transit';
 if(['park','nature_reserve'].includes(tags.leisure)||tags.highway==='trailhead'||(tags.highway==='path'&&tags.sac_scale))return 'nature';
 return null;
}
export function normalizePlaces(data) {
 const seen=new Set();
 return (data.elements||[]).flatMap(element=>{
  const category=mapCategory(element.tags),lat=element.lat??element.center?.lat,lng=element.lon??element.center?.lon,key=`${element.type}/${element.id}`;
  if(!category||!Number.isFinite(lat)||!Number.isFinite(lng)||seen.has(key))return [];
  seen.add(key);return [{id:key,category,lat,lng,name:element.tags?.name||element.tags?.['name:en']||'Unnamed map feature',url:`https://www.openstreetmap.org/${key}`}];
 });
}
