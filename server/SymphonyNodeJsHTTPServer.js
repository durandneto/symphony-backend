const HTTP_PORT = 8012
const http = require('http')
const express = require('express')
const SymphonyNpmHandleRequest = require('./SymphonyNpmHandleRequest').default
const cors = require('cors')
const npmHandleRequest = new SymphonyNpmHandleRequest()

const app = express()

class SymphonyNodeJsHTTPServer {

  constructor(config){
    this.config = config



    app.use(cors())

    app.get('/search/:moduleName', (req, res) => {
      const startTime =  new Date().getTime()
      let endTime = 0
      npmHandleRequest.setCachePort(this.config.TCP_CACHE_PORT)
      npmHandleRequest.getModule(req.params.moduleName.toLowerCase())
        .then(response => {
          endTime = new Date().getTime() - startTime
          console.log("send reponse to client :: time",endTime)
          res.json({
            success: true,
            response: Object.assign({requestTime: `${endTime}ms`}, response)
          })
        })
        .catch(error => {
          endTime = new Date().getTime() - startTime
          console.log("SymphonyNodeJsHTTPServer error", error, endTime)
          res.json({
            success: false,
            error: Object.assign({requestTime: `${endTime}ms`}, error.error)
          })
        })
    })
  }



  start = () => {
    return new Promise((resolve, reject) => {
      try {
        app.listen(this.config && this.config.HTTP_PORT || HTTP_PORT, this.config && this.config.ADDRESS || "0.0.0.0", () => {
          console.log(`Symphony NodeJS HTTP Server is running at HTTP ADDRESS ::${this.config && this.config.ADDRESS ? this.config.ADDRESS : "127.0.0.1" }:${this.config && this.config.HTTP_PORT ? this.config.HTTP_PORT : HTTP_PORT }::`)
          resolve(this.config)
        })
      } catch (error) {
        reject(error)
      }
    })
  }
}

exports.HTTPServer = SymphonyNodeJsHTTPServer