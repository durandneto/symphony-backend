const net = require('net')
const path = require("path")
const fs = require("fs")
const { fork, exec } = require('child_process')
const axios = require("axios").default
const SymphonyCacheDB = require('./SymphonyCacheDB').default
const SymphonyPackage = require('./../SymphonyPackage').default
class SymphonyCacheTCPServer {

  constructor(config) {
    this.config = config
    this.packageVersionCache = new SymphonyCacheDB()
    this.packageConfigCache = new SymphonyCacheDB()

    this.tcpServer = net.createServer(socket => {
      console.log('New socket connected')

      socket.on('data', message => {
        this.checkMessage(socket, message)
      })

      socket.on('close', () => {
        console.log('Socket closed')
      })

    })
  }

  findBKPFileSync = BKPFilePath => {
    if ( fs.existsSync(BKPFilePath) ) {
      console.log("found file ", BKPFilePath)
      return fs.readFileSync(BKPFilePath)
    } else {
      return null
    }
  }

  installPackage = (packageName, tarball, nameAndVersion) => {
    const installVersionProcess = fork(path.join(__dirname,'../' ,'installPackage.js'))

    installVersionProcess.send(JSON.stringify({
      moduleName: packageName ,
      tarball
    }))

    return new Promise((resolve, reject) => {
      installVersionProcess.on('message', forkMessage => {
        const message = JSON.parse(forkMessage)
        console.log('kill  fork ', message)

        if (message.type === "error") {
          console.log("error on install latest version [installPackage]", message)
          this.packageConfigCache
            .insert(nameAndVersion ,{ error: true, errorMessage: message.error })
            .then(specificVersion => {
              console.log('returning from error', message.error, specificVersion.root.getData())
              this.saveIndexFileSync(nameAndVersion, {error: true, errorMessage: message.error})
                reject(Object.assign({fromCache: false}, {error: true, errorMessage: message.error}))
            })
            .catch(error => {
              console.log("error ", error)
              reject({
                error: true,
                errorMessage: error
              })
            })
        } else {
          console.log("save second version on cache")
          this.packageConfigCache
            .insert(nameAndVersion, message.data)
            .then(specificVersion => {
              this.saveIndexFileSync(nameAndVersion, specificVersion.root.getData())
              resolve(Object.assign({
                fromCache: false,
                history: 7
              }, specificVersion.root.getData()))
            })
            .catch(error => {
              console.log("error ", error)
              reject({
                error: true,
                errorMessage: error
              })
            })
        }

      })
   })
  }

  buildHistory = packageName => {
    const cacheFileName = path.join(__dirname, 'processed',
    `${packageName}.symphony`)
    console.log(`building history in background for ${packageName}` )

    const execCommand = `node ${path.join(__dirname, '../',"installHistoryModule.js")} ${cacheFileName}`
    console.log("exec command", execCommand)
    exec(execCommand);
  }

  saveIndexFileSync = (packageName, data) => {
    const cacheFileName = path.join(__dirname, 'processed',
    `${packageName}.symphony`)

    console.log(`save file ${packageName} with data`, data, "at", cacheFileName)

    fs.writeFileSync(cacheFileName, JSON.stringify(data))
  }

