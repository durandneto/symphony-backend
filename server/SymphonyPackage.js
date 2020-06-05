const { fork } = require('child_process')
const path = require("path")
const SymphonyCacheDB = require('./cache/SymphonyCacheDB').default
class SymphonyPackage {

  constructor(packageName) {
    console.log("new package", packageName)
    if ( packageName.indexOf("@") > -1) {
      this.name = packageName.split("@")[0]
      this.requestedVersion = packageName.split("@")[1]
      console.log("this.requestedVersion", this.requestedVersion)
    } else {
      this.name = packageName
    }

    this.lastVersionsCount = 5
    this.description = null
    this.requestedVersionTime = null
    this.requestedTarball = null
    this.versionTime = null
    this.isProcessed = false
    this.latestVersion = null
    this.latestVersionTime = null
    this.latestTarball = null
    this.lastVersions = []
    this.versions = new SymphonyCacheDB()
  }

  setName = name => {
    if ( name.indexOf("@") > -1) {
      this.name = name.split("@")[0]
      this.requestedVersion = name.split("@")[1]
    } else {
      this.name = name
    }
  }

  setVersion = version => {
    this.requestedVersion = version
  }

  setTarball = requestedTarball => {
    debugger
    this.requestedTarball = requestedTarball
  }

  loadResponse = response => {
    return new Promise((resolve, reject) => {
      this.response = response.data
      this.setHistoryVersions(this.response.versions, this.response.time)
      this.setDescription(this.response.description)

      this.latestVersion = this.response["dist-tags"].latest
      this.latestVersionTime = this.response.time[this.response["dist-tags"].latest]
      this.latestTarball = this.response.versions[this.response["dist-tags"].latest].dist.tarball

      if (this.requestedVersion ) {
        if (!this.response.versions[this.requestedVersion].dist) {
          reject()
        } else {
          this.requestedVersionTime = this.response.time[this.requestedVersion]
          this.requestedTarball = this.response.versions[this.requestedVersion].dist.tarball
        }
      }

      resolve()
    })

  }

  setDescription = description => {
    this.description = description
  }

  getName = () => {
   return this.name
  }

  getVersion = () => {
    if (this.requestedVersion) {
      return this.requestedVersion
    } else {
      return this.latestVersion
    }
  }

  getLatestVersion = () => {
    return this.latestVersion
  }
  getLatestTarbal = () => {
    return this.latestTarball
  }

  getVersionTime = () => {
    if (this.requestedVersionTime) {
      return this.requestedVersionTime
    } else {
      return this.latestVersionTime
    }
  }

  updateVersion = record => {
    return new Promise((resolve, reject) => {
      this.versions.update(record.time, record)
        .then(resolve)
        .catch(reject)
    })
  }

  getNameAndVersion = () => {
    console.log("getNameAndVersionrequest version", this.requestedVersion)
    if (this.requestedVersion) {
      return `${this.name}@${this.requestedVersion}`
    } else {
      return `${this.name}@${this.latestVersion}`
    }
  }

  getTarball = () => {
    if (this.requestedTarball) {
      return this.requestedTarball
    } else {
      return this.latestTarball
    }
  }

  getVersions = () => {
    console.log("getVersions")
    return this.versions
  }

  setHistoryVersions = (versions, time) => {
    for (const version in versions) {
      // skipping experimental versions
      if (version.indexOf("0.0.0-") === -1 ) {
        if (time[version]) {
          this.versions.insertSync(time[version], {
            tarball: versions[version].dist.tarball,
            version,
            isProcessed: false,
            minified: 0,
            gzip: 0,
            time: time[version]
          })
        }
      }
    }
  }

  getLastVersions = () => {
    this.lastVersions = this.versions.getLastSync(this.lastVersionsCount)
  }

  setIsProcessed = () => {
    this.isProcessed = true
  }

  installLatest = () => {
    console.log("installLatest", {
      moduleName: this.getName() ,
      tarball: this.getLatestTarbal()
    })
    const installPackageProcess = fork(path.join(__dirname, 'installPackage.js'))

    installPackageProcess.send(JSON.stringify({
      moduleName: this.getName() ,
      tarball: this.getLatestTarbal()
    }))

    return new Promise((resolve, reject) => {
      installPackageProcess.on('message', forkMessage => {
        const message = JSON.parse(forkMessage)
        console.log("fork process message", message)
        if (message.type === "error") {
          reject(message.error)
        } else {
          console.log("save second version on cache")
          resolve(message.data)
        }
      })
   })
  }

  install = () => {
    const installPackageProcess = fork(path.join(__dirname, 'installPackage.js'))
    console.log("install ",{
      moduleName: this.getName() ,
      tarball: this.getTarball()
    })

    installPackageProcess.send(JSON.stringify({
      moduleName: this.getName() ,
      tarball: this.getTarball()
    }))
    return new Promise((resolve, reject) => {
      installPackageProcess.on('message', forkMessage => {
        const message = JSON.parse(forkMessage)
        console.log("fork process message", message)
        if (message.type === "error") {
          reject(message.error)
        } else {
          console.log("save second version on cache")
          resolve(message.data)
        }
      })
   })
  }


  toObject = () => {
    return {
      name: this.name,
      latestVersion: this.latestVersion,
      latestTarball: this.latestTarball,
      versionTime: this.response.time[this.response["dist-tags"].latest],
      historyVersions: this.versions.getLastSync(this.lastVersionsCount),
      isProcessed: this.isProcessed,
    }
  }

  toString() {
    return JSON.stringify(this)
  }

}

exports.default = SymphonyPackage