let map, userMarker, busMarker, routeLine;
let busNumberGlobal = "";

// === DRIVER SIDE ===
const startTripBtn = document.getElementById("startTripBtn");
if (startTripBtn) {
  startTripBtn.onclick = async () => {
    const busNumber = document.getElementById("driverBusNumber").value.trim();
    if (!busNumber) return alert("Enter bus number");
    busNumberGlobal = busNumber;

    // Notify backend trip start
    const res = await fetch("/api/driver/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ busNumber }),
    });
    const data = await res.json();
    document.getElementById("driverMessage").innerText = data.message;

    // ✅ Start sending driver's real GPS location
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;

          await fetch("/api/driver/updateLocation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ busNumber, lat, lng }),
          });

          console.log(`📍 Sent live location for Bus ${busNumber}:`, lat, lng);
        },
        (err) => {
          console.error("Driver location error:", err);
          alert("Please allow location access for live tracking.");
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    } else {
      alert("Geolocation not supported on this device.");
    }
  };
}

// === PASSENGER SIDE ===
const searchBusBtn = document.getElementById("searchBusBtn");
if (searchBusBtn) {
  searchBusBtn.onclick = () => {
    const busNumber = document
      .getElementById("passengerBusNumber")
      .value.trim();
    if (!busNumber) return alert("Enter bus number");
    busNumberGlobal = busNumber;
    initPassengerMap();
  };
}

// === MAP & TRACKING ===
function initPassengerMap() {
  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const userPos = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };

      // Initialize map
      map = new google.maps.Map(document.getElementById("map"), {
        center: userPos,
        zoom: 15,
      });

      // Passenger marker
      userMarker = new google.maps.Marker({
        position: userPos,
        map,
        title: "You",
        icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
      });

      // Bus marker placeholder
      busMarker = new google.maps.Marker({
        map,
        title: "Bus",
        icon: "https://maps.google.com/mapfiles/kml/shapes/bus.png",
      });

      // Line between passenger & bus
      routeLine = new google.maps.Polyline({
        strokeColor: "#0000FF",
        strokeOpacity: 0.6,
        strokeWeight: 4,
        map,
        path: [userPos, userPos],
      });

      pollBus(userPos);
      setInterval(() => pollBus(userPos), 5000);
    },
    (err) => {
      console.error("Error fetching location:", err);
      alert("Please enable location access and try again.");
    }
  );
}

// === Fetch live bus updates ===
async function pollBus(userPos) {
  try {
    const res = await fetch(`/api/bus/${busNumberGlobal}`);
    const data = await res.json();

    const msgEl = document.getElementById("passengerMessage");
    const infoEl = document.getElementById("busInfo");

    if (!data.started || !data.lat || !data.lng) {
      msgEl.innerText = "Driver has not started the trip yet.";
      busMarker.setVisible(false);
      routeLine.setVisible(false);
      infoEl.innerText = "";
      return;
    }

    msgEl.innerText = "";
    busMarker.setVisible(true);
    routeLine.setVisible(true);

    const busPos = { lat: data.lat, lng: data.lng };
    busMarker.setPosition(busPos);
    routeLine.setPath([userPos, busPos]);

    // Marker color based on occupancy
    let color = "green";
    if (data.status === "yellow") color = "yellow";
    else if (data.status === "red") color = "red";

    busMarker.setIcon({
  url: "https://maps.google.com/mapfiles/kml/shapes/bus.png",
  scaledSize: new google.maps.Size(48, 48),
});


    // Compute distance
    const distance = getDistance(
      userPos.lat,
      userPos.lng,
      busPos.lat,
      busPos.lng
    );

    infoEl.innerHTML = `
      <b>Bus:</b> ${data.busId}<br>
      <b>Occupancy:</b> ${data.occupancyPercent}%<br>
      <b>Status:</b> ${data.status.toUpperCase()}<br>
      <b>Distance:</b> ${distance.toFixed(2)} km
    `;
  } catch (err) {
    console.error("Error fetching bus data:", err);
  }
}

// === Distance formula ===
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
