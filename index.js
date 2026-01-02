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
        const productCollection = skeletonDB.collection("products")
        const importsCollection = skeletonDB.collection("imports")
        // const exportsCollection = skeletonDB.collection("exports")
        
         //get operations
        app.get('/products', async (req, res) => {
    const page = parseInt(req.query.page) || 0;
    const size = parseInt(req.query.size) || 9; // Items per page
    const category = req.query.category;

    // Filter by category if it's not "All"
    let query = {};
    if (category && category !== "All") {
        query = { category: category };
    }

    const cursor = productCollection.find(query);
    
    // Get total count for the pagination buttons
    const totalProducts = await productCollection.countDocuments(query);
    
    // Fetch specific page data
    const products = await cursor
        .skip(page * size)
        .limit(size)
        .toArray();

    res.send({ totalProducts, products });
});
         //get operations
        app.get('/latest-products', async ( req, res ) => {
            const cursor = productCollection.find().sort({createdAt: -1})
            const result = await cursor.toArray()
            res.send(result)
        })
         //Popular
        app.get('/popular-products', async ( req, res ) => {
            const cursor = productCollection.find().sort({rating: -1}).limit(6)
            const result = await cursor.toArray()
            res.send(result)
        })

        //get a single 
        app.get('/products/:id',  async (req,res) => {
            const {id} = req.params;
            const query = new ObjectId(id);
            const result = await productCollection.findOne({_id: query})
            res.send({
                success: true,
                result})
        })

        // post operations
        app.post('/products', async(req, res) => {
            const newProduct = req.body;
            const result = await productCollection.insertOne(newProduct)
            res.send({
              success: true,
              result})
        });

        // update operations
        app.patch('/products/:id', verifyToken, async (req, res) =>{
            const id = req.params.id
            const query = {_id: new ObjectId(id)}
            const updateNEW = req.body
            const update = {
                $set: {
                    title: updateNEW.title,
                    price: updateNEW.price
                }
            }

            const result = await productCollection.updateOne(query, update)
            res.send(result)
        });

// Search
   app.get("/search", async(req, res) => {
      const search_text = req.query.search
      const result = await productCollection.find({productName: {$regex: search_text, $options: "i"}}).toArray()
      res.send(result)
    })


//Export product
        app.get("/my-exports",  async(req, res) => {
      const email = req.query.email
      const result = await productCollection.find({
       exporterEmail: email}).toArray()
      res.send(result)
    })   
    
    //Update Export
app.put("/exports/:id", verifyToken,  async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      const objectId = new ObjectId(id);
      const filter = { _id: objectId };
      const update = {
        $set: data,
      };

      const result = await productCollection.updateOne(filter, update);

      res.send({
        success: true,
        result,
      });
    });


//Delete Export 
 app.delete('/exports/:id', async(req, res) => {
            const {id} = req.params
            const query = {_id: new ObjectId(id)}
            const result = await productCollection.deleteOne(query)
            res.send({
              success: true,
              result})
        })



    // Import product
        app.post('/imports', async (req, res) => {
  try {
   // console.log("🧠 Import request body:", req.body);

    const { productId, import_by, quantity } = req.body;

    if (!productId || !ObjectId.isValid(productId)) {
      console.log("❌ Invalid or missing productId:", productId);
      return res.status(400).json({ message: "Invalid Product ID." });
    }

    if (!quantity || isNaN(quantity)) {
      console.log("❌ Invalid or missing quantity:", quantity);
      return res.status(400).json({ message: "Quantity is required." });
    }

    const productObjectId = new ObjectId(productId);

    const product = await productCollection.findOne({ _id: productObjectId });
    console.log("✅ Product found:", product);

    if (!product) {
      console.log("❌ Product not found for ID:", productId);
      return res.status(404).json({ message: "Product not found." });
    }

    if (quantity > product.availableQuantity) {
      console.log(
        "⚠️ Quantity exceeds available:",
        quantity,
        ">",
        product.availableQuantity
      );
      return res.status(400).json({
        success: false,
        message: "Import quantity exceeds available stock.",
      });
    }

    // Decrease available quantity
    await productCollection.updateOne(
      { _id: productObjectId },
      { $inc: { availableQuantity: -quantity } }
    );

    const existingImport = await importsCollection.findOne({
      productId: productObjectId,
      import_by,
    });
    console.log("Existing import record:", existingImport);

    if (existingImport) {
      await importsCollection.updateOne(
        { productId: productObjectId, import_by },
        {
          $inc: { quantity: quantity },
          $set: { lastImportBy: import_by, lastImportDate: new Date() },
        }
      );
      console.log("✅ Existing import updated");
      return res.json({ success: true, message: "Import quantity updated." });
    } else {
      const importRecord = {
        productId: productObjectId,
        quantity,
        import_by,
        importDate: new Date(),
      };

      await importsCollection.insertOne(importRecord);
      console.log("✅ New import inserted");
      return res.json({
        success: true,
        message: "Product imported successfully.",
      });
    }
  } catch (error) {
    console.error("❌ Import route failed:", error.message, error.stack);
    res.status(500).json({
      success: false,
      message: "Something went wrong on the server.",
      error: error.message,
    });
  }
});

    app.get('/my-imports/:id', verifyToken, async (req,res) => {
            const {id} = req.params;
            const query = new ObjectId(id);
            const result = await importsCollection.findOne({_id: query})
            res.send({
                success: true,
                result})
        })

           // Get user's import history
             app.get("/my-imports", verifyToken, async (req, res) => {
  const email = req.query.email;
  try {
    const imports = await importsCollection
      .find({ import_by: email })
      .toArray();

    // Fetch product details for each import
    const result = await Promise.all(
      imports.map(async (imp) => {
        const product = await productCollection.findOne({ _id: new ObjectId(imp.productId) });
        return {
          _id: imp._id, // unique ID for the import record
          productId: imp.productId,
          import_by: imp.import_by,
          importDate: imp.importDate,
          importedQuantity: imp.quantity, // ✅ include imported quantity
          productName: product?.productName,
          productImage: product?.productImage,
          price: product?.price,
          rating: product?.rating,
          originCountry: product?.originCountry,
          availableQuantity: product?.availableQuantity,
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});
        //delete operations
        app.delete('/imports/:id', async(req, res) => {
            const {id} = req.params
            const query = {_id: new ObjectId(id)}
            const result = await importsCollection.deleteOne(query)
            res.send({
              success: true,
              result})
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


