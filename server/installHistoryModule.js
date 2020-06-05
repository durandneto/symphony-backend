const net = require('net')
const fs = require("fs")
const path = require("path")
const { fork } = require('child_process')

let queuePackageHistoryVersions = 0

let parsedFile = {}


// template

//  {"index":"upload-puzzle@1.0.1-8",
//     "data":{
//         "isProcessed":true,
//         "gzip":1959,
//         "minified":6133,
//         "version":"1.0.1-8",
//         "time":"2020-05-11T21:18:23.513Z",
//         "tarball":"https://registry.npmjs.org/upload-puzzle/-/upload-puzzle-1.0.1-8.tgz"
//     }
// }

const setParsedFile = data => {
    parsedFile = data
}

const setQueue = queue => {
    queuePackageHistoryVersions = queue
}

const getPackageToProcess = () => {
    if (queuePackageHistoryVersions >= 0) {
        const queue = parsedFile.data.historyVersions[queuePackageHistoryVersions]
        queuePackageHistoryVersions --
        return queue
    } else {
        return null
    }
}

const processPackage = packageName => {
    const package = getPackageToProcess()
    if (!package) {
        console.log("end line", parsedFile,parsedFile.data.historyVersions)
        const cacheFileName = path.join(__dirname, "cache", "processed",
            `${packageName}.symphony`)

            try {
                parsedFile.data.isProcessed = true
                fs.writeFile(cacheFileName,
                    JSON.stringify(parsedFile), () => {
                        console.log("Everything is fine \0/!!!", JSON.stringify(parsedFile))
                        const client = new net.Socket()

                        client.connect(2204, '127.0.0.1', () => {
                            console.log('Connected');
                            client.write(JSON.stringify({
                                type: 'update-memory-cache',
                                data: parsedFile
                            }));
                        });

                        client.on('data', data => {
                            client.destroy()
                        });

                        client.on('close', () => {
                            console.log('Connection closed');
                            process.exit()
                        })

                    })
            } catch (error) {
                console.log("errro on create file when try to save error message")
                console.log(error)
                process.exit()
                // processPackage(packageName)
            }
        // process.exit()
    } else {
        console.log("processPackage", package)

        const installProcess = fork(path.join(__dirname, 'installPackage.js'))
        installProcess.send(JSON.stringify({
            moduleName: packageName ,
            tarball: package.data.tarball ,
        }))

        installProcess.on('message', forkMessage => {
            console.log('kill fork')
            installProcess.kill()
            const message = JSON.parse(forkMessage)
            if (message.type === "error") {
                console.log("error from fork process", message)
                console.log("Reveived from process", message)

                const cacheFileName = path.join(__dirname, "cache", "processed",
                `${packageName}@${package.data.version}.symphony`)

                try {
                    fs.writeFile(cacheFileName,
                        JSON.stringify({ error: true, errorMessage: "error on compile file"}), () => {
                            processPackage(packageName)
                        })
                } catch (error) {
                    console.log("errro on create file when try to save error message")
                    console.log(error)
                    // process.exit()
                    processPackage(packageName)
                }
            } else {
                console.log("Reveived from process", message)
                package.index = `${packageName}@${package.data.version}`
                package.data.gzip = message.data.gzip
                package.data.minified = message.data.minified
                package.data.isProcessed = true
                const cacheFileName = path.join(__dirname, "cache", "processed",
                `${packageName}@${package.data.version}.symphony`)

                try {
                    fs.writeFile(cacheFileName,
                        JSON.stringify(package), () => {
                            const packageClient = new net.Socket()

                            packageClient.connect(2204, '127.0.0.1', () => {
                                console.log('Connected');
                                packageClient.write(JSON.stringify({
                                    type: 'update-memory-cache',
                                    data: package
                                }));
                            });

                            packageClient.on('data', data => {
                                packageClient.destroy()
                                processPackage(packageName)
                            });

                            packageClient.on('close', () => {
                                console.log('Connection closed');
                            })
                        })
                } catch (error) {
                    console.log("errro on create file")
                    console.log(error)
                    processPackage(packageName)
                    // process.exit()

                }
            }

        })
    }

}

fs.readFile(process.argv[2], (err, file) => {
    if (err) {
      throw err
    }

    const parsedFile = JSON.parse(file)
    setParsedFile(parsedFile)

    setQueue(parsedFile.data.historyVersions.length -1)

    processPackage(parsedFile.index)

})