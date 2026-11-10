import WebSocket from 'ws';
const B = 'http://localhost:3000/api';
const post = async (r, t, b) => (await fetch(B + r, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b || {}) })).json();
const sofia = await post('/auth/login', null, { email: 'sofia@demo.co', password: 'Demo1234' });
const val = await post('/auth/login', null, { email: 'valentina@demo.co', password: 'Demo1234' });
const ev = { sofia: [], val: [] };
for (const [k, u] of [['sofia', sofia], ['val', val]]) {
  const w = new WebSocket('ws://localhost:3000/ws?token=' + u.token);
  w.on('message', m => ev[k].push(JSON.parse(m.toString()).tipo));
}
await new Promise(r => setTimeout(r, 500));
const t0 = Date.now();
const d = await post('/sesiones/demanda', sofia.token, { materiaId: 7, duracionMin: 60, tema: 'Recursividad en Python', pago: { metodo: 'TARJETA', numero: '4242424242424242' } });
console.log('estado', d.estado, 'expira en s', (Date.parse(d.expiraEn) - Date.now()) / 1000);
await new Promise(r => setTimeout(r, 48500));
const s = await (await fetch(B + '/sesiones/' + d.id, { headers: { Authorization: 'Bearer ' + sofia.token } })).json();
console.log('tras', (Date.now() - t0) / 1000, 's:', s.estado, 'pago:', s.pago);
console.log(ev);
process.exit(0);