  checkLatestPackage = packageName => {
    return new Promise((resolve, reject) => {
      try {
        const name = packageName.split("@")[0]
        const version = packageName.split("@")[1]

        console.log("check if there is any version", name, version)
        const pathname = path.join(__dirname,'processed', `${name}.symphony`)
        console.log("check if there is any version", pathname)
        if ( fs.existsSync(pathname) ) {
          console.log("return file from last package installment")
          const file = fs.readFileSync(pathname)
          const parsedFile = JSON.parse(file)
          //check if the is any error
          if ( parsedFile.data.error ) {
            console.log("parsedFile.data.error", parsedFile.data.error)
            // if error return to client
            resolve({error: parsedFile.data})
          } else {
            let requestedtVersion = parsedFile.data.historyVersions.filter( history => history.data.version === parsedFile.data.latestVersion )
            if (version) {
              requestedtVersion = parsedFile.data.historyVersions.filter( history => history.data.version === version )
            }
            if (requestedtVersion[0]) {
              resolve({file: parsedFile, package: requestedtVersion[0]})
            } else {
              reject({
                errorMessage: "version not found into last 5 versions",
                error: true,
                status: 404,
                fromCache: true
              })
            }
          }
        } else {
          console.log("file not found")
          resolve(false)
        }
      } catch (error) {
        reject({
          error: true,
          errorMessage: error
        })
      }

    })

  }
  find = moduleName => {
    return new Promise((resolve, reject) => {
      console.log("find for module full name", moduleName)
      let packageName = moduleName
      let packageVersion = null
      let returnVersion = false

      if ( packageName.indexOf("@") > -1) {
        packageName = moduleName.split("@")[0]
        packageVersion = moduleName.split("@")[1]
        returnVersion = true
      }
      debugger

      console.log("find for module", packageName, packageVersion)

      try {

        console.log("--------- start ------------")
        console.log(" ")
        this.packageConfigCache.printIndex()
        console.log(" ")
        console.log("---------- end --------------")

        this.packageConfigCache
        .find(moduleName)
        .then(module => {
          if ( module ) {
            if (returnVersion || module.root.getData().data.error) {
              console.log('returning from cache', module.root.getData())
              if (module.root.getData().data.error) {
                reject(Object.assign({fromCache: true}, module.root.getData().data))
              } else {
                // get history from memory cache
                this.packageConfigCache
                  .find(moduleName.split("@")[0])
                  .then(mainCache => {
                    console.log("get history from memory cache", mainCache.root.getData().data.historyVersions)
                    resolve(Object.assign({
                      fromCache: true,
                      history:  mainCache.root.getData().data.historyVersions
                      }, module.root.getData()))
                  })
              }
            } else {
              console.log(`recursive search for ${packageName}@${module.root.getData().data.latestVersion}`)
              this.find(`${packageName}@${module.root.getData().data.latestVersion}`)
                .then(resolve)
                .then(reject)
            }
          } else {

              const sPackage = new SymphonyPackage(moduleName)
              this.checkLatestPackage(moduleName)
                .then(response => {
                  console.log("checkLatestPackage", response)
                  if ( response.package ) {
                      console.log("don't need to request on npm registry", response.package)
                      if (response.package.data.isProcessed) {
                        console.log("return to client from here")
                        sPackage.setVersion(response.package.data.version)
                        if ( response.package.index !== sPackage.getNameAndVersion() ) {
                          // update the index
                          response.package.index = sPackage.getNameAndVersion()
                          // update file with the new cache
                          this.saveIndexFileSync(sPackage.getName(), response.file)
                          // insert main file on cache
                          this.packageConfigCache
                          .insert(sPackage.getName(), response.file.data)
                          .then(memoryCacheVersion => {
                            // insert version on cache
                            this.packageConfigCache
                            .insert(sPackage.getNameAndVersion(), response.package.data)
                            .then(memoryCacheVersion => {
                              // return package version to client
                              console.log("return package version to client")
                              resolve(Object.assign({
                                fromCache: true,
                                history: 4
                              }, memoryCacheVersion.root.getData()))
                            })
                            .catch(error => {
                              console.log(error)
                              reject({
                            error: true,
                            errorMessage: error
                          })
                            })

                          })
                          .catch(error => {
                            console.log(error)
                            reject({
                            error: true,
                            errorMessage: error
                          })
                          })
                        } else {
                          // insert main file on cache
                          this.packageConfigCache
                          .insert(sPackage.getName(), response.file.data)
                          .then(memoryCacheVersion => {
                            // insert version on cache
                            this.packageConfigCache
                            .insert(sPackage.getNameAndVersion(), response.package.data)
                            .then(clientVersionVersion => {
                              // return package version to client
                              console.log("return package version to client")
                              resolve(Object.assign({
                                fromCache: true,
                                history: memoryCacheVersion.root.getData().data.historyVersions
                              }, clientVersionVersion.root.getData()))
                            })
                            .catch(error => {
                              console.log(error)
                              reject({
                            error: true,
                            errorMessage: error
                          })
                            })

                          })
                          .catch(error => {
                            console.log(error)
                            reject({
                            error: true,
                            errorMessage: error
                          })
                          })

                        }

                      } else {
                        console.log("install this version ", response.package)

                        sPackage.setTarball(response.package.data.tarball)
                        sPackage.install()
                          .then( message => {
                            console.log("installed", message)
                            // creating new record
                            const newRecord = {
                              isProcessed: true,
                              gzip: message.gzip,
                              minified: message.minified,
                              ...response.package.data
                            }
                            // overhide current data
                            response.package.data = newRecord
                            response.package.index = sPackage.getNameAndVersion()

                            this.packageConfigCache
                              .insert(sPackage.getNameAndVersion(), newRecord)
                                .then(installedVersion => {
                                  this.saveIndexFileSync(sPackage.getNameAndVersion(), installedVersion.root.getData())
                                  // update main cache
                                  this.packageConfigCache
                                    .inserOrUpdate(sPackage.getName(), response.file)
                                    .then(mainVersion => {
                                      console.log("mainVersion.root.getData()", mainVersion.root.getData())
                                      // update main file
                                      this.saveIndexFileSync(sPackage.getName(), mainVersion.root.getData().data)
                                      // return package version to client
                                      console.log("return package version to client")
                                      resolve(Object.assign({
                                        fromCache: false,
                                        history: mainVersion.root.getData().data.historyVersions
                                      }, installedVersion.root.getData()))
                                    })
                                    .catch(error => {
                                      console.log(error)
                                      reject({
                                        error: true,
                                        errorMessage: error
                                      })
                                    })

                                })
                                .catch(error => {
                                  console.log(error)
                                  reject({
                                    error: true,
                                    errorMessage: error
                                  })
                                })

                          })
                          .catch(error => {
                            console.log("install error", {
                              error: true,
                              errorMessage: error
                            })
                            reject({
                              error: true,
                              errorMessage: error
                            })
                          })

                      }


                  } else if (response.error) {
                    // save error on memory cache
                    this.packageConfigCache
                        .insert(sPackage.getName(), response.error)
                        .then(errorResponse => {
                          console.log('saving error on cache from file', errorResponse, errorResponse.root.getData())
                          reject(Object.assign({fromCache: true}, errorResponse.root.getData().data))
                        })
                        .catch(error => {
                          console.log("error ", error)
                          reject({
                            error: true,
                            errorMessage: error
                          })
                        })
                  }
                  else {
                    console.log("searching on npm", sPackage.getName(), "version", sPackage.getVersion())
                    console.log(`https://registry.npmjs.org/${sPackage.getName()}`)
                    axios.get(`https://registry.npmjs.org/${sPackage.getName()}`)
                      .then(response => {
                        try {
                          sPackage.loadResponse(response)
                            .then(() => {
                              console.log("load data from request response")
                              const OBJPackage = sPackage.toObject()
                              console.log("data to save", OBJPackage)
                              sPackage.install()
                                .then(message => {

                                  //saving Main file
                                  const newRecord = {
                                    isProcessed: true,
                                    gzip: message.gzip,
                                    minified: message.minified,
                                    version: sPackage.getVersion(),
                                    time: sPackage.getVersionTime(),
                                    tarball: sPackage.getTarball()
                                  }

                                  sPackage.updateVersion(newRecord)
                                    .then(() => {
                                    //saving Main cache
                                      this.packageConfigCache
                                        .insert(sPackage.getName(), OBJPackage)
                                          .then(mainCache => {
                                            //caching data on disk
                                            this.saveIndexFileSync(sPackage.getName(), mainCache.root.getData())
                                            // build last 5 version of the package in background
                                            this.buildHistory(sPackage.getName())
                                            //saving new version
                                            this.packageConfigCache
                                              .insert(sPackage.getNameAndVersion(), newRecord)
                                                .then(versionCache => {
                                                  this.saveIndexFileSync(sPackage.getNameAndVersion(), versionCache.root.getData())
                                                  console.log("resolve from here", OBJPackage.historyVersions)
                                                    resolve(Object.assign({
                                                      fromCache: false,
                                                      history: OBJPackage.historyVersions
                                                    },
                                                    versionCache.root.getData()
                                                  ))
                                                })
                                                .catch( error => {
                                                  console.log("error", error)
                                                  reject({
                                                    error: true,
                                                    errorMessage: error
                                                  })
                                                })
                                          })
                                          .catch( error => {
                                            console.log("error on insert main cache", error)
                                            reject({
                                              error: true,
                                              errorMessage: error
                                            })
                                          })
                                    })
                                    .catch(error => {
                                      console.log("error on update latest version on sPackage", error)
                                      reject({
                                        error: true,
                                        errorMessage: error
                                      })
                                    })
                                })
                                .catch(error => {
                                  console.log("error on install latest version", error)
                                  const errorRecord = {
                                    error: true,
                                    errorMessage: error
                                  }

                                  this.packageConfigCache
                                    .insert(sPackage.getName(), errorRecord)
                                      .then(versionWithError => {
                                        this.saveIndexFileSync(sPackage.getName(), versionWithError.root.getData())
                                        reject(Object.assign({fromCache: false}, versionWithError.root.getData().data))
                                      })
                                      .catch( error => {
                                        console.log("error", error)
                                        reject({
                                          error: true,
                                          errorMessage: error
                                        })
                                      })
                                })
                            })
                            .catch(error => {
                              console.log("error on load data from response", error)
                              reject({
                                error: true,
                                errorMessage: error
                              })
                            })
                        } catch (error) {
                         console.log("error inside parse", error)
                          reject({
                            error: true,
                            errorMessage: error
                          })
                        }
                      })
                      .catch(error => {
                        const sPackage = new SymphonyPackage(moduleName)

                        console.log("error on search module", sPackage.getName(), {
                          status: error.response.status,
                          statusText: error.response.statusText
                        })
                        //saving error on cache
                        /**
                         * I'm saving the erros in the same object
                         * but we can create another object to save the errors
                         * or never save the errors.
                         * We also can remove errors from the cache after a time
                        */
                        this.packageConfigCache
                          .insert(sPackage.getName(), {
                            error: true,
                            status: error.response.status,
                            errorMessage: error.response.statusText
                          })
                          .then(module => {
                            console.log('saving error on cache', module, module.root.getData())
                            this.saveIndexFileSync(sPackage.getName(), module.root.getData())
                            reject(Object.assign({fromCache: false}, module.root.getData().data))
                          })
                          .catch(error => {
                            console.log("error ", error)
                            reject({
                            error: true,
                            errorMessage: error
                          })
                          })
                      })
                  }
                })
                .catch(error => {
                  console.log("error ", error)
                  reject(error)
                })

            }
          // }
        })
        .catch(error => {
          console.log(error)
          reject(error)
        })
      } catch( error) {
        console.log("error trycatch ", error)
        reject({
                            error: true,
                            errorMessage: error
                          })
      }
    })
  }

