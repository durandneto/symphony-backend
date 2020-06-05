const { SymphonyNodeJsHTTPServer, SymphonyCacheTCPServer } = require('./server')

const SymphonyHTTPServer = new SymphonyNodeJsHTTPServer({
  HTTP_PORT: 2706,
  TCP_CACHE_PORT: 2204
})

const CacheServer = new SymphonyCacheTCPServer({
  ADDRESS: '0.0.0.0',
  TCP_PORT: 2204
})

CacheServer
  .start()
  .then( response => {
    console.log('SymphonyCache TCP Server Server is running!',
    JSON.stringify(response))

    SymphonyHTTPServer
      .start()
      .then( response => {
        console.log('Symphony NodeJS HTTP Server is running!',
        JSON.stringify(response))
      })
      .catch(error => {
        console.log('Symphony NodeJS HTTP Server ERROR!', error)
      })
  })
  .catch(error => {
    console.log('SymphonyCacheTCP Server Server  ERROR!', error)
  })

