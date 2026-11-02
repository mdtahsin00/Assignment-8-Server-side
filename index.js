
import express from 'express';
import cors from 'cors';
import 'dotenv/config'
import { MongoClient } from 'mongodb';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}


connectToMongoDB();

app.get('/', (req, res) => {
  res.send('Backend connected successfully!');
});

app.post('/add-studio', (req, res) => {
  console.log('API working');
  console.log(req.body);

  res.status(201).json({
    success: true,
    message: 'API is working',
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
