const Gun = require('gun');
require('gun/sea');
const Relays = require('shogun-relays');

async function test() {
  const peers = await Relays.forceListUpdate();
  console.log('Peers:', peers);

  const gun1 = new Gun({ peers, localStorage: false, radisk: false, multicast: false });

  setTimeout(() => {
    const peerStatuses = Object.keys(gun1.opt.peers).map(k => ({
      url: k,
      hasWire: !!gun1.opt.peers[k].wire,
      wireReadyState: gun1.opt.peers[k].wire ? gun1.opt.peers[k].wire.readyState : null
    }));
    console.log('Peer statuses 5s after init:', peerStatuses);
    process.exit(0);
  }, 5000);
}

test();
