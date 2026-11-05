import "dotenv/config";
import { MongoClient } from "mongodb";

const img = (s) => `https://picsum.photos/seed/${s}/900/650`;
const base = [
  ["Northlight Cyc Wall", "Photo Studio", 45, 100, 12, "Mirpur DOHS, Dhaka", ["Cyc wall", "Strobe kit", "Makeup station", "Wi-Fi", "Air conditioning"], "A 900 sq ft white cyclorama with natural north light and a full strobe kit, built for fashion and product shoots."],
  ["Reel House Stage A", "Film Stage", 120, 300, 40, "Uttara Sector 7, Dhaka", ["Green screen", "Lighting grid", "Sound proofing", "Green room", "Parking"], "A sound-proofed 2,000 sq ft stage with a lighting grid and a green room for short films and commercials."],
  ["The Mic Lounge", "Podcast Lounge", 30, 50, 5, "Dhanmondi 27, Dhaka", ["Shure mics", "Mixing desk", "Sound proofing", "Wi-Fi", "Coffee bar"], "A cozy treated room with four broadcast mics, built for interviews and multi-host shows."],
  ["Low End Recording Suite", "Music Suite", 60, 150, 8, "Gulshan 2, Dhaka", ["Mixing desk", "Vocal booth", "Monitors", "Sound proofing", "Instruments"], "A live room and vocal booth with studio monitors and an engineer-ready console."],
  ["Clay & Canvas Workshop", "Workshop", 25, 40, 20, "Khulna Sonadanga, Khulna", ["Easels", "Kiln", "Natural light", "Storage", "Wi-Fi"], "A bright shared art workshop with easels, a kiln and plenty of wall space for classes and pop-ups."],
  ["Harbor Light Loft", "Photo Studio", 55, 120, 15, "Agrabad, Chattogram", ["Natural light", "Props", "Backdrops", "Wi-Fi", "Parking"], "A loft with tall windows and a prop library for portraits, lookbooks and food photography."],
  ["Blackbox Sound Stage", "Film Stage", 150, 400, 60, "Bashundhara R/A, Dhaka", ["Lighting grid", "Green screen", "Dressing rooms", "Loading dock", "Catering area"], "A blackbox stage with a loading dock and dressing rooms for larger productions."],
  ["Studio Fifteen Beats", "Music Suite", 40, 80, 6, "Zindabazar, Sylhet", ["Monitors", "Drum kit", "Vocal booth", "Air conditioning"], "A budget-friendly rehearsal and tracking room with a drum kit and vocal booth."],
  ["Cedar Talk Room", "Podcast Lounge", 28, 40, 4, "Khulna Boyra, Khulna", ["Shure mics", "Sound proofing", "Wi-Fi", "Coffee bar"], "A quiet two-mic room for solo shows and interviews with an easy booking window."],
];
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.DB_NAME || "studiospace");
await db.collection("studios").deleteMany({ ownerEmail: "host@studiospace.dev" });
await db.collection("studios").insertMany(base.map(([title, category, hourlyRate, deposit, capacity, location, amenities, overview], i) => ({
  title, category, hourlyRate, deposit, capacity, location, amenities, overview,
  image: img(`studio${i + 1}`), gallery: [img(`studio${i + 1}b`), img(`studio${i + 1}c`)],
  rating: [4.9, 4.8, 4.7, 4.9, 4.6, 4.8, 4.5, 4.4, 4.6][i],
  reviews: [
    { name: "Nadia R.", rating: 5, comment: "Clean, well equipped and the host was very responsive." },
    { name: "Imran K.", rating: 4, comment: "Great space for the price. Load-in was easy." },
  ],
  ownerEmail: "host@studiospace.dev", ownerName: "StudioSpace Demo Host", ownerImage: "", createdAt: new Date(Date.now() - i * 864e5),
})));
console.log("Seeded demo studios");
await client.close();
