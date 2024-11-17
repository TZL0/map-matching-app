import React, { useState, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
  Tooltip,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Draggable from 'react-draggable';
import { collection, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Adjust the import path as needed

// Fix the default icon issue in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const getCurrentTimeFormatted = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = ('0' + (now.getMonth() + 1)).slice(-2);
  const day = ('0' + now.getDate()).slice(-2);
  const hours = ('0' + now.getHours()).slice(-2);
  const minutes = ('0' + now.getMinutes()).slice(-2);
  const seconds = ('0' + now.getSeconds()).slice(-2);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// Function to validate the time string
function isValidDateTime(dateTimeString) {
  // Regular expression to match the date and time format YYYY-MM-DD HH:MM:SS
  const dateTimeRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\s(0\d|1\d|2[0-3]):[0-5]\d:[0-5]\d$/;

  // Test the string against the regular expression
  if (!dateTimeRegex.test(dateTimeString)) {
    return false;
  }

  // Parse the date and time components
  const [datePart, timePart] = dateTimeString.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);

  // Check if the date is valid using Date object
  const date = new Date(year, month - 1, day, hours, minutes, seconds);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hours &&
    date.getMinutes() === minutes &&
    date.getSeconds() === seconds
  );
}

const MapComponent = () => {
  const [markers, setMarkers] = useState([]);
  const [routeName, setRouteName] = useState('');
  const [simulationStates, setSimulationStates] = useState({ status: 'stopped' });
  const [simulationData, setSimulationData] = useState({
    items: [],
    activeStates: [],
    atIdx: -1,
  });
  const [committedSubroutes, setCommittedSubroutes] = useState([]);
  const [provisionalSubroutes, setProvisionalSubroutes] = useState([]);
  const [showOriginalPolylines, setShowOriginalPolylines] = useState(true);
  const [routeLoaded, setRouteLoaded] = useState(false); // New state variable

  // Function to handle map clicks and add markers
  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        const { latlng } = e;
        const newMarker = {
          lat: parseFloat(latlng.lat.toFixed(6)),
          lng: parseFloat(latlng.lng.toFixed(6)),
          time: getCurrentTimeFormatted(),
        };
        setMarkers((prevMarkers) => [...prevMarkers, newMarker]);
      },
    });
    return null;
  };

  // Function to reset markers
  const handleResetMarkers = () => {
    setMarkers([]);
    setCommittedSubroutes([]);
    setProvisionalSubroutes([]);
    setShowOriginalPolylines(true);
    setSimulationData({
      items: [],
      activeStates: [],
      atIdx: -1,
    });
    setSimulationStates({ status: 'stopped' });
  };

  // Function to update a marker
  const handleMarkerUpdate = (index, updatedMarker) => {
    setMarkers((prevMarkers) => {
      const newMarkers = [...prevMarkers];
      newMarkers[index] = {
        ...newMarkers[index],
        ...updatedMarker,
      };
      return newMarkers;
    });
  };

  // Function to remove a marker
  const handleRemoveMarker = (index) => {
    setMarkers((prevMarkers) => {
      const newMarkers = [...prevMarkers];
      newMarkers.splice(index, 1);
      return newMarkers;
    });
  };

  // Function to save the route to Firestore
  const handleSaveRoute = async () => {
    if (!routeName) {
      alert('Please enter a route name.');
      return;
    }
    if (markers.length === 0) {
      alert('Please add markers to save the route.');
      return;
    }
    try {
      const routeDocRef = doc(collection(db, 'routes'), routeName);
      await setDoc(routeDocRef, { markers });
      alert('Route saved successfully!');
    } catch (error) {
      console.error('Error saving route: ', error);
      alert('Failed to save route.');
    }
  };

  // Function to load the route from Firestore
  const handleLoadRoute = async () => {
    if (!routeName) {
      alert('Please enter a route name.');
      return;
    }
    try {
      const routeDocRef = doc(collection(db, 'routes'), routeName);
      const docSnapshot = await getDoc(routeDocRef);

      if (docSnapshot.exists()) {
        const loadedMarkers = docSnapshot.data().markers;
        setMarkers(loadedMarkers);
        setRouteLoaded(true); // Indicate that the route has been loaded
        alert('Route loaded successfully!');
      } else {
        alert('No route found with that name.');
      }
    } catch (error) {
      console.error('Error loading route: ', error);
      alert('Failed to load route.');
    }
  };

  // Function to delete the loaded route from Firestore
  const handleDeleteRoute = async () => {
    if (!routeName) {
      alert('Please enter a route name.');
      return;
    }
    try {
      const routeDocRef = doc(collection(db, 'routes'), routeName);
      await deleteDoc(routeDocRef);
      setMarkers([]);
      alert('Route deleted successfully!');
    } catch (error) {
      console.error('Error deleting route: ', error);
      alert('Failed to delete route.');
    }
  };

  // Function to handle marker drag end
  const handleMarkerDrag = (index, event) => {
    const { lat, lng } = event.target.getLatLng();
    setMarkers((prevMarkers) => {
      const newMarkers = [...prevMarkers];
      newMarkers[index] = {
        ...newMarkers[index],
        lat: parseFloat(lat.toFixed(6)),
        lng: parseFloat(lng.toFixed(6)),
      };
      return newMarkers;
    });
  };

  // MarkerRow Component
  const MarkerRow = ({ marker, index, handleMarkerUpdate, handleRemoveMarker }) => {
    const [latInput, setLatInput] = useState(marker.lat);
    const [lngInput, setLngInput] = useState(marker.lng);
    const [timeInput, setTimeInput] = useState(marker.time);

    const [prevLat, setPrevLat] = useState(marker.lat);
    const [prevLng, setPrevLng] = useState(marker.lng);
    const [prevTime, setPrevTime] = useState(marker.time);

    const [latError, setLatError] = useState(false);
    const [lngError, setLngError] = useState(false);
    const [timeError, setTimeError] = useState(false);

    useEffect(() => {
      setLatInput(marker.lat);
      setLngInput(marker.lng);
      setTimeInput(marker.time);
      setPrevLat(marker.lat);
      setPrevLng(marker.lng);
      setPrevTime(marker.time);
    }, [marker]);

    const handleLatBlur = () => {
      const updatedLat = parseFloat(latInput);

      if (isNaN(updatedLat) || updatedLat < -90 || updatedLat > 90) {
        setLatError(true);
        setTimeout(() => {
          setLatInput(prevLat);
          setLatError(false);
        }, 1000);
      } else {
        handleMarkerUpdate(index, {
          lat: parseFloat(updatedLat.toFixed(6)),
        });
        setPrevLat(updatedLat);
      }
    };

    const handleLngBlur = () => {
      const updatedLng = parseFloat(lngInput);

      if (isNaN(updatedLng) || updatedLng < -180 || updatedLng > 180) {
        setLngError(true);
        setTimeout(() => {
          setLngInput(prevLng);
          setLngError(false);
        }, 1000);
      } else {
        handleMarkerUpdate(index, {
          lng: parseFloat(updatedLng.toFixed(6)),
        });
        setPrevLng(updatedLng);
      }
    };

    const handleTimeBlur = () => {
      if (!isValidDateTime(timeInput)) {
        setTimeError(true);
        setTimeout(() => {
          setTimeInput(prevTime);
          setTimeError(false);
        }, 1000);
      } else {
        handleMarkerUpdate(index, {
          time: timeInput,
        });
        setPrevTime(timeInput);
      }
    };

    return (
      <tr key={index}>
        <td style={{ padding: '4px', verticalAlign: 'top' }}>{index + 1}</td>
        <td style={{ padding: '4px', verticalAlign: 'top' }}>
          <input
            type='number'
            step='0.00001'
            value={latInput !== '' ? latInput : ''}
            onChange={(e) => setLatInput(e.target.value)}
            onBlur={handleLatBlur}
            style={{
              width: '100%',
              borderColor: latError ? 'red' : undefined,
            }}
          />
        </td>
        <td style={{ padding: '4px', verticalAlign: 'top' }}>
          <input
            type='number'
            step='0.00001'
            value={lngInput !== '' ? lngInput : ''}
            onChange={(e) => setLngInput(e.target.value)}
            onBlur={handleLngBlur}
            style={{
              width: '100%',
              borderColor: lngError ? 'red' : undefined,
            }}
          />
        </td>
        <td style={{ padding: '4px', verticalAlign: 'top' }}>
          <input
            type='text'
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            onBlur={handleTimeBlur}
            style={{
              width: '100%',
              borderColor: timeError ? 'red' : undefined,
            }}
          />
        </td>
        <td
          style={{
            padding: '4px',
            verticalAlign: 'top',
            textAlign: 'center',
          }}
        >
          <button
            onClick={() => handleRemoveMarker(index)}
            style={{
              background: 'none',
              border: 'none',
              color: 'red',
              cursor: 'pointer',
              fontSize: '16px',
            }}
            title='Remove Marker'
          >
            &#10005;
          </button>
        </td>
      </tr>
    );
  };

  // Function to handle simulation controls
  const dynamic_map_match = () => {
    if (simulationStates.status === 'stopped' || simulationStates.status === 'paused') {
      if (markers.length > 1) {
        setSimulationStates({ status: 'running' });
        if (simulationData.atIdx < 0) {
          const items = markers.map((marker) => ({
            coords: [marker.lat, marker.lng, new Date(marker.time)],
          }));
          setSimulationData((prev) => ({
            ...prev,
            atIdx: 0,
            items: items,
          }));
        }
      } else {
        alert('Not enough simulation data!');
      }
    } else if (simulationStates.status === 'running') {
      setSimulationStates({ status: 'paused' });
    }
  };

  const handleStop = () => {
    setSimulationStates({ status: 'stopped' });
    setSimulationData({
      items: [],
      activeStates: [],
      atIdx: -1,
    });
    setCommittedSubroutes([]);
    setProvisionalSubroutes([]);
    setShowOriginalPolylines(true);
  };

  useEffect(() => {
    if (simulationStates.status === 'running') {
      if (simulationData.atIdx >= 0) {
        setShowOriginalPolylines(false);
        send_dynamic_map_matching_request(simulationData.atIdx);
      }
    } else if (simulationStates.status === 'stopped') {
      setShowOriginalPolylines(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationStates.status, simulationData.atIdx]);

  const send_dynamic_map_matching_request = (i) => {
    if (i >= markers.length || simulationStates.status !== 'running') {
      setSimulationStates({ status: 'stopped' });
      return;
    }

    const payloadContent = {
      active_states: simulationData.activeStates || [],
      coordinates: {
        Idx: i,
        Lat: String(markers[i].lat),
        Lon: String(markers[i].lng),
        RegisteredTime: markers[i].time,
        Type: 'Route',
      },
    };

    // Adjust the request to match the server's expected format
    fetch('http://localhost:8080/map_match_dynamic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadContent),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log('Request succeeded with JSON response:', data);

        // Assuming the response is in the format of JsonAdaptedDynamicMapMatchingResponse
        // Extract the necessary data
        const result = data;

        setSimulationData((prev) => ({
          ...prev,
          activeStates: result.active_states,
          atIdx: i + 1,
        }));

        // Process committed subroutes
        setCommittedSubroutes((prevCommitted) => {
          let newCommitted = [...prevCommitted];
          result.committed_subroutes.forEach((subroute) => {
            // Remove overlapping provisional subroutes
            setProvisionalSubroutes((prevProvisional) =>
              prevProvisional.filter((p_subroute) => p_subroute.end_idx > subroute.end_idx)
            );

            const coords = subroute.coordinates.coordinates.map((coord) => [
              parseFloat(coord.Lat),
              parseFloat(coord.Lon),
            ]);
            newCommitted.push({
              start_idx: subroute.start_idx,
              end_idx: subroute.end_idx,
              coords,
            });

            // Notify when a provisional subroute is committed
            alert(
              `Provisional subroute from index ${subroute.start_idx} to ${subroute.end_idx} has been committed.`
            );
          });
          return newCommitted;
        });

        // Process provisional subroutes
        setProvisionalSubroutes((prevProvisional) => {
          let newProvisional = [...prevProvisional];
          result.provisional_subroutes.forEach((subroute) => {
            const coords = subroute.coordinates.coordinates.map((coord) => [
              parseFloat(coord.Lat),
              parseFloat(coord.Lon),
            ]);
            const start_idx = subroute.start_idx;
            const end_idx = subroute.end_idx;

            // Remove overlapping provisional subroutes
            newProvisional = newProvisional.filter((r) => r.end_idx <= start_idx);

            newProvisional.push({
              start_idx,
              end_idx,
              coords,
            });
          });
          return newProvisional;
        });

        // Continue simulation
        if (simulationStates.status === 'running') {
          setTimeout(() => {
            send_dynamic_map_matching_request(i + 1);
          }, 2500);
        }
      })
      .catch((error) => {
        console.error('Request failed:', error);
        alert('Request failed: ' + error);
        setSimulationStates({ status: 'stopped' });
      });
  };

  // MapViewUpdater Component
  const MapViewUpdater = ({ markers, routeLoaded, setRouteLoaded }) => {
    const map = useMap();

    useEffect(() => {
      if (routeLoaded && markers.length > 0) {
        // Calculate the average latitude and longitude
        const latSum = markers.reduce((acc, marker) => acc + marker.lat, 0);
        const lngSum = markers.reduce((acc, marker) => acc + marker.lng, 0);
        const avgLat = latSum / markers.length;
        const avgLng = lngSum / markers.length;

        // Set the view to the average position
        map.setView([avgLat, avgLng], map.getZoom(), { animate: true, duration: 0.5 });

        // Reset routeLoaded to prevent repeated adjustments
        setRouteLoaded(false);
      }
    }, [routeLoaded, markers, map, setRouteLoaded]);

    return null;
  };

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px',
          backgroundColor: '#f9f9f9',
          zIndex: 1000,
        }}
      >
        <h1>Map Matching App</h1>
        <div>
          <button onClick={dynamic_map_match} style={{ marginRight: '10px' }}>
            {simulationStates.status === 'running'
              ? 'Pause'
              : simulationStates.status === 'paused'
              ? 'Continue Match'
              : 'Match Dynamically'}
          </button>
          <button onClick={handleStop}>Stop</button>
        </div>
      </header>
      <MapContainer
        center={[34.0056365, -118.1658475]}
        zoom={11}
        style={{ height: 'calc(100% - 60px)', width: '100%' }}
      >
        <TileLayer
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          attribution='&copy; OpenStreetMap contributors'
        />
        <MapClickHandler />
        <MapViewUpdater
          markers={markers}
          routeLoaded={routeLoaded}
          setRouteLoaded={setRouteLoaded}
        />
        {markers
          .filter((marker) => !isNaN(marker.lat) && !isNaN(marker.lng))
          .map((marker, idx) => (
            <Marker
              key={idx}
              position={[marker.lat, marker.lng]}
              draggable={true}
              eventHandlers={{
                drag: (event) => handleMarkerDrag(idx, event),
              }}
            >
              <Tooltip direction='top' offset={[0, -20]} permanent>
                {idx + 1}
              </Tooltip>
              <Popup>
                Marker at {marker.lat.toFixed(6)}, {marker.lng.toFixed(6)}
                <br />
                Time: {marker.time}
              </Popup>
            </Marker>
          ))}
        {showOriginalPolylines && markers.length > 1 && (
          <Polyline
            positions={markers
              .filter((marker) => !isNaN(marker.lat) && !isNaN(marker.lng))
              .map((marker) => [marker.lat, marker.lng])}
          />
        )}
        {/* Render committed subroutes */}
        {committedSubroutes.map((subroute, idx) => (
          <Polyline
            key={`committed-${idx}`}
            positions={subroute.coords}
            color='purple'
            weight={5}
          />
        ))}
        {/* Render provisional subroutes */}
        {provisionalSubroutes.map((subroute, idx) => (
          <Polyline
            key={`provisional-${idx}`}
            positions={subroute.coords}
            color='purple'
            dashArray='5,10'
            weight={3}
          />
        ))}
      </MapContainer>

      <Draggable>
        <div
          style={{
            position: 'absolute',
            top: '70px',
            right: '10px',
            width: '420px',
            padding: '10px',
            backgroundColor: '#f9f9f9',
            overflowY: 'auto',
            boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
            cursor: 'move',
            opacity: 0.9,
            zIndex: 1000,
          }}
        >
          <h3>Editor Pane</h3>
          <button onClick={handleResetMarkers} style={{ marginBottom: '10px' }}>
            Reset Markers
          </button>
          <h4>Route</h4>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor='routeName'>Name</label>
            <input
              type='text'
              id='routeName'
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              style={{ width: '40%', marginLeft: '10px' }}
            />
            <button style={{ marginLeft: '10px' }} onClick={handleSaveRoute}>
              Save
            </button>
            <button style={{ marginLeft: '10px' }} onClick={handleLoadRoute}>
              Load
            </button>
            <button style={{ marginLeft: '10px' }} onClick={handleDeleteRoute}>
              Delete
            </button>
          </div>

          {markers.length > 0 ? (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
              }}
            >
              <colgroup>
                <col style={{ width: '5%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '35%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Lat</th>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Lng</th>
                  <th style={{ textAlign: 'left', padding: '4px' }}>Time</th>
                  <th style={{ textAlign: 'left', padding: '4px' }}></th>
                </tr>
              </thead>
              <tbody>
                {markers.map((marker, idx) => (
                  <MarkerRow
                    key={idx}
                    marker={marker}
                    index={idx}
                    handleMarkerUpdate={handleMarkerUpdate}
                    handleRemoveMarker={handleRemoveMarker}
                  />
                ))}
              </tbody>
            </table>
          ) : null}
          <p>
            <b>Click</b> on the map to add markers.
          </p>
          {markers.length > 1 ? (
            <p>Edit markers by dragging them, or by changing the values in the table above.</p>
          ) : null}
        </div>
      </Draggable>
    </div>
  );
};

export default MapComponent;
