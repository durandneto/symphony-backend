# This is the Sympnohy backend test to compile and to check bundle compilation

1 - All Components are made using Javascript and I tried to use minimal external modules just to show my skills.

2 - I created a simple TCP BinarySearchTree Memory Database to store data and return data to client from memory to avoid unnecessary calls to disk

# Release Current
`master`

# Endpoints GET /search/:moduleName

- This end point will first will check if the package was built once on memory if not will check on BKP files if both are empty it will search on NPM for the module.

- If its response is 200 it will process the response then install the package on disk then comile the package then gzip the folder then save a backup on memory database and BKP a file on disk as well and then return to client.

- If its response is different than 200 will cache and return to the client

- This project could manager a few different process to keep low memory cost
- This project could create folder and file on disk to save cache

# How to run:

* Clone the [project]
* run `yarn or npm install`
* run `cd [Project Folder]`
* run `yarn or npm start`
* run `yarn or npm test`

* It will open two process the fist one is for the TCP Memory Database and the next is for the NodeJS API
* The TCP PORT is 2204
* The HTTP API PORT is 2706


# Architecture:

 ```
ROOT                      #
│
server
│   └─── index.js                       # Export the MemoryCache and the HTTP Server
│   └─── installHistoryModule.js        # Install the latest 5 versions of each package in the background
│   └─── installPackage.js              # Install a specific version of the package
│   └─── NpmPackageStats.js             # JS Class to manager to package
│   └─── SymphonyNodeJsHTTPServer.js    # NodeJS HTTP Sever
│   └─── SymphonyNpmHandleRequest.js    # JS Class to manager TCP calls
|        cache
│          └─── SymphonyCacheDB.tcp.server.js   # TCP Server to Handle memory database
│          └─── SymphonyCacheDB.js              # BinarySearchTree Memory Database
|               processed                       # Folder to save BKP files for recovery data for MemoryCache
└─── package.json
└─── README.md
└─── index.js
```

## Next Steps
> Refactory
