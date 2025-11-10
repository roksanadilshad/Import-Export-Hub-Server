const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 3000
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
require('dotenv').config()
const serviceAccount = require("./service.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// middlewere
app.use(cors())
app.use(express.json())
 

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@clusterok.helsitf.mongodb.net/?appName=Clusterok`;

//
//
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// app.get('/' , (req, res) => {
//     res.send("the server is running from port 3000")
// })

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({
      message: "unauthorized access. Token not found!",
    });
  }

  const token = authorization.split(" ")[1];
  try {
    await admin.auth().verifyIdToken(token);

    next();
  } catch (error) {
    res.status(401).send({
      message: "unauthorized access.",
    });
  }
};

async function run() {
    try {
        //await client.connect()

        //get operations
        app.get('/products', async ( req, res ) => {
            const cursor = collection.find().sort({createdAt: 1})
            const result = await cursor.toArray()
            res.send(result)
        })

        //get a single 
        app.get('/products/:id', verifyToken, async (req,res) => {
            const id = req.params.id
            const query = {_id: new ObjectId(id)}
            const result = await collection.findOne(query)
            res.send(result)
        })

        const skeletonDB = client.db("product_db")
        const collection = skeletonDB.collection("products")

        // post operations
        app.post('/products', async(req, res) => {
            const newBooks = req.body;
            const result = await collection.insertOne(newBooks)
            res.send(result)
        })

        //delete operations
        app.delete('/products/:id', async(req, res) => {
            const id = req.params.id
            const query = {_id: new ObjectId(id)}
            const result = await collection.deleteOne(query)
            res.send(result)
        })

        // update operations
        app.patch('/products/:id', async (req, res) =>{
            const id = req.params.id
            const query = {_id: new ObjectId(id)}
            const updateNEW = req.body
            const update = {
                $set: {
                    title: updateNEW.title,
                    price: updateNEW.price
                }
            }

            const result = await collection.updateOne(query, update)
            res.send(result)
        })

        

        //await client.db("admin").command({ ping: 1 });
         console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } 
    finally {
        //  await client.close();
    }
}

run().catch(console.dir)

app.listen(port, () =>{
    console.log(`this server is running on ${port}`);
})