  checkMessage = (socket, clientMessage) => {
    const message = JSON.parse(clientMessage)
    console.log(message)
    switch ( true ) {
      case message.type === 'update-memory-cache':
        console.log("update memory cache")
        console.log(message.data.index)
        this.packageConfigCache
          .inserOrUpdate(message.data.index, message.data.data)
            .then(data => {
              console.log("updated index ", data.root.getData())
            })
            .catch()
        socket.write(JSON.stringify({
          type: 'exit',
        }))

        break
      case message.type === 'get-module-stats':

        // simple test to avoid call module with spacces in the name
        if ( message.data.moduleName.indexOf(" ") === -1 ) {
          console.log('receive message from client from get-module-stats')
          this.find(message.data.moduleName)
          .then(response => {
            console.log(' get-module-stats return message to  client  get-module-stats')
            socket.write(JSON.stringify({
              type: 'get-module-stats',
              data: response
            }))
          })
          .catch( error => {
            debugger
            console.log("----------------")
            console.log("----------------")
            console.log("----------------")
            console.log("catch", error)
            console.log("----------------")
            console.log("----------------")
            console.log("----------------")
            console.log("----------------")
            socket.write(JSON.stringify({
              type: 'get-module-stats-error',
              error: {
                error
              }
            }))
          })
        } else {
          socket.write(JSON.stringify({
            type: 'get-module-stats-error',
            error: {
              error: {
                error: true,
                fromCache: true,
                errorMessage: "The package name can not contain spaces or to be null",
                status: 404
              }
            }
          }))
        }
        break
      default:
        socket.write(JSON.stringify({type: 'uknow-message'}))
    }
  }

  start = () => {
    return new Promise((resolve, reject) => {
      try {

        this.tcpServer.listen({
          host: this.config.ADDRESS || "0.0.0.0",
          port: this.config.TCP_PORT || 2204,
        }, () => {
          console.log('opened server on', this.tcpServer.address())
          resolve(this.config)
        })

      } catch (error) {
        reject({
          error: true,
          errorMessage: error
        })
      }
    })
  }
}

  exports.TCPServer = SymphonyCacheTCPServer
