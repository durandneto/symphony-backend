const NpmPackageStats = require("./NpmPackageStats").default

process.on('message', (msg) => {
  const message = JSON.parse(msg)
  console.log(message)
  const NpmPS = new NpmPackageStats(message.moduleName, message.tarball)
  try {

    NpmPS.getStats()
    .then(stats => {
      console.log("NpmPS.compilePackage", stats)
      process.send(JSON.stringify({
        type: 'success',
        data: stats
      }))
    })
    .catch(error => {
      process.send(JSON.stringify({
        type: 'error',
        error
      }))
    })
  } catch (error) {
    process.send(JSON.stringify({
      type: 'error',
      error
    }))
  }

})