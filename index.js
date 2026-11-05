import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { MongoClient, ObjectId } from "mongodb";

const app = express();
const client = new MongoClient(process.env.MONGODB_URI);
let db;
async function getDb() {
  if (!db) {
    await client.connect();
    db = client.db(process.env.DB_NAME || "studiospace");
    await db.collection("bookings").createIndex({ studioId: 1, status: 1, startAt: 1, endAt: 1 });
  }
  return db;
}

app.use(cors({ origin: (process.env.CLIENT_URL || "http://localhost:3000").split(","), credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(async (req, _res, next) => { req.db = await getDb(); next(); });

// ---- Challenge 1: JWT in an HTTPOnly cookie (ss_token) ----
const requireAuth = (req, res, next) => {
  try {
    req.user = jwt.verify(req.cookies.ss_token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized: please log in to continue." });
  }
};
const oid = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : null);
const bad = (res, message, status = 400) => res.status(status).json({ message });

const cleanStudio = (b) => ({
  title: String(b.title || "").trim(),
  category: b.category,
  hourlyRate: Number(b.hourlyRate),
  deposit: Number(b.deposit) || 0,
  capacity: Number(b.capacity),
  location: String(b.location || "").trim(),
  image: String(b.image || "").trim(),
  gallery: Array.isArray(b.gallery) ? b.gallery.filter(Boolean) : [],
  amenities: Array.isArray(b.amenities) ? b.amenities : [],
  overview: String(b.overview || "").trim(),
});
const validStudio = (s) => s.title && s.category && s.hourlyRate > 0 && s.capacity > 0 && s.location && s.image && s.overview;

app.get("/", (_req, res) => res.json({ name: "StudioSpace API", status: "ok" }));

// ---------------- Studios ----------------
app.get("/api/studios", async (req, res) => {
  const { category, search, sort, limit } = req.query;
  const q = {};
  if (category) q.category = String(category);
  if (search) {
    const r = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    q.$or = [{ title: r }, { location: r }];
  }
  const sorts = { top: { rating: -1, createdAt: -1 }, new: { createdAt: -1 }, low: { hourlyRate: 1 }, high: { hourlyRate: -1 } };
  let cursor = req.db.collection("studios").find(q).sort(sorts[sort] || { createdAt: -1 });
  if (Number(limit) > 0) cursor = cursor.limit(Math.min(Number(limit), 50)); // e.g. .limit(6) for Featured
  res.json(await cursor.toArray());
});

app.get("/api/studios/mine", requireAuth, async (req, res) => {
  res.json(await req.db.collection("studios").find({ ownerEmail: req.user.email }).sort({ createdAt: -1 }).toArray());
});

app.get("/api/studios/:id", async (req, res) => {
  const id = oid(req.params.id);
  const studio = id && (await req.db.collection("studios").findOne({ _id: id }));
  if (!studio) return bad(res, "Studio not found.", 404);
  res.json(studio);
});

app.post("/api/studios", requireAuth, async (req, res) => {
  const s = cleanStudio(req.body);
  if (!validStudio(s)) return bad(res, "Please fill in all required studio fields.");
  const doc = { ...s, rating: 0, reviews: [], ownerEmail: req.user.email, ownerName: req.user.name, ownerImage: req.user.image || "", createdAt: new Date() };
  const r = await req.db.collection("studios").insertOne(doc);
  res.status(201).json({ _id: r.insertedId });
});

async function ownStudio(req, res) {
  const id = oid(req.params.id);
  const studio = id && (await req.db.collection("studios").findOne({ _id: id }));
  if (!studio) { bad(res, "Studio not found.", 404); return null; }
  if (studio.ownerEmail !== req.user.email) { bad(res, "You can only change your own listings.", 403); return null; }
  return studio;
}

app.put("/api/studios/:id", requireAuth, async (req, res) => {
  const studio = await ownStudio(req, res);
  if (!studio) return;
  const s = cleanStudio(req.body);
  if (!validStudio(s)) return bad(res, "Please fill in all required studio fields.");
  await req.db.collection("studios").updateOne({ _id: studio._id }, { $set: s });
  res.json({ ok: true });
});

app.delete("/api/studios/:id", requireAuth, async (req, res) => {
  const studio = await ownStudio(req, res);
  if (!studio) return;
  await req.db.collection("studios").deleteOne({ _id: studio._id });
  res.json({ ok: true });
});

// ---------------- Bookings ----------------
const toDates = (date, start, end) => ({
  startAt: new Date(`${date}T${start}:00Z`),
  endAt: new Date(`${date}T${end}:00Z`),
});
// Challenge 2: look for a Confirmed booking whose time range overlaps [startAt, endAt)
const findClash = (db, studioId, startAt, endAt, excludeId) =>
  db.collection("bookings").findOne({
    studioId, status: "Confirmed", startAt: { $lt: endAt }, endAt: { $gt: startAt },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
const clashMessage = (c) => `This studio is already booked on ${c.date} from ${c.startTime} to ${c.endTime}. Please pick a different time.`;

app.post("/api/bookings", requireAuth, async (req, res) => {
  const { studioId, date, startTime, endTime, notes } = req.body;
  const id = oid(studioId);
  const studio = id && (await req.db.collection("studios").findOne({ _id: id }));
  if (!studio) return bad(res, "Studio not found.", 404);
  if (studio.ownerEmail === req.user.email) return bad(res, "You can't book your own studio.");
  if (!date || !startTime || !endTime) return bad(res, "Choose a date, start time and end time.");
  const { startAt, endAt } = toDates(date, startTime, endTime);
  if (isNaN(startAt) || isNaN(endAt) || endAt <= startAt) return bad(res, "End time must be after the start time.");
  if (date < new Date().toISOString().slice(0, 10)) return bad(res, "Pick today or a future date.");
  const hours = (endAt - startAt) / 36e5;
  if (hours > 12) return bad(res, "A single booking can be 12 hours at most.");
  const clash = await findClash(req.db, String(studio._id), startAt, endAt);
  if (clash) return bad(res, clashMessage(clash), 409);
  const doc = {
    studioId: String(studio._id), studioTitle: studio.title, studioImage: studio.image, hostEmail: studio.ownerEmail,
    userEmail: req.user.email, userName: req.user.name, date, startTime, endTime, startAt, endAt,
    hours, total: hours * studio.hourlyRate, deposit: studio.deposit, notes: String(notes || "").slice(0, 500),
    status: "Pending", createdAt: new Date(),
  };
  const r = await req.db.collection("bookings").insertOne(doc);
  res.status(201).json({ _id: r.insertedId });
});

app.get("/api/bookings/mine", requireAuth, async (req, res) => {
  res.json(await req.db.collection("bookings").find({ userEmail: req.user.email }).sort({ createdAt: -1 }).toArray());
});
app.get("/api/bookings/incoming", requireAuth, async (req, res) => {
  res.json(await req.db.collection("bookings").find({ hostEmail: req.user.email }).sort({ createdAt: -1 }).toArray());
});

app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
  const id = oid(req.params.id);
  const b = id && (await req.db.collection("bookings").findOne({ _id: id }));
  if (!b) return bad(res, "Booking not found.", 404);
  const next = req.body.status;
  const isHost = b.hostEmail === req.user.email;
  const isGuest = b.userEmail === req.user.email;
  const allowed =
    (isGuest && next === "Cancelled" && b.status === "Pending") ||
    (isHost && next === "Confirmed" && b.status === "Pending") ||
    (isHost && next === "Completed" && b.status === "Confirmed") ||
    (isHost && next === "Cancelled" && ["Pending", "Confirmed"].includes(b.status));
  if (!allowed) return bad(res, "That status change isn't allowed.", 403);
  if (next === "Confirmed") {
    const clash = await findClash(req.db, b.studioId, b.startAt, b.endAt, b._id);
    if (clash) return bad(res, clashMessage(clash), 409);
  }
  await req.db.collection("bookings").updateOne({ _id: b._id }, { $set: { status: next } });
  res.json({ ok: true });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL) app.listen(PORT, () => console.log(`StudioSpace API running on :${PORT}`));
export default app;
