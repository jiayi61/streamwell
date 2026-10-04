// OneAquaHealth research sites (106) from the public OAH API
//   GET https://api.enora-oah.eu/api/sites/all   (retrieved 2026-10-03)
// The API refuses cross-site browser requests, so the list is bundled.
// Fields: code, name, city id, latitude, longitude, altitude (m, null if unknown).

export const CITIES = {
  CO: { id: 'CO', name: 'Coimbra', country: 'PT', lat: 40.2033, lon: -8.4103, lang: 'pt' },
  TO: { id: 'TO', name: 'Toulouse', country: 'FR', lat: 43.6047, lon: 1.4442, lang: 'fr' },
  GH: { id: 'GH', name: 'Ghent', country: 'BE', lat: 51.0543, lon: 3.7174, lang: 'nl' },
  BE: { id: 'BE', name: 'Benevento', country: 'IT', lat: 41.1291, lon: 14.7868, lang: 'it' },
  OS: { id: 'OS', name: 'Oslo', country: 'NO', lat: 59.9139, lon: 10.7522, lang: 'no' },
};

const RAW = `C1|Exploratório|CO|40.19787|-8.42865|20
C2|Estação Cbr-B|CO|40.22483|-8.44135|14
C3|Vale das Flores|CO|40.19307|-8.41945|22
C4|Eiras|CO|40.25289|-8.43659|17
C5|Mina Hospital|CO|40.2186|-8.42733|27
C6|Casa do Sal|CO|40.21942|-8.43772|16
C7|São Romão|CO|40.22243|-8.40165|53
C8|Covões|CO|40.19133|-8.46002|77
C9|Fornos|CO|40.27702|-8.4272|19
C10|Arregaça|CO|40.19776|-8.41773|23
C11|Bairro São Miguel|CO|40.22752|-8.43757|20
C12|Escola Agrária|CO|40.20386|-8.45302|42
C13|Condeixa|CO|40.11106|-8.49052|106
C14|Antanhol|CO|40.16719|-8.47817|68
C15|Copeira|CO|40.17943|-8.42117|25
C16|Rio Velho|CO|40.22461|-8.44304|15
C17|Conraria|CO|40.17422|-8.39363|27
C18|Ponte da Espertina|CO|40.25621|-8.45312|14
C19|Escravote|CO|40.24812|-8.41159|42
C20|Corujeira|CO|40.21085|-8.47667|14
T21||TO|43.59278|1.34767|162
T24||TO|43.59604|1.36671|148
G2|Zottegem1 (Zo1)|GH|50.85943|3.79794|38.71
BN1|Capodimonte|BE|41.13231|14.80039|135
BN2|Cretarossa|BE|41.12679|14.80333|146
BN3|Ponticelli|BE|41.13348|14.78614|550
BN4|Serretelle 4|BE|41.12414|14.74864|130
BN5|Serretelle 5|BE|41.10429|14.74295|182
BN6|Pezzapiano|BE|41.14775|14.78437|127
BN7|Margiacca|BE|41.14905|14.81407|135
BN8|Paduli|BE|41.15405|14.8345|204
BN9|Vallone Cornacchie|BE|41.11089|14.8325|126
BN10|Malacagna|BE|41.14607|14.76353|120
BN11|Masseria Roseto|BE|41.16124|14.75972|153
BN12|Vallone S. Vitale|BE|41.13628|14.73193|130
BN13|Vallone la Ripa|BE|41.11727|14.73683|245
BN14|Rocca - Tufara|BE|41.06014|14.70843|
BN15|Corvo Tressanti|BE|41.06921|14.70959|148
BN16|Ranno|BE|41.06923|14.70876|146
BN17|Lossauro|BE|41.13221|14.7127|284
BN18|Jenga|BE|41.15126|14.70936|100
BN19|Foeniculum|BE|41.185791|14.719005|267
BN20|Lenta|BE|41.213825|14.68999|147
G6|Zwalm2 (Zw2)|GH|50.87579|3.75151|18.9
T1|Ruisseau du Palays|TO|43.55267|1.49147|130
T3|Ruisseau de Bonneval amont|TO|43.52756|1.47439|208
G8|Zwalm4 (Zw4)|GH|50.87971|3.73771|18.29
G9|Zwalm5 (Zw5)|GH|50.87366|3.73125|20.12
G10|Zwalm6 (Zw6)|GH|50.88344|3.71431|14.02
G22|Zwalm7 (Zw7)|GH|50.88527|3.692821|12.19
G11|Zwalm8 (Zw8)|GH|50.88437|3.68791|13.11
G12|Zwalm9 (Zw9)|GH|50.88541|3.68606|11.89
G13|Merelbeke1 (Mr1)|GH|50.97958|3.72241|4.88
G14|Merelbeke2 (Mr2)|GH|50.99821|3.73925|28.04
G15|Melle1 (Ml1)|GH|50.98975|3.80615|5.79
G16|Melle2 (Ml2)|GH|50.99491|3.80568|5.79
G17|Gent1 (G1)|GH|51.02678|3.77389|24.08
G18|Gent2 (G2)|GH|51.05458|3.68126|20.12
O17|Alna – Bryn stasjon|OS|59.9078|10.8128|
G1|Oosterzele1 (O1)|GH|50.94744|3.8168|54.86
G4|Zottegem3 (Zo3)|GH|50.87507|3.80222|39.01
G21|Zottegem4 (Zo4)|GH|50.89162|3.81558|48.46
G5|Zwalm1 (Zw1)|GH|50.87539|3.74917|20.12
T2|Ruisseau de Bonneval aval|TO|43.53219|1.46332|178
G19|Gent3 (G3)|GH|51.02843|3.786|3.05
G20|Gent4 (G4)|GH|51.0939|3.71687|2.74
G3|Zottegem2 (Zo2)|GH|50.87604|3.75174|51.21
T5|Marcaissonne aval|TO|43.5678|1.50937|138
T6|Marcaissonne amont|TO|43.56755|1.51974|145
T7|Saune|TO|43.57873|1.53609|145
T8|Ruisseau du Grand Port de Mer|TO|43.58553|1.52861|157
T9|Ruisseau du Roussimort amont|TO|43.52152|1.34273|165
T15|Fossé Mère (ou Ruisseau Le Négogousses)|TO|43.5713|1.38535|157
G7|Zwalm3 (Zw3)|GH|50.86216|3.76577|23.77
O1|Gaustadbekken-Skådalen|OS|59.9561|10.7153|
O2|Hoffsbekken|OS|59.9514|10.6806|
O3|Gaustadbekken-Slemdalsveien/RH|OS|59.9475|10.7111|
O5|Hoffselva - Møllhausen|OS|59.9308|10.6769|
O4|Makrellbekken - Dronningfossen|OS|59.9308|10.6778|
O6|Ljanselva- Skullerud -|OS|59.8628|10.8458|
O7|Ljanselvas mljøpark|OS|59.8511|10.8164|
O8|Ljanselva – Nedre Ljan Nordstrand|OS|59.8433|10.7847|
O9|Gaustadbekken -Forskningsparketn|OS|59.9425|10.7181|
O10|Frognerelva - VInderen|OS|59.9414|10.7097|
O11|Mærradalsbekken - Radiumhospital|OS|59.9297|10.6594|
O12|Makrellbekken – ring3|OS|59.9356|10.6736|
O13|Mærradalsbekken – Huseby skole|OS|59.945|10.6503|
O14|Hovinbekken - Krokliveien|OS|59.9392|10.8214|
O15|Hovinbekken - Hovin|OS|59.9206|10.8006|
O16|Alna - Kværnerfossene|OS|59.9044|10.7944|
O18|Alna – v Tveita / plantasjen-|OS|59.9219|10.8369|
O19|Alna - Grorud|OS|59.9525|10.9017|
O20|Makrellbekken - Njård|OS|59.9432|10.6736|
T10|Canal de Saint Martory|TO|43.5322|1.32265|169
T12|Fossé de Larramet médian|TO|43.54003|1.34077|164
T13|Ruisseau du Roussimort aval|TO|43.5353|1.37785|155
T14|Canal agricole (depuis la Saudrune)|TO|43.53855|1.42074|145
T17|Fossé de pluvial avant rejet dans fossé de Larramet|TO|43.5786|1.35861|159
T18|Ousseau|TO|43.57882|1.35262|153
T19|Touch|TO|43.58253|1.35047|140
T20|Canal de Moulin|TO|43.5828|1.3493|150
T4|Hers|TO|43.56499|1.49464|140
T11|Fossé de Larramet amont|TO|43.52992|1.32597|172
T25|Ruisseau de l’Armurié|TO|43.64862|1.51501|137
T16|Fossé de Larramet aval|TO|43.57895|1.35929|159
T22|Ruisseau de l’Armurié|TO|43.59608|1.36657|150`;

/** @typedef {{code:string,name:string,city:string,lat:number,lon:number,alt:number|null}} Site */

/** @type {Site[]} */
export const SITES = RAW.split('\n').map((line) => {
  const [code, name, city, lat, lon, alt] = line.split('|');
  return {
    code,
    // Two Toulouse sites have no name in the OAH API; show the code instead.
    name: name || `Site ${code}`,
    city,
    lat: Number(lat),
    lon: Number(lon),
    alt: alt === '' ? null : Number(alt),
  };
});

export const SITE_BY_CODE = Object.fromEntries(SITES.map((s) => [s.code, s]));

export function sitesInCity(cityId) {
  return cityId && cityId !== 'ALL' ? SITES.filter((s) => s.city === cityId) : SITES;
}

/** Great-circle distance in metres. */
export function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Sites sorted by distance from a point. */
export function nearestSites(lat, lon, n = 5) {
  return SITES.map((s) => ({ ...s, distance: distanceM(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, n);
}
