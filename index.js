
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

async function startServer() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log('You successfully connected to MongoDB!');

    // Select database and collection
    const db = client.db('StudioSpace');
    const addStudioInfo = db.collection('addStudioInfo');

    // Test route
    app.get('/', (req, res) => {
      res.send('Backend connected successfully!');
    });

    // Add studio API
    app.post('/add-studio', async (req, res) => {
      try {
        const data = req.body;

        const result = await addStudioInfo.insertOne(data);

        res.status(201).send({
          success: true,
          message: 'Studio added successfully!',
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error('Insert error:', error);

        res.status(500).send({
          success: false,
          message: 'Failed to add studio',
        });
      }
    });

    app.get('/allStudio', async(req,res)=>{
      const result = await addStudioInfo.find().toArray();
      res.send(result);
    })




    // Start server after MongoDB connection
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('Server startup failed:', error);
  }
}

startServer();
