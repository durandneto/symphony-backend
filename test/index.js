const { SymphonyNodeJsHTTPServer, SymphonyCacheTCPServer } = require('./../server')

let chai = require('chai')
let chaiHttp = require('chai-http')
let server = require('../server')
let should = chai.should()
const expect = chai.expect

const HTTP_PORT = 2777
const TCP_PORT = 2800

const SymphonyHTTPServer = new SymphonyNodeJsHTTPServer({
  HTTP_PORT: HTTP_PORT,
  TCP_CACHE_PORT: TCP_PORT
})

const CacheServer = new SymphonyCacheTCPServer({
  ADDRESS: '0.0.0.0',
  TCP_PORT: TCP_PORT
})

chai.use(chaiHttp)

describe('hooks', () => {
    before( done =>{
      // runs once before the first test in this block
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
                done()
            })
            .catch(error => {
                console.log('Symphony NodeJS HTTP Server ERROR!', error)
            })
        })
        .catch(error => {
            console.log('SymphonyCacheTCP Server Server  ERROR!', error)
        })

    })

    after(() => {
      // runs once after the last test in this block
      console.log("after")
      process.exit()
    })

    describe('Get Module', () => {
        describe('from cache', () => {
          it('call alicedb', done => {
            chai.request(`http://localhost:${HTTP_PORT}`)
            .get(`/search/alicedb`)
            .end((err, res) => {
                expect(res.body.success).to.equal(true);
                expect(res.body.response.data).to.contain.keys('version', 'tarball', 'gzip', 'minified');
                expect(err).to.be.null
                expect(res).to.have.status(200)
                done()
             })
          })

          it('call alicedb from cache', done => {
            chai.request(`http://localhost:${HTTP_PORT}`)
            .get(`/search/alicedb`)
            .end((err, res) => {
                expect(res.body.success).to.equal(true);
                expect(res.body.response.fromCache).to.equal(true)
                expect(err).to.be.null
                expect(res).to.have.status(200)
                done()
             })
          })
        })
      })

  })