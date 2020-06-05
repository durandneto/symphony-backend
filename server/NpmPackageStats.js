const fs = require("fs")
const path = require("path")
const decompress = require('decompress')
const webpack = require("webpack")
const CompressionPlugin = require('compression-webpack-plugin')
const { exec } = require("child_process")

class NpmPackageStats {

  constructor(packageName, tarball) {

    this.id = this.createUUID()
    this.stats = {}
    this.packageName = packageName
    this.tarball = tarball
    this.packageJSON = `${this.systemFolder}/node_modules/${packageName}/package.json`
    this.localFolder = path.join(__dirname, "tmp" , this.id )
    this.systemFolder = `${this.localFolder}/system`
  }

  s4 = () => {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  createUUID = () => {
    return this.s4() + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4() + this.s4() + this.s4();
  }

  getStats = () => {
    return new Promise((resolve, reject) => {
      try {
        this.setup()
        // install module
        this.installModule()
        .then(() => {
          this.compilePackage()
          .then(stats => {
            resolve(stats)
          })
          .catch(reject)
        })
        .catch(reject)
      } catch (error) {
        reject(error)
      }
    })
  }
  setup = () => {
    if (!fs.existsSync(path.join(__dirname, "tmp" ))) {
      fs.mkdirSync(path.join(__dirname, "tmp" ))
    }
    fs.mkdirSync(this.localFolder)
    fs.mkdirSync(this.systemFolder)
    // create package json
    this.createPackageJSON()
    // create index.js
    this.createIndexJS()

  }

  createPackageJSON = () => {

    const template = `{
      "author": "Durand Neto",
      "dependencies": {}
    }`

    console.log("creating package json for [", this.packageName, "] on", `${this.systemFolder}/package.json`)

    fs.writeFileSync( `${this.systemFolder}/package.json` ,template)
  }

  createIndexJS = () => {
    const IndexTemplate = `const m=require('${this.packageName}')\nconsole.log(m)`

    console.log("creating index.js for [", this.packageName, "] on", `${this.systemFolder}/index.js`)

    fs.writeFileSync( `${this.systemFolder}/index.js` ,IndexTemplate)

  }

  installModule = () => {
    return new Promise((resolve, reject) => {
      const command = `cd ${this.systemFolder} && npm install ${this.tarball}`
      console.log('command',command)
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log(`error on install module from fork process: ${error.message}`)
          reject(error)
        }
        console.log(" installModule [LOG]", stdout)
        resolve()
      })
    })
  }

  unlink = () =>{
    const command = `rm -rf ${this.localFolder}`
    console.log('command', command)
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`)
      }

      console.log("removed fold", this.localFolder)
    })
  }

  compilePackage = () => {

    return new Promise((resolve, reject) => {
      try {

        const compiler = webpack({
          entry: `${this.systemFolder}/index.js`,
          mode: 'production',
          plugins: [new CompressionPlugin({
            algorithm: 'gzip',
          })],
          output: {
            filename: 'bundle.js',
            path: `${this.systemFolder}/dist`,
          }
        })

        compiler.run((err, stats) => {
          if (err || stats.compilation.errors.length > 0 ) {
            console.log("compiler error", err, stats.compilation.errors)
            if (stats.compilation.errors.length > 0 ) {
              reject("error on compile")
            } else {
              reject(err)
            }
          } else {

            const bundleAnalyzed = {
              gzip: stats.compilation.assets["bundle.js.gz"]._value.length,
              minified: stats.compilation.assets["bundle.js"]._value.length,
            }
            this.unlink()
            resolve(bundleAnalyzed)
          }
        })
      } catch (error) {
        reject(error)
      }
    })
  }
}

exports.default = NpmPackageStats