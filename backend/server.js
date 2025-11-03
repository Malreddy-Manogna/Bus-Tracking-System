const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const frontendPath = path.join(__dirname, "..", "frontend");
app.use("/", express.static(frontendPath));

// Store live bus data
let buses = {};

// ✅ Driver starts trip (initializes bus)
app.post("/api/driver/start", (req, res) => {
  const { busNumber } = req.body;
  if (!busNumber) return res.status(400).json({ error: "busNumber required" });

  buses[busNumber] = {
    started: true,
    lat: null,
    lng: null,
    occupancy: 0,
    timestamp: new Date().toISOString(),
  };

  res.json({ message: `Trip started for ${busNumber}` });
});

// ✅ Driver continuously sends live GPS updates
app.post("/api/driver/updateLocation", (req, res) => {
  const { busNumber, lat, lng } = req.body;

  if (!busNumber || lat == null || lng == null)
    return res.status(400).json({ error: "Missing data" });

  if (!buses[busNumber])
    buses[busNumber] = { started: true, occupancy: 0, lat, lng };

  buses[busNumber].lat = lat;
  buses[busNumber].lng = lng;
  buses[busNumber].timestamp = new Date().toISOString();

  console.log(`🚌 Bus ${busNumber} updated location:`, lat, lng);
  res.json({ success: true });
});


// ✅ ESP32 sends live passenger count
app.post("/api/updateOccupancy", (req, res) => {
  const { busNumber, occupancy } = req.body;

  if (!busNumber || occupancy == null)
    return res.status(400).json({ error: "Missing data" });

  if (!buses[busNumber])
    buses[busNumber] = { started: true, occupancy, lat: null, lng: null };

  buses[busNumber].occupancy = occupancy;
  buses[busNumber].timestamp = new Date().toISOString();

  console.log(`👥 Updated occupancy for Bus ${busNumber}: ${occupancy}`);
  res.json({ success: true });
});

// ✅ Passenger fetches bus info
app.get("/api/bus/:busNumber", (req, res) => {
  const busNumber = req.params.busNumber;
  const bus = buses[busNumber];

  if (!bus || !bus.started) return res.json({ started: false });

  let status = "green";
  if (bus.occupancy >= 40) status = "red";
  else if (bus.occupancy >= 20) status = "yellow";

  res.json({
    started: true,
    busId: busNumber,
    lat: bus.lat,
    lng: bus.lng,
    occupancyPercent: bus.occupancy,
    status,
    timestamp: bus.timestamp,
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`)
);
