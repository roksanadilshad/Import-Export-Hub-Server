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

        const skeletonDB = client.db("product_db")
        const collection = skeletonDB.collection("products")
        const importsCollection = skeletonDB.collection("imports")
        
         //get operations
        app.get('/products', async ( req, res ) => {
            const cursor = collection.find()
            const result = await cursor.toArray()
            res.send(result)
        })
         //get operations
        app.get('/latest-products', async ( req, res ) => {
            const cursor = collection.find().sort({createdAt: 1})
            const result = await cursor.toArray()
            res.send(result)
        })

        //get a single 
        app.get('/products/:id',  async (req,res) => {
            const {id} = req.params;
            const query = new ObjectId(id);
            const result = await collection.findOne({_id: query})
            res.send({
                success: true,
                result})
        })

        // post operations
        app.post('/products', async(req, res) => {
            const newProduct = req.body;
            const result = await collection.insertOne(newProduct)
            res.send(result)
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

         app.post("/imports", async(req, res) => {
      const data = req.body
      //const id = req.params.id
      
      const result = await importsCollection.insertOne(data)
      res.send(result)
      });

      app.get("/my-imports",  async(req, res) => {
      const email = req.query.email
      const result = await importsCollection.find({import_by: email}).toArray()
      res.send(result)
    })
    app.get('/my-imports/:id',  async (req,res) => {
            const {id} = req.params;
            const query = new ObjectId(id);
            const result = await importsCollection.findOne({_id: query})
            res.send({
                success: true,
                result})
        })
      // Import product
        app.post('/import', async (req, res) => {
         const { productId, quantity, import_by } = req.body;

     try {
    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid Product ID." });
    }

    const query = { _id: new ObjectId(productId) };
    const product = await collection.findOne(query);

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    if (quantity > product.availableQuantity) {
      return res.status(400).json({ message: "Import quantity exceeds available stock." });
    }

    // Decrease available quantity in main collection
    await collection.updateOne(query, { $inc: { availableQuantity: -quantity } });

    // Check if import record already exists for this product
    const existingImport = await importsCollection.findOne({ productId: new ObjectId(productId) });

    if (existingImport) {
      // Increment quantity in existing import record
      await importsCollection.updateOne(
        { productId: new ObjectId(productId) },
        { $inc: { quantity: quantity }, $set: { lastImportBy: import_by, lastImportDate: new Date() } }
      );
      return res.json({ message: "Import quantity updated." });
    } else {
      // Create new import record
      const importRecord = {
        productId: new ObjectId(productId),
        quantity,
        import_by,
        importDate: new Date(),
      };
      await importsCollection.insertOne(importRecord);
      return res.json({ message: "Product imported successfully." });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong." });
  }
});

    
           // Get user's import history
              app.get("/my-imports", verifyToken, async (req, res) => {
                try {
                  const email = req.query.email;
              
                  if (!email) {
                    return res.status(400).json({ message: "Email is required." });
                  }
              
                  const result = await importsCollection.find({ import_by: email }).toArray();
              
                  res.send(result);
                } catch (error) {
                  console.error(error);
                  res.status(500).json({ message: "Server error", error: error.message });
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


