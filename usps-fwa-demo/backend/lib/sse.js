// Tiny Server-Sent Events hub: the UI listens on /api/stream and sees every decision as it happens.
const clients = new Set();

export function addClient(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 1000\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
}

export function broadcast(obj) {
  if (!clients.size) return;
  const line = `data: ${JSON.stringify(obj)}\n\n`;
  for (const c of clients) c.write(line);
}
