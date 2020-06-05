let primaryKey = -1
let cacheIndexes = []

const getPrimaryKey = () => {
  primaryKey ++
  return primaryKey
}

class Node {
  constructor(index, data) {
    if ( !data ) {
      throw "[NodeClass|constructor] :: data can not be null ::"
    } else {
      this.index = index
      this.data = JSON.stringify(data)
    }
  }

  getData() {
    return {
      index: this.index,
      data: JSON.parse(this.data)
    }
  }
}

class DurandNetoBinarySearchTree {

  constructor(){
    this.root = null
    this.left = null
    this.right = null
    this.key = getPrimaryKey()
    this.indexKeys = []
    this.indexKeys.push(this.key)
  }

  insertSync(index, data) {
    try {
      if ( this.root === null ) {
        this.root = new Node(index, data)
      } else {
        if ( index === this.root.index ) {
          primaryKey ++
          this.indexKeys.push(primaryKey)
        }

        if ( index < this.root.index ) {
          if ( this.left === null ) {
            this.left = new DurandNetoBinarySearchTree()
            this.left.insert(index, data)
          } else {
            this.left.insert(index, data)
          }
        }

        if ( index > this.root.index ) {
          if ( this.right === null ) {
            this.right = new DurandNetoBinarySearchTree()
            this.right.insert(index, data)
          } else {
            this.right.insert(index, data)
          }
        }
      }
    } catch (error) {
      throw error
    }
  }

  insert(index, data) {
    return new Promise((resolve, reject) => {
      try {
        if ( this.root === null ) {
          console.log(`insert new record ${index}`)
          this.root = new Node(index, data)
          resolve(this)
        } else {
          if ( index === this.root.index ) {
            primaryKey ++
            this.indexKeys.push(primaryKey)
            resolve(this)
          }

          if ( index < this.root.index ) {
            if ( this.left === null ) {
              this.left = new DurandNetoBinarySearchTree()
              this.left.insert(index, data)
                .then(resolve)
                .catch(reject)
            } else {
              this.left.insert(index, data)
                .then(resolve)
                .catch(reject)
            }
          }

          if ( index > this.root.index ) {
            if ( this.right === null ) {
              this.right = new DurandNetoBinarySearchTree()
              this.right.insert(index, data)
                .then(resolve)
                .catch(reject)
            } else {
              this.right.insert(index, data)
                .then(resolve)
                .catch(reject)
            }
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  printIndex() {
    if  ( this.root ) {
      console.log("printIndex", this.root.index)
      if (this.left) {
        this.left.printIndex()
      }
      if (this.right) {
        this.right.printIndex()
      }
    }
  }

  findSync(index) {
      try {
        if ((this.root && this.root.index) && this.root.index === index ) {
          return this.root
        } else if ( (this.root && this.root.index  && this.left) && index < this.root.index ) {
          return this.left
            .findSync(index)
        } else if ( (this.root && this.root.index && this.right) && index > this.root.index ) {
          return this.right
            .findSync(index)
        } else {
          return null
        }
      } catch (error) {
        return null
      }
  }

  getLastSync(number, referenceArray) {
    referenceArray = referenceArray || []
    if ( this.root ) {
      if ( this.right ) {
        this.right.getLastSync(number, referenceArray)
      }

      if ( number > referenceArray.length ) {
        number ++
        referenceArray.push(this.root.getData())
      } else if (number === referenceArray.length) {
        return referenceArray
      }

    } else {
      return referenceArray
    }
  }

  find(index) {
    return new Promise((resolve, reject) => {
      try {
        if ((this.root && this.root.index) && this.root.index === index ) {
          resolve(this)
        } else if ( (this.root && this.root.index  && this.left) && index < this.root.index ) {
          this.left
            .find(index)
            .then(resolve)
            .catch(reject)
        } else if ( (this.root && this.root.index && this.right) && index > this.root.index ) {
          this.right
            .find(index)
            .then(resolve)
            .catch(reject)
        } else {
          resolve(null)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  update(index, data) {
    return new Promise((resolve, reject) => {
      try {
        if ((this.root && this.root.index) && this.root.index === index ) {
          this.root = new Node(index, data)
          resolve(this)
        } else if ( (this.root && this.root.index  && this.left) && index < this.root.index ) {
          this.left
            .update(index, data)
            .then(resolve)
            .catch(reject)
        } else if ( (this.root && this.root.index && this.right) && index > this.root.index ) {
          this.right
            .update(index, data)
            .then(resolve)
            .catch(reject)
        } else {
          reject({error: `Record ${index} not found` , code: "NOT_FOUND"} )
        }
      } catch (error) {
        reject(error)
      }
    })
  }
  inserOrUpdate(index, data) {
    return new Promise((resolve, reject) => {
      try {
        this.update(index, data)
          .then(resolve)
          .catch( error => {
            if ( error.code === "NOT_FOUND") {
              this.insert(index, data)
              .then(resolve)
              .catch(reject)
            } else {
              reject(error)
            }
          })
      } catch (error) {
        reject(error)
      }
    })
  }
  //@TODO
  remove(){}

}

exports.default = DurandNetoBinarySearchTree
