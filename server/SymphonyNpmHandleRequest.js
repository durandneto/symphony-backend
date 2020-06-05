const net = require('net')

class SymphonyNpmHandleRequest {

  constructor() {}

  getModule(moduleName) {
    return new Promise((resolve, reject) => {
      try {
        const client = new net.Socket()

        client.connect(2204, '127.0.0.1', () => {
          console.log('Connected');
          client.write(JSON.stringify({
            type: 'get-module-stats',
            data: {
              moduleName
            }
          }));
        });

        client.on('data', data => {
          console.log('SymphonyNpmHandleRequest Received:  data from server' );
          const message = JSON.parse(data)
          if (message.type.indexOf("error") === -1) {
            console.log("success", message.data)
            resolve(message.data)
          } else {
            console.log("error", message)
            reject(message.error, message)
          }
          client.destroy()
        });

        client.on('close', () => {
          console.log('Connection closed');
        })
      } catch (error) {
        console.log('rejected', error);
        reject(error)
      }
    })
  }
}

exports.default = SymphonyNpmHandleRequest