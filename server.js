// server.js - Wuxia server, similar to shooter but tailored for side-scroller
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { pingTimeout: 60000 });

const PORT = process.env.PORT || 3000;
app.use(express.static(__dirname + '/public'));

const WORLD_W = 80000;
const WORLD_H = 20000;

const players = {};
const bullets = [];

setInterval(() => {
  const dt = 1/20;
  // bullets update & collisions
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -10000 || b.x > WORLD_W + 10000) {
      bullets.splice(i,1); continue;
    }
    for (const id in players) {
      const p = players[id];
      if (!p || p.id === b.owner) continue;
      const dx = p.x - b.x, dy = p.y - b.y;
      if (Math.hypot(dx, dy) < (b.hitRadius||16)) {
        p.hp = Math.max(0, (p.hp||100) - (b.damage||20));
        bullets.splice(i,1); break;
      }
    }
  }

  io.emit('snapshot', {
    players: Object.values(players).map(p => ({ id: p.id, x: p.x, y: p.y, dir: p.dir || 0, hp: p.hp || 100, name: p.name || 'Player' })),
    bullets: bullets.map(b => ({ id: b.id, x: b.x, y: b.y })),
    ts: Date.now()
  });
}, 50);

io.on('connection', socket => {
  players[socket.id] = {
    id: socket.id,
    x: 2000 + Math.random()*4000,
    y: 0,
    vx:0, vy:0, hp:100, name: 'P' + (Object.keys(players).length+1)
  };

  socket.on('spawn', (opts) => {
    const p = players[socket.id];
    if (!p) return;
    p.x = (opts && opts.x) || 2000 + Math.random()*4000;
    p.y = (opts && opts.y) || 0;
    p.hp = 100;
    socket.emit('spawned', { id: socket.id, x: p.x, y: p.y, hp: p.hp });
  });

  socket.on('input', (data) => {
    const p = players[socket.id]; if (!p) return;
    if (data.x !== undefined) p.x = Math.max(0, Math.min(WORLD_W, data.x));
    if (data.y !== undefined) p.y = Math.max(-WORLD_H, Math.min(WORLD_H, data.y));
    if (data.dir !== undefined) p.dir = data.dir;

    // fire used for melee or ranged (client-controlled)
    if (data.fire) {
      // small projectile for demonstration
      const b = {
        id: Math.random().toString(36).slice(2),
        owner: socket.id,
        x: p.x + (data.dir||0)*20,
        y: p.y,
        vx: (data.dir||1) * 500,
        vy: 0,
        life: 2.0,
        damage: 15,
        hitRadius: 18
      };
      bullets.push(b);
    }
  });

  socket.on('chat', (txt) => {
    const p = players[socket.id];
    io.emit('chat', { id: socket.id, text: txt, name: p ? p.name : 'Anon' });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

http.listen(PORT, () => console.log(`Wuxia server listening on ${PORT}`));