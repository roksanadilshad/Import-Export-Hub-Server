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

        const productDB = client.db("product_db")
        const collection = productDB.collection("products")
        const importCollection = productDB.collection('imports')
         //get operations
        app.get('/products', async ( req, res ) => {
            const cursor = collection.find();
            const result = await cursor.toArray()
            res.send(result)
        })
        //get a single 
         app.get('/products/:id', verifyToken, async (req,res) => {
            const {id} = req.params;
            const query = new ObjectId(id);
            const result = await collection.findOne({_id: query})
            res.send({
                success: true,
                result})
        })
         //get operations
        app.get('/latest-products', async ( req, res ) => {
            const cursor = collection.find().sort({createdAt: 1})
            const result = await cursor.toArray()
            res.send(result)
        })

        // 1. Get all imports of a user
app.get('/imports/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const imports = await importCollection.find({ userId }).toArray();
        res.status(200).json(imports);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch imports' });
    }
});

// 2. Add a product to imports
app.post('/imports', async (req, res) => {
    const { userId, productId, productImage, productName, price, rating, originCountry, quantity } = req.body;

    if (!userId || !productId) {
        return res.status(400).json({ error: 'User ID and Product ID are required' });
    }

    const importData = {
        userId,
        productId,
        productImage,
        productName,
        price,
        rating,
        originCountry,
        quantity: quantity || 1,
        createdAt: new Date()
    };

    try {
        const result = await importCollection.insertOne(importData);
        res.status(201).json({ message: 'Product imported successfully', importId: result.insertedId });
    } catch (err) {
        res.status(500).json({ error: 'Failed to import product' });
    }
});

// 3. Remove an imported product
app.delete('/imports/:importId', async (req, res) => {
    const { importId } = req.params;
    try {
        const result = await importCollection.deleteOne({ _id: new ObjectId(importId) });
        if (result.deletedCount === 1) {
            res.status(200).json({ message: 'Import removed successfully' });
        } else {
            res.status(404).json({ error: 'Import not found' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove import' });
    }
});

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
        });
        
           //Import 
         app.post('/imports', verifyToken, async (req, res) => {
      const {userId, productId, quantity } = req.body;

      try {
        if (!userId || !productId || !quantity) {
          return res.status(400).json({ message: "Product ID and quantity are required." });
        }

        const query = { _id: new ObjectId(productId) };
        const product = await collection.findOne(query);

        if (!product) {
          return res.status(404).json({ message: "Product not found." });
        }

        if (quantity > product.availableQuantity) {
          return res.status(400).json({ message: "Import quantity exceeds available stock." });
        }

        await collection.updateOne(query, { $inc: { availableQuantity: -quantity } });

         const importData = {
            userId,
            productId,
            productImage: product.productImage,
            productName: product.productName,
            price: product.price,
            rating: product.rating,
            originCountry: product.originCountry,
            quantity,
            createdAt: new Date(),
        };

        const result = await importCollection.insertOne(importData);
        res.status(201).json({ message: "Product imported successfully!" , importId: result.insertedId});
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to import product" });
      }
    });

        //delete operations
        app.delete('/products/:id', async(req, res) => {
            const id = req.params.id
            const query = {_id: new ObjectId(id)}
            const result = await collection.deleteOne(query)
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


