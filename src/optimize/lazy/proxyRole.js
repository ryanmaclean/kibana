let { fromNode } = require('bluebird');
let { get, once } = require('lodash');

module.exports = (kbnServer, server, config) => {

  server.route({
    path: '/bundles/{path*}',
    method: 'GET',
    handler: {
      proxy: {
        host: config.get('optimize.lazyHost'),
        port: config.get('optimize.lazyPort'),
        passThrough: true,
        xforward: true
      }
    }
  });

  return fromNode(cb => {
    let timeout = setTimeout(() => {
      cb(new Error('Server timedout waiting for the optimizer to become ready'));
    }, config.get('optimize.lazyProxyTimeout'));

    let waiting = once(() => {
      server.log(['info', 'optimize'], 'Waiting for optimizer completion');
    });

    if (!process.connected) return;

    process.send(['WORKER_BROADCAST', { optimizeReady: '?' }]);
    process.on('message', (msg) => {
      switch (get(msg, 'optimizeReady')) {
        case true:
          clearTimeout(timeout);
          cb();
          break;
        case false:
          waiting();
          break;
      }
    });
  });

};
