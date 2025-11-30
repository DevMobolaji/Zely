// import { MongoClient, ServerApiVersion } from 'mongodb';
// const uri = "mongodb+srv://Fintech_Api:<db_password>@cluster0.a2z3joo.mongodb.net/?appName=Cluster0";
// // Create a MongoClient with a MongoClientOptions object to set the Stable API version
// const client = new MongoClient(uri, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   }
// });
// async function run() {
//   try {
//     // Connect the client to the server	(optional starting in v4.7)
//     await client.connect();
//     // Send a ping to confirm a successful connection
//     await client.db("admin").command({ ping: 1 });
//     console.log("Pinged your deployment. You successfully connected to MongoDB!");
//   } finally {
//     // Ensures that the client will close when you finish/error
//     await client.close();
//   }
// }
// run().catch(console.dir);



require('dotenv').config();
import mongoose from "mongoose";

const MONGO_URL = process.env.MONGO_URI as string
console.log(MONGO_URL)

mongoose.connection.once("open", () => {
    console.log("MongDB connection ready!");
});

mongoose.connection.on("error", (err: any) => {
    console.error(err);
});

mongoose.set('strictQuery', false);

export async function mongoConnect() {
    await mongoose.connect(MONGO_URL);
}


async function mongoDisconnect(): Promise<void> {
    await mongoose.disconnect();
}

module.exports = {
    mongoConnect,
    mongoDisconnect
}
